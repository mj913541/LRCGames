// /readathon-world_Ver2/js/avatar-world.js
import { auth, getSchoolId, DEFAULT_SCHOOL_ID } from "/readathon-world_Ver2/js/firebase.js";
import {
  ABS,
  guardRoleOrRedirect,
  loadSummary,
  loadInventory,
  fmtInt,
  normalizeError,
} from "/readathon-world_Ver2/js/app.js";

const els = {
  btnBack: document.getElementById("btnBack"),
  btnShop: document.getElementById("btnShop"),
  btnInv: document.getElementById("btnInv"),
  btnDebug: document.getElementById("btnDebug"),

  awSubtitle: document.getElementById("awSubtitle"),
  rubiesBalance: document.getElementById("rubiesBalance"),

  invDrawer: document.getElementById("invDrawer"),
  btnInvClose: document.getElementById("btnInvClose"),

  shopModal: document.getElementById("shopModal"),
  btnShopClose: document.getElementById("btnShopClose"),
  shopGrid: document.getElementById("shopGrid"),

  toast: document.getElementById("toast"),

  // Inventory panels (we’ll fill these in later steps)
  panelWear: document.getElementById("panelWear"),
  panelPets: document.getElementById("panelPets"),
  panelWall: document.getElementById("panelWall"),
  panelFloor: document.getElementById("panelFloor"),
};

const tabs = Array.from(document.querySelectorAll(".tab"));

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("on");
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => els.toast.classList.remove("on"), 1600);
}

function openDrawer() {
  els.invDrawer.setAttribute("aria-hidden", "false");
  els.btnInv.setAttribute("aria-expanded", "true");
}
function closeDrawer() {
  els.invDrawer.setAttribute("aria-hidden", "true");
  els.btnInv.setAttribute("aria-expanded", "false");
}

function openShop() {
  els.shopModal.setAttribute("aria-hidden", "false");
}
function closeShop() {
  els.shopModal.setAttribute("aria-hidden", "true");
}

function setTab(tabName) {
  tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === tabName)));
  const panels = [els.panelWear, els.panelPets, els.panelWall, els.panelFloor];
  for (const p of panels) {
    p.classList.toggle("isHidden", p.dataset.panel !== tabName);
  }
}

function renderSummaryIntoTopbar(summary) {
  const rubiesBal = summary?.rubiesBalance ?? 0;
  els.rubiesBalance.textContent = fmtInt(rubiesBal);
}

function renderInventoryDebug(inv) {
  // Step 5 is intentionally simple: just confirm inventory is loading.
  // We’ll build the real grouped inventory + equip/place UI in later steps.
  const owned = (inv || []).filter((x) => Number(x.qty || 0) > 0);

  els.panelWear.innerHTML = "";
  const box = document.createElement("div");
  box.className = "ph";
  box.style.gridColumn = "1 / -1";
  box.textContent = owned.length
    ? `Loaded ${owned.length} inventory item(s). Next step: render chips/cards by category.`
    : "No items yet. (This matches your student-home behavior.)";
  els.panelWear.appendChild(box);

  // keep other panels empty for now
  els.panelPets.innerHTML = "";
  els.panelWall.innerHTML = "";
  els.panelFloor.innerHTML = "";
}

function wireUI() {
  els.btnBack.addEventListener("click", () => (window.location.href = ABS.studentHome));

  els.btnInv.addEventListener("click", () => {
    const open = els.invDrawer.getAttribute("aria-hidden") === "false";
    if (open) closeDrawer();
    else openDrawer();
  });
  els.btnInvClose.addEventListener("click", closeDrawer);

  els.btnShop.addEventListener("click", openShop);
  els.btnShopClose.addEventListener("click", closeShop);

  els.shopModal.addEventListener("click", (e) => {
    if (e.target === els.shopModal) closeShop();
  });

  tabs.forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));

  els.btnDebug.addEventListener("click", () => {
    const on = document.body.classList.toggle("debugOn");
    els.btnDebug.setAttribute("aria-pressed", String(on));
    toast(on ? "Debug ON (zone outlines)" : "Debug OFF");
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (els.shopModal.getAttribute("aria-hidden") === "false") closeShop();
      if (els.invDrawer.getAttribute("aria-hidden") === "false") closeDrawer();
    }
  });
}

async function init() {
  wireUI();

  // Guard: allow any signed-in role (student/staff/admin)
  // We can tighten later, but Avatar World should work for everyone.
  const claims = await guardRoleOrRedirect(["student", "staff", "admin"], ABS.index);
  if (!claims) return;

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid;

  els.awSubtitle.textContent = `${schoolId} • ${userId}`;

  // Load summary + inventory using your EXISTING loaders (Step 1 confirmed paths)
  const summary = await loadSummary({ schoolId, userId });
  renderSummaryIntoTopbar(summary);

  const inv = await loadInventory({ schoolId, userId });
  renderInventoryDebug(inv);

  toast("Avatar World loaded! ✅ (Next step: render room + equip/place)");
}

init().catch((e) => {
  console.error(e);
  toast(normalizeError(e));
});
