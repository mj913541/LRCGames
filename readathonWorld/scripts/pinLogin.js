// /readathonWorld/scripts/pinLogin.js
// fff Flow: Grade → Homeroom → Student Name → PIN
// Creates a LINK REQUEST for staff approval (does not auto-link).
// ✅ Uses existing Firebase instances (no re-init).

// Visual proof the JS module loaded
document.body.insertAdjacentHTML(
  "afterbegin",
  "<div style='position:fixed;top:10px;left:10px;z-index:9999;background:#22c55e;color:#000;padding:8px 10px;border-radius:10px;font-weight:700'>JS LOADED</div>"
);

import { app, auth, db } from "/lrcQuestMain/scripts/lrcQuestCore.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const SCHOOL_DOC_ID = "main";

// UI
const gradeGrid = document.getElementById("gradeGrid");
const homeroomGrid = document.getElementById("homeroomGrid");
const studentGrid = document.getElementById("studentGrid");

const pinEl = document.getElementById("pin");
const btn = document.getElementById("loginBtn");
const statusEl = document.getElementById("status");

const pickedGradeEl = document.getElementById("pickedGrade");
const pickedHomeroomEl = document.getElementById("pickedHomeroom");
const pickedStudentEl = document.getElementById("pickedStudent");

// State
let selectedGrade = null;
let selectedHomeroom = null;
let selectedStudentId = null;
let selectedStudentName = null;

// Start
main();

async function main() {
  try {
    setStatus("Signing in…");

    // ✅ Must be signed in before reading /schools/**
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

setStatus("Signed in anonymously ✅");
await debugInventory();           // 👈 ADD THIS LINE
await debugTopCollections(); 
await renderGradesFromFirestore();

} catch (e) {
  console.warn("DEBUG collection error:", name, e?.code, e?.message);
  results.push({ name, size: e?.code || "ERR" });
}

}

btn.onclick = async () => {
  try {
    setStatus("");

    const pin = pinEl.value.trim();

    if (!selectedGrade) return setStatus("Pick your grade.");
    if (!selectedHomeroom) return setStatus("Pick your homeroom.");
    if (!selectedStudentId) return setStatus("Pick your name.");
    if (!/^\d{4,6}$/.test(pin)) return setStatus("PIN must be 4–6 digits.");

    setStatus("Sending request…");

    // Ensure signed in anonymously
    const userCred = auth.currentUser
      ? { user: auth.currentUser }
      : await signInAnonymously(auth);

    const uid = userCred.user.uid;

    const studentDocPath =
      `schools/${SCHOOL_DOC_ID}/grades/${selectedGrade}/homerooms/${selectedHomeroom}/students/${selectedStudentId}`;

    await addDoc(collection(db, "readathonRequests"), {
      type: "linkAccount",
      status: "pending",

      requesterUid: uid,
      pinEntered: pin,

      schoolId: SCHOOL_DOC_ID,
      gradeId: selectedGrade,
      homeroomId: selectedHomeroom,

      studentId: selectedStudentId,
      studentName: selectedStudentName,

      studentDocPath,
      createdAt: serverTimestamp()
    });

    setStatus("✅ Request sent! Please wait for staff approval.");
  } catch (e) {
    setStatus("ERROR: " + (e?.message || String(e)));
  }
};

// ---------------------------
// Render helpers (Firestore-driven)
// ---------------------------

async function renderGradesFromFirestore() {
  gradeGrid.innerHTML = `<div class="text-sm text-white/60">Loading…</div>`;
  homeroomGrid.innerHTML = "";
  studentGrid.innerHTML = "";

  // Debug: show project id so we know which Firebase project you're actually connected to
  setStatus(`Project: ${app?.options?.projectId || "(unknown)"} | Probing grade 4…`);

  // Debug probe: can we read a known grade doc?
  const testRef = doc(db, "schools", SCHOOL_DOC_ID, "grades", "4");
  const testSnap = await getDoc(testRef);
  setStatus(`Project: ${app?.options?.projectId || "(unknown)"} | grade/4 exists: ${testSnap.exists()}`);

  // Now list all grade docs
  const gradesSnap = await getDocs(collection(db, "schools", SCHOOL_DOC_ID, "grades"));
  setStatus(`Grades list query returned: ${gradesSnap.size}`);

  const grades = gradesSnap.docs.map(d => ({ id: d.id }));

  if (!grades.length) {
    gradeGrid.innerHTML = `<div class="text-sm text-white/60">No grades found.</div>`;
    return;
  }

  gradeGrid.innerHTML = grades
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map(g => tileHtml({ id: g.id, label: gradeLabel(g.id) }, "grade"))
    .join("");

  gradeGrid.querySelectorAll("[data-grade]").forEach(btn => {
    btn.addEventListener("click", async () => {
      selectedGrade = btn.dataset.grade;
      selectedHomeroom = null;
      selectedStudentId = null;
      selectedStudentName = null;

      pickedGradeEl.textContent = gradeLabel(selectedGrade);
      pickedHomeroomEl.textContent = "—";
      pickedStudentEl.textContent = "—";

      highlightSelected("grade", selectedGrade);
      await renderHomeroomsFromFirestore(selectedGrade);
    });
  });

  // Clear status once grades render
  setStatus("");
}

async function renderHomeroomsFromFirestore(gradeId) {
  homeroomGrid.innerHTML = `<div class="text-sm text-white/60">Loading…</div>`;
  studentGrid.innerHTML = "";

  const hrSnap = await getDocs(
    collection(db, "schools", SCHOOL_DOC_ID, "grades", gradeId, "homerooms")
  );
  const homerooms = hrSnap.docs.map(d => ({ id: d.id }));

  if (!homerooms.length) {
    homeroomGrid.innerHTML = `<div class="text-sm text-white/60">No homerooms found for this grade.</div>`;
    return;
  }

  homeroomGrid.innerHTML = homerooms
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(h => tileHtml({ id: h.id, label: homeroomLabel(h.id) }, "homeroom"))
    .join("");

  homeroomGrid.querySelectorAll("[data-homeroom]").forEach(btn => {
    btn.addEventListener("click", async () => {
      selectedHomeroom = btn.dataset.homeroom;
      selectedStudentId = null;
      selectedStudentName = null;

      pickedHomeroomEl.textContent = homeroomLabel(selectedHomeroom);
      pickedStudentEl.textContent = "—";

      highlightSelected("homeroom", selectedHomeroom);
      await renderStudentsFromFirestore(gradeId, selectedHomeroom);
    });
  });
}

async function renderStudentsFromFirestore(gradeId, homeroomId) {
  studentGrid.innerHTML = `<div class="text-sm text-white/60">Loading…</div>`;

  const studentsSnap = await getDocs(
    collection(db, "schools", SCHOOL_DOC_ID, "grades", gradeId, "homerooms", homeroomId, "students")
  );

  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (!students.length) {
    studentGrid.innerHTML = `<div class="text-sm text-white/60">No students found.</div>`;
    return;
  }

  studentGrid.innerHTML = students
    .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""))
    .map(s => tileHtml({ id: s.id, label: s.displayName || s.id }, "student"))
    .join("");

  studentGrid.querySelectorAll("[data-student]").forEach(btn => {
    btn.addEventListener("click", async () => {
      selectedStudentId = btn.dataset.student;

      const ref = doc(
        db,
        "schools", SCHOOL_DOC_ID,
        "grades", gradeId,
        "homerooms", homeroomId,
        "students", selectedStudentId
      );

      const snap = await getDoc(ref);
      selectedStudentName = snap.exists()
        ? (snap.data().displayName || selectedStudentId)
        : selectedStudentId;

      pickedStudentEl.textContent = selectedStudentName;
      highlightSelected("student", selectedStudentId);
      setStatus("");
    });
  });
}

// ---------------------------
// UI utilities
// ---------------------------

function tileHtml(item, type) {
  const dataAttr =
    type === "grade" ? `data-grade="${escapeAttr(item.id)}" data-type="grade"` :
    type === "homeroom" ? `data-homeroom="${escapeAttr(item.id)}" data-type="homeroom"` :
    `data-student="${escapeAttr(item.id)}" data-type="student"`;

  // Optional grade image
  const imgSrc = type === "grade"
    ? `/readathonWorld/assets/ui/grade-${item.id}.png`
    : null;

  const imgBlock = imgSrc ? `
    <div class="aspect-[16/9] bg-black/30 overflow-hidden">
      <img src="${imgSrc}" alt=""
           class="w-full h-full object-cover"
           onerror="this.style.display='none'">
    </div>
  ` : "";

  return `
    <button ${dataAttr}
      class="group text-left rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 transition">
      ${imgBlock}
      <div class="p-4">
        <div class="font-extrabold">${escapeHtml(item.label)}</div>
        <div class="text-xs text-white/60 mt-1">${escapeHtml(item.id)}</div>
      </div>
    </button>
  `;
}

function highlightSelected(type, selectedId) {
  document.querySelectorAll(`[data-type="${type}"]`).forEach(el => {
    const id =
      type === "grade" ? el.dataset.grade :
      type === "homeroom" ? el.dataset.homeroom :
      el.dataset.student;

    if (id === selectedId) {
      el.classList.add("ring-2", "ring-indigo-300", "bg-white/10");
    } else {
      el.classList.remove("ring-2", "ring-indigo-300", "bg-white/10");
    }
  });
}

function gradeLabel(id) {
  if (id === "k" || id === "0") return "Kindergarten";
  return `${id}th Grade`.replace("1th", "1st").replace("2th", "2nd").replace("3th", "3rd");
}

function homeroomLabel(id) {
  return id
    .replaceAll("_", " ")
    .replace(/^mrs/, "Mrs ")
    .replace(/^mr/, "Mr ")
    .replace(/^ms/, "Ms ")
    .trim();
}

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
async function debugInventory() {
  // 1) List top-level school docs
  const schoolsSnap = await getDocs(collection(db, "schools"));
  const schoolIds = schoolsSnap.docs.map(d => d.id);

  console.log("DEBUG schools:", schoolIds);
  setStatus(`DEBUG schools: ${schoolIds.join(", ") || "(none)"}`);

  // 2) If our SCHOOL_DOC_ID isn't there, stop right away
  if (!schoolIds.includes(SCHOOL_DOC_ID)) {
    console.warn(`DEBUG: SCHOOL_DOC_ID="${SCHOOL_DOC_ID}" not found in /schools`);
    return;
  }

  // 3) List grades under the selected school
  const gradesSnap = await getDocs(collection(db, "schools", SCHOOL_DOC_ID, "grades"));
  const gradeIds = gradesSnap.docs.map(d => d.id);

  console.log(`DEBUG grades under schools/${SCHOOL_DOC_ID}:`, gradeIds);
  setStatus(`DEBUG grades under ${SCHOOL_DOC_ID}: ${gradeIds.join(", ") || "(none)"}`);

  // 4) Check if the school doc itself exists + what fields it has
  const schoolDocSnap = await getDoc(doc(db, "schools", SCHOOL_DOC_ID));
  console.log("DEBUG school doc exists:", schoolDocSnap.exists());
  console.log("DEBUG school doc data:", schoolDocSnap.data() || null);
}
async function debugTopCollections() {
  const candidates = [
    "grades",
    "homerooms",
    "students",
    "players",
    "users",
    "rosters",
    "roster",
    "classrooms",
    "classes",
    "teacherRosters",
    "studentRosters",
    "readathonStudents",
    "schoolsRoster",
    "districts"
  ];

  const results = [];

  for (const name of candidates) {
    try {
      const snap = await getDocs(collection(db, name));
      results.push({ name, size: snap.size });
    } catch (e) {
      results.push({ name, size: "ERR" });
    }
  }

  console.table(results);
  setStatus(
    "Top-level sizes: " +
      results
        .filter(r => typeof r.size === "number" && r.size > 0)
        .map(r => `${r.name}=${r.size}`)
        .join(" | ") +
      (results.some(r => r.size === "ERR") ? " | (some ERR)" : "")
  );
}
