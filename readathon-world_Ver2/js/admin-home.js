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

  // Analytics UI
  statTotalMinutes: document.getElementById("statTotalMinutes"),
  statTotalMoney: document.getElementById("statTotalMoney"),
  statTotalStudents: document.getElementById("statTotalStudents"),

  gradeTableBody: document.getElementById("gradeTableBody"),
  homeroomMinutesBody: document.getElementById("homeroomMinutesBody"),
  homeroomMoneyBody: document.getElementById("homeroomMoneyBody"),
  topReadersBody: document.getElementById("topReadersBody"),
};

init().catch((e) => showError(normalizeError(e)));

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading admin dashboard…");

  // must be admin
  const claims = await guardRoleOrRedirect(["admin"], ABS.adminLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid || "(unknown)";

  setHeaderUser(els.hdr, {
    title: "Readathon World",
    subtitle: `${schoolId} • ${userId}`,
  });

  await loadAnalytics();

  hideLoading(els.loadingOverlay);
}

async function loadAnalytics() {
  try {
    // ✅ REAL callable (no manual fetch, no URL)
    const fn = httpsCallable(functions, "getReadathonAnalytics");

    console.log("📡 Calling getReadathonAnalytics via httpsCallable...");
    const res = await fn({ limitTopReaders: 10, limitHomerooms: 30 });
    const data = res.data || {};

    // Render totals
    renderTotals(data.totals);

    // Render tables
    renderGradeTotals(data.byGrade || []);
    renderHomeroomTable(els.homeroomMinutesBody, data.homeroomLeaderboards?.byMinutes || []);
    renderHomeroomTable(els.homeroomMoneyBody, data.homeroomLeaderboards?.byMoney || []);
    renderTopReaders(data.topReaders || []);

    // Optional debug
    console.log("✅ Analytics data:", data);
  } catch (e) {
    console.error("Analytics load failed:", e);
    showError(normalizeError(e));
  }
}

function renderTotals(t) {
  if (!t) return;

  if (els.statTotalMinutes) els.statTotalMinutes.textContent = formatInt(t.totalMinutes);
  if (els.statTotalMoney) {
    const dollars = t.totalMoneyDollars ?? (Number(t.totalMoneyCents || 0) / 100).toFixed(2);
    els.statTotalMoney.textContent = `$${dollars}`;
  }
  if (els.statTotalStudents) els.statTotalStudents.textContent = formatInt(t.totalStudents);
}

function renderGradeTotals(rows) {
  if (!els.gradeTableBody) return;
  els.gradeTableBody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.grade)}</td>
      <td class="num">${formatInt(r.students)}</td>
      <td class="num">${formatInt(r.minutes)}</td>
      <td class="num">$${escapeHtml(r.moneyDollars ?? (Number(r.moneyCents || 0) / 100).toFixed(2))}</td>
    `;
    els.gradeTableBody.appendChild(tr);
  }

  if (!rows.length) {
    els.gradeTableBody.innerHTML = `<tr><td colspan="4" class="num">No data yet</td></tr>`;
  }
}

function renderHomeroomTable(tbodyEl, rows) {
  if (!tbodyEl) return;
  tbodyEl.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.homeroom)}</td>
      <td class="num">${formatInt(r.students)}</td>
      <td class="num">${formatInt(r.minutes)}</td>
      <td class="num">$${escapeHtml(r.moneyDollars ?? (Number(r.moneyCents || 0) / 100).toFixed(2))}</td>
    `;
    tbodyEl.appendChild(tr);
  }

  if (!rows.length) {
    tbodyEl.innerHTML = `<tr><td colspan="4" class="num">No data yet</td></tr>`;
  }
}

function renderTopReaders(rows) {
  if (!els.topReadersBody) return;
  els.topReadersBody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.name || r.userId)}</td>
      <td>${escapeHtml(r.grade)}</td>
      <td>${escapeHtml(r.homeroom)}</td>
      <td class="num">${formatInt(r.minutes)}</td>
    `;
    els.topReadersBody.appendChild(tr);
  }

  if (!rows.length) {
    els.topReadersBody.innerHTML = `<tr><td colspan="4" class="num">No data yet</td></tr>`;
  }
}

function formatInt(n) {
  const num = Number(n || 0);
  return Number.isFinite(num) ? num.toLocaleString() : "0";
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
