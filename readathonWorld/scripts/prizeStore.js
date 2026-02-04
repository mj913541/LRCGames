// /readathonWorld/scripts/prizeStore.js
import {
  requireAuthOrRedirect,
  watchProfile,
  fetchShopItems,
  COLLECTIONS,
  createReadathonRequest,
  fmtMoney,
  toast
} from "./readathonCore.js";

const els = {
  money: document.getElementById("money"),
  items: document.getElementById("items")
};

let uid = null;
let moneyRaised = 0;

main().catch(err => toast(err.message || String(err), "error"));

async function main() {
  const user = await requireAuthOrRedirect(undefined, "readathonWorld/prizeStore.html");
  uid = user.uid;

  watchProfile(uid, (profile) => {
    const ra = profile?.readathon || {};
    moneyRaised = Number(ra.moneyRaised || 0);
    els.money.textContent = fmtMoney(moneyRaised);
  });

  const items = await fetchShopItems(COLLECTIONS.prizeStore);
  render(items);
}

function render(items) {
  if (!items.length) {
    els.items.innerHTML = `<div class="text-sm text-white/60">No active prize items yet.</div>`;
    return;
  }

  els.items.innerHTML = items.map(item => {
    const cost = Number(item.costMoney || 0);
    return `
      <div class="rounded-2xl bg-black/30 border border-white/10 overflow-hidden">
        <div class="aspect-[16/10] bg-black/40">
          <img src="${escapeHtml(item.imageUrl || "")}" alt="" class="w-full h-full object-cover" onerror="this.style.display='none'">
        </div>
        <div class="p-4">
          <div class="font-extrabold">${escapeHtml(item.name || item.id)}</div>
          <div class="text-sm text-white/70 mt-1">${escapeHtml(item.description || "")}</div>
          <div class="mt-3 flex items-center justify-between">
            <div class="text-sm">Cost: <span class="font-bold">$${cost.toFixed(2)}</span></div>
            <button data-id="${escapeHtml(item.id)}"
                    class="redeemBtn rounded-xl bg-emerald-500/60 hover:bg-emerald-500/80 px-4 py-2 font-semibold">
              Request
            </button>
          </div>
          <div class="text-xs text-white/55 mt-2">Staff must approve before it’s redeemed.</div>
        </div>
      </div>
    `;
  }).join("");

  els.items.querySelectorAll(".redeemBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const itemId = btn.dataset.id;
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const cost = Number(item.costMoney || 0);
      if (cost <= 0) return toast("This prize has no cost configured.");

      await createReadathonRequest({
        uid,
        type: "prizeRedemption",
        item: {
          shop: "prizeStore",
          itemId,
          name: item.name || itemId,
          costMoney: cost
        },
        studentNote: ""
      });

      toast("Redemption request submitted!");
    });
  });
}

function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
