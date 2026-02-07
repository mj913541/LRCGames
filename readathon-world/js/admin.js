import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const googleBtn = document.getElementById("googleBtn");
const signOutBtn = document.getElementById("signOutBtn");
const errEl = document.getElementById("err");

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");

function setError(msg) {
  if (errEl) errEl.textContent = msg || "";
}

if (!googleBtn) {
  console.error("❌ Missing #googleBtn in admin.html");
} else {
  googleBtn.addEventListener("click", async () => {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      setError(e?.message || "Google sign-in failed.");
    }
  });
}

if (!signOutBtn) {
  console.error("❌ Missing #signOutBtn in admin.html");
} else {
  signOutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

onAuthStateChanged(auth, (user) => {
  const loggedIn = !!user;

  if (loginBox) loginBox.classList.toggle("hidden", loggedIn);
  if (adminBox) adminBox.classList.toggle("hidden", !loggedIn);
  if (signOutBtn) signOutBtn.style.display = loggedIn ? "inline-flex" : "none";

  if (loggedIn) setError("");
});
