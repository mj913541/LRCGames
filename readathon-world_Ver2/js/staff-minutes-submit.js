// /readathon-world_Ver2/js/staff-minutes-submit.js
import {
  auth,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  fnSubmitTransaction,
  fnAwardHomeroom,
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

  awardForm: document.getElementById("awardForm"),
  targetUserIdInput: document.getElementById("targetUserIdInput"),
  actionTypeSelect: document.getElementById("actionTypeSelect"),
  minutesInput: document.getElementById("minutesInput"),
  rubiesInput: document.getElementById("rubiesInput"),
  moneyDollarsInput: document.getElementById("moneyDollarsInput"),
  noteInput: document.getElementById("noteInput"),
  btnSubmit: document.getElementById("btnSubmit"),
  errorBox: document.getElementById("errorBox"),
  okBox: document.getElementById("okBox"),

  homeroomForm: document.getElementById("homeroomForm"),
  homeroomIdInput: document.getElementById("homeroomIdInput"),
  hrRubiesInput: document.getElementById("hrRubiesInput"),
  hrMinutesInput: document.getElementById("hrMinutesInput"),
  hrNoteInput: document.getElementById("hrNoteInput"),
  btnHomeroomSubmit: document.getElementById("btnHomeroomSubmit"),
  hrErrorBox: document.getElementById("hrErrorBox"),
  hrOkBox: document.getElementById("hrOkBox"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
};

let current = { schoolId: null, staffId: null };

init().catch((e) => showError(normalizeError(e)));

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading…");
  const claims = await guardRoleOrRedirect(["staff", "admin"], ABS.staffLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid;

  current.schoolId = schoolId;
  current.staffId = userId;

  setHeaderUser(els.hdr, { title: "Submit / Award", subtitle: `${schoolId} • ${userId}` });

  // Default target = self for convenience
  els.targetUserIdInput.value = userId;

  wireAwardForm();
  wireHomeroomForm();

  hideLoading(els.loadingOverlay);
}

function wireAwardForm() {
  els.awardForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMsgs();

    const schoolId = current.schoolId;
    const targetUserId = (els.targetUserIdInput.value || "").trim().toLowerCase();
    const actionType = els.actionTypeSelect.value;

    const minutes = parseInt((els.minutesInput.value || "0").trim(), 10) || 0;
    let rubies = parseInt((els.rubiesInput.value || "0").trim(), 10) || 0;
    const moneyCents = dollarsToCents((els.moneyDollarsInput.value || "").trim());
    const note = (els.noteInput.value || "").trim();
    const dateKey = todayDateKey();

    // Basic validation per action
    if (!targetUserId) {
      showError("Please enter a target userId.");
      return;
    }

    // Normalize rubies sign for SPEND
    if (actionType === "RUBIES_SPEND" && rubies > 0) rubies = -rubies;

    if (actionType === "MINUTES_SUBMIT_PENDING" && minutes <= 0) {
      showError("Enter minutes greater than 0 for pending minutes.");
      return;
    }
    if ((actionType === "RUBIES_AWARD" || actionType === "RUBIES_SPEND") && rubies === 0) {
      showError("Enter rubies (non-zero) for a rubies action.");
      return;
    }
    if (actionType === "MONEY_RAISED_ADD" && moneyCents <= 0) {
      showError("Enter dollars greater than 0 to add money raised.");
      return;
    }

    try {
      els.btnSubmit.disabled = true;
      showLoading(els.loadingOverlay, els.loadingText, "Submitting…");

      await fnSubmitTransaction({
        schoolId,
        targetUserId,
        actionType,
        deltaMinutes: minutes,
        deltaRubies: rubies,
        deltaMoneyRaisedCents: moneyCents,
        note,
        dateKey,
      });

      hideLoading(els.loadingOverlay);
      showOk("Submitted! ✅");

      // Reset numeric inputs
      els.minutesInput.value = "0";
      els.rubiesInput.value = "0";
      els.moneyDollarsInput.value = "0.00";
      els.noteInput.value = "";
    } catch (err) {
      hideLoading(els.loadingOverlay);
      showError(normalizeError(err));
    } finally {
      els.btnSubmit.disabled = false;
    }
  });
}

function wireHomeroomForm() {
  els.homeroomForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideHrMsgs();

    const schoolId = current.schoolId;
    const homeroomId = (els.homeroomIdInput.value || "").trim();
    const rubies = parseInt((els.hrRubiesInput.value || "0").trim(), 10) || 0;
    const minutes = parseInt((els.hrMinutesInput.value || "0").trim(), 10) || 0;
    const note = (els.hrNoteInput.value || "").trim();
    const dateKey = todayDateKey();

    if (!homeroomId) {
      showHrError("Please enter a homeroomId like hr_peterson.");
      return;
    }
    if (rubies <= 0 && minutes <= 0) {
      showHrError("Enter rubies and/or minutes greater than 0.");
      return;
    }

    try {
      els.btnHomeroomSubmit.disabled = true;
      showLoading(els.loadingOverlay, els.loadingText, "Awarding homeroom…");

      // For homeroom awards, simplest:
      // - minutes go in as pending minutes submissions for each student (same approval pipeline)
      // - rubies award can be immediate (or also pending if you prefer later)
      // We'll implement in function:
      // actionType passed in; we’ll use RUBIES_AWARD and/or MINUTES_SUBMIT_PENDING inside.
      await fnAwardHomeroom({
        schoolId,
        homeroomId,
        actionType: "HOMEROOM_AWARD",
        deltaMinutes: minutes,
        deltaRubies: rubies,
        deltaMoneyRaisedCents: 0,
        note,
        dateKey,
      });

      hideLoading(els.loadingOverlay);
      showHrOk("Homeroom award submitted! ✅");

      els.hrRubiesInput.value = "0";
      els.hrMinutesInput.value = "0";
      els.hrNoteInput.value = "";
    } catch (err) {
      hideLoading(els.loadingOverlay);
      showHrError(normalizeError(err));
    } finally {
      els.btnHomeroomSubmit.disabled = false;
    }
  });
}

function dollarsToCents(v) {
  if (!v) return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function todayDateKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function hideMsgs() {
  els.errorBox.classList.add("isHidden");
  els.errorBox.textContent = "";
  els.okBox.classList.add("isHidden");
  els.okBox.textContent = "";
}
function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}
function showOk(msg) {
  els.okBox.textContent = msg;
  els.okBox.classList.remove("isHidden");
}

function hideHrMsgs() {
  els.hrErrorBox.classList.add("isHidden");
  els.hrErrorBox.textContent = "";
  els.hrOkBox.classList.add("isHidden");
  els.hrOkBox.textContent = "";
}
function showHrError(msg) {
  els.hrErrorBox.textContent = msg;
  els.hrErrorBox.classList.remove("isHidden");
}
function showHrOk(msg) {
  els.hrOkBox.textContent = msg;
  els.hrOkBox.classList.remove("isHidden");
}