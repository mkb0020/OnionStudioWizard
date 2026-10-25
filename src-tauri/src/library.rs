// ONION STUDIO WIZARD - LIBRARY STORAGE
// PURE std + serde (NO TAURI TYPES) SO IT CAN BE UNIT TESTED ON ITS OWN. lib.rs WRAPS THESE IN TAURI COMMANDS.
//
// EVERY PATH THE UI SENDS IS RELATIVE TO THE LIBRARY ROOT, USES "/" AND ONLY A-Z a-z 0-9 . _ - (SO IT IS A SAFE
// WINDOWS FILE NAME AND NEVER NEEDS ESCAPING). NOTHING OUTSIDE THE ROOT CAN BE READ, WRITTEN OR DELETED.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

pub const MANIFEST: &str = "manifest.json";
const MAX_REL_LEN: usize = 240;
const MAX_LIST: usize = 5000;
const RESERVED: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1",
    "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub path: String,
    pub size: u64,
    pub modified: u64, // MS SINCE EPOCH
    pub is_dir: bool,
}

// DEFAULT LIBRARY = <repo>/library, WHERE <repo> IS THE PARENT OF src-tauri (BAKED IN AT COMPILE TIME).
// THAT KEEPS THE LIBRARY INSIDE THE GIT REPO WITH ZERO SETUP WHEN YOU RUN `tauri dev` ON YOUR OWN MACHINE.
pub fn default_root_from(manifest_dir: &Path) -> PathBuf {
    manifest_dir.parent().unwrap_or(manifest_dir).join("library")
}

// ---------- PATH SAFETY ----------

pub fn validate_rel(rel: &str) -> Result<Vec<&str>, String> {
    if rel.is_empty() || rel.len() > MAX_REL_LEN {
        return Err("BAD_PATH: empty or too long".into());
    }
    if !rel.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-' | b'/')) {
        return Err(format!("BAD_PATH: only A-Z a-z 0-9 . _ - and / are allowed ({rel})"));
    }
    let parts: Vec<&str> = rel.split('/').collect();
    for p in &parts {
        if p.is_empty() {
            return Err(format!("BAD_PATH: empty folder name ({rel})"));
        }
        if p.starts_with('.') || p.ends_with('.') {
            return Err(format!("BAD_PATH: names cannot start or end with a dot ({rel})"));
        }
        let stem = p.split('.').next().unwrap_or("").to_ascii_uppercase();
        if RESERVED.contains(&stem.as_str()) {
            return Err(format!("BAD_PATH: reserved Windows name ({rel})"));
        }
    }
    Ok(parts)
}

// THE DEEPEST EXISTING PARENT OF target MUST SIT INSIDE root (CATCHES SYMLINKS / JUNCTIONS THAT POINT OUTSIDE)
fn check_inside(root: &Path, target: &Path) -> Result<(), String> {
    let root_c = root.canonicalize().map_err(|e| format!("IO: {e}"))?;
    let mut probe = target;
    while !probe.exists() {
        probe = probe.parent().ok_or_else(|| "BAD_PATH: no existing parent".to_string())?;
    }
    let found = probe.canonicalize().map_err(|e| format!("IO: {e}"))?;
    if found.starts_with(&root_c) {
        Ok(())
    } else {
        Err("BAD_PATH: outside the library folder".into())
    }
}

fn resolve(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let parts = validate_rel(rel)?;
    let mut p = root.to_path_buf();
    for part in parts {
        p.push(part);
    }
    check_inside(root, &p)?;
    Ok(p)
}

pub fn ensure_root(root: &Path) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|e| format!("IO: cannot create {}: {e}", root.display()))?;
    if root.is_dir() {
        Ok(())
    } else {
        Err(format!("BAD_ROOT: {} is not a folder", root.display()))
    }
}

// ---------- FILE OPERATIONS ----------

pub fn read_file(root: &Path, rel: &str) -> Result<Vec<u8>, String> {
    let p = resolve(root, rel)?;
    match fs::read(&p) {
        Ok(b) => Ok(b),
        Err(e) if e.kind() == ErrorKind::NotFound => Err(format!("NOT_FOUND: {rel}")),
        Err(e) => Err(format!("IO: {e}")),
    }
}

// WRITES TO A SIBLING <name>.tmp THEN RENAMES OVER THE TARGET, SO A CRASH NEVER LEAVES A HALF-WRITTEN FILE
pub fn write_file(root: &Path, rel: &str, bytes: &[u8]) -> Result<(), String> {
    let target = resolve(root, rel)?;
    let parent = target.parent().ok_or_else(|| "BAD_PATH: no parent folder".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("IO: {e}"))?;
    check_inside(root, &target)?;
    let name = target.file_name().and_then(|n| n.to_str()).ok_or_else(|| "BAD_PATH: bad file name".to_string())?;
    let tmp = parent.join(format!("{name}.tmp"));
    fs::write(&tmp, bytes).map_err(|e| format!("IO: {e}"))?;
    if let Err(e) = fs::rename(&tmp, &target) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("IO: {e}"));
    }
    Ok(())
}

// IDEMPOTENT: DELETING A FILE THAT IS ALREADY GONE IS FINE. FOLDERS AND THE MANIFEST ARE NEVER DELETED HERE.
pub fn delete_file(root: &Path, rel: &str) -> Result<(), String> {
    if rel == MANIFEST {
        return Err("BAD_PATH: the manifest cannot be deleted".into());
    }
    let p = resolve(root, rel)?;
    match fs::symlink_metadata(&p) {
        Ok(md) if md.is_dir() => Err(format!("BAD_PATH: {rel} is a folder")),
        Ok(_) => fs::remove_file(&p).map_err(|e| format!("IO: {e}")),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("IO: {e}")),
    }
}

// rel_dir "" = THE ROOT ITSELF. SKIPS DOT-FILES, *.tmp, AND ANYTHING WITH A NAME THE UI COULD NOT ADDRESS ANYWAY.
pub fn list_dir(root: &Path, rel_dir: &str, recursive: bool) -> Result<Vec<Entry>, String> {
    let base = if rel_dir.is_empty() { root.to_path_buf() } else { resolve(root, rel_dir)? };
    let mut out = Vec::new();
    if base.is_dir() {
        walk(&base, root, recursive, &mut out)?;
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

fn walk(dir: &Path, root: &Path, recursive: bool, out: &mut Vec<Entry>) -> Result<(), String> {
    for item in fs::read_dir(dir).map_err(|e| format!("IO: {e}"))? {
        let item = item.map_err(|e| format!("IO: {e}"))?;
        let name = item.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || name.ends_with(".tmp") {
            continue;
        }
        let path = item.path();
        let rel = match path.strip_prefix(root) {
            Ok(r) => r.components().map(|c| c.as_os_str().to_string_lossy().into_owned()).collect::<Vec<_>>().join("/"),
            Err(_) => continue,
        };
        if validate_rel(&rel).is_err() {
            continue;
        }
        let md = item.metadata().map_err(|e| format!("IO: {e}"))?;
        let modified = md
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        out.push(Entry { path: rel, size: if md.is_dir() { 0 } else { md.len() }, modified, is_dir: md.is_dir() });
        if out.len() > MAX_LIST {
            return Err("TOO_MANY: more than 5000 entries".into());
        }
        if recursive && md.is_dir() {
            walk(&path, root, recursive, out)?;
        }
    }
    Ok(())
}

// ---------- SETTINGS (WHERE THE LIBRARY ROOT IS, IF NOT THE DEFAULT) ----------

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Settings {
    #[serde(default)]
    library_root: Option<String>,
}

pub fn read_root_setting(settings_file: &Path) -> Option<PathBuf> {
    let text = fs::read_to_string(settings_file).ok()?;
    let st: Settings = serde_json::from_str(&text).ok()?;
    st.library_root.filter(|r| !r.trim().is_empty()).map(PathBuf::from)
}

pub fn write_root_setting(settings_file: &Path, root: Option<&Path>) -> Result<(), String> {
    if let Some(parent) = settings_file.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("IO: {e}"))?;
    }
    let st = Settings { library_root: root.map(|p| p.to_string_lossy().into_owned()) };
    let json = serde_json::to_string_pretty(&st).map_err(|e| format!("IO: {e}"))?;
    fs::write(settings_file, json + "\n").map_err(|e| format!("IO: {e}"))
}

// A PATH TYPED OR PASTED BY THE USER. WINDOWS "Copy as path" WRAPS IT IN QUOTES, SO THOSE ARE STRIPPED.
pub fn validate_custom_root(input: &str) -> Result<PathBuf, String> {
    let cleaned = input.trim().trim_matches('"').trim();
    let p = PathBuf::from(cleaned);
    if cleaned.is_empty() || !p.is_absolute() {
        return Err("BAD_ROOT: use a full path, like C:\\Users\\you\\OnionStudioWizard\\library".into());
    }
    if p.exists() && !p.is_dir() {
        return Err("BAD_ROOT: that path is a file, not a folder".into());
    }
    fs::create_dir_all(&p).map_err(|e| format!("IO: cannot create {}: {e}", p.display()))?;
    Ok(p)
}

// ---------- TESTS ----------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static N: AtomicU32 = AtomicU32::new(0);

    fn temp_root() -> PathBuf {
        let n = N.fetch_add(1, Ordering::SeqCst);
        let nanos = std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let p = std::env::temp_dir().join(format!("osw_test_{}_{}_{}", std::process::id(), n, nanos));
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn default_root_is_repo_library() {
        assert_eq!(default_root_from(Path::new("/x/Repo/src-tauri")), PathBuf::from("/x/Repo/library"));
    }

    #[test]
    fn validate_accepts_normal_paths() {
        for ok in ["manifest.json", "parts/head_01.png", "characters/nova/views/left-front.png", "a/b/c.d.e"] {
            assert!(validate_rel(ok).is_ok(), "{ok} should be accepted");
        }
    }

    #[test]
    fn validate_rejects_bad_paths() {
        let long = "a".repeat(300);
        for bad in [
            "", "/abs", "a//b", "a/", "../x", "a/../x", ".git/config", "a/.hidden", "a\\b", "C:/x", "x.", "a b.png",
            "caf\u{e9}.png", "parts/CON.png", "nul", "aux.txt", "LPT3.png", &long,
        ] {
            assert!(validate_rel(bad).is_err(), "{bad:?} should be rejected");
        }
    }

    #[test]
    fn write_read_roundtrip_and_overwrite() {
        let root = temp_root();
        write_file(&root, "parts/head_01.png", b"one").unwrap();
        assert_eq!(read_file(&root, "parts/head_01.png").unwrap(), b"one");
        write_file(&root, "parts/head_01.png", b"two-two").unwrap();
        assert_eq!(read_file(&root, "parts/head_01.png").unwrap(), b"two-two");
        let leftovers: Vec<_> = list_dir(&root, "parts", true).unwrap();
        assert_eq!(leftovers.len(), 1, "no .tmp file may remain: {leftovers:?}");
    }

    #[test]
    fn read_missing_is_not_found() {
        let root = temp_root();
        assert!(read_file(&root, "parts/nope.png").unwrap_err().starts_with("NOT_FOUND"));
    }

    #[test]
    fn traversal_is_blocked() {
        let root = temp_root();
        assert!(write_file(&root, "../escape.txt", b"x").is_err());
        assert!(read_file(&root, "a/../../escape.txt").is_err());
        assert!(delete_file(&root, "../escape.txt").is_err());
        assert!(!root.parent().unwrap().join("escape.txt").exists());
    }

    #[test]
    fn delete_is_idempotent_and_protects_manifest() {
        let root = temp_root();
        write_file(&root, MANIFEST, b"{}").unwrap();
        assert!(delete_file(&root, MANIFEST).is_err());
        assert!(root.join(MANIFEST).exists());
        write_file(&root, "parts/a.png", b"x").unwrap();
        delete_file(&root, "parts/a.png").unwrap();
        delete_file(&root, "parts/a.png").unwrap();
        assert!(delete_file(&root, "parts").is_err(), "folders are not deletable");
    }

    #[test]
    fn list_recursive_sorted_and_filtered() {
        let root = temp_root();
        write_file(&root, "parts/b.png", b"bb").unwrap();
        write_file(&root, "parts/a.png", b"a").unwrap();
        write_file(&root, "characters/nova/views/front.png", b"f").unwrap();
        fs::write(root.join("parts").join("half.png.tmp"), b"t").unwrap();
        fs::write(root.join("parts").join("bad name.png"), b"t").unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join(".git").join("HEAD"), b"t").unwrap();
        let all = list_dir(&root, "", true).unwrap();
        let paths: Vec<&str> = all.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(
            paths,
            ["characters", "characters/nova", "characters/nova/views", "characters/nova/views/front.png", "parts", "parts/a.png", "parts/b.png"]
        );
        let flat = list_dir(&root, "parts", false).unwrap();
        assert_eq!(flat.iter().map(|e| e.size).collect::<Vec<_>>(), [1, 2]);
        assert!(flat.iter().all(|e| !e.is_dir));
        assert!(list_dir(&root, "nothing_here", true).unwrap().is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn symlink_out_of_root_is_blocked() {
        let root = temp_root();
        let outside = temp_root();
        fs::write(outside.join("secret.txt"), b"s").unwrap();
        std::os::unix::fs::symlink(&outside, root.join("link")).unwrap();
        assert!(read_file(&root, "link/secret.txt").is_err());
        assert!(write_file(&root, "link/new.txt", b"x").is_err());
        assert!(!outside.join("new.txt").exists());
    }

    #[test]
    fn settings_roundtrip() {
        let dir = temp_root();
        let file = dir.join("cfg").join("settings.json");
        assert_eq!(read_root_setting(&file), None);
        write_root_setting(&file, Some(Path::new("/some/where"))).unwrap();
        assert_eq!(read_root_setting(&file), Some(PathBuf::from("/some/where")));
        write_root_setting(&file, None).unwrap();
        assert_eq!(read_root_setting(&file), None);
        fs::write(&file, b"not json").unwrap();
        assert_eq!(read_root_setting(&file), None, "a broken settings file falls back to the default");
    }

    #[test]
    fn custom_root_validation() {
        assert!(validate_custom_root("relative/path").is_err());
        assert!(validate_custom_root("   ").is_err());
        let base = temp_root();
        let f = base.join("a_file");
        fs::write(&f, b"x").unwrap();
        assert!(validate_custom_root(f.to_str().unwrap()).is_err());
        let quoted = format!("\"{}\"", base.join("newlib").display());
        let made = validate_custom_root(&quoted).unwrap();
        assert!(made.is_dir());
    }
}
