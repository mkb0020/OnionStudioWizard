'use strict';
// SHARED TILE CODE: THE AUTOTILER + MAP HELPERS USED BY TILE LAB AND PLAY.
// A MAP IS {format:'osw-tilemap', version:1, tileset, cols, rows, mask:[strings], overrides:[[x,y,tile,flip]], spawn?:[col,row]}
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
    const mask = (m.mask || []).map(r => r.split(''));
    const rows = mask.length, cols = rows ? mask[0].length : 0;
    const over = new Map();
    for (const [x, y, i, fx] of (m.overrides || [])) over.set(x + ',' + y, { i, fx: !!fx });
    const g = { cols, rows, mask, over };
    g.kind = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows) ? '#' : mask[y][x];
    g.isAir = (x, y) => g.kind(x, y) !== '#';
    const auto = layout === 'legacy' ? autoTileLegacy : layout === 'quad' ? autoTileQuad : autoTileTemplate;
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
  // TILESETS A MAP CAN NAME. layout PICKS THE AUTOTILER; air/back ARE SLOT LISTS; inset CROPS EDGES (SEAM FIX); backDim DARKENS THE BACK WALL
  const DIR = 'assets/images/map/';
  // cols = CELLS PER ROW IN THE PNG (DEFAULT 5)
  const TILESETS = {
    test: { layout: 'quad', cols: 4, srcs: [DIR + 'tileTest.png'], air: [], back: [], inset: 0, backDim: 0 },
    basic: { layout: 'template', srcs: [DIR + 'basic_tileset.png'], air: [9], back: [3, 4], inset: 0, backDim: 0 },
    first: { layout: 'legacy', srcs: [DIR + 'tileset_test.png', DIR + 'sprite_01 (17).png'], air: [4, 4, 4, 4, 9], back: [19, 24, 24], inset: 4, backDim: 0.66 },
  };
  root.OSWTiles = { TILESETS, hash, pick, autoTileTemplate, autoTileLegacy, autoTileQuad, makeGrid, drawTile };
})(window);
