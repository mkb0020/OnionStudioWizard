# Onion Studio Wizard

Personal game-dev tool suite for the metroidvania. One Tauri 2 desktop app that hosts the standalone tools from the `kinematics` repo. See `BRIEFME.md` for goals, decisions and the to-do list.

## Run it

Needs Node, Rust, and the Tauri 2 prerequisites for Windows (WebView2 is already on Windows 11).

```
npm install
npm run dev        # tauri dev
npm run build      # tauri build (installer in src-tauri/target/release/bundle)
npm test           # JS tests for the library (node --test)
cargo test         # Rust tests; run inside src-tauri/
```

No bundler: `src/` is the frontend and Tauri serves it as-is. `src/index.html` also works in any static server (for example VS Code Live Server opened on `src/`), where the window buttons are no-ops.

## Layout

```
src/
  index.html          shell page (PrettyKit window, title bar buttons, stage, status bar)
  js/shell.js         title bar tool buttons (+ group dropdowns), lazy iframe per tool, window drag
  js/statusMirror.js  mirrors a tool's footer into the shell status bar (draw tool uses it)
  js/tools.js         tool registry: add a tool = drop HTML in src/tools/ + set src here
  js/prettyKit/       vendored PrettyKit window.js
  css/                fonts.css (bundled fonts), prettyKit.css, shell.css
  tools/              drawingTool.html, animatedRig.html (copied from kinematics)
  assets/ json_files/ what those tools load
  js/library/        storage adapters (disk via Tauri / memory) + manifest logic
  js/bridge.js        shell side of the postMessage bridge; js/oswClient.js is the tool side
  js/libraryPanel.js  Library drawer (folder setting, PNG import, browse/rename/delete)
src-tauri/            Rust side: window commands for PrettyKit's buttons + the library file commands (library.rs)
library/              created on first run: manifest.json + parts/, accessories/, characters/, maps/, capes/ (git-tracked)
tests/                node tests for the library
```

Each tool HTML has one `<base href="../">` line so `assets/...` and `json_files/...` resolve from `src/`. Other edits to the copied tools: the drawing tool's Google Fonts link now points at `css/fonts.css`, and its dead `OrbitronLocal` font rule was removed. The drawing tool also detects when it is embedded (`html.osw-embedded`), hides its own footer and gives that row back to the canvas; the shell shows the same items in its status bar.
