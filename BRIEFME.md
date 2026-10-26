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
  - Step 4: Character Builder tool (tabletop-style landscape sheet, turnaround, physics, items, spells, to-do), saved as `characters/<name>/character.json`
  - Step 3: drawing tool EXPORT menu has SAVE TO LIBRARY, new PARTS menu adds library items as layers, and one button slices `sideView.png` into the library
  - Step 5: Rig Lab ART menu imports a character's parts from the library; pivots are saved as sidecars in each part's `meta.pivots`

 ## Todo Items

  - [x] Scaffold the Tauri 2 shell in OnionStudioWizard (static frontend, no bundler), with the rail, the PrettyKit chrome, and the draw tool and Rig Lab loaded as-is.
 - [x] Library plumbing: the project folder setting, manifest.json, and save/list/load messages between the shell and tools. (JS side + Rust unit-tested; Tauri commands still need a first `npm run dev` check on the Dell)
 - [x] Drawing tool: export to library plus the parts menu. (tested in a headless browser against the in-memory library; needs a first look in the real app)
 - [x] Character Builder with the turnaround. (tested in a headless browser; needs a first look in the real app)
 - [x] Part import into Rig Lab, with pivot sidecars. (tested in a headless browser against the real library files in memory; needs a first look in the real app)
 - [ ] Remaining tools, then PLAY’s rewrite.



  ## Folder Structure


```
/OnionStudioWizard
  - library/
    - accessories/
      - nova_side_bag.png
    - characters/
      - nova/
        - views/
          - right.png
        - character.json
    - parts/
      - nova_side_calf.png
      - nova_side_chest.png
      - nova_side_far_hand.png
      - nova_side_head.png
      - nova_side_lower_arm.png
      - nova_side_near_hand.png
      - nova_side_pelvis.png
      - nova_side_shoe.png
      - nova_side_thigh.png
      - nova_side_upper_arm.png
    - manifest.json
  - src/
    - assets/
      - colorPalette/
        - colors.css
        - colors.json
      - css/
        - rigStyles.css
      - fonts/
        - LICENSE-Orbitron.txt
        - LICENSE-ShareTechMono.txt
        - Orbitron-Bold.ttf
        - Orbitron-Regular.ttf
        - PTSansNarrow-Regular.ttf
        - ScienceGothic.ttf
        - orbitron-latin-400-normal.woff2
        - orbitron-latin-500-normal.woff2
        - orbitron-latin-600-normal.woff2
        - orbitron-latin-700-normal.woff2
        - share-tech-mono-latin-400-normal.woff2
      - images/
        - map/
          - basic_tileset.png
          - column.png
          - crystal1.png
          - crystal2.png
          - crystal3.png
          - flame.png
          - flameOrange.png
          - pillars.png
          - tiles.png
          - tiles2.png
          - tileset_test.png
          - torch.png
        - misc/
          - blob.png
          - catWizard.png
          - icon.png
          - orb.png
          - symbol.png
          - weapon1.png
          - weapon2.png
        - nova/
          - mannequins/
            - accessories.png
            - bag.png
            - sideView.png
          - sprites/
            - airKick.png
            - attack.png
            - cloakBottom.png
            - cloakTop.png
            - idle.png
            - jump.png
            - kick.png
            - run.png
            - spellCast.png
            - wall_slide.png
          - Nova.png
          - Nova2.png
        - vfx/
          - beam.png
          - puff.png
          - spawn.png
          - spell.png
          - swoosh.png
          - vfx00.png
    - css/
      - fonts.css
      - prettyKit.css
      - shell.css
    - js/
      - library/
        - library.js
        - storage.js
      - prettyKit/
        - window.js
      - bridge.js
      - libraryPanel.js
      - oswClient.js
      - package.json
      - shell.js
      - statusMirror.js
      - tools.js
    - json_files/
      - bone_lengths.json
      - gait_angles.json
      - rig_config.json
    - tools/
      - animatedRig.html
      - characterBuilder.html
      - drawingTool.html
    - index.html
  - src-tauri/
    - capabilities/
      - default.json
    - gen/
      - schemas/
        - acl-manifests.json
        - capabilities.json
        - desktop-schema.json
        - windows-schema.json
    - icons/
      - 128x128.png
      - 128x128@2x.png
      - 32x32.png
      - icon.ico
      - icon.png
    - src/
      - lib.rs
      - library.rs
      - main.rs
    - Cargo.lock
    - Cargo.toml
    - build.rs
    - tauri.conf.json
  - tests/
    - library.test.mjs
  - BRIEFME.md
  - README.md
  - package-lock.json
  - package.json
```


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

### Step 3 as built (drawing tool <-> library)
- **Save to library** (bottom of the EXPORT menu): TYPE (part / accessory / character view), FROM (active layer or all visible layers), NAME, SLOT (the Rig Lab part name, saved as `meta.slot`), CHAR (character, remembered), SIZE (default 800), CROP. The draw canvas is 1000x1000 but the rig art frame is 800x800, so library art is saved at SIZE=800 and never needs rescaling later. Same name = same id = overwrite. Views save uncropped as `<character>.<view>` and always overwrite that view.
- **Meta convention for parts/accessories:** `meta.canvas = [W,H]` (canvas the art was drawn on), `meta.origin = [x,y]` (where the cropped PNG sits inside it), plus `slot`, `character`, and for sheet imports `view: 'side'`, `source`, `frame`. Pivots measured in the 800x800 frame stay valid because origin is stored. Pivot sidecars (step 5) will go in `meta` too.
- **PARTS menu** (header, next to LAYER): thumbnail grid with a type filter and a name/tag filter; clicking an item adds it as a new layer. Items with `canvas`+`origin` land exactly where they were drawn (scaled by project width / canvas width, 1.25x for 800 -> 1000); anything else is fitted and the Move tool is selected.
- **SLICE INTO LIBRARY** (bottom of the PARTS menu): cuts `assets/images/nova/mannequins/sideView.png` (12 frames) into `<char>_side_head`, `_chest`, `_pelvis`, `_upper_arm`, `_lower_arm`, `_near_hand`, `_far_hand`, `_thigh`, `_calf`, `_shoe`, the accessory `<char>_side_bag`, and the view `<char>.right` (the mannequin faces right). Slots use the rig's names (head, chest, pelvis, upperArm, forearm, handR, handL, thigh, calf, shoe; the bag's slot is `bag`). Running it again overwrites those items.
- Both menus show a note instead when the tool is opened on its own (no library outside the Wizard). Code lives in `drawingTool.html` in the block headed "OSW LIBRARY".
- **Also fixed:** `shell.js` pointed the window icon at the old `assets/images/icon.png`; it is now `assets/images/misc/icon.png`.

### Step 4 as built (Character Builder)
- **File:** `src/tools/characterBuilder.html`, registered in `tools.js` (CHAR group, user icon). It loads in an iframe like the other tools and talks to the library through `OSWClient` (this deviates from the earlier "native module" idea; same plumbing, keeps it runnable on its own).
- **Layout:** landscape sheet. Left: name plaque (character picker, name, title), Origin (class, race, alignment, level, role, hometown, personality notes), Physics. Centre: the turnaround in an arched portal with a rune ring, turn buttons, auto-spin, speed, Mirror and Skip-empty toggles, and 8 view pips. Right: Spells table and Weapons & items. The "To draw" checklist (pose / move / cycle, filters, progress bar) is a drawer that slides in over everything from a tab on the right edge; its open/closed state is remembered. The page never scrolls: the panels are sized to fit (checked at 1900x950 and 1440x800).
- **Style:** Orbitron headers, Share Tech Mono body, dark violet with neon edges. Edge gradient and accents come from Nova's art: cloak blue `#0303ff`, scarf `#4b69f3`, cloak fade `#9933c3`, ear pink `#db4be7`, eyes `#03ffff`, thigh lavender `#a599f3`/`#c3c3f3`, bodysuit `#390363`, leggings `#2d1b57`, boots `#454b8d`/`#212751`.
- **Turnaround:** views come from the library (`type: view`, this character). Order is left, left-front, front, right-front, right, right-back, back, left-back. With Mirror on, an undrawn left/right side is filled by flipping its opposite (front and back are never mirrored). Drag the figure, use the arrow keys, or Space to spin. Auto-spin skips undrawn views when Skip empty is on. Views are saved from the draw tool: Export > Save to library > Character view.
- **Saving:** `library/characters/<character>/character.json`, autosaved 0.6 s after any edit (chip in the plaque shows SAVED / UNSAVED / NOT SAVED). Shape: `{ format: 'osw-character', version: 1, id, info{name,title,class,race,alignment,level,role,origin,notes}, physics[{label,value,unit}], items[{name,kind,note,equipped}], spells[{name,vfx:'sprite'|'vector',frames,key}], todo[{text,kind,done}], view{mirror,skipEmpty,speed}, updated }`. Outside the Wizard it falls back to localStorage.
- **Library API additions:** `library.listCharacters()`, `readCharacter(slug)`, `saveCharacter(slug, obj)` (JSON object, max 1 MB, not in the manifest); `OSWClient.library.character.list/get/save`; bridge messages `library.character.*`; 1 new JS test (20 pass).
- **Physics numbers are starter placeholders** (move speed 240, jump force 620, gravity 1600, ...). Match them to PLAY's constants when PLAY is rewritten; rows can be renamed, added and removed.

### Step 5 as built (library parts -> Rig Lab, pivot sidecars)
- **ART menu** (Rig Lab top bar, only inside the Wizard): `Art: sheet (sideView.png)` or `Art: library · <character> (n/10)`. Characters are found from library parts with `meta.view === 'side'`, `meta.character` and a `meta.slot` that is one of the ten rig part names (head, chest, pelvis, upperArm, forearm, handR, handL, thigh, calf, shoe). The choice is remembered (`rigArtSrc_v1` in localStorage, UI pref only). Outside the Wizard nothing changes: sheet art, menu hidden.
- **Drawing:** a library PNG is a tight crop on the 800x800 canvas, drawn at `meta.origin`, so every pivot stays valid. A slot missing from the library keeps its sheet art (shown in the HUD label). A part saved with a canvas other than 800x800 is skipped with a note. Pixel check: Nova from the library renders identically to the sheet.
- **Pivot sidecar format:** `meta.pivots = { pivotName: [x, y] }` in 800x800 art px (same space as `ART_PIV`), in the part's manifest entry. Each pivot has ONE owner part so parts never disagree (`PIV_OWNER` in `animatedRig.html`): pelvis = hip, bagHip, stomachFrom; chest = rib, shoulder, neck, neckFrom, strapTop, stomachTo; head = headPivot, neckTo; upperArm = elbow; forearm = wrist; thigh = knee; calf = ankle. Hands and shoe own none. Rule: a part owns the joint at its far end plus attachment points drawn on it.
- **Load order:** file defaults (`rig_config.json`), then sidecars override. **Saving:** with library art selected, pivot edits save to the sidecars 0.8 s after the last change (status chip next to the ART menu; "Save pivots to library" button in Pivots forces it); localStorage pivots are used for sheet art only. `update` replaces `meta` wholesale, so the save merges with the existing meta (slot, origin, ...). "Reset to file values" in library mode writes the defaults into the sidecars.
- **Live refresh:** if another tool saves or re-slices this character's parts, Rig Lab reloads them (own saves are ignored). Re-running SLICE INTO LIBRARY keeps pivots only if the sidecars survive: `save` with an existing id keeps old meta only when no new meta is passed, and the slicer passes new meta, so **re-slicing wipes the sidecars**. Save pivots again afterwards (or fix the slicer to carry `meta.pivots` over).
- **Not done yet:** the bag (`nova_side_bag`) still loads from `accessories.png`, the pivot-editor ghost is still frame 0 of the sheet, the stale-prone Rig Lab fallbacks are untouched, and importing a `rig_config.json` while library art is on is not written to the sidecars.

### Things to watch
- **Art sheet (updated Oct 25 2026):** Rig Lab loads `assets/images/nova/mannequins/sideView.png`, a 9600x800 sheet of twelve 800x800 frames: 0 full mannequin (used as the pivot-editor ghost), 1 bag, 2 head, 3 chest, 4 pelvis, 5 upperArm, 6 lowerArm, 7 near hand, 8 far hand, 9 thigh, 10 calf, 11 shoe. `ART_FRAME` in `animatedRig.html` maps part names to frames; `ART_BOX` holds the crops. Accessories load from `assets/images/nova/mannequins/accessories.png`. CLAUDE.md's description of a ten-frame `mannequin_side.png` with a base64 fallback is stale.
- **Proportions redrawn Oct 25 2026:** pivots, bone lengths and boot-foot values in `animatedRig.html` (`ART_PIV`, `FOOT_PRESET`), `json_files/rig_config.json` and `json_files/bone_lengths.json` were re-measured from the new sideView sheet. Wrist, rib, neck, stomach, bag and strap pivots are estimates to fine-tune in the Rig Lab pivot editor. Gait sliders, stride and `shared.feet` footLen/heelFrac were tuned on the old proportions and need a re-tune. Frame 1 (bag) is not used by the rig yet.
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
