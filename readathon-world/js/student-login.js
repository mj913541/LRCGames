// js/student-login.js
// Grade Tile -> Homeroom Tiles -> Name -> PIN -> verifyStudentPinHttp -> redirect

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

/* =========================
   Elements
========================= */
const $ = (id) => document.getElementById(id);

// Role/grade tiles (already in HTML)
const roleTiles = document.querySelectorAll(".role-tile");
const roleGrid = $("roleGrid");

// Student flow wrapper (you added this)
const studentFlow = $("studentFlow");

// Homeroom dropdown exists but we hide it + keep it in sync (optional)
const roomSel = $("roomSel");

// We will render homeroom PNG tiles into this container
const roomGrid = $("roomGrid");

// Student dropdown
const studentSel = $("studentSel");

// PIN UI
const keypad = $("keypad");
const dots = $("dots");
const loginBtn = $("loginBtn");
const resetBtn = $("resetBtn");
const statusBox = $("status");

/* =========================
   State
========================= */
let pin = "";
let selectedStudentId = "";
let selectedGrade = "";

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

  // reset homerooms
  if (roomSel) {
    roomSel.value = "";
    roomSel.disabled = true;
    roomSel.innerHTML = `<option value="">Choose grade first…</option>`;
    roomSel.style.display = "none"; // keep hidden if present
  }
  if (roomGrid) {
    roomGrid.innerHTML = "";
  }

  // reset students
  if (studentSel) {
    studentSel.value = "";
    studentSel.disabled = true;
    studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;
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
   Grade Mapping
   (PreK/K tile -> grade 0)
========================= */
function roleToGradeId(role) {
  if (role === "prek") return "0";
  if (/^[1-5]$/.test(role)) return role;
  return "";
}

/* =========================
   Homerooms -> PNG Tiles
========================= */
async function populateHomeroomsFromFirestore(gradeId) {
  clearStatus();

  // Reset student dropdown while homerooms load
  if (studentSel) {
    studentSel.disabled = true;
    studentSel.value = "";
    studentSel.innerHTML = `<option value="">Choose homeroom first…</option>`;
  }

  // Prepare homeroom select (hidden) + tile grid
  if (roomSel) {
    roomSel.disabled = true;
    roomSel.value = "";
    roomSel.innerHTML = `<option value="">Loading…</option>`;
    roomSel.style.display = "none"; // keep hidden
  }
  if (roomGrid) {
    roomGrid.innerHTML = `<div style="opacity:.75; padding:10px;">Loading homerooms…</div>`;
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
      if (roomGrid) roomGrid.innerHTML = `<div style="padding:10px;">No homerooms found.</div>`;
      setStatus(`No classes found for this grade.`, "err");
      return;
    }

    const homerooms = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id, // IMPORTANT: this is your Firestore homeroomId like "rosenthal_4"
        label: data.displayName || d.id
      };
    });

    homerooms.sort((a, b) => String(a.label).localeCompare(String(b.label)));

    // Build hidden select options (keeps your old flow compatible)
    if (roomSel) {
      roomSel.innerHTML =
        `<option value="">Choose…</option>` +
        homerooms
          .map(
            (h) =>
              `<option value="${escapeHtml(h.id)}">${escapeHtml(h.label)}</option>`
          )
          .join("");
      roomSel.disabled = false;
    }

    // Render tiles
    if (roomGrid) roomGrid.innerHTML = "";

    homerooms.forEach((room) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "role-tile";
      btn.dataset.roomId = room.id;

      const img = document.createElement("img");
      const imgKey = String(room.id).toLowerCase(); // rosenthal_4 -> rosenthal_4
      img.src = `./assets/houseGradePhotos/${imgKey}.png`;
      img.alt = room.label;

      img.onerror = () => {
        // Optional: add this file if you want a friendly fallback
        img.src = "./assets/houseGradePhotos/default-room.png";
      };

      const span = document.createElement("span");
      span.textContent = room.label;

      btn.appendChild(img);
      btn.appendChild(span);

      btn.addEventListener("click", async () => {
        clearStatus();

        // reset student selection + pin
        selectedStudentId = "";
        pin = "";
        renderDots(4);

        // sync hidden dropdown
        if (roomSel) roomSel.value = room.id;

        // highlight selected tile
        document.querySelectorAll("#roomGrid .role-tile").forEach((t) => {
          t.style.border = "2px solid rgba(0,0,0,0.08)";
        });
        btn.style.border = "3px solid #1f8f5f";

        await populateStudents(selectedGrade, room.id);
        setLoginEnabled();
      });

      roomGrid?.appendChild(btn);
    });
  } catch (e) {
    console.error(e);
    if (roomGrid) roomGrid.innerHTML = `<div style="padding:10px;">Error loading homerooms.</div>`;
    setStatus(`Could not load classes. Try again.`, "err");
  }
}

/* =========================
   Students dropdown (same as before)
========================= */
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

    const roster = snap.docs
      .map((d) => {
        const s = d.data() || {};
        return {
          studentId: s.studentId || d.id,
          displayName: s.displayName || s.studentName || s.name || "Student"
        };
      })
      .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));

    if (!roster.length) {
      if (studentSel) studentSel.innerHTML = `<option value="">No students found</option>`;
      setStatus(`No names found for that class.`, "err");
      return;
    }

    if (studentSel) {
      studentSel.innerHTML =
        `<option value="">Choose…</option>` +
        roster
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
   Verify PIN + Login
========================= */
async function doLogin() {
  clearStatus();

  const homeroomId = String(roomSel?.value || "");

  if (!selectedGrade) {
    setStatus(`Pick your grade first. 🙂`, "err");
    return;
  }
  if (!homeroomId) {
    setStatus(`Pick your homeroom first. 🙂`, "err");
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

// Grade tile clicks
roleTiles.forEach((tile) => {
  tile.addEventListener("click", async () => {
    clearStatus();
    pin = "";
    selectedStudentId = "";
    renderDots(4);

    const role = tile.dataset.role;

if (role === "staff") {
  window.location.href = "/readathon-world/staff-login.html";
  return;
}

    if (role === "admin") {
      window.location.href = "/readathon-world/admin.html";
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

    // Reset UI below grade
    if (roomGrid) roomGrid.innerHTML = "";
    if (roomSel) {
      roomSel.value = "";
      roomSel.disabled = true;
      roomSel.innerHTML = `<option value="">Loading…</option>`;
      roomSel.style.display = "none";
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

// Student selection
studentSel?.addEventListener("change", () => {
  selectedStudentId = studentSel.value || "";
  setLoginEnabled();
});

// Keypad
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

// Login
loginBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  doLogin();
});

// Reset
resetBtn?.addEventListener("click", resetAll);

// Start
resetAll();
