/* ======================================================================
   OSW AUDIO - MUSIC LOOP + SFX (WEB AUDIO, NO LIBRARIES)
   ONE AudioContext, TWO BUSES (music / sfx) INTO A MASTER GAIN. PLAIN FUNCTIONS, NO DOM: THE SAME FILE CAN GO INTO THE GAME REPO AS-IS.

   MUSIC:  OSWAudio.music.load('assets/audio/SpectralFrequency.ogg')   DECODED ONCE, LOOPED GAPLESS (AN <audio loop> TAG LEAVES A CLICK AT THE SEAM)
           OSWAudio.music.play() / stop() / toggle()                    SHORT FADE IN / OUT. stop() REMEMBERS WHERE IT WAS, play() CARRIES ON FROM THERE
   SFX:    OSWAudio.sfx.register({ jump: { src: 'assets/audio/sfx/jump.ogg', volume: 0.8 }, ... })
           OSWAudio.sfx.play('jump')                                     OR play('land', { volume: 0.5 }) FOR A PER-CALL SCALE
     PER-SOUND OPTIONS (ALL OPTIONAL):
       src       A PATH, AN ARRAY OF PATHS (ONE IS PICKED AT RANDOM, NEVER THE SAME ONE TWICE IN A ROW), OR null = NOT MADE YET
       volume    0..1 (DEFAULT 1)
       pitch     [lo, hi] RANDOM PLAYBACK RATE PER PLAY (DEFAULT [1, 1]). [0.95, 1.05] KEEPS REPEATS (FOOTSTEPS) FROM SOUNDING ROBOTIC
       cooldown  SECONDS BEFORE THE SAME SOUND CAN FIRE AGAIN (DEFAULT 0.03)
       voices    MAX COPIES PLAYING AT ONCE; THE OLDEST IS CUT (DEFAULT 4)
   BLIPS:  OSWAudio.blips = true -> A SOUND WITH NO FILE (OR A FILE THAT FAILED TO LOAD) PLAYS A SHORT SYNTH BLIP INSTEAD,
           EACH NAME AT ITS OWN PITCH, SO YOU CAN HEAR WHERE THE HOOKS FIRE BEFORE THE REAL SOUNDS EXIST.
   UNLOCK: BROWSERS KEEP AUDIO SILENT UNTIL THE FIRST CLICK / KEY. OSWAudio.unlockOn(window) RESUMES IT ON THE FIRST ONE.
   EVERYTHING FAILS SOFT: A MISSING FILE IS A WARNING IN THE CONSOLE AND A STATUS IN status(), NEVER AN ERROR.
   ====================================================================== */
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  const clamp01 = v => Math.max(0, Math.min(1, +v || 0));
  const FADE = 0.4;   // SECONDS FOR MUSIC FADE IN / OUT

  let ctx = null, master = null, musicBus = null, sfxBus = null;
  function ensure() {   // THE CONTEXT IS MADE LAZILY (IT STARTS 'suspended' UNTIL A GESTURE, BUT DECODING ALREADY WORKS)
    if (ctx || !AC) return ctx;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus.gain.value = A.musicVolume; sfxBus.gain.value = A.sfxVolume;
    return ctx;
  }
  async function decode(src) {
    const r = await fetch(src); if (!r.ok) throw new Error(r.status + ' ' + src);
    const buf = await r.arrayBuffer();
    return await new Promise((res, rej) => { const p = ensure().decodeAudioData(buf, res, rej); if (p && p.catch) p.catch(rej); });   // OLD WEBKIT ONLY HAS THE CALLBACK FORM
  }
  const ramp = (param, to, sec) => { const t = ctx.currentTime; param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(to, t + sec); };

  /* ---------- MUSIC ---------- */
  const music = {
    src: '', buffer: null, node: null, gain: null, startedAt: 0, offset: 0, playing: false, wantPlay: false, error: '',
    async load(src) {
      this.stop(true); this.src = src; this.buffer = null; this.offset = 0; this.error = '';
      try { this.buffer = await decode(src); } catch (e) { this.error = e.message || String(e); console.warn('[audio] music: ' + this.error); return false; }
      if (this.wantPlay) this.play();   // play() WAS CALLED BEFORE THE FILE FINISHED LOADING
      return true;
    },
    play() {
      this.wantPlay = true;
      if (this.playing || !this.buffer || !ensure()) return;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(musicBus);
      const n = ctx.createBufferSource(); n.buffer = this.buffer; n.loop = true; n.connect(g);
      n.start(0, this.offset % this.buffer.duration);
      this.startedAt = ctx.currentTime - this.offset; this.node = n; this.gain = g; this.playing = true;
      ramp(g.gain, 1, FADE);
    },
    stop(now) {
      this.wantPlay = false;
      if (!this.playing) return;
      this.offset = this.position(); this.playing = false;
      const n = this.node, g = this.gain, when = now ? 0 : FADE; this.node = this.gain = null;
      if (!when) { try { n.stop(); } catch (e) { /* ALREADY STOPPED */ } g.disconnect(); return; }
      ramp(g.gain, 0, when); n.stop(ctx.currentTime + when + 0.02); n.onended = () => g.disconnect();
    },
    toggle() { if (this.wantPlay) this.stop(); else this.play(); return this.wantPlay; },
    restart() { this.stop(true); this.offset = 0; this.play(); },
    position() { return !this.buffer ? 0 : this.playing ? (ctx.currentTime - this.startedAt) % this.buffer.duration : this.offset; },
  };

  /* ---------- SFX ---------- */
  const defs = {}, state = {};   // state[name] = { buffers: [AudioBuffer | null], status, last, lastPick, voices: [] }
  function blipFreq(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 330 * Math.pow(2, (h % 24) / 12); }   // TWO OCTAVES ABOVE E4, ONE NOTE PER NAME
  function blip(name, vol) {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(blipFreq(name), t); o.frequency.exponentialRampToValueAtTime(blipFreq(name) * 0.7, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.12);
  }
  const sfx = {
    register(table) {   // CAN BE CALLED AGAIN: NEW / CHANGED NAMES (RE)LOAD, THE REST ARE LEFT ALONE
      const jobs = [];
      for (const [name, d] of Object.entries(table || {})) {
        const def = Object.assign({ src: null, volume: 1, pitch: [1, 1], cooldown: 0.03, voices: 4 }, d);
        const list = def.src == null ? [] : Array.isArray(def.src) ? def.src.filter(Boolean) : [def.src];
        const same = defs[name] && JSON.stringify(defs[name].src) === JSON.stringify(def.src);
        defs[name] = def;
        if (same) continue;
        const s = state[name] = { buffers: [], status: list.length ? 'loading' : 'no file', last: -1, lastPick: -1, voices: [] };
        if (!list.length || !ensure()) continue;
        jobs.push(Promise.all(list.map(src => decode(src).catch(e => { console.warn('[audio] sfx ' + name + ': ' + (e.message || e)); return null; })))
          .then(bufs => { if (state[name] !== s) return; s.buffers = bufs; const ok = bufs.filter(Boolean).length; s.status = ok === list.length ? 'ok' : ok ? ok + '/' + list.length + ' files' : 'missing'; }));
      }
      return Promise.all(jobs);
    },
    play(name, opts) {
      if (!ensure() || ctx.state !== 'running' || A.muted) return false;
      const def = defs[name], s = state[name];
      if (!def || !s) { if (A.blips) { blip(name, A.blipVolume); return true; } return false; }   // UNREGISTERED: BLIP ONLY
      const now = ctx.currentTime; if (now - s.last < def.cooldown) return false;
      const vol = clamp01(def.volume * (opts && opts.volume != null ? opts.volume : 1));
      const ready = s.buffers.map((b, i) => b ? i : -1).filter(i => i >= 0);
      if (!ready.length) { if (A.blips && s.status !== 'loading') { s.last = now; blip(name, A.blipVolume * vol); return true; } return false; }
      let pick = ready[Math.floor(Math.random() * ready.length)];
      if (ready.length > 1 && pick === s.lastPick) pick = ready[(ready.indexOf(pick) + 1) % ready.length];   // NEVER THE SAME VARIANT TWICE IN A ROW
      s.lastPick = pick; s.last = now;
      while (s.voices.length >= def.voices) { const v = s.voices.shift(); try { v.stop(); } catch (e) { /* DONE */ } }
      const n = ctx.createBufferSource(), g = ctx.createGain();
      n.buffer = s.buffers[pick];
      const [lo, hi] = Array.isArray(def.pitch) ? def.pitch : [def.pitch, def.pitch];
      n.playbackRate.value = (opts && opts.rate) || (lo + Math.random() * (hi - lo)) || 1;
      g.gain.value = vol; n.connect(g); g.connect(sfxBus); n.start();
      s.voices.push(n); n.onended = () => { g.disconnect(); const i = s.voices.indexOf(n); if (i >= 0) s.voices.splice(i, 1); };
      return true;
    },
    names() { return Object.keys(defs); },
    status(name) { return state[name] ? state[name].status : 'unregistered'; },
  };

  /* ---------- PUBLIC ---------- */
  const A = window.OSWAudio = {
    supported: !!AC, music, sfx, blips: false, blipVolume: 0.6, muted: false, musicVolume: 0.6, sfxVolume: 0.8,
    get context() { return ensure(); },
    get running() { return !!ctx && ctx.state === 'running'; },
    setMusicVolume(v) { A.musicVolume = clamp01(v); if (musicBus) ramp(musicBus.gain, A.musicVolume, 0.05); },
    setSfxVolume(v) { A.sfxVolume = clamp01(v); if (sfxBus) ramp(sfxBus.gain, A.sfxVolume, 0.05); },
    setMuted(m) { A.muted = !!m; if (master) ramp(master.gain, A.muted ? 0 : 1, 0.05); },
    resume() { if (ensure() && ctx.state === 'suspended') return ctx.resume(); return Promise.resolve(); },
    suspend() { if (ctx && ctx.state === 'running') return ctx.suspend(); return Promise.resolve(); },   // FREEZES EVERYTHING IN PLACE (MUSIC RESUMES WHERE IT WAS)
    unlockOn(target) {   // RESUME ON THE FIRST USER GESTURE (AUTOPLAY RULES)
      const go = () => { A.resume(); if (A.running) ['pointerdown', 'keydown', 'touchstart'].forEach(e => target.removeEventListener(e, go, true)); };
      ['pointerdown', 'keydown', 'touchstart'].forEach(e => target.addEventListener(e, go, true));
    },
    status() {
      const out = {}; for (const n of sfx.names()) out[n] = sfx.status(n);
      return { context: ctx ? ctx.state : 'none', music: { src: music.src, loaded: !!music.buffer, playing: music.playing, error: music.error }, sfx: out };
    },
  };
})();
