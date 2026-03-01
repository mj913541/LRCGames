// /readathon-world_Ver2/js/student-home.js
import { auth, getSchoolId, DEFAULT_SCHOOL_ID } from "/readathon-world_Ver2/js/firebase.js";
import {
  ABS,
  guardRoleOrRedirect,
  setHeaderUser,
  wireSignOut,
  loadSummary,
  loadInventory,
  fmtInt,
  fmtMoneyCents,
  showLoading,
  hideLoading,
  normalizeError,
  getEquippedLocal,
  setEquippedLocal,
  pickSlotForItem,
} from "/readathon-world_Ver2/js/app.js";

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  hdr: document.getElementById("hdr"),

  minutesTotal: document.getElementById("minutesTotal"),
  minutesPending: document.getElementById("minutesPending"),
  rubiesBalance: document.getElementById("rubiesBalance"),
  rubiesLifetime: document.getElementById("rubiesLifetime"),
  moneyRaised: document.getElementById("moneyRaised"),

  roomBgLabel: document.getElementById("roomBgLabel"),
  equipHead: document.getElementById("equipHead"),
  equipBody: document.getElementById("equipBody"),
  equipAcc: document.getElementById("equipAcc"),
  equipPet: document.getElementById("equipPet"),

  inventoryList: document.getElementById("inventoryList"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("errorBox"),

  // Avatar World embed (modal + iframe)
  btnOpenAvatarWorld: document.getElementById("btnOpenAvatarWorld"),
  awEmbedModal: document.getElementById("awEmbedModal"),
  btnCloseAvatarWorld: document.getElementById("btnCloseAvatarWorld"),
  awEmbedFrame: document.getElementById("awEmbedFrame"),
};

init().catch((e) => showError(normalizeError(e)));

async function init() {
  // Guard
  showLoading(els.loadingOverlay, els.loadingText, "Loading your dashboard…");
  const claims = await guardRoleOrRedirect(["student"], ABS.studentLogin);
  if (!claims) return;

  wireSignOut(els.btnSignOut);
  wireAvatarWorldEmbed(); // ✅ NEW

  const schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = claims.userId || auth.currentUser?.uid;

  setHeaderUser(els.hdr, { title: "Readathon World", subtitle: `${schoolId} • ${userId}` });

  // Load summary
  const summary = await loadSummary({ schoolId, userId });
  renderSummary(summary);

  // Load inventory
  const inv = await loadInventory({ schoolId, userId });
  renderInventory({ schoolId, userId, inv });

  // Equipped preview
  renderEquipped({ schoolId, userId });

  hideLoading(els.loadingOverlay);
}

function wireAvatarWorldEmbed() {
  // If the button/modal isn't on the page, do nothing (safe)
  if (!els.btnOpenAvatarWorld || !els.awEmbedModal || !els.btnCloseAvatarWorld || !els.awEmbedFrame) return;

  const open = () => {
    els.awEmbedModal.classList.remove("isHidden");
    els.awEmbedModal.setAttribute("aria-hidden", "false");

    // Refresh the iframe when opening (helps during development)
    els.awEmbedFrame.src = "/readathon-world_Ver2/html/avatar-world.html?embed=1&from=student";
  };

  const close = () => {
    els.awEmbedModal.classList.add("isHidden");
    els.awEmbedModal.setAttribute("aria-hidden", "true");
  };

  els.btnOpenAvatarWorld.addEventListener("click", open);
  els.btnCloseAvatarWorld.addEventListener("click", close);

  // Click outside the card closes
  els.awEmbedModal.addEventListener("click", (e) => {
    if (e.target === els.awEmbedModal) close();
  });

  // ESC closes
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.awEmbedModal.getAttribute("aria-hidden") === "false") close();
  });

  // Listen for "Back" message from iframe (avatar-world.js will post this)
  window.addEventListener("message", (e) => {
    if (e.origin !== window.location.origin) return;
    if (e.data?.type === "aw_close") close();
  });
}

function renderSummary(s) {
  // s can be null if not created yet
  const minutesTotal = s?.minutesTotal ?? 0;
  const pending = s?.minutesPendingTotal ?? 0;
  const rubiesBal = s?.rubiesBalance ?? 0;
  const earned = s?.rubiesLifetimeEarned ?? 0;
  const spent = s?.rubiesLifetimeSpent ?? 0;
  const money = s?.moneyRaisedCents ?? 0;

  els.minutesTotal.textContent = fmtInt(minutesTotal);
  els.minutesPending.textContent = fmtInt(pending);
  els.rubiesBalance.textContent = fmtInt(rubiesBal);
  els.rubiesLifetime.textContent = `Earned: ${fmtInt(earned)} • Spent: ${fmtInt(spent)}`;
  els.moneyRaised.textContent = fmtMoneyCents(money);
}

function renderInventory({ schoolId, userId, inv }) {
  els.inventoryList.innerHTML = "";

  if (!inv.length) {
    const empty = document.createElement("div");
    empty.className = "emptyNote";
    empty.textContent = "No items yet. Earn rubies to buy avatar items!";
    els.inventoryList.appendChild(empty);
    return;
  }

  // Only show items with qty > 0
  const items = inv.filter((x) => Number(x.qty || 0) > 0);

  for (const it of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "invChip";

    const name = prettyItemId(it.itemId);
    btn.innerHTML = `<span class="invChip__name">${name}</span><span class="invChip__qty">x${Number(it.qty || 0)}</span>`;

    btn.addEventListener("click", () => {
      const equipped = getEquippedLocal({ schoolId, userId });
      const slot = pickSlotForItem(it.itemId);

      // Toggle off if already equipped
      if (equipped[slot] === it.itemId) equipped[slot] = null;
      else equipped[slot] = it.itemId;

      setEquippedLocal({ schoolId, userId }, equipped);
      renderEquipped({ schoolId, userId });
    });

    els.inventoryList.appendChild(btn);
  }
}

function renderEquipped({ schoolId, userId }) {
  const eq = getEquippedLocal({ schoolId, userId });

  els.roomBgLabel.textContent = `Room: ${eq.room ? prettyItemId(eq.room) : "(none)"}`;
  els.equipHead.textContent = `Head: ${eq.head ? prettyItemId(eq.head) : "(none)"}`;
  els.equipBody.textContent = `Body: ${eq.body ? prettyItemId(eq.body) : "(none)"}`;
  els.equipAcc.textContent = `Accessory: ${eq.accessory ? prettyItemId(eq.accessory) : "(none)"}`;
  els.equipPet.textContent = `Pet: ${eq.pet ? prettyItemId(eq.pet) : "(none)"}`;
}

function prettyItemId(itemId) {
  // item_cool_hat -> "Cool Hat"
  return String(itemId || "")
    .replace(/^item_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}