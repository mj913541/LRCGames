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

const MAX_MINUTES_PER_ENTRY = 120;
const MAX_REFLECTION_LENGTH = 180;

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  minutesForm: document.getElementById("minutesForm"),
  minutesInput: document.getElementById("minutesInput"),
  noteInput: document.getElementById("noteInput"),
  readingType: document.getElementById("readingType"),
  bookTitleInput: document.getElementById("bookTitleInput"),
  startPageInput: document.getElementById("startPageInput"),
  endPageInput: document.getElementById("endPageInput"),
  reflectionInput: document.getElementById("reflectionInput"),
  chapterFields: document.getElementById("chapterFields"),
  accountabilityPreview: document.getElementById("accountabilityPreview"),
  accountabilityText: document.getElementById("accountabilityText"),
  btnSuggestMinutes: document.getElementById("btnSuggestMinutes"),
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
  wireAccountabilityFields();
  updateReadingModeUI();
  updateAccountabilityPreview();

  hideLoading(els.loadingOverlay);
}

function wireMinutesForm() {
  if (!els.minutesForm) return;

  els.minutesForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMsgs();

    const schoolId = current.schoolId;
    const userId = current.userId;

    const formData = collectFormData();
    const validationError = validateSubmission(formData);
    if (validationError) {
      showError(validationError);
      return;
    }

    try {
      els.btnSubmit.disabled = true;
      showLoading(els.loadingOverlay, els.loadingText, "Submitting…");

      const user = await ensureAuthedOrBounce();
      if (!user) return;

      const token = await user.getIdToken(true);
      const adminNote = buildStructuredNote(formData);

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
            deltaMinutes: formData.minutes,
            deltaRubies: 0,
            deltaMoneyRaisedCents: 0,
            note: adminNote,
            dateKey: todayDateKey(),
          }),
        }
      );

      if (!resp.ok) {
        let msg = `HTTP ${resp.status}`;
        try {
          const j = await resp.json();
          if (j?.error) msg = j.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      hideLoading(els.loadingOverlay);
      resetForm();
      showSuccessModal();
    } catch (err) {
      hideLoading(els.loadingOverlay);
      showError(normalizeError(err));
    } finally {
      els.btnSubmit.disabled = false;
    }
  });
}

function wireAccountabilityFields() {
  const previewInputs = [
    els.minutesInput,
    els.noteInput,
    els.readingType,
    els.bookTitleInput,
    els.startPageInput,
    els.endPageInput,
    els.reflectionInput,
  ].filter(Boolean);

  for (const el of previewInputs) {
    el.addEventListener("input", () => {
      if (el === els.readingType) updateReadingModeUI();
      updateAccountabilityPreview();
    });
    el.addEventListener("change", () => {
      if (el === els.readingType) updateReadingModeUI();
      updateAccountabilityPreview();
    });
  }

  if (els.btnSuggestMinutes) {
    els.btnSuggestMinutes.addEventListener("click", () => {
      const range = getPageRange();
      if (!range.isValid) {
        showError("Enter a valid start page and end page first.");
        return;
      }

      const suggested = Math.min(range.pagesRead, MAX_MINUTES_PER_ENTRY);
      els.minutesInput.value = suggested ? String(suggested) : "";
      hideMsgs();
      updateAccountabilityPreview();
    });
  }
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

function collectFormData() {
  return {
    minutes: parseInt((els.minutesInput?.value || "0").trim(), 10) || 0,
    note: (els.noteInput?.value || "").trim(),
    readingType: (els.readingType?.value || "").trim(),
    bookTitle: (els.bookTitleInput?.value || "").trim(),
    startPage: parseOptionalInt(els.startPageInput?.value),
    endPage: parseOptionalInt(els.endPageInput?.value),
    reflection: (els.reflectionInput?.value || "").trim(),
  };
}

function validateSubmission(data) {
  if (data.minutes <= 0) return "Please enter minutes greater than 0.";
  if (data.minutes > MAX_MINUTES_PER_ENTRY) {
    return `Maximum ${MAX_MINUTES_PER_ENTRY} minutes per entry.`;
  }

  if (!data.readingType) return "Please choose what kind of reading you did.";

  const hasAnyContext = Boolean(data.bookTitle || data.note || data.reflection);
  if (!hasAnyContext) {
    return "Please add a book title, reading note, or short reflection.";
  }

  if (data.reflection.length > MAX_REFLECTION_LENGTH) {
    return `Reflection must be ${MAX_REFLECTION_LENGTH} characters or less.`;
  }

  if (data.readingType === "chapter_book") {
    if (!data.bookTitle) return "Please enter the chapter book title.";
    if (!Number.isInteger(data.startPage) || !Number.isInteger(data.endPage)) {
      return "Please enter both a start page and end page for chapter books.";
    }
    if (data.startPage < 0 || data.endPage < 0) {
      return "Pages cannot be negative.";
    }
    if (data.endPage < data.startPage) {
      return "End page must be the same as or greater than start page.";
    }
  }

  return "";
}

function buildStructuredNote(data) {
  const parts = [
    `Type: ${labelForReadingType(data.readingType) || "Unknown"}`,
  ];

  if (data.bookTitle) parts.push(`Book: ${data.bookTitle}`);

  if (data.readingType === "chapter_book" && Number.isInteger(data.startPage) && Number.isInteger(data.endPage)) {
    const pagesRead = Math.max(0, data.endPage - data.startPage);
    parts.push(`Pages: ${data.startPage} → ${data.endPage}`);
    parts.push(`Pages Read: ${pagesRead}`);
  }

  if (data.note) parts.push(`Note: ${data.note}`);
  if (data.reflection) parts.push(`Reflection: ${data.reflection}`);

  return parts.join(" | ");
}

function updateReadingModeUI() {
  const isChapterBook = (els.readingType?.value || "") === "chapter_book";
  if (els.chapterFields) {
    els.chapterFields.classList.toggle("isHidden", !isChapterBook);
  }

  if (els.bookTitleInput) {
    els.bookTitleInput.placeholder = isChapterBook
      ? "Example: The Wild Robot"
      : "Example: Dog Man / library book / article";
  }
}

function updateAccountabilityPreview() {
  if (!els.accountabilityPreview || !els.accountabilityText) return;

  const data = collectFormData();
  const lines = [];

  if (data.readingType) lines.push(`Reading type: ${labelForReadingType(data.readingType)}`);
  if (data.bookTitle) lines.push(`Book: ${data.bookTitle}`);

  const range = getPageRange();
  if (data.readingType === "chapter_book" && range.isValid) {
    lines.push(`Pages: ${range.startPage} → ${range.endPage} (${range.pagesRead} pages read)`);
  }

  if (data.minutes > 0) lines.push(`Minutes entered: ${data.minutes}`);
  if (data.note) lines.push(`Note: ${data.note}`);
  if (data.reflection) lines.push(`Reflection: ${data.reflection}`);

  if (!lines.length) {
    els.accountabilityPreview.classList.add("isHidden");
    els.accountabilityText.innerHTML = "";
    return;
  }

  els.accountabilityPreview.classList.remove("isHidden");
  els.accountabilityText.innerHTML = lines
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");
}

function getPageRange() {
  const startPage = parseOptionalInt(els.startPageInput?.value);
  const endPage = parseOptionalInt(els.endPageInput?.value);
  const isValid = Number.isInteger(startPage) && Number.isInteger(endPage) && endPage >= startPage;

  return {
    startPage,
    endPage,
    isValid,
    pagesRead: isValid ? Math.max(0, endPage - startPage) : 0,
  };
}

function labelForReadingType(value) {
  const map = {
    chapter_book: "Chapter Book",
    picture_book: "Picture Book",
    audiobook: "Audiobook",
    school_reading: "School Reading",
    article_nonfiction: "Article / Nonfiction",
    other: "Other",
  };
  return map[value] || "";
}

function parseOptionalInt(value) {
  const raw = (value || "").toString().trim();
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function resetForm() {
  if (els.minutesForm) els.minutesForm.reset();
  updateReadingModeUI();
  updateAccountabilityPreview();
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

function escapeHtml(s) {
  return (s ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
