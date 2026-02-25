// /readathon-world_Ver2/js/staff-minutes-submit.js
import {
  auth,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  waitForAuthReady,
  fetchActivePublicStudentsByGrade,
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

const ENDPOINTS = {
  submitTransactionHttp:
    "https://us-central1-lrcquest-3039e.cloudfunctions.net/submitTransactionHttp",
  awardHomeroomHttp:
    "https://us-central1-lrcquest-3039e.cloudfunctions.net/awardHomeroomHttp",
};

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  // ✅ NEW: Quick Class Submit
  quick: {
    gradeButtons: document.getElementById("gradeButtons"),
    homeroomButtons: document.getElementById("homeroomButtons"),
    rosterMeta: document.getElementById("rosterMeta"),
    rosterList: document.getElementById("rosterList"),
    btnSelectAll: document.getElementById("btnSelectAll"),
    btnClearAll: document.getElementById("btnClearAll"),
    minutesInput: document.getElementById("quickMinutesInput"),
    noteInput: document.getElementById("quickNoteInput"),
    btnSubmit: document.getElementById("btnQuickSubmit"),
    errorBox: document.getElementById("quickErrorBox"),
    okBox: document.getElementById("quickOkBox"),
  },

  // Existing: Individual award/submit
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

  // Existing: Homeroom award
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

// Quick submit state
let quickState = {
  gradeNum: null,
  homeroomId: null,
  rosterAllForGrade: /** @type {Array<{id:string, displayName:string, grade:number, homeroomId:string}>} */ ([]),
  rosterForHomeroom: /** @type {Array<{id:string, displayName:string, grade:number, homeroomId:string}>} */ ([]),
  selectedIds: new Set(),
};

init().catch((e) => showError(normalizeError(e)));

// ✅ before any backend call, ensure auth is ready and token is fresh
async function ensureAuthedOrBounce() {
  const user = await waitForAuthReady();
  if (!user) {
    window.location.href = ABS.staffLogin;
    return null;
  }
  await user.getIdToken(true); // refresh token/claims
  return user;
}

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading…");

  const claims = await guardRoleOrRedirect(["staff", "admin"], ABS.staffLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;

  // Prefer Firebase UID if available (most reliable)
  const userId =
    auth.currentUser?.uid ||
    claims.userId ||
    localStorage.getItem("readathonV2_userId") ||
    "";

  current.schoolId = schoolId;
  current.staffId = userId;

  setHeaderUser(els.hdr, {
    title: "Submit / Award",
    subtitle: `${schoolId} • ${userId}`,
  });

  // Default target = self for convenience
  els.targetUserIdInput.value = userId;

  wireQuickClassSubmit();
  wireAwardForm();
  wireHomeroomForm();

  hideLoading(els.loadingOverlay);
}

/* =========================================================
   ✅ NEW: Quick Class Submit (Grade -> Homeroom -> Roster)
========================================================= */

function wireQuickClassSubmit() {
  // Render grade buttons (K-5)
  const gradeDefs = [
    { label: "K", value: 0 },
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
  ];

  els.quick.gradeButtons.innerHTML = gradeDefs
    .map(
      (g) =>
        `<button type="button" class="chip" data-grade="${g.value}">Grade ${g.label}</button>`
    )
    .join("");

  els.quick.gradeButtons.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-grade]");
    if (!btn) return;

    const gradeNum = parseInt(btn.getAttribute("data-grade"), 10);
    await loadGradeRoster(gradeNum);
    setActiveChip(els.quick.gradeButtons, btn);
  });

  els.quick.homeroomButtons.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-hr]");
    if (!btn) return;

    const hr = btn.getAttribute("data-hr");
    loadHomeroomRoster(hr);
    setActiveChip(els.quick.homeroomButtons, btn);
  });

  els.quick.btnSelectAll.addEventListener("click", () => {
    quickState.selectedIds.clear();
    quickState.rosterForHomeroom.forEach((s) => quickState.selectedIds.add(s.id));
    renderRosterList();
  });

  els.quick.btnClearAll.addEventListener("click", () => {
    quickState.selectedIds.clear();
    renderRosterList();
  });

  els.quick.rosterList.addEventListener("change", (e) => {
    const cb = e.target;
    if (!cb || cb.tagName !== "INPUT") return;
    const id = cb.getAttribute("data-id");
    if (!id) return;

    if (cb.checked) quickState.selectedIds.add(id);
    else quickState.selectedIds.delete(id);

    updateRosterMeta();
  });

  els.quick.btnSubmit.addEventListener("click", async () => {
    hideQuickMsgs();

    const minutes = parseInt((els.quick.minutesInput.value || "0").trim(), 10) || 0;
    const note = (els.quick.noteInput.value || "").trim();

    if (quickState.gradeNum === null) {
      showQuickError("Pick a grade first.");
      return;
    }
    if (!quickState.homeroomId) {
      showQuickError("Pick a homeroom.");
      return;
    }
    if (minutes <= 0) {
      showQuickError("Enter minutes greater than 0.");
      return;
    }
    const selected = Array.from(quickState.selectedIds);
    if (selected.length === 0) {
      showQuickError("Select at least one student.");
      return;
    }

    try {
      els.quick.btnSubmit.disabled = true;
      showLoading(els.loadingOverlay, els.loadingText, "Submitting minutes to selected students…");

      const user = await ensureAuthedOrBounce();
      if (!user) return;
      const token = await user.getIdToken(true);

      const schoolId = current.schoolId;
      const dateKey = todayDateKey();

      // Use your existing actionType for minutes workflow
      const actionType = "MINUTES_SUBMIT_PENDING";

      // Concurrency-limited pool so we don't hammer functions too hard
      const results = await runPool(
        selected.map((studentId) => async () => {
          await postSubmitTransaction(token, {
            schoolId,
            targetUserId: studentId,
            actionType,
            deltaMinutes: minutes,
            deltaRubies: 0,
            deltaMoneyRaisedCents: 0,
            note,
            dateKey,
          });
          return studentId;
        }),
        10
      );

      hideLoading(els.loadingOverlay);
      showQuickOk(`Submitted ${minutes} minutes for ${results.length} student(s)! ✅`);

      // convenience: keep roster selections as-is; just clear minutes/note
      els.quick.minutesInput.value = "0";
      els.quick.noteInput.value = "";
    } catch (err) {
      hideLoading(els.loadingOverlay);
      showQuickError(normalizeError(err));
    } finally {
      els.quick.btnSubmit.disabled = false;
    }
  });
}

async function loadGradeRoster(gradeNum) {
  hideQuickMsgs();
  quickState.gradeNum = gradeNum;
  quickState.homeroomId = null;
  quickState.rosterForHomeroom = [];
  quickState.selectedIds.clear();

  els.quick.homeroomButtons.innerHTML = "";
  els.quick.rosterList.innerHTML = "";
  els.quick.rosterMeta.textContent = "Loading roster…";

  try {
    showLoading(els.loadingOverlay, els.loadingText, "Loading roster…");

    const schoolId = current.schoolId;
    const students = await fetchActivePublicStudentsByGrade(schoolId, gradeNum);

    quickState.rosterAllForGrade = Array.isArray(students) ? students : [];

    // Build unique homerooms
    const homerooms = Array.from(
      new Set(quickState.rosterAllForGrade.map((s) => s.homeroomId).filter(Boolean))
    );

    // Render homeroom chips
    els.quick.homeroomButtons.innerHTML =
      homerooms.length === 0
        ? `<div class="muted">No homerooms found for this grade.</div>`
        : homerooms
            .map((hr) => {
              const pretty = prettifyHomeroom(hr);
              return `<button type="button" class="chip" data-hr="${escapeAttr(hr)}">${pretty}</button>`;
            })
            .join("");

    els.quick.rosterMeta.textContent = `Grade ${gradeNum === 0 ? "K" : gradeNum}: pick a homeroom`;
  } catch (err) {
    showQuickError(normalizeError(err));
    els.quick.rosterMeta.textContent = "Couldn’t load roster.";
  } finally {
    hideLoading(els.loadingOverlay);
  }
}

function loadHomeroomRoster(homeroomId) {
  hideQuickMsgs();
  quickState.homeroomId = homeroomId;

  const roster = quickState.rosterAllForGrade.filter((s) => s.homeroomId === homeroomId);

  // Sort by displayName if not already sorted
  roster.sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));

  quickState.rosterForHomeroom = roster;

  // Default: all selected (present)
  quickState.selectedIds.clear();
  roster.forEach((s) => quickState.selectedIds.add(s.id));

  renderRosterList();
}

function renderRosterList() {
  const roster = quickState.rosterForHomeroom;

  if (!roster || roster.length === 0) {
    els.quick.rosterList.innerHTML = `<div class="muted">No students found for this homeroom.</div>`;
    updateRosterMeta();
    return;
  }

  els.quick.rosterList.innerHTML = roster
    .map((s) => {
      const checked = quickState.selectedIds.has(s.id) ? "checked" : "";
      return `
        <label class="rosterRow">
          <input type="checkbox" ${checked} data-id="${escapeAttr(s.id)}" />
          <span class="rosterName">${escapeHtml(s.displayName || s.id)}</span>
          <span class="rosterId muted">${escapeHtml(s.id)}</span>
        </label>
      `;
    })
    .join("");

  updateRosterMeta();
}

function updateRosterMeta() {
  const g = quickState.gradeNum;
  const hr = quickState.homeroomId;

  const gradeLabel = g === null ? "—" : g === 0 ? "K" : String(g);
  const hrLabel = hr ? prettifyHomeroom(hr) : "—";

  const total = quickState.rosterForHomeroom.length || 0;
  const selected = quickState.selectedIds.size || 0;

  els.quick.rosterMeta.textContent = `Grade ${gradeLabel} • ${hrLabel} • Selected: ${selected}/${total}`;
}

function prettifyHomeroom(h) {
  // hr_peterson -> Peterson
  let x = String(h || "");
  if (x.startsWith("hr_")) x = x.slice(3);
  x = x.replace(/[_-]+/g, " ").trim();
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : h;
}

function setActiveChip(container, activeBtn) {
  Array.from(container.querySelectorAll(".chip")).forEach((b) =>
    b.classList.remove("isActive")
  );
  activeBtn.classList.add("isActive");
}

/* =========================================================
   Existing: Individual submit/award form
========================================================= */

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

      const user = await ensureAuthedOrBounce();
      if (!user) return;

      const token = await user.getIdToken(true);

      await postSubmitTransaction(token, {
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

/* =========================================================
   Existing: Homeroom award form
========================================================= */

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

      const user = await ensureAuthedOrBounce();
      if (!user) return;

      const token = await user.getIdToken(true);

      await postAwardHomeroom(token, {
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

/* =========================================================
   HTTP helpers + utilities
========================================================= */

async function postSubmitTransaction(token, payload) {
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
}

async function postAwardHomeroom(token, payload) {
  const resp = await fetch(ENDPOINTS.awardHomeroomHttp, {
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
}

async function runPool(tasks, concurrency = 8) {
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const my = idx++;
      const res = await tasks[my]();
      results.push(res);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
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

/* =========================================================
   Messages (existing + quick)
========================================================= */

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

// Quick messages
function hideQuickMsgs() {
  els.quick.errorBox.classList.add("isHidden");
  els.quick.errorBox.textContent = "";
  els.quick.okBox.classList.add("isHidden");
  els.quick.okBox.textContent = "";
}
function showQuickError(msg) {
  els.quick.errorBox.textContent = msg;
  els.quick.errorBox.classList.remove("isHidden");
}
function showQuickOk(msg) {
  els.quick.okBox.textContent = msg;
  els.quick.okBox.classList.remove("isHidden");
}

/* =========================================================
   Tiny safe HTML helpers
========================================================= */

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#096;");
}