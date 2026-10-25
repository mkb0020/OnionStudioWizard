// ONION STUDIO WIZARD - LIBRARY STORAGE ADAPTERS
// THE LIBRARY LOGIC (library.js) ONLY EVER TALKS TO THIS SMALL INTERFACE:
//   kind                      'disk' (TAURI, REAL FILES) OR 'memory' (BROWSER TESTING, LOST ON RELOAD)
//   info()                    -> { root, isDefault, defaultRoot }
//   setRoot(path | null)      -> info        (null = BACK TO THE DEFAULT)
//   read(path)                -> Uint8Array | null      (null = FILE DOES NOT EXIST)
//   write(path, Uint8Array)   -> void
//   list(dir, recursive)      -> [{ path, size, modified, isDir }]
//   remove(path)              -> void        (ALREADY-GONE IS FINE)
// PATHS ARE RELATIVE TO THE LIBRARY ROOT, USE "/" AND ONLY A-Z a-z 0-9 . _ - (THE RUST SIDE ENFORCES THIS TOO).

// ---------- BASE64 (THE TAURI COMMANDS MOVE FILE DATA AS BASE64 TEXT) ----------

export function bytesToB64(u8) {
  let s = '';
  const CH = 0x8000;                                   // CHUNKED SO BIG PNGs DO NOT BLOW THE ARGUMENT LIMIT
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- TAURI (REAL FILES THROUGH THE RUST COMMANDS IN src-tauri/src/lib.rs) ----------

export function createTauriStorage(invoke) {
  const fail = (e) => { throw new Error(typeof e === 'string' ? e : (e && e.message) || String(e)); };
  const call = (cmd, args) => invoke(cmd, args).catch(fail);
  return {
    kind: 'disk',
    info: () => call('library_info'),
    setRoot: (path) => call('library_set_root', { path: path || null }),
    async read(path) {
      try { return b64ToBytes(await invoke('library_read', { path })); }
      catch (e) {
        const msg = typeof e === 'string' ? e : (e && e.message) || '';
        if (msg.startsWith('NOT_FOUND')) return null;
        throw new Error(msg || String(e));
      }
    },
    write: (path, bytes) => call('library_write', { path, data: bytesToB64(bytes) }),
    list: (dir, recursive) => call('library_list', { dir: dir || '', recursive: !!recursive }),
    remove: (path) => call('library_delete', { path }),
  };
}

// ---------- MEMORY (FOR RUNNING THE SHELL IN A PLAIN BROWSER, AND FOR TESTS) ----------

export function createMemoryStorage() {
  const files = new Map();   // path -> { bytes, modified }
  const dirsOf = (p) => { const parts = p.split('/'); parts.pop(); const out = []; for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join('/')); return out; };
  return {
    kind: 'memory',
    files,                   // EXPOSED SO TESTS CAN PLANT OR INSPECT FILES DIRECTLY
    async info() { return { root: '(browser memory - nothing here is saved)', isDefault: true, defaultRoot: '' }; },
    async setRoot() { throw new Error('BAD_ROOT: the folder can only be changed in the desktop app'); },
    async read(path) { const f = files.get(path); return f ? f.bytes.slice() : null; },
    async write(path, bytes) { files.set(path, { bytes: bytes.slice(), modified: Date.now() }); },
    async remove(path) { files.delete(path); },
    async list(dir, recursive) {
      const prefix = dir ? dir.replace(/\/$/, '') + '/' : '';
      const out = new Map();
      for (const [p, f] of files) {
        if (!p.startsWith(prefix)) continue;
        const rest = p.slice(prefix.length).split('/');
        const upto = recursive ? rest.length : 1;
        for (let i = 1; i <= upto; i++) {
          const rel = prefix + rest.slice(0, i).join('/');
          const isDir = i < rest.length;
          if (!out.has(rel)) out.set(rel, { path: rel, size: isDir ? 0 : f.bytes.length, modified: f.modified, isDir });
        }
      }
      return [...out.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    },
  };
}

// TAURI WHEN RUNNING IN THE DESKTOP APP (withGlobalTauri PUTS invoke ON window.__TAURI__.core), MEMORY OTHERWISE
export function createStorage() {
  const invoke = typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
  return invoke ? createTauriStorage(invoke) : createMemoryStorage();
}
