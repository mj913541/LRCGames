// /readathon-world_Ver2/js/student-minutes-submit.js

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

console.log("✅ LOADED student-minutes-submit.js (HTTP)");

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  minutesForm: document.getElementById("minutesForm"),
  minutesInput: document.getElementById("minutesInput"),
  noteInput: document.getElementById("noteInput"),
  btnSubmit: document.getElementById("btnSubmit"),

  errorBox: document.getElementById("errorBox"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),

  successDialog: document.getElementById("successDialog"),
  btnCloseSuccess: document.getElementById("btnCloseSuccess"),
  btnBackToDashboard: document.getElementById("btnBackToDashboard"),
};

let current = { schoolId: null, userId: null };

init().catch((e) => showError(normalizeError(e)));

async function ensureAuthedOrBounce() {
  const user = await waitForAuthReady();
  if (!user) {
    window.location.href = ABS.studentLogin;
    return null;
  }
  await user.getIdToken(true);
  return user;
}

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading…");

  const claims = await guardRoleOrRedirect(["student"], ABS.studentLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId =
    auth.currentUser?.uid ||
    claims.userId ||
    localStorage.getItem("readathonV2_userId") ||
    "";

  current.schoolId = schoolId;
  current.userId = userId;

  setHeaderUser(els.hdr, {
    title: "Submit Minutes",
    subtitle: `${schoolId} • ${userId}`,
  });

  wireMinutesForm();
  wireSuccessModal();

  hideLoading(els.loadingOverlay);
}

function wireMinutesForm() {
  els.minutesForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMsgs();

    const schoolId = current.schoolId;
    const userId = current.userId;

    const minutes = parseInt((els.minutesInput.value || "0").trim(), 10) || 0;
    const note = (els.noteInput.value || "").trim();
    const dateKey = todayDateKey();

    if (minutes <= 0) {
      showError("Please enter minutes greater than 0.");
      return;
    }

    try {
      els.btnSubmit.disabled = true;
      showLoading(els.loadingOverlay, els.loadingText, "Submitting…");

      const user = await ensureAuthedOrBounce();
      if (!user) return;

      const token = await user.getIdToken(true);

      const resp = await fetch(
        "https://us-central1-lrcquest-3039e.cloudfunctions.net/submitTransactionHttp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            schoolId,
            targetUserId: userId,
            actionType: "MINUTES_SUBMIT_PENDING",
            deltaMinutes: minutes,
            deltaRubies: 0,
            deltaMoneyRaisedCents: 0,
            note,
            dateKey,
          }),
        }
      );

      if (!resp.ok) {
        let msg = `HTTP ${resp.status}`;
        try {
          const j = await resp.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      hideLoading(els.loadingOverlay);

      els.minutesInput.value = "";
      els.noteInput.value = "";

      showSuccessModal();
    } catch (err) {
      hideLoading(els.loadingOverlay);
      showError(normalizeError(err));
    } finally {
      els.btnSubmit.disabled = false;
    }
  });
}

function wireSuccessModal() {
  if (els.btnCloseSuccess) {
    els.btnCloseSuccess.addEventListener("click", () => {
      closeSuccessModal();
    });
  }

  if (els.successDialog) {
    els.successDialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeSuccessModal();
    });
  }
}

function showSuccessModal() {
  if (!els.successDialog) return;

  if (typeof els.successDialog.showModal === "function") {
    els.successDialog.showModal();
  } else {
    els.successDialog.setAttribute("open", "open");
  }
}

function closeSuccessModal() {
  if (!els.successDialog) return;

  if (typeof els.successDialog.close === "function") {
    els.successDialog.close();
  } else {
    els.successDialog.removeAttribute("open");
  }
}

function todayDateKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function hideMsgs() {
  if (els.errorBox) {
    els.errorBox.classList.add("isHidden");
    els.errorBox.textContent = "";
  }
}

function showError(msg) {
  if (!els.errorBox) return;
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}