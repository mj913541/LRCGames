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

  // NEW: Analytics UI (from the HTML panel we added)
  statTotalMinutes: document.getElementById("statTotalMinutes"),
  statTotalMoney: document.getElementById("statTotalMoney"),
  statTotalStudents: document.getElementById("statTotalStudents"),

  gradeTableBody: document.getElementById("gradeTableBody"),
  homeroomMinutesBody: document.getElementById("homeroomMinutesBody"),
  homeroomMoneyBody: document.getElementById("homeroomMoneyBody"),
  topReadersBody: document.getElementById("topReadersBody"),

  // OPTIONAL: legacy debug boxes (if you still have them somewhere)
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

    const data = res.data || {};
    const totals = data.totals || {};
    const byGrade = data.byGrade || [];
    const leaderboards = data.homeroomLeaderboards || {};
    const topReaders = data.topReaders || [];

    // Console logs (still helpful)
    console.log("Totals:", totals);
    console.log("Grades:", byGrade);
    console.log("Homerooms (minutes):", leaderboards.byMinutes);
    console.log("Homerooms (money):", leaderboards.byMoney);
    console.log("Top Readers:", topReaders);

    // Render totals
    renderTotals(totals);

    // Render tables
    renderGradeTable(byGrade);
    renderHomeroomTable(els.homeroomMinutesBody, leaderboards.byMinutes || []);
    renderHomeroomTable(els.homeroomMoneyBody, leaderboards.byMoney || []);
    renderTopReaders(topReaders);

    // OPTIONAL: show raw JSON if those containers exist
    if (els.totalsBox) els.totalsBox.textContent = JSON.stringify(totals, null, 2);
    if (els.gradesBox) els.gradesBox.textContent = JSON.stringify(byGrade, null, 2);
    if (els.homeroomsBox) els.homeroomsBox.textContent = JSON.stringify(leaderboards.byMinutes || [], null, 2);
    if (els.topReadersBox) els.topReadersBox.textContent = JSON.stringify(topReaders, null, 2);
  } catch (e) {
    console.error("Analytics load failed:", e);
    showError(normalizeError(e));
  }
}

function renderTotals(totals) {
  if (els.statTotalMinutes) els.statTotalMinutes.textContent = formatNumber(totals.totalMinutes || 0);

  // totals.totalMoneyDollars already comes back as a string like "9134.50"
  if (els.statTotalMoney) {
    const dollars = totals.totalMoneyDollars ?? ((Number(totals.totalMoneyCents || 0) / 100).toFixed(2));
    els.statTotalMoney.textContent = `$${dollars}`;
  }

  if (els.statTotalStudents) els.statTotalStudents.textContent = formatNumber(totals.totalStudents || 0);
}

function renderGradeTable(rows) {
  if (!els.gradeTableBody) return;

  if (!rows.length) {
    els.gradeTableBody.innerHTML = `<tr><td colspan="4">No data</td></tr>`;
    return;
  }

  els.gradeTableBody.innerHTML = rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.grade)}</td>
      <td class="num">${formatNumber(r.students)}</td>
      <td class="num">${formatNumber(r.minutes)}</td>
      <td class="num">$${escapeHtml(r.moneyDollars)}</td>
    </tr>
  `).join("");
}

function renderHomeroomTable(tbodyEl, rows) {
  if (!tbodyEl) return;

  if (!rows.length) {
    tbodyEl.innerHTML = `<tr><td colspan="4">No data</td></tr>`;
    return;
  }

  tbodyEl.innerHTML = rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.homeroom)}</td>
      <td class="num">${formatNumber(r.students)}</td>
      <td class="num">${formatNumber(r.minutes)}</td>
      <td class="num">$${escapeHtml(r.moneyDollars)}</td>
    </tr>
  `).join("");
}

function renderTopReaders(rows) {
  if (!els.topReadersBody) return;

  if (!rows.length) {
    els.topReadersBody.innerHTML = `<tr><td colspan="4">No data</td></tr>`;
    return;
  }

  els.topReadersBody.innerHTML = rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.grade)}</td>
      <td>${escapeHtml(r.homeroom)}</td>
      <td class="num">${formatNumber(r.minutes)}</td>
    </tr>
  `).join("");
}

function formatNumber(n) {
  const num = Number(n || 0);
  return num.toLocaleString();
}

function escapeHtml(s) {
  return String(s ?? "")
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
