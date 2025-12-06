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

// -------------------------------------------------------------
// Require Login on Any Page
// -------------------------------------------------------------

export function requireLogin(callback) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      // Not logged in → send to login page (relative path for GitHub Pages)
      window.location.href = "login.html";
      return;
    }
    callback(user);
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
  window.location.href = "login.html";
}
