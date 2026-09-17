// Transient motion is deliberately separate from saved artist settings.
export class InspectionMotion {
  constructor(settings) {
    this.settings = settings;
    this.reset();
  }

  reset() {
    this.pointer = {x: 0, y: 0};
    this.inside = false;
    this.held = false;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.moving = false;
    this.lastTime = null;
  }

  point(x, y) {
    this.inside = true;
    this.pointer.x = Math.max(-1, Math.min(1, x));
    this.pointer.y = Math.max(-1, Math.min(1, y));
  }

  leave() {
    this.inside = false;
    this.held = false;
  }

  step(time) {
    const dt = this.lastTime === null ? 1 / 60 : Math.min(.064, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    const active = this.settings.interactive && this.settings.viewMode !== 'walk' && this.inside;
    const target = {
      x: active ? this.pointer.x * this.settings.parallax : 0,
      y: active ? this.pointer.y * this.settings.parallax * 9 / 16 : 0,
      zoom: this.settings.interactive && this.settings.viewMode !== 'walk' && this.held ? this.settings.inspectZoom : 1,
    };
    const alpha = this.settings.response <= 0 ? 1 : 1 - Math.exp(-dt / this.settings.response);
    let changed = false;
    this.moving = false;
    for (const key of ['x', 'y', 'zoom']) {
      const before = this[key];
      this[key] += (target[key] - before) * alpha;
      if (Math.abs(target[key] - this[key]) < .0001) this[key] = target[key];
      else this.moving = true;
      changed ||= this[key] !== before;
    }
    return changed;
  }

  snapshot() {
    return {x: this.x, y: this.y, zoom: this.zoom, held: this.held, inside: this.inside, moving: this.moving};
  }
}

export function bindInspection(canvas, motion, requestRender, win = window, doc = document) {
  let pointerId = null;
  const enabled = () => motion.settings.interactive && motion.settings.viewMode !== 'walk';
  const appearance = () => {
    canvas.classList.toggle('interactive', enabled());
    canvas.classList.toggle('inspecting', enabled() && motion.held);
  };
  const release = () => {
    const previous = pointerId;
    pointerId = null;
    if (previous !== null && canvas.hasPointerCapture(previous)) canvas.releasePointerCapture(previous);
  };
  const cancel = () => { release(); motion.leave(); appearance(); requestRender(); };
  const point = event => {
    const r = canvas.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) {
      cancel();
      return false;
    }
    motion.point((event.clientX - r.left) / r.width * 2 - 1, 1 - (event.clientY - r.top) / r.height * 2);
    return true;
  };
  canvas.addEventListener('pointermove', event => {
    if (!enabled() || event.isPrimary === false || (event.pointerType === 'touch' && pointerId !== event.pointerId)) return;
    if (pointerId !== null && pointerId !== event.pointerId) return;
    if (pointerId !== null && motion.held && event.pointerType !== 'touch' && event.buttons === 0) { release(); motion.held = false; }
    point(event); appearance(); requestRender();
  });
  canvas.addEventListener('pointerdown', event => {
    if (!enabled() || event.isPrimary === false || event.button !== 0 || pointerId !== null) return;
    event.preventDefault();
    canvas.classList.toggle('pointer-focused', true);
    canvas.focus({preventScroll: true});
    if (!point(event)) return;
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    motion.held = true;
    appearance(); requestRender();
  });
  canvas.addEventListener('pointerup', event => {
    if (pointerId !== event.pointerId) return;
    release(); motion.held = false;
    if (event.pointerType === 'touch') motion.leave();
    else point(event);
    appearance(); requestRender();
  });
  const cancelPointer = event => { if (event.isPrimary !== false && (pointerId === null || event.pointerId === pointerId)) cancel(); };
  canvas.addEventListener('pointerleave', cancelPointer);
  canvas.addEventListener('pointercancel', cancelPointer);
  canvas.addEventListener('lostpointercapture', event => { if (pointerId !== null && event.pointerId === pointerId) cancel(); });
  canvas.addEventListener('blur', cancel);
  win.addEventListener('blur', cancel);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) cancel(); });
  canvas.addEventListener('keydown', event => {
    canvas.classList.toggle('pointer-focused', false);
    if (event.code === 'Escape') cancel();
    if (event.code === 'Space' && enabled()) { event.preventDefault(); motion.held = true; appearance(); requestRender(); }
  });
  canvas.addEventListener('keyup', event => {
    if (event.code === 'Space') { event.preventDefault(); motion.held = false; appearance(); requestRender(); }
  });
  appearance();
  return {cancel, refresh() { if (!enabled()) cancel(); appearance(); }};
}
