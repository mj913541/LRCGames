import { auth, db } from "/readathon-world/js/firebase.js";

import {
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

/* =========================
   DOM
========================= */
const gridEl = document.getElementById("grid");
const msgEl = document.getElementById("msg");
const hintEl = document.getElementById("hint");
const stepTitleEl = document.getElementById("stepTitle");
const stepChipEl = document.getElementById("stepChip");
const crumbsEl = document.getElementById("crumbs");
const resetBtn = document.getElementById("resetBtn");

const pinArea = document.getElementById("pinArea");
const pinHint = document.getElementById("pinHint");
const pinBox = document.getElementById("pinBox");
const loginBtn = document.getElementById("loginBtn");

const functions = getFunctions();
const verifyStudentPin = httpsCallable(functions, "verifyStudentPin");

/* =========================
   State
========================= */
let uid = null;

let step = 1; // 1 grade, 2 homeroom, 3 student, 4 pin
let picked = {
  gradeId: null,
  gradeLabel: null,
  homeroomId: null,
  homeroomLabel: null,
  studentId: null,
  studentName: null
};

let pin = "";

/* =========================
   Helpers
========================= */
function setMsg(text, ok=false) {
  msgEl.textContent = text || "";
  msgEl.style.color = ok ? "green" : "crimson";
}

function setHint(text) {
  hintEl.textContent = text || "";
}

function setStep(n) {
  step = n;
  stepChipEl.textContent = `${n} / 4`;

  if (n === 1) stepTitleEl.textContent = "Step 1: Pick your grade";
  if (n === 2) stepTitleEl.textContent = "Step 2: Pick your homeroom";
  if (n === 3) stepTitleEl.textContent = "Step 3: Pick your name";
  if (n === 4) stepTitleEl.textContent = "Step 4: Enter your PIN";

  // show/hide pin area
  const showPin = (n === 4);
  pinArea.classList.toggle("hidden", !showPin);
  pinHint.classList.toggle("hidden", showPin);

  renderCrumbs();
}

function renderCrumbs() {
  const grade = picked.gradeLabel || "—";
  const room = picked.homeroomLabel || "—";
  const student = picked.studentName || "—";
  crumbsEl.innerHTML = `
    <span class="crumb">Grade: ${escapeHtml(grade)}</span>
    <span class="crumb">Homeroom: ${escapeHtml(room)}</span>
    <span class="crumb">Student: ${escapeHtml(student)}</span>
  `;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function ensureAnonAuth() {
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  return auth.currentUser;
}

function pinDisplay() {
  const shown = (pin + "____").slice(0, 4).split("").map(ch => ch === "_" ? "—" : "•").join(" ");
  pinBox.textContent = shown;
}

/* =========================
   Data Loads
========================= */

async function loadGrades() {
  setMsg("");
  setHint("Tap your grade.");
  gridEl.innerHTML = `<div class="muted">Loading grades…</div>`;

  // grades are docs under /schools/main/grades
  const gradesCol = collection(db, "schools", "main", "grades");
  const snap = await getDocs(gradesCol);

  // Friendly order if IDs are numeric/known
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  docs.sort((a,b) => String(a.sortOrder ?? a.id).localeCompare(String(b.sortOrder ?? b.id), undefined, { numeric:true }));

  gridEl.innerHTML = "";
  docs.forEach(g => {
    const label = g.label || g.name || g.id;
    const tile = makeTile(label, g.subtitle || "Tap to choose");
    tile.addEventListener("click", () => {
      picked.gradeId = g.id;
      picked.gradeLabel = label;
      picked.homeroomId = null;
      picked.homeroomLabel = null;
      picked.studentId = null;
      picked.studentName = null;
      setStep(2);
      loadHomerooms();
    });
    gridEl.appendChild(tile);
  });

  if (!docs.length) {
    gridEl.innerHTML = `<div class="muted">No grades found.</div>`;
  }
}

async function loadHomerooms() {
  setMsg("");
  setHint("Tap your homeroom teacher.");
  gridEl.innerHTML = `<div class="muted">Loading homerooms…</div>`;

  const roomsCol = collection(db, "schools", "main", "grades", picked.gradeId, "homerooms");
  const qRef = query(roomsCol, orderBy("sortOrder", "asc"));
  const snap = await getDocs(qRef);

  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  gridEl.innerHTML = "";
  docs.forEach(r => {
    const label = r.label || r.teacherName || r.name || r.id;
    const tile = makeTile(label, r.subtitle || "Tap to choose");
    tile.addEventListener("click", () => {
      picked.homeroomId = r.id;
      picked.homeroomLabel = label;
      picked.studentId = null;
      picked.studentName = null;
      setStep(3);
      loadStudents();
    });
    gridEl.appendChild(tile);
  });

  if (!docs.length) {
    gridEl.innerHTML = `<div class="muted">No homerooms found.</div>`;
  }
}

async function loadStudents() {
  setMsg("");
  setHint("Tap your name.");
  gridEl.innerHTML = `<div class="muted">Loading students…</div>`;

  const studentsCol = collection(
    db,
    "schools", "main",
    "grades", picked.gradeId,
    "homerooms", picked.homeroomId,
    "students"
  );

  const qRef = query(studentsCol, orderBy("displayName", "asc"));
  const snap = await getDocs(qRef);

  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  gridEl.innerHTML = "";
  docs.forEach(s => {
    const label = s.displayName || s.name || s.id;
    const tile = makeTile(label, s.subtitle || "Tap to choose");
    tile.addEventListener("click", () => {
      picked.studentId = s.studentId || s.id; // your student docs often have studentId field
      picked.studentName = label;
      setStep(4);
      pin = "";
      pinDisplay();
      setHint("Enter your 4-digit PIN, then press ✅");
    });
    gridEl.appendChild(tile);
  });

  if (!docs.length) {
    gridEl.innerHTML = `<div class="muted">No students found.</div>`;
  }
}

/* =========================
   UI Elements
========================= */

function makeTile(title, subtitle) {
  const div = document.createElement("div");
  div.className = "tile";
  div.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <small>${escapeHtml(subtitle)}</small>
  `;
  return div;
}

/* =========================
   PIN + Login
========================= */

function wireKeypad() {
  document.querySelectorAll(".key").forEach(btn => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-k");
      if (!k) return;

      setMsg("");

      if (k === "clear") {
        pin = pin.slice(0, -1);
        pinDisplay();
        return;
      }

      if (k === "ok") {
        doLogin();
        return;
      }

      if (pin.length >= 4) return;
      pin += k;
      pinDisplay();
    });
  });

  loginBtn.addEventListener("click", doLogin);
}

async function doLogin() {
  if (!picked.studentId) return setMsg("Pick your name first.");
  if (pin.length !== 4) return setMsg("Enter your 4-digit PIN.");

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";

  try {
    // Verify PIN via Cloud Function
    const res = await verifyStudentPin({
      studentId: String(picked.studentId),
      pin: String(pin)
    });

    if (!res?.data?.ok) {
      throw new Error(res?.data?.error || "Incorrect PIN.");
    }

    // Build session doc for this anon UID
    const teacherId = picked.homeroomId;
    const teacherName = picked.homeroomLabel;

    await setDoc(doc(db, "users", uid), {
      studentId: String(picked.studentId),
      studentName: picked.studentName || null,
      grade: String(picked.gradeId),
      teacherId: teacherId || null,
      teacherName: teacherName || null,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    setMsg("✅ Signed in!", true);

    // Go to student home
    window.location.href = "/readathon-world/student-home.html";

  } catch (err) {
    console.error(err);
    setMsg(err.message || "Login failed. Try again.");
    pin = "";
    pinDisplay();
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "✅ Sign In";
  }
}

/* =========================
   Reset
========================= */
function resetAll() {
  picked = {
    gradeId: null,
    gradeLabel: null,
    homeroomId: null,
    homeroomLabel: null,
    studentId: null,
    studentName: null
  };
  pin = "";
  pinDisplay();
  setStep(1);
  loadGrades();
}

/* =========================
   Start
========================= */
(async function init() {
  wireKeypad();

  await ensureAnonAuth();

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    uid = user.uid;
    resetAll();
  });

  resetBtn.addEventListener("click", resetAll);
})();
