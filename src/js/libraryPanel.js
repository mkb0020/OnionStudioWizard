// ONION STUDIO WIZARD - LIBRARY PANEL
// A DRAWER OVER THE RIGHT SIDE OF THE STAGE: WHERE THE LIBRARY FOLDER IS (AND CHANGING IT), IMPORTING PNGs,
// BROWSING / RENAMING / DELETING ITEMS, AND FIXING UP FILES THAT DRIFTED OUT OF SYNC WITH manifest.json.
// ALL TEXT FROM FILES AND THE MANIFEST IS SHOWN WITH textContent / .value, NEVER innerHTML.

const FILTERS = [['all', 'ALL'], ['part', 'PARTS'], ['accessory', 'ACCESSORIES'], ['view', 'VIEWS']];
const clean = (e) => String((e && e.message) || e).replace(/^[A-Z_]+:\s*/, '');

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids) if (kid) el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  return el;
}

export function createLibraryPanel({ library, mount, button, notify }) {
  const el = h('aside', { id: 'lib-panel', 'aria-label': 'Library', hidden: '' });
  el.innerHTML = `
    <header class="lib-head">
      <h2>LIBRARY</h2><span class="lib-badge" id="lib-badge"></span>
      <button type="button" class="lib-x" data-act="refresh" title="Re-read the folder">&#8635;</button>
      <button type="button" class="lib-x" data-act="close" title="Close">&#10005;</button>
    </header>
    <div class="lib-error" id="lib-error" hidden></div>
    <section class="lib-sec">
      <div class="lib-label">FOLDER</div>
      <div class="lib-path" id="lib-path"></div>
      <div class="lib-row">
        <input type="text" id="lib-root" spellcheck="false" autocomplete="off" placeholder="C:\\Users\\you\\OnionStudioWizard\\library">
        <button type="button" class="lib-btn" data-act="setroot">USE</button>
        <button type="button" class="lib-btn" data-act="defaultroot" id="lib-default">DEFAULT</button>
      </div>
      <div class="lib-note" id="lib-note"></div>
    </section>
    <section class="lib-sec">
      <div class="lib-label">ADD PNGs</div>
      <div class="lib-row">
        <select id="lib-type"><option value="part">Part</option><option value="accessory">Accessory</option></select>
        <button type="button" class="lib-btn lib-btn--main" data-act="import">IMPORT PNG&hellip;</button>
        <input type="file" id="lib-file" accept="image/png" multiple hidden>
      </div>
      <div class="lib-drop" id="lib-drop">or drop PNG files here</div>
    </section>
    <nav class="lib-tabs" id="lib-tabs"></nav>
    <div class="lib-scan" id="lib-scan" hidden></div>
    <div class="lib-grid" id="lib-grid"></div>
    <footer class="lib-foot" id="lib-foot"></footer>`;
  mount.appendChild(el);
  const $ = (s) => el.querySelector(s);

  let filter = 'all';
  let info = null;
  let items = [];
  let scan = { missing: [], untracked: [] };
  let refreshing = false, again = false;
  const urls = new Map();                 // `${id}|${updated}` -> object URL of the thumbnail

  const say = (text, ms = 3500) => notify && notify(text, ms);
  const isOpen = () => !el.hidden;

  // ---------- OPEN / CLOSE ----------

  function open() { el.hidden = false; button.classList.add('is-active'); refresh(); }
  function close() { el.hidden = true; button.classList.remove('is-active'); }
  function toggle() { isOpen() ? close() : open(); }

  // ---------- REFRESH (COALESCED: MANY CHANGES IN A ROW = ONE REDRAW) ----------

  async function refresh() {
    if (!isOpen()) return;
    if (refreshing) { again = true; return; }
    refreshing = true;
    try {
      do {
        again = false;
        info = await library.info();
        if (info.error) { items = []; scan = { missing: [], untracked: [] }; }
        else { items = await library.list(); scan = await library.scan(); }
        render();
      } while (again && isOpen());
    } catch (e) {
      showError(clean(e));
    } finally { refreshing = false; }
  }

  function showError(text) {
    const box = $('#lib-error');
    box.hidden = !text;
    box.textContent = text || '';
  }

  // ---------- RENDER ----------

  function render() {
    showError(info.error ? info.error.replace(/^[A-Z_]+:\s*/, '') : '');
    const mem = info.kind === 'memory';
    $('#lib-badge').textContent = mem ? 'BROWSER MEMORY - NOT SAVED' : (info.isDefault ? 'REPO FOLDER' : 'CUSTOM FOLDER');
    $('#lib-badge').classList.toggle('warn', mem);
    $('#lib-path').textContent = info.root;
    $('#lib-path').title = info.root;
    $('#lib-root').disabled = mem;
    el.querySelector('[data-act=setroot]').disabled = mem;
    $('#lib-default').disabled = mem || info.isDefault;
    $('#lib-note').textContent = mem
      ? 'Running outside the desktop app, so nothing is written to disk. Use the app to keep files.'
      : 'Files you add by hand: use letters, numbers and . _ - in names (no spaces), then press ADD below when it shows up.';

    const counts = { all: items.length };
    for (const it of items) counts[it.type] = (counts[it.type] || 0) + 1;
    const tabs = $('#lib-tabs');
    tabs.textContent = '';
    for (const [key, label] of FILTERS) {
      tabs.appendChild(h('button', {
        type: 'button', class: 'lib-tab' + (key === filter ? ' is-on' : ''), text: label + ' ' + (counts[key] || 0),
        onclick: () => { filter = key; render(); },
      }));
    }

    const sc = $('#lib-scan');
    sc.textContent = '';
    sc.hidden = !(scan.untracked.length || scan.missing.length);
    if (scan.untracked.length) {
      sc.appendChild(h('div', { class: 'lib-scan-row' },
        h('span', { text: scan.untracked.length + ' PNG file' + (scan.untracked.length > 1 ? 's' : '') + ' in the folder not in the manifest' }),
        h('button', { type: 'button', class: 'lib-btn', text: 'ADD', onclick: adopt })));
    }
    if (scan.missing.length) {
      sc.appendChild(h('div', { class: 'lib-scan-row' },
        h('span', { text: scan.missing.length + ' item' + (scan.missing.length > 1 ? 's' : '') + ' whose image file is gone' }),
        h('button', { type: 'button', class: 'lib-btn', text: 'FORGET', onclick: dropMissing })));
    }

    const grid = $('#lib-grid');
    grid.textContent = '';
    const shown = items.filter((it) => filter === 'all' || it.type === filter);
    const live = new Set();
    for (const it of shown) grid.appendChild(card(it, live));
    for (const [key, url] of urls) if (!live.has(key)) { URL.revokeObjectURL(url); urls.delete(key); }

    if (!info.error) {
      $('#lib-foot').textContent = shown.length
        ? shown.length + ' shown / ' + items.length + ' in library'
        : (items.length ? 'Nothing in this tab yet.' : 'Empty. Import some PNGs, or save from a tool.');
    } else $('#lib-foot').textContent = '';
  }

  function card(it, live) {
    const missing = scan.missing.includes(it.id);
    const img = h('img', { alt: it.name, draggable: 'false' });
    const key = it.id + '|' + it.updated;
    live.add(key);
    if (!missing) {
      if (urls.has(key)) img.src = urls.get(key);
      else library.readImage(it.id).then((bytes) => {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
        urls.set(key, url);
        img.src = url;
      }).catch(() => { img.alt = 'unreadable'; });
    }
    const name = h('input', { class: 'lib-name', type: 'text', value: it.name, spellcheck: 'false', title: 'Click to rename' });
    name.addEventListener('change', async () => {
      const v = name.value.trim();
      if (!v || v === it.name) { name.value = it.name; return; }
      try { await library.update(it.id, { name: v }); } catch (e) { say('RENAME FAILED - ' + clean(e)); name.value = it.name; }
    });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); if (e.key === 'Escape') { name.value = it.name; name.blur(); } });

    let armed = null;
    const del = h('button', { type: 'button', class: 'lib-del', text: 'DELETE' });
    del.addEventListener('click', async () => {
      if (!armed) {                                    // TWO CLICKS: NO BLOCKING confirm() DIALOGS
        del.textContent = 'SURE?'; del.classList.add('is-armed');
        armed = setTimeout(() => { armed = null; del.textContent = 'DELETE'; del.classList.remove('is-armed'); }, 2500);
        return;
      }
      clearTimeout(armed);
      try { await library.remove(it.id); say('DELETED ' + it.name.toUpperCase()); } catch (e) { say('DELETE FAILED - ' + clean(e)); }
    });

    const kind = it.type === 'view' ? it.character + ' / ' + it.view : it.type;
    return h('div', { class: 'lib-card' + (missing ? ' is-missing' : ''), 'data-id': it.id },
      h('div', { class: 'lib-thumb' }, img, missing ? h('span', { class: 'lib-gone', text: 'FILE MISSING' }) : null),
      name,
      h('div', { class: 'lib-meta', title: it.file, text: it.w + '\u00d7' + it.h + ' \u00b7 ' + kind }),
      del);
  }

  // ---------- ACTIONS ----------

  async function importFiles(fileList) {
    const type = $('#lib-type').value;
    let ok = 0;
    const problems = [];
    for (const f of [...fileList]) {
      if (!/\.png$/i.test(f.name) && f.type !== 'image/png') { problems.push(f.name + ' (not a PNG)'); continue; }
      try {
        await library.save({ type, name: f.name.replace(/\.png$/i, ''), bytes: new Uint8Array(await f.arrayBuffer()) });
        ok++;
      } catch (e) { problems.push(f.name + ' (' + clean(e) + ')'); }
    }
    say((ok ? 'IMPORTED ' + ok : 'NOTHING IMPORTED') + (problems.length ? ' - SKIPPED ' + problems.length : ''), 5000);
    showError(problems.length ? 'Skipped: ' + problems.join('; ') : '');
    $('#lib-file').value = '';
  }

  async function adopt() {
    try {
      const r = await library.adopt();
      say('ADDED ' + r.added.length + (r.skipped.length ? ' - SKIPPED ' + r.skipped.length : ''), 5000);
      showError(r.skipped.length ? 'Skipped: ' + r.skipped.map((s) => s.file + ' (' + clean(s.why) + ')').join('; ') : '');
    } catch (e) { showError(clean(e)); }
  }

  async function dropMissing() {
    try { const r = await library.dropMissing(); say('FORGOT ' + r.dropped.length + ' MISSING ITEM' + (r.dropped.length === 1 ? '' : 'S')); }
    catch (e) { showError(clean(e)); }
  }

  async function setRoot(path) {
    try {
      await library.setRoot(path);
      $('#lib-root').value = '';
      say(path ? 'LIBRARY FOLDER CHANGED' : 'LIBRARY FOLDER RESET TO DEFAULT');
      showError('');
    } catch (e) { showError(clean(e)); }
  }

  // ---------- EVENTS ----------

  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'close': close(); break;
      case 'refresh': refresh(); break;
      case 'import': $('#lib-file').click(); break;
      case 'setroot': { const v = $('#lib-root').value.trim(); if (v) setRoot(v); break; }
      case 'defaultroot': setRoot(null); break;
    }
  });
  $('#lib-root').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) setRoot(v); } });
  $('#lib-file').addEventListener('change', (e) => importFiles(e.target.files));

  const drop = $('#lib-drop');
  for (const ev of ['dragenter', 'dragover']) el.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  for (const ev of ['dragleave', 'drop']) el.addEventListener(ev, (e) => { if (ev === 'drop' || e.target === el) drop.classList.remove('is-over'); });
  el.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) importFiles(e.dataTransfer.files); });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen() && !document.getElementById('rail-menu') && !e.target.closest('input')) close(); });
  button.querySelector('.tb-btn').addEventListener('click', toggle);
  library.onChange(() => refresh());

  return { open, close, toggle, refresh, isOpen };
}
