// /readathon-world_Ver2/js/admin-home.js
import { auth, getSchoolId, DEFAULT_SCHOOL_ID } from "/readathon-world_Ver2/js/firebase.js";
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

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  minutesTotal: document.getElementById("minutesTotal"),
  minutesPending: document.getElementById("minutesPending"),
  rubiesBalance: document.getElementById("rubiesBalance"),
  rubiesLifetime: document.getElementById("rubiesLifetime"),
  moneyRaised: document.getElementById("moneyRaised"),

  roomBgLabel: document.getElementById("roomBgLabel"),
  equipHead: document.getElementById("equipHead"),
  equipBody: document.getElementById("equipBody"),
  equipAcc: document.getElementById("equipAcc"),
  equipPet: document.getElementById("equipPet"),
  inventoryList: document.getElementById("inventoryList"),

  // embed modal
  btnOpenAvatarWorld: document.getElementById("btnOpenAvatarWorld"),
  awEmbedModal: document.getElementById("awEmbedModal"),
  btnCloseAvatarWorld: document.getElementById("btnCloseAvatarWorld"),
  awEmbedFrame: document.getElementById("awEmbedFrame"),
  pageWrap: document.getElementById("pageWrap"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("errorBox"),
};

init().catch((e) => showError(normalizeError(e)));

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading admin dashboard…");

  const claims = await guardRoleOrRedirect(["admin"], ABS.adminLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);
  wireAvatarWorldEmbed();

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid;

  setHeaderUser(els.hdr, { title: "Readathon World", subtitle: `${schoolId} • ${userId}` });

  const summary = await loadSummary({ schoolId, userId });
  renderSummary(summary);

  const inv = await loadInventory({ schoolId, userId });
  renderInventory({ schoolId, userId, inv });
  renderEquipped({ schoolId, userId });

  hideLoading(els.loadingOverlay);
}

function wireAvatarWorldEmbed() {
  if (!els.btnOpenAvatarWorld || !els.awEmbedModal || !els.btnCloseAvatarWorld || !els.awEmbedFrame) return;

  let lastFocus = null;

  const open = () => {
    lastFocus = document.activeElement;

    els.awEmbedModal.classList.remove("isHidden");
    els.awEmbedModal.setAttribute("aria-hidden", "false");

    if (els.pageWrap) els.pageWrap.setAttribute("inert", "");
    document.body.style.overflow = "hidden";

    // Refresh iframe (dev-friendly)
    els.awEmbedFrame.src = "/readathon-world_Ver2/html/avatar-world.html?embed=1&from=admin";

    requestAnimationFrame(() => els.btnCloseAvatarWorld.focus());
  };

  const close = () => {
    // Move focus OUT before hiding (prevents aria-hidden warning)
    if (els.btnOpenAvatarWorld) els.btnOpenAvatarWorld.focus();

    els.awEmbedModal.classList.add("isHidden");
    els.awEmbedModal.setAttribute("aria-hidden", "true");

    if (els.pageWrap) els.pageWrap.removeAttribute("inert");
    document.body.style.overflow = "";

    // Optional: stop iframe activity
    // els.awEmbedFrame.src = "about:blank";

    // Restore last focus if possible
    if (lastFocus && typeof lastFocus.focus === "function") {
      try { lastFocus.focus(); } catch (_) {}
    }
  };

  els.btnOpenAvatarWorld.addEventListener("click", open);
  els.btnCloseAvatarWorld.addEventListener("click", close);

  // click backdrop closes
  els.awEmbedModal.addEventListener("click", (e) => {
    if (e.target === els.awEmbedModal) close();
  });

  // ESC closes
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.awEmbedModal.getAttribute("aria-hidden") === "false") close();
  });

  // If avatar-world.js sends a close message
  window.addEventListener("message", (e) => {
    if (e.origin !== window.location.origin) return;
    if (e.data?.type === "aw_close") close();
  });
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

function renderInventory({ schoolId, userId, inv }) {
  if (!els.inventoryList) return;

  els.inventoryList.innerHTML = "";

  const items = (inv || []).filter((x) => Number(x.qty || 0) > 0);

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
  return String(itemId || "")
    .replace(/^item_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function showError(msg) {
  if (!els.errorBox) return;
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}