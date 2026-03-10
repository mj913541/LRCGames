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
  countLabel: document.getElementById("countLabel"),
  limitSelect: document.getElementById("limitSelect"),
  searchInput: document.getElementById("searchInput"),

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
    ctx.nameMapUsers = await buildUserNameMap(schoolId, rows);

    applyClientFilterAndRender();

    hideLoading(els.loadingOverlay);
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  }
}

function applyClientFilterAndRender() {
  const q = (els.searchInput?.value || "").trim().toLowerCase();

  const filtered = !q
    ? ctx.rows
    : ctx.rows.filter((r) => {
        const studentId = String(r.targetUserId || "").toLowerCase();
        const studentName = String(ctx.nameMapStudents[r.targetUserId] || "").toLowerCase();
        const requesterId = String(r.submittedByUserId || "").toLowerCase();
        const requesterName = String(ctx.nameMapUsers[r.submittedByUserId] || "").toLowerCase();

        return (
          studentId.includes(q) ||
          studentName.includes(q) ||
          requesterId.includes(q) ||
          requesterName.includes(q)
        );
      });

  renderPendingGrouped(filtered, ctx.nameMapStudents, ctx.nameMapUsers);
  setCountLabel(filtered.length, ctx.rows.length);
}

function setCountLabel(shownCount, totalCount) {
  if (els.countLabel) {
    const q = (els.searchInput?.value || "").trim();
    els.countLabel.textContent = q
      ? `Showing ${shownCount} of ${totalCount} (filtered)`
      : `Showing ${shownCount}`;
  }

  if (els.emptyNote) {
    if (shownCount === 0) els.emptyNote.classList.remove("isHidden");
    else els.emptyNote.classList.add("isHidden");
  }
}

function renderPendingGrouped(rows, studentNameMap = {}, userNameMap = {}) {
  if (!els.list) return;

  els.list.innerHTML = "";

  if (!rows.length) {
    els.list.innerHTML = `<div class="panel">No pending minutes 🎉</div>`;
    return;
  }

  const groups = new Map();

  for (const tx of rows) {
    const studentId = safeText(tx.targetUserId || "");
    if (!studentId) continue;

    if (!groups.has(studentId)) {
      groups.set(studentId, []);
    }

    groups.get(studentId).push(tx);
  }

  const sortedStudentIds = Array.from(groups.keys()).sort((a, b) => {
    const nameA = safeText(studentNameMap[a] || a).toLowerCase();
    const nameB = safeText(studentNameMap[b] || b).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  for (const studentId of sortedStudentIds) {
    const studentName = safeText(studentNameMap[studentId] || studentId);
    const txs = groups.get(studentId) || [];

    txs.sort((a, b) => {
      return safeText(b.dateKey || "").localeCompare(safeText(a.dateKey || ""));
    });

    const totalMinutes = txs.reduce((sum, tx) => sum + Number(tx.deltaMinutes || 0), 0);

    const head = document.createElement("div");
    head.className = "panel";
    head.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
        <div>
          <div style="font-weight:900;font-size:1.08em;">${escapeHtml(studentName)}</div>
          <div style="opacity:0.82;font-size:0.95em;">
            <span style="font-family:monospace;">${escapeHtml(studentId)}</span>
            • ${txs.length} request(s)
            • ${totalMinutes} min total
          </div>
        </div>
        <button class="btn" data-approve-student="${escapeAttr(studentId)}">
          Approve All for Student ✅✅
        </button>
      </div>
    `;

    els.list.appendChild(head);

    const approveStudentBtn = head.querySelector(
      `[data-approve-student="${escapeAttr(studentId)}"]`
    );
    if (approveStudentBtn) {
      approveStudentBtn.addEventListener("click", () => approveAllForStudent(txs));
    }

    for (const tx of txs) {
      const div = document.createElement("div");
      div.className = "panel";

      const mins = Number(tx.deltaMinutes || 0);
      const note = safeText(tx.note || "");
      const dateKey = safeText(tx.dateKey || "");
      const requesterId = safeText(tx.submittedByUserId || "");
      const requesterNice = requesterId
        ? safeText(userNameMap[requesterId] || requesterId)
        : "";

      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <div>
            <div style="font-weight:800;">${mins} min</div>
            <div style="opacity:0.85;font-size:0.95em;">
              ${escapeHtml(dateKey)}
              ${note ? ` • ${escapeHtml(note)}` : ""}
              ${requesterNice ? ` • Requested by ${escapeHtml(requesterNice)}` : ""}
            </div>
            <div style="opacity:0.75;font-size:0.9em;margin-top:6px;">
              ${requesterId ? `<span style="font-family:monospace;">${escapeHtml(requesterId)}</span>` : ""}
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn" data-approve="${tx.id}">Approve ✅</button>
            <button class="btn" data-reject="${tx.id}">Reject ❌</button>
          </div>
        </div>
      `;

      const approveBtn = div.querySelector(`[data-approve="${tx.id}"]`);
      const rejectBtn = div.querySelector(`[data-reject="${tx.id}"]`);

      if (approveBtn) approveBtn.addEventListener("click", () => approveTx(tx.id));
      if (rejectBtn) rejectBtn.addEventListener("click", () => rejectTx(tx.id));

      els.list.appendChild(div);
    }
  }
}

/* =========================
   Approve / Reject / Approve All
========================= */

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

  const approveButtons = Array.from(
    els.list?.querySelectorAll?.("button[data-approve]") || []
  );

  const ids = approveButtons
    .map((b) => b.getAttribute("data-approve"))
    .filter(Boolean);

  if (!ids.length) {
    showOk("Nothing to approve 🎉");
    return;
  }

  showLoading(els.loadingOverlay, els.loadingText, `Approving ${ids.length} item(s)…`);

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

      if (!resp.ok) {
        throw new Error(await readHttpError(resp));
      }

      okCount += 1;
      showLoading(els.loadingOverlay, els.loadingText, `Approving… (${okCount}/${ids.length})`);
    }

    hideLoading(els.loadingOverlay);
    showOk(`Approved ${okCount} item(s)! ✅✅`);
    await refreshPending();
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  }
}

async function approveAllForStudent(txs) {
  if (!Array.isArray(txs) || !txs.length) return;

  hideMsgs();
  showLoading(els.loadingOverlay, els.loadingText, "Approving this student's requests…");

  try {
    const user = await ensureAuthedOrBounce();
    if (!user) return;

    const token = await user.getIdToken(true);

    let okCount = 0;

    for (const tx of txs) {
      const resp = await fetch(ENDPOINTS.approvePendingMinutesHttp, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schoolId: ctx.schoolId,
          txId: tx.id,
        }),
      });

      if (!resp.ok) {
        throw new Error(await readHttpError(resp));
      }

      okCount += 1;
      showLoading(
        els.loadingOverlay,
        els.loadingText,
        `Approving this student's requests… (${okCount}/${txs.length})`
      );
    }

    hideLoading(els.loadingOverlay);
    showOk(`Approved ${okCount} request(s) for this student ✅✅`);
    await refreshPending();
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  }
}

/* =========================
   Name lookups
========================= */

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

async function buildUserNameMap(schoolId, rows) {
  const ids = Array.from(new Set(rows.map((r) => r.submittedByUserId).filter(Boolean)));
  const map = {};

  await runPool(
    ids.map((id) => async () => {
      try {
        const ref = doc(db, `readathonV2_schools/${schoolId}/users/${id}`);
        const s = await getDoc(ref);
        const d = s.exists() ? s.data() : null;

        map[id] =
          d?.displayName ||
          d?.name ||
          d?.fullName ||
          d?.email ||
          id;
      } catch {
        map[id] = id;
      }
    }),
    15
  );

  return map;
}

/* =========================
   Helpers
========================= */

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