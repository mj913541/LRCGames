import { auth, db } from "../firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const el = (id) => document.getElementById(id);

const whoBox = el("whoBox");
const studentNameEl = el("studentName");
const teacherNameEl = el("teacherName");
const gradeEl = el("grade");

const form = el("minuteForm");
const minutesEl = el("minutes");
const readingDateEl = el("readingDate");
const noteEl = el("note");
const msgEl = el("msg");
const submitBtn = el("submitBtn");

function setMsg(text, ok = false) {
  msgEl.textContent = text || "";
  msgEl.style.opacity = "1";
  msgEl.style.color = ok ? "green" : "crimson";
}

function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Set default date = today
readingDateEl.value = todayLocalISO();

let sessionData = null;
let currentUid = null;

async function loadSession(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Student must be signed in anonymously already (from PIN login flow)
    window.location.href = "/index.html";
    return;
  }

  currentUid = user.uid;

  sessionData = await loadSession(currentUid);
  if (!sessionData || !sessionData.studentId) {
    setMsg("Hmm… I can’t find your login pass. Please go back and sign in again.");
    submitBtn.disabled = true;
    return;
  }

  // Show who they are (kid-friendly)
  whoBox.hidden = false;
  studentNameEl.textContent = sessionData.studentName || "Student";
  teacherNameEl.textContent = sessionData.teacherName || sessionData.teacherId || "Teacher";
  gradeEl.textContent = sessionData.grade || "?";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  if (!currentUid || !sessionData?.studentId) {
    setMsg("Please sign in again before submitting.");
    return;
  }

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

  const note = (noteEl.value || "").trim();

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";

  try {
    await addDoc(collection(db, "minuteSubmissions"), {
  studentUid: currentUid,
  studentId: sessionData.studentId,
  studentName: sessionData.studentName || null,

  grade: sessionData.grade,
  teacherId: sessionData.teacherId || null,
  teacherName: sessionData.teacherName || null,

  minutes,
  readingDate,
  ...(note ? { note } : {}),

  status: "pending",
  createdAt: serverTimestamp(),

  reviewedAt: null,
  reviewedBy: null,
  decisionNote: null
});
console.log("Submitted minutes to minuteSubmissions ✅");


    minutesEl.value = "";
    noteEl.value = "";
    readingDateEl.value = todayLocalISO();

    setMsg("✅ Sent! Mrs. A will approve it soon.", true);
  } catch (err) {
    console.error(err);
    setMsg("Oops! Something didn’t send. Try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "✅ Send to Mrs. A";
  }
});
