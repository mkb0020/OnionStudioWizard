// ONION STUDIO WIZARD - SHELL
// ICON BUTTONS IN THE TITLE BAR + ONE IFRAME PER TOOL. TOOLS LOAD LAZILY ON FIRST OPEN AND STAY ALIVE (HIDDEN)
// WHEN YOU SWITCH AWAY, SO NOTHING IS LOST. A HIDDEN IFRAME STOPS RUNNING ITS requestAnimationFrame LOOP.
// A GROUP WITH SEVERAL TOOLS (RIG, FX) IS A SPLIT BUTTON: THE ICON OPENS THE LAST-USED TOOL, THE CARET OPENS A TEXT MENU.

import pk from './prettyKit/window.js';
import { TOOLS, ICONS } from './tools.js';
import { createStatusMirror } from './statusMirror.js';
import { createStorage } from './library/storage.js';
import { createLibrary } from './library/library.js';
import { createBridge } from './bridge.js';
import { createLibraryPanel } from './libraryPanel.js';

const VERSION = 'v0.1.0';
const LAST_KEY = 'osw.lastTool';
const CARET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>';

const rail   = document.getElementById('rail');
const stage  = document.getElementById('stage');
const empty  = document.getElementById('stage-empty');
const win    = document.getElementById('pretty-window');
const mirror = createStatusMirror(document.getElementById('pk-status-tool'));

const frames   = new Map();   // tool id -> iframe (CREATED ON FIRST OPEN)
const groups   = [];          // { name, tools[], current (tool id), el, main, caret }
let activeId   = null;
let statusTimer = null;
let menu = null;              // { group, el } WHILE A DROPDOWN IS OPEN
let libButton = null;         // THE LIBRARY BUTTON'S WRAPPER (.tb-group), SET IN buildRail

const toolById  = (id) => TOOLS.find((t) => t.id === id);
const groupOf   = (id) => groups.find((g) => g.tools.some((t) => t.id === id));
const iconSvg   = (t) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[t.icon] || '') + '</svg>';

// ---------- WINDOW FRAME ----------

pk.createPrettyWindow({
  title: 'Onion Studio Wizard',
  icon: 'assets/images/icon.png',
  version: VERSION,
  statusText: 'READY',
});

// DRAG THE WINDOW BY THE TITLE BAR (DOUBLE-CLICK MAXIMIZE IS HANDLED BY PRETTYKIT).
// SKIPPED IN A PLAIN BROWSER, WHERE window.__TAURI__ DOES NOT EXIST.
document.getElementById('pretty-titlebar').addEventListener('mousedown', (e) => {
  closeMenu();
  if (e.button !== 0 || e.detail > 1 || e.target.closest('#pretty-controls, #rail')) return;
  const w = window.__TAURI__?.window?.getCurrentWindow?.();
  if (w) w.startDragging().catch(() => {});
});

// ---------- TITLE BAR BUTTONS ----------

function buildRail() {
  for (const t of TOOLS) {
    let g = groups.find((x) => x.name === t.group);
    if (!g) { g = { name: t.group, tools: [], current: t.id }; groups.push(g); }
    g.tools.push(t);
    if (!toolById(g.current).src && t.src) g.current = t.id;   // START ON THE FIRST TOOL THAT EXISTS
  }

  groups.forEach((g, i) => {
    if (i > 0) { const sep = document.createElement('span'); sep.className = 'pk-titlebar-sep'; rail.appendChild(sep); }

    const el = document.createElement('div');
    el.className = 'tb-group';
    el.dataset.group = g.name;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'tb-btn';
    main.addEventListener('click', () => { closeMenu(); activate(g.current); });
    el.appendChild(main);

    if (g.tools.length > 1) {
      const caret = document.createElement('button');
      caret.type = 'button';
      caret.className = 'tb-caret';
      caret.innerHTML = CARET;
      caret.title = g.name + ' tools';
      caret.setAttribute('aria-haspopup', 'menu');
      caret.addEventListener('click', (e) => { e.stopPropagation(); menu && menu.group === g ? closeMenu() : openMenu(g); });
      el.appendChild(caret);
      g.caret = caret;
    }

    g.el = el; g.main = main;
    rail.appendChild(el);
    refreshGroup(g);
  });

  // LIBRARY: NOT A TOOL (NO IFRAME), SO IT SITS AFTER THE GROUPS AND OPENS THE DRAWER (js/libraryPanel.js)
  const sep = document.createElement('span'); sep.className = 'pk-titlebar-sep'; rail.appendChild(sep);
  libButton = document.createElement('div');
  libButton.className = 'tb-group';
  const lb = document.createElement('button');
  lb.type = 'button'; lb.className = 'tb-btn'; lb.title = 'Library'; lb.setAttribute('aria-label', 'Library');
  lb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS.library + '</svg>';
  libButton.appendChild(lb);
  rail.appendChild(libButton);
}

function refreshGroup(g) {
  const cur = toolById(g.current);
  g.main.innerHTML = iconSvg(cur);
  g.main.title = cur.src ? cur.title : cur.title + ' (not wired up yet)';
  g.main.setAttribute('aria-label', cur.title);
  g.el.classList.toggle('is-active', g.tools.some((t) => t.id === activeId));
  g.el.classList.toggle('is-soon', !g.tools.some((t) => t.src));
}

// ---------- GROUP DROPDOWN ----------

function openMenu(g) {
  closeMenu();
  const el = document.createElement('div');
  el.id = 'rail-menu';
  el.setAttribute('role', 'menu');
  for (const t of g.tools) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.className = 'menu-item' + (t.src ? '' : ' is-soon') + (t.id === activeId ? ' is-active' : '');
    b.innerHTML = iconSvg(t) + '<span>' + t.title + '</span>' + (t.src ? '' : '<em>SOON</em>');
    b.addEventListener('click', () => { closeMenu(); activate(t.id); });
    el.appendChild(b);
  }
  win.appendChild(el);                                     // OUTSIDE THE TITLE BAR, WHICH CLIPS ITS CONTENT
  const r = g.el.getBoundingClientRect();
  el.style.left = Math.max(6, Math.min(r.left, window.innerWidth - el.offsetWidth - 6)) + 'px';
  el.style.top  = (r.bottom + 4) + 'px';
  g.caret.classList.add('is-open');
  menu = { group: g, el };
}

function closeMenu() {
  if (!menu) return;
  menu.el.remove();
  menu.group.caret.classList.remove('is-open');
  menu = null;
}

document.addEventListener('pointerdown', (e) => { if (menu && !e.target.closest('#rail-menu, .tb-caret')) closeMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
window.addEventListener('blur', closeMenu);                // A CLICK INSIDE A TOOL'S IFRAME BLURS THIS WINDOW

// ---------- TOOL SWITCHING ----------

function setStatus(text, revertMs) {
  pk.setStatusText(text);
  clearTimeout(statusTimer);
  if (revertMs) {
    statusTimer = setTimeout(() => {
      const t = toolById(activeId);
      pk.setStatusText(t ? t.title : 'READY');
    }, revertMs);
  }
}

function focusFrame(frame) {
  // SO KEYS GO STRAIGHT TO THE TOOL (THE PLAYGROUND WILL NEED THIS FOR MOVEMENT AND ATTACKS)
  try { frame.contentWindow.focus(); } catch (e) { /* NOT FATAL */ }
}

// SHOW THE TOOL'S FOOTER IN THE SHELL STATUS BAR (ONLY TOOLS THAT DECLARE status IN tools.js)
function syncMirror(tool, frame) {
  if (!tool.status) { mirror.detach(); return; }
  try { mirror.attach(frame.contentDocument, tool.status); } catch (e) { mirror.detach(); }
}

function openFrame(tool) {
  const f = document.createElement('iframe');
  f.className = 'tool-frame';
  f.title = tool.title;
  f.dataset.tool = tool.id;
  f.allow = 'clipboard-read; clipboard-write; fullscreen';
  f.addEventListener('load', () => {
    if (activeId !== tool.id) return;
    syncMirror(tool, f);
    focusFrame(f);
  });
  f.src = tool.src;
  stage.appendChild(f);
  frames.set(tool.id, f);
  return f;
}

function activate(id) {
  const tool = toolById(id);
  if (!tool) return;
  if (!tool.src) { setStatus(tool.title.toUpperCase() + ' - NOT WIRED UP YET', 2200); return; }

  const isNew = !frames.has(id);
  const frame = frames.get(id) || openFrame(tool);
  activeId = id;
  const g = groupOf(id);
  g.current = id;
  for (const [fid, f] of frames) f.hidden = (fid !== id);
  groups.forEach(refreshGroup);
  empty.hidden = true;
  setStatus(tool.title);
  if (isNew) mirror.detach(); else syncMirror(tool, frame);   // A NEW FRAME ATTACHES ON ITS load EVENT
  try { localStorage.setItem(LAST_KEY, id); } catch (e) { /* STORAGE CAN BE UNAVAILABLE */ }
  requestAnimationFrame(() => focusFrame(frame));
}

// ---------- START ----------

buildRail();

// ---------- LIBRARY ----------
// ONE LIBRARY FOR THE WHOLE APP: REAL FILES IN THE DESKTOP APP, BROWSER MEMORY WHEN RUN IN A PLAIN BROWSER
const storage = createStorage();
const library = createLibrary(storage);
createBridge({ library, frames });
const libraryPanel = createLibraryPanel({
  library, button: libButton, mount: document.getElementById('pretty-content'), notify: (t, ms) => setStatus(t, ms),
});
library.info().then((i) => { if (i.error) setStatus('LIBRARY - ' + i.error.replace(/^[A-Z_]+:\s*/, ''), 8000); }).catch(() => {});

let first = null;
try { first = localStorage.getItem(LAST_KEY); } catch (e) { /* IGNORE */ }
if (!TOOLS.some((t) => t.id === first && t.src)) first = (TOOLS.find((t) => t.src) || {}).id;
if (first) activate(first);

// HANDLE FOR LATER STEPS (LIBRARY / SEND-TO BRIDGE) AND FOR DEBUGGING IN THE DEVTOOLS CONSOLE
window.OSW = { activate, tools: TOOLS, frames, library, storage, libraryPanel, get active() { return activeId; } };
