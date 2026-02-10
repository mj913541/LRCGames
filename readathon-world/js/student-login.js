import { auth, functions } from "./firebase.js";

import {
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

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
let rosterCache = []; // {studentId, displayName}
let homeroomsByGrade = {}; // we’ll build from roster results

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

function resetAll() {
  pin = "";
  selectedStudentId = "";
  rosterCache = [];
  homeroomsByGrade = {};
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
    pin.length >= 3; // allow 3–6 like your uploader
  loginBtn.disabled = !ok;
}

async function ensureAnonAuth() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

async function loadHomeroomsForGrade(grade) {
  // You currently don’t have a separate homeroom directory.
  // We’ll ask the user to pick homeroom from a locally configured list OR
  // we can generate it from your existing students collection via a callable.
  //
  // Simplest: add a callable later to return homerooms list for grade.
  // For now, we’ll prompt user to pick a homeroom AFTER we fetch roster by grade+homeroom,
  // so we need a known list.
  //
  // Since you already have teacher icons / names, you probably have a list in your UI.
  // Quick solution: manually list homerooms here (you can paste in later).
  //
  // To keep you moving today, we’ll allow typing-style via select values you maintain.
  return null;
}

/**
 * IMPORTANT:
 * Since your structure includes grade/homeroom pickers, we need homeroom options.
 * Easiest is: store a public config doc with homerooms.
 * We'll do that now (simple + safe).
 */
const HOMEROOMS = {
  K: ["Mrs. Smith", "Ms. Jones"],
  1: ["Mrs. Brown", "Mr. Lee"],
  2: ["Mrs. Patel"],
  3: ["Mrs. A"],
  4: ["Ms. Green"],
  5: ["Mrs. White"]
};

function populateHomerooms(grade) {
  const rooms = HOMEROOMS[grade] || [];
  roomSel.innerHTML = `<option value="">Choose…</option>` +
    rooms.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
  roomSel.disabled = rooms.length === 0;
  studentSel.disabled = true;
  studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;
}

function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function populateStudents(grade, homeroom) {
  clearStatus();
  studentSel.disabled = true;
  studentSel.innerHTML = `<option value="">Loading…</option>`;

  try {
    await ensureAnonAuth();

    const getRoster = httpsCallable(functions, "getRoster");
    const res = await getRoster({ grade, homeroom });

    rosterCache = res?.data?.students || [];
    if (!rosterCache.length) {
      studentSel.innerHTML = `<option value="">No students found</option>`;
      setStatus(`Hmm… I couldn’t find a roster for that class. Ask your teacher for help.`, "err");
      return;
    }

    studentSel.innerHTML =
      `<option value="">Choose…</option>` +
      rosterCache.map(s => `<option value="${escapeHtml(s.studentId)}">${escapeHtml(s.displayName)}</option>`).join("");

    studentSel.disabled = false;
  } catch (e) {
    console.error(e);
    studentSel.innerHTML = `<option value="">Try again</option>`;
    setStatus(`Something went wrong loading names. Try again in a moment.`, "err");
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

    const verify = httpsCallable(functions, "verifyStudentPin");
    const res = await verify({ studentId: selectedStudentId, pin });

    if (res?.data?.ok) {
      setStatus(`✅ Welcome, <strong>${escapeHtml(res.data.profile.displayName)}</strong>! Entering your world…`);
      // Redirect to your main student world page
      // Change this to wherever your student “world” lives.
      window.location.href = "./index.html";
    } else {
      setStatus(`That PIN didn’t match. Try again!`, "err");
      pin = "";
      renderDots(4);
    }
  } catch (e) {
    console.error(e);
    const msg = e?.message || "Login failed.";
    // Kid-friendly messaging
    if (msg.toLowerCase().includes("pin")) {
      setStatus(`That PIN didn’t match. Try again!`, "err");
    } else {
      setStatus(`Oops! Something went wrong. Try again.`, "err");
    }
    pin = "";
    renderDots(4);
  } finally {
    setLoginEnabled();
  }
}

// --- Events ---
renderDots(4);

onAuthStateChanged(auth, (user) => {
  uid = user?.uid || null;
});

gradeSel.addEventListener("change", () => {
  pin = "";
  selectedStudentId = "";
  renderDots(4);
  setLoginEnabled();
  clearStatus();

  const grade = gradeSel.value;
  if (!grade) {
    roomSel.disabled = true;
    roomSel.innerHTML = `<option value="">Choose grade first…</option>`;
    studentSel.disabled = true;
    studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;
    return;
  }

  populateHomerooms(grade);
});

roomSel.addEventListener("change", async () => {
  pin = "";
  selectedStudentId = "";
  renderDots(4);
  setLoginEnabled();

  const grade = gradeSel.value;
  const homeroom = roomSel.value;
  if (!grade || !homeroom) return;

  await populateStudents(grade, homeroom);
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
