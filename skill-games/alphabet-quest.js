import {
  auth,
  db,
  getSchoolId,
  fnSubmitTransaction,
  userSummaryRef,
} from "../readathon-world_Ver2/js/firebase.js";

import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const GAME_ID = "alphabet-quest";
const GAME_TITLE = "Alphabet Quest";

const CONFIG = {
  roundSettings: {
    questionsPerRound: 8,
    passingScore: 7,
  },
  rewardSettings: {
    baseRubies: 5,
    fullRewardDailyWins: 3,
    reducedRewardDailyWins: 3,
    reducedRewardAmount: 2,
    practiceReward: 0,
  },
  masterySettings: {
    enabled: true,
    roundsRequired: 10,
    accuracyThreshold: 0.9,
    streakRequired: 3,
    masteryStateOnComplete: "basic_mastered",
  },
  antiSpamSettings: {
    cooldownSeconds: 120,
  },
};

const LETTERS = [
  { upper: "A", lower: "a", sound: "/a/" },
  { upper: "B", lower: "b", sound: "/b/" },
  { upper: "C", lower: "c", sound: "/k/" },
  { upper: "D", lower: "d", sound: "/d/" },
  { upper: "E", lower: "e", sound: "/e/" },
  { upper: "F", lower: "f", sound: "/f/" },
  { upper: "G", lower: "g", sound: "/g/" },
  { upper: "H", lower: "h", sound: "/h/" },
  { upper: "I", lower: "i", sound: "/i/" },
  { upper: "J", lower: "j", sound: "/j/" },
  { upper: "K", lower: "k", sound: "/k/" },
  { upper: "L", lower: "l", sound: "/l/" },
  { upper: "M", lower: "m", sound: "/m/" },
  { upper: "N", lower: "n", sound: "/n/" },
  { upper: "O", lower: "o", sound: "/o/" },
  { upper: "P", lower: "p", sound: "/p/" },
  { upper: "Q", lower: "q", sound: "/kw/" },
  { upper: "R", lower: "r", sound: "/r/" },
  { upper: "S", lower: "s", sound: "/s/" },
  { upper: "T", lower: "t", sound: "/t/" },
  { upper: "U", lower: "u", sound: "/u/" },
  { upper: "V", lower: "v", sound: "/v/" },
  { upper: "W", lower: "w", sound: "/w/" },
  { upper: "X", lower: "x", sound: "/x/" },
  { upper: "Y", lower: "y", sound: "/y/" },
  { upper: "Z", lower: "z", sound: "/z/" },
];

const state = {
  schoolId: "",
  userId: "",
  mode: "basic",
  questions: [],
  currentIndex: 0,
  score: 0,
  locked: false,
  roundComplete: false,
  weakItems: [],
  progressRef: null,
  progressData: null,
};

const els = {
  modeLabel: document.getElementById("modeLabel"),
  roundLabel: document.getElementById("roundLabel"),
  scoreLabel: document.getElementById("scoreLabel"),
  dailyWinsLabel: document.getElementById("dailyWinsLabel"),
  progressFill: document.getElementById("progressFill"),
  promptBadge: document.getElementById("promptBadge"),
  questionText: document.getElementById("questionText"),
  questionHint: document.getElementById("questionHint"),
  choiceGrid: document.getElementById("choiceGrid"),
  feedbackBox: document.getElementById("feedbackBox"),
  endCard: document.getElementById("endCard"),
  endTitle: document.getElementById("endTitle"),
  endSummary: document.getElementById("endSummary"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  practiceBtn: document.getElementById("practiceBtn"),
  basicBtn: document.getElementById("basicBtn"),
  challengeBtn: document.getElementById("challengeBtn"),
};

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickDistinct(arr, count, excludeFn = null) {
  const filtered = excludeFn ? arr.filter((x) => !excludeFn(x)) : [...arr];
  return shuffle(filtered).slice(0, count);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getModeLabel(mode) {
  if (mode === "practice") return "Practice";
  if (mode === "challenge") return "Challenge";
  return "Basic Quest";
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
    totalQuestions: 0,
    correctAnswers: 0,
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
      basic: { played: 0, passed: 0 },
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

function updateModeButtons() {
  els.practiceBtn.classList.toggle("is-active", state.mode === "practice");
  els.basicBtn.classList.toggle("is-active", state.mode === "basic");
  els.challengeBtn.classList.toggle("is-active", state.mode === "challenge");
  els.challengeBtn.disabled = !state.progressData?.challengeUnlocked;
}

function renderHud() {
  const total = CONFIG.roundSettings.questionsPerRound;
  els.modeLabel.textContent = getModeLabel(state.mode);
  els.roundLabel.textContent = `${Math.min(state.currentIndex + 1, total)} / ${total}`;
  els.scoreLabel.textContent = String(state.score);
  els.dailyWinsLabel.textContent = String(state.progressData?.daily?.rewardWins || 0);

  const pct = (state.currentIndex / total) * 100;
  els.progressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function setFeedback(msg) {
  els.feedbackBox.textContent = msg || "";
}

function showEndCard(title, summary) {
  els.endTitle.textContent = title;
  els.endSummary.textContent = summary;
  els.endCard.classList.remove("is-hidden");
}

function hideEndCard() {
  els.endCard.classList.add("is-hidden");
}

function getAccuracy(progress) {
  const totalQuestions = Number(progress?.totalQuestions || 0);
  if (!totalQuestions) return 0;
  return Number(progress.correctAnswers || 0) / totalQuestions;
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
  if (state.mode === "practice") return false;
  return secondsSinceLastReward(progress) < CONFIG.antiSpamSettings.cooldownSeconds;
}

function calculateReward({ passed, mode, progress }) {
  if (!passed) return 0;

  const rewards = CONFIG.rewardSettings;
  const masteryState = progress?.masteryState || "learning";
  const dailyWins = Number(progress?.daily?.rewardWins || 0);

  if (mode === "practice") return rewards.practiceReward || 0;

  if (masteryState === "basic_mastered" && mode === "basic") {
    return 0;
  }

  if (dailyWins < rewards.fullRewardDailyWins) {
    return rewards.baseRubies;
  }

  if (dailyWins < rewards.fullRewardDailyWins + rewards.reducedRewardDailyWins) {
    return rewards.reducedRewardAmount || 0;
  }

  return 0;
}

function buildUpperLowerQuestion() {
  const target = pickRandom(LETTERS);
  const useUpper = Math.random() < 0.5;

  if (useUpper) {
    const choices = shuffle([
      target.lower,
      ...pickDistinct(LETTERS, 3, (x) => x.lower === target.lower).map((x) => x.lower),
    ]);

    return {
      badge: "Match",
      prompt: target.upper,
      hint: "Tap the matching lowercase letter.",
      correctAnswer: target.lower,
      choices,
      trackingKey: target.upper,
    };
  }

  const choices = shuffle([
    target.upper,
    ...pickDistinct(LETTERS, 3, (x) => x.upper === target.upper).map((x) => x.upper),
  ]);

  return {
    badge: "Match",
    prompt: target.lower,
    hint: "Tap the matching uppercase letter.",
    correctAnswer: target.upper,
    choices,
    trackingKey: target.lower,
  };
}

function buildLetterNameQuestion() {
  const target = pickRandom(LETTERS);
  const choices = shuffle([
    target.upper,
    ...pickDistinct(LETTERS, 3, (x) => x.upper === target.upper).map((x) => x.upper),
  ]);

  return {
    badge: "Find the Letter",
    prompt: `Find ${target.upper}`,
    hint: "Tap the correct letter.",
    correctAnswer: target.upper,
    choices,
    trackingKey: target.upper,
  };
}

function buildSoundQuestion() {
  const target = pickRandom(LETTERS);
  const choices = shuffle([
    target.upper,
    ...pickDistinct(LETTERS, 3, (x) => x.upper === target.upper).map((x) => x.upper),
  ]);

  return {
    badge: "Letter Sound",
    prompt: `Which letter makes ${target.sound}?`,
    hint: "Tap the matching letter.",
    correctAnswer: target.upper,
    choices,
    trackingKey: target.upper,
  };
}

function buildChallengeQuestion() {
  const roll = Math.random();
  if (roll < 0.34) return buildSoundQuestion();
  if (roll < 0.67) return buildUpperLowerQuestion();

  const target = pickRandom(LETTERS);
  const choices = shuffle([
    target.lower,
    ...pickDistinct(LETTERS, 3, (x) => x.lower === target.lower).map((x) => x.lower),
  ]);

  return {
    badge: "Challenge",
    prompt: `Tap the lowercase match for ${target.upper}`,
    hint: `Bonus brain check: remember its sound ${target.sound}`,
    correctAnswer: target.lower,
    choices,
    trackingKey: target.upper,
  };
}

function generateQuestions() {
  const out = [];

  for (let i = 0; i < CONFIG.roundSettings.questionsPerRound; i += 1) {
    if (state.mode === "practice") {
      out.push(Math.random() < 0.5 ? buildUpperLowerQuestion() : buildLetterNameQuestion());
    } else if (state.mode === "challenge") {
      out.push(buildChallengeQuestion());
    } else {
      const roll = Math.random();
      if (roll < 0.34) out.push(buildUpperLowerQuestion());
      else if (roll < 0.67) out.push(buildLetterNameQuestion());
      else out.push(buildSoundQuestion());
    }
  }

  state.questions = out;
  state.currentIndex = 0;
  state.score = 0;
  state.locked = false;
  state.roundComplete = false;
  state.weakItems = [];
}

function renderQuestion() {
  hideEndCard();

  const q = state.questions[state.currentIndex];
  if (!q) return;

  els.promptBadge.textContent = q.badge;
  els.questionText.textContent = q.prompt;
  els.questionHint.textContent = q.hint || "";
  els.choiceGrid.innerHTML = "";
  setFeedback("Choose the best answer.");

  q.choices.forEach((choice) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mc-choice-btn";
    btn.textContent = choice;
    btn.addEventListener("click", () => handleChoice(choice, btn));
    els.choiceGrid.appendChild(btn);
  });

  renderHud();
}

function lockChoices() {
  state.locked = true;
  els.choiceGrid.querySelectorAll(".mc-choice-btn").forEach((btn) => {
    btn.disabled = true;
  });
}

async function handleChoice(choice, clickedBtn) {
  if (state.locked || state.roundComplete) return;

  const q = state.questions[state.currentIndex];
  const isCorrect = choice === q.correctAnswer;

  lockChoices();

  els.choiceGrid.querySelectorAll(".mc-choice-btn").forEach((btn) => {
    if (btn.textContent === q.correctAnswer) btn.classList.add("is-correct");
  });

  if (isCorrect) {
    state.score += 1;
    setFeedback("Great job! That one is correct.");
  } else {
    clickedBtn.classList.add("is-wrong");
    state.weakItems.push(q.trackingKey);
    setFeedback(`Not quite. The correct answer was ${q.correctAnswer}.`);
  }

  renderHud();
  await wait(850);

  state.currentIndex += 1;

  if (state.currentIndex >= state.questions.length) {
    state.roundComplete = true;
    await finishRound();
    return;
  }

  state.locked = false;
  renderQuestion();
}

async function awardRubiesThroughFunction(amount) {
  if (!amount || amount <= 0) {
    return { ok: true, awarded: 0 };
  }

  const currentUser = auth.currentUser;

  console.log("Alphabet Quest reward auth check:", {
    authUid: currentUser ? currentUser.uid : null,
    stateUserId: state.userId,
    schoolId: state.schoolId,
    localSchoolId: getSchoolId(),
  });

  if (!currentUser) {
    throw new Error("No signed-in Firebase user found when trying to award rubies.");
  }

  try {
    // 🔑 THIS IS THE KEY FIX
    const token = await currentUser.getIdToken();

    const response = await fetch(
      "https://us-central1-lrcquest-3039e.cloudfunctions.net/submitTransactionHttp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`, // ✅ REQUIRED
        },
        body: JSON.stringify({
          schoolId: state.schoolId,
          targetUserId: state.userId,
          actionType: "RUBIES_AWARD",
          deltaMinutes: 0,
          deltaRubies: amount,
          deltaMoneyRaisedCents: 0,
          note: "Alphabet Quest reward",
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Transaction failed");
    }

    console.log("Alphabet Quest reward success:", data);

    return {
      ok: true,
      awarded: amount,
      result: data,
    };

  } catch (err) {
    console.error("Alphabet Quest reward FAILED:", err);
    throw err;
  }
}

async function saveRoundResult() {
  const totalQuestions = CONFIG.roundSettings.questionsPerRound;
  const passed = state.score >= CONFIG.roundSettings.passingScore;

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
        mode: state.mode,
        progress: normalized,
      });

  if (rewardCandidate > 0) {
    try {
      const rewardResult = await awardRubiesThroughFunction(rewardCandidate);
      actualReward = rewardResult.awarded || 0;
    } catch (err) {
      console.error("Alphabet Quest reward FAILED:", err);
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

    const next = {
      ...normalizedInsideTx,
      totalRoundsPlayed: Number(normalizedInsideTx.totalRoundsPlayed || 0) + 1,
      totalRoundsPassed: Number(normalizedInsideTx.totalRoundsPassed || 0) + (passed ? 1 : 0),
      totalQuestions: Number(normalizedInsideTx.totalQuestions || 0) + totalQuestions,
      correctAnswers: Number(normalizedInsideTx.correctAnswers || 0) + state.score,
      currentStreak: passed ? Number(normalizedInsideTx.currentStreak || 0) + 1 : 0,
      bestStreak: Math.max(
        Number(normalizedInsideTx.bestStreak || 0),
        passed ? Number(normalizedInsideTx.currentStreak || 0) + 1 : 0
      ),
      weakItems: Array.from(
        new Set([...(normalizedInsideTx.weakItems || []), ...state.weakItems])
      ).slice(0, 20),
    };

    next.masteryState = getMasteryState(next);
    next.challengeUnlocked = next.masteryState === "basic_mastered";
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
        totalQuestions: next.totalQuestions,
        correctAnswers: next.correctAnswers,
        currentStreak: next.currentStreak,
        bestStreak: next.bestStreak,
        masteryState: next.masteryState,
        challengeUnlocked: next.challengeUnlocked,
        lifetimeRubiesEarned: next.lifetimeRubiesEarned,
        daily: next.daily,
        modeStats: {
          ...normalizedInsideTx.modeStats,
          [state.mode]: {
            played: Number(normalizedInsideTx?.modeStats?.[state.mode]?.played || 0) + 1,
            passed: Number(normalizedInsideTx?.modeStats?.[state.mode]?.passed || 0) + (passed ? 1 : 0),
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
        [state.mode]: {
          played: Number(normalizedInsideTx?.modeStats?.[state.mode]?.played || 0) + 1,
          passed: Number(normalizedInsideTx?.modeStats?.[state.mode]?.passed || 0) + (passed ? 1 : 0),
        },
      },
    };
  });

  state.progressData = nextProgressData;

  return {
    passed,
    reward: actualReward,
    cooldownBlocked,
    masteryState: state.progressData.masteryState,
    challengeUnlocked: state.progressData.challengeUnlocked,
    rewardError,
  };
}

async function finishRound() {
  els.progressFill.style.width = "100%";

  let result;

  try {
    result = await saveRoundResult();
  } catch (err) {
    console.error("finishRound failed:", err);
    showEndCard(
      "Reward Error",
      "You finished the round, but there was a problem saving progress or sending the ruby reward."
    );
    return;
  }

  let summary = `You scored ${state.score} out of ${CONFIG.roundSettings.questionsPerRound}.`;

  if (result.passed) {
    if (result.reward > 0) {
      summary += ` You earned ${result.reward} rubies!`;
    } else if (result.rewardError) {
      summary += " You passed, but the ruby award did not go through because the page was not authenticated correctly.";
    } else if (result.cooldownBlocked) {
      summary += " You passed, but ruby rewards are cooling down right now.";
    } else if (state.mode === "practice") {
      summary += " Practice mode is for learning, so no rubies this round.";
    } else if (result.masteryState === "basic_mastered" && state.mode === "basic") {
      summary += " You mastered Basic Quest! Play Challenge mode to keep earning rubies.";
    } else {
      summary += " Nice work! No rubies were awarded this round.";
    }
  } else {
    summary += " Try again to earn rubies.";
  }

  updateModeButtons();
  renderHud();
  showEndCard(result.passed ? "Round Complete!" : "Keep Practicing!", summary);
}

async function startRound() {
  if (state.mode === "challenge" && !state.progressData?.challengeUnlocked) {
    showEndCard("Challenge Locked", "Challenge mode unlocks after mastering Basic Quest.");
    return;
  }

  generateQuestions();
  updateModeButtons();
  renderHud();
  renderQuestion();
}

function switchMode(mode) {
  state.mode = mode;
  startRound();
}

async function refreshReadathonSummaryIfNeeded() {
  try {
    await getDoc(userSummaryRef(state.schoolId, state.userId));
  } catch (err) {
    console.warn("Could not refresh summary after reward:", err);
  }
}

function bindEvents() {
  els.practiceBtn.addEventListener("click", () => switchMode("practice"));
  els.basicBtn.addEventListener("click", () => switchMode("basic"));
  els.challengeBtn.addEventListener("click", () => switchMode("challenge"));
  els.playAgainBtn.addEventListener("click", async () => {
    await refreshReadathonSummaryIfNeeded();
    startRound();
  });
}

async function initForUser(user) {
  if (!user) {
    showEndCard("Not Signed In", "Please sign in before playing Alphabet Quest.");
    return;
  }

  state.userId = user.uid;
  state.schoolId = getSchoolId();

  console.log("Alphabet Quest initForUser:", {
    uid: user.uid,
    schoolId: state.schoolId,
  });

  if (!state.schoolId) {
    showEndCard("Missing School ID", "Could not find schoolId for this session.");
    return;
  }

  await getOrCreateProgress();
  updateModeButtons();
  renderHud();
  await startRound();
}

bindEvents();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showEndCard("Not Signed In", "Please sign in before playing Alphabet Quest.");
    return;
  }

  try {
    await initForUser(user);
  } catch (err) {
    console.error("Alphabet Quest failed to load:", err);
    showEndCard("Game Error", err?.message || "Something went wrong while loading.");
  }
});