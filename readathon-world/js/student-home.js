import { auth, db } from "./firebase.js";
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
const approvedEl = document.getElementById("approvedMinutes");
const pendingEl = document.getElementById("pendingMinutes");
const rubiesEl = document.getElementById("rubies");
const roomEl = document.getElementById("roomLayers");
const signOutBtn = document.getElementById("signOutBtn");

/* ==============================
   Auth Guard
============================== */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "student-login.html";
    return;
  }

  const studentPath = sessionStorage.getItem("studentPath");
  if (!studentPath) {
    window.location.href = "student-login.html";
    return;
  }

  await loadStudent(studentPath);
});

/* ==============================
   Load Student Data
============================== */

async function loadStudent(studentPath) {
  const studentRef = doc(db, studentPath);
  const snap = await getDoc(studentRef);

  if (!snap.exists()) return;

  const student = snap.data();

  nameEl.textContent = student.displayName || "Reader";
  approvedEl.textContent = student.approvedMinutes || 0;
  pendingEl.textContent = student.pendingMinutes || 0;
  rubiesEl.textContent = student.rubiesBalance || 0;

  await renderRoom(student.equipped || {});
}

/* ==============================
   Render Jungle Room
============================== */

async function renderRoom(equipped) {
  roomEl.innerHTML = "";

  const storeSnap = await getDocs(collection(db, "storeItems"));
  const storeMap = new Map();
  storeSnap.forEach(d => storeMap.set(d.id, d.data()));

  function addLayer(itemId, className) {
    if (!itemId) return;

    const item = storeMap.get(itemId);
    if (!item || !item.imageURL) return;

    const img = document.createElement("img");
    img.src = item.imageURL;
    img.className = `room-layer ${className}`;
    roomEl.appendChild(img);
  }

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
