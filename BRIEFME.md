# ONION STUDIO WIZARD

## Project Overview
  - **Type:**  Desktop App / Personal Game Dev Tool
  - **Status:** Planning 
  - **Description:** Tool for MK's personal use while developing a Metroidvania style game.  OSW is primarily focused on solving MK's challenges with character animations

 ## Goals
 **Primary Goal:** To use this tool to create a visually beautiful and interesting game

 **Secondary Goals:**
    - To improve drawing skills
    - To learn more about world building and character development for games

## Completed Work
  - Created individual, standalone tools
  - Discussed and planned migration / combination with Claude
  - Step 1: Tauri 2 shell with PrettyKit chrome, icon tool buttons in the title bar, draw tool + Rig Lab loaded, draw tool footer shown in the status bar
  - Step 2: library plumbing (Rust file commands, manifest.json, bridge between shell and tools, Library panel)

 ## Todo Items

  - [x] Scaffold the Tauri 2 shell in OnionStudioWizard (static frontend, no bundler), with the rail, the PrettyKit chrome, and the draw tool and Rig Lab loaded as-is.
 - [x] Library plumbing: the project folder setting, manifest.json, and save/list/load messages between the shell and tools. (JS side + Rust unit-tested; Tauri commands still need a first `npm run dev` check on the Dell)
 - [ ] Drawing tool: export to library plus the parts menu.
 - [ ] Character Builder with the turnaround.
 - [ ] Part import into Rig Lab, with pivot sidecars.
 - [ ] Remaining tools, then PLAY’s rewrite.



  ## Folder Structure
  *(Leave blank — generate this section using TreeME)*

 ## Notes

### Where things live
- **New app repo:** `mkb0020/OnionStudioWizard` (empty when this brief was written).
- **Source tools / R&D sandbox:** `mkb0020/kinematics` (public; local path `C:\Users\mkb00\PROJECTS\GitRepos\kinematics`). It has its own `CLAUDE.md` with per-tool detail. Trust the code over that doc where they disagree.
- **Tools being combined** (each is a standalone single-file HTML with inline CSS + JS, no build step):
  - `drawingTool.html` ("OSP - DRAW", ~3.6k lines): onion-skin drawing tool. Layers, frames, `.dtproj` project format (a zip containing `project.json`), saves through the File System Access API, localStorage keys prefixed `dt*`. Most actively developed.
  - `animatedRig.html` ("Rig Lab" / RIG//LAB): side-view run/walk rig with body-part art over a skeleton, editable pivots, config in `json_files/*.json`. Active.
  - `staticRig.html` ("ANIMATION RIG"): older posable rig. Has stale asset paths (`images/rig/...`). **Lowest priority.**
  - `capeLab.html` ("CAPE LAB // BLOB"): cape/cloak physics experiments.
  - `vectors.html` ("Vector Spell Lab"): procedural spell VFX. `shadowBlur`, radial gradients and additive draws are the perf hot spots.
  - `tilemapTest.html` ("TILE//LAB"): tileset auto-tiling tester.
  - `index.html` ("Sprite Test Playground", Kaplay): becomes **PLAY** (see decisions).
- **Shell chrome:** `kinematics/prettyKit/window.js` + `window.css`, a Tauri 2 window framework. Needs `withGlobalTauri: true` in `tauri.conf.json` and commands registered in `lib.rs`.

### Decisions made
- **Stack:** Tauri 2 + vanilla JS, static frontend, no bundler, no React.
- **Existing tools load in iframes inside the shell**, unchanged at first. This avoids global-scope collisions (the tools use lots of top-level `const`/`let` and full-viewport CSS) and hidden iframes pause their animation loops. Convert a tool to a real module only if integration needs it.
- **New tools** (Character Builder, Library UI) are native modules in the shell.
- Tools talk to the shell with `postMessage`; the shell does file operations through Tauri's fs plugin. Keep every tool runnable standalone in a browser (`IS_TAURI()` check, as PrettyKit does).
- **UI:** left rail grouped DRAW / RIG / FX / WORLD / PLAY. Tool state persists when switching; lazy-load tools on first open. Optional Ctrl+K palette, pop-out to a second window, and a "Send to ▸" menu.
- **Keyboard:** keep shortcuts minimal. The draw tool only needs Ctrl+Z/C/V. PLAY needs movement and attack keys, so the shell must not intercept keys. Static Rig's one shortcut becomes a toggle.
- **Platform:** Windows (Dell) only, WebView2, personal use, never shipped. No cross-platform concerns.
- **PLAY stays**, used to test sprite sheets for new animations and fine-tune character physics. Migrate it from Kaplay to plain JS when we reach it. Kaplay is CDN-pinned (`3001.0.19`) until then.
- Image folder will be rearranged into a `public/` folder for Tauri. Update relative paths (`assets/images/...`) during that move.

### Library design (shared assets)
- Plain folder **inside the OnionStudioWizard repo** (git-tracked), read and written through the fs plugin. `public/` can't be listed or written at runtime, so don't use it for the library. Project folder location is a remembered setting.
- Proposed layout:
  ```
  library/
    manifest.json      # id, type (part | accessory | view), name, tags, file
    parts/head_01.png
    accessories/hood.png
    characters/<name>/character.json
    characters/<name>/views/front.png ...
  ```
- This replaces the idea of a Python local server: Tauri covers loading the PNGs, and the manifest/fs plugin covers listing them.
- Parts and accessories are saved already correctly scaled so they never need redrawing. Rig art is on an 800x800 canvas, so scale conventions need to be written down.
- Do not rely on localStorage for real work (webview data can be wiped). Use it for UI prefs and cache only.

### Import flows
1. **Draw → library / character:** "Export to…" in the drawing tool picks a type (view, part, accessory) and name, then saves a PNG plus a manifest entry.
2. **Library → fresh drawing:** parts/accessories menu in the drawing tool adds an item as a new layer. The tool's existing image-import path can be reused with the library as a new source.
3. **Library → rigs:** body parts feed Rig Lab. Rig Lab needs pivots per part (hip, knee, ankle, shoulder, elbow, wrist, etc.), so each part gets a small pivot sidecar written by the existing pivot editor.

### Character Builder (new tool)
- A character sheet in the style of a D&D sheet: notes on personality and skills, images, and a physics panel.
- Physics panel maps to PLAY's tunables (`MOVE_SPEED`, `JUMP_FORCE`, wall-slide values, etc.), which currently live as top-of-file consts in `index.html`. Store them in `character.json` and have PLAY read from it.
- **8-view turnaround mannequin**, in this order: left → left-front → front → right-front → right → right-back → back → left-back. Scrub by drag, plus an auto-spin button, to check a full rotation.
- Idea: optional per-view **mirror** toggle so only 5 unique views need drawing (side, 3/4 front, front, 3/4 back, back). Must be optional because the cape/accessories may make the character asymmetric.
- Views and body parts come in from the drawing tool via the library.

### Step 2 as built (library plumbing)
- **Where the library is:** `<repo>/library` by default (the Rust side bakes in `src-tauri/..` + `library` at compile time, so it sits inside the git repo with zero setup when running `tauri dev` on this machine). It can be pointed elsewhere from the Library panel (type or paste a full path; "Copy as path" quotes are stripped); that choice is saved in the app config folder as `settings.json`. DEFAULT resets it. The old folder is never touched when the root changes.
- **Rust (`src-tauri/src/`):** `library.rs` is pure std + serde (no Tauri types) and has 12 unit tests; `lib.rs` wraps it in six commands: `library_info`, `library_set_root`, `library_read`, `library_write`, `library_list`, `library_delete`. File data crosses the boundary as **base64 text** (fine for sprite PNGs; switch to raw IPC bodies only if size ever matters). No dialog/fs plugins, so no capability entries; there is no folder-browse button (type the path).
- **Path rules (enforced in Rust and JS):** library paths are relative, use `/`, and only `A-Z a-z 0-9 . _ -`. No `..`, no dot-leading or dot-trailing names, no Windows reserved names (CON, NUL, ...), no symlink escapes. `manifest.json` can never be deleted through the commands; writes go to `<name>.tmp` then rename. Files hand-dropped into the folder must follow the same naming (no spaces) or they are invisible to the panel.
- **Manifest v1** (`library/manifest.json`, pretty-printed and sorted so git diffs stay readable): `{ format: "osw-library", version: 1, items: [ { id, type, name, file, w, h, bytes, tags[], meta{}, created, updated, character?, view? } ] }`.
  - `type` is `part` (`parts/<id>.png`), `accessory` (`accessories/<id>.png`) or `view` (`characters/<character>/views/<view>.png`, id `<character>.<view>`, saving again overwrites that view).
  - `VIEW_NAMES` (exported from `src/js/library/library.js`) is the single source of truth for the 8-view turnaround order: left, left-front, front, right-front, right, right-back, back, left-back.
  - `meta` is free-form per item: the planned home for pivots and other sidecar data (decide the pivot format in step 5).
  - The manifest is re-read on every call (so `git pull` or hand edits are seen) and calls run one at a time. A manifest that fails to parse is **never overwritten**: calls fail with `MANIFEST_CORRUPT` and the panel shows a banner. Image is written before the manifest on save, manifest before the file on delete, so a crash leaves a harmless untracked file, never a dangling entry. The panel's ADD (adopt untracked PNGs) and FORGET (drop entries whose file is gone) buttons repair drift.
- **JS layout:** `src/js/library/storage.js` (Tauri adapter + in-memory adapter used in a plain browser and in tests), `library/library.js` (all manifest logic), `bridge.js` (shell side of the tool bridge), `oswClient.js` (classic script tools include; its header comment is the API reference), `libraryPanel.js` (drawer UI). In a plain browser the library lives in memory and the panel says so.
- **Tool bridge:** tools never touch files. They call `OSWClient.library.*` (`info`, `list`, `get`, `readImage` -> PNG Blob, `save({type, name, blob, ...})`, `update`, `remove`, `scan`) and can listen for `OSWClient.on('library.changed', fn)`. Messages are postMessage; the shell only answers its own tool iframes from the same origin. Changing the library folder is deliberately not available to tools. `oswClient.js` is already included in both tools; no tool UI uses it yet (that is step 3).
- **Tests:** `npm test` runs the 19 JS tests (`tests/library.test.mjs`); `cargo test` inside `src-tauri/` runs the 12 Rust tests. The Rust file logic and JS were tested here; the Tauri command glue in `lib.rs` could not be compiled in Claude's environment (no webkit/Windows target), so the first `npm run dev` is the real check. Paste any compile error back to Claude.
- **Config change worth knowing:** `tauri.conf.json` sets `"dragDropEnabled": false` on the window. On Windows the default (true) swallows HTML5 file drag-and-drop from Explorer, which would have broken the drawing tool's drop-to-import and the Library panel's drop zone.
- **Leftover from the user's own commit:** `@vitejs/plugin-react` is in `package.json` devDependencies. Nothing uses it (no bundler, no React here); safe to remove with `npm uninstall @vitejs/plugin-react`.

### Things to watch
- **CLAUDE.md vs code:** CLAUDE.md says Rig Lab loads a ten-frame `mannequin_side.png` sheet with an embedded base64 fallback, but the current `animatedRig.html` references `assets/images/body_parts.png` and `accessories.png` and no data URIs were found. Check how it actually loads art before designing the part import.
- Rig Lab's embedded fallbacks (`BONES_FALLBACK`, `gaitFallback()`) exist only because `fetch()` fails over `file://`. Once the app serves the files they can go (`CLAUDE.md` todo #6).
- Drawing tool and Static Rig load Google Fonts; bundle fonts locally. `assets/fonts/` has Orbitron, Science Gothic and PT Sans Narrow, but not Share Tech Mono.
- Drawing tool input is stylus/touch via pointer events (no pressure yet). Pressure support is planned later.
- Claude can write and review code but **cannot open a native Tauri window** in its environment. MK tests with `tauri dev` on the Dell.
- localStorage can mask changed defaults when testing (Static Rig uses `rigJointGaps2`; `CLAUDE.md` says Rig Lab saves pivots under `rigArtPivots_v1`, but that key wasn't found in the current code, so verify).

### Art direction and style
- Anime-influenced 2D, **not pixel art**. Final style, resolution and proportions are still undecided, so keep techniques resolution-tolerant.
- Palette source of truth: `assets/colorPalette/colors.json` and `colors.css`. UI default is sci-fi/cyberpunk: deep violet background (`#0c001f`), neon cyan/magenta/violet accents, glow.
- Engine for the real game is undecided (leaning Godot, never used it). Keep algorithms engine-agnostic: plain functions, data in JSON, math not tied to a library.

### Working conventions for Claude
- Read the target file before editing. Prefer minimal diffs scoped to the file in question; ask before large restructures.
- Match each file's local style: `index.html` comments are ALL CAPS by habit, and `animatedRig.html` is compact (many one-line functions), so don't reformat it.
- Data-driven where possible: tunables in top-of-file consts or JSON.
- Perf matters. Flag expensive operations (blur, `shadowBlur`, per-frame allocations, big offscreen canvases).

### Open questions
- Part naming/ID scheme and the pivot sidecar format.
- Whether library items need version history or just overwrite.
- How the character's physics settings map onto the PLAY rewrite.
- Final character proportions, sprite resolution and game engine.
