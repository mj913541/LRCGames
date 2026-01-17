// ==========================================
// File: /lrcQuestMain/scripts/login/login.js
// Level 2: lrcQuestMain/scripts/login/login.js
// ==========================================

import { getAuthInstance } from "../lrcQuestCore.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const auth = getAuthInstance();
const db = getFirestore(auth.app);

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
    btn.className =
      "w-full py-2.5 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition";

    const label = room.label || room.id;
    const photo = (room.photoUrl && String(room.photoUrl).trim()) ? String(room.photoUrl).trim() : "";

    btn.innerHTML = `
      <div class="flex items-center gap-3 justify-start px-3">
        ${
          photo
            ? `<img src="${photo}"
                    alt="${label}"
                    class="w-12 h-12 rounded-full object-cover border border-white/40"
                    onerror="this.style.display='none'" />`
            : `<div class="w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-green-800 font-bold">
                 ${String(label).trim().charAt(0)}
               </div>`
        }
        <span class="text-left">${label}</span>
      </div>
    `;

    btn.addEventListener("click", () => {
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
    { id: "0", domId: "gradeECK", label: "EC-K" },
    { id: "1", domId: "grade1", label: "1" },
    { id: "2", domId: "grade2", label: "2" },
    { id: "3", domId: "grade3", label: "3" },
    { id: "4", domId: "grade4", label: "4" },
    { id: "5", domId: "grade5", label: "5" },
  ];

  gradeGrid.innerHTML = "";

  grades.forEach(g => {
    const a = document.createElement("a");
    a.href = "#";
    a.id = g.domId;
    a.className = "grade-icon";
    a.setAttribute("data-grade", g.id);

    // No visible text over the icons
    a.innerHTML = "";
    a.setAttribute("aria-label", displayGrade(g.id));

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

staffLink.addEventListener("click", async () => {
  try {
    await ensureAnonAuth();
    setStatus("Staff login coming next (PIN + dashboard route).", true);
  } catch (err) {
    console.error(err);
    setStatus("Couldn’t start staff login.", false);
  }
});

backBtn.addEventListener("click", () => {
  showGradePicker();
  setStatus("");
});

(async function init() {
  setStatus("Ready. Choose your grade.");
  try { await ensureAnonAuth(); } catch {}
  renderGradeButtons();
})();

const adminIcon = document.getElementById("adminIcon");
const staffIcon = document.getElementById("staffIcon");

adminIcon?.addEventListener("click", () => {
  // You said you’re okay logging in each time
  window.location.href = "/lrcQuestMain/admin/adminLogin.html";
});

staffIcon?.addEventListener("click", () => {
  // Later: staff PIN login
  window.location.href = "/lrcQuestMain/staff/staffLogin.html";
});
