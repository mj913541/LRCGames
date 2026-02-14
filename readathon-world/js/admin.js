import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const el = (id) => document.getElementById(id);

const emailEl = el("email");
const passEl = el("password");
const signInBtn = el("signInBtn");
const signOutBtn = el("signOutBtn");
const errEl = el("err");

const loginBox = el("loginBox");
const adminBox = el("adminBox");
const adminStatus = el("adminStatus");
const adminMenu = el("adminMenu");

const menuIds = ["menuUpload", "menuBatch", "menuApprove", "menuStore"];

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
    } else {
      setAdminStatus("Your admins/{uid} document is missing in Firestore.", false);
      show(adminMenu, false);
    }
  } catch (e) {
    const code = e?.code || "";
    if (code.includes("permission-denied")) {
      setAdminStatus("Signed in, but not on the admin allowlist.", false);
    } else {
      setAdminStatus(`Admin check failed: ${e?.message || "unknown error"}`, false);
    }
    show(adminMenu, false);
  }
}

if (signInBtn) {
  signInBtn.addEventListener("click", async () => {
    setError("");

    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";

    if (!email || !password) {
      return setError("Please enter your email and password.");
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setError(e?.message || "Sign-in failed.");
    }
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

onAuthStateChanged(auth, async (user) => {
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

  await verifyAdmin(user.uid);
});
