// /readathon-world_Ver2/js/staff-login.js
import {
  DEFAULT_SCHOOL_ID,
  getSchoolId,
  setSchoolId,
  fnVerifyPin,
  signInWithToken,
} from "/readathon-world_Ver2/js/firebase.js";

const ABS = {
  staffHome: "/readathon-world_Ver2/html/staff-home.html",
  index: "/readathon-world_Ver2/html/index.html",
};

const els = {
  schoolIdLabel: document.getElementById("schoolIdLabel"),
  btnChangeSchool: document.getElementById("btnChangeSchool"),
  schoolDialog: document.getElementById("schoolDialog"),
  schoolIdInput: document.getElementById("schoolIdInput"),

  loginForm: document.getElementById("loginForm"),
  userIdInput: document.getElementById("userIdInput"),
  pinInput: document.getElementById("pinInput"),
  btnLogin: document.getElementById("btnLogin"),

  btnClear: document.getElementById("btnClear"),
  errorBox: document.getElementById("errorBox"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
};

init();

function init() {
  // School
  const schoolId = getSchoolId() || DEFAULT_SCHOOL_ID;
  setSchoolId(schoolId);
  renderSchool();

  wireSchoolDialog();
  wireForm();

  // Prefill last staffId (nice for testing)
  const last = localStorage.getItem("readathonV2_lastStaffId");
  if (last) els.userIdInput.value = last;

  els.btnClear.addEventListener("click", () => {
    els.userIdInput.value = "";
    els.pinInput.value = "";
    hideError();
    els.userIdInput.focus();
  });
}

function renderSchool() {
  els.schoolIdLabel.textContent = getSchoolId() || DEFAULT_SCHOOL_ID;
}

function wireSchoolDialog() {
  els.btnChangeSchool.addEventListener("click", () => {
    els.schoolIdInput.value = getSchoolId() || DEFAULT_SCHOOL_ID;
    els.schoolDialog.showModal();
  });

  els.schoolDialog.addEventListener("close", () => {
    if (els.schoolDialog.returnValue === "ok") {
      const next = (els.schoolIdInput.value || "").trim() || DEFAULT_SCHOOL_ID;
      setSchoolId(next);
      renderSchool();
    }
  });
}

function wireForm() {
  els.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const schoolId = getSchoolId() || DEFAULT_SCHOOL_ID;
    const userId = (els.userIdInput.value || "").trim();
    const pin = (els.pinInput.value || "").trim();

    if (!/^staff_[a-z0-9_]+$/i.test(userId)) {
      showError("Please enter a staff userId like staff_peterson.");
      els.userIdInput.focus();
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      showError("Please enter a 4-digit PIN.");
      els.pinInput.focus();
      return;
    }

    try {
      showLoading("Checking PIN…");

      const res = await fnVerifyPin({ schoolId, userId, pin });
      const customToken = res?.data?.customToken;
      if (!customToken) throw new Error("Missing customToken from verifyPin.");

      showLoading("Signing you in…");
      await signInWithToken(customToken);

      localStorage.setItem("readathonV2_schoolId", schoolId);
      localStorage.setItem("readathonV2_userId", userId);
      localStorage.setItem("readathonV2_role", "staff");
      localStorage.setItem("readathonV2_lastStaffId", userId);

      hideLoading();
      window.location.href = ABS.staffHome;
    } catch (err) {
      hideLoading();
      showFriendlyError(err);
    }
  });
}

function showLoading(text) {
  els.loadingText.textContent = text || "Loading…";
  els.loadingOverlay.classList.remove("isHidden");
}
function hideLoading() {
  els.loadingOverlay.classList.add("isHidden");
}

function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}
function hideError() {
  els.errorBox.classList.add("isHidden");
  els.errorBox.textContent = "";
}

function showFriendlyError(err) {
  console.error(err);
  const msg = normalizeError(err);
  showError(msg);
}

function normalizeError(err) {
  const raw =
    err?.message ||
    err?.toString?.() ||
    "Something went wrong. Please try again.";

  if (raw.toLowerCase().includes("invalid pin") || raw.toLowerCase().includes("wrong pin")) {
    return "That PIN didn’t match. Try again!";
  }
  if (raw.toLowerCase().includes("inactive")) {
    return "Your account is not active. Ask an admin for help.";
  }
  if (raw.toLowerCase().includes("not found")) {
    return "We couldn’t find that staff account. Check the userId.";
  }
  return raw;
}