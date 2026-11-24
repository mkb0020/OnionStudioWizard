// ONION STUDIO WIZARD - THE DRAWING TOOL'S "FULL CANVAS" VIEW AS ITS OWN OS WINDOW
// THE IN-APP POP MODAL CAN'T LEAVE THE APP WINDOW, SO IN THE DESKTOP APP THE POP BUTTON OPENS A REAL WINDOW INSTEAD
// (tools/canvasPop.html) THAT CAN BE DRAGGED ONTO ANOTHER SCREEN. THE PICTURE ITSELF TRAVELS TOOL -> WINDOW OVER A
// BroadcastChannel ('osw-canvas-pop'); THIS FILE ONLY OPENS / CLOSES THE WINDOW AND PUTS IT BACK WHERE IT WAS LAST TIME.
// THE WINDOW SAVES ITS OWN POSITION + SIZE (PHYSICAL PIXELS) TO localStorage[GEOM_KEY] WHENEVER IT MOVES OR RESIZES.

export const POP_LABEL = 'canvas-pop';
export const GEOM_KEY = 'osw.canvasPop.geom';

const tauri = () => window.__TAURI__;

function notDesktop() { return new Error('NOT_DESKTOP: the pop-out window needs the desktop app'); }

// LAST SAVED SPOT, BUT ONLY IF ITS TITLE BAR WOULD STILL LAND ON A CONNECTED SCREEN (A LAPTOP UNPLUGGED FROM ITS
// SECOND MONITOR WOULD OTHERWISE OPEN THE WINDOW SOMEWHERE INVISIBLE)
async function savedGeom() {
  let g = null;
  try { g = JSON.parse(localStorage.getItem(GEOM_KEY) || 'null'); } catch (e) { g = null; }
  if (!g || ![g.x, g.y, g.w, g.h].every(Number.isFinite) || g.w < 100 || g.h < 100) return null;
  try {
    const mons = await tauri().window.availableMonitors();
    const px = g.x + 60, py = g.y + 15;            // A POINT ON THE TITLE BAR
    const onScreen = mons.some((m) => px >= m.position.x && px < m.position.x + m.size.width
                                   && py >= m.position.y && py < m.position.y + m.size.height);
    return onScreen ? g : null;
  } catch (e) { return null; }
}

export async function openCanvasPop() {
  const T = tauri();
  const WW = T && T.webviewWindow && T.webviewWindow.WebviewWindow;
  if (!WW) throw notDesktop();

  const existing = await WW.getByLabel(POP_LABEL);
  if (existing) {                                   // ALREADY OPEN (MAYBE MINIMIZED): JUST BRING IT BACK
    await existing.unminimize().catch(() => {});
    await existing.show().catch(() => {});
    return { opened: false };
  }

  const g = await savedGeom();
  const w = new WW(POP_LABEL, {
    url: 'tools/canvasPop.html',
    title: 'Full Canvas - Onion Studio Wizard',
    width: 460, height: 500, minWidth: 240, minHeight: 270,
    decorations: false,                             // THE PAGE DRAWS ITS OWN NEON TITLE BAR
    resizable: true,
    visible: false,                                 // SHOWN ONCE IT IS IN ITS SAVED SPOT (NO JUMP)
    focus: false,                                   // KEEP THE PEN ON THE DRAWING
    dragDropEnabled: false,
    shadow: true,
  });
  await new Promise((resolve, reject) => {
    w.once('tauri://created', resolve);
    w.once('tauri://error', (e) => reject(new Error('WINDOW: could not open the pop-out (' + JSON.stringify(e && e.payload) + ')')));
  });
  if (g) {
    const { PhysicalPosition, PhysicalSize } = T.dpi;
    await w.setSize(new PhysicalSize(Math.round(g.w), Math.round(g.h))).catch(() => {});
    await w.setPosition(new PhysicalPosition(Math.round(g.x), Math.round(g.y))).catch(() => {});
  } else {
    await w.center().catch(() => {});
  }
  await w.show();
  return { opened: true };
}

export async function closeCanvasPop() {
  const WW = tauri() && tauri().webviewWindow && tauri().webviewWindow.WebviewWindow;
  if (!WW) throw notDesktop();
  const w = await WW.getByLabel(POP_LABEL);
  if (w) await w.close();
  return { closed: !!w };
}
