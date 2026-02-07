// /readathonWorld/scripts/dashboard.js
import {
  requireAuthOrRedirect,
  watchProfile,
  isStaffOrAdmin,
  fmtMoney,
  fmtInt,
  createReadathonRequest,
  fetchMyRequests,
  toast
} from "./readathonCore.js";

const els = {
  who: document.getElementById("who"),

  minutesRead: document.getElementById("minutesRead"),

  // NEW (balance view)
  sparksBalance: document.getElementById("sparksBalance"),
  sparksEarned: document.getElementById("sparksEarned"),
  sparksSpent: document.getElementById("sparksSpent"),

  moneyBalance: document.getElementById("moneyBalance"),
  moneyRaised: document.getElementById("moneyRaised"),
  moneySpent: document.getElementById("moneySpent"),

  adminLink: document.getElementById("adminLink"),

  minutesInput: document.getElementById("minutesInput"),
  minutesBtn: document.getElementById("minutesBtn"),

  donationInput: document.getElementById("donationInput"),
  donationBtn: document.getElementById("donationBtn"),

  requestsList: document.getElementById("requestsList")
};

let currentUid = null;

main().catch(err => toast(err.message || String(err), "error"));

async function main() {
  const user = await requireAuthOrRedirect(undefined, "readathonWorld/dashboard.html");
  currentUid = user.uid;

  // Live profile
  watchProfile(currentUid, (profile) => {
    if (!profile) {
      els.who.textContent = "Profile not found. (Check READATHON_PROFILE_COLLECTION in readathonCore.js)";
      return;
    }

    const display = profile.displayName || "Reader";
    els.who.textContent = `Signed in as: ${display}`;

    const ra = profile.readathon || {};

    // Minutes
    els.minutesRead.textContent = fmtInt(ra.minutesRead);

    // Sparks: Earned - Spent = Balance
    const se = Number(ra.sparksEarned || 0);
    const ss = Number(ra.sparksSpent || 0);
    const sb = Math.max(0, se - ss);

    els.sparksEarned.textContent = fmtInt(se);
    els.sparksSpent.textContent = fmtInt(ss);
    els.sparksBalance.textContent = fmtInt(sb);

    // Money: Raised - Spent = Balance
    const mr = Number(ra.moneyRaised || 0);
    const ms = Number(ra.moneySpent || 0);
    const mb = Math.max(0, mr - ms);

    els.moneyRaised.textContent = fmtMoney(mr);
    els.moneySpent.textContent = fmtMoney(ms);
    els.moneyBalance.textContent = fmtMoney(mb);

    if (isStaffOrAdmin(profile)) els.adminLink.classList.remove("hidden");
  });

  // Buttons
  els.minutesBtn.addEventListener("click", onSubmitMinutes);
  els.donationBtn.addEventListener("click", onSubmitDonation);

  // Render recent requests
  await refreshRequests();
}

async function onSubmitMinutes() {
  const val = Number(els.minutesInput.value);
  if (!Number.isFinite(val) || val <= 0 || val > 600) return toast("Enter minutes between 1 and 600.");

  await createReadathonRequest({
    uid: currentUid,
    type: "minutes",
    delta: { minutesAdd: val },
    studentNote: ""
  });

  els.minutesInput.value = "";
  toast("Minutes request submitted!");
  await refreshRequests();
}

async function onSubmitDonation() {
  const val = Number(els.donationInput.value);
  if (!Number.isFinite(val) || val <= 0 || val > 1000) return toast("Enter a donation between $1 and $1000.");

  await createReadathonRequest({
    uid: currentUid,
    type: "donation",
    delta: { moneyAdd: val },
    studentNote: ""
  });

  els.donationInput.value = "";
  toast("Donation request submitted!");
  await refreshRequests();
}

async function refreshRequests() {
  const rows = await fetchMyRequests(currentUid, 15);
  if (!rows.length) {
    els.requestsList.innerHTML = `<div class="text-sm text-white/60">No requests yet.</div>`;
    return;
  }

  els.requestsList.innerHTML = rows.map(r => {
    const status = r.status || "pending";
    const badge =
      status === "approved" ? "bg-emerald-500/20 border-emerald-300/30" :
      status === "denied" ? "bg-rose-500/20 border-rose-300/30" :
      "bg-amber-500/20 border-amber-300/30";

    const title =
      r.type === "minutes" ? `+${Number(r.delta?.minutesAdd || 0)} minutes` :
      r.type === "donation" ? `+$${Number(r.delta?.moneyAdd || 0).toFixed(2)} donation` :
      r.type === "sparkPurchase" ? `Buy: ${r.item?.name || "item"}` :
      r.type === "prizeRedemption" ? `Redeem: ${r.item?.name || "prize"}` :
      r.type;

    return `
      <div class="rounded-xl bg-black/30 border border-white/10 p-3 flex items-start justify-between gap-3">
        <div>
          <div class="font-semibold">${escapeHtml(title)}</div>
          <div class="text-xs text-white/60">Type: ${escapeHtml(r.type || "")}</div>
          ${r.staffNote ? `<div class="text-xs text-white/70 mt-1">Staff note: ${escapeHtml(r.staffNote)}</div>` : ""}
        </div>
        <div class="shrink-0 rounded-full border px-3 py-1 text-xs ${badge}">
          ${escapeHtml(status)}
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
