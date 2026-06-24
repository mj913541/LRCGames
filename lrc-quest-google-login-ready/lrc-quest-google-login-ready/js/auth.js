import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const button = document.getElementById("googleSignInButton");
const message = document.getElementById("loginMessage");

onAuthStateChanged(auth, user => {
  if (user) {
    window.location.href = "dashboard.html";
  }
});

button.addEventListener("click", async () => {
  message.textContent = "Opening Google sign in...";
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    message.textContent = "Sign in did not work yet. Check Firebase setup.";
  }
});
