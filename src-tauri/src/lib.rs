// ONION STUDIO WIZARD - TAURI SIDE
// 1) THE WINDOW IS UNDECORATED (PRETTYKIT DRAWS THE TITLE BAR), SO THREE COMMANDS BACK ITS BUTTONS.
//    PrettyKit's window.js CALLS THEM BY NAME VIA window.__TAURI__.core.invoke (withGlobalTauri IS ON).
// 2) THE LIBRARY: A FOLDER OF PNGs + manifest.json. library.rs DOES THE FILE WORK (AND IS UNIT TESTED);
//    THE COMMANDS BELOW ONLY FIND THE ROOT FOLDER AND PASS DATA THROUGH. FILE DATA TRAVELS AS BASE64 TEXT,
//    WHICH IS PLENTY FAST FOR SPRITE-SIZED PNGs AND KEEPS THE COMMAND SIGNATURES PLAIN.

mod library;

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, WebviewWindow};

// ---------- WINDOW BUTTONS ----------

#[tauri::command]
fn minimize_window(window: WebviewWindow) {
    let _ = window.minimize();
}

#[tauri::command]
fn toggle_maximize_window(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn close_window(window: WebviewWindow) {
    let _ = window.close();
}

// ---------- LIBRARY ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryInfo {
    root: String,
    is_default: bool,
    default_root: String,
}

fn settings_file(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|d| d.join("settings.json"))
        .map_err(|e| format!("IO: {e}"))
}

fn default_root() -> PathBuf {
    library::default_root_from(Path::new(env!("CARGO_MANIFEST_DIR")))
}

// (ROOT FOLDER, true IF IT IS THE DEFAULT)
fn current_root(app: &AppHandle) -> Result<(PathBuf, bool), String> {
    Ok(match library::read_root_setting(&settings_file(app)?) {
        Some(p) => (p, false),
        None => (default_root(), true),
    })
}

fn info_of(app: &AppHandle) -> Result<LibraryInfo, String> {
    let (root, is_default) = current_root(app)?;
    library::ensure_root(&root)?;
    Ok(LibraryInfo {
        root: root.to_string_lossy().into_owned(),
        is_default,
        default_root: default_root().to_string_lossy().into_owned(),
    })
}

#[tauri::command]
async fn library_info(app: AppHandle) -> Result<LibraryInfo, String> {
    info_of(&app)
}

// path = None RESETS TO THE DEFAULT (<repo>/library)
#[tauri::command]
async fn library_set_root(app: AppHandle, path: Option<String>) -> Result<LibraryInfo, String> {
    let file = settings_file(&app)?;
    match path {
        Some(p) => {
            let root = library::validate_custom_root(&p)?;
            library::write_root_setting(&file, Some(&root))?;
        }
        None => library::write_root_setting(&file, None)?,
    }
    info_of(&app)
}

#[tauri::command]
async fn library_read(app: AppHandle, path: String) -> Result<String, String> {
    let (root, _) = current_root(&app)?;
    library::ensure_root(&root)?;
    library::read_file(&root, &path).map(|bytes| B64.encode(bytes))
}

#[tauri::command]
async fn library_write(app: AppHandle, path: String, data: String) -> Result<(), String> {
    let bytes = B64.decode(data.as_bytes()).map_err(|e| format!("BAD_DATA: {e}"))?;
    let (root, _) = current_root(&app)?;
    library::ensure_root(&root)?;
    library::write_file(&root, &path, &bytes)
}

#[tauri::command]
async fn library_list(app: AppHandle, dir: String, recursive: bool) -> Result<Vec<library::Entry>, String> {
    let (root, _) = current_root(&app)?;
    library::ensure_root(&root)?;
    library::list_dir(&root, &dir, recursive)
}

#[tauri::command]
async fn library_delete(app: AppHandle, path: String) -> Result<(), String> {
    let (root, _) = current_root(&app)?;
    library::ensure_root(&root)?;
    library::delete_file(&root, &path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            toggle_maximize_window,
            close_window,
            library_info,
            library_set_root,
            library_read,
            library_write,
            library_list,
            library_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running Onion Studio Wizard");
}
