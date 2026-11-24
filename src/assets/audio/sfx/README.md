# SFX

Sound effects for PLAY (and later the game). Drop files here, then point the matching row of the `SFX` table at the top of the AUDIO block in `src/tools/play.html` at them:

```js
jump: { src: 'jump.ogg', volume: 0.8, pitch: [0.97, 1.03] },
footstep: { src: ['step_1.ogg', 'step_2.ogg', 'step_3.ogg'], volume: 0.4, pitch: [0.9, 1.1], cooldown: 0.08 },
```

- A bare file name means this folder. A path with a `/` is used as-is (relative to `src/`).
- An array = several takes; one is picked at random each time, never the same one twice in a row.
- `.ogg` is best (small, loops cleanly). `.wav` and `.mp3` work too.
- Keep one-shots short and trimmed tight at the start, or they will feel late.
- `src: null` = not made yet. Press **P** in PLAY for placeholder blips (each event beeps at its own pitch) to hear where the sounds fire.
- A wrong path shows as `MISSING` on PLAY's audio HUD line and warns in the console. Nothing breaks.

Events wired so far: `jump`, `wallJump`, `doubleJump`, `land` (louder the harder she lands), `footstep` (each contact pose of the run), `wallGrab`, `dash`, `spell`, `kick`, `airKick`, `respawn`.
