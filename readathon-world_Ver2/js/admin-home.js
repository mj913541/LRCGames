// /readathon-world_Ver2/js/admin-home.js

import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

import {
  auth,
  functions,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
} from "/readathon-world_Ver2/js/firebase.js";

import {
  ABS,
  guardRoleOrRedirect,
  setHeaderUser,
  wireSignOut,
  showLoading,
  hideLoading,
  normalizeError,
} from "/readathon-world_Ver2/js/app.js";

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("errorBox"),

  // OPTIONAL: if you add these divs later, this will populate them
  totalsBox: document.getElementById("totalsBox"),
  gradesBox: document.getElementById("gradesBox"),
  homeroomsBox: document.getElementById("homeroomsBox"),
  topReadersBox: document.getElementById("topReadersBox"),
};

init().catch((e) => showError(normalizeError(e)));

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading admin dashboard…");

  // ✅ Make sure auth + claims are present FIRST
  const claims = await guardRoleOrRedirect(["admin"], ABS.adminLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid;

  setHeaderUser(els.hdr, {
    title: "Readathon World",
    subtitle: `${schoolId} • ${userId}`,
  });

  // ✅ Now that you're confirmed admin, load analytics
  await loadAnalytics();

  hideLoading(els.loadingOverlay);
}

async function loadAnalytics() {
  try {
    const fn = httpsCallable(functions, "getReadathonAnalytics");
    const res = await fn({ limitTopReaders: 10, limitHomerooms: 30 });

    console.log("Totals:", res.data.totals);
    console.log("Grades:", res.data.byGrade);
    console.log("Homerooms:", res.data.homeroomLeaderboards.byMinutes);
    console.log("Top Readers:", res.data.topReaders);

    // OPTIONAL: show it on the page if you have containers
    if (els.totalsBox) els.totalsBox.textContent = JSON.stringify(res.data.totals, null, 2);
    if (els.gradesBox) els.gradesBox.textContent = JSON.stringify(res.data.byGrade, null, 2);
    if (els.homeroomsBox) els.homeroomsBox.textContent = JSON.stringify(res.data.homeroomLeaderboards.byMinutes, null, 2);
    if (els.topReadersBox) els.topReadersBox.textContent = JSON.stringify(res.data.topReaders, null, 2);
  } catch (e) {
    // If analytics fails, we still want the dashboard to load
    console.error("Analytics load failed:", e);
    showError(normalizeError(e));
  }
}

function showError(msg) {
  if (!els.errorBox) return;
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}
