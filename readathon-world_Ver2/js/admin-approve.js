// /readathon-world_Ver2/js/admin-minutes-approve.js
import {
  auth,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  fnApprovePendingMinutes,
  db,
} from "/readathon-world_Ver2/js/firebase.js";

import {
  ABS,
  guardRoleOrRedirect,
  setHeaderUser,
  wireSignOut,
  showLoading,
  hideLoading,
  normalizeError,
  fmtInt,
} from "/readathon-world_Ver2/js/app.js";

import {
  collection,
  query,
  where,
  orderBy,
  limit as qLimit,
  getDocs,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  btnRefresh: document.getElementById("btnRefresh"),
  countLabel: document.getElementById("countLabel"),
  limitSelect: document.getElementById("limitSelect"),
  searchInput: document.getElementById("searchInput"),

  pendingList: document.getElementById("pendingList"),
  emptyNote: document.getElementById("emptyNote"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("errorBox"),
  okBox: document.getElementById("okBox"),
};

let ctx = { schoolId: null };

init().catch((e) => showError(normalizeError(e)));

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading approval page…");
  const claims = await guardRoleOrRedirect(["admin"], ABS.adminLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  ctx.schoolId = schoolId;

  const userId = claims.userId || auth.currentUser?.uid;
  setHeaderUser(els.hdr, { title: "Pending Minutes", subtitle: `${schoolId} • ${userId}` });

  els.btnRefresh.addEventListener("click", () => loadPending());
  els.limitSelect.addEventListener("change", () => loadPending());
  els.searchInput.addEventListener("input", debounce(() => renderSearchFilter(), 200));

  await loadPending();
  hideLoading(els.loadingOverlay);
}

let pendingCache = [];

async function loadPending() {
  hideMsgs();
  showLoading(els.loadingOverlay, els.loadingText, "Loading pending requests…");

  const schoolId = ctx.schoolId;
  const lim = parseInt(els.limitSelect.value, 10) || 50;

  try {
    // We store pending requests as transactions:
    // actionType = "MINUTES_SUBMIT_PENDING"
    // status = "PENDING"
    const txCol = collection(db, `readathonV2_schools/${schoolId}/transactions`);
    const qRef = query(
      txCol,
      where("actionType", "==", "MINUTES_SUBMIT_PENDING"),
      where("status", "==", "PENDING"),
      orderBy("timestamp", "desc"),
      qLimit(lim)
    );

    const snap = await getDocs(qRef);
    const rows = snap.docs.map(d => ({ txId: d.id, ...d.data() }));

    // enrich with displayName from publicStudents if it’s a student_####
    const enriched = [];
    for (const r of rows) {
      const displayName = await lookupDisplayName(schoolId, r.targetUserId);
      enriched.push({ ...r, displayName });
    }

    pendingCache = enriched;
    renderSearchFilter();
    hideLoading(els.loadingOverlay);
  } catch (err) {
    hideLoading(els.loadingOverlay);
    showError(normalizeError(err));
  }
}

function renderSearchFilter() {
  const q = (els.searchInput.value || "").trim().toLowerCase();
  const list = q ? pendingCache.filter(x => String(x.targetUserId || "").toLowerCase().includes(q)) : pendingCache;
  renderList(list);
}

function renderList(list) {
  els.pendingList.innerHTML = "";
  els.emptyNote.classList.toggle("isHidden", list.length !== 0);

  els.countLabel.textContent = `${fmtInt(list.length)} pending`;

  for (const r of list) {
    const card = document.createElement("div");
    card.className = "rowCard";

    const left = document.createElement("div");
    left.className = "rowCard__left";

    const who = document.createElement("div");
    who.className = "rowCard__who";
    who.textContent = r.displayName ? `${r.displayName} (${r.targetUserId})` : r.targetUserId;

    const meta = document.createElement("div");
    meta.className = "rowCard__meta";
    meta.textContent = `${r.dateKey || "—"} • Submitted by ${r.submittedByUserId || "—"}`;

    const note = document.createElement("div");
    note.className = "rowCard__note";
    note.textContent = r.note ? `Note: ${r.note}` : "Note: —";

    left.appendChild(who);
    left.appendChild(meta);
    left.appendChild(note);

    const right = document.createElement("div");
    right.className = "rowCard__right";

    const minutes = document.createElement("div");
    minutes.className = "rowCard__minutes";
    minutes.textContent = `⏱️ ${fmtInt(r.deltaMinutes || 0)} min`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btnApprove";
    btn.textContent = "Approve ✅";
    btn.addEventListener("click", () => approveOne(r.txId, btn));

    right.appendChild(minutes);
    right.appendChild(btn);

    card.appendChild(left);
    card.appendChild(right);

    els.pendingList.appendChild(card);
  }
}

async function approveOne(txId, btnEl) {
  hideMsgs();
  btnEl.disabled = true;

  try {
    showLoading(els.loadingOverlay, els.loadingText, "Approving…");

    await fnApprovePendingMinutes({
      schoolId: ctx.schoolId,
      txId,
    });

    showOk("Approved! Minutes added + rubies awarded 1:1 ✅");
    await loadPending();
  } catch (err) {
    showError(normalizeError(err));
  } finally {
    hideLoading(els.loadingOverlay);
    btnEl.disabled = false;
  }
}

async function lookupDisplayName(schoolId, userId) {
  if (!userId || !String(userId).startsWith("student_")) return "";
  try {
    const ref = doc(db, `readathonV2_schools/${schoolId}/publicStudents/${userId}`);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data().displayName || "") : "";
  } catch {
    return "";
  }
}

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

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}