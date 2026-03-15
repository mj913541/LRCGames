// /readathon-world_Ver2/js/avatar-shop.js

import {
  auth,
  db,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  waitForAuthReady,
  fnBuyAvatarItem,
} from "./firebase.js";

import {
  ABS,
  guardRoleOrRedirect,
  setHeaderUser,
  wireSignOut,
  loadSummary,
  loadInventory,
  fmtInt,
  showLoading,
  hideLoading,
  normalizeError,
} from "./app.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* --------------------------------------------------
   DOM
-------------------------------------------------- */

const els = {
  btnSignOut: document.getElementById("btnSignOut"),
  btnBack: document.getElementById("btnBack"),
  hdr: document.getElementById("hdr"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("errorBox"),

  rubiesBalance: document.getElementById("rubiesBalance"),
  ownedCount: document.getElementById("ownedCount"),
  shopSummary: document.getElementById("shopSummary"),

  shopGrid: document.getElementById("shopGrid"),
  emptyState: document.getElementById("emptyState"),

  tabs: Array.from(document.querySelectorAll("[data-shop-tab]")),
  searchInput: document.getElementById("searchInput"),
  rarityFilter: document.getElementById("rarityFilter"),
  ownedFilter: document.getElementById("ownedFilter"),
  collectionFilter: document.getElementById("collectionFilter"),
};


/* --------------------------------------------------
   State
-------------------------------------------------- */

const state = {
  schoolId: DEFAULT_SCHOOL_ID,
  userId: "",
  role: "",

  summary: null,
  rubiesBalance: 0,

  catalog: [],
  ownedIds: new Set(),
  collections: [],

  tab: "all",
  search: "",
  rarity: "all",
  ownedFilter: "all", // all | owned | unowned
  collection: "all",

  busyBuyItemId: null,
};


/* --------------------------------------------------
   Init
-------------------------------------------------- */

init().catch((err) => {
  console.error("avatar-shop init failed:", err);
  showError(normalizeError(err));
  hideLoading(els.loadingOverlay);
});

async function init() {
  showLoading(els.loadingOverlay, els.loadingText, "Loading Avatar Shop…");

  wireBaseUI();

  const claims = await guardRoleOrRedirect(
    ["student", "staff", "admin"],
    ABS.index || "../html/index.html"
  );
  if (!claims) return;

  await waitForAuthReady();
  if (!auth.currentUser) {
    window.location.href = ABS.index || "../html/index.html";
    return;
  }

  state.schoolId = getSchoolId() || claims.schoolId || DEFAULT_SCHOOL_ID;
  state.userId = String(claims.userId || auth.currentUser.uid || "").toLowerCase();
  state.role = String(claims.role || "").toLowerCase();

  setHeaderUser(els.hdr, {
    title: "Avatar Shop",
    subtitle: `${state.schoolId} • ${state.userId}`,
  });
  wireSignOut(els.btnSignOut);

  await loadAllData();
  wireFilters();
  renderAll();

  hideLoading(els.loadingOverlay);
}

/* --------------------------------------------------
   Wiring
-------------------------------------------------- */

function wireBaseUI() {
  if (els.btnBack) {
    els.btnBack.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = "./avatar-world.html";
    });
  }

  els.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = String(btn.dataset.shopTab || "all");
      els.tabs.forEach((b) => b.classList.remove("isActive", "active"));
      btn.classList.add("isActive", "active");
      renderGrid();
    });
  });
}

function wireFilters() {
  if (els.searchInput) {
    els.searchInput.addEventListener("input", () => {
      state.search = String(els.searchInput.value || "").trim().toLowerCase();
      renderGrid();
    });
  }

  if (els.rarityFilter) {
    els.rarityFilter.addEventListener("change", () => {
      state.rarity = String(els.rarityFilter.value || "all").trim().toLowerCase();
      renderGrid();
    });
  }

  if (els.ownedFilter) {
    els.ownedFilter.addEventListener("change", () => {
      state.ownedFilter = String(els.ownedFilter.value || "all").trim().toLowerCase();
      renderGrid();
    });
  }

  if (els.collectionFilter) {
    els.collectionFilter.addEventListener("change", () => {
      state.collection = String(els.collectionFilter.value || "all").trim().toLowerCase();
      renderGrid();
    });
  }
}


/* --------------------------------------------------
   Data Loads
-------------------------------------------------- */

async function loadAllData() {
  clearError();

  const [summary, inventoryDocs, catalogItems] = await Promise.all([
    loadSummary({
      schoolId: state.schoolId,
      userId: state.userId,
    }),
    safeLoadInventory({
      schoolId: state.schoolId,
      userId: state.userId,
    }),
    loadCatalog({
      schoolId: state.schoolId,
    }),
  ]);

  state.summary = summary || {};
  state.rubiesBalance = Number(state.summary?.rubiesBalance || 0);

  state.ownedIds = new Set(
    (inventoryDocs || [])
      .map((x) => String(x.itemId || "").trim())
      .filter(Boolean)
  );

  state.catalog = catalogItems;
  state.collections = buildCollectionList(catalogItems);
}


async function safeLoadInventory({ schoolId, userId }) {
  try {
    const rows = await loadInventory({ schoolId, userId });

    if (Array.isArray(rows)) {
      return rows
        .map((row) => {
          if (!row) return null;
          return {
            itemId: String(row.itemId || row.id || "").trim(),
            ...row,
          };
        })
        .filter((row) => row && row.itemId);
    }
  } catch (err) {
    console.warn("loadInventory fallback triggered:", err);
  }

  // Fallback because uploaded app.js snippet appears to contain a typo in the map line.
  const invCol = collection(
    db,
    "readathonV2_schools",
    schoolId,
    "users",
    userId,
    "readathon",
    "summary",
    "inventory"
  );

  const qRef = query(invCol, orderBy("__name__"));
  const snap = await getDocs(qRef);

  return snap.docs.map((d) => ({
    itemId: d.id,
    ...d.data(),
  }));
}

async function loadCatalog({ schoolId }) {
  const colRef = collection(
    db,
    "readathonV2_schools",
    schoolId,
    "avatarCatalog",
    "catalog",
    "items"
  );

  const snap = await getDocs(colRef);

  const items = snap.docs
    .map((d) => normalizeCatalogItem(d.id, d.data()))
    .filter(Boolean)
    .filter((item) => item.active !== false);

  items.sort(compareCatalogItems);
  return items;
}

/* --------------------------------------------------
   Normalizers
-------------------------------------------------- */

function normalizeCatalogItem(id, raw = {}) {
  const imageUrl =
    raw.imageUrl ||
    raw.imagePath ||
    raw.assetUrl ||
    raw.previewUrl ||
    raw.thumbUrl ||
    raw.thumbnailUrl ||
    raw.pngUrl ||
    raw.url ||
    "";

  if (!imageUrl) return null;

  const slotRaw = String(
    raw.slot || raw.type || raw.category || raw.itemType || raw.kind || ""
  ).trim().toLowerCase();

  const subslotRaw = String(
    raw.subslot || raw.layer || raw.equipLayer || raw.wearableType || ""
  ).trim().toLowerCase();

  const name = String(raw.name || raw.title || raw.label || id).trim();

  const group = normalizeGroup(slotRaw, subslotRaw, raw);
  const wearableClass = normalizeWearableClass(slotRaw, subslotRaw, raw);

const collection = String(raw.collection || raw.set || raw.series || "")
  .trim()
  .toLowerCase();

const collectionItem = String(raw.collectionItem || raw.collectionKey || raw.element || "")
  .trim()
  .toLowerCase();

const isNew =
  raw.isNew === true ||
  raw.new === true ||
  String(raw.badge || "").trim().toLowerCase() === "new";

const season = String(raw.season || raw.event || "")
  .trim()
  .toLowerCase();

const seasonEnd = String(raw.seasonEnd || raw.eventEnd || "")
  .trim();

return {
  id,
  name,
  imageUrl,
  thumbUrl: raw.thumbnailUrl || raw.thumbUrl || raw.imagePath || imageUrl,
  slotRaw,
  subslotRaw,
  group,
  wearableClass,

  active: raw.active === false ? false : raw.enabled === false ? false : true,
  price: Number(raw.price ?? raw.cost ?? 0),
  rarity: String(raw.rarity || "").trim().toLowerCase(),
  sortOrder: Number(raw.sortOrder ?? raw.sort ?? raw.displayOrder ?? 9999),
  layerOrder: Number(raw.layerOrder ?? raw.zIndex ?? defaultLayerOrderFor(wearableClass)),
  description: String(raw.description || raw.desc || "").trim(),

  collection,
  collectionItem,
  isNew,
  season,
  seasonEnd,

  previewScale: Number(raw.previewScale ?? 1),
  previewOffsetJson: raw.previewOffsetJson || "{}",
  maxQty: Number(raw.maxQty ?? 1),

  raw,
};


}

function normalizeGroup(slot, subslot, raw = {}) {
  const s = `${slot} ${subslot} ${String(raw.roomLayer || "").toLowerCase()}`;

  if (s.includes("background")) return "background";
  if (s.includes("pet")) return "pets";
  if (s.includes("wall")) return "wall";
  if (s.includes("floor")) return "floor";

  if (
    s.includes("wearable") ||
    s.includes("avatar") ||
    s.includes("base") ||
    s.includes("body") ||
    s.includes("head") ||
    s.includes("accessory")
  ) {
    return "wearables";
  }

  return "wearables";
}

function normalizeWearableClass(slot, subslot, raw = {}) {
  const s = `${slot} ${subslot} ${String(raw.kind || "").toLowerCase()}`;

  if (s.includes("base") || s.includes("avatar") || s.includes("body")) return "base";
  if (s.includes("head") || s.includes("hair") || s.includes("hat") || s.includes("face")) return "head";
  if (s.includes("accessory") || s.includes("glasses") || s.includes("hand") || s.includes("prop")) return "accessory";

  if (normalizeGroup(slot, subslot, raw) === "wearables") return "accessory";
  return null;
}

function defaultLayerOrderFor(wearableClass) {
  if (wearableClass === "base") return 10;
  if (wearableClass === "head") return 30;
  if (wearableClass === "accessory") return 40;
  return 50;
}

function compareCatalogItems(a, b) {
  if (a.group !== b.group) return a.group.localeCompare(b.group);
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.price !== b.price) return a.price - b.price;
  return a.name.localeCompare(b.name);
}

function buildCollectionList(items = []) {
  const set = new Set();

  items.forEach((item) => {
    const value = String(item.collection || "").trim().toLowerCase();
    if (value) set.add(value);
  });

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}


/* --------------------------------------------------
   Rendering
-------------------------------------------------- */

function renderAll() {
  renderTopSummary();
  renderGrid();
}

function renderTopSummary() {
  if (els.rubiesBalance) {
    els.rubiesBalance.textContent = fmtInt(state.rubiesBalance);
  }

  if (els.ownedCount) {
    els.ownedCount.textContent = fmtInt(state.ownedIds.size);
  }

  if (els.shopSummary) {
    els.shopSummary.textContent =
      `${fmtInt(state.catalog.length)} catalog item${state.catalog.length === 1 ? "" : "s"} • ` +
      `${fmtInt(state.ownedIds.size)} owned`;
  }
}

function renderGrid() {
  if (!els.shopGrid) return;

  const items = getFilteredItems();

  if (els.emptyState) {
    els.emptyState.hidden = items.length > 0;
  }

  if (!items.length) {
    els.shopGrid.innerHTML = `
      <div class="shopEmptyCard">
        <div class="shopEmptyTitle">No items found</div>
        <div class="shopEmptyText">Try changing the tab or filters.</div>
      </div>
    `;
    return;
  }

  els.shopGrid.innerHTML = items.map(renderShopCard).join("");

  const buyButtons = Array.from(els.shopGrid.querySelectorAll("[data-buy-item-id]"));
  buyButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const itemId = String(btn.dataset.buyItemId || "").trim();
      if (!itemId) return;
      await handleBuy(itemId);
    });
  });
}

function renderShopCard(item) {
  const owned = isOwned(item.id);
  const affordable = state.rubiesBalance >= Number(item.price || 0);
  const buying = state.busyBuyItemId === item.id;

  let ctaText = "Buy";
  let ctaDisabled = false;
  let ctaClass = "shopBuyBtn";

  if (owned) {
    ctaText = "Owned";
    ctaDisabled = true;
    ctaClass += " isOwned";
  } else if (buying) {
    ctaText = "Buying…";
    ctaDisabled = true;
    ctaClass += " isBusy";
  } else if (!affordable) {
    ctaText = "Not enough rubies";
    ctaDisabled = true;
    ctaClass += " isLocked";
  }

  return `
    <article class="shopCard" data-item-id="${escapeHtml(item.id)}">
      <div class="shopThumbWrap">
        <img
          class="shopThumb"
          src="${escapeHtml(item.thumbUrl || item.imageUrl)}"
          alt="${escapeHtml(item.name)}"
          loading="lazy"
          decoding="async"
        >
        ${item.rarity ? `<span class="shopBadge">${escapeHtml(titleCase(item.rarity))}</span>` : ""}
      </div>

      <div class="shopCardBody">
        <div class="shopNameRow">
          <h3 class="shopName">${escapeHtml(item.name)}</h3>
        </div>

        <div class="shopMeta">
          <span class="shopMetaTag">${escapeHtml(labelForItem(item))}</span>
          <span class="shopMetaTag">${fmtInt(item.price)} rubies</span>
        </div>

        ${
          item.description
            ? `<p class="shopDesc">${escapeHtml(item.description)}</p>`
            : `<p class="shopDesc">${escapeHtml(defaultDescriptionForItem(item))}</p>`
        }

        <div class="shopActions">
          <button
            type="button"
            class="${ctaClass}"
            data-buy-item-id="${escapeHtml(item.id)}"
            ${ctaDisabled ? "disabled" : ""}
          >
            ${escapeHtml(ctaText)}
          </button>
        </div>
      </div>
    </article>
  `;
}

/* --------------------------------------------------
   Filters
-------------------------------------------------- */

function getFilteredItems() {
  return state.catalog.filter((item) => {
    if (!matchesTab(item)) return false;
    if (!matchesSearch(item)) return false;
    if (!matchesRarity(item)) return false;
    if (!matchesOwnedFilter(item)) return false;
    if (!matchesCollection(item)) return false;
    return true;
  });
}


function matchesTab(item) {
  if (state.tab === "all") return true;
  if (state.tab === "wearables") return item.group === "wearables";
  if (state.tab === "background") return item.group === "background";
  if (state.tab === "pets") return item.group === "pets";
  if (state.tab === "wall") return item.group === "wall";
  if (state.tab === "floor") return item.group === "floor";
  return true;
}

function matchesSearch(item) {
  if (!state.search) return true;

const hay = [
  item.id,
  item.name,
  item.group,
  item.wearableClass,
  item.rarity,
  item.description,
  item.collection,
  item.collectionItem,
]

    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(state.search);
}

function matchesRarity(item) {
  if (!state.rarity || state.rarity === "all") return true;
  return String(item.rarity || "").toLowerCase() === state.rarity;
}

function matchesOwnedFilter(item) {
  if (state.ownedFilter === "owned") return isOwned(item.id);
  if (state.ownedFilter === "unowned") return !isOwned(item.id);
  return true;
}

function matchesCollection(item) {
  if (!state.collection || state.collection === "all") return true;
  return String(item.collection || "").trim().toLowerCase() === state.collection;
}

/* --------------------------------------------------
   Purchase Flow
-------------------------------------------------- */

async function handleBuy(itemId) {
  const item = state.catalog.find((x) => x.id === itemId);
  if (!item) {
    showError("That item could not be found.");
    return;
  }

  if (isOwned(itemId)) {
    showTransientMessage(`${item.name} is already owned.`);
    return;
  }

  if (state.rubiesBalance < Number(item.price || 0)) {
    showError(`You need ${fmtInt(item.price)} rubies for ${item.name}.`);
    return;
  }

  clearError();
  state.busyBuyItemId = itemId;
  renderGrid();

  try {
    await waitForAuthReady();

    if (!auth.currentUser) {
      throw new Error("Please sign in again.");
    }

    await auth.currentUser.getIdToken(true);

    const result = await fnBuyAvatarItem({
      schoolId: state.schoolId,
      itemId,
    });

    const data = result?.data || result || {};
    if (!data?.ok) {
      throw new Error("Purchase failed.");
    }

    await refreshAfterPurchase();
    showTransientMessage(`Purchased ${item.name}!`);
  } catch (err) {
    console.error("buyAvatarItem failed:", err);
    showError(normalizeErrorPurchase(err, item));
  } finally {
    state.busyBuyItemId = null;
    renderAll();
  }
}

async function refreshAfterPurchase() {
  const [summary, inventoryDocs] = await Promise.all([
    loadSummary({
      schoolId: state.schoolId,
      userId: state.userId,
    }),
    safeLoadInventory({
      schoolId: state.schoolId,
      userId: state.userId,
    }),
  ]);

  state.summary = summary || {};
  state.rubiesBalance = Number(state.summary?.rubiesBalance || 0);
  state.ownedIds = new Set(
    (inventoryDocs || [])
      .map((x) => String(x.itemId || "").trim())
      .filter(Boolean)
  );
}

/* --------------------------------------------------
   Small Helpers
-------------------------------------------------- */

function isOwned(itemId) {
  return state.ownedIds.has(String(itemId || "").trim());
}

function labelForItem(item) {
  if (item.group === "wearables") {
    return item.wearableClass ? `wearable • ${item.wearableClass}` : "wearable";
  }
  if (item.group === "background") return "background";
  if (item.group === "pets") return "pet";
  if (item.group === "wall") return "wall item";
  if (item.group === "floor") return "floor item";
  return item.group || "item";
}

function defaultDescriptionForItem(item) {
  switch (item.group) {
    case "background":
      return "A room background for your Avatar World.";
    case "pets":
      return "A pet friend you can place in your room.";
    case "wall":
      return "A wall decoration for your room.";
    case "floor":
      return "A floor item for your room.";
    case "wearables":
    default:
      return "A wearable item for your avatar.";
  }
}

function titleCase(s) {
  return String(s || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeErrorPurchase(err, item) {
  const raw =
    err?.message ||
    err?.details?.message ||
    err?.details ||
    err?.toString?.() ||
    "Purchase failed.";

  const msg = String(raw);

  if (/already/i.test(msg) && /owned/i.test(msg)) {
    return `${item.name} is already owned.`;
  }
  if (/not enough/i.test(msg) || /insufficient/i.test(msg)) {
    return `Not enough rubies for ${item.name}.`;
  }
  if (/unauth/i.test(msg) || /sign in/i.test(msg)) {
    return "Please sign in again.";
  }
  return msg;
}

function showError(message) {
  if (!els.errorBox) return;
  els.errorBox.hidden = false;
  els.errorBox.textContent = message || "Something went wrong.";
}

function clearError() {
  if (!els.errorBox) return;
  els.errorBox.hidden = true;
  els.errorBox.textContent = "";
}

function showTransientMessage(message) {
  if (!els.shopSummary) return;
  const original = `${fmtInt(state.catalog.length)} catalog item${state.catalog.length === 1 ? "" : "s"} • ${fmtInt(state.ownedIds.size)} owned`;
  els.shopSummary.textContent = message;
  window.clearTimeout(showTransientMessage._t);
  showTransientMessage._t = window.setTimeout(() => {
    if (els.shopSummary) els.shopSummary.textContent = original;
  }, 2200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}