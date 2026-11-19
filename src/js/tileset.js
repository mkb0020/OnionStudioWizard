'use strict';
// SHARED TILE CODE: THE AUTOTILER + MAP HELPERS USED BY TILE LAB AND PLAY.
// A MAP IS {format:'osw-tilemap', version:2, tileset, cols, rows, mask:[strings], overrides:[[x,y,tile,flip]], props?:[[id,x,y,h]], deco?:[[x,y,tile]], spawn?:[col,row]}
//   VERSION 2: tileset 'test' IS THE 8x8 BRICK SHEET (VERSION-1 'test' MAPS ARE REMAPPED BY migrateMap)
//   MASK CHARS: '#' SOLID, '.' AIR, '=' THIN LEDGE (ONE-WAY PLATFORM)
(function (root) {
function hash(x,y){ let h = (x*374761393 + y*668265263)|0; h = (h ^ (h>>>13)) * 1274126177 | 0; return (h ^ (h>>>16))>>>0; }
  const pick = (a,x,y) => a.length ? a[hash(x,y) % a.length] : null;
  
  
  // AUTOTILER FOR THE TEMPLATE LAYOUT (tileset_template.png).
  // IT LOOKS AT WHICH NEIGHBOURS ARE AIR AND PICKS A SLOT. "fx" = FLIP HORIZONTALLY.
  function autoTileTemplate(g,x,y){
    const kind = g.kind, isAir = g.isAir, ROWS = g.rows;
    const k = kind(x,y);
    if(k === '='){            // THIN LEDGE: END CAP WHERE THE NEXT CELL ISN'T A LEDGE
      const l = kind(x-1,y) === '=', r = kind(x+1,y) === '=';
      if(l && r) return {i:18, fx:false};
      if(l && !r) return {i:19, fx:true};
      return {i:19, fx:false};
    }
    const U_ = isAir(x,y-1), D = isAir(x,y+1), L = isAir(x-1,y), R = isAir(x+1,y);
    if(U_ && D){              // PLATFORM: AIR ABOVE AND BELOW
      if(L) return {i:17, fx:false};
      if(R) return {i:17, fx:true};
      return {i:16, fx:false};
    }
    // OUTER CORNERS (AIR ON TWO SIDES)
    if(U_ && L) return {i:12, fx:false};
    if(U_ && R) return {i:12, fx:true};
    if(D && L)  return {i:13, fx:false};
    if(D && R)  return {i:13, fx:true};
    // EDGES (AIR ON ONE SIDE)
    if(U_) return {i:pick([5,6],x,y), fx:false};
    if(D)  return {i:pick([7,8],x,y), fx:false};
    if(L)  return {i:pick([10,11],x,y), fx:false};
    if(R)  return {i:pick([10,11],x,y), fx:true};
    // INNER CORNERS (ONLY A DIAGONAL NEIGHBOUR IS AIR)
    if(isAir(x-1,y-1)) return {i:14, fx:false};
    if(isAir(x+1,y-1)) return {i:14, fx:true};
    if(isAir(x-1,y+1)) return {i:15, fx:false};
    if(isAir(x+1,y+1)) return {i:15, fx:true};
    // DEEP INSIDE THE ROCK
    if(y === ROWS-1) return {i:pick([22,23],x,y), fx:false};      // MAP BOTTOM EDGE
    if(hash(x+101,y*5+17) % 19 === 0) return {i:pick([20,21],x,y), fx:false};   // RARE RUNE TILE
    return {i:pick([0,1,2],x,y), fx:false};
  }
  
  // AUTOTILER FOR THE 4x4 "QUAD" LAYOUT (tileTest.png). NO FLIPS: BOTH SIDES ARE DRAWN.
  //    0 OUTER TL   1 FLOOR A    2 FLOOR B    3 OUTER TR
  //    4 WALL L A   5 INNER ↘    6 INNER ↙    7 WALL R A      (ARROW = WHERE THE AIR DIAGONAL IS)
  //    8 WALL L B   9 INNER ↗   10 INNER ↖   11 WALL R B
  //   12 OUTER BL  13 CEIL A    14 CEIL B    15 OUTER BR
  // NO FILL / PLATFORM / LEDGE TILES YET: FILL RETURNS i:-1 (DRAWN BLACK), PLATFORMS + LEDGES BORROW THE FLOOR + OUTER CORNERS.
  function autoTileQuad(g,x,y){
    const isAir = g.isAir;
    const U_ = isAir(x,y-1), D = isAir(x,y+1), L = isAir(x-1,y), R = isAir(x+1,y);
    if(g.kind(x,y) === '=' || (U_ && D)){   // LEDGE OR 1-TALL PLATFORM: FLOOR, OUTER CORNERS AT THE ENDS
      const solidish = (k) => k !== '.';
      const l = g.kind(x,y) === '=' ? !solidish(g.kind(x-1,y)) : L, r = g.kind(x,y) === '=' ? !solidish(g.kind(x+1,y)) : R;
      if(l && !r) return {i:0, fx:false};
      if(r && !l) return {i:3, fx:false};
      return {i:pick([1,2],x,y), fx:false};
    }
    // OUTER CORNERS (AIR ON TWO SIDES)
    if(U_ && L) return {i:0, fx:false};
    if(U_ && R) return {i:3, fx:false};
    if(D && L)  return {i:12, fx:false};
    if(D && R)  return {i:15, fx:false};
    // EDGES (AIR ON ONE SIDE)
    if(U_) return {i:pick([1,2],x,y), fx:false};
    if(D)  return {i:pick([13,14],x,y), fx:false};
    if(L)  return {i:pick([4,8],x,y), fx:false};
    if(R)  return {i:pick([7,11],x,y), fx:false};
    // INNER CORNERS (ONLY A DIAGONAL NEIGHBOUR IS AIR)
    if(isAir(x+1,y+1)) return {i:5, fx:false};
    if(isAir(x-1,y+1)) return {i:6, fx:false};
    if(isAir(x+1,y-1)) return {i:9, fx:false};
    if(isAir(x-1,y-1)) return {i:10, fx:false};
    return {i:-1, fx:false};   // DEEP INSIDE THE ROCK: NO DARK TILES YET -> BLACK
  }

  // AUTOTILER FOR THE 8x8 "BRICK" SHEET (tileTest.png, 800x800):
  //   TOP-LEFT 4x4  = LIGHT BRICKS, SAME SLOT MEANINGS AS THE QUAD LAYOUT ABOVE (FLOORS / WALLS / CEILINGS / CORNERS)
  //   TOP-RIGHT 4x4 = DARK BRICKS (FILL: UNDER FLOORS, OVER CEILINGS, OUTSIDE WALLS)
  //   BOTTOM HALF   = PROPS (MULTI-CELL DECOR, SEE TILESETS.test.props)
  // SHEET INDEX = row*8 + col. A QUAD SLOT q LIVES AT ROW q>>2, COL q&3.
  const quadToBrick8 = q => (q >> 2) * 8 + (q & 3);
  function autoTileBrick8(g,x,y){
    const t = autoTileQuad(g,x,y);
    if(t.i >= 0) return {i:quadToBrick8(t.i), fx:false};
    // DEEP FILL: REPEAT THE DARK 4x4 BLOCK IN PLACE SO THE BRICK COURSES LINE UP ACROSS CELLS
    return {i:(((y % 4) + 4) % 4) * 8 + 4 + (((x % 4) + 4) % 4), fx:false};
  }

  // OLD SAVES: tileset 'test' WAS A 4x4 SHEET BEFORE MAP VERSION 2, SO ITS STAMPED TILE NUMBERS NEED REMAPPING
  function migrateMap(m){
    if(!m || (m.version || 1) >= 2) return m;
    const out = {...m, version:2};
    if(m.tileset === 'test' && Array.isArray(m.overrides))
      out.overrides = m.overrides.map(o => Array.isArray(o) && Number.isInteger(o[2]) && o[2] >= 0 && o[2] < 16 ? [o[0], o[1], quadToBrick8(o[2]), o[3]] : o);
    return out;
  }

  // AUTOTILER FOR THE FIRST TEST SHEET (OLD LAYOUT, KEPT FOR COMPARISON)
  function autoTileLegacy(g,x,y){
    const kind = g.kind, isAir = g.isAir, ROWS = g.rows;
    const k = kind(x,y);
    if(k === '=') return {i:pick([5,6,7],x,y), fx:false};
    const U_ = isAir(x,y-1), D = isAir(x,y+1), L = isAir(x-1,y), R = isAir(x+1,y);
    // THIN SLAB (AIR ABOVE AND BELOW)
    if(U_ && D){
      if(L && !R) return {i:16, fx:true};
      if(R && !L) return {i:16, fx:false};
      return {i:pick([22,23],x,y), fx:false};
    }
    // CORNERS
    if(D && L) return {i:pick([13,14],x,y), fx:false};
    if(D && R) return {i:pick([13,14],x,y), fx:true};
    if(U_ && R) return {i:16, fx:false};
    if(U_ && L) return {i:16, fx:true};
    // EDGES
    if(D) return {i:pick([0,1,2],x,y), fx:false};
    if(U_) return {i:pick([15,15,15,22,23],x,y), fx:false};
    if(L) return {i:pick([3,8],x,y), fx:false};   // LIT EDGE ON LEFT
    if(R) return {i:pick([3,8],x,y), fx:true};    // LIT EDGE ON RIGHT (FLIPPED)
    // INTERIOR
    if(y === ROWS-1) return {i:pick([20,21],x,y), fx:false};
    return {i:pick([10,11,12],x,y), fx:false};
  }

  // WRAP A MAP OBJECT SO THE AUTOTILER CAN READ IT. g = {cols, rows, kind, isAir, tileAt, mask}
  function makeGrid(m, layout) {
    m = migrateMap(m);
    const mask = (m.mask || []).map(r => r.split(''));
    const rows = mask.length, cols = rows ? mask[0].length : 0;
    const over = new Map();
    for (const [x, y, i, fx] of (m.overrides || [])) over.set(x + ',' + y, { i, fx: !!fx });
    const props = (Array.isArray(m.props) ? m.props : []).filter(p => Array.isArray(p) && typeof p[0] === 'string' && Number.isInteger(p[1]) && Number.isInteger(p[2]));
    const deco = (Array.isArray(m.deco) ? m.deco : []).filter(d => Array.isArray(d) && d.every(Number.isInteger));   // [[x,y,tile]] NON-SOLID PIECES
    const g = { cols, rows, mask, over, props, deco };
    g.kind = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows) ? '#' : mask[y][x];
    g.isAir = (x, y) => g.kind(x, y) !== '#';
    const auto = layout === 'legacy' ? autoTileLegacy : layout === 'quad' ? autoTileQuad : layout === 'brick8' ? autoTileBrick8 : autoTileTemplate;
    g.tileAt = (x, y) => {
      const o = over.get(x + ',' + y); if (o) return { ...o, ov: true };
      if (g.kind(x, y) === '.') return null;
      return auto(g, x, y);
    };
    return g;
  }
  // DRAW SLOT i OF A cols x cols SHEET (img, CELL SIZE tile) INTO A ts x ts SQUARE AT (dx,dy)
  // i == null (EMPTY SLOT LIST) DRAWS NOTHING; i < 0 IS A PLACEHOLDER DRAWN SOLID BLACK
  function drawTile(c, img, tile, i, fx, dx, dy, ts, inset, cols = 5) {
    if (i == null) return;
    if (i < 0) { c.fillStyle = '#000'; c.fillRect(dx, dy, ts, ts); return; }
    const sx = (i % cols) * tile + inset, sy = Math.floor(i / cols) * tile + inset, sw = tile - inset * 2;
    if (fx) { c.save(); c.translate(dx + ts, dy); c.scale(-1, 1); c.drawImage(img, sx, sy, sw, sw, 0, 0, ts, ts); c.restore(); }
    else c.drawImage(img, sx, sy, sw, sw, dx, dy, ts, ts);
  }
  // PROPS ARE BUILT FROM WHOLE SHEET ROWS, w CELLS WIDE STARTING AT COLUMN c:
  //   top ROWS, THEN mid ROWS REPEATED TO FILL THE HEIGHT, THEN bot ROWS. NO mid = FIXED HEIGHT.
  //   mid IS LAID FROM THE BOTTOM UP, SO THE PIECE ABOVE THE BASE ALWAYS MATCHES THE ART AS DRAWN.
  const propMinH = p => p.top.length + p.bot.length + (p.mid.length ? 1 : 0);
  const propDefH = p => p.top.length + p.mid.length + p.bot.length;
  const propClampH = (p, h) => p.mid.length ? Math.max(propMinH(p), Math.min(64, h | 0)) : propDefH(p);
  function propRows(p, h) {   // -> SHEET ROW FOR EACH OF THE h ROWS, TOP TO BOTTOM
    h = propClampH(p, h == null ? propDefH(p) : h);
    const m = h - p.top.length - p.bot.length, mid = [];
    for (let k = 0; k < m; k++) mid.unshift(p.mid[p.mid.length - 1 - (k % p.mid.length)]);
    return [...p.top, ...mid, ...p.bot];
  }
  // DRAW PROP p, h CELLS TALL, WITH ITS TOP-LEFT AT (dx,dy), ts PX PER CELL
  function drawProp(c, img, tile, p, dx, dy, ts, h) {
    propRows(p, h).forEach((r, k) => c.drawImage(img, p.c * tile, r * tile, p.w * tile, tile, dx, dy + k * ts, p.w * ts, ts));
  }
  // TILESETS A MAP CAN NAME. layout PICKS THE AUTOTILER; air/back ARE SLOT LISTS; inset CROPS EDGES (SEAM FIX); backDim DARKENS THE BACK WALL
  const DIR = 'assets/images/map/';
  // cols = CELLS PER ROW IN THE PNG (DEFAULT 5)
  const TILESETS = {
    test: { layout: 'brick8', cols: 8, srcs: [DIR + 'tileTest.png'], air: [], back: [], inset: 0, backDim: 0,
      // PROPS IN THE BOTTOM HALF (SEE propRows). A MAP PLACES THEM AS props:[[id, x, y, h]] (TOP-LEFT MAP CELL, HEIGHT IN CELLS)
      props: [
        { id: 'arch',    name: 'ARCH',            c: 0, w: 3, top: [4, 5], mid: [6],    bot: [7] },
        { id: 'column',  name: 'COLUMN (SLIM)',   c: 3, w: 1, top: [4],    mid: [5, 6], bot: [7] },
        { id: 'pillar',  name: 'COLUMN (WIDE)',   c: 7, w: 1, top: [4],    mid: [5, 6], bot: [7] },
        { id: 'doorway', name: 'DOORWAY',         c: 4, w: 3, top: [5, 6], mid: [],     bot: [7] },
        { id: 'shard',   name: 'CRYSTAL SHARD',   c: 4, w: 1, top: [4],    mid: [],     bot: [] },
        { id: 'cluster', name: 'CRYSTAL CLUSTER', c: 5, w: 1, top: [4],    mid: [],     bot: [] },
      ],
      decoFrom: 32 },   // SHEET SLOTS >= 32 ARE PROP PIECES: STAMPED ONTO THE DECOR LAYER, NOT AS SOLID TILES
    basic: { layout: 'template', srcs: [DIR + 'basic_tileset.png'], air: [9], back: [3, 4], inset: 0, backDim: 0 },
    first: { layout: 'legacy', srcs: [DIR + 'tileset_test.png', DIR + 'sprite_01 (17).png'], air: [4, 4, 4, 4, 9], back: [19, 24, 24], inset: 4, backDim: 0.66 },
  };
  root.OSWTiles = { TILESETS, hash, pick, autoTileTemplate, autoTileLegacy, autoTileQuad, autoTileBrick8, quadToBrick8, migrateMap, makeGrid, drawTile, drawProp, propRows, propMinH, propDefH, propClampH };
})(window);
