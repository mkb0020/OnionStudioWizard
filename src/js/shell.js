// ONION STUDIO WIZARD - SHELL
// RAIL + ONE IFRAME PER TOOL. TOOLS LOAD LAZILY ON FIRST OPEN AND STAY ALIVE (HIDDEN) WHEN YOU SWITCH AWAY,
// SO NOTHING IS LOST. A HIDDEN IFRAME STOPS RUNNING ITS requestAnimationFrame LOOP.

import pk from './prettyKit/window.js';
import { TOOLS, ICONS } from './tools.js';

const VERSION = 'v0.1.0';
const LAST_KEY = 'osw.lastTool';

const rail  = document.getElementById('rail');
const stage = document.getElementById('stage');
const empty = document.getElementById('stage-empty');

const buttons = new Map();   // id -> rail button
const frames  = new Map();   // id -> iframe (CREATED ON FIRST OPEN)
let activeId = null;
let statusTimer = null;

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
  if (e.button !== 0 || e.detail > 1 || e.target.closest('#pretty-controls')) return;
  const win = window.__TAURI__?.window?.getCurrentWindow?.();
  if (win) win.startDragging().catch(() => {});
});

// ---------- RAIL ----------

function buildRail() {
  let lastGroup = null;
  for (const t of TOOLS) {
    if (t.group !== lastGroup) {
      const lab = document.createElement('div');
      lab.className = 'rail-label';
      lab.textContent = t.group;
      rail.appendChild(lab);
      lastGroup = t.group;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rail-btn' + (t.src ? '' : ' is-soon');
    b.title = t.src ? t.title : t.title + ' (not wired up yet)';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[t.icon] || '') + '</svg><span>' + t.label + '</span>';
    b.addEventListener('click', () => activate(t.id));
    rail.appendChild(b);
    buttons.set(t.id, b);
  }
}

// ---------- TOOL SWITCHING ----------

function setStatus(text, revertMs) {
  pk.setStatusText(text);
  clearTimeout(statusTimer);
  if (revertMs) {
    statusTimer = setTimeout(() => {
      const t = TOOLS.find((x) => x.id === activeId);
      pk.setStatusText(t ? t.title : 'READY');
    }, revertMs);
  }
}

function focusFrame(frame) {
  // SO KEYS GO STRAIGHT TO THE TOOL (THE PLAYGROUND WILL NEED THIS FOR MOVEMENT AND ATTACKS)
  try { frame.contentWindow.focus(); } catch (e) { /* NOT FATAL */ }
}

function openFrame(tool) {
  const f = document.createElement('iframe');
  f.className = 'tool-frame';
  f.title = tool.title;
  f.dataset.tool = tool.id;
  f.allow = 'clipboard-read; clipboard-write; fullscreen';
  f.addEventListener('load', () => { if (activeId === tool.id) focusFrame(f); });
  f.src = tool.src;
  stage.appendChild(f);
  frames.set(tool.id, f);
  return f;
}

function activate(id) {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) return;
  if (!tool.src) { setStatus(tool.title.toUpperCase() + ' - NOT WIRED UP YET', 2200); return; }

  const frame = frames.get(id) || openFrame(tool);
  activeId = id;
  for (const [fid, f] of frames) f.hidden = (fid !== id);
  for (const [bid, b] of buttons) b.classList.toggle('is-active', bid === id);
  empty.hidden = true;
  setStatus(tool.title);
  try { localStorage.setItem(LAST_KEY, id); } catch (e) { /* STORAGE CAN BE UNAVAILABLE */ }
  requestAnimationFrame(() => focusFrame(frame));
}

// ---------- START ----------

buildRail();
let first = null;
try { first = localStorage.getItem(LAST_KEY); } catch (e) { /* IGNORE */ }
if (!TOOLS.some((t) => t.id === first && t.src)) first = (TOOLS.find((t) => t.src) || {}).id;
if (first) activate(first);

// HANDLE FOR LATER STEPS (LIBRARY / SEND-TO BRIDGE) AND FOR DEBUGGING IN THE DEVTOOLS CONSOLE
window.OSW = { activate, tools: TOOLS, frames, get active() { return activeId; } };
