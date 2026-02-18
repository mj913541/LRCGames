import { auth, db } from "/readathon-world/js/firebase.js";

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
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const el = (id) => document.getElementById(id);

const statusEl = el("status");
const pendingCountEl = el("pendingCount");
const todayCountEl = el("todayCount");
const totalRubiesEl = el("totalRubies");
const storeCountEl = el("storeCount");
const recentListEl = el("recentList");

const refreshBtn = el("refreshBtn");
const signOutBtn = el("signOutBtn");

function setStatus(msg, ok = true) {
  statusEl.textContent = msg;
  statusEl.style.borderColor = ok ? "rgba(34,197,94,.35)" : "rgba(220,38,38,.45)";
}

async function requireAdmin(user) {
  const adminRef = doc(db, "admins", user.uid);
  const snap = await getDoc(adminRef);
  if (!snap.exists()) {
    setStatus("Not authorized. Ask Mrs. A to add your account.", false);
    throw new Error("admin-required");
  }
  return snap.data() || {};
}

function startOf24hAgo() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d;
}

async function loadCounts() {
  // Pending approvals
  const pendingQ = query(
    collection(db, "minuteSubmissions"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(200) // count up to 200 quickly; adjust later if needed
  );
  const pendingSnap = await getDocs(pendingQ);
  pendingCountEl.textContent = pendingSnap.size;

  // Today's submissions (last 24h)
  // If createdAt is a Firestore Timestamp, this works when rules allow.
  const since = startOf24hAgo();
  const todayQ = query(
    collection(db, "minuteSubmissions"),
    where("createdAt", ">=", since),
    orderBy("createdAt", "desc"),
    limit(500)
  );
  const todaySnap = await getDocs(todayQ);
  todayCountEl.textContent = todaySnap.size;

  // Active store items
  const storeQ = query(
    collection(db, "storeItems"),
    where("active", "==", true),
    limit(1000)
  );
  const storeSnap = await getDocs(storeQ);
  storeCountEl.textContent = storeSnap.size;
}

async function loadTotalRubiesIssued() {
  // Simple version: sum lifetimeRubiesEarned across students
  // (For very large numbers of students, we’d switch to a Cloud Function or a daily aggregate doc.)
  const studentsSnap = await getDocs(collection(db, "students"));

  let sum = 0;
  studentsSnap.forEach((d) => {
    const data = d.data() || {};
    sum += Number(data.lifetimeRubiesEarned || 0);
  });

  totalRubiesEl.textContent = sum;
}

async function loadRecentPending() {
  recentListEl.innerHTML = "<div class='item'>Loading…</div>";

  const qRef = query(
    collection(db, "minuteSubmissions"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(6)
  );

  const snap = await getDocs(qRef);

  if (snap.empty) {
    recentListEl.innerHTML = "<div class='item'>No pending submissions 🎉</div>";
    return;
  }

  recentListEl.innerHTML = "";
  snap.forEach((docSnap) => {
    const s = docSnap.data() || {};
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <strong>${s.studentName || s.studentId || "Student"} • ${s.minutes || "?"} min</strong>
      <small>Teacher: ${s.teacherName || s.teacherId || "—"} • Grade: ${s.grade || "—"} • ${s.readingDate || ""}</small>
    `;
    recentListEl.appendChild(div);
  });
}

async function refreshAll() {
  setStatus("Loading dashboard…", true);
  await loadCounts();
  await loadRecentPending();
  await loadTotalRubiesIssued();
  setStatus("✅ Loaded.", true);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./admin.html";
    return;
  }

  try {
    const adminData = await requireAdmin(user);
    setStatus(`✅ Staff verified (${adminData.email || "authorized"}).`, true);
    await refreshAll();
  } catch (e) {
    if (String(e?.message || "").includes("admin-required")) return;
    setStatus(`Error: ${e?.message || "unknown"}`, false);
  }
});

refreshBtn?.addEventListener("click", refreshAll);

signOutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./admin.html";
});
