import { auth } from "./firebase.js";

import {
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const googleSignInButton = document.getElementById("googleSignInButton");
const loginMessage = document.getElementById("loginMessage");

const PLANNER_EMAILS = new Set([
    "malbrecht@sd308.org",
    "malbrecht3317@gmail.com"
]);

const provider = new GoogleAuthProvider();

// =====================================================
// CHOOSE WHERE THE USER GOES
// =====================================================

function sendUserToCorrectPage(user) {
    const email = user.email?.toLowerCase();

    if (PLANNER_EMAILS.has(email)) {
        window.location.href = "./planner-dashboard/dashboard.html";
        return;
    }

    window.location.href = "./questHub.html";
}

// =====================================================
// GOOGLE SIGN IN BUTTON
// =====================================================

googleSignInButton?.addEventListener("click", async () => {
    loginMessage.textContent = "Signing in...";

    try {
        const result = await signInWithPopup(auth, provider);

        loginMessage.textContent = "Signed in!";

        sendUserToCorrectPage(result.user);
    } catch (error) {
        console.error("Google sign-in failed:", error);

        loginMessage.textContent =
            "Sign-in failed. Please try again.";
    }
});

// =====================================================
// ALREADY SIGNED IN
// =====================================================

onAuthStateChanged(auth, user => {
    if (!user) {
        return;
    }

    sendUserToCorrectPage(user);
});