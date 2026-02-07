import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const errEl = document.getElementById("err");

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");

function setError(msg) {
  errEl.textContent = msg || "";
}

signInBtn.addEventListener("click", async () => {
  setError("");
  const email = emailEl.value.trim();
  const password = passEl.value;

  if (!email || !password) return setError("Please enter email and password.");

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    setError(e?.message || "Sign-in failed.");
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
