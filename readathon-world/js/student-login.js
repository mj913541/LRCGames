import { auth, db } from "/readathon-world/js/firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  getDocs
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

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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

  // Optional: fill chips from storage immediately (nice UX)
  const gradeId = sessionStorage.getItem("gradeId");
  const homeroomId = sessionStorage.getItem("homeroomId");
  if (gradeEl && gradeId) gradeEl.textContent = gradeId;
  if (teacherEl && homeroomId) teacherEl.textContent = homeroomId;

  await loadStudent(studentPath);
});

/* ==============================
   Load Student Data
============================== */

async function loadStudent(studentPath) {
  const studentRef = doc(db, studentPath);
  const snap = await getDoc(studentRef);

  if (!snap.exists()) {
    console.warn("Student doc missing:", studentPath);
    return;
  }

  const student = snap.data() || {};

  // Name
  if (nameEl) nameEl.textContent = student.displayName || sessionStorage.getItem("displayName") || "Reader";

  // Minutes + Rubies (support your current field names gracefully)
  // Your HTML expects: approvedMinutes, pendingMinutes, rubiesBalance
  // Your rules draft also mentioned: totalApprovedMinutes, etc.
  const approved =
    safeNum(student.approvedMinutes, null) ??
    safeNum(student.totalApprovedMinutes, 0);

  const pending =
    safeNum(student.pendingMinutes, 0);

  const rubies =
    safeNum(student.rubiesBalance, null) ??
    safeNum(student.rubies, 0);

  if (approvedEl) approvedEl.textContent = approved;
  if (pendingEl) pendingEl.textContent = pending;
  if (rubiesEl) rubiesEl.textContent = rubies;

  await renderRoom(student.equipped || {});
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
  const storeSnap = await getDocs(collection(db, "storeItems"));
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

  // Keep these in back-to-front order
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
