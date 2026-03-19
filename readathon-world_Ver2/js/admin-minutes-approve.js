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

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase.js";

console.log("✅ LOADED admin-minutes-approve.js (HTTP)");

const LARGE_MINUTES_THRESHOLD = 120;
const MULTI_REQUEST_DAY_THRESHOLD = 3;

const ENDPOINTS = {
  approvePendingMinutesHttp:
    "https://us-central1-lrcquest-3039e.cloudfunctions.net/approvePendingMinutesHttp",

  rejectPendingMinutesHttp:
    "https://us-central1-lrcquest-3039e.cloudfunctions.net/rejectPendingMinutesHttp",
};

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  list: document.getElementById("pendingList"),
  emptyNote: document.getElementById("emptyNote"),

  btnRefresh: document.getElementById("btnRefresh"),
  btnApproveSafeOnly: document.getElementById("btnApproveSafeOnly"),
  countLabel: document.getElementById("countLabel"),
  limitSelect: document.getElementById("limitSelect"),
  searchInput: document.getElementById("searchInput"),
  suspiciousOnly: document.getElementById("suspiciousOnly"),
  summaryCards: document.getElementById("summaryCards"),

  errorBox: document.getElementById("errorBox"),
  okBox: document.getElementById("okBox"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
};

let ctx = {
  schoolId: null,
  adminId: null,
  rows: [],
  nameMapStudents: {},
  nameMapUsers: {},
  roleMapUsers: {},
  collapsedStudents: new Set(),
};

init().catch((e) => showError(normalizeError(e)));

async function ensureAuthedOrBounce() {
  const user = await waitForAuthReady();
  if (!user) {
    window.location.href = ABS.adminLogin;
    return null;
  }
  await user.getIdToken(true);
  return user;
}

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading…");

  const claims = await guardRoleOrRedirect(["admin"], ABS.adminLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const adminId =
    auth.currentUser?.uid ||
    claims.userId ||
    localStorage.getItem("readathonV2_userId") ||
    "";

  ctx.schoolId = schoolId;
  ctx.adminId = adminId;

  setHeaderUser(els.hdr, {
    title: "Approve Minutes",
    subtitle: `${schoolId} • ${adminId}`,
  });

  if (els.btnRefresh) els.btnRefresh.addEventListener("click", refreshPending);
  if (els.limitSelect) els.limitSelect.addEventListener("change", refreshPending);
  if (els.suspiciousOnly) els.suspiciousOnly.addEventListener("change", applyClientFilterAndRender);
  if (els.btnApproveSafeOnly) els.btnApproveSafeOnly.addEventListener("click", approveAllSafeShown);

  if (els.searchInput) {
    els.searchInput.addEventListener(
      "input",
      debounce(() => applyClientFilterAndRender(), 200)
    );
  }

  injectApproveAllButton();

  await refreshPending();

  hideLoading(els.loadingOverlay);
}

function injectApproveAllButton() {
  const bar = els.hdr?.querySelector?.(".approveBar");
  if (!bar) return;
  if (bar.querySelector("#btnApproveAll")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "btnApproveAll";
  btn.className = "btnBig btnBig--primary";
  btn.textContent = "✅✅ Approve All (shown)";
  btn.addEventListener("click", approveAllShown);

  const refreshBtn = bar.querySelector("#btnRefresh");
  if (refreshBtn?.nextSibling) {
    bar.insertBefore(btn, refreshBtn.nextSibling);
  } else {
    bar.appendChild(btn);
  }
}

async function refreshPending() {
  hideMsgs();
  showLoading(els.loadingOverlay, els.loadingText, "Loading pending minutes…");

  try {
    const schoolId = ctx.schoolId;
    const lim = parseInt(els.limitSelect?.value || "50", 10) || 50;

    const txCol = collection(db, `readathonV2_schools/${schoolId}/transactions`);
    const qRef = query(
      txCol,
      where("actionType", "==", "MINUTES_SUBMIT_PENDING"),
      where("status", "==", "PENDING"),
      orderBy("dateKey", "desc"),
      limit(Math.min(Math.max(lim, 1), 200))
    );

    const snap = await getDocs(qRef);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    ctx.rows = rows;
    ctx.nameMapStudents = await buildStudentNameMap(schoolId, rows);

    const userMeta = await buildUserMetaMap(schoolId, rows);
    ctx.nameMapUsers = userMeta.nameMap;
    ctx.roleMapUsers = userMeta.roleMap;

    syncCollapsedStateWithRows(rows);
    applyClientFilterAndRender();

    hideLoading(els.loadingOverlay);
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  }
}

function syncCollapsedStateWithRows(rows) {
  const validIds = new Set(rows.map((r) => safeText(r.targetUserId)).filter(Boolean));
  const next = new Set();

  for (const id of ctx.collapsedStudents) {
    if (validIds.has(id)) next.add(id);
  }

  ctx.collapsedStudents = next;
}

function applyClientFilterAndRender() {
  const q = (els.searchInput?.value || "").trim().toLowerCase();
  const suspiciousOnly = Boolean(els.suspiciousOnly?.checked);
  const analyzed = analyzeRows(ctx.rows);

  const filtered = analyzed.filter(({ tx, flags }) => {
    const studentId = String(tx.targetUserId || "").toLowerCase();
    const studentName = String(ctx.nameMapStudents[tx.targetUserId] || "").toLowerCase();
    const requesterId = String(tx.submittedByUserId || "").toLowerCase();
    const requesterName = String(ctx.nameMapUsers[tx.submittedByUserId] || "").toLowerCase();
    const note = String(tx.note || "").toLowerCase();

    const matchesSearch = !q || (
      studentId.includes(q) ||
      studentName.includes(q) ||
      requesterId.includes(q) ||
      requesterName.includes(q) ||
      note.includes(q)
    );

    const matchesSuspicious = !suspiciousOnly || flags.length > 0;
    return matchesSearch && matchesSuspicious;
  });

  renderSummaryCards(filtered, analyzed);
  renderPendingGrouped(filtered, ctx.nameMapStudents, ctx.nameMapUsers);
  setCountLabel(filtered.length, ctx.rows.length, suspiciousOnly);
}

function renderSummaryCards(filteredRows, allRows) {
  if (!els.summaryCards) return;

  const totalShown = filteredRows.length;
  const suspiciousShown = filteredRows.filter((r) => r.flags.length).length;
  const safeShown = filteredRows.filter((r) => !r.flags.length).length;
  const largeEntries = allRows.filter((r) => r.flags.some((f) => f.code === "large_minutes")).length;
  const missingContext = allRows.filter((r) => r.flags.some((f) => f.code === "missing_context")).length;
  const multiSameDay = allRows.filter((r) => r.flags.some((f) => f.code === "multi_same_day")).length;

  els.summaryCards.innerHTML = `
    <div class="panel" style="padding:12px;">
      <div class="sub"><strong>${totalShown}</strong> shown right now</div>
    </div>
    <div class="panel" style="padding:12px;">
      <div class="sub"><strong>${suspiciousShown}</strong> need review</div>
    </div>
    <div class="panel" style="padding:12px;">
      <div class="sub"><strong>${safeShown}</strong> look safe</div>
    </div>
    <div class="panel" style="padding:12px;">
      <div class="sub">⚠ ${largeEntries} large entries</div>
    </div>
    <div class="panel" style="padding:12px;">
      <div class="sub">📝 ${missingContext} missing context</div>
    </div>
    <div class="panel" style="padding:12px;">
      <div class="sub">📅 ${multiSameDay} repeat same-day logs</div>
    </div>
  `;
}

function setCountLabel(shownCount, totalCount, suspiciousOnly) {
  if (els.countLabel) {
    const q = (els.searchInput?.value || "").trim();
    let text = q
      ? `Showing ${shownCount} of ${totalCount} (filtered)`
      : `Showing ${shownCount}`;

    if (suspiciousOnly) text += " • suspicious only";
    els.countLabel.textContent = text;
  }

  if (els.emptyNote) {
    if (shownCount === 0) els.emptyNote.classList.remove("isHidden");
    else els.emptyNote.classList.add("isHidden");
  }
}

function analyzeRows(rows) {
  const perStudentDateCounts = new Map();

  for (const tx of rows) {
    const studentId = safeText(tx.targetUserId || "");
    const dateKey = safeText(tx.dateKey || "");
    const k = `${studentId}__${dateKey}`;
    perStudentDateCounts.set(k, (perStudentDateCounts.get(k) || 0) + 1);
  }

  return rows.map((tx) => {
    const parsed = parseStructuredNote(tx.note || "");
    const flags = [];
    const minutes = Number(tx.deltaMinutes || 0);
    const studentId = safeText(tx.targetUserId || "");
    const dateKey = safeText(tx.dateKey || "");
    const submittedByUserId = safeText(tx.submittedByUserId || "");
    const submitterRole = safeText(ctx.roleMapUsers?.[submittedByUserId] || "").toLowerCase();
    const submittedByStaff = submitterRole === "staff";
    const sameDayCount = perStudentDateCounts.get(`${studentId}__${dateKey}`) || 0;

    if (!submittedByStaff) {
      if (minutes > LARGE_MINUTES_THRESHOLD) {
        flags.push({ code: "large_minutes", label: `Large Entry (${minutes} min)` });
      }

      if (sameDayCount >= MULTI_REQUEST_DAY_THRESHOLD) {
        flags.push({ code: "multi_same_day", label: `${sameDayCount} Entries Same Day` });
      }

      const hasContext = Boolean(
        parsed.type ||
        parsed.book ||
        parsed.note ||
        parsed.reflection ||
        (tx.note || "").trim()
      );

      if (!hasContext) {
        flags.push({ code: "missing_context", label: "No Note / Context" });
      }

      if (parsed.type === "Chapter Book") {
        if (!parsed.book) {
          flags.push({ code: "missing_book", label: "Chapter Book Missing Title" });
        }
        if (!(parsed.pages && parsed.pagesRead !== "")) {
          flags.push({ code: "missing_pages", label: "Chapter Book Missing Pages" });
        }
      }
    }

    return {
      tx,
      flags,
      parsed,
      sameDayCount,
      submittedByStaff,
    };
  });
}

function renderPendingGrouped(analyzedRows, studentNameMap = {}, userNameMap = {}) {
  if (!els.list) return;
  els.list.innerHTML = "";

  if (!analyzedRows.length) {
    els.list.innerHTML = `<div class="panel">No pending minutes 🎉</div>`;
    return;
  }

  const groups = new Map();

  for (const row of analyzedRows) {
    const studentId = safeText(row.tx.targetUserId || "");
    if (!studentId) continue;

    if (!groups.has(studentId)) groups.set(studentId, []);
    groups.get(studentId).push(row);
  }

  const sortedStudentIds = Array.from(groups.keys()).sort((a, b) => {
    const nameA = safeText(studentNameMap[a] || a).toLowerCase();
    const nameB = safeText(studentNameMap[b] || b).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  for (const studentId of sortedStudentIds) {
    const studentName = safeText(studentNameMap[studentId] || studentId);
    const txs = groups.get(studentId) || [];

    txs.sort((a, b) => safeText(b.tx.dateKey || "").localeCompare(safeText(a.tx.dateKey || "")));

    const totalMinutes = txs.reduce((sum, row) => sum + Number(row.tx.deltaMinutes || 0), 0);
    const totalFlags = txs.reduce((sum, row) => sum + row.flags.length, 0);
    const suspiciousCount = txs.filter((row) => row.flags.length).length;
    const isCollapsed = ctx.collapsedStudents.has(studentId);

    const groupWrap = document.createElement("div");
    groupWrap.className = "pendingGroupWrap";

    const head = document.createElement("div");
    head.className = "panel pendingGroupHead";
    head.innerHTML = `
      <div class="pendingGroupHead__row">
        <button
          type="button"
          class="pendingGroupHead__toggle"
          data-toggle-student="${escapeAttr(studentId)}"
          aria-expanded="${isCollapsed ? "false" : "true"}"
          title="${isCollapsed ? "Expand group" : "Collapse group"}"
        >
          ${isCollapsed ? "▶" : "▼"}
        </button>

        <div class="pendingGroupHead__main">
          <div class="pendingGroupHead__name">${escapeHtml(studentName)}</div>
          <div class="pendingGroupHead__meta">
            <span class="pendingPill pendingPill--id">${escapeHtml(studentId)}</span>
            <span class="pendingPill">${txs.length} request(s)</span>
            <span class="pendingPill pendingPill--minutes">${totalMinutes} min total</span>
            ${suspiciousCount ? `<span class="pendingPill">⚠ ${suspiciousCount} suspicious</span>` : `<span class="pendingPill">✅ looks normal</span>`}
            ${totalFlags ? `<span class="pendingPill">${totalFlags} flag(s)</span>` : ""}
          </div>
        </div>

        <div class="pendingGroupHead__actions">
          <button class="btn pendingGroupHead__btn" data-toggle-label="${escapeAttr(studentId)}" type="button">
            ${isCollapsed ? "Expand" : "Collapse"}
          </button>

          <button class="btn pendingGroupHead__btn" data-approve-safe-student="${escapeAttr(studentId)}" type="button">
            Approve Safe Only ✅
          </button>

          <button class="btn pendingGroupHead__btn" data-approve-student="${escapeAttr(studentId)}" type="button">
            Approve All for Student ✅✅
          </button>
        </div>
      </div>
    `;

    groupWrap.appendChild(head);

    const body = document.createElement("div");
    body.className = `pendingGroupBody${isCollapsed ? " isHidden" : ""}`;
    body.setAttribute("data-student-body", studentId);

    for (const row of txs) {
      const { tx, flags, parsed, sameDayCount, submittedByStaff } = row;
      const div = document.createElement("div");
      div.className = "panel pendingChildRow";

      const mins = Number(tx.deltaMinutes || 0);
      const dateKey = safeText(tx.dateKey || "");
      const requesterId = safeText(tx.submittedByUserId || "");
      const requesterNice = requesterId ? safeText(userNameMap[requesterId] || requesterId) : "";
      const safeStatus = flags.length ? "needs-review" : "safe";

      const detailBits = [];
      if (parsed.type) detailBits.push(`Type: ${parsed.type}`);
      if (parsed.book) detailBits.push(`Book: ${parsed.book}`);
      if (parsed.pages) detailBits.push(`Pages: ${parsed.pages}`);
      if (parsed.pagesRead !== "") detailBits.push(`Pages Read: ${parsed.pagesRead}`);
      if (parsed.note) detailBits.push(`Note: ${parsed.note}`);
      if (parsed.reflection) detailBits.push(`Reflection: ${parsed.reflection}`);
      if (!detailBits.length && tx.note) detailBits.push(tx.note);

      div.innerHTML = `
        <div class="pendingChildRow__wrap" data-safe-status="${safeStatus}">
          <div class="pendingChildRow__left">
            <div class="pendingChildRow__mins">${mins} min</div>

            <div class="pendingChildRow__meta">
              <span>${escapeHtml(dateKey)}</span>
              ${sameDayCount >= MULTI_REQUEST_DAY_THRESHOLD ? `<span>• ${sameDayCount} request(s) this day</span>` : ""}
              ${requesterNice ? `<span>• Requested by ${escapeHtml(requesterNice)}</span>` : ""}
            </div>

            ${requesterId ? `<div class="pendingChildRow__id">${escapeHtml(requesterId)}</div>` : ""}

            ${flags.length
              ? `<div class="pendingChildRow__meta" style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">${flags.map((f) => `<span class="pendingPill">⚠ ${escapeHtml(f.label)}</span>`).join("")}</div>`
              : `<div class="pendingChildRow__meta" style="margin-top:8px;"><span class="pendingPill">✅ ${submittedByStaff ? "Auto-safe (staff submitted)" : "Safe-looking entry"}</span></div>`
            }

            ${detailBits.length ? `<div class="pendingChildRow__meta" style="margin-top:8px; display:block; line-height:1.5;">${detailBits.map((bit) => `<div>${escapeHtml(bit)}</div>`).join("")}</div>` : ""}
          </div>

          <div class="pendingChildRow__actions">
            <button class="btn" data-approve="${tx.id}" type="button">Approve ✅</button>
            <button class="btn" data-reject="${tx.id}" type="button">Reject ❌</button>
          </div>
        </div>
      `;

      const approveBtn = div.querySelector(`[data-approve="${tx.id}"]`);
      const rejectBtn = div.querySelector(`[data-reject="${tx.id}"]`);

      if (approveBtn) approveBtn.addEventListener("click", () => approveTx(tx.id));
      if (rejectBtn) rejectBtn.addEventListener("click", () => rejectTx(tx.id));

      body.appendChild(div);
    }

    groupWrap.appendChild(body);
    els.list.appendChild(groupWrap);

    const toggleBtn = head.querySelector(`[data-toggle-student="${escapeAttr(studentId)}"]`);
    const toggleLabelBtn = head.querySelector(`[data-toggle-label="${escapeAttr(studentId)}"]`);
    const approveStudentBtn = head.querySelector(`[data-approve-student="${escapeAttr(studentId)}"]`);
    const approveSafeStudentBtn = head.querySelector(`[data-approve-safe-student="${escapeAttr(studentId)}"]`);

    if (toggleBtn) toggleBtn.addEventListener("click", () => toggleStudentGroup(studentId));
    if (toggleLabelBtn) toggleLabelBtn.addEventListener("click", () => toggleStudentGroup(studentId));
    if (approveStudentBtn) approveStudentBtn.addEventListener("click", () => approveAllForStudent(txs.map((r) => r.tx)));
    if (approveSafeStudentBtn) approveSafeStudentBtn.addEventListener("click", () => approveSafeForStudent(txs));
  }
}

function toggleStudentGroup(studentId) {
  if (!studentId) return;

  if (ctx.collapsedStudents.has(studentId)) ctx.collapsedStudents.delete(studentId);
  else ctx.collapsedStudents.add(studentId);

  applyClientFilterAndRender();
}

async function approveTx(txId) {
  hideMsgs();
  showLoading(els.loadingOverlay, els.loadingText, "Approving…");

  try {
    const user = await ensureAuthedOrBounce();
    if (!user) return;

    const token = await user.getIdToken(true);

    const resp = await fetch(ENDPOINTS.approvePendingMinutesHttp, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ schoolId: ctx.schoolId, txId }),
    });

    if (!resp.ok) throw new Error(await readHttpError(resp));

    hideLoading(els.loadingOverlay);
    showOk("Approved! ✅");
    await refreshPending();
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  }
}

async function rejectTx(txId) {
  hideMsgs();

  const reason = window.prompt("Reject reason (optional):", "");
  if (reason === null) return;

  showLoading(els.loadingOverlay, els.loadingText, "Rejecting…");

  try {
    const user = await ensureAuthedOrBounce();
    if (!user) return;

    const token = await user.getIdToken(true);

    const resp = await fetch(ENDPOINTS.rejectPendingMinutesHttp, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ schoolId: ctx.schoolId, txId, reason }),
    });

    if (!resp.ok) throw new Error(await readHttpError(resp));

    hideLoading(els.loadingOverlay);
    showOk("Rejected ✅");
    await refreshPending();
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  }
}

async function approveAllShown() {
  hideMsgs();

  const ids = Array.from(els.list?.querySelectorAll?.("button[data-approve]") || [])
    .map((b) => b.getAttribute("data-approve"))
    .filter(Boolean);

  if (!ids.length) {
    showOk("Nothing to approve 🎉");
    return;
  }

  await approveBatchByIds(ids, `Approving ${ids.length} shown item(s)…`, `Approved ${ids.length} item(s)! ✅✅`);
}

async function approveAllSafeShown() {
  hideMsgs();

  const ids = Array.from(els.list?.querySelectorAll?.('[data-safe-status="safe"] button[data-approve]') || [])
    .map((b) => b.getAttribute("data-approve"))
    .filter(Boolean);

  if (!ids.length) {
    showOk("No safe-looking entries are showing right now.");
    return;
  }

  await approveBatchByIds(ids, `Approving ${ids.length} safe-looking item(s)…`, `Approved ${ids.length} safe-looking item(s)! ✅`);
}

async function approveAllForStudent(txs) {
  if (!Array.isArray(txs) || !txs.length) return;
  const ids = txs.map((tx) => tx.id).filter(Boolean);
  await approveBatchByIds(ids, "Approving this student's requests…", `Approved ${ids.length} request(s) for this student ✅✅`);
}

async function approveSafeForStudent(rows) {
  const ids = rows.filter((row) => !row.flags.length).map((row) => row.tx.id).filter(Boolean);
  if (!ids.length) {
    showOk("This student does not have any safe-looking entries to auto-approve.");
    return;
  }
  await approveBatchByIds(ids, "Approving this student's safe-looking requests…", `Approved ${ids.length} safe-looking request(s) ✅`);
}

async function approveBatchByIds(ids, loadingText, successText) {
  if (!ids.length) return;

  showLoading(els.loadingOverlay, els.loadingText, loadingText);

  try {
    const user = await ensureAuthedOrBounce();
    if (!user) return;

    const token = await user.getIdToken(true);

    let okCount = 0;
    for (const txId of ids) {
      const resp = await fetch(ENDPOINTS.approvePendingMinutesHttp, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ schoolId: ctx.schoolId, txId }),
      });

      if (!resp.ok) throw new Error(await readHttpError(resp));

      okCount += 1;
      showLoading(els.loadingOverlay, els.loadingText, `${loadingText} (${okCount}/${ids.length})`);
    }

    hideLoading(els.loadingOverlay);
    showOk(successText);
    await refreshPending();
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  }
}

async function buildStudentNameMap(schoolId, rows) {
  const ids = Array.from(new Set(rows.map((r) => r.targetUserId).filter(Boolean)));
  const map = {};

  await runPool(
    ids.map((id) => async () => {
      try {
        const ref = doc(db, `readathonV2_schools/${schoolId}/publicStudents/${id}`);
        const s = await getDoc(ref);
        const d = s.exists() ? s.data() : null;
        map[id] = d?.displayName || id;
      } catch {
        map[id] = id;
      }
    }),
    15
  );

  return map;
}

async function buildUserMetaMap(schoolId, rows) {
  const ids = Array.from(new Set(rows.map((r) => r.submittedByUserId).filter(Boolean)));
  const nameMap = {};
  const roleMap = {};

  await runPool(
    ids.map((id) => async () => {
      try {
        const ref = doc(db, `readathonV2_schools/${schoolId}/users/${id}`);
        const s = await getDoc(ref);
        const d = s.exists() ? s.data() : null;

        nameMap[id] = d?.displayName || d?.name || d?.fullName || d?.email || id;

        roleMap[id] = (
          d?.role ||
          d?.userType ||
          d?.type ||
          ""
        ).toString().trim().toLowerCase();
      } catch {
        nameMap[id] = id;
        roleMap[id] = "";
      }
    }),
    15
  );

  return { nameMap, roleMap };
}

function parseStructuredNote(note) {
  const result = {
    type: "",
    book: "",
    pages: "",
    pagesRead: "",
    note: "",
    reflection: "",
  };

  const raw = safeText(note);
  if (!raw) return result;

  const pieces = raw.split("|").map((part) => part.trim()).filter(Boolean);
  for (const piece of pieces) {
    const idx = piece.indexOf(":");
    if (idx === -1) continue;

    const key = piece.slice(0, idx).trim().toLowerCase();
    const value = piece.slice(idx + 1).trim();

    if (key === "type") result.type = value;
    else if (key === "book") result.book = value;
    else if (key === "pages") result.pages = value;
    else if (key === "pages read") result.pagesRead = value;
    else if (key === "note") result.note = value;
    else if (key === "reflection") result.reflection = value;
  }

  return result;
}

async function readHttpError(resp) {
  let msg = `HTTP ${resp.status}`;
  try {
    const j = await resp.json();
    if (j?.error) msg = j.error;
  } catch {
    // ignore
  }
  return msg;
}

function safeText(s) {
  return (s ?? "").toString();
}

function escapeHtml(s) {
  return safeText(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#096;");
}

function hideMsgs() {
  if (els.errorBox) {
    els.errorBox.classList.add("isHidden");
    els.errorBox.textContent = "";
  }
  if (els.okBox) {
    els.okBox.classList.add("isHidden");
    els.okBox.textContent = "";
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

function debounce(fn, ms = 200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function runPool(tasks, concurrency = 8) {
  const queue = tasks.slice();
  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      while (queue.length) {
        const task = queue.shift();
        if (!task) return;
        await task();
      }
    }
  );
  await Promise.all(workers);
}