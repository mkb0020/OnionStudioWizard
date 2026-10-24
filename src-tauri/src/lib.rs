// ONION STUDIO WIZARD - TAURI SIDE
// THE WINDOW IS UNDECORATED (PRETTYKIT DRAWS THE TITLE BAR), SO THESE THREE COMMANDS BACK ITS BUTTONS.
// PrettyKit's window.js CALLS THEM BY NAME VIA window.__TAURI__.core.invoke (withGlobalTauri IS ON).
// LIBRARY / FILE COMMANDS COME IN THE NEXT STEP.

use tauri::WebviewWindow;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            toggle_maximize_window,
            close_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running Onion Studio Wizard");
}
