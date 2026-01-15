/* worlds/monarchWorld/components/confetti.js
   Lightweight confetti burst using <canvas>.
   Usage: confettiBurst();
*/

export function confettiBurst({
  durationMs = 900,
  particleCount = 120
} = {}) {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  function resize() {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }
  resize();

  const W = () => canvas.width;
  const H = () => canvas.height;

  const particles = Array.from({ length: particleCount }).map(() => {
    const x = (Math.random() * W());
    const y = -20 * dpr;
    const vx = (Math.random() - 0.5) * 8 * dpr;
    const vy = (Math.random() * 6 + 6) * dpr;
    const size = (Math.random() * 6 + 4) * dpr;
    const rot = Math.random() * Math.PI;
    const vr = (Math.random() - 0.5) * 0.25;
    return { x, y, vx, vy, size, rot, vr, life: 1 };
  });

  const start = performance.now();

  function tick(now) {
    const t = now - start;
    const progress = Math.min(1, t / durationMs);

    ctx.clearRect(0, 0, W(), H());

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18 * dpr;          // gravity
      p.rot += p.vr;
      p.life = 1 - progress;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, p.life);

      // No fixed colors per your style rule—use random grayscale-ish for subtlety
      const shade = Math.floor(120 + Math.random() * 120);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;

      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    if (progress < 1) requestAnimationFrame(tick);
    else canvas.remove();
  }

  window.addEventListener("resize", resize, { passive: true });
  requestAnimationFrame(tick);
}
