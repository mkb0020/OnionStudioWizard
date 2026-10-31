/* =====================================================================
   CAPE SIM - THE ONE VERLET CLOTH SIM, SHARED BY CAPE LAB (src/tools/capeLab.html) AND PLAY (src/tools/play.html).
   PLAIN FUNCTIONS: NO CANVAS, NO DOM, NO GLOBALS. THE LAB TUNES THE NUMBERS, PLAY RUNS THE SAME CODE ON THEM, SO WHAT YOU SEE IN THE LAB IS WHAT THE GAME DOES.
   PORTS TO GDSCRIPT / KAPLAY AS-IS. LOADED AS <script src="js/capeSim.js"> (EXPOSES window.CapeSim) OR require()'D IN NODE.

   capeStep(cape, P, env, dt)   cape = { chains, p, last, acc, t } (EMPTY OBJECT TO START), P = THE SETTINGS (CAPE LAB's C), dt = SECONDS
     env = { pins:[{x,y}...], widths:[n], facing: 1 | -1, vel:{x,y}, groundY, colliders:[{x,y,r}] }
     OPTIONAL HOST HOOKS (ALL DEFAULT TO NOTHING, SO THE LAB BEHAVES EXACTLY AS BEFORE):
       floorAt(x, y)  WORLD y OF THE SURFACE UNDER A POINT (INSTEAD OF THE FLAT groundY)
       gravMul        MULTIPLIES GRAVITY (PLAY'S CAST GUST LIFTS THE CAPE)
       biasAdd        ADDED TO backBias (PLAY'S IDLE GUST / CAST WIND)
       flutterAdd     ADDED TO flutter, INDEPENDENT OF SPEED (PLAY'S IDLE FLUTTER)
       keepBehind     +1 / -1: CHAIN POINTS MAY NOT GET AHEAD OF THEIR ROOT IN THAT FACING (PLAY, WHILE IDLE)
   ===================================================================== */
(function (root) {
'use strict';
const TAU = Math.PI * 2;
const SPANS = [3, 5, 8, 12];
const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

// THE CAPE IS ONE CHAIN PER PIN. 1 PIN = A SINGLE SPINE (DRAWN AS A RIBBON). 2 PINS = TWO EDGE CHAINS LINKED BY RUNGS + DIAGONALS = A CLOTH STRIP WHOSE ROOT EDGE IS PINNED AT BOTH ENDS.
function capeReset(cape, P, pins, facing) { // HANG EACH CHAIN DOWN-AND-BACK FROM ITS PIN
  const h = P.hangDeg * Math.PI / 180;
  cape.chains = pins.map((root) => {
    const p = [];
    for (let i = 0; i < P.segments; i++) {
      const x = root.x - facing * Math.sin(h) * i * P.segLen, y = root.y + Math.cos(h) * i * P.segLen;
      p.push({ x, y, px: x, py: y });
    }
    return { p };
  });
  cape.p = cape.chains[0].p;
  cape.last = pins.map((r) => ({ x: r.x, y: r.y }));
  cape.acc = 0;
}

function capeMirror(cape, axisX) { // FLIP EVERY CHAIN (POSITION AND VELOCITY) ACROSS A VERTICAL AXIS - CLEAN TURN-AROUND
  for (const c of cape.chains) for (const q of c.p) { q.x = 2 * axisX - q.x; q.px = 2 * axisX - q.px; }
}

// WHERE THE CAPE "WANTS" TO POINT: DOWN-AND-BACK AT REST, STREAMING OPPOSITE THE TRAVEL DIRECTION WHEN MOVING.
function capeRefDir(P, vel, facing) {
  const h = P.hangDeg * Math.PI / 180;
  const x = -facing * Math.sin(h) * P.sag - vel.x / P.vRef;
  const y = Math.cos(h) * P.sag - vel.y / P.vRef;
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

// env = { pins:[{x,y}...], widths:[n], facing, vel:{x,y}, groundY, colliders:[{x,y,r}] }
function capeStep(cape, P, env, dt) {
  const K = env.pins.length, n = P.segments;
  if (!cape.chains || cape.chains.length !== K || cape.chains[0].p.length !== n) capeReset(cape, P, env.pins, env.facing);
  if (dt <= 0) return;
  cape.acc = Math.min(cape.acc + dt, P.maxSteps * P.step);
  const steps = Math.floor(cape.acc / P.step);
  if (steps === 0) return;
  cape.acc -= steps * P.step;

  const h = P.step, damp = Math.max(0, 1 - P.drag * h);
  const speed01 = Math.min(1, Math.abs(env.vel.x) / P.vRef);
  const gm = env.gravMul === undefined ? 1 : env.gravMul, biasAdd = env.biasAdd || 0, flutterAdd = env.flutterAdd || 0, keepBehind = env.keepBehind || 0;   // HOST HOOKS (PLAY'S IDLE / CAST BLENDS): ALL DEFAULT TO NOTHING
  const ref = capeRefDir(P, env.vel, env.facing);
  const chordMin = 2 * P.segLen * Math.cos(P.maxBendDeg * Math.PI / 360), useBend = P.maxBendDeg < 179.5;

  for (let st = 1; st <= steps; st++) {
    const f = st / steps;
    // 1) PINS + FORCES + VERLET INTEGRATION, ONE CHAIN AT A TIME
    for (let k = 0; k < K; k++) {
      const Pt = cape.chains[k].p, a0 = cape.last[k], b0 = env.pins[k];
      Pt[0].x = a0.x + (b0.x - a0.x) * f;                   // SLIDE THE PIN ALONG THE FRAME'S TRAVEL SO FAST MOVES DON'T JERK THE CHAIN
      Pt[0].y = a0.y + (b0.y - a0.y) * f;
      Pt[0].px = Pt[0].x; Pt[0].py = Pt[0].y;
      for (let i = 1; i < n; i++) {
        const q = Pt[i], a = Pt[i - 1], b = Pt[Math.min(n - 1, i + 1)];
        let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const nx = -ty, ny = tx;                            // SEGMENT NORMAL
        const vx = (q.x - q.px) / h - P.wind, vy = (q.y - q.py) / h; // VELOCITY RELATIVE TO THE AIR (PX/S)
        const vn = vx * nx + vy * ny, vt = vx * tx + vy * ty;
        const tip = i / (n - 1);
        // CLOTH-STYLE AIR DRAG: THE COMPONENT ACROSS THE CLOTH IS RESISTED HARD, ALONG IT LIGHTLY. THIS IS WHAT MAKES IT STREAM AND NOT TUMBLE.
        let ax = -P.nDrag * vn * nx - P.tDrag * vt * tx;
        let ay = -P.nDrag * vn * ny - P.tDrag * vt * ty;
        ay += P.gravity * (1 - P.lift * speed01) * gm;
        ax += -env.facing * (P.backBias + biasAdd) * tip;
        const fl = (P.flutter * speed01 + flutterAdd) * tip; // SMOOTH TURBULENCE (GROWS TOWARD THE HEM AND WITH SPEED); EDGES GET A SLIGHT PHASE OFFSET
        ax += Math.sin(cape.t * 9 + i * 0.8 + k * 0.7) * fl;
        ay += Math.cos(cape.t * 7.3 + i * 1.1 + k * 0.7) * fl;
        if (P.restPull > 0) {                               // SOFT PULL TOWARD THE "WANTS TO POINT" SHAPE
          ax += (Pt[0].x + ref.x * i * P.segLen - q.x) * P.restPull;
          ay += (Pt[0].y + ref.y * i * P.segLen - q.y) * P.restPull;
        }
        const mx = (q.x - q.px) * damp, my = (q.y - q.py) * damp;
        q.px = q.x; q.py = q.y;
        q.x += mx + ax * h * h; q.y += my + ay * h * h;
      }
    }

    let floors = null;                                      // PER POINT FLOOR HEIGHT (ONLY WHEN THE HOST PASSES floorAt(x, y) -> WORLD y OF THE SURFACE UNDER A POINT)
    if (env.floorAt) floors = cape.chains.map((c) => c.p.map((q) => env.floorAt(q.x, q.y)));
    // 2) CONSTRAINTS (REPEATED)
    for (let it = 0; it < P.iterations; it++) {
      for (let k = 0; k < K; k++) {
        const Pt = cape.chains[k].p;
        for (let i = 0; i < n - 1; i++) link(Pt[i], Pt[i + 1], P.segLen, i === 0 ? 0 : 1, 1, 1);
        if (P.bend > 0) for (let i = 0; i < n - 2; i++) link(Pt[i], Pt[i + 2], P.segLen * 2 * 0.97, i === 0 ? 0 : 1, 1, P.bend);
        if (useBend) for (let i = 0; i < n - 2; i++) { const d = Math.hypot(Pt[i + 2].x - Pt[i].x, Pt[i + 2].y - Pt[i].y); if (d < chordMin) link(Pt[i], Pt[i + 2], chordMin, i === 0 ? 0 : 1, 1, 1); } // NO SHARP FOLDS: ONE-SIDED DISTANCE LIMIT BETWEEN POINTS TWO APART (CHORD = 2L*cos(bend/2))
        if (P.spanMin > 0) for (const s of SPANS) {         // NO LOOPS / HAIRPINS: POINTS s APART MAY NOT GET CLOSER THAN spanMin * (STRAIGHT LENGTH)
          if (s >= n) break;
          const dmin = P.spanMin * s * P.segLen;
          for (let i = 0; i + s < n; i++) { const a = Pt[i], b = Pt[i + s]; if (Math.hypot(b.x - a.x, b.y - a.y) < dmin) link(a, b, dmin, i === 0 ? 0 : 1, 1, 1); }
        }
      }
      if (K === 2) {                                        // CLOTH ACROSS THE WIDTH. THE STRIP MAY NARROW (HANG / FOLD FLAT) BUT NEVER STRETCH WIDER THAN ITS WIDTH, AND CAN'T SHEAR
        const A = cape.chains[0].p, Bp = cape.chains[1].p;
        for (let i = 1; i < n; i++) {
          const d = Math.hypot(Bp[i].x - A[i].x, Bp[i].y - A[i].y);
          link(A[i], Bp[i], env.widths[i], 1, 1, d > env.widths[i] ? 1 : P.rung);   // HARD ABOVE THE WIDTH, SOFT (P.rung) BELOW IT
        }
        if (P.shear > 0) for (let i = 1; i < n - 1; i++) {   // DIAGONALS: MAX-ONLY, SO THE STRIP CAN'T SLIDE SIDEWAYS BUT CAN STILL NARROW. SKIPPED AT THE ROOT QUAD (ITS RUNG IS SLANTED BY THE PINS)
          const dmax = Math.hypot(P.segLen, (env.widths[i] + env.widths[i + 1]) / 2);
          if (Math.hypot(Bp[i + 1].x - A[i].x, Bp[i + 1].y - A[i].y) > dmax) link(A[i], Bp[i + 1], dmax, 1, 1, P.shear);
          if (Math.hypot(A[i + 1].x - Bp[i].x, A[i + 1].y - Bp[i].y) > dmax) link(Bp[i], A[i + 1], dmax, 1, 1, P.shear);
        }
      }
      for (let k = 0; k < K; k++) {
        const Pt = cape.chains[k].p;
        if (P.collide) for (let i = 1; i < n; i++) for (const c of env.colliders) push(Pt[i], c, P.thick);
        if (keepBehind) for (let i = 1; i < n; i++) if ((Pt[i].x - Pt[0].x) * keepBehind > 0) Pt[i].x = Pt[0].x;   // HOST HOOK: NEVER LET THE CHAIN GET AHEAD OF ITS ROOT (PLAY, WHILE IDLE)
        for (let i = 1; i < n; i++) {                       // FLOOR
          const q = Pt[i], gy = (floors ? floors[k][i] : env.groundY) - P.groundPad;
          if (q.y > gy) { q.y = gy; q.py = gy; q.px += (q.x - q.px) * P.groundFric; }   // ON THE FLOOR: ZERO VERTICAL VELOCITY (LEFT IN, IT PILES UP AGAINST THE CONSTRAINTS AND BLOWS UP) + FRICTION
        }
      }
    }
    cape.t += h;
  }
  cape.last = env.pins.map((r) => ({ x: r.x, y: r.y }));
}

function link(a, b, rest, wA, wB, stiff) { // MOVE TWO POINTS TOWARD/AWAY UNTIL `rest` APART (w = HOW MUCH EACH MOVES, 0 = PINNED)
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4, w = wA + wB;
  if (w === 0) return;
  const k = ((d - rest) / d) * stiff;
  a.x += dx * k * (wA / w); a.y += dy * k * (wA / w);
  b.x -= dx * k * (wB / w); b.y -= dy * k * (wB / w);
}

function push(q, c, pad) { // KEEP A POINT OUTSIDE A CIRCLE
  const dx = q.x - c.x, dy = q.y - c.y, d = Math.hypot(dx, dy), m = c.r + pad;
  if (d < m) {
    if (d < 1e-4) { q.x = c.x - m; return; }
    q.x = c.x + (dx / d) * m; q.y = c.y + (dy / d) * m;
  }
}

function segX(a, b, c, d) { // DO SEGMENTS ab AND cd CROSS?
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return (o(a, b, c) > 0) !== (o(a, b, d) > 0) && (o(c, d, a) > 0) !== (o(c, d, b) > 0);
}

const quadArea = (A, Bp, i) => (A[i + 1].x - A[i].x) * (Bp[i].y - A[i].y) - (A[i + 1].y - A[i].y) * (Bp[i].x - A[i].x); // SIGNED: FLIPS WHEN A STRIP QUAD IS TWISTED INSIDE OUT

function capeMetrics(cape) { // CURL READOUTS: WORST JOINT BEND, TOTAL TURNING, SELF-CROSSINGS, (2 PINS) INVERTED QUADS
  let worst = 0, total = 0, cross = 0, twist = 0;
  for (const c of cape.chains) {
    const Pt = c.p, n = Pt.length; let tot = 0, prev = null;
    for (let i = 0; i < n - 1; i++) {
      const a = Math.atan2(Pt[i + 1].y - Pt[i].y, Pt[i + 1].x - Pt[i].x);
      if (prev !== null) { const d = Math.abs(wrapA(a - prev)); worst = Math.max(worst, d); tot += d; }
      prev = a;
    }
    total = Math.max(total, tot);
    for (let i = 0; i < n - 1; i++) for (let j = i + 2; j < n - 1; j++) if (segX(Pt[i], Pt[i + 1], Pt[j], Pt[j + 1])) cross++;
  }
  if (cape.chains.length === 2) {
    const A = cape.chains[0].p, Bp = cape.chains[1].p, n = A.length;
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) if (segX(A[i], A[i + 1], Bp[j], Bp[j + 1])) cross++;   // THE TWO EDGES SHOULD NEVER CROSS
    let pos = 0, neg = 0; for (let i = 0; i < n - 1; i++) { if (quadArea(A, Bp, i) > 0) pos++; else neg++; }
    twist = Math.min(pos, neg);                             // QUADS FACING THE MINORITY WAY = A TWIST IN THE STRIP
  }
  return { worst: worst * 180 / Math.PI, total: total * 180 / Math.PI, cross, twist };
}

const CapeSim = { TAU, SPANS, wrapA, capeReset, capeMirror, capeRefDir, capeStep, capeMetrics, link, push, segX, quadArea };
if (typeof module !== 'undefined' && module.exports) module.exports = CapeSim; else root.CapeSim = CapeSim;
})(typeof window !== 'undefined' ? window : globalThis);
