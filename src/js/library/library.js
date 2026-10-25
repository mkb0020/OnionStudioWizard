// ONION STUDIO WIZARD - LIBRARY
// A FOLDER OF PNGs + ONE manifest.json THAT DESCRIBES THEM. PARTS, ACCESSORIES AND CHARACTER VIEWS LIVE HERE SO
// THE TOOLS CAN HAND ART TO EACH OTHER. THE FOLDER IS PLAIN FILES INSIDE THE GIT REPO, SO IT DIFFS AND SYNCS.
//
//   library/
//     manifest.json                                  { format, version, items[] }
//     parts/<id>.png
//     accessories/<id>.png
//     characters/<character>/views/<view>.png        <view> IS ONE OF VIEW_NAMES
//
// THE MANIFEST IS RE-READ FROM DISK ON EVERY CALL (SO A git pull OR A HAND EDIT IS ALWAYS SEEN), AND EVERY CALL
// RUNS ONE AT A TIME (SO TWO TOOLS SAVING AT ONCE CANNOT CLOBBER EACH OTHER'S MANIFEST WRITES).
// A MANIFEST THAT CANNOT BE PARSED IS NEVER OVERWRITTEN: THE CALL FAILS WITH MANIFEST_CORRUPT INSTEAD.

export const FORMAT = 'osw-library';
export const VERSION = 1;
export const MANIFEST_PATH = 'manifest.json';
export const TYPES = ['part', 'accessory', 'view'];
// TURNAROUND ORDER FOR THE CHARACTER BUILDER: facing left -> ... -> left-back (SEE BRIEFME.md)
export const VIEW_NAMES = ['left', 'left-front', 'front', 'right-front', 'right', 'right-back', 'back', 'left-back'];

const DIR = { part: 'parts', accessory: 'accessories', view: 'characters' };
const MAX_BYTES = 50 * 1024 * 1024;
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

// ---------- SMALL PURE HELPERS (EXPORTED FOR TESTS) ----------

export function slugify(name) {
  const s = String(name == null ? '' : name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40).replace(/_+$/g, '');
  return s || 'item';
}

export function uniqueId(base, taken) {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = base.slice(0, 36) + '_' + n;
    if (!taken.has(id)) return id;
  }
}

// WIDTH/HEIGHT FROM THE PNG HEADER WITHOUT DECODING THE IMAGE
export function readPngSize(u8) {
  if (!(u8 instanceof Uint8Array) || u8.length < 24) throw new Error('NOT_PNG: file is too small');
  for (let i = 0; i < 8; i++) if (u8[i] !== PNG_SIG[i]) throw new Error('NOT_PNG: not a PNG file');
  if (String.fromCharCode(u8[12], u8[13], u8[14], u8[15]) !== 'IHDR') throw new Error('NOT_PNG: missing header');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const w = dv.getUint32(16), h = dv.getUint32(20);
  if (!w || !h) throw new Error('NOT_PNG: zero-size image');
  return { w, h };
}

function filePathFor(type, id, character, view) {
  if (type === 'view') return `characters/${character}/views/${view}.png`;
  return `${DIR[type]}/${id}.png`;
}

function sortItems(items) {
  const rank = (t) => TYPES.indexOf(t);
  items.sort((a, b) => rank(a.type) - rank(b.type) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ---------- THE LIBRARY ----------

export function createLibrary(storage) {
  const listeners = new Set();
  let chain = Promise.resolve();

  // ONE CALL AT A TIME, IN ORDER; A FAILED CALL DOES NOT BLOCK THE NEXT ONE
  const serial = (fn) => { const run = chain.then(fn); chain = run.catch(() => {}); return run; };
  const emit = (change) => listeners.forEach((fn) => { try { fn(change); } catch (e) { /* A BAD LISTENER MUST NOT BREAK A SAVE */ } });

  async function load() {
    const raw = await storage.read(MANIFEST_PATH);
    if (!raw) return { format: FORMAT, version: VERSION, items: [] };
    let m;
    try { m = JSON.parse(new TextDecoder().decode(raw)); }
    catch (e) { throw new Error('MANIFEST_CORRUPT: manifest.json is not valid JSON (' + e.message + '). Fix or delete it by hand; nothing was changed.'); }
    if (!m || m.format !== FORMAT || !Array.isArray(m.items)) throw new Error('MANIFEST_CORRUPT: manifest.json is not an Onion Studio Wizard library manifest. Nothing was changed.');
    if (m.version > VERSION) throw new Error('MANIFEST_NEWER: manifest.json was written by a newer version of the app. Nothing was changed.');
    return m;
  }

  async function store(m) {
    sortItems(m.items);
    await storage.write(MANIFEST_PATH, new TextEncoder().encode(JSON.stringify(m, null, 2) + '\n'));
  }

  const findIndex = (m, id) => m.items.findIndex((it) => it.id === id);
  const need = (m, id) => { const i = findIndex(m, id); if (i < 0) throw new Error('NOT_FOUND: no library item "' + id + '"'); return i; };

  return {
    kind: storage.kind,

    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    info() {
      return serial(async () => {
        const info = await storage.info();
        let itemCount = 0, error = null;
        try { itemCount = (await load()).items.length; } catch (e) { error = e.message; }
        return { ...info, kind: storage.kind, itemCount, error };
      });
    },

    // REPLACES THE LIBRARY FOLDER (path = null -> DEFAULT). THE OLD FOLDER IS LEFT UNTOUCHED.
    setRoot(path) {
      return serial(async () => { const info = await storage.setRoot(path); emit({ kind: 'root' }); return info; });
    },

    list({ type, character } = {}) {
      return serial(async () => {
        let items = (await load()).items;
        if (type) items = items.filter((it) => it.type === type);
        if (character) items = items.filter((it) => it.character === character);
        return items;
      });
    },

    get(id) {
      return serial(async () => { const m = await load(); return m.items[need(m, id)]; });
    },

    // PNG BYTES OF AN ITEM
    readImage(id) {
      return serial(async () => {
        const m = await load();
        const it = m.items[need(m, id)];
        const bytes = await storage.read(it.file);
        if (!bytes) throw new Error('NOT_FOUND: the image file for "' + id + '" is missing (' + it.file + ')');
        return bytes;
      });
    },

    // ADD OR OVERWRITE. type 'view' NEEDS character (A SLUG) + view (ONE OF VIEW_NAMES) AND ALWAYS OVERWRITES THAT VIEW.
    // FOR part/accessory, GIVE id TO OVERWRITE AN EXISTING ITEM, OTHERWISE A NEW UNIQUE id IS MADE FROM name.
    save({ type, name, bytes, id, character, view, tags, meta }) {
      return serial(async () => {
        if (!TYPES.includes(type)) throw new Error('BAD_TYPE: type must be one of ' + TYPES.join(', '));
        if (!(bytes instanceof Uint8Array)) throw new Error('BAD_DATA: bytes must be a Uint8Array');
        if (bytes.length > MAX_BYTES) throw new Error('BAD_DATA: file is larger than 50 MB');
        const { w, h } = readPngSize(bytes);

        const m = await load();
        const now = new Date().toISOString();
        let itemId, file, extra = {};
        if (type === 'view') {
          if (!SLUG_RE.test(character || '')) throw new Error('BAD_CHARACTER: character must be lowercase letters, numbers, _ or - (max 40)');
          if (!VIEW_NAMES.includes(view)) throw new Error('BAD_VIEW: view must be one of ' + VIEW_NAMES.join(', '));
          itemId = character + '.' + view;
          file = filePathFor('view', null, character, view);
          extra = { character, view };
        } else if (id) {
          if (!SLUG_RE.test(id)) throw new Error('BAD_ID: ids use lowercase letters, numbers, _ or -');
          const i = findIndex(m, id);
          if (i >= 0 && m.items[i].type !== type) throw new Error('BAD_TYPE: "' + id + '" already exists as a ' + m.items[i].type);
          itemId = id;
          file = filePathFor(type, id);
        } else {
          itemId = uniqueId(slugify(name), new Set(m.items.map((it) => it.id)));
          file = filePathFor(type, itemId);
        }

        const i = findIndex(m, itemId);
        const prev = i >= 0 ? m.items[i] : null;
        if (prev) file = prev.file;            // OVERWRITE IN PLACE (AN ADOPTED FILE MAY NOT BE NAMED AFTER ITS id)

        await storage.write(file, bytes);      // IMAGE FIRST: A CRASH LEAVES A HARMLESS UNTRACKED FILE, NEVER A DANGLING ENTRY

        const item = {
          id: itemId, type, name: String(name || (prev && prev.name) || itemId).slice(0, 80), file, w, h, bytes: bytes.length,
          tags: Array.isArray(tags) ? tags.map(String) : (prev ? prev.tags : []),
          meta: meta && typeof meta === 'object' ? meta : (prev ? prev.meta : {}),
          created: prev ? prev.created : now, updated: now, ...extra,
        };
        if (i >= 0) m.items[i] = item; else m.items.push(item);
        await store(m);
        emit({ kind: i >= 0 ? 'updated' : 'added', id: itemId });
        return item;
      });
    },

    // CHANGE name / tags / meta ONLY (THE IMAGE IS CHANGED WITH save + id)
    update(id, patch = {}) {
      return serial(async () => {
        const m = await load();
        const it = m.items[need(m, id)];
        if (patch.name != null) it.name = String(patch.name).slice(0, 80);
        if (Array.isArray(patch.tags)) it.tags = patch.tags.map(String);
        if (patch.meta && typeof patch.meta === 'object') it.meta = patch.meta;
        it.updated = new Date().toISOString();
        await store(m);
        emit({ kind: 'updated', id });
        return it;
      });
    },

    remove(id) {
      return serial(async () => {
        const m = await load();
        const i = need(m, id);
        const [it] = m.items.splice(i, 1);
        await store(m);                        // MANIFEST FIRST: A CRASH LEAVES AN UNTRACKED FILE, NEVER A DANGLING ENTRY
        await storage.remove(it.file);
        emit({ kind: 'removed', id });
        return { id };
      });
    },

    // COMPARE THE MANIFEST WITH WHAT IS ACTUALLY ON DISK
    scan() {
      return serial(async () => {
        const m = await load();
        const listed = new Set();
        for (const d of Object.values(DIR)) for (const e of await storage.list(d, true)) if (!e.isDir) listed.add(e.path);
        const known = new Set(m.items.map((it) => it.file));
        const missing = m.items.filter((it) => !listed.has(it.file)).map((it) => it.id);
        const untracked = [...listed].filter((p) => !known.has(p) && /\.png$/.test(p)).map((p) => untrackedInfo(p)).filter(Boolean);
        return { missing, untracked };
      });
    },

    // TURN UNTRACKED PNGs (DROPPED INTO THE FOLDER BY HAND, OR LEFT BY A CRASH) INTO ITEMS
    adopt() {
      return serial(async () => {
        const m = await load();
        const known = new Set(m.items.map((it) => it.file));
        const taken = new Set(m.items.map((it) => it.id));
        const added = [], skipped = [];
        const now = new Date().toISOString();
        for (const d of Object.values(DIR)) {
          for (const e of await storage.list(d, true)) {
            if (e.isDir || known.has(e.path) || !/\.png$/.test(e.path)) continue;
            const u = untrackedInfo(e.path);
            if (!u) { skipped.push({ file: e.path, why: 'not a part, accessory or known view name' }); continue; }
            let size;
            try { size = readPngSize(await storage.read(e.path)); } catch (err) { skipped.push({ file: e.path, why: err.message }); continue; }
            const id = u.type === 'view' ? u.character + '.' + u.view : uniqueId(slugify(u.name), taken);
            if (taken.has(id)) { skipped.push({ file: e.path, why: 'an item with id "' + id + '" already exists' }); continue; }
            taken.add(id);
            const item = { id, type: u.type, name: u.name, file: e.path, ...size, bytes: e.size, tags: [], meta: {}, created: now, updated: now };
            if (u.type === 'view') { item.character = u.character; item.view = u.view; }
            m.items.push(item);
            added.push(item);
          }
        }
        if (added.length) { await store(m); emit({ kind: 'adopted' }); }
        return { added, skipped };
      });
    },

    // FORGET ENTRIES WHOSE IMAGE FILE IS GONE
    dropMissing() {
      return serial(async () => {
        const m = await load();
        const keep = [], dropped = [];
        for (const it of m.items) ((await storage.read(it.file)) ? keep : dropped).push(it);
        if (dropped.length) { m.items = keep; await store(m); emit({ kind: 'removed' }); }
        return { dropped: dropped.map((it) => it.id) };
      });
    },
  };
}

// WHAT A PNG PATH MEANS, OR null IF IT IS NOT IN A PLACE THE LIBRARY KNOWS
function untrackedInfo(path) {
  let m;
  if ((m = /^(parts|accessories)\/([^/]+)\.png$/.exec(path))) {
    return { file: path, type: m[1] === 'parts' ? 'part' : 'accessory', name: m[2] };
  }
  if ((m = /^characters\/([^/]+)\/views\/([^/]+)\.png$/.exec(path)) && SLUG_RE.test(m[1]) && VIEW_NAMES.includes(m[2])) {
    return { file: path, type: 'view', name: m[1] + ' ' + m[2], character: m[1], view: m[2] };
  }
  return null;
}
