import {
  auth,
  db,
  getSchoolId,
  waitForAuthReady,
  getIdTokenClaims,
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
    youtubeId: "wbKcjspT3q8",
    youtubeUrl: "https://youtu.be/wbKcjspT3q8",
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
const VOTE_REWARD_RUBIES = 10;

const MATCHUPS = [
  {
    matchupId: "round1_match1",
    label: "Round 1 • Match 1",
    leftVideoId: "video_01",
    rightVideoId: "video_02",
  },
  {
    matchupId: "round1_match2",
    label: "Round 1 • Match 2",
    leftVideoId: "video_03",
    rightVideoId: "video_04",
  },
  {
    matchupId: "round1_match3",
    label: "Round 1 • Match 3",
    leftVideoId: "video_05",
    rightVideoId: "video_06",
  },
  {
    matchupId: "round1_match4",
    label: "Round 1 • Match 4",
    leftVideoId: "video_07",
    rightVideoId: "video_08",
  },
  {
    matchupId: "round1_match5",
    label: "Round 1 • Match 5",
    leftVideoId: "video_09",
    rightVideoId: "video_10",
  },
  {
    matchupId: "round1_match6",
    label: "Round 1 • Match 6",
    leftVideoId: "video_11",
    rightVideoId: "video_12",
  },
  {
    matchupId: "round1_match7",
    label: "Round 1 • Match 7",
    leftVideoId: "video_13",
    rightVideoId: "video_14",
  },
  {
    matchupId: "round1_match8",
    label: "Round 1 • Match 8",
    leftVideoId: "video_15",
    rightVideoId: "video_16",
  },
];

/* --------------------------------------------------
   ELEMENTS
-------------------------------------------------- */

const els = {
  hdr: document.getElementById("hdr"),
  btnSignOut: document.getElementById("btnSignOut"),

  clickZones: [...document.querySelectorAll(".click-zone")],
  matchupZones: [...document.querySelectorAll(".matchup-zone")],

  voteModal: document.getElementById("voteModal"),
  voteModalTitle: document.getElementById("voteModalTitle"),
  voteModalSubtitle: document.getElementById("voteModalSubtitle"),
  closeVoteModalBtn: document.getElementById("closeVoteModalBtn"),
  voteChoices: document.getElementById("voteChoices"),
  voteModalStatus: document.getElementById("voteModalStatus"),

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
const votesByMatchupId = new Map();

let activeMatchup = null;
let voteModalLastFocus = null;

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
  wireVoteModalEvents();

  await loadAllProgress();
  await loadAllVotes();
  renderVideoGrid();
  renderMatchupButtons();
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

function videoVotesCollectionPath() {
  return `${schoolRootPath()}/users/${userId}/videoVotes`;
}

function videoVotePath(matchupId) {
  return `${videoVotesCollectionPath()}/${matchupId}`;
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

async function loadAllVotes() {
  const qRef = query(collection(db, videoVotesCollectionPath()));
  const snap = await getDocs(qRef);

  votesByMatchupId.clear();

  for (const docSnap of snap.docs) {
    votesByMatchupId.set(docSnap.id, {
      id: docSnap.id,
      ...docSnap.data(),
    });
  }
}

/* --------------------------------------------------
   RENDER
-------------------------------------------------- */

function renderVideoGrid() {
  if (!els.clickZones?.length) return;

  els.clickZones.forEach((zone, index) => {
    const item = VIDEO_ITEMS[index];

    zone.innerHTML = "";
    zone.classList.remove("is-complete", "is-watching");
    zone.disabled = true;
    zone.setAttribute("aria-label", "Empty video slot");

    if (!item) {
      zone.innerHTML = `<div class="zone-card"><div class="zone-text"><div class="zone-title">Coming Soon</div></div></div>`;
      return;
    }

    const progress = progressByVideoKey.get(item.key) || {};
    const completed = !!progress.completed;
    const watchPercent = clampPercent(progress.watchPercent || 0);

    if (completed) {
      zone.classList.add("is-complete");
    } else if (watchPercent > 0) {
      zone.classList.add("is-watching");
    }

    const statusText = completed
      ? ""
      : watchPercent > 0
      ? `▶ ${watchPercent}%`
      : `💎 ${Number(item.rubies || 0)}`;

    zone.disabled = false;
    zone.title = item.title;
    zone.setAttribute("aria-label", `Open ${item.title}`);

    zone.innerHTML = `
      <div class="zone-card">
        <img class="zone-thumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />
        <div class="zone-text">
          <div class="zone-title">${escapeHtml(item.title)}</div>
          <div class="zone-meta">${escapeHtml(statusText)}</div>
        </div>
        ${completed ? '<div class="zone-check">✓</div>' : ""}
      </div>
    `;

    zone.onclick = () => {
      openVideoModal(item).catch((err) => {
        console.error(err);
        setText(els.playerStatus, normalizeError(err));
      });
    };
  });
}

function renderMatchupButtons() {
  if (!els.matchupZones?.length) return;

  els.matchupZones.forEach((btn, index) => {
    const matchup = MATCHUPS[index];

    if (!matchup) {
      btn.style.display = "none";
      return;
    }

    const leftProgress = progressByVideoKey.get(matchup.leftVideoId) || {};
    const rightProgress = progressByVideoKey.get(matchup.rightVideoId) || {};
    const existingVote = votesByMatchupId.get(matchup.matchupId);

    const unlocked = !!leftProgress.completed && !!rightProgress.completed;
    const completed = !!existingVote;

    btn.classList.remove("is-locked", "is-unlocked", "is-completed");

    let icon = "🔒";
    let stateText = "Locked";

    if (completed) {
      btn.classList.add("is-completed");
      btn.disabled = false;
      icon = "✅";
      stateText = "Completed";
    } else if (unlocked) {
      btn.classList.add("is-unlocked");
      btn.disabled = false;
      icon = "🔓";
      stateText = "Unlocked";
    } else {
      btn.classList.add("is-locked");
      btn.disabled = true;
      icon = "🔒";
      stateText = "Locked";
    }

    btn.innerHTML = `
      <div class="matchup-icon">${icon}</div>
      <div class="matchup-label">${escapeHtml(matchup.label)}</div>
      <div class="matchup-state">${escapeHtml(stateText)}</div>
    `;

    btn.title = `${matchup.label} • ${stateText}`;

    btn.onclick = () => {
      if (btn.disabled && !completed) return;

      openVoteModal(matchup).catch((err) => {
        console.error(err);
        setText(els.voteModalStatus, normalizeError(err));
      });
    };
  });
}

function renderStats() {
  const completedCount = [...progressByVideoKey.values()].filter(
    (x) => x.completed
  ).length;

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
   PLAYER MODAL
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
  modalLastFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  setText(els.playerModalTitle, item?.title || "Video");
  setText(
    els.playerModalSubtitle,
    `${Number(item?.rubies || 0)} rubies available`
  );
  setText(els.playerStatus, "Loading player.");
  setText(els.playerProgressText, "");

  setVisible(els.playerModal, true);

  if (els.closePlayerBtn) {
    window.setTimeout(() => {
      try {
        els.closePlayerBtn.focus();
      } catch {
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
    } catch {
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
          clampPercent(activeVideoProgress?.watchPercent || 0) >=
            MIN_WATCH_PERCENT &&
          Number(activeVideoProgress?.suspiciousSkips || 0) === 0;

        if (
          validWatch &&
          activeVideo &&
          activeVideoProgress &&
          !activeVideoProgress.completed
        ) {
          await awardVideoCompletion(activeVideo, activeVideoProgress);
        } else if (activeVideoProgress) {
          await saveActiveProgress();
        }

        renderVideoGrid();
        renderMatchupButtons();
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
  const threshold = Math.floor(
    Number(playerState?.completionThresholdSeconds || 0)
  );
  const suspicious = Number(playerState?.suspiciousSeekCount || 0);

  let rewardText = "";
  if (activeVideoProgress?.completed) {
    rewardText = ` • Reward: ${Number(
      activeVideoProgress.rubiesAwarded || activeVideo?.rubies || 0
    )} rubies earned`;
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

  activeVideoProgress.durationSeconds = Math.floor(
    Number(playerState.durationSeconds || 0)
  );
  activeVideoProgress.watchedSecondCount = Math.floor(
    Number(playerState.watchSeconds || 0)
  );
  activeVideoProgress.resumeAtSeconds = Math.floor(
    Number(playerState.maxObservedTime || 0)
  );
  activeVideoProgress.watchPercent = clampPercent(
    Number(playerState.watchPercent || 0) * 100
  );
  activeVideoProgress.suspiciousSkips = Number(
    playerState.suspiciousSeekCount || 0
  );

  if (playerState.completed) {
    activeVideoProgress.watchPercent = Math.max(
      clampPercent(activeVideoProgress.watchPercent || 0),
      MIN_WATCH_PERCENT
    );
  }
}

/* --------------------------------------------------
   VOTE MODAL
-------------------------------------------------- */

function wireVoteModalEvents() {
  if (els.closeVoteModalBtn) {
    els.closeVoteModalBtn.addEventListener("click", () => {
      closeVoteModal();
    });
  }

  const backdrop = els.voteModal?.querySelector(".voteModalBackdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => {
      closeVoteModal();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isVoteModalOpen()) {
      closeVoteModal();
    }
  });
}

function isVoteModalOpen() {
  return !!els.voteModal && els.voteModal.style.display !== "none";
}

function openVoteModalShell(matchup) {
  activeMatchup = matchup;
  voteModalLastFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  setText(els.voteModalTitle, matchup?.label || "Vote");
  setText(els.voteModalSubtitle, `Choose your favorite video • Earn ${VOTE_REWARD_RUBIES} rubies`);
  setText(els.voteModalStatus, "Choose one video to submit your vote.");
  setVisible(els.voteModal, true);

  if (els.closeVoteModalBtn) {
    window.setTimeout(() => {
      try {
        els.closeVoteModalBtn.focus();
      } catch {
        // ignore focus failure
      }
    }, 0);
  }
}

function closeVoteModal() {
  activeMatchup = null;

  setVisible(els.voteModal, false);
  setText(els.voteModalTitle, "");
  setText(els.voteModalSubtitle, "");
  setText(els.voteModalStatus, "Loading vote options...");

  if (els.voteChoices) {
    els.voteChoices.innerHTML = "";
  }

  if (voteModalLastFocus && typeof voteModalLastFocus.focus === "function") {
    try {
      voteModalLastFocus.focus();
    } catch {
      // ignore focus failure
    }
  }
}

async function openVoteModal(matchup) {
  if (!matchup) {
    throw new Error("Missing matchup.");
  }

  const existingVote = votesByMatchupId.get(matchup.matchupId);

  const leftItem = VIDEO_ITEMS.find((item) => item.key === matchup.leftVideoId);
  const rightItem = VIDEO_ITEMS.find((item) => item.key === matchup.rightVideoId);

  if (!leftItem || !rightItem) {
    throw new Error("Missing video data for this matchup.");
  }

  const leftProgress = progressByVideoKey.get(matchup.leftVideoId) || {};
  const rightProgress = progressByVideoKey.get(matchup.rightVideoId) || {};
  const unlocked = !!leftProgress.completed && !!rightProgress.completed;

  if (!unlocked && !existingVote) {
    throw new Error("This matchup is still locked.");
  }

  openVoteModalShell(matchup);

  if (els.voteChoices) {
    els.voteChoices.innerHTML = "";
  }

  const choices = [leftItem, rightItem];

  for (const item of choices) {
    const card = document.createElement("article");
    card.className = "voteChoiceCard";

    const selectedAlready = existingVote?.selectedVideoId === item.key;

    card.innerHTML = `
      <img
        class="voteChoiceThumb"
        src="${escapeHtml(item.image)}"
        alt="${escapeHtml(item.title)}"
      />
      <div class="voteChoiceTitle">${escapeHtml(item.title)}</div>
      <button
        class="voteChoiceBtn"
        type="button"
        data-video-key="${escapeHtml(item.key)}"
        ${existingVote ? "disabled" : ""}
      >
        ${
          selectedAlready
            ? "✅ Voted"
            : existingVote
            ? "Vote Submitted"
            : `Vote for This Video (+${VOTE_REWARD_RUBIES} 💎)`
        }
      </button>
    `;

    const btn = card.querySelector(".voteChoiceBtn");

    if (btn && !existingVote) {
      btn.addEventListener("click", async () => {
        try {
          btn.disabled = true;
          setText(els.voteModalStatus, "Submitting vote and awarding rubies...");

          await submitMatchupVote(matchup, item);

          setText(
            els.voteModalStatus,
            `✅ Vote submitted for ${item.title}. +${VOTE_REWARD_RUBIES} rubies awarded.`
          );
          renderMatchupButtons();

          window.setTimeout(() => {
            closeVoteModal();
          }, 450);
        } catch (err) {
          console.error(err);
          btn.disabled = false;
          setText(els.voteModalStatus, normalizeError(err));
        }
      });
    }

    els.voteChoices?.appendChild(card);
  }

  if (existingVote) {
    const selectedItem =
      VIDEO_ITEMS.find((item) => item.key === existingVote.selectedVideoId) || null;

    setText(
      els.voteModalStatus,
      selectedItem
        ? `✅ You already voted for ${selectedItem.title}.`
        : "✅ You already voted in this matchup."
    );
  }
}

async function awardVoteRubies(matchup, selectedItem) {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("No signed-in Firebase user found when trying to award vote rubies.");
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
        schoolId,
        targetUserId: userId,
        actionType: "RUBIES_AWARD",
        deltaMinutes: 0,
        deltaRubies: VOTE_REWARD_RUBIES,
        deltaMoneyRaisedCents: 0,
        note: `Vote reward: ${matchup.label} → ${selectedItem.title}`.slice(0, 300),
      }),
    }
  );

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Vote reward failed with HTTP ${response.status}`
    );
  }

  return data;
}

async function submitMatchupVote(matchup, selectedItem) {
  if (!matchup?.matchupId) {
    throw new Error("Missing matchup ID.");
  }

  if (!selectedItem?.key) {
    throw new Error("Missing selected video.");
  }

  const leftProgress = progressByVideoKey.get(matchup.leftVideoId) || {};
  const rightProgress = progressByVideoKey.get(matchup.rightVideoId) || {};
  const unlocked = !!leftProgress.completed && !!rightProgress.completed;

  if (!unlocked) {
    throw new Error("This matchup is still locked.");
  }

  if (votesByMatchupId.has(matchup.matchupId)) {
    throw new Error("You already voted in this matchup.");
  }

  if (
    selectedItem.key !== matchup.leftVideoId &&
    selectedItem.key !== matchup.rightVideoId
  ) {
    throw new Error("Selected video is not part of this matchup.");
  }

  const matchNumber =
    Number(String(matchup.matchupId || "").replace("round1_match", "")) || 0;

  const payload = {
    matchupId: matchup.matchupId,
    roundNumber: 1,
    matchNumber,
    label: matchup.label,
    leftVideoId: matchup.leftVideoId,
    rightVideoId: matchup.rightVideoId,
    selectedVideoId: selectedItem.key,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, videoVotePath(matchup.matchupId)), payload, {
    merge: false,
  });

  await awardVoteRubies(matchup, selectedItem);

  votesByMatchupId.set(matchup.matchupId, {
    ...payload,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
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

  renderVideoGrid();
  renderMatchupButtons();
  renderStats();
  updateLiveStatus();
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

  const currentUser = auth.currentUser;

  console.log("Video reward auth check:", {
    authUid: currentUser ? currentUser.uid : null,
    pageUserId: userId,
    schoolId,
    localSchoolId: getSchoolId(),
    videoKey: item.key,
  });

  if (!currentUser) {
    throw new Error("No signed-in Firebase user found when trying to award video rubies.");
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
        schoolId,
        targetUserId: userId,
        actionType: "RUBIES_AWARD",
        deltaMinutes: 0,
        deltaRubies: Number(item.rubies || 0),
        deltaMoneyRaisedCents: 0,
        note: `Video reward: ${item.title}`.slice(0, 300),
      }),
    }
  );

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Video reward failed with HTTP ${response.status}`
    );
  }

  console.log("✅ Video reward transaction success:", data);

  progress.completed = true;
  progress.rubiesAwarded = Number(item.rubies || 0);
  progress.watchPercent = Math.max(
    clampPercent(progress.watchPercent || 0),
    MIN_WATCH_PERCENT
  );

  const videoDocPayload = {
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
  };

  await setDoc(doc(db, videoProgressPath(item.key)), videoDocPayload, {
    merge: true,
  });

  const nextMap = new Map(progressByVideoKey);
  nextMap.set(item.key, {
    ...(nextMap.get(item.key) || {}),
    ...videoDocPayload,
  });

  const completedCount = [...nextMap.values()].filter((x) => x.completed).length;
  const totalRubiesAwarded = [...nextMap.values()].reduce(
    (sum, x) => sum + Number(x.rubiesAwarded || 0),
    0
  );

  await setDoc(
    doc(db, videoLibrarySummaryPath()),
    {
      completedCount,
      earnedRubies: totalRubiesAwarded,
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