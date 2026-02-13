// aaa js/student-login.js
// Grade -> Homeroom -> Name -> PIN -> verifyStudentPin -> redirect

import { auth, functions, db } from "./firebase.js";

import {
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const gradeSel = $("gradeSel");
const roomSel = $("roomSel");
const studentSel = $("studentSel");
const keypad = $("keypad");
const dots = $("dots");
const loginBtn = $("loginBtn");
const resetBtn = $("resetBtn");
const statusBox = $("status");

let uid = null;
let pin = "";
let selectedStudentId = "";
let rosterCache = []; // { studentId, displayName }

function setStatus(msg, type = "ok") {
  statusBox.style.display = "block";
  statusBox.className = `status ${type === "err" ? "err" : ""}`;
  statusBox.innerHTML = msg;
}

function clearStatus() {
  statusBox.style.display = "none";
  statusBox.innerHTML = "";
}

function renderDots(len = 4) {
  dots.innerHTML = "";
  for (let i = 0; i < len; i++) {
    const d = document.createElement("div");
    d.className = "dot" + (i < pin.length ? " filled" : "");
    dots.appendChild(d);
  }
}

function escapeHtml(s) {
  return (s ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetAll() {
  pin = "";
  selectedStudentId = "";
  rosterCache = [];

  gradeSel.value = "";
  roomSel.innerHTML = `<option value="">Choose grade first…</option>`;
  studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;

  roomSel.disabled = true;
  studentSel.disabled = true;
  loginBtn.disabled = true;

  renderDots(4);
  clearStatus();
}

function setLoginEnabled() {
  const ok =
    gradeSel.value &&
    roomSel.value &&
    studentSel.value &&
    pin.length >= 3; // allow 3–6
  loginBtn.disabled = !ok;
}

async function ensureAnonAuth() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  // Wait until Firebase finishes setting the auth state
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub();
        resolve(u);
      }
    });
  });

  // Force token refresh
  await user.getIdToken(true);

  console.log("Anon UID:", user.uid);
  console.log("Has token:", !!(await user.getIdToken()));

  return user;
}

/**
 * Homerooms come from:
 * schools/main/grades/{grade}/homerooms/*
 * Only active==true show.
 */
async function populateHomeroomsFromFirestore(grade) {
  clearStatus();

  roomSel.disabled = true;
  roomSel.innerHTML = `<option value="">Loading…</option>`;

  studentSel.disabled = true;
  studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;

  try {
    await ensureAnonAuth(); // ✅ IMPORTANT (rules require signed in)

    const homeroomsRef = collection(
      db,
      "schools",
      "main",
      "grades",
      String(grade),
      "homerooms"
    );

    const snap = await getDocs(query(homeroomsRef, where("active", "==", true)));

    if (snap.empty) {
      roomSel.innerHTML = `<option value="">No homerooms found</option>`;
      setStatus(
        `I can’t find any homerooms for this grade yet. Ask your teacher for help.`,
        "err"
      );
      return;
    }

    const options = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const id = docSnap.id;
      const label = data.displayName || id;
      options.push({ id, label });
    });

    options.sort((a, b) => String(a.label).localeCompare(String(b.label)));

    roomSel.innerHTML =
      `<option value="">Choose…</option>` +
      options
        .map(
          (o) =>
            `<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)}</option>`
        )
        .join("");

    roomSel.disabled = false;
  } catch (e) {
    console.error(e);
    roomSel.innerHTML = `<option value="">Error loading homerooms</option>`;
    setStatus(`Oops! I couldn’t load homerooms. Try again in a moment.`, "err");
  }
}

/**
 * Students come from:
 * schools/main/grades/{grade}/homerooms/{homeroomId}/students/*
 * Only active==true show (if field exists)
 */
async function populateStudents(grade, homeroomId) {
  clearStatus();

  studentSel.disabled = true;
  studentSel.innerHTML = `<option value="">Loading…</option>`;

  try {
    await ensureAnonAuth(); // ✅ IMPORTANT

    const studentsRef = collection(
      db,
      "schools",
      "main",
      "grades",
      String(grade),
      "homerooms",
      String(homeroomId),
      "students"
    );

    // If you don't have "active" on student docs, remove this query() and just do getDocs(studentsRef)
    const snap = await getDocs(query(studentsRef, where("active", "==", true)));

    rosterCache = snap.docs
      .map((d) => {
        const s = d.data() || {};
        return {
          studentId: s.studentId || d.id,
          displayName: s.displayName || s.studentName || s.name || "Student"
        };
      })
      .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));

    if (!rosterCache.length) {
      studentSel.innerHTML = `<option value="">No students found</option>`;
      setStatus(
        `Hmm… I couldn’t find any names for that class. Ask your teacher for help.`,
        "err"
      );
      return;
    }

    studentSel.innerHTML =
      `<option value="">Choose…</option>` +
      rosterCache
        .map(
          (s) =>
            `<option value="${escapeHtml(s.studentId)}">${escapeHtml(
              s.displayName
            )}</option>`
        )
        .join("");

    studentSel.disabled = false;
  } catch (e) {
    console.error(e);
    studentSel.innerHTML = `<option value="">Try again</option>`;

    const msg = (e?.message || "").toLowerCase();
    if (msg.includes("permission") || msg.includes("unauth")) {
      setStatus(`I couldn’t load names yet. Please refresh and try again.`, "err");
    } else {
      setStatus(`Something went wrong loading names. Try again in a moment.`, "err");
    }
  }
}

async function doLogin() {
  clearStatus();

  if (!selectedStudentId) {
    setStatus(`Pick your name first. 🙂`, "err");
    return;
  }
  if (!/^\d{3,6}$/.test(pin)) {
    setStatus(`PIN should be 3–6 numbers.`, "err");
    return;
  }

  loginBtn.disabled = true;

  try {
    await ensureAnonAuth();

    const gradeId = String(gradeSel.value || "");
    const homeroomId = String(roomSel.value || "");

    const verify = httpsCallable(functions, "verifyStudentPin");
    const res = await verify({ studentId: selectedStudentId, pin, gradeId, homeroomId });

    if (res?.data?.ok) {
      setStatus(
        `✅ Welcome, <strong>${escapeHtml(
          res.data.profile?.displayName || "Reader"
        )}</strong>! Entering your world…`
      );
      window.location.href = "./student-home.html";
    } else {
      setStatus(`That PIN didn’t match. Try again!`, "err");
      pin = "";
      renderDots(4);
    }
  } catch (e) {
    console.error(e);
    const msg = (e?.message || "").toLowerCase();

    if (msg.includes("pin")) setStatus(`That PIN didn’t match. Try again!`, "err");
    else if (msg.includes("unauth")) setStatus(`Please refresh and try again.`, "err");
    else setStatus(`Oops! Something went wrong. Try again.`, "err");

    pin = "";
    renderDots(4);
  } finally {
    setLoginEnabled();
  }
}

/* =========================
   Events
========================= */

renderDots(4);

onAuthStateChanged(auth, (user) => {
  uid = user?.uid || null;
});

gradeSel.addEventListener("change", async () => {
  pin = "";
  selectedStudentId = "";
  rosterCache = [];
  renderDots(4);
  setLoginEnabled();
  clearStatus();

  const grade = gradeSel.value;

  roomSel.disabled = true;
  roomSel.innerHTML = `<option value="">Choose grade first…</option>`;
  studentSel.disabled = true;
  studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;

  if (!grade) return;

  await populateHomeroomsFromFirestore(grade);
});

roomSel.addEventListener("change", async () => {
  pin = "";
  selectedStudentId = "";
  rosterCache = [];
  renderDots(4);
  setLoginEnabled();
  clearStatus();

  const grade = gradeSel.value;
  const homeroomId = roomSel.value;

  studentSel.disabled = true;
  studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;

  if (!grade || !homeroomId) return;

  await populateStudents(grade, homeroomId);
});

studentSel.addEventListener("change", () => {
  selectedStudentId = studentSel.value || "";
  setLoginEnabled();
});

keypad.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const k = btn.dataset.k;

  if (k === "clr") pin = "";
  else if (k === "bk") pin = pin.slice(0, -1);
  else if (/^\d$/.test(k)) {
    if (pin.length < 6) pin += k;
  }

  renderDots(4);
  setLoginEnabled();
});

loginBtn.addEventListener("click", doLogin);
resetBtn.addEventListener("click", resetAll);

resetAll();
