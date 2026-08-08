import { auth } from "./firebase.js";

import {
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const googleSignInButton = document.getElementById("googleSignInButton");
const loginMessage = document.getElementById("loginMessage");

const provider = new GoogleAuthProvider();

const PLANNER_EMAILS = new Set([
    "malbrecht@sd308.org",
    "malbrecht3317@gmail.com"
]);

function sendUserToCorrectPage(user) {
    const email = user.email?.toLowerCase();

    if (PLANNER_EMAILS.has(email)) {
        window.location.href = "./planner-dashboard/dashboard.html";
        return;
    }

    window.location.href = "./quest-hub.html";
}

googleSignInButton?.addEventListener("click", async () => {
    loginMessage.textContent = "Signing in...";

    try {
        const result = await signInWithPopup(auth, provider);
        sendUserToCorrectPage(result.user);
    } catch (error) {
        console.error("Google sign-in failed:", error);
        loginMessage.textContent = "Sign-in failed. Please try again.";
    }
});

onAuthStateChanged(auth, user => {
    if (!user) {
        return;
    }

    sendUserToCorrectPage(user);
});