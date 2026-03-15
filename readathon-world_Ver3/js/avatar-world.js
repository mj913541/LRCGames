// /readathon-world_Ver2/js/avatar-world.js

import {
  auth,
  db,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  waitForAuthReady,
} from "./firebase.js";

import {
  ABS,
  guardRoleOrRedirect,
  normalizeError,
} from "./app.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ---------------------------------------
   DOM
--------------------------------------- */

const els = {
  btnBack: document.getElementById("btnBack"),
  btnSave: document.getElementById("btnSave"),
  btnReset: document.getElementById("btnReset"),
  btnDeleteSelected: document.getElementById("btnDeleteSelected"),
  btnUnequipTab: document.getElementById("btnUnequipTab"),

  headerUser: document.getElementById("headerUser"),
  statusText: document.getElementById("statusText"),

  roomCanvas: document.getElementById("roomCanvas"),
  roomBackground: document.getElementById("roomBackground"),
  wallLayer: document.getElementById("wallLayer"),
  avatarLayer: document.getElementById("avatarLayer"),
  petLayer: document.getElementById("petLayer"),
  floorLayer: document.getElementById("floorLayer"),

  tabs: Array.from(document.querySelectorAll(".aw-tab")),
  inventorySummary: document.getElementById("inventorySummary"),
  inventoryGrid: document.getElementById("inventoryGrid"),
};

/* ---------------------------------------
   State
--------------------------------------- */

const state = {
  schoolId: DEFAULT_SCHOOL_ID,
  userId: "",
  role: "",

  catalog: [],
  catalogById: new Map(),
  ownedIds: new Set(),
  ownedItems: [],

  tab: "wearables",

  room: makeDefaultRoomState(),
  savedRoomSnapshot: null,

  selectedPlacement: null, // { kind, index }
  drag: null, // move or resize interaction
};

/* ---------------------------------------
   Boot
--------------------------------------- */

init().catch((err) => {
  console.error("avatar-world init failed:", err);
  setStatus(normalizeError(err), true);
});

async function init() {
  wireUI();

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

  renderHeaderUser();
  setStatus("Loading Avatar World…");

  await loadAllData();

  renderAll();
  setStatus("Room loaded.");
}

/* ---------------------------------------
   Defaults
--------------------------------------- */

function makeDefaultRoomState() {
  return {
    backgroundId: null,
    avatarBaseId: null,
    wearableIds: [],
    avatarPlacement: defaultPlacementForGroup("avatar"),
    petPlacements: [],
    wallPlacements: [],
    floorPlacements: [],
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* ---------------------------------------
   Wiring
--------------------------------------- */

function wireUI() {
  els.btnBack?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "../html/avatar-shop.html";
  });

  els.btnSave?.addEventListener("click", saveRoom);
  els.btnReset?.addEventListener("click", resetRoomToLastSave);
  els.btnDeleteSelected?.addEventListener("click", deleteSelectedPlacement);
  els.btnUnequipTab?.addEventListener("click", unequipCurrentTab);

  els.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = String(btn.dataset.tab || "wearables");
      els.tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      clearSelection({ rerender: false });
      renderInventory();
      renderRoom();
    });
  });

  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  els.roomCanvas?.addEventListener("click", (e) => {
    const clickedObject = e.target.closest(".aw-room-object");
    if (!clickedObject) clearSelection();
  });

  els.roomCanvas?.addEventListener("dragstart", (e) => {
    e.preventDefault();
  });
}

/* ---------------------------------------
   Loaders
--------------------------------------- */

async function loadAllData() {
  const [catalog, ownedInventory, room] = await Promise.all([
    loadCatalog(state.schoolId),
    loadOwnedInventory(state.schoolId, state.userId),
    loadRoomState(state.schoolId, state.userId),
  ]);

  state.catalog = catalog;
  state.catalogById = new Map(catalog.map((item) => [item.id, item]));

  state.ownedIds = new Set(
    ownedInventory.map((row) => String(row.itemId || "").trim()).filter(Boolean)
  );

  state.ownedItems = catalog.filter((item) => state.ownedIds.has(item.id));

  state.room = room ? normalizeRoomState(room) : makeDefaultRoomState();

  reconcileRoomAgainstOwnedItems();

  state.savedRoomSnapshot = deepClone(state.room);
}

async function loadCatalog(schoolId) {
  const colRef = collection(
    db,
    "readathonV2_schools",
    schoolId,
    "avatarCatalog",
    "catalog",
    "items"
  );

  const qRef = query(colRef, orderBy("__name__"));
  const snap = await getDocs(qRef);

  return snap.docs
    .map((d) => normalizeCatalogItem(d.id, d.data()))
    .filter(Boolean)
    .filter((item) => item.active !== false)
    .sort(compareItems);
}

async function loadOwnedInventory(schoolId, userId) {
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

async function loadRoomState(schoolId, userId) {
  const ref = doc(
    db,
    "readathonV2_schools",
    schoolId,
    "userRoomState",
    userId
  );

  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() || {}) : null;
}

/* ---------------------------------------
   Save
--------------------------------------- */

async function saveRoom() {
  try {
    setStatus("Saving room…");

    const payload = {
      backgroundId: state.room.backgroundId || null,
      avatarBaseId: state.room.avatarBaseId || null,
      wearableIds: Array.isArray(state.room.wearableIds)
        ? state.room.wearableIds.filter(Boolean)
        : [],
      avatarPlacement: state.room.avatarPlacement || defaultPlacementForGroup("avatar"),
      petPlacements: Array.isArray(state.room.petPlacements)
        ? state.room.petPlacements
        : [],
      wallPlacements: Array.isArray(state.room.wallPlacements)
        ? state.room.wallPlacements
        : [],
      floorPlacements: Array.isArray(state.room.floorPlacements)
        ? state.room.floorPlacements
        : [],
      updatedAt: serverTimestamp(),
    };

    const ref = doc(
      db,
      "readathonV2_schools",
      state.schoolId,
      "userRoomState",
      state.userId
    );

    await setDoc(ref, payload, { merge: true });

    state.savedRoomSnapshot = deepClone(state.room);
    setStatus("Room saved!");
  } catch (err) {
    console.error("saveRoom failed:", err);
    setStatus(normalizeError(err), true);
  }
}

/* ---------------------------------------
   Normalizers
--------------------------------------- */

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

  const group = normalizeGroup(slotRaw, subslotRaw, raw);
  const wearableClass = normalizeWearableClass(slotRaw, subslotRaw, raw);

  return {
    id,
    name: String(raw.name || raw.title || raw.label || id).trim(),
    imageUrl,
    thumbUrl: raw.thumbnailUrl || raw.thumbUrl || raw.imagePath || imageUrl,
    group,
    wearableClass,
    sortOrder: Number(raw.sortOrder ?? raw.sort ?? raw.displayOrder ?? 9999),
    layerOrder: Number(raw.layerOrder ?? raw.zIndex ?? defaultLayerOrderFor(wearableClass)),
    rarity: String(raw.rarity || "").trim().toLowerCase(),
    active: raw.active === false ? false : raw.enabled === false ? false : true,
    raw,
  };
}

function normalizeGroup(slot, subslot, raw = {}) {
  const s = `${slot} ${subslot} ${String(raw.roomLayer || "").toLowerCase()} ${String(raw.kind || "").toLowerCase()}`;

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

function compareItems(a, b) {
  if (a.group !== b.group) return a.group.localeCompare(b.group);
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}

function normalizeRoomState(raw = {}) {
  const room = makeDefaultRoomState();

  room.backgroundId = raw.backgroundId || raw.background || raw.bgId || null;
  room.avatarBaseId = raw.avatarBaseId || raw.baseId || raw.avatarId || raw.bodyId || null;

  room.wearableIds = Array.isArray(raw.wearableIds)
    ? raw.wearableIds.filter(Boolean)
    : Array.isArray(raw.equippedWearableIds)
    ? raw.equippedWearableIds.filter(Boolean)
    : [];

  room.avatarPlacement =
    normalizeFreePlacement(raw.avatarPlacement || raw.avatar || null, "avatar") ||
    defaultPlacementForGroup("avatar");

  const rawPetPlacements = Array.isArray(raw.petPlacements)
    ? raw.petPlacements
    : raw.petPlacement
    ? [raw.petPlacement]
    : raw.pet
    ? [raw.pet]
    : [];

  room.petPlacements = rawPetPlacements
    .map((p) => normalizePlacement(p, "pets"))
    .filter(Boolean);

  room.wallPlacements = Array.isArray(raw.wallPlacements)
    ? raw.wallPlacements.map((p) => normalizePlacement(p, "wall")).filter(Boolean)
    : [];

  room.floorPlacements = Array.isArray(raw.floorPlacements)
    ? raw.floorPlacements.map((p) => normalizePlacement(p, "floor")).filter(Boolean)
    : [];

  return room;
}

function normalizeFreePlacement(raw, kind) {
  const defaults = defaultPlacementForGroup(kind);

  return {
    x: clampNumber(raw?.x, 0, 100, defaults.x),
    y: clampNumber(raw?.y, 0, 100, defaults.y),
    scale: clampNumber(raw?.scale, 0.2, 3, defaults.scale),
    z: Number.isFinite(Number(raw?.z)) ? Number(raw.z) : defaults.z,
  };
}

function normalizePlacement(raw, kind) {
  if (!raw) return null;

  const itemId = raw.itemId || raw.id || null;
  if (!itemId) return null;

  const defaults = defaultPlacementForGroup(kind);

  return {
    itemId,
    x: clampNumber(raw.x, 0, 100, defaults.x),
    y: clampNumber(raw.y, 0, 100, defaults.y),
    scale: clampNumber(raw.scale, 0.2, 3, defaults.scale),
    z: Number.isFinite(Number(raw.z)) ? Number(raw.z) : defaults.z,
  };
}

function reconcileRoomAgainstOwnedItems() {
  const hasOwned = (id) => !!id && state.ownedIds.has(id);

  if (state.room.backgroundId && !hasOwned(state.room.backgroundId)) {
    state.room.backgroundId = null;
  }

  if (state.room.avatarBaseId && !hasOwned(state.room.avatarBaseId)) {
    state.room.avatarBaseId = null;
  }

  state.room.wearableIds = state.room.wearableIds.filter((id) => hasOwned(id));

  state.room.petPlacements = (state.room.petPlacements || []).filter((p) => hasOwned(p.itemId));
  state.room.wallPlacements = state.room.wallPlacements.filter((p) => hasOwned(p.itemId));
  state.room.floorPlacements = state.room.floorPlacements.filter((p) => hasOwned(p.itemId));

  state.room.avatarPlacement = normalizeFreePlacement(state.room.avatarPlacement, "avatar");

  if (!state.room.avatarBaseId) {
    const firstBase = state.ownedItems.find(
      (item) => item.group === "wearables" && item.wearableClass === "base"
    );
    if (firstBase) state.room.avatarBaseId = firstBase.id;
  }

  if (!state.room.backgroundId) {
    const firstBg = state.ownedItems.find((item) => item.group === "background");
    if (firstBg) state.room.backgroundId = firstBg.id;
  }
}

/* ---------------------------------------
   Rendering
--------------------------------------- */

function renderAll() {
  renderHeaderUser();
  renderRoom();
  renderInventory();
}

function renderHeaderUser() {
  if (!els.headerUser) return;

  const label =
    auth.currentUser?.displayName ||
    auth.currentUser?.email ||
    state.userId ||
    "Signed in";

  els.headerUser.textContent = label;
}

function renderRoom() {
  renderBackground();
  renderPlacedObjects("wall");
  renderAvatar();
  renderPets();
  renderPlacedObjects("floor");
}

function renderBackground() {
  const bgItem = getOwnedItem(state.room.backgroundId);
  els.roomBackground.style.backgroundImage = bgItem
    ? `url("${bgItem.imageUrl}")`
    : "none";
}

function renderAvatar() {
  els.avatarLayer.innerHTML = "";

  const base = getOwnedItem(state.room.avatarBaseId);
  const avatarPlacement = state.room.avatarPlacement || defaultPlacementForGroup("avatar");

  const wearables = state.room.wearableIds
    .map(getOwnedItem)
    .filter(Boolean)
    .sort((a, b) => a.layerOrder - b.layerOrder);

  const pieces = [];

  if (base) {
    pieces.push(`
      <div class="aw-avatar-piece" data-piece="base" style="z-index:${base.layerOrder};">
        <img src="${escapeHtml(base.imageUrl)}" alt="${escapeHtml(base.name)}" draggable="false">
      </div>
    `);
  }

  wearables.forEach((item) => {
    pieces.push(`
      <div
        class="aw-avatar-piece"
        data-piece="${escapeHtml(item.wearableClass || "wearable")}"
        style="z-index:${item.layerOrder};"
      >
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" draggable="false">
      </div>
    `);
  });

  const selected = isSelected("avatar", 0) ? " is-selected" : "";
  const showHandle = isSelected("avatar", 0);

  const el = document.createElement("button");
  el.type = "button";
  el.className = `aw-room-object aw-avatar-object${selected}`;
  el.dataset.kind = "avatar";
  el.dataset.index = "0";

  el.style.left = `${avatarPlacement.x}%`;
  el.style.top = `${avatarPlacement.y}%`;
  el.style.width = `${Math.round(240 * avatarPlacement.scale)}px`;
  el.style.zIndex = String(avatarPlacement.z ?? 25);

  el.innerHTML = `
    <div class="aw-avatar-stack">
      ${pieces.join("")}
    </div>
    ${showHandle ? `<span class="aw-resize-handle" data-resize-handle="true" aria-hidden="true"></span>` : ""}
  `;

  wirePlacementElement(el, "avatar", 0);
  els.avatarLayer.appendChild(el);
}

function renderPets() {
  els.petLayer.innerHTML = "";

  const pets = Array.isArray(state.room.petPlacements) ? state.room.petPlacements : [];

  pets.forEach((pet, index) => {
    const item = getOwnedItem(pet.itemId);
    if (!item) return;

    const selected = isSelected("pet", index) ? " is-selected" : "";
    const showHandle = isSelected("pet", index);

    const el = document.createElement("button");
    el.type = "button";
    el.className = `aw-room-object aw-pet-object${selected}`;
    el.dataset.kind = "pet";
    el.dataset.index = String(index);

    const widthPx = Math.round(128 * pet.scale);

    el.style.left = `${pet.x}%`;
    el.style.top = `${pet.y}%`;
    el.style.width = `${widthPx}px`;
    el.style.zIndex = String(pet.z ?? (32 + index));

    el.innerHTML = `
      <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" draggable="false">
      ${showHandle ? `<span class="aw-resize-handle" data-resize-handle="true" aria-hidden="true"></span>` : ""}
    `;

    wirePlacementElement(el, "pet", index);
    els.petLayer.appendChild(el);
  });
}

function renderPlacedObjects(kind) {
  const layer = kind === "wall" ? els.wallLayer : els.floorLayer;
  const list = kind === "wall" ? state.room.wallPlacements : state.room.floorPlacements;

  layer.innerHTML = "";

  list.forEach((placement, index) => {
    const item = getOwnedItem(placement.itemId);
    if (!item) return;

    const selected = isSelected(kind, index) ? " is-selected" : "";
    const showHandle = isSelected(kind, index);

    const el = document.createElement("button");
    el.type = "button";
    el.className = `aw-room-object${selected}`;
    el.dataset.kind = kind;
    el.dataset.index = String(index);

    const baseWidth = kind === "wall" ? 190 : 170;
    const widthPx = Math.round(baseWidth * placement.scale);

    el.style.left = `${placement.x}%`;
    el.style.top = `${placement.y}%`;
    el.style.width = `${widthPx}px`;
    el.style.zIndex = String(placement.z ?? (kind === "wall" ? 12 + index : 42 + index));

    el.innerHTML = `
      <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" draggable="false">
      ${showHandle ? `<span class="aw-resize-handle" data-resize-handle="true" aria-hidden="true"></span>` : ""}
    `;

    wirePlacementElement(el, kind, index);
    layer.appendChild(el);
  });
}

/* ---------------------------------------
   Inventory Actions
--------------------------------------- */

function renderInventory() {
  if (!els.inventoryGrid) return;

  const items = state.ownedItems
    .filter((item) => item.group === state.tab)
    .sort(compareItems);

  if (els.inventorySummary) {
    els.inventorySummary.textContent = items.length
      ? `${items.length} ${state.tab} item${items.length === 1 ? "" : "s"} available.`
      : `No ${state.tab} items owned yet.`;
  }

  if (!items.length) {
    els.inventoryGrid.innerHTML = `<div class="aw-empty">Nothing owned in this tab yet.</div>`;
    return;
  }

  els.inventoryGrid.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `aw-inventory-item${isEquippedInCurrentState(item) ? " is-equipped" : ""}`;

    card.innerHTML = `
      <div class="aw-inventory-thumb">
        <img
          src="${escapeHtml(item.thumbUrl || item.imageUrl)}"
          alt="${escapeHtml(item.name)}"
          draggable="false"
        >
      </div>
      <div class="aw-inventory-meta">
        <div class="aw-inventory-name">${escapeHtml(item.name)}</div>
        <div class="aw-inventory-sub">${escapeHtml(formatInventorySub(item))}</div>
      </div>
    `;

    card.addEventListener("click", () => onInventoryItemClick(item));
    els.inventoryGrid.appendChild(card);
  });
}

function onInventoryItemClick(item) {
  if (!item) return;

  switch (item.group) {
    case "background":
      state.room.backgroundId = item.id;
      clearSelection({ rerender: false });
      setStatus(`${item.name} equipped.`);
      break;

    case "pets": {
      const nextIndex = state.room.petPlacements.length;
      state.room.petPlacements.push({
        itemId: item.id,
        ...defaultPlacementForGroup("pets"),
        x: clamp(70 + (nextIndex % 4) * 6, 5, 95),
        y: clamp(78 - Math.floor(nextIndex / 4) * 6, 5, 95),
        z: 32 + nextIndex,
      });
      setSelection("pet", state.room.petPlacements.length - 1, false);
      setStatus(`${item.name} added. Drag or resize your pet.`);
      break;
    }

    case "wall":
      state.room.wallPlacements.push({
        itemId: item.id,
        ...defaultPlacementForGroup("wall"),
        z: 10 + state.room.wallPlacements.length,
      });
      setSelection("wall", state.room.wallPlacements.length - 1, false);
      setStatus(`${item.name} added. Drag or resize it.`);
      break;

    case "floor":
      state.room.floorPlacements.push({
        itemId: item.id,
        ...defaultPlacementForGroup("floor"),
        z: 40 + state.room.floorPlacements.length,
      });
      setSelection("floor", state.room.floorPlacements.length - 1, false);
      setStatus(`${item.name} added. Drag or resize it.`);
      break;

    case "wearables":
    default:
      equipWearable(item);
      clearSelection({ rerender: false });
      setStatus(`${item.name} equipped. Drag or resize your avatar.`);
      break;
  }

  renderAll();
}

function equipWearable(item) {
  if (item.wearableClass === "base") {
    state.room.avatarBaseId = item.id;
    return;
  }

  const idx = state.room.wearableIds.indexOf(item.id);
  if (idx >= 0) {
    state.room.wearableIds.splice(idx, 1);
    return;
  }

  if (item.wearableClass === "head") {
    state.room.wearableIds = state.room.wearableIds.filter((id) => {
      const it = getOwnedItem(id);
      return it?.wearableClass !== "head";
    });
  }

  state.room.wearableIds.push(item.id);
}

function unequipCurrentTab() {
  switch (state.tab) {
    case "background":
      state.room.backgroundId = null;
      break;
    case "pets":
      state.room.petPlacements = [];
      break;
    case "wall":
      state.room.wallPlacements = [];
      break;
    case "floor":
      state.room.floorPlacements = [];
      break;
    case "wearables":
    default:
      state.room.wearableIds = [];
      break;
  }

  clearSelection({ rerender: false });
  renderAll();
  setStatus(`Cleared ${state.tab}.`);
}

/* ---------------------------------------
   Selection / Delete
--------------------------------------- */

function setSelection(kind, index, rerender = true) {
  state.selectedPlacement = { kind, index };
  if (rerender) renderRoom();
}

function clearSelection({ rerender = true } = {}) {
  state.selectedPlacement = null;
  if (rerender) renderRoom();
}

function isSelected(kind, index) {
  return (
    state.selectedPlacement?.kind === kind &&
    Number(state.selectedPlacement?.index) === Number(index)
  );
}

function deleteSelectedPlacement() {
  const sel = state.selectedPlacement;

  if (!sel) {
    setStatus("Select the avatar, pet, wall item, or floor item first.");
    return;
  }

  if (sel.kind === "avatar") {
    state.room.avatarPlacement = defaultPlacementForGroup("avatar");
    clearSelection({ rerender: false });
    renderAll();
    setStatus("Avatar position reset.");
    return;
  }

  if (sel.kind === "pet") {
    state.room.petPlacements.splice(sel.index, 1);
  } else if (sel.kind === "wall") {
    state.room.wallPlacements.splice(sel.index, 1);
  } else if (sel.kind === "floor") {
    state.room.floorPlacements.splice(sel.index, 1);
  }

  clearSelection({ rerender: false });
  renderAll();
  setStatus("Selected item removed.");
}

/* ---------------------------------------
   Dragging / Resizing
--------------------------------------- */

function wirePlacementElement(el, kind, index) {
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    setSelection(kind, index);
  });

  const resizeHandle = el.querySelector("[data-resize-handle='true']");
  if (resizeHandle) {
    resizeHandle.addEventListener("pointerdown", (e) => {
      startResize(e, kind, index);
    });
  }

  el.addEventListener("pointerdown", (e) => {
    if (!els.roomCanvas) return;
    if (e.target.closest("[data-resize-handle='true']")) return;

    e.preventDefault();
    e.stopPropagation();

    const placement = getPlacementRef(kind, index);
    if (!placement) return;

    setSelection(kind, index, false);

    const roomRect = els.roomCanvas.getBoundingClientRect();
    if (!roomRect.width || !roomRect.height) return;

    const pointerXPct = ((e.clientX - roomRect.left) / roomRect.width) * 100;
    const pointerYPct = ((e.clientY - roomRect.top) / roomRect.height) * 100;

    state.drag = {
      mode: "move",
      kind,
      index,
      pointerId: e.pointerId,
      offsetXPct: pointerXPct - placement.x,
      offsetYPct: pointerYPct - placement.y,
    };

    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {}

    setStatus("Dragging…");
  });
}

function startResize(e, kind, index) {
  if (!els.roomCanvas) return;

  e.preventDefault();
  e.stopPropagation();

  const placement = getPlacementRef(kind, index);
  if (!placement) return;

  setSelection(kind, index, false);

  const rect = els.roomCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const center = placementCenterPx(placement, rect);
  const startDistance = distanceBetweenPoints(
    e.clientX,
    e.clientY,
    center.x,
    center.y
  );

  state.drag = {
    mode: "resize",
    kind,
    index,
    pointerId: e.pointerId,
    startScale: placement.scale || 1,
    startDistance: Math.max(startDistance, 1),
    centerX: center.x,
    centerY: center.y,
  };

  setStatus("Resizing…");
}

function onPointerMove(e) {
  if (!state.drag || e.pointerId !== state.drag.pointerId || !els.roomCanvas) return;

  e.preventDefault();

  const rect = els.roomCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const placement = getPlacementRef(state.drag.kind, state.drag.index);
  if (!placement) return;

  if (state.drag.mode === "move") {
    const bounds = movementBoundsForKind(state.drag.kind);

    const rawXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const rawYPct = ((e.clientY - rect.top) / rect.height) * 100;

    placement.x = clamp(rawXPct - state.drag.offsetXPct, bounds.minX, bounds.maxX);
    placement.y = clamp(rawYPct - state.drag.offsetYPct, bounds.minY, bounds.maxY);
  }

  if (state.drag.mode === "resize") {
    const currentDistance = distanceBetweenPoints(
      e.clientX,
      e.clientY,
      state.drag.centerX,
      state.drag.centerY
    );

    const ratio = currentDistance / Math.max(state.drag.startDistance, 1);
    placement.scale = clamp(state.drag.startScale * ratio, 0.35, 3);
  }

  renderRoom();
}

function onPointerUp(e) {
  if (!state.drag || e.pointerId !== state.drag.pointerId) return;
  state.drag = null;
  setStatus("Updated. Save when you're ready.");
}

function getPlacementRef(kind, index) {
  if (kind === "avatar") return state.room.avatarPlacement;
  if (kind === "pet") return state.room.petPlacements[index] || null;
  if (kind === "wall") return state.room.wallPlacements[index] || null;
  if (kind === "floor") return state.room.floorPlacements[index] || null;
  return null;
}

function movementBoundsForKind(kind) {
  if (kind === "wall") return { minX: 5, maxX: 95, minY: 8, maxY: 55 };
  if (kind === "floor") return { minX: 5, maxX: 95, minY: 40, maxY: 95 };
  if (kind === "pet") return { minX: 5, maxX: 95, minY: 20, maxY: 95 };
  return { minX: 5, maxX: 95, minY: 15, maxY: 95 };
}

function placementCenterPx(placement, rect) {
  return {
    x: rect.left + (placement.x / 100) * rect.width,
    y: rect.top + (placement.y / 100) * rect.height,
  };
}

function distanceBetweenPoints(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function defaultPlacementForGroup(kind) {
  if (kind === "avatar") return { x: 50, y: 78, scale: 1, z: 25 };
  if (kind === "wall") return { x: 26, y: 30, scale: 1, z: 12 };
  if (kind === "floor") return { x: 26, y: 78, scale: 1, z: 42 };
  if (kind === "pets") return { x: 77, y: 78, scale: 1, z: 32 };
  return { x: 50, y: 50, scale: 1, z: 10 };
}

/* ---------------------------------------
   Reset
--------------------------------------- */

function resetRoomToLastSave() {
  if (!state.savedRoomSnapshot) {
    setStatus("Nothing saved yet.");
    return;
  }

  state.room = deepClone(state.savedRoomSnapshot);
  clearSelection({ rerender: false });
  renderAll();
  setStatus("Reset to last saved room.");
}

/* ---------------------------------------
   Helpers
--------------------------------------- */

function getOwnedItem(id) {
  if (!id) return null;
  if (!state.ownedIds.has(id)) return null;
  return state.catalogById.get(id) || null;
}

function isEquippedInCurrentState(item) {
  if (!item) return false;

  if (item.group === "background") return state.room.backgroundId === item.id;
  if (item.group === "pets") return state.room.petPlacements.some((p) => p.itemId === item.id);
  if (item.group === "wall") return state.room.wallPlacements.some((p) => p.itemId === item.id);
  if (item.group === "floor") return state.room.floorPlacements.some((p) => p.itemId === item.id);

  if (item.group === "wearables") {
    if (item.wearableClass === "base") return state.room.avatarBaseId === item.id;
    return state.room.wearableIds.includes(item.id);
  }

  return false;
}

function formatInventorySub(item) {
  if (item.group === "wearables") return item.wearableClass || "wearable";
  if (item.group === "background") return "background";
  if (item.group === "pets") return "pet";
  if (item.group === "wall") return "wall item";
  if (item.group === "floor") return "floor item";
  return item.group;
}

function setStatus(message, isError = false) {
  if (!els.statusText) return;

  els.statusText.textContent = message || "";
  els.statusText.style.color = isError ? "#ffd7d7" : "";
  els.statusText.style.borderColor = isError
    ? "rgba(255, 124, 124, 0.4)"
    : "rgba(255,255,255,0.08)";
  els.statusText.style.background = isError
    ? "rgba(255, 124, 124, 0.10)"
    : "rgba(255,255,255,0.06)";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
