// aaa /readathon-world_Ver2/js/admin-minutes-approve.js

import {
  auth,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  waitForAuthReady,
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

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "/readathon-world_Ver2/js/firebase.js";

console.log("✅ LOADED admin-minutes-approve.js (HTTP)");

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  list: document.getElementById("pendingList"),
  btnRefresh: document.getElementById("btnRefresh"),

  errorBox: document.getElementById("errorBox"),
  okBox: document.getElementById("okBox"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
};

let ctx = { schoolId: null, adminId: null };

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

  setHeaderUser(els.hdr, { title: "Approve Minutes", subtitle: `${schoolId} • ${adminId}` });

  if (els.btnRefresh) els.btnRefresh.addEventListener("click", refreshPending);

  await refreshPending();

  hideLoading(els.loadingOverlay);
}

async function refreshPending() {
  hideMsgs();
  showLoading(els.loadingOverlay, els.loadingText, "Loading pending minutes…");

  try {
    const schoolId = ctx.schoolId;

    // Pull pending tx's
    const txCol = collection(db, `readathonV2_schools/${schoolId}/transactions`);
    const qRef = query(
      txCol,
      where("actionType", "==", "MINUTES_SUBMIT_PENDING"),
      where("status", "==", "PENDING"),
      orderBy("dateKey", "desc"),
      limit(200)
    );

    const snap = await getDocs(qRef);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    renderPending(rows);

    hideLoading(els.loadingOverlay);
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  }
}

function renderPending(rows) {
  if (!els.list) return;

  els.list.innerHTML = "";

  if (!rows.length) {
    els.list.innerHTML = `<div class="panel">No pending minutes 🎉</div>`;
    return;
  }

  for (const tx of rows) {
    const div = document.createElement("div");
    div.className = "panel";

    const who = safeText(tx.targetUserId);
    const mins = Number(tx.deltaMinutes || 0);
    const note = safeText(tx.note || "");
    const dateKey = safeText(tx.dateKey || "");

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
        <div>
          <div style="font-weight:800;">${who} • ${mins} min</div>
          <div style="opacity:0.85;font-size:0.95em;">${dateKey}${note ? ` • ${escapeHtml(note)}` : ""}</div>
        </div>
        <button class="btn" data-approve="${tx.id}">Approve ✅</button>
      </div>
    `;

    div.querySelector(`[data-approve="${tx.id}"]`).addEventListener("click", () => approveTx(tx.id));

    els.list.appendChild(div);
  }
}

async function approveTx(txId) {
  hideMsgs();
  showLoading(els.loadingOverlay, els.loadingText, "Approving…");

  try {
    const user = await ensureAuthedOrBounce();
    if (!user) return;

    const token = await user.getIdToken(true);

    const resp = await fetch(
      "https://us-central1-lrcquest-3039e.cloudfunctions.net/approvePendingMinutesHttp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schoolId: ctx.schoolId,
          txId,
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
    showOk("Approved! ✅");

    // refresh list
    await refreshPending();
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  }
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