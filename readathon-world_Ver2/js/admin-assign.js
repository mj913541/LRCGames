import {
  auth,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  waitForAuthReady,
  fetchActivePublicStudentsByGrade,
  fetchActivePublicStudentsByHouse,
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

  dataTitle: document.getElementById("dataTitle"),
  dataSubtitle: document.getElementById("dataSubtitle"),

  // Existing direct admin assign fields
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

  // NEW: optional group assign section (same ids/pattern as staff page)
  quick: {
    gradeButtons: document.getElementById("gradeButtons"),
    homeroomButtons: document.getElementById("homeroomButtons"),
    rosterMeta: document.getElementById("rosterMeta"),
    rosterList: document.getElementById("rosterList"),
    btnSelectAll: document.getElementById("btnSelectAll"),
    btnClearAll: document.getElementById("btnClearAll"),

    minutesInput: document.getElementById("quickMinutesInput"),
    rubiesInput: document.getElementById("quickRubiesInput"),
    moneyInput: document.getElementById("quickMoneyInput"),
    noteInput: document.getElementById("quickNoteInput"),
    dateInput: document.getElementById("quickDateInput"),

    btnSubmit: document.getElementById("btnQuickSubmit"),
    btnReset: document.getElementById("btnQuickReset"),

    errorBox: document.getElementById("quickErrorBox"),
    okBox: document.getElementById("quickOkBox"),
  },

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
};

let current = {
  schoolId: null,
  adminId: null,
};

let quickState = {
  gradeNum: null,
  homeroomId: null,
  houseId: null,
  rosterAllForGrade: /** @type {Array<{id:string, displayName:string, grade:number, homeroomId:string, houseId?:string}>} */ ([]),
  rosterForGroup: /** @type {Array<{id:string, displayName:string, grade:number, homeroomId:string, houseId?:string}>} */ ([]),
  selectedIds: new Set(),
};

init().catch((e) => {
  console.error(e);
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

  if (els.dataTitle) els.dataTitle.textContent = "Admin Assign";
  if (els.dataSubtitle) {
    els.dataSubtitle.textContent =
      "Direct admin posting for minutes, rubies, donations, and group awards.";
  }

  if (els.dateInput) els.dateInput.value = todayDateKey();
  if (els.quick.dateInput) els.quick.dateInput.value = todayDateKey();

  wirePreview();
  wireActions();
  wireQuick();

  updatePreview();
  hideLoading(els.loadingOverlay);
}

/* =========================================================
   DIRECT SINGLE-USER ADMIN ASSIGN
========================================================= */

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
  const targetUserId = cleanId(els.targetUserIdInput?.value);
  const minutes = parseInt(els.minutesInput?.value || "0", 10) || 0;
  const rubies = parseInt(els.rubiesInput?.value || "0", 10) || 0;
  const money = parseFloat(els.moneyInput?.value || "0") || 0;
  const dateKey = els.dateInput?.value || todayDateKey();

  if (els.previewTarget) els.previewTarget.textContent = targetUserId || "—";
  if (els.previewMinutes) els.previewMinutes.textContent = String(minutes);
  if (els.previewRubies) els.previewRubies.textContent = String(rubies);
  if (els.previewMoney) els.previewMoney.textContent = fmtMoney(money);
  if (els.previewDate) els.previewDate.textContent = dateKey;
}

async function submitAssignments() {
  hideMsgs();

  const targetUserId = cleanId(els.targetUserIdInput?.value);
  const minutes = parseInt(els.minutesInput?.value || "0", 10) || 0;
  const rubies = parseInt(els.rubiesInput?.value || "0", 10) || 0;
  const moneyDollars = parseFloat(els.moneyInput?.value || "0") || 0;
  const deltaMoneyRaisedCents = Math.round(moneyDollars * 100);
  const note = (els.noteInput?.value || "").trim();
  const dateKey = els.dateInput?.value || todayDateKey();

  if (!targetUserId) return showError("Enter a student user ID.");
  if (minutes === 0 && rubies === 0 && deltaMoneyRaisedCents === 0) {
    return showError("Enter at least one value to assign.");
  }

  showLoading(els.loadingOverlay, els.loadingText, "Posting direct admin assignment…");
  if (els.btnAssign) els.btnAssign.disabled = true;

  try {
    const user = await ensureAuthedOrBounce();
    if (!user) return;

    const token = await user.getIdToken(true);
    await postAllTransactionsForTarget(token, {
      schoolId: current.schoolId,
      targetUserId,
      minutes,
      rubies,
      deltaMoneyRaisedCents,
      note,
      dateKey,
    });

    hideLoading(els.loadingOverlay);
    showOk("Admin assignment posted directly ✅");
    resetForm(false);
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  } finally {
    if (els.btnAssign) els.btnAssign.disabled = false;
  }
}

/* =========================================================
   NEW GROUP ASSIGN SECTION
========================================================= */

function wireQuick() {
  if (
    !els.quick.gradeButtons ||
    !els.quick.homeroomButtons ||
    !els.quick.rosterMeta ||
    !els.quick.rosterList ||
    !els.quick.btnSubmit
  ) {
    return;
  }

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
    .map((g) => `<button type="button" class="chip" data-grade="${g.value}">${g.label}</button>`)
    .join("");

  els.quick.gradeButtons.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-grade]");
    if (!btn) return;

    const gradeVal = btn.getAttribute("data-grade");
    if (gradeVal === "houses") {
      await loadHouseRoster();
    } else {
      const gradeNum = parseInt(gradeVal, 10);
      await loadGradeRoster(gradeNum);
    }

    setActiveChip(els.quick.gradeButtons, btn);
  });

  els.quick.homeroomButtons.addEventListener("click", async (e) => {
    const hrBtn = e.target?.closest?.("button[data-hr]");
    if (hrBtn) {
      const hr = hrBtn.getAttribute("data-hr");
      if (!hr) return;
      loadHomeroomRoster(hr);
      setActiveChip(els.quick.homeroomButtons, hrBtn);
      return;
    }

    const houseBtn = e.target?.closest?.("button[data-house]");
    if (houseBtn) {
      const houseId = houseBtn.getAttribute("data-house");
      if (!houseId) return;
      await loadHouseMembersRoster(houseId);
      setActiveChip(els.quick.homeroomButtons, houseBtn);
    }
  });

  els.quick.btnSelectAll?.addEventListener("click", () => {
    hideQuickMsgs();
    quickState.selectedIds.clear();
    quickState.rosterForGroup.forEach((s) => quickState.selectedIds.add(s.id));
    renderRosterList();
  });

  els.quick.btnClearAll?.addEventListener("click", () => {
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

  els.quick.btnSubmit.addEventListener("click", submitQuickAssignments);
  els.quick.btnReset?.addEventListener("click", resetQuickForm);
}

async function submitQuickAssignments() {
  hideQuickMsgs();

  const minutes = parseInt(els.quick.minutesInput?.value || "0", 10) || 0;
  const rubies = parseInt(els.quick.rubiesInput?.value || "0", 10) || 0;
  const moneyDollars = parseFloat(els.quick.moneyInput?.value || "0") || 0;
  const deltaMoneyRaisedCents = Math.round(moneyDollars * 100);
  const note = (els.quick.noteInput?.value || "").trim();
  const dateKey = els.quick.dateInput?.value || todayDateKey();

  if (quickState.gradeNum === null) return showQuickError("Pick a grade (or Houses) first.");

  const isHouseMode = quickState.gradeNum === "houses";
  if (!isHouseMode && !quickState.homeroomId) return showQuickError("Pick a homeroom.");
  if (isHouseMode && !quickState.houseId) return showQuickError("Pick a house.");

  if (minutes === 0 && rubies === 0 && deltaMoneyRaisedCents === 0) {
    return showQuickError("Enter at least one value to assign.");
  }

  const selected = Array.from(quickState.selectedIds);
  if (selected.length === 0) return showQuickError("Select at least one student.");

  try {
    els.quick.btnSubmit.disabled = true;
    showLoading(els.loadingOverlay, els.loadingText, "Posting group admin assignments…");

    const user = await ensureAuthedOrBounce();
    if (!user) return;

    const token = await user.getIdToken(true);

    const results = await runPool(
      selected.map((studentId) => async () => {
        await postAllTransactionsForTarget(token, {
          schoolId: current.schoolId,
          targetUserId: studentId,
          minutes,
          rubies,
          deltaMoneyRaisedCents,
          note,
          dateKey,
        });
        return studentId;
      }),
      8
    );

    hideLoading(els.loadingOverlay);
    showQuickOk(
      `Admin assignment posted for ${results.length} student(s) ✅`
    );

    if (els.quick.minutesInput) els.quick.minutesInput.value = "0";
    if (els.quick.rubiesInput) els.quick.rubiesInput.value = "0";
    if (els.quick.moneyInput) els.quick.moneyInput.value = "0";
    if (els.quick.noteInput) els.quick.noteInput.value = "";
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showQuickError(normalizeError(err));
  } finally {
    els.quick.btnSubmit.disabled = false;
  }
}

async function loadGradeRoster(gradeNum) {
  hideQuickMsgs();

  quickState.gradeNum = gradeNum;
  quickState.homeroomId = null;
  quickState.houseId = null;
  quickState.rosterForGroup = [];
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

async function loadHouseRoster() {
  hideQuickMsgs();

  quickState.gradeNum = "houses";
  quickState.homeroomId = null;
  quickState.houseId = null;
  quickState.rosterAllForGrade = [];
  quickState.rosterForGroup = [];
  quickState.selectedIds.clear();

  els.quick.rosterList.innerHTML = "";
  els.quick.homeroomButtons.innerHTML = "";

  const houseDefs = [
    { id: "house_altruismo", label: "Altruismo" },
    { id: "house_isibindi", label: "Isibindi" },
    { id: "house_amistad", label: "Amistad" },
    { id: "house_reveur", label: "Reveur" },
  ];

  els.quick.homeroomButtons.innerHTML = houseDefs
    .map((h) => `<button type="button" class="chip" data-house="${escapeAttr(h.id)}">${escapeHtml(h.label)}</button>`)
    .join("");

  els.quick.rosterMeta.textContent = "Houses: pick a house";
}

async function loadHouseMembersRoster(houseId) {
  hideQuickMsgs();

  quickState.houseId = houseId;
  quickState.homeroomId = null;
  quickState.rosterForGroup = [];
  quickState.selectedIds.clear();

  els.quick.rosterList.innerHTML = "";
  els.quick.rosterMeta.textContent = "Loading house roster…";

  try {
    showLoading(els.loadingOverlay, els.loadingText, "Loading house roster…");
    const students = await fetchActivePublicStudentsByHouse(current.schoolId, houseId);
    const roster = Array.isArray(students) ? students : [];

    roster.sort((a, b) =>
      String(a.displayName || "").localeCompare(String(b.displayName || ""))
    );

    quickState.rosterForGroup = roster;
    roster.forEach((s) => quickState.selectedIds.add(s.id));

    renderRosterList();
  } catch (err) {
    showQuickError(normalizeError(err));
    els.quick.rosterMeta.textContent = "Couldn’t load house roster.";
  } finally {
    hideLoading(els.loadingOverlay);
  }
}

function loadHomeroomRoster(homeroomId) {
  hideQuickMsgs();

  quickState.homeroomId = homeroomId;
  quickState.houseId = null;

  const roster = quickState.rosterAllForGrade.filter((s) => s.homeroomId === homeroomId);
  roster.sort((a, b) =>
    String(a.displayName || "").localeCompare(String(b.displayName || ""))
  );

  quickState.rosterForGroup = roster;
  quickState.selectedIds.clear();
  roster.forEach((s) => quickState.selectedIds.add(s.id));

  renderRosterList();
}

function renderRosterList() {
  const roster = quickState.rosterForGroup;

  if (!roster || roster.length === 0) {
    const isHouseMode = quickState.gradeNum === "houses";
    els.quick.rosterList.innerHTML = `<div class="sub" style="margin:0;">No students found for this ${isHouseMode ? "house" : "homeroom"}.</div>`;
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
  const isHouseMode = quickState.gradeNum === "houses";
  const total = quickState.rosterForGroup.length || 0;
  const selected = quickState.selectedIds.size || 0;

  if (isHouseMode) {
    const houseLabel = quickState.houseId ? prettifyHouse(quickState.houseId) : "—";
    els.quick.rosterMeta.textContent = `Houses • ${houseLabel} • Selected: ${selected}/${total}`;
    return;
  }

  const g = quickState.gradeNum;
  const hr = quickState.homeroomId;
  const gradeLabel = g === null ? "—" : g === 0 ? "K" : String(g);
  const hrLabel = hr ? prettifyHomeroom(hr) : "—";
  els.quick.rosterMeta.textContent = `Grade ${gradeLabel} • ${hrLabel} • Selected: ${selected}/${total}`;
}

/* =========================================================
   BACKEND POST HELPERS
========================================================= */

async function postAllTransactionsForTarget(
  token,
  { schoolId, targetUserId, minutes, rubies, deltaMoneyRaisedCents, note, dateKey }
) {
  const jobs = [];

  if (minutes !== 0) {
    jobs.push(
      postTransaction(token, {
        schoolId,
        targetUserId,
        actionType: "ADMIN_MINUTES_ASSIGN",
        deltaMinutes: minutes,
        deltaRubies: 0,
        deltaMoneyRaisedCents: 0,
        note: note || "Admin direct minutes assignment",
        dateKey,
      })
    );
  }

  if (rubies > 0) {
    jobs.push(
      postTransaction(token, {
        schoolId,
        targetUserId,
        actionType: "RUBIES_AWARD",
        deltaMinutes: 0,
        deltaRubies: rubies,
        deltaMoneyRaisedCents: 0,
        note: note || "Admin ruby award",
        dateKey,
      })
    );
  }

  if (rubies < 0) {
    jobs.push(
      postTransaction(token, {
        schoolId,
        targetUserId,
        actionType: "RUBIES_SPEND",
        deltaMinutes: 0,
        deltaRubies: rubies,
        deltaMoneyRaisedCents: 0,
        note: note || "Admin ruby adjustment",
        dateKey,
      })
    );
  }

  if (deltaMoneyRaisedCents !== 0) {
    jobs.push(
      postTransaction(token, {
        schoolId,
        targetUserId,
        actionType: "ADMIN_DONATION_ASSIGN",
        deltaMinutes: 0,
        deltaRubies: 0,
        deltaMoneyRaisedCents,
        note: note || "Admin donation assignment",
        dateKey,
      })
    );
  }

  await Promise.all(jobs);
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

/* =========================================================
   RESETS / MESSAGES
========================================================= */

function resetForm(update = true) {
  if (els.targetUserIdInput) els.targetUserIdInput.value = "";
  if (els.minutesInput) els.minutesInput.value = "0";
  if (els.rubiesInput) els.rubiesInput.value = "0";
  if (els.moneyInput) els.moneyInput.value = "0";
  if (els.dateInput) els.dateInput.value = todayDateKey();
  if (els.noteInput) els.noteInput.value = "";

  hideMsgs();
  if (update) updatePreview();
  else updatePreview();
}

function resetQuickForm() {
  if (els.quick.minutesInput) els.quick.minutesInput.value = "0";
  if (els.quick.rubiesInput) els.quick.rubiesInput.value = "0";
  if (els.quick.moneyInput) els.quick.moneyInput.value = "0";
  if (els.quick.dateInput) els.quick.dateInput.value = todayDateKey();
  if (els.quick.noteInput) els.quick.noteInput.value = "";

  quickState.gradeNum = null;
  quickState.homeroomId = null;
  quickState.houseId = null;
  quickState.rosterAllForGrade = [];
  quickState.rosterForGroup = [];
  quickState.selectedIds.clear();

  if (els.quick.gradeButtons) {
    Array.from(els.quick.gradeButtons.querySelectorAll(".chip")).forEach((b) =>
      b.classList.remove("isActive")
    );
  }
  if (els.quick.homeroomButtons) els.quick.homeroomButtons.innerHTML = "";
  if (els.quick.rosterList) els.quick.rosterList.innerHTML = "";
  if (els.quick.rosterMeta) els.quick.rosterMeta.textContent = "Pick a grade or house to begin.";

  hideQuickMsgs();
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

function hideQuickMsgs() {
  if (els.quick.errorBox) {
    els.quick.errorBox.textContent = "";
    els.quick.errorBox.classList.add("isHidden");
  }
  if (els.quick.okBox) {
    els.quick.okBox.textContent = "";
    els.quick.okBox.classList.add("isHidden");
  }
}

function showQuickError(msg) {
  if (!els.quick.errorBox) return;
  els.quick.errorBox.textContent = msg;
  els.quick.errorBox.classList.remove("isHidden");
}

function showQuickOk(msg) {
  if (!els.quick.okBox) return;
  els.quick.okBox.textContent = msg;
  els.quick.okBox.classList.remove("isHidden");
}

/* =========================================================
   UTILS
========================================================= */

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

function prettifyHouse(h) {
  let x = String(h || "");
  if (x.startsWith("house_")) x = x.slice(6);
  x = x.replace(/[_-]+/g, " ").trim();
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : h;
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