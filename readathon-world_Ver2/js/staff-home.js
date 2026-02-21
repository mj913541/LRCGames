// /readathon-world_Ver2/js/staff-home.js
import { auth, getSchoolId, DEFAULT_SCHOOL_ID, userDocRef } from "/readathon-world_Ver2/js/firebase.js";
import {
  ABS,
  guardRoleOrRedirect,
  setHeaderUser,
  wireSignOut,
  loadSummary,
  fmtInt,
  fmtMoneyCents,
  showLoading,
  hideLoading,
  normalizeError,
} from "/readathon-world_Ver2/js/app.js";

import {
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  minutesTotal: document.getElementById("minutesTotal"),
  minutesPending: document.getElementById("minutesPending"),
  rubiesBalance: document.getElementById("rubiesBalance"),
  rubiesLifetime: document.getElementById("rubiesLifetime"),
  moneyRaised: document.getElementById("moneyRaised"),

  awardChips: document.getElementById("awardChips"),

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

  setHeaderUser(els.hdr, { title: "Readathon World", subtitle: `${schoolId} • ${userId}` });

  const summary = await loadSummary({ schoolId, userId });
  renderSummary(summary);

  await renderAwardPermissions({ schoolId, userId });

  hideLoading(els.loadingOverlay);
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

async function renderAwardPermissions({ schoolId, userId }) {
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

function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}