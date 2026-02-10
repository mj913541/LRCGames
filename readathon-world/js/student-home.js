import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const el = (id) => document.getElementById(id);

const signOutBtn = el("signOutBtn");
const noteEl = el("statusNote");

function showNote(msg) {
  if (!noteEl) return;
  noteEl.style.display = "block";
  noteEl.textContent = msg;
}

function setText(id, value) {
  const node = el(id);
  if (node) node.textContent = value;
}

async function loadSession(uid) {
  // Your submit page relies on this existing
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

async function loadPendingMinutes(uid) {
  // Student can read their own submissions by your rules
  const q = query(
    collection(db, "minuteSubmissions"),
    where("studentUid", "==", uid),
    where("status", "==", "pending")
  );

  const snap = await getDocs(q);
  let total = 0;
  snap.forEach((d) => {
    const m = Number(d.data().minutes || 0);
    if (Number.isFinite(m)) total += m;
  });
  return total;
}

/**
 * SAFE totals strategy:
 * 1) Try publicStudents/{studentId} first (recommended long-term)
 * 2) If that doesn't exist or isn't readable, try students/{studentId}
 *    (may fail if your rules keep students admin-only, which is ok).
 */
async function loadTotals(studentId) {
  // Preferred: safe public totals doc
  try {
    const pubSnap = await getDoc(doc(db, "publicStudents", studentId));
    if (pubSnap.exists()) return pubSnap.data();
  } catch (e) {
    // ignore; try fallback
  }

  // Fallback: direct students doc (may be blocked by rules)
  const studentSnap = await getDoc(doc(db, "students", studentId));
  return studentSnap.exists() ? studentSnap.data() : null;
}

function wireAvatar() {
  const avatar = el("avatar");
  if (!avatar) return;

  avatar.addEventListener("click", () => {
    avatar.style.transform = "translateX(-50%) scale(1.15)";
    setTimeout(() => {
      avatar.style.transform = "translateX(-50%) scale(1)";
    }, 180);
  });
}

signOutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

wireAvatar();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./student-login.html";
    return;
  }

  // 1) Verified session
  const session = await loadSession(user.uid);
  if (!session?.studentId) {
    showNote("Hmm… I can’t find your login pass. Please sign in again.");
    window.location.href = "./student-login.html";
    return;
  }

  setText("studentName", session.studentName || "Reader");
  setText("teacherName", session.teacherName || session.teacherId || "Homeroom");
  setText("grade", session.grade || "?");

  // 2) Pending minutes (always should work)
  try {
    const pending = await loadPendingMinutes(user.uid);
    setText("pendingMinutes", String(pending));
  } catch (e) {
    console.warn("Pending minutes failed:", e);
    setText("pendingMinutes", "—");
  }

  // 3) Approved minutes + rubies (depends on totals doc visibility)
  try {
    const totals = await loadTotals(session.studentId);

    const approved = Number(totals?.totalApprovedMinutes ?? 0);
    const rubies = Number(totals?.rubiesBalance ?? 0);

    setText("approvedMinutes", String(approved));
    setText("rubies", String(rubies));

    // If we had to fall back / or no totals exist yet:
    if (!totals) {
      showNote("Approved minutes & rubies will appear after Mrs. A approves and converts minutes.");
    }
  } catch (e) {
    console.warn("Totals read blocked or missing:", e);
    setText("approvedMinutes", "—");
    setText("rubies", "—");
    showNote("✅ Pending minutes work. Approved minutes & rubies will show after we enable safe totals access.");
  }
});
