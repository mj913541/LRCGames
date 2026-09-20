import {
  auth,
  db,
  getSchoolId,
  userSummaryRef,
} from "../../readathon-world_Ver2/js/firebase.js";

import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const GAME_ID = "alpha-burst";
const GAME_TITLE = "Alpha Burst";

const CONFIG = {
  rewardSettings: {
    fullRewardDailyWins: 3,
    reducedRewardDailyWins: 3,
    reducedRewardAmount: 5,
    practiceReward: 0,
  },
  masterySettings: {
    enabled: true,
    roundsRequired: 10,
    accuracyThreshold: 0.9,
    streakRequired: 3,
    masteryStateOnComplete: "quest_mastered",
  },
  antiSpamSettings: {
    cooldownSeconds: 120,
  },
};

const LETTER_PAIRS = [
  { upper: "A", lower: "a" },
  { upper: "B", lower: "b" },
  { upper: "C", lower: "c" },
  { upper: "D", lower: "d" },
  { upper: "E", lower: "e" },
  { upper: "F", lower: "f" },
  { upper: "G", lower: "g" },
  { upper: "H", lower: "h" },
  { upper: "I", lower: "i" },
  { upper: "J", lower: "j" },
  { upper: "K", lower: "k" },
  { upper: "L", lower: "l" },
  { upper: "M", lower: "m" },
  { upper: "N", lower: "n" },
  { upper: "O", lower: "o" },
  { upper: "P", lower: "p" },
  { upper: "Q", lower: "q" },
  { upper: "R", lower: "r" },
  { upper: "S", lower: "s" },
  { upper: "T", lower: "t" },
  { upper: "U", lower: "u" },
  { upper: "V", lower: "v" },
  { upper: "W", lower: "w" },
  { upper: "X", lower: "x" },
  { upper: "Y", lower: "y" },
  { upper: "Z", lower: "z" }
];

const MODES = {
  practice: {
    key: "practice",
    label: "Practice",
    totalRounds: 5,
    rewardPerTap: 1,
    clearBonus: 4,
    timeLimit: 0,
    targetCount: 5,
    decoyCount: 4,
    speedMin: 0.45,
    speedMax: 0.9,
    spawnChance: 0.010,
    goldenChance: 0.06
  },
  quest: {
    key: "quest",
    label: "Quest",
    totalRounds: 8,
    rewardPerTap: 1,
    clearBonus: 7,
    timeLimit: 18,
    targetCount: 6,
    decoyCount: 7,
    speedMin: 0.7,
    speedMax: 1.3,
    spawnChance: 0.018,
    goldenChance: 0.09
  },
  challenge: {
    key: "challenge",
    label: "Challenge",
    totalRounds: 10,
    rewardPerTap: 2,
    clearBonus: 11,
    timeLimit: 12,
    targetCount: 6,
    decoyCount: 9,
    speedMin: 1.0,
    speedMax: 1.7,
    spawnChance: 0.026,
    goldenChance: 0.12
  }
};

const els = {
  practiceBtn: document.getElementById("practiceBtn"),
  questBtn: document.getElementById("questBtn"),
  challengeBtn: document.getElementById("challengeBtn"),
  modeLabel: document.getElementById("modeLabel"),
  roundLabel: document.getElementById("roundLabel"),
  scoreLabel: document.getElementById("scoreLabel"),
  streakLabel: document.getElementById("streakLabel"),
  rubiesLabel: document.getElementById("rubiesLabel"),
  timerLabel: document.getElementById("timerLabel"),
  progressFill: document.getElementById("progressFill"),
  promptType: document.getElementById("promptType"),
  promptText: document.getElementById("promptText"),
  playfield: document.getElementById("playfield"),
  roundActionBtn: document.getElementById("roundActionBtn"),
  summaryCard: document.getElementById("summaryCard"),
  summaryText: document.getElementById("summaryText"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  fxLayer: document.getElementById("fxLayer")
};

const state = {
  schoolId: "",
  userId: "",
  progressRef: null,
  progressData: null,

  mode: MODES.quest,
  roundIndex: 0,
  score: 0,
  streak: 0,
  rubies: 0,
  combo: 0,
  rounds: [],
  currentRound: null,
  activeBubbles: [],
  roundStarted: false,
  roundFinished: false,
  targetsRemaining: 0,
  roundStartTime: 0,
  timerSecondsLeft: 0,
  timerInterval: null,
  animationFrame: null,
  frameCount: 0,

  roundRubiesEarned: 0,
  roundCorrectTaps: 0,
  roundWrongTaps: 0,
  roundWeakItems: [],
  lastRoundResult: null,
};

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function shuffleArray(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandomItems(arr, count) {
  return shuffleArray(arr).slice(0, count);
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildRoundBank() {
  const rounds = [];

  LETTER_PAIRS.forEach((pair) => {
    const lowercaseDecoys = pickRandomItems(
      LETTER_PAIRS
        .filter((item) => item.lower !== pair.lower)
        .map((item) => item.lower),
      14
    );

    rounds.push({
      prompt: `Find all lowercase matches for: ${pair.upper}`,
      targetItems: Array(8).fill(pair.lower),
      decoyItems: lowercaseDecoys,
      trackingKey: pair.upper
    });

    const uppercaseDecoys = pickRandomItems(
      LETTER_PAIRS
        .filter((item) => item.upper !== pair.upper)
        .map((item) => item.upper),
      14
    );

    rounds.push({
      prompt: `Find all uppercase matches for: ${pair.lower}`,
      targetItems: Array(8).fill(pair.upper),
      decoyItems: uppercaseDecoys,
      trackingKey: pair.lower
    });
  });

  return shuffleArray(rounds);
}

const ROUND_BANK = buildRoundBank();

function chooseRounds(mode) {
  return shuffleArray(ROUND_BANK).slice(0, mode.totalRounds);
}

function getProgressRef(schoolId, userId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    "users",
    userId,
    "skillGames",
    GAME_ID
  );
}

function buildInitialProgress() {
  return {
    gameId: GAME_ID,
    title: GAME_TITLE,
    totalRoundsPlayed: 0,
    totalRoundsPassed: 0,
    totalTapAttempts: 0,
    correctTaps: 0,
    totalClears: 0,
    currentStreak: 0,
    bestStreak: 0,
    masteryState: "learning",
    challengeUnlocked: false,
    lifetimeRubiesEarned: 0,
    daily: {
      dateKey: todayDateKey(),
      rewardWins: 0,
      rubiesEarnedToday: 0,
    },
    modeStats: {
      practice: { played: 0, passed: 0 },
      quest: { played: 0, passed: 0 },
      challenge: { played: 0, passed: 0 },
    },
    weakItems: [],
    lastPlayedAt: null,
    lastRewardedAt: null,
  };
}

async function getOrCreateProgress() {
  const ref = getProgressRef(state.schoolId, state.userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const initial = buildInitialProgress();
    await setDoc(ref, initial, { merge: true });
    state.progressRef = ref;
    state.progressData = initial;
    return;
  }

  const data = snap.data() || {};

  if (data?.daily?.dateKey !== todayDateKey()) {
    data.daily = {
      dateKey: todayDateKey(),
      rewardWins: 0,
      rubiesEarnedToday: 0,
    };
    await setDoc(ref, { daily: data.daily }, { merge: true });
  }

  state.progressRef = ref;
  state.progressData = data;
}

function getAccuracy(progress) {
  const totalTapAttempts = Number(progress?.totalTapAttempts || 0);
  if (!totalTapAttempts) return 0;
  return Number(progress?.correctTaps || 0) / totalTapAttempts;
}

function getMasteryState(progress) {
  const m = CONFIG.masterySettings;
  if (!m.enabled) return "not_used";

  const mastered =
    Number(progress.totalRoundsPlayed || 0) >= m.roundsRequired &&
    getAccuracy(progress) >= m.accuracyThreshold &&
    Number(progress.currentStreak || 0) >= m.streakRequired;

  return mastered ? m.masteryStateOnComplete : "learning";
}

function secondsSinceLastReward(progress) {
  const ts = progress?.lastRewardedAt;
  if (!ts?.toDate) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
}

function isCooldownActive(progress) {
  if (state.mode.key === "practice") return false;
  return secondsSinceLastReward(progress) < CONFIG.antiSpamSettings.cooldownSeconds;
}

function calculateReward({ passed, mode, progress, earnedThisRound }) {
  if (!passed) return 0;

  const rewards = CONFIG.rewardSettings;
  const masteryState = progress?.masteryState || "learning";
  const dailyWins = Number(progress?.daily?.rewardWins || 0);

  if (mode === "practice") return rewards.practiceReward || 0;

  if (masteryState === "quest_mastered" && mode === "quest") {
    return 0;
  }

  if (dailyWins < rewards.fullRewardDailyWins) {
    return earnedThisRound;
  }

  if (dailyWins < rewards.fullRewardDailyWins + rewards.reducedRewardDailyWins) {
    return Math.min(rewards.reducedRewardAmount || 0, earnedThisRound);
  }

  return 0;
}

function updateModeButtons() {
  els.practiceBtn.classList.toggle("is-active", state.mode.key === "practice");
  els.questBtn.classList.toggle("is-active", state.mode.key === "quest");
  els.challengeBtn.classList.toggle("is-active", state.mode.key === "challenge");
  els.challengeBtn.disabled = !state.progressData?.challengeUnlocked;
}

function styleRoundActionButton() {
  Object.assign(els.roundActionBtn.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%) scale(0.92)",
    zIndex: "50",
    minWidth: "240px",
    minHeight: "72px",
    padding: "18px 28px",
    fontSize: "1.45rem",
    fontWeight: "900",
    borderRadius: "999px",
    display: "none",
    opacity: "0",
    pointerEvents: "none",
    transition: "opacity 180ms ease, transform 180ms ease"
  });
}

function showRoundActionButton(label) {
  els.roundActionBtn.textContent = label;
  els.roundActionBtn.style.display = "inline-flex";
  els.roundActionBtn.style.opacity = "1";
  els.roundActionBtn.style.pointerEvents = "auto";
  els.roundActionBtn.style.transform = "translate(-50%, -50%) scale(1)";
  els.roundActionBtn.disabled = false;

  els.roundActionBtn.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.8)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(1.08)", opacity: 1 },
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 }
    ],
    {
      duration: 220,
      easing: "ease-out"
    }
  );
}

function hideRoundActionButton() {
  els.roundActionBtn.style.display = "none";
  els.roundActionBtn.style.opacity = "0";
  els.roundActionBtn.style.pointerEvents = "none";
  els.roundActionBtn.style.transform = "translate(-50%, -50%) scale(0.92)";
}

function updateStats() {
  if (els.modeLabel) {
    els.modeLabel.textContent = state.mode.label;
  }

  if (els.roundLabel) {
    els.roundLabel.textContent = `${Math.min(state.roundIndex + 1, state.mode.totalRounds)} / ${state.mode.totalRounds}`;
  }

  if (els.scoreLabel) els.scoreLabel.textContent = String(state.score);
  if (els.streakLabel) {
    els.streakLabel.textContent = String(state.progressData?.currentStreak ?? state.streak);
  }
  if (els.rubiesLabel) {
    els.rubiesLabel.textContent = String(state.progressData?.daily?.rewardWins || 0);
  }

  if (els.timerLabel) {
    if (!state.mode.timeLimit) {
      els.timerLabel.textContent = "∞";
    } else if (!state.roundStarted && !state.roundFinished) {
      els.timerLabel.textContent = String(state.mode.timeLimit);
    } else {
      els.timerLabel.textContent = String(Math.max(0, state.timerSecondsLeft));
    }
  }

  const progressPercent = state.mode.totalRounds
    ? (state.roundIndex / state.mode.totalRounds) * 100
    : 0;

  if (els.progressFill) {
    els.progressFill.style.width = `${Math.max(0, Math.min(100, progressPercent))}%`;
  }
}

function renderRoundIntro() {
  const round = state.rounds[state.roundIndex];

  if (!round) {
    void finishGame();
    return;
  }

  state.currentRound = round;
  state.roundStarted = false;
  state.roundFinished = false;
  state.combo = 0;
  state.targetsRemaining = Math.min(state.mode.targetCount, round.targetItems.length);
  state.timerSecondsLeft = state.mode.timeLimit || 0;
  state.frameCount = 0;
  state.roundRubiesEarned = 0;
  state.roundCorrectTaps = 0;
  state.roundWrongTaps = 0;
  state.roundWeakItems = [];
  state.lastRoundResult = null;

  els.playfield.innerHTML = "";
  els.summaryCard.hidden = true;
  els.promptType.textContent = "Letter Match";
  els.promptText.textContent = round.prompt;
  els.timerLabel.textContent = state.mode.timeLimit ? String(state.timerSecondsLeft) : "∞";

  showRoundActionButton("Start Round");
  updateModeButtons();
  updateStats();
}

function resetGame() {
  stopTimer();
  stopAnimation();

  state.roundIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.rubies = 0;
  state.combo = 0;
  state.rounds = chooseRounds(state.mode);
  state.currentRound = null;
  state.activeBubbles = [];
  state.roundStarted = false;
  state.roundFinished = false;
  state.targetsRemaining = 0;
  state.roundStartTime = 0;
  state.timerSecondsLeft = state.mode.timeLimit || 0;
  state.frameCount = 0;
  state.roundRubiesEarned = 0;
  state.roundCorrectTaps = 0;
  state.roundWrongTaps = 0;
  state.roundWeakItems = [];
  state.lastRoundResult = null;

  els.playfield.innerHTML = "";
  els.summaryCard.hidden = true;
  hideRoundActionButton();

  renderRoundIntro();
}

function setMode(modeKey) {
  const requested = MODES[modeKey] || MODES.quest;

  if (requested.key === "challenge" && !state.progressData?.challengeUnlocked) {
    els.promptType.textContent = "Challenge Locked";
    els.promptText.textContent = "Challenge unlocks after mastering Quest mode.";
    updateModeButtons();
    updateStats();
    return;
  }

  state.mode = requested;
  updateModeButtons();
  resetGame();
}

function handleRoundAction() {
  if (!state.roundStarted && !state.roundFinished) {
    void startRound();
    return;
  }

  if (state.roundFinished) {
    goNextRound();
  }
}

async function startRound() {
  if (!state.currentRound || state.roundStarted) return;

  if (state.mode.key === "challenge" && !state.progressData?.challengeUnlocked) {
    els.promptType.textContent = "Challenge Locked";
    els.promptText.textContent = "Challenge unlocks after mastering Quest mode.";
    showRoundActionButton("Locked");
    return;
  }

  state.roundStarted = true;
  state.roundFinished = false;
  state.roundStartTime = performance.now();
  state.combo = 0;
  state.frameCount = 0;
  state.roundRubiesEarned = 0;
  state.roundCorrectTaps = 0;
  state.roundWrongTaps = 0;
  state.roundWeakItems = [];

  hideRoundActionButton();

  showFloatingText("GO!", {
    big: true,
    duration: 900,
    fontSize: "2.4rem"
  });

  createBubblesForRound(state.currentRound);
  startAnimation();

  if (state.mode.timeLimit > 0) {
    startTimer();
  }

  updateStats();
}

function createBubblesForRound(round) {
  els.playfield.innerHTML = "";
  state.activeBubbles = [];

  const targetItems = round.targetItems.slice(0, state.mode.targetCount);
  const decoyItems = round.decoyItems.slice(0, state.mode.decoyCount);

  const allItems = [
    ...targetItems.map((text) => ({
      text,
      isTarget: true,
      isGolden: false,
      trackingKey: round.trackingKey
    })),
    ...decoyItems.map((text) => ({
      text,
      isTarget: false,
      isGolden: false,
      trackingKey: round.trackingKey
    }))
  ];

  const shuffledItems = shuffleArray(allItems);

  shuffledItems.forEach((item, index) => {
    const bubbleObj = makeBubbleObject(item, index);
    bubbleObj.el.addEventListener("click", () => handleBubbleTap(bubbleObj));
    els.playfield.appendChild(bubbleObj.el);
    state.activeBubbles.push(bubbleObj);
  });
}

function makeBubbleObject(item, index = 0) {
  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "ab-bubble";
  bubble.textContent = item.text;
  bubble.dataset.target = item.isTarget ? "1" : "0";
  bubble.dataset.removed = "0";

  const bounds = els.playfield.getBoundingClientRect();
  const size = item.isGolden
    ? 84 + Math.floor(Math.random() * 18)
    : 70 + Math.floor(Math.random() * 24);

  const maxX = Math.max(10, bounds.width - size - 10);
  const maxY = Math.max(10, bounds.height - size - 10);

  const speedMin = state.mode.speedMin;
  const speedMax = state.mode.speedMax;

  const bubbleObj = {
    el: bubble,
    text: item.text,
    isTarget: item.isTarget,
    isGolden: !!item.isGolden,
    trackingKey: item.trackingKey || "",
    size,
    x: 10 + Math.random() * maxX,
    y: 10 + Math.random() * maxY,
    vx: (Math.random() * (speedMax - speedMin) + speedMin) * (Math.random() > 0.5 ? 1 : -1),
    vy: (Math.random() * (speedMax - speedMin) + speedMin) * (Math.random() > 0.5 ? 1 : -1),
    removed: false
  };

  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${bubbleObj.x}px`;
  bubble.style.top = `${bubbleObj.y}px`;
  bubble.style.zIndex = String(10 + index);

  if (bubbleObj.isGolden) {
    bubble.style.boxShadow = "0 0 0 4px rgba(255, 215, 90, 0.22), 0 10px 24px rgba(85, 66, 136, 0.14)";
    bubble.style.background = "linear-gradient(180deg, #fff7cc, #ffe08a)";
  }

  return bubbleObj;
}

function handleBubbleTap(bubbleObj) {
  if (!state.roundStarted || state.roundFinished || bubbleObj.removed) return;

  if (bubbleObj.isTarget) {
    handleCorrectTap(bubbleObj);
    return;
  }

  handleWrongTap(bubbleObj);
}

function handleCorrectTap(bubbleObj) {
  bubbleObj.removed = true;
  bubbleObj.el.dataset.removed = "1";

  const wasGolden = bubbleObj.isGolden;
  const baseReward = wasGolden ? state.mode.rewardPerTap * 5 : state.mode.rewardPerTap;

  state.combo += 1;

  let reward = baseReward;
  let comboTriggered = false;

  if (state.combo >= 5) {
    reward *= 2;
    comboTriggered = true;
  }

  state.targetsRemaining -= 1;
  state.score += 1;
  state.rubies += reward;
  state.roundRubiesEarned += reward;
  state.roundCorrectTaps += 1;

  bubbleObj.el.classList.add("is-correct-hit");

  if (wasGolden) {
    showFloatingText(`🌟 +${reward} 💎`, {
      big: true,
      duration: 1400,
      fontSize: "2.4rem"
    });
    burstEffectAtElement(bubbleObj.el, 16);
  } else {
    showFloatingText(`+${reward} 💎`, {
      big: true,
      duration: 1200,
      fontSize: "2rem"
    });
    burstEffectAtElement(bubbleObj.el, 10);
  }

  if (comboTriggered && state.combo % 2 === 1) {
    showFloatingText("🔥 COMBO x2 🔥", {
      big: true,
      duration: 1600,
      fontSize: "2.5rem"
    });
  }

  bubbleObj.el.remove();

  if (state.targetsRemaining <= 0) {
    void finishRound(true);
    return;
  }

  updateStats();
}

function handleWrongTap(bubbleObj) {
  bubbleObj.el.classList.add("is-wrong-hit");
  state.streak = 0;
  state.combo = 0;
  state.roundWrongTaps += 1;

  if (bubbleObj.trackingKey) {
    state.roundWeakItems.push(bubbleObj.trackingKey);
  }

  showFloatingText("Oops!", {
    big: true,
    duration: 700,
    fontSize: "2rem"
  });

  const playfield = els.playfield;
  playfield.classList.remove("ab-shake");
  void playfield.offsetWidth;
  playfield.classList.add("ab-shake");

  window.setTimeout(() => {
    bubbleObj.el.classList.remove("is-wrong-hit");
  }, 180);

  updateStats();
}

async function awardRubiesThroughFunction(amount, note) {
  if (!amount || amount <= 0) {
    return { ok: true, awarded: 0 };
  }

  const currentUser = auth.currentUser;

  console.log("Alpha Burst reward auth check:", {
    authUid: currentUser ? currentUser.uid : null,
    stateUserId: state.userId,
    schoolId: state.schoolId,
    localSchoolId: getSchoolId(),
  });

  if (!currentUser) {
    throw new Error("No signed-in Firebase user found when trying to award rubies.");
  }

  const token = await currentUser.getIdToken();

  const response = await fetch(
    "https://us-central1-lrcquest-3039e.cloudfunctions.net/submitTransactionHttp",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        schoolId: state.schoolId,
        targetUserId: state.userId,
        actionType: "RUBIES_AWARD",
        deltaMinutes: 0,
        deltaRubies: amount,
        deltaMoneyRaisedCents: 0,
        note: note || "Alpha Burst reward",
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Transaction failed");
  }

  console.log("Alpha Burst reward success:", data);

  return {
    ok: true,
    awarded: amount,
    result: data,
  };
}

async function refreshReadathonSummaryIfNeeded() {
  try {
    await getDoc(userSummaryRef(state.schoolId, state.userId));
  } catch (err) {
    console.warn("Could not refresh summary after reward:", err);
  }
}

async function saveRoundResult({ cleared, elapsedSeconds }) {
  const passed = !!cleared;

  let rewardCandidate = 0;
  let cooldownBlocked = false;
  let actualReward = 0;
  let rewardError = null;

  const currentSnap = await getDoc(state.progressRef);
  const existing = currentSnap.exists() ? currentSnap.data() : buildInitialProgress();

  const normalized = {
    ...existing,
    daily:
      existing?.daily?.dateKey === todayDateKey()
        ? existing.daily
        : { dateKey: todayDateKey(), rewardWins: 0, rubiesEarnedToday: 0 },
  };

  cooldownBlocked = isCooldownActive(normalized);

  rewardCandidate = cooldownBlocked
    ? 0
    : calculateReward({
        passed,
        mode: state.mode.key,
        progress: normalized,
        earnedThisRound: state.roundRubiesEarned,
      });

  if (rewardCandidate > 0) {
    try {
      const rewardResult = await awardRubiesThroughFunction(
        rewardCandidate,
        `Alpha Burst ${state.mode.label} round ${state.roundIndex + 1} (${elapsedSeconds.toFixed(1)}s)`
      );
      actualReward = rewardResult.awarded || 0;
    } catch (err) {
      console.error("Alpha Burst reward FAILED:", err);
      rewardError = err;
      actualReward = 0;
    }
  }

  let nextProgressData = null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(state.progressRef);
    const existingInsideTx = snap.exists() ? snap.data() : buildInitialProgress();

    const normalizedInsideTx = {
      ...existingInsideTx,
      daily:
        existingInsideTx?.daily?.dateKey === todayDateKey()
          ? existingInsideTx.daily
          : { dateKey: todayDateKey(), rewardWins: 0, rubiesEarnedToday: 0 },
    };

    const totalTapAttemptsToAdd = state.roundCorrectTaps + state.roundWrongTaps;

    const next = {
      ...normalizedInsideTx,
      totalRoundsPlayed: Number(normalizedInsideTx.totalRoundsPlayed || 0) + 1,
      totalRoundsPassed: Number(normalizedInsideTx.totalRoundsPassed || 0) + (passed ? 1 : 0),
      totalTapAttempts: Number(normalizedInsideTx.totalTapAttempts || 0) + totalTapAttemptsToAdd,
      correctTaps: Number(normalizedInsideTx.correctTaps || 0) + state.roundCorrectTaps,
      totalClears: Number(normalizedInsideTx.totalClears || 0) + (cleared ? 1 : 0),
      currentStreak: passed ? Number(normalizedInsideTx.currentStreak || 0) + 1 : 0,
      bestStreak: Math.max(
        Number(normalizedInsideTx.bestStreak || 0),
        passed ? Number(normalizedInsideTx.currentStreak || 0) + 1 : 0
      ),
      weakItems: Array.from(
        new Set([...(normalizedInsideTx.weakItems || []), ...state.roundWeakItems])
      ).slice(0, 20),
    };

    next.masteryState = getMasteryState(next);
    next.challengeUnlocked = next.masteryState === "quest_mastered";
    next.lifetimeRubiesEarned =
      Number(normalizedInsideTx.lifetimeRubiesEarned || 0) + actualReward;

    next.daily = {
      dateKey: todayDateKey(),
      rewardWins: Number(normalizedInsideTx.daily?.rewardWins || 0) + (actualReward > 0 ? 1 : 0),
      rubiesEarnedToday:
        Number(normalizedInsideTx.daily?.rubiesEarnedToday || 0) + actualReward,
    };

    next.lastPlayedAt = serverTimestamp();
    next.lastRewardedAt =
      actualReward > 0 ? serverTimestamp() : normalizedInsideTx.lastRewardedAt || null;

    transaction.set(
      state.progressRef,
      {
        gameId: GAME_ID,
        title: GAME_TITLE,
        totalRoundsPlayed: next.totalRoundsPlayed,
        totalRoundsPassed: next.totalRoundsPassed,
        totalTapAttempts: next.totalTapAttempts,
        correctTaps: next.correctTaps,
        totalClears: next.totalClears,
        currentStreak: next.currentStreak,
        bestStreak: next.bestStreak,
        masteryState: next.masteryState,
        challengeUnlocked: next.challengeUnlocked,
        lifetimeRubiesEarned: next.lifetimeRubiesEarned,
        daily: next.daily,
        modeStats: {
          ...normalizedInsideTx.modeStats,
          [state.mode.key]: {
            played: Number(normalizedInsideTx?.modeStats?.[state.mode.key]?.played || 0) + 1,
            passed: Number(normalizedInsideTx?.modeStats?.[state.mode.key]?.passed || 0) + (passed ? 1 : 0),
          },
        },
        weakItems: next.weakItems,
        lastPlayedAt: next.lastPlayedAt,
        lastRewardedAt: next.lastRewardedAt,
      },
      { merge: true }
    );

    nextProgressData = {
      ...next,
      modeStats: {
        ...normalizedInsideTx.modeStats,
        [state.mode.key]: {
          played: Number(normalizedInsideTx?.modeStats?.[state.mode.key]?.played || 0) + 1,
          passed: Number(normalizedInsideTx?.modeStats?.[state.mode.key]?.passed || 0) + (passed ? 1 : 0),
        },
      },
    };
  });

  state.progressData = nextProgressData;

  return {
    passed,
    reward: actualReward,
    rewardCandidate,
    cooldownBlocked,
    masteryState: state.progressData.masteryState,
    challengeUnlocked: state.progressData.challengeUnlocked,
    rewardError,
  };
}

async function finishRound(cleared) {
  if (state.roundFinished) return;

  state.roundFinished = true;
  state.roundStarted = false;
  stopTimer();
  stopAnimation();

  const elapsedMs = performance.now() - state.roundStartTime;
  const elapsedSeconds = Math.max(0.1, elapsedMs / 1000);

  if (cleared) {
    state.streak += 1;

    let bonus = state.mode.clearBonus;
    if (elapsedSeconds <= 6) bonus += 4;
    if (elapsedSeconds <= 4) bonus += 4;
    if (state.streak > 0 && state.streak % 3 === 0) bonus += 6;
    if (state.combo >= 8) bonus += 6;

    state.rubies += bonus;
    state.roundRubiesEarned += bonus;

    showFloatingText("🎉 CLEAR!", {
      big: true,
      duration: 1600,
      fontSize: "2.6rem"
    });

    rubyShower(bonus);
    burstEffectCenter(18);
  } else {
    state.streak = 0;
    state.combo = 0;

    showFloatingText("⏰ Time's Up!", {
      big: true,
      duration: 1200,
      fontSize: "2.3rem"
    });
  }

  let result;

  try {
    result = await saveRoundResult({ cleared, elapsedSeconds });
    await refreshReadathonSummaryIfNeeded();
  } catch (err) {
    console.error("Alpha Burst finishRound failed:", err);
    els.summaryCard.hidden = false;
    els.summaryText.textContent =
      "You finished the round, but there was a problem saving progress or ruby rewards.";
    showRoundActionButton("Next Round ✨");
    return;
  }

  state.lastRoundResult = result;
  updateModeButtons();
  updateStats();

  let summary = cleared
    ? `Round cleared! You earned ${state.roundRubiesEarned} burst rubies this round.`
    : `Round ended. You collected ${state.roundRubiesEarned} burst rubies before time ran out.`;

  if (result.passed) {
    if (result.reward > 0) {
      summary += ` ${result.reward} rubies were awarded to your account.`;
    } else if (result.rewardError) {
      summary += " The round counted, but the ruby award failed to send.";
    } else if (result.cooldownBlocked) {
      summary += " Ruby rewards are cooling down right now.";
    } else if (state.mode.key === "practice") {
      summary += " Practice mode does not award account rubies.";
    } else if (result.masteryState === "quest_mastered" && state.mode.key === "quest") {
      summary += " Quest mode is mastered! Use Challenge mode to keep earning account rubies.";
    } else {
      summary += " No account rubies were awarded this round.";
    }
  } else {
    summary += " Clear the round to count a pass.";
  }

  if (result.challengeUnlocked) {
    summary += " Challenge mode is now unlocked!";
  }

  els.summaryCard.hidden = false;
  els.summaryText.textContent = summary;

  if (state.mode.key === "challenge") {
    await wait(850);
    goNextRound();
    return;
  }

  showRoundActionButton("Next Round ✨");
}

function goNextRound() {
  if (!state.roundFinished) return;

  state.roundIndex += 1;

  if (state.roundIndex >= state.mode.totalRounds) {
    void finishGame();
    return;
  }

  renderRoundIntro();
}

async function finishGame() {
  stopTimer();
  stopAnimation();

  els.playfield.innerHTML = "";
  hideRoundActionButton();

  if (els.progressFill) {
    els.progressFill.style.width = "100%";
  }

  els.promptType.textContent = "Complete!";
  els.promptText.textContent = "Amazing burst work!";

  let summary =
    `You popped ${state.score} correct bubbles and collected ${state.rubies} burst rubies this game.`;

  if (state.progressData) {
    summary += ` Daily reward wins: ${state.progressData?.daily?.rewardWins || 0}.`;
    summary += ` Mastery: ${state.progressData?.masteryState || "learning"}.`;
  }

  els.summaryText.textContent = summary;
  els.summaryCard.hidden = false;

  showFloatingText("Game Complete 🎉", {
    big: true,
    duration: 1600,
    fontSize: "2.5rem"
  });

  updateModeButtons();
  updateStats();
}

function startTimer() {
  stopTimer();

  state.timerInterval = window.setInterval(() => {
    state.timerSecondsLeft -= 1;
    updateStats();

    if (state.timerSecondsLeft <= 0) {
      state.timerSecondsLeft = 0;
      updateStats();
      void finishRound(false);
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    window.clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function maybeSpawnExtraBubble() {
  if (!state.currentRound || state.roundFinished) return;
  if (Math.random() >= state.mode.spawnChance) return;

  const shouldSpawnTarget = Math.random() < 0.62;
  const isGolden = shouldSpawnTarget && Math.random() < state.mode.goldenChance;

  const item = shouldSpawnTarget
    ? {
        text: state.currentRound.targetItems[0],
        isTarget: true,
        isGolden,
        trackingKey: state.currentRound.trackingKey
      }
    : {
        text: randomFrom(state.currentRound.decoyItems),
        isTarget: false,
        isGolden: false,
        trackingKey: state.currentRound.trackingKey
      };

  const bubbleObj = makeBubbleObject(item, state.activeBubbles.length + 20);
  bubbleObj.el.addEventListener("click", () => handleBubbleTap(bubbleObj));

  els.playfield.appendChild(bubbleObj.el);
  state.activeBubbles.push(bubbleObj);
}

function startAnimation() {
  stopAnimation();

  const animate = () => {
    if (!state.roundStarted || state.roundFinished) return;

    const bounds = els.playfield.getBoundingClientRect();
    state.frameCount += 1;

    for (const bubble of state.activeBubbles) {
      if (bubble.removed || !bubble.el.isConnected) continue;

      bubble.x += bubble.vx;
      bubble.y += bubble.vy;

      if (bubble.x <= 0) {
        bubble.x = 0;
        bubble.vx *= -1;
      } else if (bubble.x + bubble.size >= bounds.width) {
        bubble.x = bounds.width - bubble.size;
        bubble.vx *= -1;
      }

      if (bubble.y <= 0) {
        bubble.y = 0;
        bubble.vy *= -1;
      } else if (bubble.y + bubble.size >= bounds.height) {
        bubble.y = bounds.height - bubble.size;
        bubble.vy *= -1;
      }

      bubble.el.style.left = `${bubble.x}px`;
      bubble.el.style.top = `${bubble.y}px`;
    }

    if (state.frameCount % 12 === 0) {
      maybeSpawnExtraBubble();
    }

    state.animationFrame = window.requestAnimationFrame(animate);
  };

  state.animationFrame = window.requestAnimationFrame(animate);
}

function stopAnimation() {
  if (state.animationFrame) {
    window.cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }
}

function showFloatingText(text, options = {}) {
  const {
    big = false,
    duration = 1200,
    fontSize = "",
    topMin = 36,
    topRange = 18
  } = options;

  const node = document.createElement("div");
  node.className = "ab-float";
  node.textContent = text;

  node.style.left = `${44 + Math.random() * 12}%`;
  node.style.top = `${topMin + Math.random() * topRange}%`;
  node.style.fontWeight = "900";
  node.style.letterSpacing = "0.02em";
  node.style.textShadow = "0 4px 18px rgba(255,255,255,0.98), 0 3px 14px rgba(120,80,200,0.22)";

  if (big) {
    node.style.fontSize = fontSize || "2.1rem";
  } else {
    node.style.fontSize = fontSize || "1.5rem";
  }

  node.animate(
    [
      { opacity: 0, transform: "translate(-50%, 20px) scale(0.72)" },
      { opacity: 1, transform: "translate(-50%, -4px) scale(1.12)", offset: 0.18 },
      { opacity: 1, transform: "translate(-50%, -20px) scale(1.06)", offset: 0.55 },
      { opacity: 0, transform: "translate(-50%, -85px) scale(1.02)" }
    ],
    {
      duration,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "forwards"
    }
  );

  els.fxLayer.appendChild(node);

  window.setTimeout(() => {
    node.remove();
  }, duration + 80);
}

function rubyShower(totalBonus) {
  const burstCount = Math.min(12, Math.max(6, totalBonus));

  for (let i = 0; i < burstCount; i += 1) {
    window.setTimeout(() => {
      const amount = i < 3 ? "+5 💎" : "+1 💎";
      showFloatingText(amount, {
        big: true,
        duration: 1300,
        fontSize: "2.2rem",
        topMin: 34,
        topRange: 24
      });
    }, i * 90);
  }
}

function burstEffectAtElement(targetEl, particles = 10) {
  const rect = targetEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  for (let i = 0; i < particles; i += 1) {
    const dot = document.createElement("div");
    dot.className = "ab-burst";
    dot.style.left = `${centerX}px`;
    dot.style.top = `${centerY}px`;

    const angle = (Math.PI * 2 * i) / particles;
    const distance = 26 + Math.random() * 30;
    dot.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    dot.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);

    els.fxLayer.appendChild(dot);

    window.setTimeout(() => {
      dot.remove();
    }, 720);
  }
}

function burstEffectCenter(particles = 16) {
  const rect = els.playfield.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  for (let i = 0; i < particles; i += 1) {
    const dot = document.createElement("div");
    dot.className = "ab-burst";
    dot.style.left = `${centerX}px`;
    dot.style.top = `${centerY}px`;

    const angle = (Math.PI * 2 * i) / particles;
    const distance = 45 + Math.random() * 60;
    dot.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    dot.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);

    els.fxLayer.appendChild(dot);

    window.setTimeout(() => {
      dot.remove();
    }, 760);
  }
}

async function initForUser(user) {
  if (!user) {
    els.promptType.textContent = "Not Signed In";
    els.promptText.textContent = "Please sign in before playing Alpha Burst.";
    showRoundActionButton("Sign in required");
    return;
  }

  state.userId = user.uid;
  state.schoolId = getSchoolId();

  console.log("Alpha Burst initForUser:", {
    uid: user.uid,
    schoolId: state.schoolId,
  });

  if (!state.schoolId) {
    els.promptType.textContent = "Missing School ID";
    els.promptText.textContent = "Could not find schoolId for this session.";
    showRoundActionButton("Missing school");
    return;
  }

  await getOrCreateProgress();
  updateModeButtons();
  resetGame();
}

els.practiceBtn.addEventListener("click", () => setMode("practice"));
els.questBtn.addEventListener("click", () => setMode("quest"));
els.challengeBtn.addEventListener("click", () => setMode("challenge"));
els.roundActionBtn.addEventListener("click", handleRoundAction);
els.playAgainBtn.addEventListener("click", async () => {
  await refreshReadathonSummaryIfNeeded();
  resetGame();
});

window.addEventListener("resize", () => {
  if (!state.roundStarted || state.roundFinished) return;

  const bounds = els.playfield.getBoundingClientRect();

  state.activeBubbles.forEach((bubble) => {
    if (bubble.removed || !bubble.el.isConnected) return;

    const maxX = Math.max(0, bounds.width - bubble.size);
    const maxY = Math.max(0, bounds.height - bubble.size);

    bubble.x = Math.min(Math.max(0, bubble.x), maxX);
    bubble.y = Math.min(Math.max(0, bubble.y), maxY);

    bubble.el.style.left = `${bubble.x}px`;
    bubble.el.style.top = `${bubble.y}px`;
  });
});

styleRoundActionButton();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    els.promptType.textContent = "Not Signed In";
    els.promptText.textContent = "Please sign in before playing Alpha Burst.";
    showRoundActionButton("Sign in required");
    return;
  }

  try {
    await initForUser(user);
  } catch (err) {
    console.error("Alpha Burst failed to load:", err);
    els.promptType.textContent = "Game Error";
    els.promptText.textContent = err?.message || "Something went wrong while loading.";
    showRoundActionButton("Load error");
  }
});