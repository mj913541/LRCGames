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

const googleBtn = document.getElementById("googleBtn");
const signOutBtn = document.getElementById("signOutBtn");
const errEl = document.getElementById("err");

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");

const adminStatus = document.getElementById("adminStatus");
const adminMenu = document.getElementById("adminMenu");

function setError(msg) {
  if (errEl) errEl.textContent = msg || "";
}

function setAdminStatus(msg, ok = false) {
  if (!adminStatus) return;
  adminStatus.innerHTML = ok
    ? `🦁 <strong>Admin verified.</strong> ${msg || ""}`
    : `⚠️ <strong>Not authorized.</strong> ${msg || ""}`;
}

function showAdminMenu(show) {
  if (!adminMenu) return;
  adminMenu.classList.toggle("hidden", !show);
}

async function checkRedirectResult() {
  try {
    await getRedirectResult(auth);
  } catch (e) {
    setError(e?.message || "Google sign-in redirect failed.");
  }
}

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

async function verifyAdmin(uid) {
  // This reads admins/{uid}. Your rules allow it ONLY if you are on the allowlist.
  try {
    const ref = doc(db, "admins", uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      setAdminStatus(`Signed in as ${data.email || "admin"}.`, true);
      showAdminMenu(true);
    } else {
      // Rare: doc missing but read succeeded
      setAdminStatus("Your admin badge doc is missing in Firestore.", false);
      showAdminMenu(false);
    }
  } catch (e) {
    // Most common: permission-denied when user is not in admins/{uid}
    const code = e?.code || "";
    if (code.includes("permission-denied")) {
      setAdminStatus("Your account is signed in, but not on the admin allowlist.", false);
    } else {
      setAdminStatus(`Admin check failed: ${e?.message || "unknown error"}`, false);
    }
    showAdminMenu(false);
  }
}

onAuthStateChanged(auth, async (user) => {
  const loggedIn = !!user;

  if (loginBox) loginBox.classList.toggle("hidden", loggedIn);
  if (adminBox) adminBox.classList.toggle("hidden", !loggedIn);
  if (signOutBtn) signOutBtn.style.display = loggedIn ? "inline-flex" : "none";

  if (!loggedIn) {
    setError("");
    showAdminMenu(false);
    if (adminStatus) adminStatus.textContent = "Checking admin access…";
    return;
  }

  // Logged in: verify allowlist
  if (adminStatus) adminStatus.textContent = "Checking admin access…";
  showAdminMenu(false);
  await verifyAdmin(user.uid);
});

checkRedirectResult();

// Placeholder menu clicks (so they don’t navigate yet)
["menuUpload", "menuBatch", "menuApprove", "menuStore"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Coming next step! This is just the menu placeholder.");
    });
  }
});
