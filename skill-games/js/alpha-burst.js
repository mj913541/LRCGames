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
  feedbackBadge: document.getElementById("feedbackBadge"),
  rewardHint: document.getElementById("rewardHint"),
  helperText: document.getElementById("helperText"),
  promptType: document.getElementById("promptType"),
  promptText: document.getElementById("promptText"),
  playfield: document.getElementById("playfield"),
  startRoundBtn: document.getElementById("startRoundBtn"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  summaryCard: document.getElementById("summaryCard"),
  summaryText: document.getElementById("summaryText"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  fxLayer: document.getElementById("fxLayer")
};

const state = {
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
  frameCount: 0
};

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
      prompt: `Tap all lowercase matches for: ${pair.upper}`,
      targetItems: Array(8).fill(pair.lower),
      decoyItems: lowercaseDecoys
    });

    const uppercaseDecoys = pickRandomItems(
      LETTER_PAIRS
        .filter((item) => item.upper !== pair.upper)
        .map((item) => item.upper),
      14
    );

    rounds.push({
      prompt: `Tap all uppercase matches for: ${pair.lower}`,
      targetItems: Array(8).fill(pair.upper),
      decoyItems: uppercaseDecoys
    });
  });

  return shuffleArray(rounds);
}

const ROUND_BANK = buildRoundBank();

function chooseRounds(mode) {
  return shuffleArray(ROUND_BANK).slice(0, mode.totalRounds);
}

function styleCenterNextButton() {
  els.nextRoundBtn.textContent = "Next Round ✨";
  Object.assign(els.nextRoundBtn.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%) scale(1)",
    zIndex: "200",
    minWidth: "240px",
    minHeight: "72px",
    padding: "18px 28px",
    fontSize: "1.45rem",
    fontWeight: "800",
    borderRadius: "999px",
    boxShadow: "0 18px 38px rgba(90, 60, 160, 0.28)",
    display: "none",
    opacity: "0",
    transition: "opacity 180ms ease, transform 180ms ease"
  });
}

function showCenterNextButton() {
  els.nextRoundBtn.disabled = false;
  els.nextRoundBtn.style.display = "inline-flex";
  els.nextRoundBtn.style.alignItems = "center";
  els.nextRoundBtn.style.justifyContent = "center";

  requestAnimationFrame(() => {
    els.nextRoundBtn.style.opacity = "1";
    els.nextRoundBtn.style.transform = "translate(-50%, -50%) scale(1.06)";
  });
}

function hideCenterNextButton() {
  els.nextRoundBtn.disabled = true;
  els.nextRoundBtn.style.opacity = "0";
  els.nextRoundBtn.style.transform = "translate(-50%, -50%) scale(0.92)";

  window.setTimeout(() => {
    if (els.nextRoundBtn.disabled) {
      els.nextRoundBtn.style.display = "none";
    }
  }, 180);
}

function setMode(modeKey) {
  state.mode = MODES[modeKey] || MODES.quest;

  els.practiceBtn.classList.toggle("is-active", modeKey === "practice");
  els.questBtn.classList.toggle("is-active", modeKey === "quest");
  els.challengeBtn.classList.toggle("is-active", modeKey === "challenge");

  resetGame();
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

  els.playfield.innerHTML = "";
  els.summaryCard.hidden = true;
  els.startRoundBtn.disabled = false;
  hideCenterNextButton();

  els.feedbackBadge.textContent = "Ready!";
  els.feedbackBadge.classList.remove("is-correct", "is-wrong");
  els.rewardHint.textContent = `+${state.mode.rewardPerTap} per tap • combo boosts rewards`;
  els.helperText.textContent = "Press Start Round when you're ready.";

  renderRoundIntro();
  updateStats();
}

function renderRoundIntro() {
  const round = state.rounds[state.roundIndex];

  if (!round) {
    finishGame();
    return;
  }

  state.currentRound = round;
  state.roundStarted = false;
  state.roundFinished = false;
  state.combo = 0;
  state.targetsRemaining = Math.min(state.mode.targetCount, round.targetItems.length);
  state.timerSecondsLeft = state.mode.timeLimit || 0;
  state.frameCount = 0;

  els.playfield.innerHTML = "";
  els.playfield.appendChild(els.nextRoundBtn);
  hideCenterNextButton();

  els.promptType.textContent = "Letter Match";
  els.promptText.textContent = round.prompt;
  els.timerLabel.textContent = state.mode.timeLimit ? String(state.timerSecondsLeft) : "∞";
  els.startRoundBtn.disabled = false;
  els.helperText.textContent = "Press Start Round to release the bubbles.";
  els.feedbackBadge.textContent = "Ready!";
  els.feedbackBadge.classList.remove("is-correct", "is-wrong");

  updateStats();
}

function updateStats() {
  els.modeLabel.textContent = state.mode.label;
  els.roundLabel.textContent = `${Math.min(state.roundIndex + 1, state.mode.totalRounds)} / ${state.mode.totalRounds}`;
  els.scoreLabel.textContent = String(state.score);
  els.streakLabel.textContent = String(state.streak);
  els.rubiesLabel.textContent = String(state.rubies);

  if (!state.mode.timeLimit) {
    els.timerLabel.textContent = "∞";
  } else if (!state.roundStarted && !state.roundFinished) {
    els.timerLabel.textContent = String(state.mode.timeLimit);
  } else {
    els.timerLabel.textContent = String(Math.max(0, state.timerSecondsLeft));
  }

  const progressPercent = state.mode.totalRounds
    ? (state.roundIndex / state.mode.totalRounds) * 100
    : 0;

  els.progressFill.style.width = `${Math.max(0, Math.min(100, progressPercent))}%`;
}

function startRound() {
  if (!state.currentRound || state.roundStarted) return;

  state.roundStarted = true;
  state.roundFinished = false;
  state.roundStartTime = performance.now();
  state.combo = 0;
  state.frameCount = 0;

  els.startRoundBtn.disabled = true;
  hideCenterNextButton();

  els.feedbackBadge.textContent = "Go!";
  els.feedbackBadge.classList.remove("is-correct", "is-wrong");
  els.helperText.textContent = "Tap every correct bubble fast.";

  createBubblesForRound(state.currentRound);
  startAnimation();

  if (state.mode.timeLimit > 0) {
    startTimer();
  }

  updateStats();
}

function createBubblesForRound(round) {
  els.playfield.innerHTML = "";
  els.playfield.appendChild(els.nextRoundBtn);
  hideCenterNextButton();

  state.activeBubbles = [];

  const targetItems = round.targetItems.slice(0, state.mode.targetCount);
  const decoyItems = round.decoyItems.slice(0, state.mode.decoyCount);

  const allItems = [
    ...targetItems.map((text) => ({ text, isTarget: true, isGolden: false })),
    ...decoyItems.map((text) => ({ text, isTarget: false, isGolden: false }))
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
    showFloatingText(`🔥 COMBO x2 🔥`, {
      big: true,
      duration: 1600,
      fontSize: "2.5rem"
    });
  }

  bubbleObj.el.remove();

  onRewardEarned({
    mode: state.mode.key,
    reward,
    source: wasGolden ? "golden_tap" : "tap",
    roundIndex: state.roundIndex
  });

  if (state.targetsRemaining <= 0) {
    finishRound(true);
    return;
  }

  els.feedbackBadge.textContent = comboTriggered ? "Combo! 🔥" : "Nice! ✨";
  els.feedbackBadge.classList.remove("is-wrong");
  els.feedbackBadge.classList.add("is-correct");

  const comboText = state.combo >= 5 ? ` • Combo x2 active` : "";
  els.helperText.textContent = `${state.targetsRemaining} correct bubble${state.targetsRemaining === 1 ? "" : "s"} left${comboText}.`;

  updateStats();
}

function handleWrongTap(bubbleObj) {
  bubbleObj.el.classList.add("is-wrong-hit");
  state.streak = 0;
  state.combo = 0;

  els.feedbackBadge.textContent = "Oops!";
  els.feedbackBadge.classList.remove("is-correct");
  els.feedbackBadge.classList.add("is-wrong");
  els.helperText.textContent = "That one is a decoy. Combo reset.";

  const playfield = els.playfield;
  playfield.classList.remove("ab-shake");
  void playfield.offsetWidth;
  playfield.classList.add("ab-shake");

  window.setTimeout(() => {
    bubbleObj.el.classList.remove("is-wrong-hit");
  }, 180);

  updateStats();
}

function finishRound(cleared) {
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

    els.feedbackBadge.textContent = "Round Clear! 🎉";
    els.feedbackBadge.classList.remove("is-wrong");
    els.feedbackBadge.classList.add("is-correct");
    els.helperText.textContent = `Cleared in ${elapsedSeconds.toFixed(1)}s • Bonus shower!`;

    rubyShower(bonus);
    burstEffectCenter(18);

    onRewardEarned({
      mode: state.mode.key,
      reward: bonus,
      source: "clear_bonus",
      roundIndex: state.roundIndex
    });
  } else {
    state.streak = 0;
    state.combo = 0;
    els.feedbackBadge.textContent = "Time's Up!";
    els.feedbackBadge.classList.remove("is-correct");
    els.feedbackBadge.classList.add("is-wrong");
    els.helperText.textContent = "Try the next burst.";
  }

  els.startRoundBtn.disabled = true;
  showCenterNextButton();
  updateStats();

  if (state.mode.key === "challenge") {
    window.setTimeout(() => {
      goNextRound();
    }, 850);
  }
}

function goNextRound() {
  if (!state.roundFinished) return;

  state.roundIndex += 1;

  if (state.roundIndex >= state.mode.totalRounds) {
    finishGame();
    return;
  }

  renderRoundIntro();
}

function finishGame() {
  stopTimer();
  stopAnimation();

  els.playfield.innerHTML = "";
  els.playfield.appendChild(els.nextRoundBtn);
  hideCenterNextButton();

  els.progressFill.style.width = "100%";
  els.promptType.textContent = "Complete!";
  els.promptText.textContent = "Amazing burst work!";
  els.feedbackBadge.textContent = "Game Complete 🎉";
  els.feedbackBadge.classList.remove("is-wrong");
  els.feedbackBadge.classList.add("is-correct");
  els.helperText.textContent = "Press Play Again to start over.";
  els.startRoundBtn.disabled = true;

  els.summaryText.textContent =
    `You popped ${state.score} correct bubbles and earned ${state.rubies} rubies.`;

  els.summaryCard.hidden = false;
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
      finishRound(false);
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
        isGolden
      }
    : {
        text: randomFrom(state.currentRound.decoyItems),
        isTarget: false,
        isGolden: false
      };

  const bubbleObj = makeBubbleObject(item, state.activeBubbles.length + 20);
  bubbleObj.el.addEventListener("click", () => handleBubbleTap(bubbleObj));

  els.playfield.appendChild(bubbleObj.el);
  state.activeBubbles.push(bubbleObj);

  if (shouldSpawnTarget) {
    state.targetsRemaining += 1;
  }
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

function onRewardEarned(payload) {
  console.log("Reward earned:", payload);

  // Later:
  // fnSubmitTransaction({
  //   schoolId,
  //   targetUserId,
  //   actionType: "RUBIES_AWARD",
  //   deltaRubies: payload.reward,
  //   deltaMinutes: 0,
  //   deltaMoneyRaisedCents: 0,
  //   note: `Alphabet Burst ${payload.source}`
  // });
}

els.practiceBtn.addEventListener("click", () => setMode("practice"));
els.questBtn.addEventListener("click", () => setMode("quest"));
els.challengeBtn.addEventListener("click", () => setMode("challenge"));
els.startRoundBtn.addEventListener("click", startRound);
els.nextRoundBtn.addEventListener("click", goNextRound);
els.playAgainBtn.addEventListener("click", resetGame);

window.addEventListener("resize", () => {
  if (state.roundStarted && !state.roundFinished) {
    const currentRound = state.currentRound;
    const oldTargetsRemaining = state.targetsRemaining;

    stopAnimation();
    createBubblesForRound(currentRound);
    state.targetsRemaining = oldTargetsRemaining;
    startAnimation();
  }
});

styleCenterNextButton();
resetGame();