// /readathon-world_Ver2/js/student-minutes-submit.js
import { auth, getSchoolId, DEFAULT_SCHOOL_ID, fnSubmitTransaction } from "/readathon-world_Ver2/js/firebase.js";
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

  minutesForm: document.getElementById("minutesForm"),
  minutesInput: document.getElementById("minutesInput"),
  noteInput: document.getElementById("noteInput"),
  btnSubmit: document.getElementById("btnSubmit"),

  errorBox: document.getElementById("errorBox"),
  okBox: document.getElementById("okBox"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
};

init().catch((e) => showError(normalizeError(e)));

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading…");
  const claims = await guardRoleOrRedirect(["student"], ABS.studentLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid;

  setHeaderUser(els.hdr, {
    title: "Submit your reading minutes",
    subtitle: `${schoolId} • ${userId}`,
  });

  els.minutesInput.focus();

  els.minutesForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessages();

    const minutes = parseInt((els.minutesInput.value || "").trim(), 10);
    const note = (els.noteInput.value || "").trim();

    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1000) {
      showError("Please enter a valid number of minutes (1–1000).");
      els.minutesInput.focus();
      return;
    }

    try {
      els.btnSubmit.disabled = true;
      showLoading(els.loadingOverlay, els.loadingText, "Submitting pending minutes…");

      const dateKey = todayDateKey();

      // Action type choice for pending minutes:
      // We will implement this in Cloud Functions as:
      // actionType = "MINUTES_SUBMIT_PENDING"
      // deltaMinutes = minutes (pending, NOT added to minutesTotal yet)
      const res = await fnSubmitTransaction({
        schoolId,
        targetUserId: userId,
        actionType: "MINUTES_SUBMIT_PENDING",
        deltaMinutes: minutes,
        deltaRubies: 0,
        deltaMoneyRaisedCents: 0,
        note,
        dateKey,
      });

      hideLoading(els.loadingOverlay);
      showOk(`Submitted! ✅ ${minutes} minutes are now pending approval.`);
      els.minutesInput.value = "";
      els.noteInput.value = "";
      els.minutesInput.focus();

      return res;
    } catch (err) {
      hideLoading(els.loadingOverlay);
      showError(normalizeError(err));
    } finally {
      els.btnSubmit.disabled = false;
    }
  });

  hideLoading(els.loadingOverlay);
}

function todayDateKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function hideMessages() {
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