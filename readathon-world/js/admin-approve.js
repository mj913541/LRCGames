import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const el = (id) => document.getElementById(id);

const adminEmailEl = el("adminEmail");
const signOutBtn = el("signOutBtn");
const msgEl = el("msg");
const listEl = el("list");

const statusFilter = el("statusFilter");
const teacherFilter = el("teacherFilter");
const studentFilter = el("studentFilter");
const dateFilter = el("dateFilter");
const refreshBtn = el("refreshBtn");

function setMsg(text, ok = false) {
  msgEl.textContent = text || "";
  msgEl.style.color = ok ? "green" : "crimson";
}

function escapeHtml(s) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

function contains(haystack, needle) {
  return String(haystack || "").toLowerCase().includes(String(needle || "").toLowerCase());
}

let currentUser = null;
let isAdmin = false;
let cached = []; // loaded submissions

async function requireAdmin(user) {
  const ref = doc(db, "admins", user.uid);
  const snap = await getDoc(ref);
  return snap.exists();
}

async function fetchSubmissions() {
  setMsg("");
  listEl.innerHTML = `<div class="chip">Loading…</div>`;

  const status = statusFilter.value;

  // Prefer a server-side status filter for speed (pending/approved/rejected).
  // If "all", we grab a mixed set (still limited) and filter client-side.
  let qRef;

  if (status === "all") {
    qRef = query(
      collection(db, "minuteSubmissions"),
      orderBy("createdAt", "desc"),
      limit(300)
    );
  } else {
    qRef = query(
      collection(db, "minuteSubmissions"),
      where("status", "==", status),
      orderBy("createdAt", "desc"),
      limit(300)
    );
    // If Firestore asks for an index, it will show a direct link in console to create it.
  }

  const snap = await getDocs(qRef);
  cached = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderList();
}

function renderList() {
  const tNeedle = teacherFilter.value.trim();
  const sNeedle = studentFilter.value.trim();
  const dNeedle = dateFilter.value; // YYYY-MM-DD or ""

  const status = statusFilter.value;

  const filtered = cached.filter(row => {
    if (status !== "all" && row.status !== status) return false;

    if (tNeedle) {
      // supports teacherId or teacherName if you store it
      if (!contains(row.teacherId, tNeedle) && !contains(row.teacherName, tNeedle)) return false;
    }
    if (sNeedle) {
      if (!contains(row.studentName, sNeedle) && !contains(row.studentId, sNeedle)) return false;
    }
    if (dNeedle) {
      if (String(row.readingDate || "") !== dNeedle) return false;
    }
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = `<div class="chip">No matching submissions.</div>`;
    return;
  }

  const cards = filtered.map(row => {
    const created = row.createdAt?.toDate ? row.createdAt.toDate().toLocaleString() : "";
    const reviewed = row.reviewedAt?.toDate ? row.reviewedAt.toDate().toLocaleString() : "";

    const canAct = row.status === "pending";

    return `
      <div style="border:2px solid rgba(0,0,0,.08); border-radius:16px; padding:12px; margin:10px 0; background: rgba(255,255,255,.75);">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <span class="chip">👤 <strong>${escapeHtml(row.studentName || "Student")}</strong></span>
            <span class="chip">ID: ${escapeHtml(row.studentId || "")}</span>
            <span class="chip">🏫 ${escapeHtml(row.teacherName || row.teacherId || "")}</span>
            <span class="chip">⭐ Grade ${escapeHtml(row.grade || "")}</span>
          </div>
          <span class="chip">Status: <strong>${escapeHtml(row.status)}</strong></span>
        </div>

        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <span class="chip">🕒 Minutes: <strong style="font-size:18px;">${escapeHtml(String(row.minutes))}</strong></span>
          <span class="chip">📅 Reading date: <strong>${escapeHtml(row.readingDate || "")}</strong></span>
          ${row.note ? `<span class="chip">📝 ${escapeHtml(row.note)}</span>` : ""}
        </div>

        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <span style="opacity:.75; font-size:13px;">Submitted: ${escapeHtml(created)}</span>
          ${row.status !== "pending" ? `<span style="opacity:.75; font-size:13px;">Reviewed: ${escapeHtml(reviewed)}</span>` : ""}
        </div>

        ${canAct ? `
          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <input id="note_${row.id}" class="inp" style="flex:1; min-width:220px;"
              placeholder="Optional decision note (visible to admin)..." maxlength="120" />
            <button class="btn" style="width:auto; padding:10px 14px;" data-action="approve" data-id="${row.id}">✅ Approve</button>
            <button class="btn" style="width:auto; padding:10px 14px;" data-action="reject" data-id="${row.id}">❌ Reject</button>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  listEl.innerHTML = cards;

  // Wire button clicks (single handler)
  listEl.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const noteInput = document.getElementById(`note_${id}`);
      const decisionNote = (noteInput?.value || "").trim();
      if (action === "approve") await approveSubmission(id, decisionNote);
      if (action === "reject") await rejectSubmission(id, decisionNote);
    });
  });
}

async function approveSubmission(submissionId, decisionNote) {
  if (!currentUser) return;

  setMsg("Approving…", true);

  const subRef = doc(db, "minuteSubmissions", submissionId);

  try {
    await runTransaction(db, async (tx) => {
      const subSnap = await tx.get(subRef);
      if (!subSnap.exists()) throw new Error("Submission not found.");
      const sub = subSnap.data();

      if (sub.status !== "pending") throw new Error("Already reviewed.");

      // Update submission (must keep existing fields + set reviewer fields)
      tx.update(subRef, {
        status: "approved",
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid,
        ...(decisionNote ? { decisionNote } : {})
      });

      // Increment student total minutes
      const studentId = sub.studentId;
      if (!studentId) throw new Error("Missing studentId on submission.");

      const studentRef = doc(db, "students", studentId);
      tx.set(studentRef, {
        totalApprovedMinutes: increment(Number(sub.minutes || 0))
      }, { merge: true });
    });

    setMsg("✅ Approved and total updated.", true);
    await fetchSubmissions();
  } catch (err) {
    console.error(err);
    setMsg(err.message || "Approve failed.");
  }
}

async function rejectSubmission(submissionId, decisionNote) {
  if (!currentUser) return;

  setMsg("Rejecting…", true);

  const subRef = doc(db, "minuteSubmissions", submissionId);

  try {
    await runTransaction(db, async (tx) => {
      const subSnap = await tx.get(subRef);
      if (!subSnap.exists()) throw new Error("Submission not found.");
      const sub = subSnap.data();
      if (sub.status !== "pending") throw new Error("Already reviewed.");

      tx.update(subRef, {
        status: "rejected",
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid,
        ...(decisionNote ? { decisionNote } : {})
      });
    });

    setMsg("❌ Rejected.", true);
    await fetchSubmissions();
  } catch (err) {
    console.error(err);
    setMsg(err.message || "Reject failed.");
  }
}

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/admin.html"; // adjust if your admin login page is different
});

refreshBtn.addEventListener("click", fetchSubmissions);
[statusFilter, teacherFilter, studentFilter, dateFilter].forEach(inp => {
  inp.addEventListener("input", () => {
    // live filtering without requery (fast)
    renderList();
  });
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./admin.html"; // adjust if needed
    return;
  }

  currentUser = user;
  adminEmailEl.textContent = user.email || user.uid;

  try {
    isAdmin = await requireAdmin(user);
  } catch (e) {
    // If not an admin, this read will fail by rules
    isAdmin = false;
  }

  if (!isAdmin) {
    setMsg("Not authorized. Please sign in as an admin.");
    listEl.innerHTML = "";
    return;
  }

  await fetchSubmissions();
});
