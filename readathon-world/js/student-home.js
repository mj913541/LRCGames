import { auth, db } from "/readathon-world/js/firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ==============================
   UI References
============================== */

const nameEl = document.getElementById("studentName");
const teacherEl = document.getElementById("teacherName");
const gradeEl = document.getElementById("grade");

const approvedEl = document.getElementById("approvedMinutes");
const pendingEl = document.getElementById("pendingMinutes");
const rubiesEl = document.getElementById("rubies");

const roomEl = document.getElementById("roomLayers");
const signOutBtn = document.getElementById("signOutBtn");

/* ==============================
   Helpers
============================== */

function goToLogin() {
  window.location.href = "student-login.html";
}

function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function getStudentIdFromPath(studentPath) {
  // studentPath looks like: schools/main/grades/X/homerooms/Y/students/Z
  const parts = String(studentPath || "").split("/");
  return parts[parts.length - 1] || "";
}

/* ==============================
   Auth Guard
============================== */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    goToLogin();
    return;
  }

  const studentPath = sessionStorage.getItem("studentPath");
  if (!studentPath) {
    goToLogin();
    return;
  }

  // Fill chips quickly from storage (nice UX)
  const gradeId = sessionStorage.getItem("gradeId");
  const homeroomId = sessionStorage.getItem("homeroomId");
  if (gradeEl && gradeId) gradeEl.textContent = gradeId;
  if (teacherEl && homeroomId) teacherEl.textContent = homeroomId;

  await loadDashboard(user.uid, studentPath);
});

/* ==============================
   Main Loader
============================== */

async function loadDashboard(studentUid, studentPath) {
  // 1) Roster doc (name, equipped)
  const rosterRef = doc(db, studentPath);
  const rosterSnap = await getDoc(rosterRef);

  if (!rosterSnap.exists()) {
    console.warn("Roster doc missing:", studentPath);
    return;
  }

  const roster = rosterSnap.data() || {};

  if (nameEl) {
    nameEl.textContent =
      roster.displayName ||
      sessionStorage.getItem("displayName") ||
      "Reader";
  }

  // studentId is the doc id at the end of your roster path
  const studentId = getStudentIdFromPath(studentPath);

  // 2) Totals doc (approved + rubies) — THIS is what admin approval updates
  // Path: students/{studentId}
  let approvedMinutes = 0;
  let rubiesBalance = 0;

  try {
    const totalsRef = doc(db, "students", studentId);
    const totalsSnap = await getDoc(totalsRef);

    if (totalsSnap.exists()) {
      const totals = totalsSnap.data() || {};
      approvedMinutes = safeInt(totals.totalApprovedMinutes, 0); // from admin-approve.js :contentReference[oaicite:2]{index=2}
      rubiesBalance = safeInt(totals.rubiesBalance, 0);          // from admin-approve.js :contentReference[oaicite:3]{index=3}
    } else {
      // totals doc might not exist yet (no approvals yet)
      approvedMinutes = 0;
      rubiesBalance = 0;
    }
  } catch (err) {
    console.error("Totals read failed:", err);
    // Leave as 0s; most common cause is rules blocking /students reads
    approvedMinutes = 0;
    rubiesBalance = 0;
  }

  // 3) Pending minutes: sum pending submissions for this uid
  // Your submit.js writes studentUid + status="pending" :contentReference[oaicite:4]{index=4}
  let pendingMinutes = 0;

  try {
    const pendingQ = query(
      collection(db, "minuteSubmissions"),
      where("studentId", "==", studentId),
      where("status", "==", "pending")
    );

    const pendingSnap = await getDocs(pendingQ);
    pendingSnap.forEach((d) => {
      const data = d.data() || {};
      pendingMinutes += safeInt(data.minutes, 0);
    });
  } catch (err) {
    console.error("Pending query failed:", err);
    pendingMinutes = 0;
  }

  // 4) Update UI
  if (approvedEl) approvedEl.textContent = approvedMinutes;
  if (pendingEl) pendingEl.textContent = pendingMinutes;
  if (rubiesEl) rubiesEl.textContent = rubiesBalance;

  // 5) Render room layers from equipped
  await renderRoom(roster.equipped || {});
}

/* ==============================
   Render Jungle Room
============================== */

async function renderRoom(equipped) {
  if (!roomEl) {
    console.warn("roomLayers element not found. Add <div id='roomLayers'></div> inside .room.");
    return;
  }

  roomEl.innerHTML = "";

  // Load store items so we can map itemId -> imageURL
  let storeSnap;
  try {
    storeSnap = await getDocs(collection(db, "storeItems"));
  } catch (err) {
    console.error("Store items read failed:", err);
    return;
  }

  const storeMap = new Map();
  storeSnap.forEach((d) => storeMap.set(d.id, d.data()));

  function addLayer(itemId, className) {
    if (!itemId) return;

    const item = storeMap.get(itemId);
    if (!item || !item.imageURL) return;

    const img = document.createElement("img");
    img.src = item.imageURL;
    img.className = `room-layer ${className}`;
    roomEl.appendChild(img);
  }

  // Back-to-front order
  addLayer(equipped.background, "bg");
  addLayer(equipped.decor, "decor");
  addLayer(equipped.body, "body");
  addLayer(equipped.outfit, "outfit");
  addLayer(equipped.accessory, "accessory");
  addLayer(equipped.pet, "pet");
}

/* ==============================
   Sign Out
============================== */

signOutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  sessionStorage.clear();
  window.location.href = "index.html";
});
