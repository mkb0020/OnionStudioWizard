// RUN WITH: npm test   (node --test tests/)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibrary, slugify, uniqueId, readPngSize, VIEW_NAMES, MANIFEST_PATH } from '../src/js/library/library.js';
import { createMemoryStorage, createTauriStorage, bytesToB64, b64ToBytes } from '../src/js/library/storage.js';

// MINIMAL PNG: SIGNATURE + IHDR (ONLY THE HEADER IS EVER READ)
function png(w = 800, h = 600, pad = 0) {
  const u8 = new Uint8Array(33 + pad);
  u8.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const dv = new DataView(u8.buffer);
  dv.setUint32(16, w); dv.setUint32(20, h);
  return u8;
}
const fresh = () => { const storage = createMemoryStorage(); return { storage, lib: createLibrary(storage) }; };
const manifest = (storage) => JSON.parse(new TextDecoder().decode(storage.files.get(MANIFEST_PATH).bytes));

test('slugify and uniqueId', () => {
  assert.equal(slugify('Head 01!'), 'head_01');
  assert.equal(slugify('  --  '), 'item');
  assert.equal(slugify(null), 'item');
  assert.equal(slugify('x'.repeat(100)).length, 40);
  assert.equal(uniqueId('a', new Set()), 'a');
  assert.equal(uniqueId('a', new Set(['a', 'a_2'])), 'a_3');
});

test('readPngSize reads the header and rejects non-PNGs', () => {
  assert.deepEqual(readPngSize(png(123, 45)), { w: 123, h: 45 });
  assert.throws(() => readPngSize(new Uint8Array(40)), /NOT_PNG/);
  assert.throws(() => readPngSize(new Uint8Array(5)), /NOT_PNG/);
  assert.throws(() => readPngSize(png(0, 10)), /zero-size/);
});

test('base64 helpers round-trip, including data bigger than one chunk', () => {
  const big = new Uint8Array(100000).map((_, i) => i % 251);
  assert.deepEqual(b64ToBytes(bytesToB64(big)), big);
  assert.deepEqual(b64ToBytes(bytesToB64(new Uint8Array(0))), new Uint8Array(0));
});

test('save part: writes the image and the manifest, makes unique ids', async () => {
  const { storage, lib } = fresh();
  const a = await lib.save({ type: 'part', name: 'Head 01', bytes: png(800, 800) });
  const b = await lib.save({ type: 'part', name: 'Head 01', bytes: png(10, 20) });
  assert.equal(a.id, 'head_01'); assert.equal(a.file, 'parts/head_01.png'); assert.equal(a.w, 800);
  assert.equal(b.id, 'head_01_2'); assert.equal(b.file, 'parts/head_01_2.png');
  assert.ok(storage.files.has('parts/head_01.png') && storage.files.has('parts/head_01_2.png'));
  const m = manifest(storage);
  assert.equal(m.format, 'osw-library'); assert.equal(m.version, 1); assert.equal(m.items.length, 2);
  assert.equal(m.items[0].name, 'Head 01');
});

test('save accessory + list filters by type', async () => {
  const { lib } = fresh();
  await lib.save({ type: 'part', name: 'Hand', bytes: png() });
  await lib.save({ type: 'accessory', name: 'Hood', bytes: png() });
  assert.deepEqual((await lib.list()).map((i) => i.id), ['hand', 'hood']);
  assert.deepEqual((await lib.list({ type: 'accessory' })).map((i) => i.id), ['hood']);
});

test('save with an existing id overwrites in place and keeps created', async () => {
  const { storage, lib } = fresh();
  const a = await lib.save({ type: 'part', name: 'Hand', bytes: png(10, 10), tags: ['left'] });
  const b = await lib.save({ type: 'part', name: 'Hand v2', id: 'hand', bytes: png(20, 20) });
  assert.equal(b.id, 'hand'); assert.equal(b.w, 20); assert.equal(b.created, a.created); assert.deepEqual(b.tags, ['left']);
  assert.equal((await lib.list()).length, 1);
  assert.equal(storage.files.get('parts/hand.png').bytes.length, 33);
  await assert.rejects(lib.save({ type: 'accessory', id: 'hand', name: 'x', bytes: png() }), /BAD_TYPE/);
});

test('views: fixed path, overwrite, validation', async () => {
  const { storage, lib } = fresh();
  const v = await lib.save({ type: 'view', character: 'nova', view: 'left-front', name: 'Nova 3/4', bytes: png() });
  assert.equal(v.id, 'nova.left-front'); assert.equal(v.file, 'characters/nova/views/left-front.png');
  assert.ok(storage.files.has(v.file));
  await lib.save({ type: 'view', character: 'nova', view: 'left-front', name: 'again', bytes: png(5, 5) });
  assert.equal((await lib.list({ type: 'view' })).length, 1);
  assert.equal((await lib.list({ character: 'nova' })).length, 1);
  await assert.rejects(lib.save({ type: 'view', character: 'Nova!', view: 'front', bytes: png() }), /BAD_CHARACTER/);
  await assert.rejects(lib.save({ type: 'view', character: 'nova', view: 'sideways', bytes: png() }), /BAD_VIEW/);
  assert.equal(VIEW_NAMES.length, 8);
});

test('save rejects bad input and writes nothing', async () => {
  const { storage, lib } = fresh();
  await assert.rejects(lib.save({ type: 'weapon', name: 'x', bytes: png() }), /BAD_TYPE/);
  await assert.rejects(lib.save({ type: 'part', name: 'x', bytes: new Uint8Array(100) }), /NOT_PNG/);
  await assert.rejects(lib.save({ type: 'part', name: 'x', bytes: [1, 2, 3] }), /BAD_DATA/);
  await assert.rejects(lib.save({ type: 'part', name: 'x', id: 'Bad Id', bytes: png() }), /BAD_ID/);
  assert.equal(storage.files.size, 0);
});

test('update changes name/tags/meta; remove deletes the file and the entry', async () => {
  const { storage, lib } = fresh();
  await lib.save({ type: 'part', name: 'Foot', bytes: png() });
  const u = await lib.update('foot', { name: 'Left foot', tags: ['boot', 5], meta: { pivot: [1, 2] } });
  assert.equal(u.name, 'Left foot'); assert.deepEqual(u.tags, ['boot', '5']); assert.deepEqual(u.meta, { pivot: [1, 2] });
  assert.equal((await lib.get('foot')).name, 'Left foot');
  await lib.remove('foot');
  assert.equal(storage.files.has('parts/foot.png'), false);
  assert.equal((await lib.list()).length, 0);
  await assert.rejects(lib.get('foot'), /NOT_FOUND/);
  await assert.rejects(lib.update('foot', {}), /NOT_FOUND/);
});

test('readImage returns the stored bytes; missing file is a clear error', async () => {
  const { storage, lib } = fresh();
  const bytes = png(33, 44, 100);
  await lib.save({ type: 'part', name: 'Chest', bytes });
  assert.deepEqual(await lib.readImage('chest'), bytes);
  storage.files.delete('parts/chest.png');
  await assert.rejects(lib.readImage('chest'), /NOT_FOUND.*missing/);
});

test('scan, adopt and dropMissing', async () => {
  const { storage, lib } = fresh();
  await lib.save({ type: 'part', name: 'Known', bytes: png() });
  await storage.write('parts/hand-drawn.png', png(7, 8));                       // DROPPED IN BY HAND
  await storage.write('accessories/Ring.png', png());
  await storage.write('characters/nova/views/front.png', png());
  await storage.write('characters/nova/views/sideways.png', png());             // NOT A KNOWN VIEW NAME
  await storage.write('parts/notes.txt', new Uint8Array([1]));
  await storage.write('parts/broken.png', new Uint8Array(50));                  // NOT REALLY A PNG
  storage.files.delete('parts/known.png');                                      // MANIFEST ENTRY WITH NO FILE

  const s = await lib.scan();
  assert.deepEqual(s.missing, ['known']);
  assert.deepEqual(s.untracked.map((u) => u.file).sort(), ['accessories/Ring.png', 'characters/nova/views/front.png', 'parts/broken.png', 'parts/hand-drawn.png']);

  const r = await lib.adopt();
  assert.deepEqual(r.added.map((i) => i.id).sort(), ['hand_drawn', 'nova.front', 'ring']);
  assert.deepEqual(r.skipped.map((x) => x.file).sort(), ['characters/nova/views/sideways.png', 'parts/broken.png']);
  const hd = await lib.get('hand_drawn');
  assert.equal(hd.file, 'parts/hand-drawn.png'); assert.equal(hd.w, 7);          // KEEPS ITS REAL FILE NAME
  assert.equal((await lib.save({ type: 'part', id: 'hand_drawn', name: 'x', bytes: png(9, 9) })).file, 'parts/hand-drawn.png');

  const d = await lib.dropMissing();
  assert.deepEqual(d.dropped, ['known']);
  assert.equal((await lib.scan()).missing.length, 0);
});

test('a corrupt manifest is never overwritten', async () => {
  const { storage, lib } = fresh();
  const junk = new TextEncoder().encode('{ this is not json');
  await storage.write(MANIFEST_PATH, junk);
  await assert.rejects(lib.save({ type: 'part', name: 'x', bytes: png() }), /MANIFEST_CORRUPT/);
  await assert.rejects(lib.list(), /MANIFEST_CORRUPT/);
  assert.deepEqual(storage.files.get(MANIFEST_PATH).bytes, junk);
  assert.equal(storage.files.has('parts/x.png'), false, 'no image may be written when the manifest cannot be loaded');
  const info = await lib.info();
  assert.match(info.error, /MANIFEST_CORRUPT/);
  await storage.write(MANIFEST_PATH, new TextEncoder().encode(JSON.stringify({ format: 'osw-library', version: 99, items: [] })));
  await assert.rejects(lib.list(), /MANIFEST_NEWER/);
  await storage.write(MANIFEST_PATH, new TextEncoder().encode('{"hello":1}'));
  await assert.rejects(lib.list(), /MANIFEST_CORRUPT/);
});

test('concurrent saves are serialized: nothing lost, ids unique', async () => {
  const { storage, lib } = fresh();
  await Promise.all(Array.from({ length: 25 }, () => lib.save({ type: 'part', name: 'Same', bytes: png() })));
  const items = await lib.list();
  assert.equal(items.length, 25);
  assert.equal(new Set(items.map((i) => i.id)).size, 25);
  assert.equal(manifest(storage).items.length, 25);
});

test('a failed call does not block the queue', async () => {
  const { lib } = fresh();
  await assert.rejects(lib.save({ type: 'part', name: 'x', bytes: new Uint8Array(40) }));
  assert.equal((await lib.save({ type: 'part', name: 'ok', bytes: png() })).id, 'ok');
});

test('manifest is stable, sorted and git-friendly', async () => {
  const { storage, lib } = fresh();
  await lib.save({ type: 'accessory', name: 'B', bytes: png() });
  await lib.save({ type: 'part', name: 'Z', bytes: png() });
  await lib.save({ type: 'part', name: 'A', bytes: png() });
  assert.deepEqual(manifest(storage).items.map((i) => i.id), ['a', 'z', 'b']);   // PARTS, THEN ACCESSORIES, EACH BY id
  const text = new TextDecoder().decode(storage.files.get(MANIFEST_PATH).bytes);
  assert.ok(text.endsWith('}\n') && text.includes('\n  "items": ['));
});

test('onChange fires for add, update, remove and can be unsubscribed', async () => {
  const { lib } = fresh();
  const seen = [];
  const off = lib.onChange((c) => seen.push(c.kind));
  await lib.save({ type: 'part', name: 'P', bytes: png() });
  await lib.update('p', { name: 'Q' });
  await lib.remove('p');
  off();
  await lib.save({ type: 'part', name: 'R', bytes: png() });
  assert.deepEqual(seen, ['added', 'updated', 'removed']);
});

test('memory storage: list shape and read copies', async () => {
  const s = createMemoryStorage();
  await s.write('a/b/c.png', new Uint8Array([1, 2]));
  await s.write('a/d.png', new Uint8Array([3]));
  assert.deepEqual((await s.list('a', false)).map((e) => [e.path, e.isDir]), [['a/b', true], ['a/d.png', false]]);
  assert.deepEqual((await s.list('a', true)).map((e) => e.path), ['a/b', 'a/b/c.png', 'a/d.png']);
  assert.equal(await s.read('nope'), null);
  const r = await s.read('a/d.png'); r[0] = 99;
  assert.equal((await s.read('a/d.png'))[0], 3);
});

test('tauri storage: command names, argument shapes, NOT_FOUND mapping, error text', async () => {
  const calls = [];
  const invoke = async (cmd, args) => {
    calls.push([cmd, args]);
    if (cmd === 'library_read') {
      if (args.path === 'missing.png') throw 'NOT_FOUND: missing.png';
      if (args.path === 'bad.png') throw 'IO: disk on fire';
      return bytesToB64(new Uint8Array([9, 8, 7]));
    }
    if (cmd === 'library_set_root') throw 'BAD_ROOT: nope';
    return cmd === 'library_list' ? [{ path: 'parts/a.png', size: 1, modified: 0, isDir: false }] : undefined;
  };
  const s = createTauriStorage(invoke);
  assert.equal(s.kind, 'disk');
  assert.deepEqual(await s.read('x.png'), new Uint8Array([9, 8, 7]));
  assert.equal(await s.read('missing.png'), null);
  await assert.rejects(s.read('bad.png'), /IO: disk on fire/);
  await s.write('parts/a.png', new Uint8Array([1, 2, 3]));
  await s.remove('parts/a.png');
  assert.equal((await s.list('parts', true)).length, 1);
  await s.list(undefined, undefined);
  await assert.rejects(s.setRoot('C:\\x'), /BAD_ROOT: nope/);
  await s.info();
  const byCmd = Object.fromEntries(calls.map(([c, a]) => [c, a]));
  assert.deepEqual(byCmd.library_write, { path: 'parts/a.png', data: bytesToB64(new Uint8Array([1, 2, 3])) });
  assert.deepEqual(byCmd.library_delete, { path: 'parts/a.png' });
  assert.deepEqual(calls.filter(([c]) => c === 'library_list').map(([, a]) => a), [{ dir: 'parts', recursive: true }, { dir: '', recursive: false }]);
  assert.deepEqual(byCmd.library_set_root, { path: 'C:\\x' });
});

test('library works end to end on top of the tauri adapter (fake disk behind invoke)', async () => {
  const disk = new Map();
  const invoke = async (cmd, a) => {
    if (cmd === 'library_read') { if (!disk.has(a.path)) throw 'NOT_FOUND: ' + a.path; return disk.get(a.path); }
    if (cmd === 'library_write') { disk.set(a.path, a.data); return; }
    if (cmd === 'library_delete') { disk.delete(a.path); return; }
    if (cmd === 'library_list') return [...disk.keys()].filter((p) => p.startsWith(a.dir + '/')).map((p) => ({ path: p, size: 1, modified: 0, isDir: false }));
    if (cmd === 'library_info') return { root: 'C:\\repo\\library', isDefault: true, defaultRoot: 'C:\\repo\\library' };
    throw new Error('unexpected ' + cmd);
  };
  const lib = createLibrary(createTauriStorage(invoke));
  const item = await lib.save({ type: 'part', name: 'Calf', bytes: png(64, 64) });
  assert.equal(item.file, 'parts/calf.png');
  assert.ok(disk.has('parts/calf.png') && disk.has('manifest.json'));
  assert.deepEqual(await lib.readImage('calf'), png(64, 64));
  assert.equal((await lib.info()).itemCount, 1);
  assert.equal((await lib.scan()).untracked.length, 0);
});

test('character sheets: save, read back, list, and bad input is refused', async () => {
  const { storage, lib } = fresh();
  assert.deepEqual(await lib.listCharacters(), []);
  assert.equal(await lib.readCharacter('nova'), null);
  const seen = [];
  lib.onChange((c) => seen.push(c));
  await lib.saveCharacter('nova', { info: { name: 'Nova' }, todo: [{ text: 'idle', done: true }] });
  await lib.save({ type: 'view', name: 'x', character: 'zed', view: 'front', bytes: png(8, 8) });
  assert.deepEqual(await lib.listCharacters(), ['nova', 'zed']);
  assert.deepEqual(await lib.readCharacter('nova'), { info: { name: 'Nova' }, todo: [{ text: 'idle', done: true }] });
  assert.ok(storage.files.has('characters/nova/character.json'));
  assert.deepEqual(seen[0], { kind: 'character', id: 'nova' });
  await assert.rejects(lib.saveCharacter('Bad Name', {}), /BAD_CHARACTER/);
  await assert.rejects(lib.saveCharacter('nova', [1, 2]), /BAD_DATA/);
  await assert.rejects(lib.saveCharacter('nova', null), /BAD_DATA/);
  await assert.rejects(lib.saveCharacter('nova', { big: 'x'.repeat(1100000) }), /1 MB/);
  storage.files.set('characters/nova/character.json', { bytes: new TextEncoder().encode('{nope'), modified: 0 });
  await assert.rejects(lib.readCharacter('nova'), /BAD_DATA/);
  // THE IMAGE LIBRARY IGNORES THE JSON FILE
  assert.deepEqual((await lib.scan()).untracked, []);
});
