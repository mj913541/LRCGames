const MODES = {
  enter: {
    title: "ENTER",
    icon: "🚪",
    directions: [
      "📚 Return Books",
      "🔤 Check Your Letter",
      "💼 Check Your Job",
      "🪑 Sit on Your Letter",
      "👀 Ready to Learn"
    ],
    champs: {
      C: ["Conversation", "Level 0–1"],
      H: ["Help", "Check the ABC chart first; ask if you still need help."],
      A: ["Activity", "Return books, check your letter/job, sit on your letter."],
      M: ["Movement", "Walk directly to the return station or rug."],
      P: ["Participation", "Complete your arrival routine right away."],
      S: ["Success", "On your letter and ready to learn."]
    }
  },
  learn: {
    title: "LEARN",
    icon: "👩‍🏫",
    directions: [
      "👀 Look",
      "👂 Listen",
      "🧠 Think",
      "✋ Participate",
      "🔤 Stay on Your Letter"
    ],
    champs: {
      C: ["Conversation", "Level 0 unless invited to talk."],
      H: ["Help", "Raise your hand or use the class signal."],
      A: ["Activity", "Listen, think, respond, and participate."],
      M: ["Movement", "Stay on your assigned letter."],
      P: ["Participation", "Eyes and attention on the lesson."],
      S: ["Success", "Ready to learn and respectful of others' learning."]
    }
  },
  work: {
    title: "WORK",
    icon: "💻",
    directions: [
      "💻 Stay On Task",
      "🎧 Use Your Headphones",
      "🤔 Try First",
      "🤫 Level 1",
      "👀 Follow the Screen"
    ],
    champs: {
      C: ["Conversation", "Level 1."],
      H: ["Help", "Try first, use resources, then ask for help."],
      A: ["Activity", "Complete your assigned LRC work."],
      M: ["Movement", "Stay in your work area unless directed."],
      P: ["Participation", "Chromebook on task; headphones used appropriately."],
      S: ["Success", "Work independently and make progress."]
    }
  },
  shop: {
    title: "SHOP",
    icon: "📚",
    directions: [
      "👀 Follow the Screen",
      "🚶 Walk",
      "📚 Choose Up to 2",
      "🤫 Level 1",
      "🖥️ Scan Your Books",
      "🔤 Return to Your Letter"
    ],
    champs: {
      C: ["Conversation", "Level 1."],
      H: ["Help", "Look independently first; ask Mrs. Albrecht when needed."],
      A: ["Activity", "Find up to 2 books and complete self-checkout."],
      M: ["Movement", "Only the displayed shopping group browses; walk."],
      P: ["Participation", "Respect books, scan carefully, finish checkout."],
      S: ["Success", "Books chosen and checkout completed independently."]
    }
  },
  bathroom: {
    title: "BATHROOM",
    icon: "🚻",
    directions: [
      "✏️ Write Your Name",
      "⏳ Wait Your Turn",
      "📎 Take the Pass",
      "🚻 Go",
      "🧽 Erase Your Name",
      "📎 Return the Pass"
    ],
    champs: {
      C: ["Conversation", "Level 0–1."],
      H: ["Help", "Use the bathroom queue without interrupting."],
      A: ["Activity", "Write name, wait, take pass, go, return, erase."],
      M: ["Movement", "Only the student whose turn it is leaves."],
      P: ["Participation", "Manage your place in the queue independently."],
      S: ["Success", "Bathroom needs handled without disrupting learning."]
    }
  },
  cleanup: {
    title: "CLEAN UP",
    icon: "🎵",
    directions: [
      "🛑 Stop",
      "💻 Return Tech",
      "🎧 Hang Headphones",
      "📚 Grab Books",
      "🧹 Reset Your Space",
      "🚶 Go to the Line"
    ],
    champs: {
      C: ["Conversation", "Level 0–1."],
      H: ["Help", "Ask only if something is missing, broken, or needs adult help."],
      A: ["Activity", "Stop, clean, return materials, gather books."],
      M: ["Movement", "Return materials, then walk to lineup."],
      P: ["Participation", "Reset your space; Door Opener reports to the door."],
      S: ["Success", "Everything put away before the song ends."]
    }
  },
  lineup: {
    title: "LINE UP",
    icon: "🚪",
    directions: [
      "👣 Feet on the Line",
      "➡️ Face Forward",
      "🙌 Hands to Yourself",
      "📚 Books With You",
      "🤫 Voice 0",
      "🚪 Wait for Mrs. Albrecht"
    ],
    champs: {
      C: ["Conversation", "Level 0."],
      H: ["Help", "Get Mrs. Albrecht's attention only if needed."],
      A: ["Activity", "Wait for dismissal."],
      M: ["Movement", "Stay on the lineup strip."],
      P: ["Participation", "Face forward, books with you, body to yourself."],
      S: ["Success", "Quiet, safe line ready to leave."]
    }
  }
};

const WAVE_GROUPS = [
  ["A","B","C","D","E","F","G"],
  ["H","I","J","K","L","M","N"],
  ["O","P","Q","R","S","T","U"],
  ["V","W","X","Y","Z","AA","AB","AC","AD"]
];

let currentMode = "enter";
let waveIndex = 0;
let waveType = null;
let timerSeconds = 45 * 60;
let timerHandle = null;
let cleanupTriggered = false;
const CLEANUP_LEAD_SECONDS = 4 * 60;

const el = id => document.getElementById(id);

function renderMode(modeKey) {
  currentMode = modeKey;
  const mode = MODES[modeKey];
  el("modeTitle").textContent = mode.title;
  el("modeIcon").textContent = mode.icon;
  el("studentDirections").innerHTML = mode.directions.map(d => `<div>${d}</div>`).join("");
  el("champsList").innerHTML = Object.entries(mode.champs).map(([letter, [label, text]]) => `
    <div class="champ-row">
      <span class="champ-letter">${letter}</span>
      <span><strong>${label}</strong>${text}</span>
    </div>
  `).join("");

  document.querySelectorAll(".mode-buttons button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === modeKey);
  });
}

function renderWave() {
  const title = waveType === "chromebook" ? "💻 CHROMEBOOKS — YOUR TURN" : "📚 BOOK SHOPPING — YOUR TURN";
  el("waveLabel").textContent = title;
  el("waveLetters").textContent = WAVE_GROUPS[waveIndex].join(" ");
  el("wavePanel").classList.remove("hidden");
}

function setWaveType(type) {
  waveType = type;
  waveIndex = 0;
  renderWave();
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const secs = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function renderTimer() {
  el("timer").textContent = formatTime(timerSeconds);
}

function tickClock() {
  const now = new Date();
  el("clock").textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function startTimer() {
  if (timerHandle) return;
  cleanupTriggered = false;
  timerHandle = setInterval(() => {
    timerSeconds = Math.max(0, timerSeconds - 1);
    renderTimer();

    if (!cleanupTriggered && timerSeconds <= CLEANUP_LEAD_SECONDS) {
      cleanupTriggered = true;
      startCleanup();
    }

    if (timerSeconds === 0) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerHandle);
  timerHandle = null;
}

function resetTimer() {
  pauseTimer();
  const mins = Number(el("minutesInput").value) || 45;
  timerSeconds = mins * 60;
  cleanupTriggered = false;
  renderTimer();
}

function startCleanup() {
  renderMode("cleanup");
  el("cleanupOverlay").classList.remove("hidden");
  // Phase 2: connect the approved cleanup audio source here.
}

document.querySelectorAll(".mode-buttons button").forEach(btn => {
  btn.addEventListener("click", () => renderMode(btn.dataset.mode));
});

el("chromebookWaveBtn").addEventListener("click", () => setWaveType("chromebook"));
el("shoppingWaveBtn").addEventListener("click", () => setWaveType("shopping"));
el("hideWaveBtn").addEventListener("click", () => el("wavePanel").classList.add("hidden"));

el("nextWaveBtn").addEventListener("click", () => {
  waveIndex = (waveIndex + 1) % WAVE_GROUPS.length;
  renderWave();
});

el("prevWaveBtn").addEventListener("click", () => {
  waveIndex = (waveIndex - 1 + WAVE_GROUPS.length) % WAVE_GROUPS.length;
  renderWave();
});

el("classNameInput").addEventListener("input", e => {
  el("classTitle").textContent = e.target.value.trim() || "Classroom Screen";
});

el("startTimerBtn").addEventListener("click", startTimer);
el("pauseTimerBtn").addEventListener("click", pauseTimer);
el("resetTimerBtn").addEventListener("click", resetTimer);
el("cleanupNowBtn").addEventListener("click", startCleanup);
el("closeCleanupBtn").addEventListener("click", () => el("cleanupOverlay").classList.add("hidden"));

tickClock();
setInterval(tickClock, 1000);
renderMode("enter");
renderTimer();
