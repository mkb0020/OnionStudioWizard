// ONION STUDIO WIZARD - STATUS MIRROR
// COPIES THE ITEMS OF A TOOL'S OWN FOOTER (A SAME-ORIGIN ELEMENT INSIDE ITS IFRAME) INTO THE SHELL'S STATUS BAR
// AND KEEPS THEM LIVE. THE TOOL KEEPS WRITING TO ITS OWN FOOTER AS BEFORE; IT IS JUST HIDDEN WHEN EMBEDDED.
// EACH CHILD OF THE SOURCE BECOMES ONE <span> HERE WITH THE SAME CLASSES, A data-src = ITS ID (FOR STYLING), AND THE SAME HTML.

export function createStatusMirror(host) {
  let src = null, observer = null, queued = false;

  function sync() {
    queued = false;
    if (!src || !src.isConnected) return;
    const kids = [...src.children];
    while (host.children.length > kids.length) host.lastElementChild.remove();
    kids.forEach((k, i) => {
      let m = host.children[i];
      if (!m) { m = document.createElement('span'); host.appendChild(m); }
      if (m.dataset.src !== k.id) m.dataset.src = k.id;
      if (m.className !== k.className) m.className = k.className;
      if (m.hidden !== k.hidden) m.hidden = k.hidden;
      if (m._html !== k.innerHTML) {
        m._html = k.innerHTML;
        m.innerHTML = k.innerHTML;
        m.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));   // NO DUPLICATE IDS IN THE SHELL DOCUMENT
      }
    });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(sync);   // POS UPDATES ON EVERY POINTER MOVE, SO COALESCE TO ONE COPY PER FRAME
  }

  function detach() {
    if (observer) observer.disconnect();
    observer = null; src = null; queued = false;
    host.hidden = true;
    host.textContent = '';
  }

  // doc = THE TOOL'S DOCUMENT, selector = ITS FOOTER. RETURNS true IF THE FOOTER WAS FOUND.
  function attach(doc, selector) {
    detach();
    const el = doc && doc.querySelector(selector);
    if (!el) return false;
    src = el;
    observer = new MutationObserver(schedule);
    observer.observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
    host.hidden = false;
    sync();
    return true;
  }

  return { attach, detach };
}
