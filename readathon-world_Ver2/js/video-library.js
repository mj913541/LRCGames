import {
  auth,
  db,
  getSchoolId,
  waitForAuthReady,
  getIdTokenClaims,
  fnSubmitTransaction,
  userSummaryRef,
} from "./firebase.js";

import {
  setHeaderUser,
  wireSignOut,
  normalizeError,
} from "./app.js";

import {
  doc,
  collection,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { mountBookBracketPlayer } from "./book-bracket-player.js";

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

  playerModal: document.getElementById("bbPlayerModal"),
  playerModalTitle: document.getElementById("bbPlayerModalTitle"),
  playerModalSubtitle: document.getElementById("bbPlayerModalSubtitle"),
  closePlayerBtn: document.getElementById("bbClosePlayerBtn"),
  playerMount: document.getElementById("bookBracketPlayer"),
  playerStatus: document.getElementById("bbPlayerStatus"),
  playerProgressText: document.getElementById("bbPlayerProgressText"),
};

/* --------------------------------------------------
   STATE
-------------------------------------------------- */

let schoolId = null;
let userId = null;
let claims = null;

let activePlayerSession = null;
let activeVideo = null;
let activeVideoProgress = null;
let modalLastFocus = null;
let isClosingModal = false;

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
  wireModalEvents();

  await loadAllProgress();
  renderVideoGrid();
  renderStats();
  updateLiveStatus();
}

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

    card.addEventListener("click", () => {
      openVideoModal(item).catch((err) => {
        console.error(err);
        setText(els.playerStatus, normalizeError(err));
      });
    });

    els.videoGrid.appendChild(card);
  }
}

function renderStats() {
  const completedCount = [...progressByVideoKey.values()].filter((x) => x.completed).length;
  const earnedRubies = [...progressByVideoKey.values()].reduce(
    (sum, x) => sum + Number(x.rubiesAwarded || 0),
    0
  );

  if (els.completedCount) {
    els.completedCount.textContent = String(completedCount);
  }

  if (els.earnedRubies) {
    els.earnedRubies.textContent = String(earnedRubies);
  }
}

function updateLiveStatus() {
  if (!els.currentVideoStatus) return;

  if (!activeVideo || !activeVideoProgress) {
    els.currentVideoStatus.textContent = "Not watching";
    return;
  }

  const pct = clampPercent(activeVideoProgress.watchPercent || 0);

  if (activeVideoProgress.completed) {
    els.currentVideoStatus.textContent = `${activeVideo.title} • Completed • ${pct}%`;
  } else if (pct > 0) {
    els.currentVideoStatus.textContent = `${activeVideo.title} • ${pct}% watched`;
  } else {
    els.currentVideoStatus.textContent = `${activeVideo.title} • Ready to watch`;
  }
}

/* --------------------------------------------------
   MODAL
-------------------------------------------------- */

function wireModalEvents() {
  if (els.closePlayerBtn) {
    els.closePlayerBtn.addEventListener("click", () => {
      closeVideoModal().catch(console.error);
    });
  }

  const backdrop = els.playerModal?.querySelector(".bbModalBackdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => {
      closeVideoModal().catch(console.error);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isModalOpen()) {
      closeVideoModal().catch(console.error);
    }
  });
}

function isModalOpen() {
  return !!els.playerModal && els.playerModal.style.display !== "none";
}

function openPlayerModal(item) {
  modalLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  setText(els.playerModalTitle, item?.title || "Video");
  setText(els.playerModalSubtitle, `${Number(item?.rubies || 0)} rubies available`);
  setText(els.playerStatus, "Loading player.");
  setText(els.playerProgressText, "");

  setVisible(els.playerModal, true);

  if (els.closePlayerBtn) {
    window.setTimeout(() => {
      try {
        els.closePlayerBtn.focus();
      } catch (err) {
        // ignore focus failure
      }
    }, 0);
  }
}

async function closeVideoModal() {
  if (isClosingModal) return;
  isClosingModal = true;

  try {
    if (activePlayerSession) {
      await activePlayerSession.destroy();
    }
  } catch (err) {
    console.warn("Failed to destroy active player session:", err);
  }

  activePlayerSession = null;
  activeVideo = null;
  activeVideoProgress = null;

  setVisible(els.playerModal, false);
  setText(els.playerStatus, "Loading player.");
  setText(els.playerProgressText, "");

  updateLiveStatus();

  if (modalLastFocus && typeof modalLastFocus.focus === "function") {
    try {
      modalLastFocus.focus();
    } catch (err) {
      // ignore focus failure
    }
  }

  window.setTimeout(() => {
    isClosingModal = false;
  }, 50);
}

async function openVideoModal(item) {
  if (!item?.youtubeId) {
    throw new Error("This video does not have a YouTube video ID yet.");
  }

  await closeVideoModal();

  const existing = progressByVideoKey.get(item.key) || {};
  const resumeAtSeconds = Math.max(
    0,
    Math.floor(Number(existing?.resumeAtSeconds || 0))
  );

  activeVideo = item;
  activeVideoProgress = buildLocalProgress(item, existing);

  openPlayerModal(item);
  updateLiveStatus();

  activePlayerSession = await mountBookBracketPlayer({
    youtubeVideoId: item.youtubeId,
    playerElementId: "bookBracketPlayer",
    startSeconds: resumeAtSeconds,

    onReady: (playerState) => {
      setText(
        els.playerStatus,
        resumeAtSeconds > 0
          ? `▶ Player ready. Resuming at ${resumeAtSeconds}s`
          : "▶ Player ready. Start watching!"
      );
      syncActiveProgressFromPlayerState(playerState);
      updatePlayerProgressUi(playerState);
      updateLiveStatus();
    },

    onProgress: (playerState) => {
      syncActiveProgressFromPlayerState(playerState);
      updatePlayerProgressUi(playerState);
      updateLiveStatus();
    },

    onCompleted: async (playerState) => {
      try {
        syncActiveProgressFromPlayerState(playerState);
        setText(els.playerStatus, "✅ Video completed!");
        updatePlayerProgressUi(playerState);

        const validWatch =
          clampPercent(activeVideoProgress?.watchPercent || 0) >= MIN_WATCH_PERCENT &&
          Number(activeVideoProgress?.suspiciousSkips || 0) === 0;

        if (validWatch && activeVideo && activeVideoProgress && !activeVideoProgress.completed) {
          await awardVideoCompletion(activeVideo, activeVideoProgress);
        } else if (activeVideoProgress) {
          await saveActiveProgress();
        }

        renderVideoGrid();
        renderStats();
        updateLiveStatus();
      } catch (err) {
        console.error(err);
        setText(els.playerStatus, normalizeError(err));
      }
    },

    onStateChange: (playerState) => {
      syncActiveProgressFromPlayerState(playerState);

      if (playerState?.completed) {
        setText(els.playerStatus, "✅ Video completed!");
      } else if (playerState?.isPlaybackActive) {
        setText(els.playerStatus, "▶ Watching.");
      } else {
        setText(els.playerStatus, "⏸ Paused");
      }

      updatePlayerProgressUi(playerState);
      updateLiveStatus();

      if (!playerState?.isPlaybackActive && activeVideoProgress) {
        saveActiveProgress().catch(console.error);
      }
    },

    onError: (err) => {
      console.error(err);
      setText(els.playerStatus, `Player error: ${normalizeError(err)}`);
    },
  });
}

function updatePlayerProgressUi(playerState) {
  const watched = Math.floor(playerState?.watchSeconds || 0);
  const percent = Math.round(Number(playerState?.watchPercent || 0) * 100);
  const threshold = Math.floor(playerState?.completionThresholdSeconds || 0);
  const suspicious = Number(playerState?.suspiciousSeekCount || 0);

  let rewardText = "";
  if (activeVideoProgress?.completed) {
    rewardText = ` • Reward: ${Number(activeVideoProgress.rubiesAwarded || activeVideo?.rubies || 0)} rubies earned`;
  } else {
    rewardText = " • Reward: not earned yet";
  }

  setText(
    els.playerProgressText,
    `Watched: ${watched}s • Progress: ${percent}% • Threshold: ${threshold}s${
      suspicious > 0 ? ` • Suspicious skips: ${suspicious}` : ""
    }${rewardText}`
  );
}

function syncActiveProgressFromPlayerState(playerState) {
  if (!activeVideo || !activeVideoProgress || !playerState) return;

  activeVideoProgress.videoKey = activeVideo.key;
  activeVideoProgress.youtubeId = activeVideo.youtubeId;
  activeVideoProgress.youtubeUrl = activeVideo.youtubeUrl || "";
  activeVideoProgress.title = activeVideo.title;
  activeVideoProgress.rubiesPlanned = Number(activeVideo.rubies || 0);

  activeVideoProgress.durationSeconds = Math.floor(Number(playerState.durationSeconds || 0));
  activeVideoProgress.watchedSecondCount = Math.floor(Number(playerState.watchSeconds || 0));
  activeVideoProgress.resumeAtSeconds = Math.floor(Number(playerState.maxObservedTime || 0));
  activeVideoProgress.watchPercent = clampPercent(
    Number(playerState.watchPercent || 0) * 100
  );
  activeVideoProgress.suspiciousSkips = Number(playerState.suspiciousSeekCount || 0);

  if (playerState.completed) {
    activeVideoProgress.watchPercent = Math.max(
      clampPercent(activeVideoProgress.watchPercent || 0),
      MIN_WATCH_PERCENT
    );
  }
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

  try {
    console.log("Submitting transaction...");

    const result = await fnSubmitTransaction({
      schoolId,
      targetUserId: userId,
      actionType: "RUBIES_AWARD",
      deltaMinutes: 0,
      deltaRubies: Number(item.rubies || 0),
      deltaMoneyRaisedCents: 0,
      note: `Video reward: ${item.title}`.slice(0, 300),
    });

    console.log("Transaction result:", result);
  } catch (err) {
    console.error("❌ Transaction FAILED:", err);
  }

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
    userSummaryRef(schoolId, userId),
    {
      videoLibraryCompletedVideos: completedCount,
      videoLibraryRubiesAwarded: totalRubiesAwarded,
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

function setText(el, value) {
  if (!el) return;
  el.textContent = value ?? "";
}

function setVisible(el, visible) {
  if (!el) return;
  el.style.display = visible ? "" : "none";
}