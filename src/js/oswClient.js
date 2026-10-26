/* ONION STUDIO WIZARD - TOOL SIDE OF THE BRIDGE
   INCLUDE IN A TOOL WITH:  <script src="js/oswClient.js"></script>   (THE TOOLS' <base href="../"> MAKES THAT PATH WORK)
   A CLASSIC SCRIPT ON PURPOSE: THE TOOLS ARE PLAIN SINGLE-FILE PAGES, NOT MODULES.

   OSWClient.hosted                       true WHEN RUNNING INSIDE THE WIZARD, false WHEN OPENED ON ITS OWN
   OSWClient.library.info()               { root, kind, itemCount, error, ... }
   OSWClient.library.list({type, character})   -> [item]       type: 'part' | 'accessory' | 'view'
   OSWClient.library.get(id)              -> item
   OSWClient.library.readImage(id)        -> Blob (image/png)
   OSWClient.library.save({type, name, blob, id?, character?, view?, tags?, meta?})  -> item
                                          blob = a PNG Blob (OSWClient.canvasToPng(canvas) MAKES ONE)
                                          id of an existing item = overwrite it; no id = a new item
                                          type 'view' needs character + view (ALWAYS OVERWRITES THAT VIEW)
   OSWClient.library.update(id, {name, tags, meta})
   OSWClient.library.remove(id)
   OSWClient.library.scan()               -> { missing: [id], untracked: [{file,type,name}] }
   OSWClient.library.character.list()     -> [character slug]           (FOLDERS UNDER library/characters/)
   OSWClient.library.character.get(slug)  -> object | null              (characters/<slug>/character.json)
   OSWClient.library.character.save(slug, object)                       (FREE-FORM JSON OBJECT, MAX 1 MB)
   OSWClient.on('library.changed', fn)    fn({kind:'added'|'updated'|'removed'|'adopted'|'root'|'character', id?})
   OSWClient.off(name, fn)

   EVERY CALL RETURNS A PROMISE. ERRORS ARE Error OBJECTS WHOSE MESSAGE STARTS WITH A CODE ("NOT_PNG: ...",
   "NOT_FOUND: ...", "NOT_HOSTED", "TIMEOUT: ...") SO A TOOL CAN TELL THEM APART. */
(function () {
  'use strict';

  var hosted = window.parent !== window;
  var origin = window.location.origin;
  var target = origin === 'null' ? '*' : origin;
  var pending = {};
  var listeners = {};
  var seq = 0;
  var TIMEOUT_MS = 30000;

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.osw !== 1 || e.source !== window.parent || e.origin !== origin) return;
    if (m.kind === 'response') {
      var p = pending[m.id];
      if (!p) return;
      delete pending[m.id];
      clearTimeout(p.timer);
      if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error || 'UNKNOWN: request failed'));
    } else if (m.kind === 'event') {
      (listeners[m.name] || []).slice().forEach(function (fn) { try { fn(m.payload); } catch (err) { console.error(err); } });
    }
  });

  function request(type, args) {
    if (!hosted) return Promise.reject(new Error('NOT_HOSTED: this tool is not running inside Onion Studio Wizard'));
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      var timer = setTimeout(function () { delete pending[id]; reject(new Error('TIMEOUT: no answer from the Wizard for ' + type)); }, TIMEOUT_MS);
      pending[id] = { resolve: resolve, reject: reject, timer: timer };
      window.parent.postMessage({ osw: 1, kind: 'request', id: id, type: type, args: args || {} }, target);
    });
  }

  window.OSWClient = {
    hosted: hosted,
    library: {
      info: function () { return request('library.info'); },
      list: function (opts) { return request('library.list', opts || {}); },
      get: function (id) { return request('library.get', { id: id }); },
      readImage: function (id) { return request('library.readImage', { id: id }); },
      save: function (opts) { return request('library.save', opts); },
      update: function (id, patch) { return request('library.update', { id: id, patch: patch }); },
      remove: function (id) { return request('library.remove', { id: id }); },
      scan: function () { return request('library.scan'); },
      character: {
        list: function () { return request('library.character.list'); },
        get: function (slug) { return request('library.character.get', { character: slug }); },
        save: function (slug, data) { return request('library.character.save', { character: slug, data: data }); },
      },
    },
    on: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    off: function (name, fn) { listeners[name] = (listeners[name] || []).filter(function (f) { return f !== fn; }); },
    canvasToPng: function (canvas) {
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('BAD_DATA: the canvas could not be turned into a PNG')); }, 'image/png');
      });
    },
  };
})();
