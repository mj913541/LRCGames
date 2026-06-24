import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, user => {
  if (!user) {
    const isInsideDestinyFolder = window.location.pathname.includes("/destiny/");
    window.location.href = isInsideDestinyFolder ? "../index.html" : "index.html";
    return;
  }

  window.lrcUser = user;

  const welcomeLine = document.getElementById("welcomeLine");
  if (welcomeLine) {
    const name = user.displayName || user.email || "reader";
    welcomeLine.textContent = `Signed in as ${name}`;
  }
});

const signOutButton = document.getElementById("signOutButton");
if (signOutButton) {
  signOutButton.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}
