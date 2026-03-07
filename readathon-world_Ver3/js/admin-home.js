// /js/admin-home.js

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
  showLoading,
  hideLoading,
  normalizeError,
} from "./app.js";

import { renderLeaderboard } from "./leaderboard.js";

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("errorBox"),
};

init().catch((e) => showError(normalizeError(e)));

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading admin dashboard…");

  // ensure admin
  const claims = await guardRoleOrRedirect(["admin"], ABS.adminLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid || "(unknown)";

  setHeaderUser(els.hdr, {
    title: "Readathon World",
    subtitle: `${schoolId} • ${userId}`,
  });

  hideLoading(els.loadingOverlay);
}

function showError(msg) {
  if (!els.errorBox) return;
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}


renderLeaderboard();