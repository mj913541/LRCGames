// /readathonWorld/scripts/avatarShop.js
import {
  requireAuthOrRedirect,
  watchProfile,
  fetchShopItems,
  COLLECTIONS,
  createReadathonRequest,
  fmtInt,
  toast
} from "./readathonCore.js";

const els = {
  sparks: document.getElementById("sparks"),
  items: document.getElementById("items")
};

let uid = null;
let sparks = 0;

main().catch(err => toast(err.message || String(err), "error"));

async function main() {
  const user = await requireAuthOrRedirect(undefined, "readathonWorld/avatarShop.html");
  uid = user.uid;

  watchProfile(uid, (profile) => {
    const ra = profile?.readathon || {};
    sparks = Number(ra.sparksEarned || 0);
    els.sparks.textContent = fmtInt(sparks);
  });

  const items = await fetchShopItems(COLLECTIONS.sparkShop);
  render(items);
}

function render(items) {
  if (!items.length) {
    els.items.innerHTML = `<div class="text-sm text-white/60">No active spark shop items yet.</div>`;
    return;
  }

  els.items.innerHTML = items.map(item => {
    const cost = Number(item.costSparks || 0);
    return `
      <div class="rounded-2xl bg-black/30 border border-white/10 overflow-hidden">
        <div class="aspect-[16/10] bg-black/40">
          <img src="${escapeHtml(item.imageUrl || "")}" alt="" class="w-full h-full object-cover" onerror="this.style.display='none'">
        </div>
        <div class="p-4">
          <div class="font-extrabold">${escapeHtml(item.name || item.id)}</div>
          <div class="text-sm text-white/70 mt-1">${escapeHtml(item.description || "")}</div>
          <div class="mt-3 flex items-center justify-between">
            <div class="text-sm">Cost: <span class="font-bold">${cost}</span> ✨</div>
            <button data-id="${escapeHtml(item.id)}"
                    class="buyBtn rounded-xl bg-indigo-500/60 hover:bg-indigo-500/80 px-4 py-2 font-semibold">
              Request
            </button>
          </div>
          <div class="text-xs text-white/55 mt-2">Staff must approve before it’s added.</div>
        </div>
      </div>
    `;
  }).join("");

  els.items.querySelectorAll(".buyBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const itemId = btn.dataset.id;
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const cost = Number(item.costSparks || 0);
      if (cost <= 0) return toast("This item has no cost configured.");

      await createReadathonRequest({
        uid,
        type: "sparkPurchase",
        item: {
          shop: "sparkShop",
          itemId,
          name: item.name || itemId,
          costSparks: cost
        },
        studentNote: ""
      });

      toast("Purchase request submitted!");
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
