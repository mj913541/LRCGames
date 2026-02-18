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
  orderBy,
  limit,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const el = (id) => document.getElementById(id);

const staffNameEl = el("staffName");
const groupLabelEl = el("groupLabel");
const gradeLabelEl = el("gradeLabel");
const statusNoteEl = el("statusNote");

const targetSel = el("targetSel");
const minutesEl = el("minutes");
const readingDateEl = el("readingDate");
const noteEl = el("note");
const form = el("staffMinuteForm");
const msgEl = el("msg");
const submitBtn = el("submitBtn");

const studentListEl = el("studentList");
const pendingListEl = el("pendingList");

const refreshBtn = el("refreshBtn");
const signOutBtn = el("signOutBtn");

let currentUid = null;

// We’ll pull this from admins/{uid} so you can assign staff to a homeroom/group without a new system.
// adminDoc example fields (recommended):
//   displayName: "Ms. Peterson"
//   gradeId: "2"
//   homeroomId: "Peterson"
//   groups: [{ gradeId:"2", homeroomId:"Peterson" }, { gradeId:"3", homeroomId:"Hossain" }]
let staffProfile = null;
let myStudents = []; // { studentId, displayName, gradeId, homeroomId, rosterPath }

function setNote(text, show = true) {
  if (!statusNoteEl) return;
  statusNoteEl.style.display = show ? "block" : "none";
  statusNoteEl.textContent = text || "";
}

function setMsg(text, ok = false) {
  msgEl.textContent = text || "";
  msgEl.style.color = ok ? "green" : "crimson";
}

function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

readingDateEl.value = todayLocalISO();

async function requireStaff(user) {
  // Reuse your existing allowlist approach
  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  if (!adminSnap.exists()) {
    alert("Staff access required.");
    window.location.href = "/readathon-world/index.html";
    throw new Error("staff-required");
  }
  return adminSnap.data() || {};
}

function getGroups(profile) {
  if (Array.isArray(profile.groups) && profile.groups.length) return profile.groups;
  if (profile.gradeId && profile.homeroomId) return [{ gradeId: profile.gradeId, homeroomId: profile.homeroomId }];
  return [];
}

async function loadRosterForGroups(groups) {
  const out = [];

  for (const g of groups) {
    const gradeId = String(g.gradeId);
    const homeroomId = String(g.homeroomId);

    const studentsCol = collection(
      db,
      "schools","main","grades",gradeId,"homerooms",homeroomId,"students"
    );

    // If your student docs have active:true, keep this filter; if not, remove it.
    const snap = await getDocs(query(studentsCol, where("active","==",true)));

    snap.forEach((d) => {
      const s = d.data() || {};
      out.push({
        studentId: d.id,
        displayName: s.displayName || s.studentName || s.name || d.id,
        gradeId,
        homeroomId,
        rosterPath: `schools/main/grades/${gradeId}/homerooms/${homeroomId}/students/${d.id}`
      });
    });
  }

  // sort by name
  out.sort((a,b)=> String(a.displayName).localeCompare(String(b.displayName)));
  return out;
}

function renderTargetSelect() {
  // keep "self" then students
  const opts = [
    `<option value="self">Me (Staff)</option>`,
    ...myStudents.map(s => `<option value="${s.studentId}">${s.displayName} (${s.homeroomId})</option>`)
  ];
  targetSel.innerHTML = opts.join("");
}

function renderStudentList() {
  if (!studentListEl) return;
  if (!myStudents.length) {
    studentListEl.innerHTML = `<p class="muted">No students found for your group.</p>`;
    return;
  }

  studentListEl.innerHTML = myStudents.map(s => `
    <div class="choice" style="margin-bottom:10px;">
      <div class="choice-emoji">🧒</div>
      <div class="choice-label">
        <strong>${s.displayName}</strong><br/>
        Grade ${s.gradeId} • ${s.homeroomId}<br/>
        <button class="btn btn-secondary" data-pick="${s.studentId}" type="button" style="margin-top:8px;">Submit for this student</button>
      </div>
    </div>
  `).join("");

  studentListEl.querySelectorAll("[data-pick]").forEach(btn => {
    btn.addEventListener("click", () => {
      targetSel.value = btn.getAttribute("data-pick");
      minutesEl.focus();
      setMsg("");
    });
  });
}

async function loadPendingForMyGroup() {
  if (!pendingListEl) return;
  pendingListEl.innerHTML = `<p class="muted">Loading…</p>`;

  // We key submissions by teacherId in submit.js :contentReference[oaicite:6]{index=6}
  // For staff-submitted entries, we will also set teacherId = staff uid.
  const qRef = query(
    collection(db, "minuteSubmissions"),
    where("teacherId", "==", currentUid),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  const snap = await getDocs(qRef);

  if (snap.empty) {
    pendingListEl.innerHTML = `<p class="muted">No pending submissions 🎉</p>`;
    return;
  }

  pendingListEl.innerHTML = "";
  snap.forEach((d) => {
    const s = d.data() || {};
    const div = document.createElement("div");
    div.className = "choice";
    div.style.marginBottom = "10px";
    div.innerHTML = `
      <div class="choice-emoji">⏳</div>
      <div class="choice-label">
        <strong>${s.studentName || s.studentId || "Student"}</strong><br/>
        ${s.minutes || "?"} minutes • ${s.readingDate || "—"}<br/>
        <span class="muted">Status: pending</span>
      </div>
    `;
    pendingListEl.appendChild(div);
  });
}

async function refreshAll() {
  setNote("Loading your group…", true);

  const groups = getGroups(staffProfile);
  if (!groups.length) {
    setNote("Your staff profile is missing grade/homeroom assignment. Add gradeId + homeroomId to admins/{yourUid}.", true);
    return;
  }

  groupLabelEl.textContent = groups.map(g => g.homeroomId).join(", ");
  gradeLabelEl.textContent = groups.map(g => g.gradeId).join(", ");

  myStudents = await loadRosterForGroups(groups);
  renderTargetSelect();
  renderStudentList();
  await loadPendingForMyGroup();

  setNote("✅ Ready!", true);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const minutes = parseInt(minutesEl.value, 10);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
    setMsg("Minutes must be between 1 and 600.");
    return;
  }

  const readingDate = readingDateEl.value;
  if (!readingDate) {
    setMsg("Pick a reading date.");
    return;
  }

  const target = targetSel.value;
  const note = (noteEl.value || "").trim();

  // Decide who this is for
  let studentId, studentName, grade, teacherId, teacherName;

  teacherId = currentUid;
  teacherName = staffProfile?.displayName || auth.currentUser?.email || "Staff";

  if (target === "self") {
    // staff submitting for themselves
    studentId = `staff_${currentUid}`;
    studentName = staffProfile?.displayName || "Staff";
    grade = staffProfile?.gradeId || "Staff";
  } else {
    const s = myStudents.find(x => x.studentId === target);
    if (!s) {
      setMsg("That student isn’t in your list.");
      return;
    }
    studentId = s.studentId;
    studentName = s.displayName;
    grade = s.gradeId;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";

  try {
    // Same structure as student submit.js :contentReference[oaicite:7]{index=7}
    await addDoc(collection(db, "minuteSubmissions"), {
      studentUid: null,              // staff-submitted (students don’t have uid here)
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
      decisionNote: null
    });

    minutesEl.value = "";
    noteEl.value = "";
    readingDateEl.value = todayLocalISO();

    setMsg("✅ Submitted! (Pending approval)", true);
    await loadPendingForMyGroup();

  } catch (err) {
    console.error(err);
    setMsg("Oops! Something didn’t send. Try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "✅ Submit Minutes";
  }
});

refreshBtn?.addEventListener("click", refreshAll);

signOutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/readathon-world/index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/readathon-world/index.html";
    return;
  }

  currentUid = user.uid;

  staffProfile = await requireStaff(user);

  staffNameEl.textContent =
    staffProfile.displayName ||
    auth.currentUser?.email ||
    "Staff";

  await refreshAll();
});
