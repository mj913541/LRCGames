import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const button = document.getElementById("googleSignInButton");
const message = document.getElementById("loginMessage");

const usersRef = collection(
  db,
  "lrcquest",
  "oswego308_longbeach",
  "users"
);

function dashboardForRole(role) {
  if (role === "admin") return "dashboards/admin.html";
  if (role === "staff") return "dashboards/staff.html";
  if (role === "k2") return "dashboards/k2.html";
  if (role === "35") return "dashboards/35.html";
  return "dashboard.html";
}

async function findUserProfile(email) {
  const q = query(usersRef, where("email", "==", email));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];

  return {
    id: docSnap.id,
    ...docSnap.data()
  };
}

async function sendUserToDashboard(user) {
  message.textContent = "Checking your LRC Quest account...";

  const profile = await findUserProfile(user.email);

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