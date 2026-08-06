const CLASSES = {
  "K-Johnson":  { teacher: "Johnson",  grade: "Kindergarten", students: 16 },
  "K-Mederich": { teacher: "Mederich", grade: "Kindergarten", students: 17 },
  "K-Stukel":   { teacher: "Stukel",   grade: "Kindergarten", students: 17 },

  "1-Day":      { teacher: "Day",      grade: "1st Grade", students: 24 },
  "1-Rogers":   { teacher: "Rogers",   grade: "1st Grade", students: 24 },
  "1-Wilson":   { teacher: "Wilson",   grade: "1st Grade", students: 24 },

  "2-Adams":    { teacher: "Adams",    grade: "2nd Grade", students: 16 },
  "2-Peterson": { teacher: "Peterson", grade: "2nd Grade", students: 18 },
  "2-Schmidt":  { teacher: "Schmidt",  grade: "2nd Grade", students: 18 },

  "3-Carroll":  { teacher: "Carroll",  grade: "3rd Grade", students: 24 },
  "3-Cocco":    { teacher: "Cocco",    grade: "3rd Grade", students: 23 },
  "3-Hossain":  { teacher: "Hossain",  grade: "3rd Grade", students: 23 },

  "5-Basic":    { teacher: "Basic",    grade: "5th Grade", students: 23 },
  "5-Daleiden": { teacher: "Daleiden", grade: "5th Grade", students: 24 },
  "5-Szwaya":   { teacher: "Szwaya",   grade: "5th Grade", students: 23 }
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
let currentClass = null;
let dynamicWaveGroups = [];

function buildBalancedGroups(studentCount) {
  const active = LETTERS.slice(0, studentCount);
  const baseSize = Math.floor(studentCount / 3);
  const remainder = studentCount % 3;
  const sizes = [0, 1, 2].map(i => baseSize + (i < remainder ? 1 : 0));

  const groups = [];
  let cursor = 0;
  sizes.forEach(size => {
    groups.push(active.slice(cursor, cursor + size));
    cursor += size;
  });
  return groups;
}

function groupRange(group) {
  if (!group.length) return "â€”";
  return group.length === 1 ? group[0] : `${group[0]}â€“${group[group.length - 1]}`;
}

function selectClass(classKey) {
  currentClass = CLASSES[classKey] || null;
  if (!currentClass) {
    dynamicWaveGroups = [];
    el("classTitle").textContent = "Classroom Screen";
    el("classSummary").classList.add("hidden");
    return;
  }

  dynamicWaveGroups = buildBalancedGroups(currentClass.students);
  waveIndex = 0;

  el("classTitle").textContent =
    `${currentClass.grade} â€” ${currentClass.teacher} (${currentClass.students})`;

  const lastLetter = LETTERS[currentClass.students - 1];
  el("activeLetters").textContent = `Active letters: Aâ€“${lastLetter}`;

  el("groupSummary").textContent =
    `3 groups: ${dynamicWaveGroups.map(g => `${groupRange(g)} (${g.length})`).join(" â€¢ ")}`;

  el("classSummary").classList.remove("hidden");

  if (!el("rotationBoard").classList.contains("hidden")) renderRotationBoard();
}


// ============================================================
// AUTOMATIC SCHOOL-DAY + CLASS-BLOCK CONFIG
// ============================================================

// These fixed LRC instructional blocks come from Mrs. Albrecht's current schedule.
// Change these times here if the master schedule changes.
const LRC_BLOCKS = [
  { id: "4th", grade: "4th Grade", start: "09:05", end: "09:50" },
  { id: "2nd", grade: "2nd Grade", start: "10:05", end: "10:50" },
  { id: "5th", grade: "5th Grade", start: "11:05", end: "11:50" },
  { id: "K",   grade: "Kindergarten", start: "12:45", end: "13:30" },
  { id: "3rd", grade: "3rd Grade", start: "13:45", end: "14:30" },
  { id: "1st", grade: "1st Grade", start: "14:45", end: "15:30" }
];

// IMPORTANT:
// Put the actual homeroom/house assigned to each Aâ€“E day here.
// I am NOT guessing this mapping. Once populated, the screen will select
// the exact class automatically with no clicks.
//
// Example shape:
// "A": { "1st": "1-Day", "2nd": "2-Adams", "3rd": "3-Carroll", "5th": "5-Basic" }
//
// Fourth grade is intentionally omitted until house rosters are finalized.
const ROTATION_CLASS_MAP = {
  A: {},
  B: {},
  C: {},
  D: {},
  E: {}
};

// School dates that do NOT advance the Aâ€“E rotation.
// This list covers known no-school / institute / break dates in the 2026â€“27 calendar.
// It is kept in one place so unusual calendar changes are easy to edit.
const SKIP_DATES = new Set([
  "2026-09-07",
  "2026-10-09","2026-10-12",
  "2026-11-02","2026-11-03",
  "2026-11-23","2026-11-24","2026-11-25","2026-11-26","2026-11-27",
  "2026-12-21","2026-12-22","2026-12-23","2026-12-24","2026-12-25",
  "2026-12-28","2026-12-29","2026-12-30","2026-12-31",
  "2027-01-01","2027-01-04","2027-01-18",
  "2027-02-15","2027-02-26",
  "2027-03-22","2027-03-23","2027-03-24","2027-03-25","2027-03-26","2027-03-29",
  "2027-04-06",
  "2027-05-31"
]);

const SCHOOL_START = "2026-08-20";
const SCHOOL_END = "2027-05-28";
const ROTATION = ["A","B","C","D","E"];

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(key) {
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function isWeekday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function getLetterDay(date = new Date()) {
  const key = localDateKey(date);
  if (key < SCHOOL_START || key > SCHOOL_END) return null;
  if (!isWeekday(date) || SKIP_DATES.has(key)) return null;

  const start = parseLocalDate(SCHOOL_START);
  const target = parseLocalDate(key);
  let instructionalDays = 0;

  for (let cursor = new Date(start); cursor <= target; cursor.setDate(cursor.getDate() + 1)) {
    const cursorKey = localDateKey(cursor);
    if (isWeekday(cursor) && !SKIP_DATES.has(cursorKey)) {
      instructionalDays++;
    }
  }

  return ROTATION[(instructionalDays - 1) % ROTATION.length];
}

function minutesSinceMidnight(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function hhmmToMinutes(hhmm) {
  const [h,m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function getCurrentBlock(date = new Date()) {
  const mins = minutesSinceMidnight(date);
  return LRC_BLOCKS.find(block =>
    mins >= hhmmToMinutes(block.start) &&
    mins < hhmmToMinutes(block.end)
  ) || null;
}

function getMappedClassKey(letterDay, block) {
  if (!letterDay || !block) return null;
  return ROTATION_CLASS_MAP[letterDay]?.[block.id] || null;
}

function updateAutomaticStatus() {
  const now = new Date();
  const letterDay = getLetterDay(now);
  const block = getCurrentBlock(now);

  el("letterDayStatus").textContent =
    letterDay ? `${letterDay} Day` : "No scheduled rotation today";

  if (!block) {
    el("blockStatus").textContent = "Between LRC classes";
    return { letterDay, block: null, classKey: null };
  }

  const classKey = getMappedClassKey(letterDay, block);
  const mappedClass = classKey ? CLASSES[classKey] : null;

  if (mappedClass) {
    el("blockStatus").textContent =
      `${block.start}â€“${block.end} â€¢ ${mappedClass.grade} â€” ${mappedClass.teacher}`;
  } else {
    el("blockStatus").textContent =
      `${block.start}â€“${block.end} â€¢ ${block.grade} â€¢ homeroom mapping needed`;
  }

  return { letterDay, block, classKey };
}

function useAutomaticClass() {
  const auto = updateAutomaticStatus();

  if (!auto.letterDay) {
    alert("There is no regular Aâ€“E rotation scheduled for today.");
    return;
  }

  if (!auto.block) {
    alert("It is currently between scheduled LRC class blocks.");
    return;
  }

  if (!auto.classKey) {
    alert(
      `I know it is ${auto.letterDay} Day and the ${auto.block.grade} block, ` +
      `but the homeroom-to-letter-day mapping still needs to be added in classroomScreen.js.`
    );
    return;
  }

  el("classSelect").value = auto.classKey;
  selectClass(auto.classKey);

  // Set the class timer to the exact amount of time remaining in this block.
  const nowMinutes = minutesSinceMidnight(new Date());
  const endMinutes = hhmmToMinutes(auto.block.end);
  timerSeconds = Math.max(0, (endMinutes - nowMinutes) * 60 - new Date().getSeconds());
  cleanupTriggered = timerSeconds <= CLEANUP_LEAD_SECONDS;
  renderTimer();

  // Choose a sensible mode from where we are in the class.
  const blockStart = hhmmToMinutes(auto.block.start);
  const elapsed = nowMinutes - blockStart;

  if (timerSeconds <= 60) {
    renderMode("lineup");
  } else if (timerSeconds <= CLEANUP_LEAD_SECONDS) {
    renderMode("cleanup");
  } else if (elapsed < 5) {
    renderMode("enter");
  }

  startTimer();
}

// Refresh the automatic date/time status every 15 seconds.
setInterval(updateAutomaticStatus, 15000);

const MODES = {
  enter: {
    title: "ENTER",
    icon: "ðŸšª",
    directions: [
      "ðŸ“š Return Books",
      "ðŸ”¤ Check Your Letter",
      "ðŸ’¼ Check Your Job",
      "ðŸª‘ Sit on Your Letter",
      "ðŸ‘€ Ready to Learn"
    ],
    champs: {
      C: ["Conversation", "Level 0â€“1"],
      H: ["Help", "Check the ABC chart first; ask if you still need help."],
      A: ["Activity", "Return books, check your letter/job, sit on your letter."],
      M: ["Movement", "Walk directly to the return station or rug."],
      P: ["Participation", "Complete your arrival routine right away."],
      S: ["Success", "On your letter and ready to learn."]
    }
  },
  learn: {
    title: "LEARN",
    icon: "ðŸ‘©â€ðŸ«",
    directions: [
      "ðŸ‘€ Look",
      "ðŸ‘‚ Listen",
      "ðŸ§  Think",
      "âœ‹ Participate",
      "ðŸ”¤ Stay on Your Letter"
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
    icon: "ðŸ’»",
    directions: [
      "ðŸ’» Stay On Task",
      "ðŸŽ§ Use Your Headphones",
      "ðŸ¤” Try First",
      "ðŸ¤« Level 1",
      "ðŸ‘€ Follow the Screen"
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
    icon: "ðŸ“š",
    directions: [
      "ðŸ‘€ Follow the Screen",
      "ðŸš¶ Walk",
      "ðŸ“š Choose Up to 2",
      "ðŸ¤« Level 1",
      "ðŸ–¥ï¸ Scan Your Books",
      "ðŸ”¤ Return to Your Letter"
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
    icon: "ðŸš»",
    directions: [
      "âœï¸ Write Your Name",
      "â³ Wait Your Turn",
      "ðŸ“Ž Take the Pass",
      "ðŸš» Go",
      "ðŸ§½ Erase Your Name",
      "ðŸ“Ž Return the Pass"
    ],
    champs: {
      C: ["Conversation", "Level 0â€“1."],
      H: ["Help", "Use the bathroom queue without interrupting."],
      A: ["Activity", "Write name, wait, take pass, go, return, erase."],
      M: ["Movement", "Only the student whose turn it is leaves."],
      P: ["Participation", "Manage your place in the queue independently."],
      S: ["Success", "Bathroom needs handled without disrupting learning."]
    }
  },
  cleanup: {
    title: "CLEAN UP",
    icon: "ðŸŽµ",
    directions: [
      "ðŸ›‘ Stop",
      "ðŸ’» Return Tech",
      "ðŸŽ§ Hang Headphones",
      "ðŸ“š Grab Books",
      "ðŸ§¹ Reset Your Space",
      "ðŸš¶ Go to the Line"
    ],
    champs: {
      C: ["Conversation", "Level 0â€“1."],
      H: ["Help", "Ask only if something is missing, broken, or needs adult help."],
      A: ["Activity", "Stop, clean, return materials, gather books."],
      M: ["Movement", "Return materials, then walk to lineup."],
      P: ["Participation", "Reset your space; Door Opener reports to the door."],
      S: ["Success", "Everything put away before the song ends."]
    }
  },
  lineup: {
    title: "LINE UP",
    icon: "ðŸšª",
    directions: [
      "ðŸ‘£ Feet on the Line",
      "âž¡ï¸ Face Forward",
      "ðŸ™Œ Hands to Yourself",
      "ðŸ“š Books With You",
      "ðŸ¤« Voice 0",
      "ðŸšª Wait for Mrs. Albrecht"
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

let currentMode = "enter";
let waveIndex = 0;
let waveType = null;
let timerSeconds = 45 * 60;
let timerHandle = null;
let cleanupTriggered = false;
const CLEANUP_LEAD_SECONDS = 4 * 60;

const el = id => document.getElementById(id);

const CHAMPS_ICONS = {
  C: "ðŸ’¬",
  H: "ðŸ™‹",
  A: "ðŸŽ¯",
  M: "ðŸš¶",
  P: "âœ‹",
  S: "â­"
};

function renderMode(modeKey) {
  currentMode = modeKey;
  const mode = MODES[modeKey];
  el("modeTitle").textContent = mode.title;
  el("modeIcon").textContent = mode.icon;
  el("studentDirections").innerHTML = mode.directions.map(d => `<div>${d}</div>`).join("");
  el("champsList").innerHTML = Object.entries(mode.champs).map(([letter, [label, text]]) => `
    <div
      class="champ-row"
      role="img"
      aria-label="${label}: ${text}"
      title="${label}: ${text}"
    >
      <span class="champ-icon" aria-hidden="true">${CHAMPS_ICONS[letter]}</span>
    </div>
  `).join("");

  document.querySelectorAll(".mode-buttons button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === modeKey);
  });
}

function renderRotationBoard() {
  if (!currentClass || dynamicWaveGroups.length !== 3) return;

  const shopGroup = dynamicWaveGroups[waveIndex] || [];
  const workGroup = dynamicWaveGroups
    .filter((_, index) => index !== waveIndex)
    .flat();

  const chips = letters => letters
    .map(letter => `<span class="letter-chip">${letter}</span>`)
    .join("");

  el("shopLetters").innerHTML = chips(shopGroup);
  el("workLetters").innerHTML = chips(workGroup);
  el("rotationLabel").textContent = `Shopping Group ${waveIndex + 1} of 3`;
  el("rotationBoard").classList.remove("hidden");
}

function showRotationBoard() {
  if (!currentClass) {
    alert("Choose a class first so I can build its three groups.");
    return;
  }
  waveIndex = Math.min(waveIndex, 2);
  renderRotationBoard();
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




el("classSelect").addEventListener("change", e => selectClass(e.target.value));

el("startTimerBtn").addEventListener("click", startTimer);
el("pauseTimerBtn").addEventListener("click", pauseTimer);
el("resetTimerBtn").addEventListener("click", resetTimer);
el("cleanupNowBtn").addEventListener("click", startCleanup);
el("closeCleanupBtn").addEventListener("click", () => el("cleanupOverlay").classList.add("hidden"));

tickClock();
setInterval(tickClock, 1000);
renderMode("enter");
renderTimer();


el("useAutoBtn").addEventListener("click", useAutomaticClass);
updateAutomaticStatus();


el("showRotationBtn").addEventListener("click", showRotationBoard);
el("hideRotationBtn").addEventListener("click", () => {
  el("rotationBoard").classList.add("hidden");
});

el("nextRotationBtn").addEventListener("click", () => {
  waveIndex = (waveIndex + 1) % 3;
  renderRotationBoard();
});

el("prevRotationBtn").addEventListener("click", () => {
  waveIndex = (waveIndex + 2) % 3;
  renderRotationBoard();
});


el("controlsToggleBtn").addEventListener("click", () => {
  const panel = el("teacherControlsPanel");
  const isHidden = panel.classList.toggle("hidden");
  el("controlsToggleBtn").textContent = isHidden ? "âš™ï¸ Controls" : "âœ• Close Controls";
});