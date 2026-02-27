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
  // keep using your existing HTTP endpoint, but we'll enforce minutes-only on the server
  submitTransactionHttp:
    "https://us-central1-lrcquest-3039e.cloudfunctions.net/submitTransactionHttp",
};

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  // Quick roster submit
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

  // Self submit
  selfIdLabel: document.getElementById("selfIdLabel"),
  selfMinutesInput: document.getElementById("selfMinutesInput"),
  selfNoteInput: document.getElementById("selfNoteInput"),
  btnSelfSubmit: document.getElementById("btnSelfSubmit"),
  selfErrorBox: document.getElementById("selfErrorBox"),
  selfOkBox: document.getElementById("selfOkBox"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
};

let current = { schoolId: null, staffId: null };

let quickState = {
  gradeNum: null,
  homeroomId: null,
  rosterAllForGrade: /** @type {Array<{id:string, displayName:string, grade:number, homeroomId:string}>} */ ([]),
  rosterForHomeroom: /** @type {Array<{id:string, displayName:string, grade:number, homeroomId:string}>} */ ([]),
  selectedIds: new Set(),
};

init().catch((e) => {
  console.error(e);
  hideLoading(els.loadingOverlay);
  showSelfError(normalizeError(e));
});

async function ensureAuthedOrBounce() {
  const user = await waitForAuthReady();
  if (!user) {
    window.location.href = ABS.staffLogin;
    return null;
  }
  await user.getIdToken(true);
  return user;
}

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading…");

  const claims = await guardRoleOrRedirect(["staff", "admin"], ABS.staffLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  current.schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;

  // IMPORTANT: prefer your own “staff_lastname” userId claim
  current.staffId =
    (claims.userId ||
      localStorage.getItem("readathonV2_userId") ||
      auth.currentUser?.uid ||
      "").trim().toLowerCase();

  setHeaderUser(els.hdr, {
    title: "Submit Minutes",
    subtitle: `${current.schoolId} • ${current.staffId}`,
  });

  els.selfIdLabel.textContent = current.staffId;

  wireQuick();
  wireSelf();

  hideLoading(els.loadingOverlay);
}

/* =========================
   Self submit
========================= */

function wireSelf() {
  els.btnSelfSubmit.addEventListener("click", async () => {
    hideSelfMsgs();

    const minutes = parseInt((els.selfMinutesInput.value || "0").trim(), 10) || 0;
    const note = (els.selfNoteInput.value || "").trim();

    if (minutes <= 0) return showSelfError("Enter minutes greater than 0.");

    try {
      els.btnSelfSubmit.disabled = true;
      showLoading(els.loadingOverlay, els.loadingText, "Submitting…");

      const user = await ensureAuthedOrBounce();
      if (!user) return;

      const token = await user.getIdToken(true);

      await postSubmitMinutes(token, {
        schoolId: current.schoolId,
        targetUserId: current.staffId,
        deltaMinutes: minutes,
        note,
        dateKey: todayDateKey(),
      });

      hideLoading(els.loadingOverlay);
      showSelfOk(`Submitted ${minutes} pending minute(s) for you ✅`);
      els.selfMinutesInput.value = "0";
      els.selfNoteInput.value = "";
    } catch (err) {
      hideLoading(els.loadingOverlay);
      showSelfError(normalizeError(err));
    } finally {
      els.btnSelfSubmit.disabled = false;
    }
  });
}

/* =========================
   Quick roster submit
========================= */

function wireQuick() {
  const gradeDefs = [
    { label: "EC & K", value: 0 },
    { label: "1st", value: 1 },
    { label: "2nd", value: 2 },
    { label: "3rd", value: 3 },
    { label: "4th", value: 4 },
    { label: "5th", value: 5 },
    { label: "Houses", value: "houses" },
  ];

  els.quick.gradeButtons.innerHTML = gradeDefs
    .map((g) => `<button type="button" class="chip" data-grade="${g.value}"> ${g.label}</button>`)
    .join("");

  els.quick.gradeButtons.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-grade]");
    if (!btn) return;
const gradeVal = btn.getAttribute("data-grade");
if (gradeVal === "houses") {
  await loadHouseRoster(); // we will create this next step
} else {
  const gradeNum = parseInt(gradeVal, 10);
  await loadGradeRoster(gradeNum);
}
    setActiveChip(els.quick.gradeButtons, btn);
  });

  els.quick.homeroomButtons.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-hr]");
    if (!btn) return;
    const hr = btn.getAttribute("data-hr");
    if (!hr) return;
    loadHomeroomRoster(hr);
    setActiveChip(els.quick.homeroomButtons, btn);
  });

  els.quick.btnSelectAll.addEventListener("click", () => {
    hideQuickMsgs();
    quickState.selectedIds.clear();
    quickState.rosterForHomeroom.forEach((s) => quickState.selectedIds.add(s.id));
    renderRosterList();
  });

  els.quick.btnClearAll.addEventListener("click", () => {
    hideQuickMsgs();
    quickState.selectedIds.clear();
    renderRosterList();
  });

  els.quick.rosterList.addEventListener("change", (e) => {
    const cb = e.target;
    if (!cb || cb.tagName !== "INPUT" || cb.type !== "checkbox") return;
    const id = cb.getAttribute("data-id");
    if (!id) return;
    cb.checked ? quickState.selectedIds.add(id) : quickState.selectedIds.delete(id);
    updateRosterMeta();
  });

  els.quick.btnSubmit.addEventListener("click", async () => {
    hideQuickMsgs();

    const minutes = parseInt((els.quick.minutesInput.value || "0").trim(), 10) || 0;
    const note = (els.quick.noteInput.value || "").trim();

    if (quickState.gradeNum === null) return showQuickError("Pick a grade first.");
    if (!quickState.homeroomId) return showQuickError("Pick a homeroom.");
    if (minutes <= 0) return showQuickError("Enter minutes greater than 0.");

    const selected = Array.from(quickState.selectedIds);
    if (selected.length === 0) return showQuickError("Select at least one student.");

    try {
      els.quick.btnSubmit.disabled = true;
      showLoading(els.loadingOverlay, els.loadingText, "Submitting to selected students…");

      const user = await ensureAuthedOrBounce();
      if (!user) return;
      const token = await user.getIdToken(true);

      // run small pool to avoid hammering functions
      const results = await runPool(
        selected.map((studentId) => async () => {
          await postSubmitMinutes(token, {
            schoolId: current.schoolId,
            targetUserId: studentId,
            deltaMinutes: minutes,
            note,
            dateKey: todayDateKey(),
          });
          return studentId;
        }),
        10
      );

      hideLoading(els.loadingOverlay);
      showQuickOk(`Submitted ${minutes} pending minute(s) for ${results.length} student(s) ✅`);
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
    const students = await fetchActivePublicStudentsByGrade(current.schoolId, gradeNum);
    quickState.rosterAllForGrade = Array.isArray(students) ? students : [];

    const counts = new Map();
    for (const s of quickState.rosterAllForGrade) {
      if (!s?.homeroomId) continue;
      counts.set(s.homeroomId, (counts.get(s.homeroomId) || 0) + 1);
    }

    const homerooms = Array.from(counts.keys());
    els.quick.homeroomButtons.innerHTML =
      homerooms.length === 0
        ? `<div class="sub" style="margin:0;">No homerooms found for this grade.</div>`
        : homerooms
            .map((hr) => {
              const pretty = prettifyHomeroom(hr);
              const n = counts.get(hr) || 0;
              return `<button type="button" class="chip" data-hr="${escapeAttr(hr)}">${escapeHtml(pretty)} (${n})</button>`;
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
  roster.sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));

  quickState.rosterForHomeroom = roster;
  quickState.selectedIds.clear();
  roster.forEach((s) => quickState.selectedIds.add(s.id));

  renderRosterList();
}

function renderRosterList() {
  const roster = quickState.rosterForHomeroom;

  if (!roster || roster.length === 0) {
    els.quick.rosterList.innerHTML = `<div class="sub" style="margin:0;">No students found for this homeroom.</div>`;
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
          <span class="rosterId">${escapeHtml(s.id)}</span>
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
  let x = String(h || "");
  if (x.startsWith("hr_")) x = x.slice(3);
  x = x.replace(/[_-]+/g, " ").trim();
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : h;
}

function setActiveChip(container, activeBtn) {
  Array.from(container.querySelectorAll(".chip")).forEach((b) => b.classList.remove("isActive"));
  activeBtn.classList.add("isActive");
}

/* =========================
   Backend call: MINUTES ONLY
========================= */

async function postSubmitMinutes(token, { schoolId, targetUserId, deltaMinutes, note, dateKey }) {
  const payload = {
    schoolId,
    targetUserId,
    actionType: "MINUTES_SUBMIT_PENDING",
    deltaMinutes,
    deltaRubies: 0,
    deltaMoneyRaisedCents: 0,
    note,
    dateKey,
  };

  const resp = await fetch(ENDPOINTS.submitTransactionHttp, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

/* =========================
   Messages
========================= */

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

function hideSelfMsgs() {
  els.selfErrorBox.classList.add("isHidden");
  els.selfErrorBox.textContent = "";
  els.selfOkBox.classList.add("isHidden");
  els.selfOkBox.textContent = "";
}
function showSelfError(msg) {
  els.selfErrorBox.textContent = msg;
  els.selfErrorBox.classList.remove("isHidden");
}
function showSelfOk(msg) {
  els.selfOkBox.textContent = msg;
  els.selfOkBox.classList.remove("isHidden");
}

/* =========================
   Utils
========================= */

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

function todayDateKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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
