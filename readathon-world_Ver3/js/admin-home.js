// ./js/admin-home.js

import {
  auth,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
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
};

init().catch((e) => showError(normalizeError(e)));

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading admin dashboard…");

  const claims = await guardRoleOrRedirect(["admin"], ABS.adminLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid || "(unknown)";

  setHeaderUser(els.hdr, {
    title: "Readathon World",
    subtitle: `${schoolId} • ${userId}`,
  });

  const summary = await loadSummary({ schoolId, userId });
  renderSummary(summary);

  const inv = await loadInventory({ schoolId, userId });
  renderInventory(inv);

  await mountAvatarWorldWidget({
    mountEl: "#avatarWorldMount",
    role: "admin",
    schoolId,
    userId,
    openUrl: "./avatar-world.html",
  });

  await renderLeaderboard("leaderboardMount");
  await mountPrizeAdminDashboard({ mountEl: "#prizeAdminMount", schoolId, userId });
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
    empty.textContent = "No items yet.";
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
  if (!els.errorBox) return;
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}