// js/staff-login.js
// Username + PIN -> verify via verifyStaffPinHttp -> set session teacherId -> go staff-home

import { auth } from "/readathon-world/js/firebase.js";

import {
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/* ==============================
   UI
============================== */

const usernameEl = document.getElementById("username");
const pinEl = document.getElementById("pin");
const loginBtn = document.getElementById("loginBtn");
const backBtn = document.getElementById("backBtn");
const msgEl = document.getElementById("msg");

function setMsg(text, ok = false) {
  if (!msgEl) return;
  msgEl.textContent = text || "";
  msgEl.style.opacity = text ? "1" : "0";
  msgEl.classList.toggle("err", !ok && !!text);
}

function normalize(s) {
  return (s || "").trim().toLowerCase();
}

function normalizePin(s) {
  return (s || "").trim();
}

/* ==============================
   Auth (match student-login.js)
============================== */

async function ensureAnonAuth() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub();
        resolve(u);
      }
    });
  });

  await user.getIdToken(true);
  return user;
}

/* ==============================
   Verify Staff PIN (Cloud Function)
============================== */

async function verifyStaffPinHttp({ teacherId, pin, token }) {
  const resp = await fetch(
    "https://us-central1-lrcquest-3039e.cloudfunctions.net/verifyStaffPinHttp",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ teacherId, pin })
    }
  );

  // Try to parse JSON either way (some errors still return JSON)
  const data = await resp.json().catch(() => ({}));

  // If function returns non-2xx, still surface its error message if present
  if (!resp.ok) {
    return { ok: false, error: data?.error || `HTTP ${resp.status}` };
  }

  return data;
}

/* ==============================
   Handlers
============================== */

async function onLogin() {
  setMsg("");

  const teacherId = normalize(usernameEl?.value);
  const pin = normalizePin(pinEl?.value);

  if (!teacherId) return setMsg("Please enter your username.");
  if (!pin) return setMsg("Please enter your PIN.");

  loginBtn.disabled = true;
  loginBtn.textContent = "Checking…";

  try {
    const user = await ensureAnonAuth();
    const token = await user.getIdToken(true);

    const res = await verifyStaffPinHttp({ teacherId, pin, token });

    if (res?.ok) {
      // Success!
      sessionStorage.setItem("teacherId", teacherId);

      // Optional (only if your function returns profile fields)
      if (res.profile?.displayName) {
        sessionStorage.setItem("teacherDisplayName", res.profile.displayName);
      }

      window.location.href = "/readathon-world/staff-home.html";
      return;
    }

    setMsg(res?.error || "Incorrect username or PIN.");
  } catch (e) {
    console.error("Staff login error:", e);
    setMsg("Login error. Check console for details.");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Log In";
  }
}

function onBack() {
  window.location.href = "/readathon-world/student-login.html";
}

/* ==============================
   Init
============================== */

loginBtn?.addEventListener("click", onLogin);
backBtn?.addEventListener("click", onBack);

pinEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onLogin();
});

usernameEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") pinEl?.focus();
});

// nice default
setTimeout(() => usernameEl?.focus(), 50);
