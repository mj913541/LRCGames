// ==========================================
// File: /lrcQuestMain/scripts/login/login.js
// ==========================================

// ✅ Use the shared Firebase instances from your core file
// Path: login.js is in /scripts/login/, core is in /scripts/
import { auth, db } from "../lrcQuestCore.js";

// ✅ Anonymous student sign-in (students do NOT use Google)
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Optional redirect support (kept for later roster step)
const urlParams = new URLSearchParams(window.location.search);
const DESTINATION_PAGE = urlParams.get("redirect") || "questHub.html";

// UI
const stepGrade = document.getElementById("stepGrade");
const gradeGrid = document.getElementById("gradeGrid");
const staffLink = document.getElementById("staffLink");

const stepHomeroom = document.getElementById("stepHomeroom");
const backBtn = document.getElementById("backBtn");
const homeroomTitle = document.getElementById("homeroomTitle");
const homeroomList = document.getElementById("homeroomList");

const statusEl = document.getElementById("status");

function setStatus(msg, ok = true) {
  statusEl.textContent = msg || "";
  statusEl.className = "mt-4 text-sm " + (ok ? "text-gray-600" : "text-red-600");
}

function displayGrade(g) {
  const gs = String(g);
  return gs === "0" ? "EC-K" : `Grade ${gs}`;
}

function showHomerooms() {
  stepGrade.classList.add("hidden");
  stepHomeroom.classList.remove("hidden");
}

function showGradePicker() {
  stepHomeroom.classList.add("hidden");
  stepGrade.classList.remove("hidden");
  homeroomList.innerHTML = "";
  homeroomTitle.textContent = "";
}

// ----------------------------------------------------------
// Auth: ensure anonymous student auth exists before reads
// (Your Firestore rules require request.auth != null for /schools)
// ----------------------------------------------------------
async function ensureAnonAuth() {
  if (auth.currentUser) return;
  await signInAnonymously(auth);
}

// Uses your index: active + grade + orderBy(sort)
async function loadHomeroomsForGrade(gradeNumber) {
  const homeroomsRef = collection(db, "schools", "main", "homerooms");
  const q = query(
    homeroomsRef,
    where("active", "==", true),
    where("grade", "==", Number(gradeNumber)),
    orderBy("sort")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderHomerooms(grade, rooms) {
  homeroomList.innerHTML = "";
  homeroomTitle.textContent = `${displayGrade(grade)}: Choose your class`;

  if (!rooms.length) {
    const p = document.createElement("p");
    p.className = "text-sm text-red-600";
    p.textContent = "No homerooms found for this grade yet.";
    homeroomList.appendChild(p);
    return;
  }

  rooms.forEach((room) => {
    const btn = document.createElement("button");

    // Card-style grid item
    btn.className =
      "p-4 rounded-xl bg-green-600 hover:bg-green-700 transition text-white flex flex-col items-center shadow-md hover:shadow-xl";

    const label = room.label || room.id;
    const photo = (room.photoUrl && String(room.photoUrl).trim()) ? String(room.photoUrl).trim() : "";

    btn.innerHTML = `
      <div class="flex flex-col items-center gap-2">
        ${
          photo
            ? `<img src="${photo}"
                    alt="${label}"
                    class="w-20 h-20 rounded-full object-cover border-2 border-white"
                    onerror="this.style.display='none'" />`
            : `<div class="w-20 h-20 rounded-full bg-green-50 border-2 border-white flex items-center justify-center text-green-800 font-bold">
                 ${String(label).trim().charAt(0)}
               </div>`
        }
        <span class="text-center font-semibold leading-tight">${label}</span>
      </div>
    `;

    btn.addEventListener("click", () => {
      // Save selections for the next step (roster + PIN)
      sessionStorage.setItem("lrc_grade", String(grade));
      sessionStorage.setItem("lrc_gradeLabel", displayGrade(grade));
      sessionStorage.setItem("lrc_homeroomId", String(room.id));
      sessionStorage.setItem("lrc_homeroomLabel", String(label));

      setStatus(`Selected: ${label}. Next step: student roster + PIN.`, true);

      // Later:
      // window.location.href = `roster.html?redirect=${encodeURIComponent(DESTINATION_PAGE)}`;
      void DESTINATION_PAGE;
    });

    homeroomList.appendChild(btn);
  });
}

function renderGradeButtons() {
  const grades = [
    { id: "0", domId: "gradeECK", aria: "EC-K" },
    { id: "1", domId: "grade1", aria: "Grade 1" },
    { id: "2", domId: "grade2", aria: "Grade 2" },
    { id: "3", domId: "grade3", aria: "Grade 3" },
    { id: "4", domId: "grade4", aria: "Grade 4" },
    { id: "5", domId: "grade5", aria: "Grade 5" },
  ];

  gradeGrid.innerHTML = "";

  grades.forEach(g => {
    const a = document.createElement("a");
    a.href = "#";
    a.id = g.domId;
    a.className = "grade-icon";
    a.setAttribute("data-grade", g.id);
    a.setAttribute("aria-label", g.aria);

    // No text overlay (icons already show the grade)
    a.innerHTML = "";

    a.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await ensureAnonAuth();
        setStatus("Loading homerooms...");

        const rooms = await loadHomeroomsForGrade(g.id);
        showHomerooms();
        renderHomerooms(g.id, rooms);

        setStatus("Tap your classroom.", true);
      } catch (err) {
        console.error(err);
        setStatus("Couldn’t load homerooms. (Check Firestore rules/index.)", false);
      }
    });

    gradeGrid.appendChild(a);
  });
}

staffLink?.addEventListener("click", async () => {
  try {
    // Staff page can still rely on auth existing (anonymous ok for now)
    await ensureAnonAuth();
    setStatus("Staff login coming next (PIN + dashboard route).", true);
  } catch (err) {
    console.error(err);
    setStatus("Couldn’t start staff login.", false);
  }
});

backBtn?.addEventListener("click", () => {
  showGradePicker();
  setStatus("");
});

// Init
(async function init() {
  setStatus("Ready. Choose your grade.");
  try { await ensureAnonAuth(); } catch {}
  renderGradeButtons();
})();

// Admin + Staff icons (paths depend on where you put the pages)
const adminIcon = document.getElementById("adminIcon");
const staffIcon = document.getElementById("staffIcon");

// ✅ If your admin login page is at /lrcQuestMain/admin/adminLogin.html keep this.
// If you moved it to site root (/adminLogin.html), change it accordingly.
adminIcon?.addEventListener("click", () => {
  window.location.href = "/lrcQuestMain/admin/adminLogin.html";
});

staffIcon?.addEventListener("click", () => {
  // Placeholder for staff PIN login
  window.location.href = "/lrcQuestMain/staff/staffLogin.html";
});
