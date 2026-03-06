// /readathon-world_Ver2/js/staff-home.js
import { auth, getSchoolId, DEFAULT_SCHOOL_ID, userDocRef } from "/readathon-world_Ver2/js/firebase.js";

import {
  ABS,
  guardRoleOrRedirect,
  setHeaderUser,
  wireSignOut,
  loadSummary,
  loadInventory,
  fmtInt,
  fmtMoneyCents,
  showLoading,
  hideLoading,
  normalizeError,
  getEquippedLocal,
  setEquippedLocal,
  pickSlotForItem,
} from "/readathon-world_Ver2/js/app.js";

import { getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  minutesTotal: document.getElementById("minutesTotal"),
  minutesPending: document.getElementById("minutesPending"),
  rubiesBalance: document.getElementById("rubiesBalance"),
  rubiesLifetime: document.getElementById("rubiesLifetime"),
  moneyRaised: document.getElementById("moneyRaised"),

  // Avatar preview UI (already present in staff-home.html)
  roomBgLabel: document.getElementById("roomBgLabel"),
  equipHead: document.getElementById("equipHead"),
  equipBody: document.getElementById("equipBody"),
  equipAcc: document.getElementById("equipAcc"),
  equipPet: document.getElementById("equipPet"),
  inventoryList: document.getElementById("inventoryList"),

  // Award permissions (currently hidden in HTML, but we keep it working)
  awardChips: document.getElementById("awardChips"),

  // (Optional) Avatar World embed modal elements (only if you add them to staff-home.html)
  btnOpenAvatarWorld: document.getElementById("btnOpenAvatarWorld"),
  btnCloseAvatarWorld: document.getElementById("btnCloseAvatarWorld"),
  awEmbedModal: document.getElementById("awEmbedModal"),
  awEmbedFrame: document.getElementById("awEmbedFrame"),
  pageWrap: document.getElementById("pageWrap") || document.querySelector("main.wrap"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("errorBox"),
};

init().catch((e) => showError(normalizeError(e)));

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading staff dashboard…");

  // must be staff
  const claims = await guardRoleOrRedirect(["staff"], ABS.staffLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid;

  setHeaderUser(els.hdr, { title: "Readathon World", subtitle: `${schoolId} • ${userId}` });

  // Load summary + render
  const summary = await loadSummary({ schoolId, userId });
  renderSummary(summary);

  // Load inventory + render Avatar preview chips (if the UI exists on the page)
  if (els.inventoryList) {
    const inv = await loadInventory({ schoolId, userId });
    renderInventory({ schoolId, userId, inv });

    // Render local equipped preview
    renderEquipped({ schoolId, userId });
  }

  // Keep your existing permissions display
  if (els.awardChips) {
    await renderAwardPermissions({ schoolId, userId });
  }

  // Optional: wire Avatar World embed modal if you add the elements
  wireAvatarWorldEmbed({ schoolId });

  hideLoading(els.loadingOverlay);
}

function renderSummary(s) {
  const minutesTotal = s?.minutesTotal ?? 0;
  const pending = s?.minutesPendingTotal ?? 0;
  const rubiesBal = s?.rubiesBalance ?? 0;
  const earned = s?.rubiesLifetimeEarned ?? 0;
  const spent = s?.rubiesLifetimeSpent ?? 0;
  const money = s?.moneyRaisedCents ?? 0;

  if (els.minutesTotal) els.minutesTotal.textContent = fmtInt(minutesTotal);
  if (els.minutesPending) els.minutesPending.textContent = fmtInt(pending);
  if (els.rubiesBalance) els.rubiesBalance.textContent = fmtInt(rubiesBal);
  if (els.rubiesLifetime) els.rubiesLifetime.textContent = `Earned: ${fmtInt(earned)} • Spent: ${fmtInt(spent)}`;
  if (els.moneyRaised) els.moneyRaised.textContent = fmtMoneyCents(money);
}

/* ------------------------------
   Avatar Preview (local equip)
------------------------------ */

function renderInventory({ schoolId, userId, inv }) {
  if (!els.inventoryList) return;

  els.inventoryList.innerHTML = "";

  if (!inv || !inv.length) {
    const empty = document.createElement("div");
    empty.className = "emptyNote";
    empty.textContent = "No items yet. Earn rubies to buy avatar items!";
    els.inventoryList.appendChild(empty);
    return;
  }

  // Only show items with qty > 0
  const items = inv.filter((x) => Number(x.qty || 0) > 0);

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "emptyNote";
    empty.textContent = "No items yet. Earn rubies to buy avatar items!";
    els.inventoryList.appendChild(empty);
    return;
  }

  for (const it of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "invChip";

    const name = prettyItemId(it.itemId);
    btn.innerHTML = `<span class="invChip__name">${name}</span><span class="invChip__qty">x${Number(it.qty || 0)}</span>`;

    btn.addEventListener("click", () => {
      const equipped = getEquippedLocal({ schoolId, userId });
      const slot = pickSlotForItem(it.itemId);

      // Toggle off if already equipped
      if (equipped[slot] === it.itemId) equipped[slot] = null;
      else equipped[slot] = it.itemId;

      setEquippedLocal({ schoolId, userId }, equipped);
      renderEquipped({ schoolId, userId });
    });

    els.inventoryList.appendChild(btn);
  }
}

function renderEquipped({ schoolId, userId }) {
  if (!els.roomBgLabel) return;

  const eq = getEquippedLocal({ schoolId, userId });

  if (els.roomBgLabel) els.roomBgLabel.textContent = `Room: ${eq.room ? prettyItemId(eq.room) : "(none)"}`;
  if (els.equipHead) els.equipHead.textContent = `Head: ${eq.head ? prettyItemId(eq.head) : "(none)"}`;
  if (els.equipBody) els.equipBody.textContent = `Body: ${eq.body ? prettyItemId(eq.body) : "(none)"}`;
  if (els.equipAcc) els.equipAcc.textContent = `Accessory: ${eq.accessory ? prettyItemId(eq.accessory) : "(none)"}`;
  if (els.equipPet) els.equipPet.textContent = `Pet: ${eq.pet ? prettyItemId(eq.pet) : "(none)"}`;
}

function prettyItemId(itemId) {
  // item_cool_hat -> "Cool Hat"
  return String(itemId || "")
    .replace(/^item_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/* ------------------------------
   Award Permissions (existing)
------------------------------ */

async function renderAwardPermissions({ schoolId, userId }) {
  if (!els.awardChips) return;

  els.awardChips.innerHTML = "";

  const uref = userDocRef(schoolId, userId);
  const snap = await getDoc(uref);

  const can = snap.exists() ? snap.data()?.canAwardHomerooms : null;

  if (!can) {
    addChip("None set (ask admin)");
    return;
  }

  // Can be "ALL" OR array
  if (typeof can === "string" && can.toUpperCase() === "ALL") {
    addChip("ALL");
    return;
  }

  if (Array.isArray(can) && can.length) {
    for (const hr of can) addChip(prettyHomeroom(hr));
    return;
  }

  addChip("None set (ask admin)");
}

function addChip(text) {
  if (!els.awardChips) return;
  const span = document.createElement("span");
  span.className = "chip chip--static";
  span.textContent = text;
  els.awardChips.appendChild(span);
}

function prettyHomeroom(homeroomId) {
  if (!homeroomId) return "";
  return homeroomId.startsWith("hr_")
    ? homeroomId.replace("hr_", "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : String(homeroomId);
}

/* ------------------------------
   Optional: Avatar World embed modal
   (Only works if you add the modal HTML)
------------------------------ */

function wireAvatarWorldEmbed({ schoolId }) {
  if (!els.btnOpenAvatarWorld || !els.awEmbedModal || !els.awEmbedFrame || !els.btnCloseAvatarWorld) return;

  const openBtn = els.btnOpenAvatarWorld;
  const modal = els.awEmbedModal;
  const frame = els.awEmbedFrame;
  const closeBtn = els.btnCloseAvatarWorld;
  const wrap = els.pageWrap;

  const SRC = `/readathon-world_Ver2/html/avatar-world.html?embed=1&from=staff&schoolId=${encodeURIComponent(
    schoolId || ""
  )}`;

  let lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;

    // Show modal (DON'T leave aria-hidden=true while focus is inside)
    modal.classList.remove("isHidden");
    modal.setAttribute("aria-hidden", "false");

    // Prevent background focus/scroll (best-effort without relying on browser inert support)
    if (wrap) wrap.setAttribute("inert", "");
    document.body.style.overflow = "hidden";

    // Load iframe
    frame.src = SRC;

    // Move focus into modal
    closeBtn.focus();
  }

  function closeModal() {
    // Move focus OUT of modal before hiding it (prevents the aria-hidden warning)
    if (openBtn) openBtn.focus();

    // Hide modal
    modal.classList.add("isHidden");
    modal.setAttribute("aria-hidden", "true");

    // Re-enable background
    if (wrap) wrap.removeAttribute("inert");
    document.body.style.overflow = "";

    // Optional: stop iframe work
    frame.src = "about:blank";

    // Restore focus (if possible)
    if (lastFocus && typeof lastFocus.focus === "function") {
      try {
        lastFocus.focus();
      } catch (_) {}
    }
  }

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);

  // Click outside card closes (only if your modal uses backdrop click)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("isHidden")) {
      closeModal();
    }
  });
}

/* ------------------------------ */

function showError(msg) {
  if (!els.errorBox) return;
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}