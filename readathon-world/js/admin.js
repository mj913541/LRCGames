import { auth, db } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// --- Grab elements safely ---
const el = (id) => document.getElementById(id);

const googleBtn = el("googleBtn");
const signOutBtn = el("signOutBtn");
const errEl = el("err");

const loginBox = el("loginBox");
const adminBox = el("adminBox");

const adminStatus = el("adminStatus");
const adminMenu = el("adminMenu");

// Menu links (placeholders)
const menuIds = ["menuUpload", "menuBatch", "menuApprove", "menuStore"];

// --- Helpers ---
function setError(msg) {
  if (errEl) errEl.textContent = msg || "";
}

function show(elem, shouldShow) {
  if (!elem) return;
  elem.classList.toggle("hidden", !shouldShow);
}

function setAdminStatus(html, ok) {
  if (!adminStatus) return;
  adminStatus.innerHTML = ok
    ? `🦁 <strong>Admin verified.</strong> ${html || ""}`
    : `⚠️ <strong>Not authorized.</strong> ${html || ""}`;
}

function log(...args) {
  console.log("[ADMIN]", ...args);
}

// --- Auth actions ---
async function startGoogleRedirect() {
  setError("");
  try {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  } catch (e) {
    setError(e?.message || "Google sign-in failed to start.");
    log("signInWithRedirect error:", e);
  }
}

async function handleRedirectReturn() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      log("Redirect sign-in returned user:", result.user.uid);
    } else {
      log("No redirect result (normal on first load).");
    }
  } catch (e) {
    setError(e?.message || "Google redirect sign-in failed.");
    log("getRedirectResult error:", e);
  }
}

async function doSignOut() {
  try {
    await signOut(auth);
  } catch (e) {
    log("signOut error:", e);
  }
}

// --- Admin check ---
async function verifyAdmin(uid) {
  show(adminMenu, false);
  if (adminStatus) adminStatus.textContent = "Checking admin access…";

  try {
    const ref = doc(db, "admins", uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data() || {};
      setAdminStatus(`Signed in as ${data.email || "admin"}.`, true);
      show(adminMenu, true);
      log("Admin verified:", uid, data.email || "");
    } else {
      // This usually means the doc doesn't exist (but read was allowed).
      setAdminStatus("Your admins/{uid} document is missing in Firestore.", false);
      log("Admin doc missing for uid:", uid);
    }
  } catch (e) {
    const code = e?.code || "";
    if (code.includes("permission-denied")) {
      setAdminStatus("You are signed in, but your UID is not on the admin allowlist.", false);
      log("permission-denied reading admins/", uid, e);
    } else {
      setAdminStatus(`Admin check failed: ${e?.message || "unknown error"}`, false);
      log("Admin check error:", e);
    }
  }
}

// --- Wire up events ---
if (googleBtn) {
  googleBtn.addEventListener("click", startGoogleRedirect);
} else {
  log("Missing #googleBtn");
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", doSignOut);
} else {
  log("Missing #signOutBtn");
}

menuIds.forEach((id) => {
  const a = el(id);
  if (!a) return;
  a.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Coming next step! This is just a placeholder menu.");
  });
});

// --- Listen for auth state ---
onAuthStateChanged(auth, async (user) => {
  log("Auth state changed:", user ? user.uid : "signed out");

  const loggedIn = !!user;

  show(loginBox, !loggedIn);
  show(adminBox, loggedIn);

  if (signOutBtn) signOutBtn.style.display = loggedIn ? "inline-flex" : "none";

  if (!loggedIn) {
    show(adminMenu, false);
    if (adminStatus) adminStatus.textContent = "Checking admin access…";
    setError("");
    return;
  }

  // Logged in: check allowlist in Firestore
  await verifyAdmin(user.uid);
});

// --- Init ---
handleRedirectReturn();
