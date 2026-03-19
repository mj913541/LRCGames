// /readathon-world_Ver3/js/book-bracket-player.js

let youtubeApiPromise = null;

function loadYouTubeIframeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise((resolve, reject) => {
    const priorReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (typeof priorReady === "function") {
        try {
          priorReady();
        } catch (err) {
          console.warn("Previous onYouTubeIframeAPIReady handler failed:", err);
        }
      }
      resolve(window.YT);
    };

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;

      if (window.YT?.Player) {
        window.clearInterval(timer);
        resolve(window.YT);
        return;
      }

      if (tries > 200) {
        window.clearInterval(timer);
        reject(
          new Error(
            "Timed out loading YouTube Iframe API. Make sure the page includes https://www.youtube.com/iframe_api before book-bracket-student.js."
          )
        );
      }
    }, 100);
  });

  return youtubeApiPromise;
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export async function mountBookBracketPlayer({
  youtubeVideoId,
  playerElementId,
  onReady = null,
  onProgress = null,
  onCompleted = null,
  onStateChange = null,
  onError = null,
  completionThresholdPercent = 0.9,
  minimumWatchSecondsFloor = 30,
} = {}) {
  if (!youtubeVideoId) {
    throw new Error("mountBookBracketPlayer requires youtubeVideoId.");
  }

  if (!playerElementId) {
    throw new Error("mountBookBracketPlayer requires playerElementId.");
  }

  const mountEl = document.getElementById(playerElementId);
  if (!mountEl) {
    throw new Error(`Player mount element not found: #${playerElementId}`);
  }

  mountEl.replaceChildren();

  await loadYouTubeIframeApi();

  let destroyed = false;
  let player = null;
  let progressTimer = null;

  const seenSeconds = new Set();
  let maxObservedTime = 0;
  let suspiciousSeekCount = 0;
  let lastCurrentTime = 0;
  let completed = false;
  let durationSeconds = 0;
  let isPlaybackActive = false;

  const getThresholdSeconds = () => {
    const byPercent = durationSeconds * clampNumber(completionThresholdPercent, 0, 1);
    return Math.max(minimumWatchSecondsFloor, Math.floor(byPercent));
  };

  const getWatchSeconds = () => seenSeconds.size;

  const buildPlayerState = () => {
    const watchSeconds = getWatchSeconds();
    const safeDuration = durationSeconds > 0 ? durationSeconds : 0;
    const watchPercent =
      safeDuration > 0 ? Math.min(1, watchSeconds / safeDuration) : 0;

    return {
      youtubeVideoId,
      durationSeconds: safeDuration,
      watchSeconds,
      watchPercent,
      maxObservedTime,
      suspiciousSeekCount,
      completionThresholdPercent: clampNumber(completionThresholdPercent, 0, 1),
      completionThresholdSeconds: getThresholdSeconds(),
      completed,
      isPlaybackActive,
    };
  };

  const emitReady = () => {
    if (typeof onReady === "function") onReady(buildPlayerState());
  };

  const emitProgress = () => {
    if (typeof onProgress === "function") onProgress(buildPlayerState());
  };

  const emitCompleted = () => {
    if (typeof onCompleted === "function") onCompleted(buildPlayerState());
  };

  const emitStateChange = () => {
    if (typeof onStateChange === "function") onStateChange(buildPlayerState());
  };

  const emitError = (err) => {
    if (typeof onError === "function") onError(err);
  };

  const markCurrentSecondWatched = () => {
    if (!player || typeof player.getCurrentTime !== "function") return;

    const currentTime = Number(player.getCurrentTime() || 0);
    const floored = Math.max(0, Math.floor(currentTime));

    if (currentTime > maxObservedTime) {
      maxObservedTime = currentTime;
    }

    if (currentTime - lastCurrentTime > 2.5) {
      suspiciousSeekCount += 1;
    }

    lastCurrentTime = currentTime;
    seenSeconds.add(floored);

    const threshold = getThresholdSeconds();
    const watchSeconds = getWatchSeconds();

    if (!completed && threshold > 0 && watchSeconds >= threshold) {
      completed = true;
      emitProgress();
      emitCompleted();
    } else {
      emitProgress();
    }
  };

  const stopProgressTimer = () => {
    if (progressTimer) {
      window.clearInterval(progressTimer);
      progressTimer = null;
    }
  };

  const startProgressTimer = () => {
    stopProgressTimer();
    progressTimer = window.setInterval(() => {
      if (destroyed || !player) return;
      markCurrentSecondWatched();
    }, 1000);
  };

  await new Promise((resolve, reject) => {
    try {
      player = new window.YT.Player(playerElementId, {
        videoId: youtubeVideoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            try {
              durationSeconds = Number(event.target.getDuration?.() || 0);
              emitReady();
              emitStateChange();
              resolve();
            } catch (err) {
              reject(err);
            }
          },

          onStateChange: (event) => {
            const stateCode = event.data;

            if (stateCode === window.YT.PlayerState.PLAYING) {
              isPlaybackActive = true;

              if (!durationSeconds && typeof player.getDuration === "function") {
                durationSeconds = Number(player.getDuration() || 0);
              }

              startProgressTimer();
              emitStateChange();
              return;
            }

            if (stateCode === window.YT.PlayerState.PAUSED) {
              isPlaybackActive = false;
              stopProgressTimer();
              emitStateChange();
              emitProgress();
              return;
            }

            if (stateCode === window.YT.PlayerState.ENDED) {
              isPlaybackActive = false;
              stopProgressTimer();

              if (durationSeconds <= 0 && typeof player.getDuration === "function") {
                durationSeconds = Number(player.getDuration() || 0);
              }

              const maxTime = Math.floor(
                Number(player.getCurrentTime?.() || durationSeconds || 0)
              );

              for (let s = 0; s <= maxTime; s += 1) {
                seenSeconds.add(s);
              }

              maxObservedTime = Math.max(maxObservedTime, maxTime);

              if (!completed) {
                completed = true;
                emitProgress();
                emitCompleted();
              }

              emitStateChange();
              return;
            }

            if (stateCode === window.YT.PlayerState.BUFFERING) {
              emitStateChange();
              return;
            }

            if (stateCode === window.YT.PlayerState.CUED) {
              emitStateChange();
            }
          },

          onError: (event) => {
            const err = new Error(`YouTube player error: ${event?.data ?? "unknown"}`);
            emitError(err);
            reject(err);
          },
        },
      });
    } catch (err) {
      reject(err);
    }
  });

  return {
    getState() {
      return buildPlayerState();
    },

    async destroy() {
      destroyed = true;
      stopProgressTimer();

      try {
        if (player && typeof player.destroy === "function") {
          player.destroy();
        }
      } catch (err) {
        console.warn("Failed to destroy YouTube player:", err);
      }

      player = null;

      if (mountEl) {
        mountEl.replaceChildren();
      }
    },
  };
}