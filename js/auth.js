import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const button = document.getElementById("googleSignInButton");
const message = document.getElementById("loginMessage");

function dashboardForRole(role) {
  if (role === "admin") return "html/dashboards/admin.html";
  if (role === "staff") return "html/dashboards/staff.html";
  if (role === "k2") return "html/dashboards/k2.html";
  if (role === "35") return "html/dashboards/35.html";
  return "dashboard.html";
}

async function getUserProfile(uid) {
  const userRef = doc(
    db,
    "lrcquest",
    "oswego308_longbeach",
    "users",
    uid
  );

  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  return {
    id: userSnap.id,
    ...userSnap.data()
  };
}

async function sendUserToDashboard(user) {
  message.textContent = "Checking your LRC Quest account...";

  const profile = await getUserProfile(user.uid);

  if (!profile) {
    message.textContent = "Your Google account is not set up in LRC Quest yet.";
    return;
  }

  if (profile.active !== true) {
    message.textContent = "Your LRC Quest account is not active yet.";
    return;
  }

  localStorage.setItem("lrcQuestUserProfile", JSON.stringify(profile));

  window.location.href = dashboardForRole(profile.role);
}

onAuthStateChanged(auth, user => {
  if (user) {
    sendUserToDashboard(user).catch(error => {
      console.error(error);
      message.textContent = "Login worked, but LRC Quest could not find your dashboard yet.";
    });
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