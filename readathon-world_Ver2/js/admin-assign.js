import {
  auth,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  waitForAuthReady,
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

console.log("✅ LOADED admin-assign.js");

const ENDPOINTS = {
  submitTransactionHttp:
    "https://us-central1-lrcquest-3039e.cloudfunctions.net/submitTransactionHttp",
};

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),

  targetUserIdInput: document.getElementById("targetUserIdInput"),
  minutesInput: document.getElementById("minutesInput"),
  rubiesInput: document.getElementById("rubiesInput"),
  moneyInput: document.getElementById("moneyInput"),
  dateInput: document.getElementById("dateInput"),
  noteInput: document.getElementById("noteInput"),

  btnAssign: document.getElementById("btnAssign"),
  btnReset: document.getElementById("btnReset"),

  previewTarget: document.getElementById("previewTarget"),
  previewMinutes: document.getElementById("previewMinutes"),
  previewRubies: document.getElementById("previewRubies"),
  previewMoney: document.getElementById("previewMoney"),
  previewDate: document.getElementById("previewDate"),

  errorBox: document.getElementById("errorBox"),
  okBox: document.getElementById("okBox"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
};

let current = {
  schoolId: null,
  adminId: null,
};

init().catch((e) => {
  hideLoading(els.loadingOverlay);
  showError(normalizeError(e));
});

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading admin assign page…");

  const claims = await guardRoleOrRedirect(["admin"], ABS.adminLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  current.schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  current.adminId =
    (claims.userId ||
      localStorage.getItem("readathonV2_userId") ||
      auth.currentUser?.uid ||
      "").trim().toLowerCase();

  setHeaderUser(els.hdr, {
    title: "Admin Assign",
    subtitle: `${current.schoolId} • ${current.adminId}`,
  });

  if (els.pageTitle) els.pageTitle.textContent = "Admin Assign";
  if (els.pageSubtitle) {
    els.pageSubtitle.textContent =
      "Direct admin posting for minutes, rubies, and donations.";
  }

  els.dateInput.value = todayDateKey();

  wirePreview();
  wireActions();

  updatePreview();
  hideLoading(els.loadingOverlay);
}

function wirePreview() {
  [
    els.targetUserIdInput,
    els.minutesInput,
    els.rubiesInput,
    els.moneyInput,
    els.dateInput,
  ].forEach((el) => el?.addEventListener("input", updatePreview));
}

function wireActions() {
  els.btnAssign?.addEventListener("click", submitAssignments);
  els.btnReset?.addEventListener("click", resetForm);
}

function updatePreview() {
  const targetUserId = cleanId(els.targetUserIdInput.value);
  const minutes = parseInt(els.minutesInput.value || "0", 10) || 0;
  const rubies = parseInt(els.rubiesInput.value || "0", 10) || 0;
  const money = parseFloat(els.moneyInput.value || "0") || 0;
  const dateKey = els.dateInput.value || todayDateKey();

  if (els.previewTarget) els.previewTarget.textContent = targetUserId || "—";
  if (els.previewMinutes) els.previewMinutes.textContent = String(minutes);
  if (els.previewRubies) els.previewRubies.textContent = String(rubies);
  if (els.previewMoney) els.previewMoney.textContent = fmtMoney(money);
  if (els.previewDate) els.previewDate.textContent = dateKey;
}

async function submitAssignments() {
  hideMsgs();

  const targetUserId = cleanId(els.targetUserIdInput.value);
  const minutes = parseInt(els.minutesInput.value || "0", 10) || 0;
  const rubies = parseInt(els.rubiesInput.value || "0", 10) || 0;
  const moneyDollars = parseFloat(els.moneyInput.value || "0") || 0;
  const deltaMoneyRaisedCents = Math.round(moneyDollars * 100);
  const note = (els.noteInput.value || "").trim();
  const dateKey = els.dateInput.value || todayDateKey();

  if (!targetUserId) return showError("Enter a student user ID.");
  if (minutes === 0 && rubies === 0 && deltaMoneyRaisedCents === 0) {
    return showError("Enter at least one value to assign.");
  }

  showLoading(els.loadingOverlay, els.loadingText, "Posting direct admin assignment…");
  els.btnAssign.disabled = true;

  try {
    const user = await ensureAuthedOrBounce();
    if (!user) return;

    const token = await user.getIdToken(true);

    const jobs = [];

    if (minutes !== 0) {
      jobs.push(postTransaction(token, {
        schoolId: current.schoolId,
        targetUserId,
        actionType: "ADMIN_MINUTES_ASSIGN",
        deltaMinutes: minutes,
        deltaRubies: 0,
        deltaMoneyRaisedCents: 0,
        note: note || "Admin direct minutes assignment",
        dateKey,
      }));
    }

    if (rubies > 0) {
      jobs.push(postTransaction(token, {
        schoolId: current.schoolId,
        targetUserId,
        actionType: "RUBIES_AWARD",
        deltaMinutes: 0,
        deltaRubies: rubies,
        deltaMoneyRaisedCents: 0,
        note: note || "Admin ruby award",
        dateKey,
      }));
    }

    if (rubies < 0) {
      jobs.push(postTransaction(token, {
        schoolId: current.schoolId,
        targetUserId,
        actionType: "RUBIES_SPEND",
        deltaMinutes: 0,
        deltaRubies: rubies,
        deltaMoneyRaisedCents: 0,
        note: note || "Admin ruby adjustment",
        dateKey,
      }));
    }

    if (deltaMoneyRaisedCents !== 0) {
      jobs.push(postTransaction(token, {
        schoolId: current.schoolId,
        targetUserId,
        actionType: "ADMIN_DONATION_ASSIGN",
        deltaMinutes: 0,
        deltaRubies: 0,
        deltaMoneyRaisedCents,
        note: note || "Admin donation assignment",
        dateKey,
      }));
    }

    await Promise.all(jobs);

    hideLoading(els.loadingOverlay);
    showOk("Admin assignment posted directly ✅");
    resetForm(false);
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  } finally {
    els.btnAssign.disabled = false;
  }
}

async function postTransaction(token, payload) {
  const resp = await fetch(ENDPOINTS.submitTransactionHttp, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }

  return resp.json().catch(() => ({ ok: true }));
}

async function ensureAuthedOrBounce() {
  const user = await waitForAuthReady();
  if (!user) {
    window.location.href = ABS.adminLogin;
    return null;
  }
  await user.getIdToken(true);
  return user;
}

function resetForm(update = true) {
  els.targetUserIdInput.value = "";
  els.minutesInput.value = "0";
  els.rubiesInput.value = "0";
  els.moneyInput.value = "0";
  els.dateInput.value = todayDateKey();
  els.noteInput.value = "";

  hideMsgs();
  if (update) updatePreview();
  else updatePreview();
}

function cleanId(v) {
  return String(v || "").trim().toLowerCase();
}

function todayDateKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMoney(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function hideMsgs() {
  if (els.errorBox) {
    els.errorBox.textContent = "";
    els.errorBox.classList.add("isHidden");
  }
  if (els.okBox) {
    els.okBox.textContent = "";
    els.okBox.classList.add("isHidden");
  }
}

function showError(msg) {
  if (!els.errorBox) return;
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}

function showOk(msg) {
  if (!els.okBox) return;
  els.okBox.textContent = msg;
  els.okBox.classList.remove("isHidden");
}