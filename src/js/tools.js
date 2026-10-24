// ONION STUDIO WIZARD - TOOL REGISTRY
// ONE ENTRY PER RAIL BUTTON. src: null = NOT WIRED YET (BUTTON SHOWS DIMMED).
// status: SELECTOR OF A FOOTER INSIDE THE TOOL THAT THE SHELL MIRRORS INTO ITS OWN STATUS BAR (OPTIONAL).
// src IS RELATIVE TO src/ (THE FOLDER TAURI SERVES), SO ADDING A TOOL = DROP THE HTML IN src/tools/ AND SET src HERE.

export const TOOLS = [
  { id: 'character', group: 'CHAR', label: 'Builder', title: 'Character Builder',  icon: 'user',  src: null },
  { id: 'draw',      group: 'DRAW',      label: 'Draw',    title: 'Drawing Tool',       icon: 'pen',   src: 'tools/drawingTool.html', status: '#status' },
  { id: 'rig',       group: 'RIG',       label: 'Rig Lab', title: 'Rig Lab',            icon: 'bones', src: 'tools/animatedRig.html' },
  { id: 'staticRig', group: 'RIG',       label: 'Static',  title: 'Static Rig',         icon: 'pose',  src: null },
  { id: 'vectors',   group: 'FX',        label: 'Spells',  title: 'Vector Spell Lab',   icon: 'spark', src: null },
  { id: 'cape',      group: 'FX',        label: 'Cape',    title: 'Cape Lab',           icon: 'cape',  src: null },
  { id: 'tiles',     group: 'WORLD',     label: 'Tiles',   title: 'Tile Lab',           icon: 'grid',  src: null },
  { id: 'play',      group: 'PLAY',      label: 'Play',    title: 'Sprite Playground',  icon: 'play',  src: null },
];

// 24x24 STROKE ICONS (INNER SVG MARKUP ONLY; STYLED BY .rail-btn svg IN shell.css)
export const ICONS = {
  user:  '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  pen:   '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z"/><path d="M14 7l3 3"/>',
  bones: '<circle cx="12" cy="4.5" r="2"/><path d="M12 6.5v7M12 9l-5 3M12 9l5 3M12 13.5l-4 6.5M12 13.5l4 6.5"/>',
  pose:  '<circle cx="12" cy="4.5" r="2"/><path d="M12 6.5V14M7 10h10M12 14l-3 6M12 14l3 6"/>',
  spark: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
  cape:  '<path d="M7 4h10l2 15c-2 1.5-4.5 1.5-7 0-2.5 1.5-5 1.5-7 0z"/><path d="M9 4c0 2 1.3 3 3 3s3-1 3-3"/>',
  grid:  '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/>',
  play:  '<path d="M7 4l13 8-13 8z"/>',
};
