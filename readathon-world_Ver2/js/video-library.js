import {
  auth,
  db,
  getSchoolId,
  waitForAuthReady,
  getIdTokenClaims,
  fnSubmitTransaction,
} from "./firebase.js";

import {
  setHeaderUser,
  wireSignOut,
  normalizeError,
} from "./app.js";

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* --------------------------------------------------
   PAGE CONFIG
-------------------------------------------------- */

const PAGE_TITLE = "Video Library";
const PAGE_SUBTITLE = "Watch videos and earn rubies";

const VIDEO_ITEMS = [
  {
    key: "video_01",
    title: "The Smart Cookie",
    youtubeId: "LJq-7-wycqY",
    youtubeUrl: "https://youtu.be/LJq-7-wycqY",
    rubies: 10,
    image: "../img/book-bracket/the-smart-cookie.jpg",
  },
  {
    key: "video_02",
    title: "The Couch Potato",
    youtubeId: "qfwF75e4BYc",
    youtubeUrl: "https://youtu.be/qfwF75e4BYc",
    rubies: 10,
    image: "../img/book-bracket/the-couch-potato.jpg",
  },
  {
    key: "video_03",
    title: "The Sour Grape",
    youtubeId: "QZn1SCPtOw4",
    youtubeUrl: "https://youtu.be/QZn1SCPtOw4",
    rubies: 10,
    image: "../img/book-bracket/the-sour-grape.jpg",
  },
  {
    key: "video_04",
    title: "The Big Cheese",
    youtubeId: "8X0x7mqwJiU",
    youtubeUrl: "https://youtu.be/8X0x7mqwJiU",
    rubies: 10,
    image: "../img/book-bracket/the-big-cheese.jpg",
  },
  {
    key: "video_05",
    title: "We Don't Eat Our Classmates",
    youtubeId: "th6exRnPixg",
    youtubeUrl: "https://youtu.be/th6exRnPixg",
    rubies: 10,
    image: "../img/book-bracket/we-dont-eat-our-classmates.jpg",
  },
  {
    key: "video_06",
    title: "Knight Owl",
    youtubeId: "503VhkZAEfw",
    youtubeUrl: "https://youtu.be/503VhkZAEfw",
    rubies: 10,
    image: "../img/book-bracket/knight-owl.jpg",
  },
  {
    key: "video_07",
    title: "Dragons Love Tacos",
    youtubeId: "JYy9gbv44QE",
    youtubeUrl: "https://youtu.be/JYy9gbv44QE",
    rubies: 10,
    image: "../img/book-bracket/dragons-love-tacos.jpg",
  },
  {
    key: "video_08",
    title: "How to Catch a Snowman",
    youtubeId: "Xtd-mTRcu7U",
    youtubeUrl: "https://youtu.be/Xtd-mTRcu7U",
    rubies: 10,
    image: "../img/book-bracket/how-to-catch-a-snowman.jpg",
  },
  {
    key: "video_09",
    title: "Gym Teacher from the Black Lagoon",
    youtubeId: "AR9oL1YfpRU",
    youtubeUrl: "https://youtu.be/AR9oL1YfpRU",
    rubies: 10,
    image: "../img/book-bracket/gym-teacher-black-lagoon.jpg",
  },
  {
    key: "video_10",
    title: "Music Teacher from the Black Lagoon",
    youtubeId: "7-s0hcwQOaE",
    youtubeUrl: "https://youtu.be/7-s0hcwQOaE",
    rubies: 10,
    image: "../img/book-bracket/music-teacher-black-lagoon.jpg",
  },
  {
    key: "video_11",
    title: "Librarian from the Black Lagoon",
    youtubeId: "ZOZ7ExGHsCw",
    youtubeUrl: "https://youtu.be/ZOZ7ExGHsCw",
    rubies: 10,
    image: "../img/book-bracket/librarian-black-lagoon.jpg",
  },
  {
    key: "video_12",
    title: "Class Pet from the Black Lagoon",
    youtubeId: "r54lszFx_8g",
    youtubeUrl: "https://youtu.be/r54lszFx_8g",
    rubies: 10,
    image: "../img/book-bracket/class-pet-black-lagoon.jpg",
  },
  {
    key: "video_13",
    title: "Pig the Star",
    youtubeId: "Ic_Ar31iFwA",
    youtubeUrl: "https://youtu.be/Ic_Ar31iFwA",
    rubies: 10,
    image: "../img/book-bracket/pig-the-star.jpg",
  },
  {
    key: "video_14",
    title: "Pig the Stinker",
    youtubeId: "OSaC4JBsOjE",
    youtubeUrl: "https://youtu.be/OSaC4JBsOjE",
    rubies: 10,
    image: "../img/book-bracket/pig-the-stinker.jpg",
  },
  {
    key: "video_15",
    title: "Pig the Winner",
    youtubeId: "7Zhzv3RfqGM",
    youtubeUrl: "https://youtu.be/7Zhzv3RfqGM",
    rubies: 10,
    image: "../img/book-bracket/pig-the-winner.jpg",
  },
  {
    key: "video_16",
    title: "Pig the Slob",
    youtubeId: "S5UA0LajxOE",
    youtubeUrl: "https://youtu.be/S5UA0LajxOE",
    rubies: 10,
    image: "../img/book-bracket/pig-the-slob.jpg",
  },
];

const MIN_WATCH_PERCENT = 90;
const MAX_ALLOWED_FORWARD_JUMP_SECONDS = 8;
const SAVE_PROGRESS_EVERY_MS = 5000;

/* --------------------------------------------------
   ELEMENTS
-------------------------------------------------- */

const els = {
  hdr: document.getElementById("hdr"),
  btnSignOut: document.getElementById("btnSignOut"),

  videoGrid: document.getElementById("videoGrid"),
  completedCount: document.getElementById("completedCount"),
  earnedRubies: document.getElementById("earnedRubies"),
  currentVideoStatus: document.getElementById("currentVideoStatus"),

  videoModal: document.getElementById("videoModal"),
  btnCloseVideoModal: document.getElementById("btnCloseVideoModal"),
  videoModalTitle: document.getElementById("videoModalTitle"),
  videoModalMeta: document.getElementById("videoModalMeta"),
  watchProgressText: document.getElementById("watchProgressText"),
  watchRewardText: document.getElementById("watchRewardText"),
};

let schoolId = null;
let userId = null;
let claims = null;

let player = null;
let playerReadyResolver = null;
const playerReadyPromise = new Promise((resolve) => {
  playerReadyResolver = resolve;
});

let activeVideo = null;
let activeVideoProgress = null;

let duration = 0;
let lastTime = 0;
let watchedSeconds = new Set();
let suspiciousSkips = 0;
let trackingIntervalId = null;
let saveIntervalId = null;
let modalLastFocus = null;

const progressByVideoKey = new Map();

/* --------------------------------------------------
   INIT
-------------------------------------------------- */

init().catch((error) => {
  console.error("video-library init failed:", error);
  if (els.currentVideoStatus) {
    els.currentVideoStatus.textContent = normalizeError(error);
  }
});

async function init() {
  await waitForAuthReady();

  if (!auth.currentUser) {
    window.location.href = "../index.html";
    return;
  }

  claims = await getIdTokenClaims(false);
  if (!claims?.role) {
    claims = await getIdTokenClaims(true);
  }

  schoolId = claims?.schoolId || getSchoolId();
  userId = claims?.userId || auth.currentUser?.uid || null;

  if (!schoolId || !userId) {
    throw new Error("Missing schoolId or userId.");
  }

  setHeaderUser(els.hdr, {
    title: PAGE_TITLE,
    subtitle: PAGE_SUBTITLE,
  });

  wireSignOut(els.btnSignOut);

  await loadAllProgress();
  renderVideoGrid();
  renderStats();
  wireModal();
  updateLiveStatus();
}

/* --------------------------------------------------
   YOUTUBE API READY
-------------------------------------------------- */

window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player("ytPlayer", {
    width: "100%",
    height: "100%",
    videoId: "",
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      enablejsapi: 1,
      origin: window.location.origin,
    },
    events: {
      onReady: () => {
        if (playerReadyResolver) playerReadyResolver();
      },
      onStateChange: onPlayerStateChange,
    },
  });
};

/* --------------------------------------------------
   PATH HELPERS
-------------------------------------------------- */

function schoolRootPath() {
  return `readathonV2_schools/${schoolId}`;
}

function videoLibrarySummaryPath() {
  return `${schoolRootPath()}/users/${userId}/videoLibrary/summary`;
}

function videoProgressCollectionPath() {
  return `${schoolRootPath()}/users/${userId}/videoProgress`;
}

function videoProgressPath(videoKey) {
  return `${videoProgressCollectionPath()}/${videoKey}`;
}

/* --------------------------------------------------
   LOAD DATA
-------------------------------------------------- */

async function loadAllProgress() {
  const qRef = query(collection(db, videoProgressCollectionPath()));
  const snap = await getDocs(qRef);

  progressByVideoKey.clear();

  for (const docSnap of snap.docs) {
    progressByVideoKey.set(docSnap.id, {
      id: docSnap.id,
      ...docSnap.data(),
    });
  }
}

/* --------------------------------------------------
   RENDER
-------------------------------------------------- */

function renderVideoGrid() {
  if (!els.videoGrid) return;

  els.videoGrid.innerHTML = "";

  for (const item of VIDEO_ITEMS) {
    const progress = progressByVideoKey.get(item.key) || {};
    const completed = !!progress.completed;
    const watchPercent = clampPercent(progress.watchPercent || 0);

    const card = document.createElement("button");
    card.type = "button";
    card.className = "videoCard";
    card.dataset.videoKey = item.key;
    card.setAttribute("aria-label", `Open ${item.title}`);

    const pillClass = completed
      ? "videoStatusPill isComplete"
      : watchPercent > 0
      ? "videoStatusPill isWatching"
      : "videoStatusPill";

    const pillText = completed
      ? "Completed"
      : watchPercent > 0
      ? `${watchPercent}% watched`
      : "Not started";

    card.innerHTML = `
      <div class="videoThumbWrap">
        <img class="videoThumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />
        <span class="videoPlayBadge">▶</span>
      </div>

      <div class="videoCardBody">
        <h3 class="videoCardTitle">${escapeHtml(item.title)}</h3>
        <div class="videoCardMeta">
          <span class="${pillClass}">${pillText}</span>
          <span>${Number(item.rubies || 0)} rubies</span>
        </div>
        <div class="videoRewardTag">
          ${completed ? "Reward already earned" : "Reward available"}
        </div>
      </div>
    `;

    card.addEventListener("click", () => openVideoModal(item));
    els.videoGrid.appendChild(card);
  }
}

function renderStats() {
  const completedCount = [...progressByVideoKey.values()].filter((x) => x.completed).length;
  const earnedRubies = [...progressByVideoKey.values()].reduce(
    (sum, x) => sum + Number(x.rubiesAwarded || 0),
    0
  );

  if (els.completedCount) els.completedCount.textContent = String(completedCount);
  if (els.earnedRubies) els.earnedRubies.textContent = String(earnedRubies);
}

function updateLiveStatus() {
  if (!els.currentVideoStatus || !els.watchProgressText || !els.watchRewardText) return;

  if (!activeVideo || !activeVideoProgress) {
    els.currentVideoStatus.textContent = "Not watching";
    els.watchProgressText.textContent = "0%";
    els.watchRewardText.textContent = "Not earned yet";
    return;
  }

  const pct = clampPercent(activeVideoProgress.watchPercent || 0);
  els.currentVideoStatus.textContent = activeVideo.title;
  els.watchProgressText.textContent = `${pct}%`;
  els.watchRewardText.textContent = activeVideoProgress.completed
    ? `${activeVideoProgress.rubiesAwarded || activeVideo.rubies} rubies earned`
    : "Not earned yet";
}

/* --------------------------------------------------
   MODAL
-------------------------------------------------- */

function wireModal() {
  els.btnCloseVideoModal?.addEventListener("click", () => {
    closeVideoModal().catch(console.error);
  });

  els.videoModal?.addEventListener("click", (event) => {
    if (event.target?.matches("[data-close-modal]")) {
      closeVideoModal().catch(console.error);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.videoModal && !els.videoModal.classList.contains("isHidden")) {
      closeVideoModal().catch(console.error);
    }
  });
}

async function openVideoModal(item) {
  modalLastFocus = document.activeElement;
  activeVideo = item;

  const existing = progressByVideoKey.get(item.key) || null;
  activeVideoProgress = buildLocalProgress(item, existing);

  els.videoModal?.classList.remove("isHidden");
  els.videoModal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modalOpen");

  if (els.videoModalTitle) els.videoModalTitle.textContent = item.title;
  if (els.videoModalMeta) els.videoModalMeta.textContent = `${item.rubies} rubies available`;

  updateLiveStatus();

  await playerReadyPromise;
  resetTrackingStateFromProgress(activeVideoProgress);

  player.loadVideoById({
    videoId: item.youtubeId,
    startSeconds: Number(activeVideoProgress.resumeAtSeconds || 0),
  });

  requestAnimationFrame(() => {
    els.btnCloseVideoModal?.focus();
  });
}

async function closeVideoModal() {
  stopTracking();
  await saveActiveProgress();

  if (player?.stopVideo) {
    player.stopVideo();
  }

  activeVideo = null;
  activeVideoProgress = null;
  duration = 0;
  lastTime = 0;
  watchedSeconds = new Set();
  suspiciousSkips = 0;

  els.videoModal?.classList.add("isHidden");
  els.videoModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modalOpen");

  updateLiveStatus();

  if (modalLastFocus && typeof modalLastFocus.focus === "function") {
    modalLastFocus.focus();
  }
}

/* --------------------------------------------------
   TRACKING
-------------------------------------------------- */

function onPlayerStateChange(event) {
  if (!activeVideo || !activeVideoProgress) return;

  if (event.data === YT.PlayerState.PLAYING) {
    duration = Math.floor(player.getDuration() || 0);
    startTracking();
  }

  if (event.data === YT.PlayerState.PAUSED) {
    stopTracking();
    saveActiveProgress().catch(console.error);
  }

  if (event.data === YT.PlayerState.ENDED) {
    stopTracking();
    handleVideoEnded().catch(console.error);
  }
}

function startTracking() {
  stopTracking();

  trackingIntervalId = window.setInterval(() => {
    if (!player || !activeVideo || !activeVideoProgress) return;

    const currentTime = Math.floor(player.getCurrentTime() || 0);
    duration = Math.floor(player.getDuration() || duration || 0);

    if (currentTime > 0) {
      watchedSeconds.add(currentTime);
      activeVideoProgress.resumeAtSeconds = currentTime;
    }

    const jump = currentTime - lastTime;
    if (lastTime > 0 && jump > MAX_ALLOWED_FORWARD_JUMP_SECONDS + 1) {
      suspiciousSkips += 1;
    }

    lastTime = currentTime;

    activeVideoProgress.durationSeconds = duration;
    activeVideoProgress.watchedSecondCount = watchedSeconds.size;
    activeVideoProgress.watchPercent = computeWatchPercent(watchedSeconds.size, duration);
    activeVideoProgress.suspiciousSkips = suspiciousSkips;

    updateLiveStatus();
  }, 1000);

  saveIntervalId = window.setInterval(() => {
    saveActiveProgress().catch(console.error);
  }, SAVE_PROGRESS_EVERY_MS);
}

function stopTracking() {
  if (trackingIntervalId) {
    window.clearInterval(trackingIntervalId);
    trackingIntervalId = null;
  }

  if (saveIntervalId) {
    window.clearInterval(saveIntervalId);
    saveIntervalId = null;
  }
}

async function handleVideoEnded() {
  if (!activeVideo || !activeVideoProgress) return;

  activeVideoProgress.durationSeconds = Math.floor(player.getDuration() || duration || 0);
  activeVideoProgress.watchedSecondCount = watchedSeconds.size;
  activeVideoProgress.watchPercent = computeWatchPercent(
    watchedSeconds.size,
    activeVideoProgress.durationSeconds
  );
  activeVideoProgress.resumeAtSeconds = activeVideoProgress.durationSeconds;
  activeVideoProgress.suspiciousSkips = suspiciousSkips;

  const validWatch =
    activeVideoProgress.watchPercent >= MIN_WATCH_PERCENT &&
    Number(activeVideoProgress.suspiciousSkips || 0) === 0;

  if (validWatch && !activeVideoProgress.completed) {
    await awardVideoCompletion(activeVideo, activeVideoProgress);
  } else {
    await saveActiveProgress();
  }

  renderVideoGrid();
  renderStats();
  updateLiveStatus();
}

/* --------------------------------------------------
   WRITES
-------------------------------------------------- */

async function saveActiveProgress() {
  if (!activeVideo || !activeVideoProgress) return;

  const ref = doc(db, videoProgressPath(activeVideo.key));

  const payload = {
    videoKey: activeVideo.key,
    youtubeId: activeVideo.youtubeId,
    youtubeUrl: activeVideo.youtubeUrl || "",
    title: activeVideo.title,
    rubiesPlanned: Number(activeVideo.rubies || 0),
    watchPercent: clampPercent(activeVideoProgress.watchPercent || 0),
    watchedSecondCount: Number(activeVideoProgress.watchedSecondCount || 0),
    durationSeconds: Number(activeVideoProgress.durationSeconds || 0),
    resumeAtSeconds: Number(activeVideoProgress.resumeAtSeconds || 0),
    suspiciousSkips: Number(activeVideoProgress.suspiciousSkips || 0),
    completed: !!activeVideoProgress.completed,
    rubiesAwarded: Number(activeVideoProgress.rubiesAwarded || 0),
    lastWatchedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });

  progressByVideoKey.set(activeVideo.key, {
    ...(progressByVideoKey.get(activeVideo.key) || {}),
    ...payload,
  });
}

async function awardVideoCompletion(item, progress) {
  const existing = progressByVideoKey.get(item.key) || {};
  if (existing.completed) {
    progress.completed = true;
    progress.rubiesAwarded = Number(existing.rubiesAwarded || item.rubies || 0);
    progress.watchPercent = Math.max(
      clampPercent(existing.watchPercent || 0),
      clampPercent(progress.watchPercent || 0),
      MIN_WATCH_PERCENT
    );
    return;
  }

  await fnSubmitTransaction({
    schoolId,
    targetUserId: userId,
    actionType: "RUBIES_AWARD",
    deltaMinutes: 0,
    deltaRubies: Number(item.rubies || 0),
    deltaMoneyRaisedCents: 0,
    note: `Video reward: ${item.title}`.slice(0, 300),
  });

  progress.completed = true;
  progress.rubiesAwarded = Number(item.rubies || 0);
  progress.watchPercent = Math.max(
    clampPercent(progress.watchPercent || 0),
    MIN_WATCH_PERCENT
  );

  await setDoc(
    doc(db, videoProgressPath(item.key)),
    {
      videoKey: item.key,
      youtubeId: item.youtubeId,
      youtubeUrl: item.youtubeUrl || "",
      title: item.title,
      rubiesPlanned: Number(item.rubies || 0),
      watchPercent: progress.watchPercent,
      watchedSecondCount: Number(progress.watchedSecondCount || 0),
      durationSeconds: Number(progress.durationSeconds || 0),
      resumeAtSeconds: Number(progress.resumeAtSeconds || 0),
      suspiciousSkips: Number(progress.suspiciousSkips || 0),
      completed: true,
      completedAt: serverTimestamp(),
      rubiesAwarded: Number(item.rubies || 0),
      lastWatchedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const nextMap = new Map(progressByVideoKey);
  nextMap.set(item.key, {
    ...(nextMap.get(item.key) || {}),
    videoKey: item.key,
    youtubeId: item.youtubeId,
    youtubeUrl: item.youtubeUrl || "",
    title: item.title,
    rubiesPlanned: Number(item.rubies || 0),
    watchPercent: progress.watchPercent,
    watchedSecondCount: Number(progress.watchedSecondCount || 0),
    durationSeconds: Number(progress.durationSeconds || 0),
    resumeAtSeconds: Number(progress.resumeAtSeconds || 0),
    suspiciousSkips: Number(progress.suspiciousSkips || 0),
    completed: true,
    rubiesAwarded: Number(item.rubies || 0),
  });

  const completedCount = [...nextMap.values()].filter((x) => x.completed).length;
  const totalRubiesAwarded = [...nextMap.values()].reduce(
    (sum, x) => sum + Number(x.rubiesAwarded || 0),
    0
  );

  await setDoc(
    doc(db, videoLibrarySummaryPath()),
    {
      completedVideos: completedCount,
      totalRubiesAwarded,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  progressByVideoKey.clear();
  for (const [k, v] of nextMap.entries()) {
    progressByVideoKey.set(k, v);
  }
}

/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */

function buildLocalProgress(item, existing = null) {
  return {
    videoKey: item.key,
    youtubeId: item.youtubeId,
    youtubeUrl: item.youtubeUrl || "",
    title: item.title,
    rubiesPlanned: Number(item.rubies || 0),
    watchPercent: Number(existing?.watchPercent || 0),
    watchedSecondCount: Number(existing?.watchedSecondCount || 0),
    durationSeconds: Number(existing?.durationSeconds || 0),
    resumeAtSeconds: Number(existing?.resumeAtSeconds || 0),
    suspiciousSkips: Number(existing?.suspiciousSkips || 0),
    completed: !!existing?.completed,
    rubiesAwarded: Number(existing?.rubiesAwarded || 0),
  };
}

function resetTrackingStateFromProgress(progress) {
  duration = Number(progress.durationSeconds || 0);
  lastTime = Number(progress.resumeAtSeconds || 0);
  suspiciousSkips = 0;

  watchedSeconds = new Set();

  const priorSeconds = Number(progress.watchedSecondCount || 0);
  for (let i = 1; i <= priorSeconds; i += 1) {
    watchedSeconds.add(i);
  }
}

function computeWatchPercent(watchedCount, totalDuration) {
  if (!totalDuration || totalDuration <= 0) return 0;
  return Math.min(100, Math.round((Number(watchedCount || 0) / Number(totalDuration)) * 100));
}

function clampPercent(value) {
  const num = Number(value || 0);
  if (num < 0) return 0;
  if (num > 100) return 100;
  return Math.round(num);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}