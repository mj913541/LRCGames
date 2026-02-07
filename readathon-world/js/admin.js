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

googleBtn.addEventListener("click", async () => {
  setError("");
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    setError(e?.message || "Google sign-in failed.");
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  const loggedIn = !!user;
  loginBox.classList.toggle("hidden", loggedIn);
  adminBox.classList.toggle("hidden", !loggedIn);
  signOutBtn.style.display = loggedIn ? "inline-flex" : "none";
  if (loggedIn) setError("");
});
