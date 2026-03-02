// /readathon-world_Ver2/js/avatar-world.js
// Fully fixed + Option 1 compliant (function-owned summary + inventory):
// - Uses callable fnBuyAvatarItem (NO client runTransaction for purchases)
// - Removes broken duplicate / stray code
// - Moves all imports to the top (ESM requirement)
// - Keeps your room state client-writable (per rules)
// - Catalog load + optional seeding (staff/admin) still works

import {
  auth,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  db,
  fnBuyAvatarItem,
} from "/readathon-world_Ver2/js/firebase.js";

import {
  ABS,
  guardRoleOrRedirect,
  loadSummary,
  loadInventory,
  fmtInt,
  normalizeError,
} from "/readathon-world_Ver2/js/app.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ----------------------------
  Elements
---------------------------- */
const els = {
  btnBack: document.getElementById("btnBack"),
  btnShop: document.getElementById("btnShop"),
  btnInv: document.getElementById("btnInv"),
  btnDebug: document.getElementById("btnDebug"),

  awSubtitle: document.getElementById("awSubtitle"),
  rubiesBalance: document.getElementById("rubiesBalance"),

  invDrawer: document.getElementById("invDrawer"),
  btnInvClose: document.getElementById("btnInvClose"),

  shopModal: document.getElementById("shopModal"),
  btnShopClose: document.getElementById("btnShopClose"),
  shopGrid: document.getElementById("shopGrid"),

  toast: document.getElementById("toast"),

  // Room background
  roomBackground: document.getElementById("roomBackground"),

  panelWear: document.getElementById("panelWear"),
  panelPets: document.getElementById("panelPets"),
  panelWall: document.getElementById("panelWall"),
  panelFloor: document.getElementById("panelFloor"),

  // Avatar layers
  avatarBase: document.getElementById("avatarBase"),
  avatarBody: document.getElementById("avatarBody"),
  avatarHead: document.getElementById("avatarHead"),
  avatarAcc: document.getElementById("avatarAcc"),
};

const tabs = Array.from(document.querySelectorAll(".tab"));

const zoneEls = {
  wall1: document.querySelector('.zoneItem[data-slot="wall1"]'),
  wall2: document.querySelector('.zoneItem[data-slot="wall2"]'),
  floor1: document.querySelector('.zoneItem[data-slot="floor1"]'),
  floor2: document.querySelector('.zoneItem[data-slot="floor2"]'),
  pet: document.querySelector('.zoneItem[data-slot="pet"]'),
};

/* ----------------------------
  Local state
---------------------------- */
let ctx = { schoolId: "", userId: "", role: "" };
let summaryCache = null;
let invCache = [];
let roomState = null;

let catalogList = [];
let catalogById = new Map(); // itemId -> itemDoc

/* ----------------------------
  UI helpers
---------------------------- */
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("on");
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => els.toast.classList.remove("on"), 1600);
}

function openDrawer() {
  els.invDrawer.setAttribute("aria-hidden", "false");
  els.btnInv.setAttribute("aria-expanded", "true");
}
function closeDrawer() {
  els.invDrawer.setAttribute("aria-hidden", "true");
  els.btnInv.setAttribute("aria-expanded", "false");
}

function openShop() {
  els.shopModal.setAttribute("aria-hidden", "false");
}
function closeShop() {
  els.shopModal.setAttribute("aria-hidden", "true");
}

function setTab(tabName) {
  tabs.forEach((t) =>
    t.setAttribute("aria-selected", String(t.dataset.tab === tabName))
  );
  const panels = [els.panelWear, els.panelPets, els.panelWall, els.panelFloor];
  for (const p of panels) {
    p.classList.toggle("isHidden", p.dataset.panel !== tabName);
  }
}

function renderSummaryIntoTopbar(summary) {
  const rubiesBal = summary?.rubiesBalance ?? 0;
  els.rubiesBalance.textContent = fmtInt(rubiesBal);
}

function placeholder(text) {
  const d = document.createElement("div");
  d.className = "ph";
  d.textContent = text;
  return d;
}

function invQty(itemId) {
  const row = invCache.find((x) => x.itemId === itemId);
  return Number(row?.qty || 0);
}

function isOwned(itemId) {
  return invQty(itemId) > 0;
}

function prettyItemId(itemId) {
  return String(itemId || "")
    .replace(/^item_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/* ----------------------------
  Firestore refs
---------------------------- */
function roomStateRef(schoolId, userId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    "users",
    userId,
    "avatarRoom",
    "state"
  );
}

function catalogColRef(schoolId) {
  return collection(
    db,
    "readathonV2_schools",
    schoolId,
    "avatarCatalog",
    "catalog",     // 👈 NEW
    "items"
  );
}

/* ----------------------------
  Room state load/save
---------------------------- */
async function loadOrCreateRoomState() {
  const ref = roomStateRef(ctx.schoolId, ctx.userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const fresh = {
      equipped: { base: null, head: null, body: null, accessory: null, pet: null, background: null },
      placed: { wall1: null, wall2: null, floor1: null, floor2: null },
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, fresh, { merge: true });
    return fresh;
  }

  const d = snap.data() || {};
  return {
    equipped: {
      base: null,
      background: null,
      head: null,
      body: null,
      accessory: null,
      pet: null,
      ...(d.equipped || {}),
    },
    placed: {
      wall1: null,
      wall2: null,
      floor1: null,
      floor2: null,
      ...(d.placed || {}),
    },
  };
}

async function saveRoomState() {
  const ref = roomStateRef(ctx.schoolId, ctx.userId);
  await setDoc(ref, { ...roomState, updatedAt: serverTimestamp() }, { merge: true });
}

/* ----------------------------
  Catalog load
---------------------------- */
async function loadCatalog() {
  const qRef = query(catalogColRef(ctx.schoolId), orderBy("__name__"));
  const snap = await getDocs(qRef);

  const items = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    if (x.enabled === false) return;
    const itemId = x.itemId || d.id;
    items.push({ ...x, itemId });
  });

  catalogList = items;
  catalogById = new Map(items.map((it) => [it.itemId, it]));
}

/* ----------------------------
  Rendering: Room
---------------------------- */
function applyRoomBackground(itemId) {
  if (!els.roomBackground) return;

  // default background (keep this file in your assets)
  const fallback = "/readathon-world_Ver2/img/bg/index.png";

  if (!itemId) {
    els.roomBackground.src = fallback;
    return;
  }
  const it = catalogById.get(itemId);
  const src = it?.imagePath || fallback;
  els.roomBackground.src = src;
}

function applyAvatarBase(imgEl, itemId) {
  if (!imgEl) return;

  // If no base equipped, keep whatever default is in the HTML (do nothing)
  if (!itemId) return;

  const it = catalogById.get(itemId);
  const src = it?.imagePath || "";
  if (src) imgEl.src = src;
}

function applyAvatarLayer(imgEl, itemId) {
  if (!imgEl) return;

  if (!itemId) {
    imgEl.src = "";
    imgEl.style.opacity = "0";
    return;
  }
  const it = catalogById.get(itemId);
  const src = it?.imagePath || "";
  imgEl.src = src;
  imgEl.style.opacity = src ? "1" : "0";
}

function renderZone(slotKey, label, itemId) {
  const holder = zoneEls[slotKey];
  if (!holder) return;

  holder.innerHTML = "";

  if (!itemId) {
    holder.appendChild(placeholder(label));
    return;
  }

  if (!isOwned(itemId)) {
    holder.appendChild(placeholder(`${label}\n(Not owned)`));
    return;
  }

  const it = catalogById.get(itemId);
  if (!it?.imagePath) {
    holder.appendChild(placeholder(`${label}\n${prettyItemId(itemId)}`));
    return;
  }

  const img = document.createElement("img");
  img.className = "placedImg";
  img.alt = it.name || prettyItemId(itemId);
  img.loading = "lazy";
  img.src = it.imagePath;
  img.onerror = () => {
    holder.innerHTML = "";
    holder.appendChild(placeholder(`${label}\n(missing image)`));
  };
  holder.appendChild(img);
}

function renderRoom() {
  if (!roomState) return;

  // Background (catalog-driven)
  applyRoomBackground(roomState.equipped.background);

  // Avatar layers (catalog-driven)
  applyAvatarBase(els.avatarBase, roomState.equipped.base);
  applyAvatarLayer(els.avatarHead, roomState.equipped.head);
  applyAvatarLayer(els.avatarBody, roomState.equipped.body);
  applyAvatarLayer(els.avatarAcc, roomState.equipped.accessory);

  renderZone("pet", "Pet", roomState.equipped.pet);
  renderZone("wall1", "Wall 1", roomState.placed.wall1);
  renderZone("wall2", "Wall 2", roomState.placed.wall2);
  renderZone("floor1", "Floor 1", roomState.placed.floor1);
  renderZone("floor2", "Floor 2", roomState.placed.floor2);
}

/* ----------------------------
  Rendering: Inventory drawer
---------------------------- */
function typeForItemId(itemId) {
  const it = catalogById.get(itemId);
  if (it?.type) return it.type;

  const id = String(itemId || "").toLowerCase();
  if (id.includes("head")) return "head";
  if (id.includes("body") || id.includes("shirt") || id.includes("outfit")) return "body";
  if (id.includes("pet")) return "pet";
  if (id.includes("wall")) return "wall";
  if (id.includes("floor")) return "floor";
  return "accessory";
}

function panelForType(type) {
  if (type === "pet") return "pets";
  if (type === "wall") return "wall";
  if (type === "floor") return "floor";
  return "wear";
}

function renderInventoryPanels() {
  const owned = invCache.filter((x) => Number(x.qty || 0) > 0);

  els.panelWear.innerHTML = "";
  els.panelPets.innerHTML = "";
  els.panelWall.innerHTML = "";
  els.panelFloor.innerHTML = "";

  if (!owned.length) {
    els.panelWear.appendChild(placeholder("No items yet. Earn rubies to buy avatar items!"));
    return;
  }

  for (const row of owned) {
    const itemId = row.itemId;
    const qty = Number(row.qty || 0);
    const it = catalogById.get(itemId);
    const type = typeForItemId(itemId);
    const panel = panelForType(type);

    const card = document.createElement("div");
    card.className = "card";
    // Drag payload: itemId + type
    card.classList.add("draggableCard");
    card.draggable = true;
    card.addEventListener("dragstart", (e) => {
      try {
        e.dataTransfer.setData("text/plain", JSON.stringify({ itemId, type }));
        e.dataTransfer.effectAllowed = "move";
      } catch {}
    });

    const imgWrap = document.createElement("div");
    imgWrap.className = "cardImg";

    if (it?.imagePath) {
      const img = document.createElement("img");
      img.alt = it.name || prettyItemId(itemId);
      img.loading = "lazy";
      img.src = it.imagePath;
      img.onerror = () => {
        imgWrap.innerHTML = "";
        imgWrap.appendChild(placeholder("missing image"));
      };
      imgWrap.appendChild(img);
    } else {
      imgWrap.appendChild(placeholder("no image"));
    }

    const name = document.createElement("div");
    name.className = "cardName";
    name.textContent = it?.name || prettyItemId(itemId);

    const meta = document.createElement("div");
    meta.className = "cardMeta";
    meta.innerHTML = `<span>${type}</span><span>x${qty}</span>`;

    const actions = document.createElement("div");
    actions.className = "cardActions";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "action actionGo";
    btn.textContent = (type === "wall" || type === "floor") ? "Place" : "Equip";

    btn.addEventListener("click", async () => {
      try {
        await onUseItem({ itemId, type });
      } catch (e) {
        toast(normalizeError(e));
      }
    });

    actions.appendChild(btn);

    card.appendChild(imgWrap);
    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(actions);

    const targetPanel =
      panel === "wear" ? els.panelWear :
      panel === "pets" ? els.panelPets :
      panel === "wall" ? els.panelWall :
      els.panelFloor;

    targetPanel.appendChild(card);
  }
}

/* ----------------------------
  Equip / Place / Remove
---------------------------- */
async function onUseItem({ itemId, type }) {
  if (!roomState) return;

  if (!isOwned(itemId)) {
    toast("You don’t own that item yet.");
    return;
  }

  // ✅ NEW: Background (room) + Base (avatar)
  if (type === "background" || type === "roomBg" || type === "room_bg" || type === "bg") {
    roomState.equipped.background = roomState.equipped.background === itemId ? null : itemId;
    await saveRoomState();
    renderRoom();
    toast(roomState.equipped.background ? "Background equipped!" : "Background removed!");
    return;
  }

  if (type === "base" || type === "avatarBase" || type === "avatar_base") {
    roomState.equipped.base = roomState.equipped.base === itemId ? null : itemId;
    await saveRoomState();
    renderRoom();
    toast(roomState.equipped.base ? "Base equipped!" : "Base removed!");
    return;
  }

  if (type === "head") {
    roomState.equipped.head = roomState.equipped.head === itemId ? null : itemId;
    await saveRoomState();
    renderRoom();
    toast(roomState.equipped.head ? "Head equipped!" : "Head removed!");
    return;
  }

  if (type === "body") {
    roomState.equipped.body = roomState.equipped.body === itemId ? null : itemId;
    await saveRoomState();
    renderRoom();
    toast(roomState.equipped.body ? "Outfit equipped!" : "Outfit removed!");
    return;
  }

  if (type === "accessory") {
    roomState.equipped.accessory = roomState.equipped.accessory === itemId ? null : itemId;
    await saveRoomState();
    renderRoom();
    toast(roomState.equipped.accessory ? "Accessory equipped!" : "Accessory removed!");
    return;
  }

  if (type === "pet") {
    roomState.equipped.pet = roomState.equipped.pet === itemId ? null : itemId;
    await saveRoomState();
    renderRoom();
    toast(roomState.equipped.pet ? "Pet equipped!" : "Pet removed!");
    return;
  }

  if (type === "wall") {
    const slot = !roomState.placed.wall1 ? "wall1" : (!roomState.placed.wall2 ? "wall2" : null);
    if (!slot) {
      toast("Wall slots are full. Tap a wall slot to remove it first.");
      return;
    }
    roomState.placed[slot] = itemId;
    await saveRoomState();
    renderRoom();
    toast("Placed on the wall!");
    return;
  }

  if (type === "floor") {
    const slot = !roomState.placed.floor1 ? "floor1" : (!roomState.placed.floor2 ? "floor2" : null);
    if (!slot) {
      toast("Floor slots are full. Tap a floor slot to remove it first.");
      return;
    }
    roomState.placed[slot] = itemId;
    await saveRoomState();
    renderRoom();
    toast("Placed on the floor!");
    return;
  }
}

async function removeSlot(slotKey) {
  if (!roomState) return;

  if (slotKey === "pet") roomState.equipped.pet = null;
  else roomState.placed[slotKey] = null;

  await saveRoomState();
  renderRoom();
  toast("Removed!");
}

/* ----------------------------
  Shop (catalog + buy)
---------------------------- */
function renderShop() {
  els.shopGrid.innerHTML = "";

  if (!catalogList.length) {
    els.shopGrid.appendChild(placeholder("No shop items yet."));
    return;
  }

  for (const it of catalogList) {
    const itemId = it.itemId;
    const owned = isOwned(itemId);

    const card = document.createElement("div");
    card.className = "card";
    // Drag payload: itemId + type
    card.classList.add("draggableCard");
    card.draggable = true;
    card.addEventListener("dragstart", (e) => {
      try {
        e.dataTransfer.setData("text/plain", JSON.stringify({ itemId, type }));
        e.dataTransfer.effectAllowed = "move";
      } catch {}
    });

    const imgWrap = document.createElement("div");
    imgWrap.className = "cardImg";
    if (it.imagePath) {
      const img = document.createElement("img");
      img.alt = it.name || prettyItemId(itemId);
      img.loading = "lazy";
      img.src = it.imagePath;
      img.onerror = () => {
        imgWrap.innerHTML = "";
        imgWrap.appendChild(placeholder("missing image"));
      };
      imgWrap.appendChild(img);
    } else {
      imgWrap.appendChild(placeholder("no image"));
    }

    const name = document.createElement("div");
    name.className = "cardName";
    name.textContent = it.name || prettyItemId(itemId);

    const meta = document.createElement("div");
    meta.className = "cardMeta";
    meta.innerHTML = `<span>${it.type || typeForItemId(itemId)}</span><span>💎 ${fmtInt(it.price || 0)}</span>`;

    const actions = document.createElement("div");
    actions.className = "cardActions";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "action actionGo";
    btn.textContent = owned ? "Buy (+1)" : "Buy";

    btn.addEventListener("click", async () => {
      try {
        btn.disabled = true;
        await buyItem(it);
      } catch (e) {
        toast(normalizeError(e));
      } finally {
        btn.disabled = false;
      }
    });

    actions.appendChild(btn);

    card.appendChild(imgWrap);
    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(actions);

    els.shopGrid.appendChild(card);
  }
}

async function buyItem(item) {
  const itemId = item.itemId;

  // ✅ Option 1 rules: must buy via Cloud Function
  const res = await fnBuyAvatarItem({ itemId });
  // res is a callable result object: { data: ... }
  // We don't strictly need it, but it can be useful for debugging:
  // console.log("buyAvatarItem:", res.data);

  // Refresh using your existing loaders
  summaryCache = await loadSummary({ schoolId: ctx.schoolId, userId: ctx.userId });
  invCache = await loadInventory({ schoolId: ctx.schoolId, userId: ctx.userId });

  renderSummaryIntoTopbar(summaryCache);
  renderInventoryPanels();
  renderRoom();

  toast(`Bought: ${item.name || prettyItemId(itemId)} ✅`);
}

/* ----------------------------
  Optional: seed catalog from client (staff/admin)
  NOTE: This requires your rules allow staff/admin writes to avatarCatalog.
---------------------------- */
async function seedCatalogIfAllowed() {
  if (!(ctx.role === "staff" || ctx.role === "admin")) {
    toast("Only staff/admin can seed the shop.");
    return;
  }

  const seed = [
    { itemId: "item_head_explorer_hat", name: "Explorer Hat", type: "head", price: 50, imagePath: "/readathon-world_Ver2/assets/avatar/wearables/head/explorer_hat.png", enabled: true },
    { itemId: "item_body_jungle_vest", name: "Jungle Vest", type: "body", price: 80, imagePath: "/readathon-world_Ver2/assets/avatar/wearables/body/jungle_vest.png", enabled: true },
    { itemId: "item_accessory_binoculars", name: "Binoculars", type: "accessory", price: 60, imagePath: "/readathon-world_Ver2/assets/avatar/wearables/accessory/binoculars.png", enabled: true },
    { itemId: "item_pet_toucan", name: "Toucan Buddy", type: "pet", price: 100, imagePath: "/readathon-world_Ver2/assets/avatar/pets/toucan.png", enabled: true },
    { itemId: "item_wall_map_poster", name: "Treasure Map Poster", type: "wall", price: 70, imagePath: "/readathon-world_Ver2/assets/avatar/room/wall/map_poster.png", enabled: true },
    { itemId: "item_floor_guitar", name: "Campfire Guitar", type: "floor", price: 120, imagePath: "/readathon-world_Ver2/assets/avatar/room/floor/guitar.png", enabled: true },
  ];

  toast("Seeding shop…");
  for (const it of seed) {
const ref = doc(db, "readathonV2_schools", ctx.schoolId, "avatarCatalog", "catalog", "items", it.itemId);
    await setDoc(ref, { ...it, createdAt: serverTimestamp() }, { merge: true });
  }

  await loadCatalog();
  renderShop();
  toast("Shop seeded ✅");
}

/* ----------------------------
  Wire UI
---------------------------- */
function wireUI() {
  els.btnBack.addEventListener("click", () => (window.location.href = ABS.studentHome));

  els.btnInv.addEventListener("click", () => {
    const open = els.invDrawer.getAttribute("aria-hidden") === "false";
    if (open) closeDrawer();
    else openDrawer();
  });
  els.btnInvClose.addEventListener("click", closeDrawer);

  els.btnShop.addEventListener("click", () => {
    openShop();
    renderShop();
  });
  els.btnShopClose.addEventListener("click", closeShop);

  els.shopModal.addEventListener("click", (e) => {
    if (e.target === els.shopModal) closeShop();
  });

  tabs.forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));

  els.btnDebug.addEventListener("click", () => {
    const on = document.body.classList.toggle("debugOn");
    els.btnDebug.setAttribute("aria-pressed", String(on));
    toast(on ? "Debug ON (zone outlines)" : "Debug OFF");
  });

  // Drag & Drop from Inventory -> Room
  wireDragDrop();

  // Tap filled zones to remove
  zoneEls.pet?.addEventListener("click", () => (roomState?.equipped?.pet ? removeSlot("pet") : null));
  zoneEls.wall1?.addEventListener("click", () => (roomState?.placed?.wall1 ? removeSlot("wall1") : null));
  zoneEls.wall2?.addEventListener("click", () => (roomState?.placed?.wall2 ? removeSlot("wall2") : null));
  zoneEls.floor1?.addEventListener("click", () => (roomState?.placed?.floor1 ? removeSlot("floor1") : null));
  zoneEls.floor2?.addEventListener("click", () => (roomState?.placed?.floor2 ? removeSlot("floor2") : null));

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (els.shopModal.getAttribute("aria-hidden") === "false") closeShop();
      if (els.invDrawer.getAttribute("aria-hidden") === "false") closeDrawer();
    }
  });
}


function wireDragDrop() {
  const roomEl = document.querySelector(".room");
  const bgEl = els.roomBackground;

  const targets = [
    { el: document.getElementById("zone-avatar"), accepts: ["head","body","accessory","base","avatarBase","avatar_base"] },
    { el: document.getElementById("zone-pet"), accepts: ["pet"] },
    { el: document.getElementById("zone-wall-1"), accepts: ["wall"] , slotKey: "wall1" },
    { el: document.getElementById("zone-wall-2"), accepts: ["wall"] , slotKey: "wall2" },
    { el: document.getElementById("zone-floor-1"), accepts: ["floor"], slotKey: "floor1" },
    { el: document.getElementById("zone-floor-2"), accepts: ["floor"], slotKey: "floor2" },
  ];

  // Background drop target: drop anywhere on the room background
  if (roomEl) {
    roomEl.addEventListener("dragover", (e) => {
      // only allow if payload is a background
      const t = e.dataTransfer?.types?.includes("text/plain");
      if (!t) return;
      e.preventDefault();
    });

    roomEl.addEventListener("drop", async (e) => {
      const raw = e.dataTransfer?.getData("text/plain") || "";
      const payload = safeParseDragPayload(raw);
      if (!payload) return;

      const { itemId, type } = payload;
      if (!itemId) return;

      if (isBackgroundType(type)) {
        e.preventDefault();
        await equipBackground(itemId);
      }
    });
  }

  for (const t of targets) {
    if (!t.el) continue;

    t.el.addEventListener("dragover", (e) => {
      const raw = e.dataTransfer?.getData("text/plain") || "";
      const payload = safeParseDragPayload(raw);
      if (!payload) return;

      const ok = canDropType(payload.type, t.accepts);
      if (!ok) return;

      e.preventDefault();
      t.el.classList.add("dropHover");
    });

    t.el.addEventListener("dragleave", () => t.el.classList.remove("dropHover"));

    t.el.addEventListener("drop", async (e) => {
      t.el.classList.remove("dropHover");
      const raw = e.dataTransfer?.getData("text/plain") || "";
      const payload = safeParseDragPayload(raw);
      if (!payload) return;

      const { itemId, type } = payload;
      if (!itemId) return;

      const ok = canDropType(type, t.accepts);
      if (!ok) return;

      e.preventDefault();

      // Slot-specific placement for wall/floor
      if (t.slotKey && (type === "wall" || type === "floor")) {
        await placeIntoSpecificSlot(t.slotKey, itemId, type);
        return;
      }

      // Pet slot
      if (t.el.id === "zone-pet" && type === "pet") {
        await toggleEquip("pet", itemId);
        return;
      }

      // Avatar stack
      if (t.el.id === "zone-avatar") {
        if (isBaseType(type)) await toggleEquip("base", itemId);
        else if (type === "head") await toggleEquip("head", itemId);
        else if (type === "body") await toggleEquip("body", itemId);
        else if (type === "accessory") await toggleEquip("accessory", itemId);
        return;
      }
    });
  }
}

function safeParseDragPayload(raw) {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return { itemId: String(obj.itemId || ""), type: String(obj.type || "") };
  } catch {
    return null;
  }
}

function isBackgroundType(type) {
  const t = String(type || "");
  return t === "background" || t === "roomBg" || t === "room_bg" || t === "bg";
}
function isBaseType(type) {
  const t = String(type || "");
  return t === "base" || t === "avatarBase" || t === "avatar_base";
}
function canDropType(type, accepts) {
  const t = String(type || "");
  if (accepts.includes(t)) return true;
  // allow base synonyms
  if (isBaseType(t) && accepts.includes("base")) return true;
  return false;
}

async function toggleEquip(slotKey, itemId) {
  if (!roomState) return;
  const cur = roomState?.equipped?.[slotKey] || null;
  roomState.equipped[slotKey] = cur === itemId ? null : itemId;
  await saveRoomState();
  renderRoom();
  toast(roomState.equipped[slotKey] ? "Equipped!" : "Removed!");
}

async function equipBackground(itemId) {
  if (!roomState) return;
  const cur = roomState?.equipped?.background || null;
  roomState.equipped.background = cur === itemId ? null : itemId;
  await saveRoomState();
  renderRoom();
  toast(roomState.equipped.background ? "Background equipped!" : "Background removed!");
}

async function placeIntoSpecificSlot(slotKey, itemId, type) {
  if (!roomState) return;

  // Only allow correct types
  if (type === "wall" && !(slotKey === "wall1" || slotKey === "wall2")) return;
  if (type === "floor" && !(slotKey === "floor1" || slotKey === "floor2")) return;

  // If already occupied with same item, toggle remove
  if (roomState.placed[slotKey] === itemId) {
    roomState.placed[slotKey] = null;
    await saveRoomState();
    renderRoom();
    toast("Removed!");
    return;
  }

  // If slot occupied with different item, replace it
  roomState.placed[slotKey] = itemId;
  await saveRoomState();
  renderRoom();
  toast(type === "wall" ? "Placed on the wall!" : "Placed on the floor!");
}


/* ----------------------------
  Init
---------------------------- */
async function init() {
  wireUI();

  const claims = await guardRoleOrRedirect(["student", "staff", "admin"], ABS.index);
  if (!claims) return;

  ctx.role = claims.role || "";
  ctx.schoolId = claims.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  ctx.userId = claims.userId || auth.currentUser?.uid;

  els.awSubtitle.textContent = `${ctx.schoolId} • ${ctx.userId}`;

  summaryCache = await loadSummary({ schoolId: ctx.schoolId, userId: ctx.userId });
  renderSummaryIntoTopbar(summaryCache);

  invCache = await loadInventory({ schoolId: ctx.schoolId, userId: ctx.userId });

  await loadCatalog();

  roomState = await loadOrCreateRoomState();

  renderInventoryPanels();
  renderRoom();

  // Staff/Admin seed shortcut
  if ((ctx.role === "staff" || ctx.role === "admin") && catalogList.length === 0) {
    toast("Shop is empty. Staff/Admin: press Shift+S to seed.");
  }
  window.addEventListener("keydown", async (e) => {
    if (e.shiftKey && (e.key === "S" || e.key === "s")) {
      try {
        await seedCatalogIfAllowed();
      } catch (err) {
        toast(normalizeError(err));
      }
    }
  });

  toast("Avatar World loaded! 🏡✨");
}

init().catch((e) => {
  console.error(e);
  toast(normalizeError(e));
});
