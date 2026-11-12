// ONION STUDIO WIZARD - EXPORTS FOLDER
// TOOLS SAVE EXPORTS (SPRITE SHEETS, TIMING JSON, ZIPS) STRAIGHT TO DISK THROUGH THE APP INSTEAD OF AS BROWSER DOWNLOADS,
// SO WEBVIEW2'S "ALLOW MULTIPLE DOWNLOADS?" PROMPT CAN NEVER BLOCK THEM.
// DEFAULT FOLDER = <Downloads>/Onion Studio Wizard. A CHOSEN FOLDER IS REMEMBERED AS ONE LINE IN export_dir.txt (APP CONFIG DIR).
// AN EXPORT WITH THE SAME NAME OVERWRITES THE OLD ONE ON PURPOSE: THE TIMING JSON NAMES ITS SHEET FILE, SO "(1)" SUFFIXES WOULD BREAK THAT LINK.
// PURE std (NO TAURI) SO THE TESTS BELOW RUN WITH A PLAIN `rustc --test src/exports.rs`.

use std::fs;
use std::path::{Path, PathBuf};

pub const MAX_BYTES: usize = 512 * 1024 * 1024;

// A BARE FILE NAME FROM A TOOL: NO FOLDERS, NOTHING WINDOWS REFUSES, NOT EMPTY / "." / "..".
pub fn clean_name(name: &str) -> Result<String, String> {
    let n = name.trim();
    if n.is_empty() || n == "." || n == ".." || n.len() > 200 {
        return Err(format!("BAD_NAME: \"{name}\" is not a usable file name"));
    }
    if n.chars().any(|c| c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')) {
        return Err(format!("BAD_NAME: \"{name}\" has characters a file name cannot use"));
    }
    if n.ends_with('.') {
        return Err(format!("BAD_NAME: \"{name}\" cannot end with a dot"));
    }
    Ok(n.to_string())
}

// A FOLDER TYPED / PASTED / PICKED BY THE USER. WINDOWS "Copy as path" WRAPS IT IN QUOTES, SO THOSE ARE STRIPPED.
pub fn validate_dir(input: &str) -> Result<PathBuf, String> {
    let cleaned = input.trim().trim_matches('"').trim();
    if cleaned.is_empty() {
        return Err("BAD_PATH: the folder is empty".into());
    }
    let p = PathBuf::from(cleaned);
    if !p.is_absolute() {
        return Err(format!("BAD_PATH: \"{cleaned}\" is not a full path (it should start with a drive, like C:\\)"));
    }
    if p.exists() && !p.is_dir() {
        return Err(format!("BAD_PATH: \"{cleaned}\" is a file, not a folder"));
    }
    Ok(p)
}

pub fn read_dir_setting(file: &Path) -> Option<PathBuf> {
    let text = fs::read_to_string(file).ok()?;
    let line = text.lines().next()?.trim();
    if line.is_empty() { None } else { Some(PathBuf::from(line)) }
}

pub fn write_dir_setting(file: &Path, dir: Option<&Path>) -> Result<(), String> {
    match dir {
        None => match fs::remove_file(file) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(format!("IO: {e}")),
        },
        Some(d) => {
            if let Some(parent) = file.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("IO: {e}"))?;
            }
            fs::write(file, format!("{}\n", d.to_string_lossy())).map_err(|e| format!("IO: {e}"))
        }
    }
}

// WRITES dir/name (MAKING THE FOLDER IF NEEDED), VIA A TEMP FILE SO A HALF-WRITTEN EXPORT NEVER REPLACES A GOOD ONE.
pub fn write_export(dir: &Path, name: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    let name = clean_name(name)?;
    if bytes.len() > MAX_BYTES {
        return Err(format!("TOO_BIG: {} MB is over the {} MB export limit", bytes.len() >> 20, MAX_BYTES >> 20));
    }
    fs::create_dir_all(dir).map_err(|e| format!("IO: could not make {}: {e}", dir.display()))?;
    let dest = dir.join(&name);
    let tmp = dir.join(format!(".{name}.part"));
    fs::write(&tmp, bytes).map_err(|e| format!("IO: could not write {}: {e}", dest.display()))?;
    if dest.exists() {
        let _ = fs::remove_file(&dest);   // WINDOWS rename WILL NOT REPLACE AN EXISTING FILE
    }
    fs::rename(&tmp, &dest).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("IO: could not write {}: {e}", dest.display())
    })?;
    Ok(dest)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("osw_exports_test_{tag}_{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn names() {
        assert_eq!(clean_name("  sprite_sheet_512px_4x1.png ").unwrap(), "sprite_sheet_512px_4x1.png");
        assert!(clean_name("sprite timing.json").is_ok());
        for bad in ["", " ", ".", "..", "../x.png", "a/b.png", "a\\b.png", "C:x", "a?.png", "x.", "a\u{0}b"] {
            assert!(clean_name(bad).is_err(), "{bad:?} should be refused");
        }
    }

    #[test]
    fn writes_overwrites_and_makes_folders() {
        let d = scratch("write").join("nested").join("deeper");
        let p = write_export(&d, "a.png", b"one").unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"one");
        write_export(&d, "a.png", b"two-two").unwrap();
        assert_eq!(fs::read(d.join("a.png")).unwrap(), b"two-two");
        assert!(!d.join(".a.png.part").exists());
        assert!(write_export(&d, "../escape.png", b"x").is_err());
        let _ = fs::remove_dir_all(scratch("write"));
    }

    #[test]
    fn dir_setting_round_trip() {
        let root = scratch("setting");
        let file = root.join("cfg").join("export_dir.txt");
        assert_eq!(read_dir_setting(&file), None);
        let chosen = root.join("My Exports");
        write_dir_setting(&file, Some(&chosen)).unwrap();
        assert_eq!(read_dir_setting(&file), Some(chosen));
        write_dir_setting(&file, None).unwrap();
        assert_eq!(read_dir_setting(&file), None);
        write_dir_setting(&file, None).unwrap();   // ALREADY GONE IS FINE
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn validates_dirs() {
        let root = scratch("validate");
        fs::create_dir_all(&root).unwrap();
        let quoted = format!("\"{}\"", root.display());
        assert_eq!(validate_dir(&quoted).unwrap(), root);
        assert!(validate_dir("relative/folder").is_err());
        assert!(validate_dir("  ").is_err());
        let f = root.join("file.txt");
        fs::write(&f, b"x").unwrap();
        assert!(validate_dir(&f.to_string_lossy()).is_err());
        let _ = fs::remove_dir_all(&root);
    }
}
