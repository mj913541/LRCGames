// js/student-login.js
// Role Tile (Grade/Staff/Admin) -> Homeroom -> Name -> PIN -> verifyStudentPinHttp -> redirect

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

// Role UI
const roleTiles = document.querySelectorAll(".role-tile");
const roleGrid = $("roleGrid");

// Optional wrapper (recommended, but not required)
const studentFlow = $("studentFlow");

// Student flow UI (exists in your HTML)
const roomSel = $("roomSel");
const studentSel = $("studentSel");
const keypad = $("keypad");
const dots = $("dots");
const loginBtn = $("loginBtn");
const resetBtn = $("resetBtn");
const statusBox = $("status");

let pin = "";
let selectedStudentId = "";
let selectedGrade = "";     // <-- NEW: grade comes from tile click
let rosterCache = [];

/* =========================
   UI Helpers
========================= */

function setStatus(msg, type = "ok") {
  if (!statusBox) return;
  statusBox.style.display = "block";
  statusBox.className = `status ${type === "err" ? "err" : ""}`;
  statusBox.innerHTML = msg;
}

function clearStatus() {
  if (!statusBox) return;
  statusBox.style.display = "none";
  statusBox.innerHTML = "";
}

function renderDots(len = 4) {
  if (!dots) return;
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

// If you add <div id="studentFlow"> ... </div>, these will hide/show the flow nicely.
// If not, everything still works; it just won’t hide visually.
function showRoleGrid() {
  if (roleGrid) roleGrid.style.display = "grid";
  if (studentFlow) studentFlow.style.display = "none";
}
function showStudentFlow() {
  if (roleGrid) roleGrid.style.display = "none";
  if (studentFlow) studentFlow.style.display = "block";
}

function setLoginEnabled() {
  const ok =
    !!selectedGrade &&
    !!roomSel?.value &&
    !!studentSel?.value &&
    pin.length === 4;

  if (loginBtn) loginBtn.disabled = !ok;
}

function resetAll() {
  pin = "";
  selectedStudentId = "";
  selectedGrade = "";
  rosterCache = [];

  if (roomSel) {
    roomSel.value = "";
    roomSel.innerHTML = `<option value="">Choose grade first…</option>`;
    roomSel.disabled = true;
  }

  if (studentSel) {
    studentSel.value = "";
    studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;
    studentSel.disabled = true;
  }

  if (loginBtn) loginBtn.disabled = true;

  renderDots(4);
  clearStatus();
  showRoleGrid();
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
   Firestore Loaders
========================= */

async function populateHomeroomsFromFirestore(gradeId) {
  clearStatus();

  if (roomSel) {
    roomSel.disabled = true;
    roomSel.innerHTML = `<option value="">Loading…</option>`;
  }
  if (studentSel) {
    studentSel.disabled = true;
    studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;
  }

  try {
    await ensureAnonAuth();

    const homeroomsRef = collection(
      db,
      "schools",
      "main",
      "grades",
      String(gradeId),
      "homerooms"
    );

    const snap = await getDocs(query(homeroomsRef, where("active", "==", true)));

    if (snap.empty) {
      if (roomSel) roomSel.innerHTML = `<option value="">No homerooms found</option>`;
      setStatus(`No classes found for this grade.`, "err");
      return;
    }

    const options = snap.docs.map((d) => {
      const data = d.data() || {};
      return { id: d.id, label: data.displayName || d.id };
    });

    options.sort((a, b) => String(a.label).localeCompare(String(b.label)));

    if (roomSel) {
      roomSel.innerHTML =
        `<option value="">Choose…</option>` +
        options
          .map(
            (o) =>
              `<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)}</option>`
          )
          .join("");

      roomSel.disabled = false;
    }
  } catch (e) {
    console.error(e);
    if (roomSel) roomSel.innerHTML = `<option value="">Error loading homerooms</option>`;
    setStatus(`Could not load classes. Try again.`, "err");
  }
}

async function populateStudents(gradeId, homeroomId) {
  clearStatus();

  if (studentSel) {
    studentSel.disabled = true;
    studentSel.innerHTML = `<option value="">Loading…</option>`;
  }

  try {
    await ensureAnonAuth();

    const studentsRef = collection(
      db,
      "schools",
      "main",
      "grades",
      String(gradeId),
      "homerooms",
      String(homeroomId),
      "students"
    );

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
      if (studentSel) studentSel.innerHTML = `<option value="">No students found</option>`;
      setStatus(`No names found for that class.`, "err");
      return;
    }

    if (studentSel) {
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
    }
  } catch (e) {
    console.error(e);
    if (studentSel) studentSel.innerHTML = `<option value="">Try again</option>`;
    setStatus(`Error loading students.`, "err");
  }
}

/* =========================
   Role Tile Clicks (FIXED)
========================= */

// Map tile roles to your Firestore grade IDs
function roleToGradeId(role) {
  if (role === "prek") return "0"; // PreK & K bucket
  if (/^[1-5]$/.test(role)) return role;
  return "";
}

roleTiles.forEach((tile) => {
  tile.addEventListener("click", async () => {
    clearStatus();
    pin = "";
    selectedStudentId = "";
    renderDots(4);

    const role = tile.dataset.role;

    if (role === "staff") {
      window.location.href = "/readathon-world/staff-home.html";
      return;
    }

    if (role === "admin") {
      window.location.href = "/readathon-world/admin-dashboard.html";
      return;
    }

    const gradeId = roleToGradeId(role);
    if (!gradeId) {
      setStatus("That grade tile is not set up correctly.", "err");
      return;
    }

    selectedGrade = gradeId;
    sessionStorage.setItem("selectedGrade", selectedGrade);

    showStudentFlow();

    // Reset dependent dropdowns
    if (roomSel) {
      roomSel.value = "";
      roomSel.disabled = true;
      roomSel.innerHTML = `<option value="">Loading…</option>`;
    }
    if (studentSel) {
      studentSel.value = "";
      studentSel.disabled = true;
      studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;
    }

    await populateHomeroomsFromFirestore(selectedGrade);
    setLoginEnabled();
  });
});

/* =========================
   Login
========================= */

async function doLogin() {
  clearStatus();

  if (!selectedGrade) {
    setStatus(`Pick your grade first. 🙂`, "err");
    return;
  }

  if (!selectedStudentId) {
    setStatus(`Pick your name first. 🙂`, "err");
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    setStatus(`PIN must be exactly 4 numbers.`, "err");
    return;
  }

  if (loginBtn) loginBtn.disabled = true;

  try {
    const user = await ensureAnonAuth();
    const token = await user.getIdToken(true);

    const gradeId = String(selectedGrade);
    const homeroomId = String(roomSel?.value || "");

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
      sessionStorage.setItem("displayName", resData.profile?.displayName || "");

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

roomSel?.addEventListener("change", async () => {
  pin = "";
  selectedStudentId = "";
  renderDots(4);

  if (studentSel) {
    studentSel.disabled = true;
    studentSel.innerHTML = `<option value="">Loading…</option>`;
  }

  const homeroomId = roomSel.value;
  if (!selectedGrade || !homeroomId) {
    if (studentSel) {
      studentSel.disabled = true;
      studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;
    }
    setLoginEnabled();
    return;
  }

  await populateStudents(selectedGrade, homeroomId);
  setLoginEnabled();
});

studentSel?.addEventListener("change", () => {
  selectedStudentId = studentSel.value || "";
  setLoginEnabled();
});

keypad?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const k = btn.dataset.k;

  if (k === "clr") pin = "";
  else if (k === "bk") pin = pin.slice(0, -1);
  else if (/^\d$/.test(k) && pin.length < 4) pin += k;

  renderDots(4);
  setLoginEnabled();
});

loginBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  doLogin();
});

resetBtn?.addEventListener("click", resetAll);

resetAll();
