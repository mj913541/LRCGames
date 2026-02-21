import { auth, db } from "/readathon-world/js/firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ===============================
   DOM
================================= */

const listEl = document.getElementById("list");
const msgEl = document.getElementById("msg");

function setMsg(text, ok = false) {
  if (!msgEl) return;
  msgEl.textContent = text || "";
  msgEl.style.color = ok ? "green" : "crimson";
}

/* ===============================
   AUTH CHECK (Admin Only)
================================= */

async function requireAdmin(user) {
  const adminRef = doc(db, "admins", user.uid);
  const snap = await getDoc(adminRef);

  if (!snap.exists()) {
    alert("Admin access required.");
    window.location.href = "/readathon-world/index.html";
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/readathon-world/index.html";
    return;
  }

  await requireAdmin(user);
  loadPending();
});

/* ===============================
   LOAD PENDING SUBMISSIONS
================================= */

async function loadPending() {
  setMsg("");
  if (!listEl) return;

  listEl.innerHTML = "<p>Loading...</p>";

  try {
    const qRef = query(
      collection(db, "minuteSubmissions"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(qRef);

    if (snap.empty) {
      listEl.innerHTML = "<p>No pending submissions 🎉</p>";
      return;
    }

    listEl.innerHTML = "";

    snap.forEach(docSnap => {
      renderSubmission(docSnap.id, docSnap.data());
    });

  } catch (err) {
    console.error(err);
    setMsg(err.message || "Error loading submissions.");
    listEl.innerHTML = "";
  }
}

/* ===============================
   RENDER CARD
================================= */

function renderSubmission(id, data) {

  const card = document.createElement("div");
  card.className = "submission-card";

  const studentName = data.studentName || data.studentId || "Student";
  const teacherName = data.teacherName || data.teacherId || "Teacher";

  card.innerHTML = `
    <h3>${studentName}</h3>
    <p><strong>Teacher:</strong> ${teacherName}</p>
    <p><strong>Grade:</strong> ${data.grade}</p>
    <p><strong>Minutes:</strong> ${data.minutes}</p>
    <p><strong>Date:</strong> ${data.readingDate || "—"}</p>
    ${data.note ? `<p><strong>Note:</strong> ${data.note}</p>` : ""}
    <div class="btn-row">
      <button class="approve-btn">Approve 💎</button>
      <button class="reject-btn">Reject</button>
    </div>
  `;

  card.querySelector(".approve-btn")
    .addEventListener("click", () => approveSubmission(id));

  card.querySelector(".reject-btn")
    .addEventListener("click", () => rejectSubmission(id));

  listEl.appendChild(card);
}

/* ===============================
   APPROVE (TRANSACTION SAFE)
================================= */

async function approveSubmission(submissionId) {

  const submissionRef = doc(db, "minuteSubmissions", submissionId);

  try {

    await runTransaction(db, async (transaction) => {

      const submissionSnap = await transaction.get(submissionRef);
      if (!submissionSnap.exists()) {
        throw new Error("Submission not found.");
      }

      const submission = submissionSnap.data();

      // Prevent double approval
      if (submission.status !== "pending") {
        throw new Error("Already processed.");
      }

      const studentId = submission.studentId;
      const minutes = submission.minutes;

      // Read conversion rule
      const configRef = doc(db, "config", "rules");
      const configSnap = await transaction.get(configRef);

      const minutesPerRuby =
        configSnap.exists() && configSnap.data().minutesPerRuby
          ? configSnap.data().minutesPerRuby
          : 1;

      const rubiesToAdd = Math.floor(minutes / minutesPerRuby);

      const studentRef = doc(db, "students", studentId);
      const studentSnap = await transaction.get(studentRef);

      const existing = studentSnap.exists()
        ? studentSnap.data()
        : {};

      const newTotalMinutes =
        (existing.totalApprovedMinutes || 0) + minutes;

      const newRubiesBalance =
        (existing.rubiesBalance || 0) + rubiesToAdd;

      const newLifetimeRubiesEarned =
        (existing.lifetimeRubiesEarned || 0) + rubiesToAdd;

      // Update student totals
      transaction.set(studentRef, {
        totalApprovedMinutes: newTotalMinutes,
        rubiesBalance: newRubiesBalance,
        lifetimeRubiesEarned: newLifetimeRubiesEarned
      }, { merge: true });

      // Mark submission approved
      transaction.update(submissionRef, {
        status: "approved",
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser.uid
      });

    });

    setMsg("Approved successfully 💎", true);
    loadPending();

  } catch (err) {
    console.error(err);
    setMsg(err.message || "Approval failed.");
  }
}

/* ===============================
   REJECT
================================= */

async function rejectSubmission(submissionId) {

  try {
    await updateDoc(doc(db, "minuteSubmissions", submissionId), {
      status: "rejected",
      reviewedAt: serverTimestamp(),
      reviewedBy: auth.currentUser.uid
    });

    setMsg("Submission rejected.");
    loadPending();

  } catch (err) {
    console.error(err);
    setMsg("Rejection failed.");
  }
}
