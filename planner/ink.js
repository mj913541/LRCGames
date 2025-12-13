/* planner/ink.js
   Apple Pencil / touch ink overlay saved as strokes JSON (normalized coordinates).
   Mixed mode (typed + pencil): we only capture ink when Ink is enabled/toggled ON,
   otherwise the canvas is "pass-through" (pointer-events: none).

   Depends on:
     - window.PlannerApp (app.js)

   Exposes:
     window.PlannerInk.mountDaily({ wrapId, canvasId, toolbarId, dateISO })
     window.PlannerInk.mountWeekly({ wrapId, canvasId, toolbarId, wkKey })
     window.PlannerInk.setEnabled(true/false)
*/

(() => {
  const Ink = {
    enabled: false,        // capture strokes?
    mode: "pen",           // pen | eraser
    penWidth: 3,
    eraserWidth: 18,
    color: "#111827",

    active: null,          // current mount target descriptor
    ctx: null,
    canvas: null,
    dpr: 1,

    strokes: [],           // current strokes for active canvas
    undoStack: [],

    /* ---------- Public ---------- */
    setEnabled(on) {
      Ink.enabled = !!on;
      if (Ink.canvas) {
        Ink.canvas.style.pointerEvents = Ink.enabled ? "auto" : "none";
      }
    },

    mountDaily({ wrapId, canvasId, toolbarId, dateISO }) {
      const wrap = document.getElementById(wrapId);
      if (!wrap) return;

      // If already mounted for same target, just refresh size
      if (Ink.active?.type === "daily" && Ink.active?.key === dateISO) {
        ensureCanvas(wrap, canvasId);
        mountToolbar(toolbarId);
        resizeCanvasToWrap();
        redraw();
        return;
      }

      Ink.active = { type: "daily", key: dateISO, wrapId, canvasId, toolbarId };
      ensureCanvas(wrap, canvasId);
      mountToolbar(toolbarId);

      // Load strokes from state
      const layer = PlannerApp.getInkDaily(dateISO);
      Ink.strokes = Array.isArray(layer.strokes) ? layer.strokes : [];
      Ink.undoStack = [];

      resizeCanvasToWrap();
      bindPointerEvents();
      redraw();

      // By default: OFF (so typing/tapping works)
      Ink.setEnabled(false);
    },

    mountWeekly({ wrapId, canvasId, toolbarId, wkKey }) {
      const wrap = document.getElementById(wrapId);
      if (!wrap) return;

      if (Ink.active?.type === "weekly" && Ink.active?.key === wkKey) {
        ensureCanvas(wrap, canvasId);
        mountToolbar(toolbarId);
        resizeCanvasToWrap();
        redraw();
        return;
      }

      Ink.active = { type: "weekly", key: wkKey, wrapId, canvasId, toolbarId };
      ensureCanvas(wrap, canvasId);
      mountToolbar(toolbarId);

      const layer = PlannerApp.getInkWeekly(wkKey);
      Ink.strokes = Array.isArray(layer.strokes) ? layer.strokes : [];
      Ink.undoStack = [];

      resizeCanvasToWrap();
      bindPointerEvents();
      redraw();

      Ink.setEnabled(false);
    }
  };

  window.PlannerInk = Ink;

  /* =========================================================
     Canvas creation and sizing
     ========================================================= */

  function ensureCanvas(wrap, canvasId) {
    let canvas = document.getElementById(canvasId);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = canvasId;
      canvas.className = "inkCanvas";
      wrap.appendChild(canvas);
    }
    Ink.canvas = canvas;
    Ink.ctx = canvas.getContext("2d", { desynchronized: true });
    Ink.canvas.style.pointerEvents = Ink.enabled ? "auto" : "none";

    // Keep canvas on top visually, but allow pointer events only when enabled
    Ink.canvas.style.touchAction = "none"; // essential for Pencil drawing
  }

  function resizeCanvasToWrap() {
    const wrap = document.getElementById(Ink.active?.wrapId);
    if (!wrap || !Ink.canvas) return;

    const rect = wrap.getBoundingClientRect();
    const w = Math.max(10, Math.floor(rect.width));
    const h = Math.max(10, Math.floor(rect.height));

    Ink.dpr = window.devicePixelRatio || 1;
    Ink.canvas.width = Math.floor(w * Ink.dpr);
    Ink.canvas.height = Math.floor(h * Ink.dpr);
    Ink.canvas.style.width = w + "px";
    Ink.canvas.style.height = h + "px";

    Ink.ctx.setTransform(Ink.dpr, 0, 0, Ink.dpr, 0, 0);
    redraw();
  }

  // Resize on window changes (orientation changes on iPad, etc.)
  window.addEventListener("resize", () => {
    // Only resize if a canvas exists
    if (Ink.canvas && Ink.active) resizeCanvasToWrap();
  });

  /* =========================================================
     Toolbar
     ========================================================= */

  function mountToolbar(toolbarId) {
    const bar = document.getElementById(toolbarId);
    if (!bar) return;

    // Avoid duplicating toolbar if it already exists
    if (bar.dataset.mounted === "1") return;
    bar.dataset.mounted = "1";

    bar.classList.add("inkToolbar");

    bar.innerHTML = `
      <button class="btn" id="${toolbarId}_pen">Pen</button>
      <button class="btn" id="${toolbarId}_eraser">Eraser</button>
      <button class="btn" id="${toolbarId}_undo">Undo</button>
      <button class="btn" id="${toolbarId}_clear">Clear</button>
    `;

    document.getElementById(`${toolbarId}_pen`)?.addEventListener("click", () => {
      Ink.mode = "pen";
      syncToolbarActive(toolbarId);
    });

    document.getElementById(`${toolbarId}_eraser`)?.addEventListener("click", () => {
      Ink.mode = "eraser";
      syncToolbarActive(toolbarId);
    });

    document.getElementById(`${toolbarId}_undo`)?.addEventListener("click", async () => {
      if (Ink.strokes.length === 0) return;
      const popped = Ink.strokes.pop();
      Ink.undoStack.push(popped);
      await persist();
      redraw();
    });

    document.getElementById(`${toolbarId}_clear`)?.addEventListener("click", async () => {
      if (!confirm("Clear ink for this page?")) return;
      Ink.strokes = [];
      Ink.undoStack = [];
      await persist();
      redraw();
    });

    syncToolbarActive(toolbarId);
  }

  function syncToolbarActive(toolbarId) {
    const pen = document.getElementById(`${toolbarId}_pen`);
    const er = document.getElementById(`${toolbarId}_eraser`);
    if (!pen || !er) return;

    pen.classList.toggle("primary", Ink.mode === "pen");
    er.classList.toggle("primary", Ink.mode === "eraser");
  }

  /* =========================================================
     Pointer capture drawing
     ========================================================= */

  let drawing = false;
  let currentStroke = null;

  function bindPointerEvents() {
    if (!Ink.canvas) return;

    // Remove old listeners (simple approach: replace canvas node)
    // But we used ensureCanvas() that may reuse the same canvas;
    // so we guard by setting a mounted flag.
    if (Ink.canvas.dataset.bound === "1") return;
    Ink.canvas.dataset.bound = "1";

    Ink.canvas.addEventListener("pointerdown", onDown);
    Ink.canvas.addEventListener("pointermove", onMove);
    Ink.canvas.addEventListener("pointerup", onUp);
    Ink.canvas.addEventListener("pointercancel", onUp);
    Ink.canvas.addEventListener("pointerleave", onUp);
  }

  function onDown(e) {
    if (!Ink.enabled) return; // mixed mode: ignore unless toggled on
    if (!Ink.canvas) return;

    // Prefer Pencil, but allow finger if desired
    // iOS reports "pen" for Pencil.
    // If you ever want "pen-only", we can enforce it here.
    drawing = true;

    const pt = getPoint(e);
    currentStroke = newStroke();
    currentStroke.points.push(pt);
    Ink.strokes.push(currentStroke);

    try { Ink.canvas.setPointerCapture(e.pointerId); } catch {}
    redraw();
  }

  function onMove(e) {
    if (!drawing || !Ink.enabled) return;
    if (!currentStroke) return;

    const pt = getPoint(e);
    currentStroke.points.push(pt);

    // Incremental draw for smoother feel
    drawLastSegment(currentStroke);
  }

  async function onUp(e) {
    if (!drawing) return;
    drawing = false;

    try { Ink.canvas.releasePointerCapture(e.pointerId); } catch {}

    // If eraser mode: perform hit-testing erase after stroke is finished
    if (currentStroke?.tool === "eraser") {
      eraseByPath(currentStroke.points);
      // Remove the eraser stroke itself (we don't store it)
      Ink.strokes = Ink.strokes.filter(s => s !== currentStroke);
    }

    currentStroke = null;
    await persist();
    redraw();
  }

  function newStroke() {
    const tool = Ink.mode;
    return {
      id: randId(),
      tool,
      color: Ink.color,
      width: tool === "pen" ? Ink.penWidth : Ink.eraserWidth,
      // points in NORMALIZED coordinates (0..1) relative to wrap
      points: []
    };
  }

  function getPoint(e) {
    const wrap = document.getElementById(Ink.active?.wrapId);
    const rect = wrap.getBoundingClientRect();

    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    const t = Date.now();

    // Pressure support if available
    const p = typeof e.pressure === "number" ? e.pressure : 0.5;

    return { x, y, t, p };
  }

  /* =========================================================
     Drawing
     ========================================================= */

  function redraw() {
    if (!Ink.ctx || !Ink.canvas) return;

    const wrap = document.getElementById(Ink.active?.wrapId);
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();

    const w = rect.width;
    const h = rect.height;

    Ink.ctx.clearRect(0, 0, w, h);

    // Subtle background grid? (very light)
    drawLightGrid(w, h);

    for (const stroke of Ink.strokes) {
      if (!stroke.points?.length) continue;
      if (stroke.tool !== "pen") continue;

      Ink.ctx.save();
      Ink.ctx.lineJoin = "round";
      Ink.ctx.lineCap = "round";
      Ink.ctx.strokeStyle = stroke.color || "#111827";
      Ink.ctx.lineWidth = stroke.width || 3;

      Ink.ctx.beginPath();
      const p0 = denorm(stroke.points[0], w, h);
      Ink.ctx.moveTo(p0.x, p0.y);

      for (let i = 1; i < stroke.points.length; i++) {
        const pi = denorm(stroke.points[i], w, h);
        Ink.ctx.lineTo(pi.x, pi.y);
      }
      Ink.ctx.stroke();
      Ink.ctx.restore();
    }
  }

  function drawLastSegment(stroke) {
    // Draw only the last segment for smoother performance
    if (!Ink.ctx || !Ink.canvas) return;
    if (stroke.tool !== "pen") return;
    if (!stroke.points || stroke.points.length < 2) return;

    const wrap = document.getElementById(Ink.active?.wrapId);
    const rect = wrap.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const a = denorm(stroke.points[stroke.points.length - 2], w, h);
    const b = denorm(stroke.points[stroke.points.length - 1], w, h);

    Ink.ctx.save();
    Ink.ctx.lineJoin = "round";
    Ink.ctx.lineCap = "round";
    Ink.ctx.strokeStyle = stroke.color || "#111827";
    Ink.ctx.lineWidth = stroke.width || 3;

    Ink.ctx.beginPath();
    Ink.ctx.moveTo(a.x, a.y);
    Ink.ctx.lineTo(b.x, b.y);
    Ink.ctx.stroke();
    Ink.ctx.restore();
  }

  function drawLightGrid(w, h) {
    // VERY faint notebook grid
    Ink.ctx.save();
    Ink.ctx.globalAlpha = 0.06;
    Ink.ctx.strokeStyle = "#111827";
    Ink.ctx.lineWidth = 1;

    const step = 32; // visual spacing
    for (let x = 0; x <= w; x += step) {
      Ink.ctx.beginPath();
      Ink.ctx.moveTo(x, 0);
      Ink.ctx.lineTo(x, h);
      Ink.ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      Ink.ctx.beginPath();
      Ink.ctx.moveTo(0, y);
      Ink.ctx.lineTo(w, y);
      Ink.ctx.stroke();
    }
    Ink.ctx.restore();
  }

  function denorm(p, w, h) {
    return { x: p.x * w, y: p.y * h };
  }

  /* =========================================================
     Eraser: hit-test strokes by distance-to-segment
     ========================================================= */

  function eraseByPath(pointsNorm) {
    const wrap = document.getElementById(Ink.active?.wrapId);
    const rect = wrap.getBoundingClientRect();
    const w = rect.width, h = rect.height;

    const path = pointsNorm.map(p => denorm(p, w, h));
    const radius = Ink.eraserWidth;

    Ink.strokes = Ink.strokes.filter(stroke => {
      if (stroke.tool !== "pen" || !stroke.points?.length) return true;
      const pts = stroke.points.map(p => denorm(p, w, h));
      return !strokeIntersectsPath(pts, path, radius);
    });
  }

  function strokeIntersectsPath(strokePts, pathPts, radius) {
    // Check each segment of stroke against each point in eraser path
    // (fast-enough for planner usage)
    for (let i = 1; i < strokePts.length; i++) {
      const a = strokePts[i - 1];
      const b = strokePts[i];
      for (const p of pathPts) {
        const d = distPointToSeg(p, a, b);
        if (d <= radius) return true;
      }
    }
    return false;
  }

  function distPointToSeg(p, a, b) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = p.x - a.x;
    const wy = p.y - a.y;

    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);

    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);

    const t = c1 / c2;
    const px = a.x + t * vx;
    const py = a.y + t * vy;
    return Math.hypot(p.x - px, p.y - py);
  }

  /* =========================================================
     Persist strokes to PlannerApp state
     ========================================================= */

  async function persist() {
    if (!Ink.active) return;
    if (Ink.active.type === "daily") {
      PlannerApp.setInkDaily(Ink.active.key, Ink.strokes);
    } else if (Ink.active.type === "weekly") {
      PlannerApp.setInkWeekly(Ink.active.key, Ink.strokes);
    }
    await PlannerApp.saveNow();
  }

  function clamp01(n) { return Math.max(0, Math.min(1, n)); }
  function randId() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
})();
