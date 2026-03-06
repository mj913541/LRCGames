// /readathon-world_Ver2/js/student-home.js

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
} from "/readathon-world_Ver2/js/app.js";

import { mountAvatarWorldWidget } from "/readathon-world_Ver2/js/avatar-world-widget.js";

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  minutesTotal: document.getElementById("minutesTotal"),
  minutesPending: document.getElementById("minutesPending"),
  rubiesBalance: document.getElementById("rubiesBalance"),
  rubiesLifetime: document.getElementById("rubiesLifetime"),
  moneyRaised: document.getElementById("moneyRaised"),

  inventoryList: document.getElementById("inventoryList"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("errorBox"),

  // Avatar World embed (modal + iframe)
  btnOpenAvatarWorld: document.getElementById("btnOpenAvatarWorld"),
  awEmbedModal: document.getElementById("awEmbedModal"),
  btnCloseAvatarWorld: document.getElementById("btnCloseAvatarWorld"),
  awEmbedFrame: document.getElementById("awEmbedFrame"),
};

init().catch((e) => showError(normalizeError(e)));

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading your dashboard…");

  const claims = await guardRoleOrRedirect(["student"], ABS.studentLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);
  wireAvatarWorldEmbed();

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid;

  setHeaderUser(els.hdr, {
    title: "Readathon World",
    subtitle: `${schoolId} • ${userId}`,
  });

  // Load summary
  const summary = await loadSummary({ schoolId, userId });
  renderSummary(summary);

  // Load inventory
  const inv = await loadInventory({ schoolId, userId });
  renderInventory(inv);

  // Mount shared Avatar World widget (real Firestore-backed preview)
  await mountAvatarWorldWidget({
    mountEl: "#avatarWorldMount",
    role: "student",
    schoolId,
    userId,
    openUrl: "/readathon-world_Ver2/html/avatar-world.html",
  });

  hideLoading(els.loadingOverlay);
}

function wireAvatarWorldEmbed() {
  if (!els.btnOpenAvatarWorld || !els.awEmbedModal || !els.btnCloseAvatarWorld || !els.awEmbedFrame) {
    return;
  }

  const main = document.querySelector("main");
  let lastFocus = null;

  const open = () => {
    lastFocus = document.activeElement;

    els.awEmbedModal.classList.remove("isHidden");
    els.awEmbedModal.setAttribute("aria-hidden", "false");

    if (main) main.setAttribute("inert", "");

    els.awEmbedFrame.src = "/readathon-world_Ver2/html/avatar-world.html?embed=1&from=student";

    requestAnimationFrame(() => els.btnCloseAvatarWorld.focus());
  };

  const close = () => {
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    } else {
      els.btnOpenAvatarWorld.focus();
    }

    els.awEmbedModal.classList.add("isHidden");
    els.awEmbedModal.setAttribute("aria-hidden", "true");

    if (main) main.removeAttribute("inert");
  };

  els.btnOpenAvatarWorld.addEventListener("click", open);
  els.btnCloseAvatarWorld.addEventListener("click", close);

  els.awEmbedModal.addEventListener("click", (e) => {
    if (e.target === els.awEmbedModal) close();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.awEmbedModal.getAttribute("aria-hidden") === "false") {
      close();
    }
  });

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

  els.minutesTotal.textContent = fmtInt(minutesTotal);
  els.minutesPending.textContent = fmtInt(pending);
  els.rubiesBalance.textContent = fmtInt(rubiesBal);
  els.rubiesLifetime.textContent = `Earned: ${fmtInt(earned)} • Spent: ${fmtInt(spent)}`;
  els.moneyRaised.textContent = fmtMoneyCents(money);
}

function renderInventory(inv) {
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

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}