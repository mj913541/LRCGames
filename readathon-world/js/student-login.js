// js/student-login.js
// Grade -> Homeroom -> Name -> PIN -> verifyStudentPinHttp -> redirect

import { auth, db } from "/readathon-world/js/firebase.js";

import {
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

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

let pin = "";
let selectedStudentId = "";
let rosterCache = [];

/* =========================
   UI Helpers
========================= */

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
    pin.length === 4; // strict 4-digit PIN

  loginBtn.disabled = !ok;
}

/* =========================
   Auth
========================= */

async function ensureAnonAuth() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub();
        resolve(u);
      }
    });
  });

  await user.getIdToken(true);
  return user;
}

/* =========================
   Load Homerooms
========================= */

async function populateHomeroomsFromFirestore(grade) {
  clearStatus();

  roomSel.disabled = true;
  roomSel.innerHTML = `<option value="">Loading…</option>`;
  studentSel.disabled = true;
  studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;

  try {
    await ensureAnonAuth();

    const homeroomsRef = collection(
      db,
      "schools",
      "main",
      "grades",
      String(grade),
      "homerooms"
    );

    const snap = await getDocs(
      query(homeroomsRef, where("active", "==", true))
    );

    if (snap.empty) {
      roomSel.innerHTML = `<option value="">No homerooms found</option>`;
      setStatus(`No classes found for this grade.`, "err");
      return;
    }

    const options = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        label: data.displayName || d.id
      };
    });

    options.sort((a, b) =>
      String(a.label).localeCompare(String(b.label))
    );

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
    setStatus(`Could not load classes. Try again.`, "err");
  }
}

/* =========================
   Load Students
========================= */

async function populateStudents(grade, homeroomId) {
  clearStatus();

  studentSel.disabled = true;
  studentSel.innerHTML = `<option value="">Loading…</option>`;

  try {
    await ensureAnonAuth();

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

    const snap = await getDocs(
      query(studentsRef, where("active", "==", true))
    );

    rosterCache = snap.docs
      .map((d) => {
        const s = d.data() || {};
        return {
          studentId: s.studentId || d.id,
          displayName:
            s.displayName || s.studentName || s.name || "Student"
        };
      })
      .sort((a, b) =>
        String(a.displayName).localeCompare(String(b.displayName))
      );

    if (!rosterCache.length) {
      studentSel.innerHTML = `<option value="">No students found</option>`;
      setStatus(`No names found for that class.`, "err");
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
    setStatus(`Error loading students.`, "err");
  }
}

/* =========================
   Login
========================= */

async function doLogin() {
  clearStatus();

  if (!selectedStudentId) {
    setStatus(`Pick your name first. 🙂`, "err");
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    setStatus(`PIN must be exactly 4 numbers.`, "err");
    return;
  }

  loginBtn.disabled = true;

  try {
    const user = await ensureAnonAuth();
    const token = await user.getIdToken(true);

    const gradeId = String(gradeSel.value);
    const homeroomId = String(roomSel.value);

    const resp = await fetch(
      "https://us-central1-lrcquest-3039e.cloudfunctions.net/verifyStudentPinHttp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: selectedStudentId,
          pin,
          gradeId,
          homeroomId
        })
      }
    );

    const resData = await resp.json();

    if (resData?.ok) {

      const studentPath =
        `schools/main/grades/${gradeId}/homerooms/${homeroomId}/students/${selectedStudentId}`;

      sessionStorage.setItem("studentPath", studentPath);
      sessionStorage.setItem("gradeId", gradeId);
      sessionStorage.setItem("homeroomId", homeroomId);
      sessionStorage.setItem("studentId", selectedStudentId);
      sessionStorage.setItem(
        "displayName",
        resData.profile?.displayName || ""
      );

      setStatus(
        `✅ Welcome, <strong>${escapeHtml(
          resData.profile?.displayName || "Reader"
        )}</strong>! Entering your world…`
      );

      setTimeout(() => {
        window.location.href = "/readathon-world/student-home.html";
      }, 600);

    } else {
      setStatus(`That PIN didn’t match. Try again!`, "err");
      pin = "";
      renderDots(4);
    }

  } catch (e) {
    console.error(e);
    setStatus(`Something went wrong. Try again.`, "err");
    pin = "";
    renderDots(4);
  }

  setLoginEnabled();
}

/* =========================
   Events
========================= */

renderDots(4);

gradeSel.addEventListener("change", async () => {
  pin = "";
  selectedStudentId = "";
  renderDots(4);
  setLoginEnabled();

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
  renderDots(4);
  setLoginEnabled();

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
  else if (/^\d$/.test(k) && pin.length < 4) pin += k;

  renderDots(4);
  setLoginEnabled();
});

loginBtn.addEventListener("click", (e) => {
  e.preventDefault();
  doLogin();
});

resetBtn.addEventListener("click", resetAll);

resetAll();
