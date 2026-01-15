/* worlds/monarchWorld/components/stepStone.js
   Reusable stepping-stone component for Monarch World map.

   States:
     - "locked"     -> not clickable, shows locked stone
     - "unlocked"   -> clickable, shows unlocked stone
     - "completed"  -> clickable (optional), shows completed stone
*/

const DEFAULTS = {
  width: 170,
  href: "#",
  label: "",
  title: "",
  state: "locked",
  // IMPORTANT: this lets you use the component from different folders
  // Map page (worlds/monarchWorld/monarchWorld.html): assetBase = "./assets"
  // Round page (worlds/monarchWorld/rounds/round1.html): assetBase = "../assets"
  assetBase: "./assets",
  allowCompletedClick: true
};

export function stoneSrc(assetBase, state) {
  const base = (assetBase || "./assets").replace(/\/$/, "");
  if (state === "completed") return `${base}/stepstones/completed.png`;
  if (state === "unlocked") return `${base}/stepstones/unlocked.png`;
  return `${base}/stepstones/locked.png`;
}

/**
 * Create a stepping-stone element.
 * Returns: { root, img, labelEl, setState, setHref, setLabel }
 */
export function createStepStone(options = {}) {
  const cfg = { ...DEFAULTS, ...options };

  const root = document.createElement("a");
  root.className = "mw-stepstone";
  root.href = cfg.href || "#";
  root.setAttribute("aria-label", cfg.label || cfg.title || "Step");
  if (cfg.title) root.title = cfg.title;

  // Image
  const img = document.createElement("img");
  img.className = "mw-stepstone__img";
  img.alt = cfg.label ? `${cfg.label} stepstone` : "Stepstone";
  img.width = cfg.width;
  img.src = stoneSrc(cfg.assetBase, cfg.state);

  // Optional label
  const labelEl = document.createElement("div");
  labelEl.className = "mw-stepstone__label";
  labelEl.textContent = cfg.label || "";
  if (!cfg.label) labelEl.style.display = "none";

  root.appendChild(img);
  root.appendChild(labelEl);

  // Apply initial state behavior
  applyStateBehavior(root, img, cfg);

  // Public API
  function setState(newState) {
    cfg.state = newState;
    img.src = stoneSrc(cfg.assetBase, cfg.state);
    applyStateBehavior(root, img, cfg);
  }

  function setHref(newHref) {
    cfg.href = newHref || "#";
    root.href = cfg.href;
  }

  function setLabel(newLabel) {
    cfg.label = newLabel || "";
    labelEl.textContent = cfg.label;
    labelEl.style.display = cfg.label ? "" : "none";
    root.setAttribute("aria-label", cfg.label || cfg.title || "Step");
  }

  return { root, img, labelEl, setState, setHref, setLabel };
}

/**
 * Convenience function if you already have an <img> element on the page.
 * You can call this to swap its state and set locked styling.
 */
export function setStoneState(imgEl, state, { assetBase = "./assets" } = {}) {
  if (!imgEl) return;
  imgEl.src = stoneSrc(assetBase, state);
  imgEl.dataset.state = state;

  // Optional class hooks for CSS
  imgEl.classList.toggle("is-locked", state === "locked");
  imgEl.classList.toggle("is-unlocked", state === "unlocked");
  imgEl.classList.toggle("is-completed", state === "completed");
}

/* ------------------- internal helpers ------------------- */

function applyStateBehavior(root, img, cfg) {
  const state = cfg.state;

  // dataset hooks for styling
  root.dataset.state = state;
  img.dataset.state = state;

  // Remove any prior state classes
  root.classList.remove("is-locked", "is-unlocked", "is-completed");
  root.classList.add(
    state === "locked" ? "is-locked" :
    state === "completed" ? "is-completed" :
    "is-unlocked"
  );

  // Click behavior
  const clickable =
    state === "unlocked" || (state === "completed" && cfg.allowCompletedClick);

  if (!clickable) {
    // Disable navigation
    root.setAttribute("aria-disabled", "true");
    root.tabIndex = -1;

    // Prevent clicks
    root.addEventListener("click", blockClick, { passive: false });
  } else {
    root.removeAttribute("aria-disabled");
    root.tabIndex = 0;
    root.removeEventListener("click", blockClick);
  }
}

function blockClick(e) {
  e.preventDefault();
  e.stopPropagation();
}
