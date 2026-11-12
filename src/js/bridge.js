// ONION STUDIO WIZARD - SHELL SIDE OF THE TOOL BRIDGE
// TOOLS RUN IN IFRAMES AND TALK TO THE SHELL WITH postMessage (THE TOOL SIDE IS js/oswClient.js).
//   tool  -> shell   { osw:1, kind:'request',  id, type, args }
//   shell -> tool    { osw:1, kind:'response', id, ok, result | error }
//   shell -> tools   { osw:1, kind:'event',    name, payload }          (library.changed, export.changed)
// ONLY OUR OWN TOOL IFRAMES ARE ANSWERED, AND ONLY FROM THE SAME ORIGIN.
// IMAGES TRAVEL AS Blob (STRUCTURED CLONE), SO A TOOL NEVER HANDLES BASE64 OR FILE PATHS.

import { bytesToB64 } from './library/storage.js';

// EXPORTS: TOOLS HAND FINISHED FILES (SHEETS, TIMING JSON, ZIPS) TO THE SHELL, WHICH WRITES THEM WITH THE RUST export_* COMMANDS.
// THAT SKIPS BROWSER DOWNLOADS, SO WEBVIEW2'S "DOWNLOAD MULTIPLE FILES?" PROMPT CAN NEVER BLOCK AN EXPORT.
// OUTSIDE THE DESKTOP APP (PLAIN BROWSER TESTING) THESE ANSWER "NOT_DESKTOP" AND THE TOOL FALLS BACK TO A NORMAL DOWNLOAD.
function createExports(broadcastRef) {
  const invoke = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
  const need = () => { if (!invoke) throw new Error('NOT_DESKTOP: exports go through the desktop app'); };
  const changed = (info) => { broadcastRef.fn && broadcastRef.fn('export.changed', info); return info; };
  return {
    info: async () => { need(); return invoke('export_info'); },
    save: async (name, bytes) => { need(); return { path: await invoke('export_write', { name, data: bytesToB64(bytes) }) }; },
    openDir: async () => { need(); await invoke('export_open_dir'); },
    resetDir: async () => { need(); return changed(await invoke('export_set_dir', { path: null })); },
    chooseDir: async () => {
      need();
      const cur = await invoke('export_info');
      let picked;
      try {
        picked = await invoke('plugin:dialog|open', { options: { directory: true, multiple: false, title: 'Choose where exports are saved', defaultPath: cur.dir } });
      } catch (e) {   // NO FOLDER PICKER (PLUGIN MISSING / NOT ALLOWED): ASK FOR A PASTED PATH INSTEAD
        console.warn('[osw] folder picker unavailable, asking for a path', e);
        picked = window.prompt('Paste the full path of the folder exports should go to:', cur.dir);
      }
      if (Array.isArray(picked)) picked = picked[0];
      if (!picked) return { ...cur, cancelled: true };
      return changed(await invoke('export_set_dir', { path: String(picked) }));
    },
  };
}

export function createBridge({ library, frames }) {
  const broadcastRef = {};
  const exportsApi = createExports(broadcastRef);
  const origin = window.location.origin;
  const target = origin === 'null' ? '*' : origin;       // AN OPAQUE ORIGIN CANNOT BE NAMED AS A TARGET

  const post = (win, msg) => { try { win.postMessage(msg, target); } catch (e) { /* THE TOOL MAY HAVE BEEN CLOSED */ } };

  async function toBytes(v) {
    if (v instanceof Uint8Array) return v;
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
    if (v && typeof v.arrayBuffer === 'function') return new Uint8Array(await v.arrayBuffer());
    throw new Error('BAD_DATA: send the image as a Blob, ArrayBuffer or Uint8Array');
  }

  // WHAT A TOOL IS ALLOWED TO ASK FOR. (CHANGING THE LIBRARY FOLDER IS DONE ONLY FROM THE LIBRARY PANEL.)
  const handlers = {
    'library.info':      () => library.info(),
    'library.list':      (a) => library.list({ type: a.type, character: a.character }),
    'library.get':       (a) => library.get(a.id),
    'library.readImage': async (a) => new Blob([await library.readImage(a.id)], { type: 'image/png' }),
    'library.save':      async (a) => library.save({
      type: a.type, name: a.name, id: a.id, character: a.character, view: a.view, tags: a.tags, meta: a.meta,
      bytes: await toBytes(a.blob),
    }),
    'library.update':    (a) => library.update(a.id, a.patch || {}),
    'library.remove':    (a) => library.remove(a.id),
    'library.scan':      () => library.scan(),
    'library.character.list': () => library.listCharacters(),
    'library.character.get':  (a) => library.readCharacter(a.character),
    'library.character.save': (a) => library.saveCharacter(a.character, a.data),
    'library.map.list': () => library.listMaps(),
    'library.map.get':  (a) => library.readMap(a.map),
    'library.map.save': (a) => library.saveMap(a.map, a.data),
    'library.cape.list': () => library.listCapes(),
    'library.cape.get':  (a) => library.readCape(a.cape),
    'library.cape.save': (a) => library.saveCape(a.cape, a.data),
    'export.info':      () => exportsApi.info(),
    'export.save':      async (a) => exportsApi.save(a.name, await toBytes(a.blob)),
    'export.chooseDir': () => exportsApi.chooseDir(),
    'export.resetDir':  () => exportsApi.resetDir(),
    'export.openDir':   () => exportsApi.openDir(),
  };

  const isToolWindow = (src) => { for (const f of frames.values()) if (f.contentWindow === src) return true; return false; };

  window.addEventListener('message', async (e) => {
    const m = e.data;
    if (!m || m.osw !== 1 || m.kind !== 'request' || e.origin !== origin || !isToolWindow(e.source)) return;
    try {
      const h = handlers[m.type];
      if (!h) throw new Error('BAD_REQUEST: unknown request "' + m.type + '"');
      post(e.source, { osw: 1, kind: 'response', id: m.id, ok: true, result: await h(m.args || {}) });
    } catch (err) {
      post(e.source, { osw: 1, kind: 'response', id: m.id, ok: false, error: String((err && err.message) || err) });
    }
  });

  function broadcast(name, payload) {
    for (const f of frames.values()) if (f.contentWindow) post(f.contentWindow, { osw: 1, kind: 'event', name, payload });
  }

  broadcastRef.fn = broadcast;
  library.onChange((change) => broadcast('library.changed', change));

  return { broadcast };
}
