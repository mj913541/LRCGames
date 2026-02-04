// /readathonWorld/scripts/avatarRoom.js
import {
  requireAuthOrRedirect,
  watchProfile,
  fmtMoney,
  fmtInt,
  toast
} from "./readathonCore.js";

const els = {
  who: document.getElementById("who"),
  roomStage: document.getElementById("roomStage"),
  avatarImg: document.getElementById("avatarImg"),
  minutes: document.getElementById("minutes"),
  sparks: document.getElementById("sparks"),
  raised: document.getElementById("raised")
};

const DEFAULT_ROOM = "/readathonWorld/assets/rooms/default-room.jpg";
const DEFAULT_AVATAR = "/readathonWorld/assets/avatars/default-avatar.png";

main().catch(err => toast(err.message || String(err), "error"));

async function main() {
  const user = await requireAuthOrRedirect(undefined, "readathonWorld/avatarRoom.html");

  watchProfile(user.uid, (profile) => {
    if (!profile) {
      els.who.textContent = "Profile not found. (Check READATHON_PROFILE_COLLECTION in readathonCore.js)";
      return;
    }

    els.who.textContent = `Welcome, ${profile.displayName || "Reader"}!`;

    const ra = profile.readathon || {};
    els.minutes.textContent = fmtInt(ra.minutesRead);
    els.sparks.textContent = fmtInt(ra.sparksEarned);
    els.raised.textContent = fmtMoney(ra.moneyRaised);

    const roomUrl = profile.avatar?.equipped?.roomUrl || DEFAULT_ROOM;
    const avatarUrl = profile.avatar?.equipped?.avatarUrl || DEFAULT_AVATAR;

    els.roomStage.style.backgroundImage = `url("${roomUrl}")`;
    els.avatarImg.src = avatarUrl;
  });
}
