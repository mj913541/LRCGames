// /readathon-world_Ver2/js/staff-home.js

import {
  auth,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  userDocRef,
} from "./firebase.js";

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
} from "./app.js";

import { mountAvatarWorldWidget } from "./avatar-world-widget.js";
import { renderLeaderboard } from "./leaderboard.js";

import { getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  minutesTotal: document.getElementById("minutesTotal"),
  minutesPending: document.getElementById("minutesPending"),
  rubiesBalance: document.getElementById("rubiesBalance"),
  rubiesLifetime: document.getElementById("rubiesLifetime"),
  moneyRaised: document.getElementById("moneyRaised"),

  inventoryList: document.getElementById("inventoryList"),
  awardChips: document.getElementById("awardChips"),

  // Optional Avatar World embed modal elements
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

  const claims = await guardRoleOrRedirect(["staff"], ABS.staffLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid;

  setHeaderUser(els.hdr, {
    title: "Readathon World",
    subtitle: `${schoolId} • ${userId}`,
  });

  const summary = await loadSummary({ schoolId, userId });
  renderSummary(summary);

  const inv = await loadInventory({ schoolId, userId });
  renderInventory(inv);

  await renderAwardPermissions({ schoolId, userId });

  await mountAvatarWorldWidget({
    mountEl: "#avatarWorldMount",
    role: "staff",
    schoolId,
    userId,
    openUrl: "../html/avatar-world.html",
  });

  await renderLeaderboard("leaderboardMount");

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
  if (els.rubiesLifetime) {
    els.rubiesLifetime.textContent = `Earned: ${fmtInt(earned)} • Spent: ${fmtInt(spent)}`;
  }
  if (els.moneyRaised) els.moneyRaised.textContent = fmtMoneyCents(money);
}

function renderInventory(inv) {
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
    const row = document.createElement("div");
    row.className = "invChip";

    const name = prettyItemId(it.itemId);
    row.innerHTML = `
      <span class="invChip__name">${escapeHtml(name)}</span>
      <span class="invChip__qty">x${Number(it.qty || 0)}</span>
    `;

    els.inventoryList.appendChild(row);
  }
}

function prettyItemId(itemId) {
  return String(itemId || "")
    .replace(/^item_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/* ------------------------------
   Award Permissions
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
    ? homeroomId
        .replace("hr_", "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase())
    : String(homeroomId);
}

/* ------------------------------
   Optional Avatar World embed modal
------------------------------ */

function wireAvatarWorldEmbed({ schoolId }) {
  if (!els.btnOpenAvatarWorld || !els.awEmbedModal || !els.awEmbedFrame || !els.btnCloseAvatarWorld) {
    return;
  }

  const openBtn = els.btnOpenAvatarWorld;
  const modal = els.awEmbedModal;
  const frame = els.awEmbedFrame;
  const closeBtn = els.btnCloseAvatarWorld;
  const wrap = els.pageWrap;

  const src = `../html/avatar-world.html?embed=1&from=staff&schoolId=${encodeURIComponent(
    schoolId || ""
  )}`;

  let lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;

    modal.classList.remove("isHidden");
    modal.setAttribute("aria-hidden", "false");

    if (wrap) wrap.setAttribute("inert", "");
    document.body.style.overflow = "hidden";

    frame.src = src;
    closeBtn.focus();
  }

  function closeModal() {
    if (openBtn) openBtn.focus();

    modal.classList.add("isHidden");
    modal.setAttribute("aria-hidden", "true");

    if (wrap) wrap.removeAttribute("inert");
    document.body.style.overflow = "";

    frame.src = "about:blank";

    if (lastFocus && typeof lastFocus.focus === "function") {
      try {
        lastFocus.focus();
      } catch {}
    }
  }

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("isHidden")) {
      closeModal();
    }
  });
}

/* ------------------------------ */

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showError(msg) {
  if (!els.errorBox) return;
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}