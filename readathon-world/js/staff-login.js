// js/staff-login.js
// Username + PIN -> verify against users/{teacherId} -> set session teacherId -> go staff-home

import { auth, db } from "/readathon-world/js/firebase.js";

import {
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ==============================
   UI
============================== */

const usernameEl = document.getElementById("username");
const pinEl = document.getElementById("pin");
const loginBtn = document.getElementById("loginBtn");
const backBtn = document.getElementById("backBtn");
const msgEl = document.getElementById("msg");

function setMsg(text, ok = false) {
  msgEl.textContent = text || "";
  msgEl.style.opacity = text ? "1" : "0";
  msgEl.classList.toggle("err", !ok && !!text);
}

async function ensureAnonAuth() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
}

function normalize(s) {
  return (s || "").trim().toLowerCase();
}

function normalizePin(s) {
  return (s || "").trim();
}

function readPinFromProfile(profile) {
  // support a few possible field names so you can pick what you like
  return (
    profile?.pin ??
    profile?.staffPin ??
    profile?.pinCode ??
    profile?.code ??
    ""
  );
}

async function verifyStaffLogin(username, pin) {
  const teacherId = normalize(username);
  const ref = doc(db, "users", teacherId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, reason: "username" };

  const profile = snap.data();
  const storedPin = normalizePin(String(readPinFromProfile(profile)));

  // Compare as strings (so "0123" works)
  if (!storedPin || normalizePin(String(pin)) !== storedPin) {
    return { ok: false, reason: "pin" };
  }

  return { ok: true, teacherId, profile };
}

/* ==============================
   Handlers
============================== */

async function onLogin() {
  setMsg("");

  const username = normalize(usernameEl.value);
  const pin = normalizePin(pinEl.value);

  if (!username) return setMsg("Please enter your username.");
  if (!pin) return setMsg("Please enter your PIN.");

  loginBtn.disabled = true;
  loginBtn.textContent = "Checking…";

  try {
    await ensureAnonAuth();

    const result = await verifyStaffLogin(username, pin);

    if (!result.ok) {
      if (result.reason === "username") setMsg("Username not found.");
      else setMsg("Incorrect PIN.");
      loginBtn.disabled = false;
      loginBtn.textContent = "Log In";
      return;
    }

    // Success!
    sessionStorage.setItem("teacherId", result.teacherId);
    window.location.href = "/readathon-world/staff-home.html";
  } catch (e) {
    console.error(e);
    setMsg("Login error. Check console for details.");
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
