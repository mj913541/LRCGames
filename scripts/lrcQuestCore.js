// -------------------------------------------------------------
// LRC Quest Core - Shared Logic for All Pages
// -------------------------------------------------------------

// Firebase imports (modular v12)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// -------------------------------------------------------------
// Firebase Configuration (Your actual config)
// -------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyDTKYFcm26i0LsrLo9UjtLnZpNKx4XsWG4",
  authDomain: "lrcquest-3039e.firebaseapp.com",
  projectId: "lrcquest-3039e",
  storageBucket: "lrcquest-3039e.firebasestorage.app",
  messagingSenderId: "72063656342",
  appId: "1:72063656342:web:bc08c6538437f50b53bdb7"
};

// Initialize Firebase ONCE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// -------------------------------------------------------------
// Role constants
// -------------------------------------------------------------

const ADMIN_EMAILS = [
  "malbrecht3317@gmail.com",
  "malbrecht@sd308.org"
];

const STAFF_DOMAIN = "@sd308.org";
const STUDENT_DOMAIN = "@students.sd308.org";

// -------------------------------------------------------------
// Expose Auth Instance
// -------------------------------------------------------------

export function getAuthInstance() {
  return auth;
}

// -------------------------------------------------------------
// Local Storage Helpers
// -------------------------------------------------------------

export function getLocalStudent() {
  try {
    return JSON.parse(localStorage.getItem("lrcQuestStudent")) || null;
  } catch {
    return null;
  }
}

export function setLocalStudent(student) {
  localStorage.setItem("lrcQuestStudent", JSON.stringify(student));
}

export function getLocalProgress() {
  try {
    return JSON.parse(localStorage.getItem("lrcQuestProgress")) || {};
  } catch {
    return {};
  }
}

export function setLocalProgress(progress) {
  localStorage.setItem("lrcQuestProgress", JSON.stringify(progress));
}

export function getLocalTier() {
  return localStorage.getItem("lrcQuestTier") || "free";
}

export function setLocalTier(tier) {
  localStorage.setItem("lrcQuestTier", tier);
}

export function getLocalRole() {
  return localStorage.getItem("lrcQuestRole") || null;
}

function setLocalRole(role) {
  if (!role) {
    localStorage.removeItem("lrcQuestRole");
  } else {
    localStorage.setItem("lrcQuestRole", role);
  }
}

// -------------------------------------------------------------
// Ensure user has a role (admin / staff / student / blocked)
// -------------------------------------------------------------

async function ensureUserRole(user) {
  if (!user || !user.email) return null;

  const email = user.email.toLowerCase();
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  // If they already have a role saved, reuse it
  if (snap.exists() && snap.data()?.role) {
    const existingRole = snap.data().role;
    setLocalRole(existingRole);
    return existingRole;
  }

  let role = "student"; // default fallback

  // --- Admin (explicit list ONLY) ---
  if (ADMIN_EMAILS.includes(email)) {
    role = "admin";
  }
  // --- Staff (district staff) ---
  else if (email.endsWith(STAFF_DOMAIN)) {
    role = "staff";
  }
  // --- Students ---
  else if (email.endsWith(STUDENT_DOMAIN)) {
    role = "student";
  }
  // --- Everyone else is blocked ---
  else {
    role = "blocked";
  }

  await setDoc(
    userRef,
    {
      email,
      role,
      createdAt: Date.now()
    },
    { merge: true }
  );

  setLocalRole(role);
  return role;
}

// Optional helper if you ever need to look up role directly
export async function getCurrentUserRole() {
  const user = auth.currentUser;
  if (!user) return null;
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data().role || null : null;
}

// -------------------------------------------------------------
// Require Login on Any Page (now also ensures allowed domain)
// -------------------------------------------------------------

export function requireLogin(callback) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      // Not logged in → send to login page (relative path for GitHub Pages)
      window.location.href = "login.html";
      return;
    }

    // Check / assign role asynchronously
    (async () => {
      try {
        const role = await ensureUserRole(user);

        if (role === "blocked") {
          alert(
            "Sorry, this account is not allowed to use LRC Quest.\n\n" +
            "Please log in with your SD308 school Google account."
          );
          await logOut();
          return;
        }

        // callback(user) still works; role is a second (optional) argument
        callback(user, role);
      } catch (err) {
        console.error("Error ensuring user role:", err);
        // If something goes wrong, at least let them in as basic user
        callback(user, null);
      }
    })();
  });
}

// -------------------------------------------------------------
// Load or Create Player Document in Firestore
// -------------------------------------------------------------

export async function loadOrCreatePlayer(uid, email, displayName) {
  const ref = doc(db, "players", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const newData = {
      email,
      displayName,
      progress: {},
      subscriptionTier: "free"
    };
    await setDoc(ref, newData);
    return newData;
  }

  const data = snap.data() || {};

  if (!data.progress) data.progress = {};
  if (!data.subscriptionTier) data.subscriptionTier = "free";

  return data;
}

// -------------------------------------------------------------
// Save Progress Update
// -------------------------------------------------------------

export async function saveProgress(updateFn) {
  const user = auth.currentUser;
  const student = getLocalStudent();

  if (!user || !student) {
    console.warn("Not logged in; cannot save progress.");
    return;
  }

  const current = getLocalProgress();
  const updated = updateFn(current);

  // Save locally
  setLocalProgress(updated);

  // Save to Firestore
  const ref = doc(db, "players", user.uid);
  await setDoc(
    ref,
    {
      email: student.email,
      displayName: student.fullName,
      progress: updated
    },
    { merge: true }
  );
}

// -------------------------------------------------------------
// Logout Helper
// -------------------------------------------------------------

export async function logOut() {
  await signOut(auth);
  localStorage.removeItem("lrcQuestStudent");
  localStorage.removeItem("lrcQuestProgress");
  localStorage.removeItem("lrcQuestTier");
  localStorage.removeItem("lrcQuestRole");
  window.location.href = "login.html";
}
