// js/staff-home.js
// Staff Home = student-home vibe + ability to submit minutes for roster (pending -> admin approval)

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
  where,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ==============================
   UI References
============================== */

const staffNameEl = document.getElementById("staffName");
const teacherEl = document.getElementById("teacherName");
const gradeEl = document.getElementById("grade");

const approvedEl = document.getElementById("approvedMinutes");
const pendingEl = document.getElementById("pendingMinutes");
const rubiesEl = document.getElementById("rubies");

const roomEl = document.getElementById("roomLayers");
const signOutBtn = document.getElementById("signOutBtn");

const minutesEl = document.getElementById("minutes");
const readingDateEl = document.getElementById("readingDate");
const noteEl = document.getElementById("note");
const rosterGridEl = document.getElementById("rosterGrid");
const rosterMetaEl = document.getElementById("rosterMeta");
const selectAllBtn = document.getElementById("selectAllBtn");
const selectNoneBtn = document.getElementById("selectNoneBtn");
const submitRosterBtn = document.getElementById("submitRosterBtn");
const msgEl = document.getElementById("msg");

/* ==============================
   Helpers
============================== */

function goToLogin() {
  // Your normal home / login entry point
  window.location.href = "index.html";
}

function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function setMsg(text, ok = false) {
  if (!msgEl) return;
  msgEl.textContent = text || "";
  msgEl.style.opacity = text ? "1" : "0";
  msgEl.style.color = ok ? "green" : "crimson";
}

function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeRosterStudent(docSnap) {
  const data = docSnap.data() || {};
  return {
    studentId: docSnap.id,
    displayName: data.displayName || data.name || "Student"
  };
}

/* ==============================
   Default date
============================== */
if (readingDateEl) readingDateEl.value = todayLocalISO();

/* ==============================
   Session / State
============================== */

let currentUid = null;
let staffProfile = null;      // users/{teacherId} data
let rosterStudents = [];      // [{studentId, displayName}]
let rosterPath = null;        // schools/main/grades/4/homerooms/rosenthal_4/students
let currentTeacherId = null;  // e.g. "rosenthal"

/* ==============================
   Staff identity (TEMP for now)
   We will set this from your Staff Login button later.
============================== */

function getTeacherIdFromSession() {
  return (sessionStorage.getItem("teacherId") || "").trim().toLowerCase();
}

/* ==============================
   Load staff profile
============================== */

async function loadStaffProfileByTeacherId(teacherId) {
  const ref = doc(db, "users", teacherId); // IMPORTANT: doc id is teacherId
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

/**
 * Roster path derived from homeroomPath (your chosen plan)
 * homeroomPath example:
 *   schools/main/grades/4/homerooms/rosenthal_4
 * roster path becomes:
 *   schools/main/grades/4/homerooms/rosenthal_4/students
 */
function deriveRosterPathFromProfile(profile) {
  if (!profile) return null;

  if (profile.homeroomPath) {
    return `${String(profile.homeroomPath).replace(/\/$/, "")}/students`;
  }

  return null;
}

/* ==============================
   Load roster list
============================== */

async function loadRosterStudents(path) {
  if (!path) return [];

  const colRef = collection(db, path);
  const snap = await getDocs(colRef);

  const kids = [];
  snap.forEach((d) => kids.push(normalizeRosterStudent(d)));
  kids.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return kids;
}

function renderRosterList(kids) {
  if (!rosterGridEl) return;

  rosterGridEl.innerHTML = "";

  if (!kids.length) {
    rosterGridEl.innerHTML = `<div class="tiny muted">No students found for this roster.</div>`;
    updateRosterMeta();
    return;
  }

  kids.forEach((s) => {
    const row = document.createElement("label");
    row.className = "roster-item";
    row.innerHTML = `
      <input type="checkbox" data-student-id="${escapeHtml(s.studentId)}" checked />
      <div>
        <div class="roster-name">${escapeHtml(s.displayName)}</div>
        <div class="roster-sub">ID: ${escapeHtml(s.studentId)}</div>
      </div>
    `;
    rosterGridEl.appendChild(row);
  });

  updateRosterMeta();
}

function getSelectedStudentIds() {
  if (!rosterGridEl) return [];
  const checks = rosterGridEl.querySelectorAll("input[type='checkbox'][data-student-id]");
  const ids = [];
  checks.forEach((c) => {
    if (c.checked) ids.push(c.getAttribute("data-student-id"));
  });
  return ids;
}

function setAllChecks(on) {
  if (!rosterGridEl) return;
  const checks = rosterGridEl.querySelectorAll("input[type='checkbox'][data-student-id]");
  checks.forEach((c) => (c.checked = on));
  updateRosterMeta();
}

function updateRosterMeta() {
  if (!rosterMetaEl) return;
  const selected = getSelectedStudentIds().length;
  const total = rosterStudents.length;
  rosterMetaEl.textContent = total ? `${selected} selected of ${total}` : "—";
}

/* ==============================
   Staff self-stats (optional)
   (Only works if you create students/{uid} docs for staff. Otherwise shows —.)
============================== */

async function loadSelfStats(uid) {
  let approvedMinutes = 0;
  let rubiesBalance = 0;

  try {
    const totalsRef = doc(db, "students", uid);
    const totalsSnap = await getDoc(totalsRef);

    if (totalsSnap.exists()) {
      const totals = totalsSnap.data() || {};
      approvedMinutes = safeInt(totals.totalApprovedMinutes, 0);
      rubiesBalance = safeInt(totals.rubiesBalance, 0);
    } else {
      approvedMinutes = 0;
      rubiesBalance = 0;
    }
  } catch (err) {
    console.warn("Staff totals read failed (ok if not used):", err);
    approvedMinutes = 0;
    rubiesBalance = 0;
  }

  let pendingMinutes = 0;
  try {
    const pendingQ = query(
      collection(db, "minuteSubmissions"),
      where("studentId", "==", uid),
      where("status", "==", "pending")
    );
    const pendingSnap = await getDocs(pendingQ);
    pendingSnap.forEach((d) => {
      const data = d.data() || {};
      pendingMinutes += safeInt(data.minutes, 0);
    });
  } catch (err) {
    console.warn("Staff pending query failed (ok if not used):", err);
    pendingMinutes = 0;
  }

  if (approvedEl) approvedEl.textContent = approvedMinutes ? approvedMinutes : "—";
  if (pendingEl) pendingEl.textContent = pendingMinutes;
  if (rubiesEl) rubiesEl.textContent = rubiesBalance ? rubiesBalance : "—";
}

/* ==============================
   Bulk submit: one doc per selected student
============================== */

async function submitForRoster() {
  setMsg("");

  if (!currentUid || !staffProfile) {
    setMsg("Please sign in again.");
    return;
  }

  if (!rosterStudents.length) {
    setMsg("No roster is loaded for your account yet.");
    return;
  }

  const minutes = parseInt(minutesEl?.value || "", 10);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
    setMsg("Minutes must be between 1 and 600.");
    return;
  }

  const readingDate = readingDateEl?.value;
  if (!readingDate) {
    setMsg("Pick a reading date.");
    return;
  }

  const note = (noteEl?.value || "").trim();

  const selectedIds = getSelectedStudentIds();
  if (!selectedIds.length) {
    setMsg("Select at least one student.");
    return;
  }

  submitRosterBtn.disabled = true;
  submitRosterBtn.textContent = "Sending…";

  const nameById = new Map(rosterStudents.map((s) => [s.studentId, s.displayName]));

  const submittedByName =
    staffProfile.displayName ||
    staffProfile.staffName ||
    staffProfile.teacherName ||
    currentTeacherId ||
    "Staff";

  // prefer teacherId from profile, else our session teacher id
  const teacherId = staffProfile.teacherId || currentTeacherId || null;

  const teacherName = staffProfile.displayName || staffProfile.teacherName || null;
  const grade = staffProfile.grade ?? 6;

  let okCount = 0;

  try {
    for (const studentId of selectedIds) {
      const studentName = nameById.get(studentId) || null;

      await addDoc(collection(db, "minuteSubmissions"), {
        studentUid: null,
        studentId,
        studentName,

        grade,
        teacherId,
        teacherName,

        minutes,
        readingDate,
        ...(note ? { note } : {}),

        status: "pending",
        createdAt: serverTimestamp(),

        reviewedAt: null,
        reviewedBy: null,
        decisionNote: null,

        submittedByUid: currentUid,
        submittedByName,
        submittedByRole: "staff",
        submissionType: "bulk"
      });

      okCount++;
    }

    minutesEl.value = "";
    noteEl.value = "";
    readingDateEl.value = todayLocalISO();

    setMsg(`✅ Sent ${okCount} submission(s) to Mrs. A for approval.`, true);
  } catch (err) {
    console.error(err);
    setMsg(`Oops — something failed while sending. Please try again.`, false);
  } finally {
    submitRosterBtn.disabled = false;
    submitRosterBtn.textContent = "✅ Send selected to Mrs. A";
  }
}

/* ==============================
   Optional room rendering (kept)
============================== */

async function renderRoom(equipped) {
  if (!roomEl) return;

  roomEl.innerHTML = "";

  let storeSnap;
  try {
    storeSnap = await getDocs(collection(db, "storeItems"));
  } catch (err) {
    console.warn("Store items read failed (ok if you haven’t enabled it for staff):", err);
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

  addLayer(equipped?.background, "bg");
  addLayer(equipped?.decor, "decor");
  addLayer(equipped?.body, "body");
  addLayer(equipped?.outfit, "outfit");
  addLayer(equipped?.accessory, "accessory");
  addLayer(equipped?.pet, "pet");
}

/* ==============================
   Auth Guard + Boot
============================== */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    goToLogin();
    return;
  }

  currentUid = user.uid;

  // IMPORTANT: profile is keyed by teacherId (doc id), not uid
  currentTeacherId = getTeacherIdFromSession();
  if (!currentTeacherId) {
    setMsg("Missing teacherId in session. (Next step: staff button will set this automatically.)");
    return;
  }

  staffProfile = await loadStaffProfileByTeacherId(currentTeacherId);
  if (!staffProfile) {
    setMsg(`I can’t find your staff profile: users/${currentTeacherId}`);
    return;
  }

  // Header chips
  if (staffNameEl) {
    staffNameEl.textContent =
      staffProfile.displayName ||
      staffProfile.staffName ||
      staffProfile.teacherName ||
      currentTeacherId ||
      "Staff";
  }

  const homeroomLabel =
    staffProfile.displayName ||
    staffProfile.teacherName ||
    staffProfile.teacherId ||
    "Staff";

  const gradeLabel =
    (staffProfile.grade ?? 6);

  if (teacherEl) teacherEl.textContent = homeroomLabel;
  if (gradeEl) gradeEl.textContent = gradeLabel;

  // Load roster from homeroomPath
  rosterPath = deriveRosterPathFromProfile(staffProfile);
  if (!rosterPath) {
    setMsg("No homeroom roster linked yet for this staff account.");
    if (rosterMetaEl) rosterMetaEl.textContent = "No homeroomPath";
    submitRosterBtn.disabled = true;
  } else {
    rosterStudents = await loadRosterStudents(rosterPath);
    renderRosterList(rosterStudents);
    submitRosterBtn.disabled = rosterStudents.length === 0;
  }

  await loadSelfStats(currentUid);
  await renderRoom(staffProfile.equipped || {});
});

/* ==============================
   Events
============================== */

selectAllBtn?.addEventListener("click", () => setAllChecks(true));
selectNoneBtn?.addEventListener("click", () => setAllChecks(false));
rosterGridEl?.addEventListener("change", () => updateRosterMeta());
submitRosterBtn?.addEventListener("click", submitForRoster);

signOutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  sessionStorage.clear();
  window.location.href = "index.html";
});
