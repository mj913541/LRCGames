import {
  auth,
  getSchoolId,
  waitForAuthReady,
} from "./firebase.js";

import {
  db,
} from "./firebase.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
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
  schoolId: null,
  user: null,

  inventory: [],
  inventoryById: new Map(),

  tab: "wearables",

  room: makeDefaultRoomState(),
  savedRoomSnapshot: null,

  selectedPlacement: null, // { kind: "wall"|"floor"|"pet", index: number }
  drag: null, // { kind, index, pointerId }
};

/* ---------------------------------------
   Boot
--------------------------------------- */

init().catch((err) => {
  console.error(err);
  setStatus(normalizeError(err), true);
});

async function init() {
  wireUI();

  await waitForAuthReady();

  const user = auth.currentUser;
  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  state.user = user;
  state.schoolId = await getSchoolId();

  renderHeaderUser();

  setStatus("Loading inventory…");
  await loadInventory();

  setStatus("Loading room…");
  await loadRoom();

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
    petPlacement: null, // { itemId, x, y, scale, z }
    wallPlacements: [], // [{ itemId, x, y, scale, z }]
    floorPlacements: [], // [{ itemId, x, y, scale, z }]
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ---------------------------------------
   UI Wiring
--------------------------------------- */

function wireUI() {
  els.btnBack?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "../index.html";
  });

  els.btnSave?.addEventListener("click", saveRoom);
  els.btnReset?.addEventListener("click", resetRoomToLastSave);
  els.btnDeleteSelected?.addEventListener("click", deleteSelectedPlacement);
  els.btnUnequipTab?.addEventListener("click", unequipCurrentTab);

  els.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = btn.dataset.tab || "wearables";
      els.tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderInventory();
      clearSelection();
    });
  });

  els.roomCanvas?.addEventListener("pointermove", onPointerMove);
  els.roomCanvas?.addEventListener("pointerup", onPointerUp);
  els.roomCanvas?.addEventListener("pointercancel", onPointerUp);
  els.roomCanvas?.addEventListener("click", (e) => {
    if (e.target === els.roomCanvas) clearSelection();
  });
}

/* ---------------------------------------
   Firestore Loads
--------------------------------------- */

async function loadInventory() {
  const ref = collection(
    db,
    `readathonV2_schools/${state.schoolId}/userInventory/${state.user.uid}/items`
  );

  const snap = await getDocs(ref);

  const items = snap.docs
    .map((d) => normalizeInventoryItem(d.id, d.data()))
    .filter(Boolean);

  state.inventory = items;
  state.inventoryById = new Map(items.map((item) => [item.id, item]));
}

async function loadRoom() {
  const ref = doc(
    db,
    `readathonV2_schools/${state.schoolId}/userRoomState/${state.user.uid}`
  );

  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const fallback = makeDefaultRoomState();

    const firstBase = state.inventory.find((i) => i.group === "wearables" && i.wearableClass === "base");
    const firstBg = state.inventory.find((i) => i.group === "background");

    if (firstBase) fallback.avatarBaseId = firstBase.id;
    if (firstBg) fallback.backgroundId = firstBg.id;

    state.room = fallback;
    state.savedRoomSnapshot = deepClone(fallback);
    return;
  }

  const data = snap.data() || {};
  state.room = normalizeRoomState(data);
  reconcileRoomAgainstInventory();
  state.savedRoomSnapshot = deepClone(state.room);
}

/* ---------------------------------------
   Firestore Save
--------------------------------------- */

async function saveRoom() {
  try {
    setStatus("Saving room…");

    const payload = {
      backgroundId: state.room.backgroundId || null,
      avatarBaseId: state.room.avatarBaseId || null,
      wearableIds: Array.isArray(state.room.wearableIds) ? state.room.wearableIds : [],
      petPlacement: state.room.petPlacement || null,
      wallPlacements: Array.isArray(state.room.wallPlacements) ? state.room.wallPlacements : [],
      floorPlacements: Array.isArray(state.room.floorPlacements) ? state.room.floorPlacements : [],
      updatedAt: serverTimestamp(),
    };

    const ref = doc(
      db,
      `readathonV2_schools/${state.schoolId}/userRoomState/${state.user.uid}`
    );

    await setDoc(ref, payload, { merge: true });

    state.savedRoomSnapshot = deepClone(state.room);
    setStatus("Room saved!");
  } catch (err) {
    console.error(err);
    setStatus(normalizeError(err), true);
  }
}

/* ---------------------------------------
   Normalizers
--------------------------------------- */

function normalizeInventoryItem(id, raw = {}) {
  const imageUrl =
    raw.imageUrl ||
    raw.assetUrl ||
    raw.previewUrl ||
    raw.thumbUrl ||
    raw.thumbnailUrl ||
    raw.pngUrl ||
    raw.url ||
    "";

  if (!imageUrl) return null;

  const rawSlot = String(raw.slot || raw.category || raw.type || raw.itemType || "").trim().toLowerCase();
  const rawSubslot = String(raw.subslot || raw.layer || raw.equipLayer || raw.wearableType || "").trim().toLowerCase();
  const rawName = String(raw.name || raw.title || raw.label || id).trim();

  const group = normalizeGroup(rawSlot, rawSubslot, raw);
  const wearableClass = normalizeWearableClass(rawSlot, rawSubslot, raw);
  const layerOrder = normalizeLayerOrder(raw, wearableClass);

  return {
    id,
    name: rawName,
    imageUrl,
    thumbUrl: raw.thumbnailUrl || raw.thumbUrl || imageUrl,
    group,
    slot: rawSlot,
    wearableClass,
    layerOrder,
    sortOrder: Number(raw.sortOrder ?? raw.displayOrder ?? 9999),
    rarity: raw.rarity || "",
    price: Number(raw.price ?? raw.cost ?? 0),
    owned: raw.owned !== false,
    raw,
  };
}

function normalizeGroup(slot, subslot, raw) {
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

function normalizeWearableClass(slot, subslot, raw) {
  const s = `${slot} ${subslot} ${String(raw.kind || "").toLowerCase()}`;

  if (s.includes("base") || s.includes("avatar") || s.includes("body")) return "base";
  if (s.includes("head") || s.includes("hair") || s.includes("hat") || s.includes("face")) return "head";
  if (s.includes("accessory") || s.includes("glasses") || s.includes("hand") || s.includes("prop")) return "accessory";

  if (normalizeGroup(slot, subslot, raw) === "wearables") return "accessory";
  return null;
}

function normalizeLayerOrder(raw, wearableClass) {
  if (Number.isFinite(Number(raw.layerOrder))) return Number(raw.layerOrder);
  if (Number.isFinite(Number(raw.zIndex))) return Number(raw.zIndex);

  if (wearableClass === "base") return 10;
  if (wearableClass === "head") return 30;
  if (wearableClass === "accessory") return 40;
  return 50;
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

  room.petPlacement = normalizePlacement(raw.petPlacement || raw.pet || null, "pets");

  room.wallPlacements = Array.isArray(raw.wallPlacements)
    ? raw.wallPlacements.map((p) => normalizePlacement(p, "wall")).filter(Boolean)
    : [];

  room.floorPlacements = Array.isArray(raw.floorPlacements)
    ? raw.floorPlacements.map((p) => normalizePlacement(p, "floor")).filter(Boolean)
    : [];

  return room;
}

function normalizePlacement(raw, group) {
  if (!raw) return null;

  const itemId = raw.itemId || raw.id || null;
  if (!itemId) return null;

  const defaults = defaultPlacementForGroup(group);

  return {
    itemId,
    x: clampNumber(raw.x, 0, 100, defaults.x),
    y: clampNumber(raw.y, 0, 100, defaults.y),
    scale: clampNumber(raw.scale, 0.2, 3, defaults.scale),
    z: Number.isFinite(Number(raw.z)) ? Number(raw.z) : defaults.z,
  };
}

function reconcileRoomAgainstInventory() {
  if (state.room.backgroundId && !state.inventoryById.has(state.room.backgroundId)) {
    state.room.backgroundId = null;
  }

  if (state.room.avatarBaseId && !state.inventoryById.has(state.room.avatarBaseId)) {
    state.room.avatarBaseId = null;
  }

  state.room.wearableIds = state.room.wearableIds.filter((id) => state.inventoryById.has(id));

  if (state.room.petPlacement && !state.inventoryById.has(state.room.petPlacement.itemId)) {
    state.room.petPlacement = null;
  }

  state.room.wallPlacements = state.room.wallPlacements.filter((p) => state.inventoryById.has(p.itemId));
  state.room.floorPlacements = state.room.floorPlacements.filter((p) => state.inventoryById.has(p.itemId));

  if (!state.room.avatarBaseId) {
    const firstBase = state.inventory.find((i) => i.group === "wearables" && i.wearableClass === "base");
    if (firstBase) state.room.avatarBaseId = firstBase.id;
  }

  if (!state.room.backgroundId) {
    const firstBg = state.inventory.find((i) => i.group === "background");
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
  const label =
    state.user?.displayName ||
    state.user?.email ||
    "Signed in";

  els.headerUser.textContent = `${label}`;
}

function renderRoom() {
  renderBackground();
  renderAvatar();
  renderPet();
  renderPlacedObjects("wall");
  renderPlacedObjects("floor");
}

function renderBackground() {
  const bgItem = getItem(state.room.backgroundId);
  els.roomBackground.style.backgroundImage = bgItem ? `url("${bgItem.imageUrl}")` : "none";
}

function renderAvatar() {
  const base = getItem(state.room.avatarBaseId);

  const wearables = state.room.wearableIds
    .map(getItem)
    .filter(Boolean)
    .sort((a, b) => a.layerOrder - b.layerOrder);

  const pieces = [];

  if (base) {
    pieces.push(`
      <div class="aw-avatar-piece" data-piece="base" style="z-index:${base.layerOrder};">
        <img src="${escapeHtml(base.imageUrl)}" alt="${escapeHtml(base.name)}">
      </div>
    `);
  }

  wearables.forEach((item) => {
    pieces.push(`
      <div class="aw-avatar-piece" data-piece="${escapeHtml(item.wearableClass || "wearable")}" style="z-index:${item.layerOrder};">
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">
      </div>
    `);
  });

  els.avatarLayer.innerHTML = `
    <div class="aw-avatar-stack">
      ${pieces.join("")}
    </div>
  `;
}

function renderPet() {
  els.petLayer.innerHTML = "";

  const pet = state.room.petPlacement;
  if (!pet) return;

  const item = getItem(pet.itemId);
  if (!item) return;

  const selected = isSelected("pet", 0) ? " is-selected" : "";

  const el = document.createElement("button");
  el.type = "button";
  el.className = `aw-room-object${selected}`;
  el.dataset.kind = "pet";
  el.dataset.index = "0";

  const widthPx = Math.round(128 * pet.scale);

  el.style.left = `${pet.x}%`;
  el.style.top = `${pet.y}%`;
  el.style.width = `${widthPx}px`;
  el.style.zIndex = String(pet.z ?? 30);

  el.innerHTML = `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">`;

  wirePlacementElement(el, "pet", 0);
  els.petLayer.appendChild(el);
}

function renderPlacedObjects(kind) {
  const layer = kind === "wall" ? els.wallLayer : els.floorLayer;
  const list = kind === "wall" ? state.room.wallPlacements : state.room.floorPlacements;

  layer.innerHTML = "";

  list.forEach((placement, index) => {
    const item = getItem(placement.itemId);
    if (!item) return;

    const selected = isSelected(kind, index) ? " is-selected" : "";
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

    el.innerHTML = `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">`;

    wirePlacementElement(el, kind, index);
    layer.appendChild(el);
  });
}

function renderInventory() {
  const items = state.inventory
    .filter((item) => item.group === state.tab)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });

  const count = items.length;
  els.inventorySummary.textContent =
    count === 0
      ? `No ${state.tab} in inventory yet.`
      : `${count} ${state.tab} item${count === 1 ? "" : "s"} available.`;

  if (!items.length) {
    els.inventoryGrid.innerHTML = `<div class="aw-empty">Nothing in this tab yet.</div>`;
    return;
  }

  els.inventoryGrid.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `aw-inventory-item${isEquippedInCurrentState(item) ? " is-equipped" : ""}`;

    card.innerHTML = `
      <div class="aw-inventory-thumb">
        <img src="${escapeHtml(item.thumbUrl || item.imageUrl)}" alt="${escapeHtml(item.name)}">
      </div>
      <div class="aw-inventory-meta">
        <div class="aw-inventory-name">${escapeHtml(item.name)}</div>
        <div class="aw-inventory-sub">${escapeHtml(formatInventorySub(item))}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      onInventoryItemClick(item);
    });

    els.inventoryGrid.appendChild(card);
  });
}

/* ---------------------------------------
   Inventory Actions
--------------------------------------- */

function onInventoryItemClick(item) {
  if (!item) return;

  switch (item.group) {
    case "background":
      state.room.backgroundId = item.id;
      clearSelection();
      break;

    case "pets":
      if (state.room.petPlacement?.itemId === item.id) {
        state.room.petPlacement = null;
      } else {
        state.room.petPlacement = {
          itemId: item.id,
          ...defaultPlacementForGroup("pets"),
        };
        setSelection("pet", 0);
      }
      break;

    case "wall":
      state.room.wallPlacements.push({
        itemId: item.id,
        ...defaultPlacementForGroup("wall"),
        z: 10 + state.room.wallPlacements.length,
      });
      setSelection("wall", state.room.wallPlacements.length - 1);
      break;

    case "floor":
      state.room.floorPlacements.push({
        itemId: item.id,
        ...defaultPlacementForGroup("floor"),
        z: 40 + state.room.floorPlacements.length,
      });
      setSelection("floor", state.room.floorPlacements.length - 1);
      break;

    case "wearables":
    default:
      equipWearableItem(item);
      clearSelection();
      break;
  }

  renderAll();
  setStatus(statusMessageForEquip(item));
}

function equipWearableItem(item) {
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
    const existingHeadIds = state.room.wearableIds.filter((id) => {
      const it = getItem(id);
      return it?.wearableClass === "head";
    });
    state.room.wearableIds = state.room.wearableIds.filter((id) => !existingHeadIds.includes(id));
  }

  state.room.wearableIds.push(item.id);
}

function unequipCurrentTab() {
  switch (state.tab) {
    case "background":
      state.room.backgroundId = null;
      break;

    case "pets":
      state.room.petPlacement = null;
      break;

    case "wall":
      state.room.wallPlacements = [];
      break;

    case "floor":
      state.room.floorPlacements = [];
      break;

    case "wearables":
    default: {
      const base = state.inventory.find((i) => i.group === "wearables" && i.wearableClass === "base");
      state.room.avatarBaseId = base?.id || null;
      state.room.wearableIds = [];
      break;
    }
  }

  clearSelection();
  renderAll();
  setStatus(`Cleared ${state.tab}.`);
}

/* ---------------------------------------
   Placement Selection / Delete
--------------------------------------- */

function setSelection(kind, index) {
  state.selectedPlacement = { kind, index };
}

function clearSelection() {
  state.selectedPlacement = null;
  renderRoom();
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
    setStatus("Select a pet, wall item, or floor item first.");
    return;
  }

  if (sel.kind === "pet") {
    state.room.petPlacement = null;
  } else if (sel.kind === "wall") {
    state.room.wallPlacements.splice(sel.index, 1);
  } else if (sel.kind === "floor") {
    state.room.floorPlacements.splice(sel.index, 1);
  }

  clearSelection();
  renderAll();
  setStatus("Selected item removed.");
}

/* ---------------------------------------
   Dragging
--------------------------------------- */

function wirePlacementElement(el, kind, index) {
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    setSelection(kind, index);
    renderRoom();
  });

  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();

    setSelection(kind, index);
    renderRoom();

    try {
      el.setPointerCapture(e.pointerId);
    } catch {}

    state.drag = {
      kind,
      index,
      pointerId: e.pointerId,
    };
  });
}

function onPointerMove(e) {
  if (!state.drag || e.pointerId !== state.drag.pointerId) return;

  const rect = els.roomCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const xPct = ((e.clientX - rect.left) / rect.width) * 100;
  const yPct = ((e.clientY - rect.top) / rect.height) * 100;

  const placement = getPlacementRef(state.drag.kind, state.drag.index);
  if (!placement) return;

  const bounds = movementBoundsForKind(state.drag.kind);
  placement.x = clamp(xPct, bounds.minX, bounds.maxX);
  placement.y = clamp(yPct, bounds.minY, bounds.maxY);

  renderRoom();
}

function onPointerUp(e) {
  if (!state.drag) return;
  if (e.pointerId !== state.drag.pointerId) return;

  state.drag = null;
  setStatus("Position updated. Save when you're ready.");
}

function movementBoundsForKind(kind) {
  if (kind === "wall") {
    return { minX: 8, maxX: 92, minY: 12, maxY: 52 };
  }

  if (kind === "floor") {
    return { minX: 8, maxX: 92, minY: 56, maxY: 92 };
  }

  if (kind === "pet") {
    return { minX: 8, maxX: 92, minY: 50, maxY: 92 };
  }

  return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
}

function getPlacementRef(kind, index) {
  if (kind === "pet") return state.room.petPlacement;
  if (kind === "wall") return state.room.wallPlacements[index] || null;
  if (kind === "floor") return state.room.floorPlacements[index] || null;
  return null;
}

function defaultPlacementForGroup(group) {
  if (group === "wall") return { x: 26, y: 30, scale: 1, z: 12 };
  if (group === "floor") return { x: 26, y: 78, scale: 1, z: 42 };
  if (group === "pets") return { x: 77, y: 78, scale: 1, z: 32 };
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
  clearSelection();
  renderAll();
  setStatus("Reset to last saved room.");
}

/* ---------------------------------------
   Helpers
--------------------------------------- */

function getItem(id) {
  if (!id) return null;
  return state.inventoryById.get(id) || null;
}

function isEquippedInCurrentState(item) {
  if (!item) return false;

  if (item.group === "background") return state.room.backgroundId === item.id;
  if (item.group === "pets") return state.room.petPlacement?.itemId === item.id;
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

function statusMessageForEquip(item) {
  if (item.group === "wall" || item.group === "floor") {
    return `${item.name} added. Drag it where you want it.`;
  }
  if (item.group === "pets") {
    return `${item.name} equipped. Drag your pet to place it.`;
  }
  return `${item.name} equipped.`;
}

function setStatus(message, isError = false) {
  els.statusText.textContent = message || "";
  els.statusText.style.color = isError ? "#ffd7d7" : "";
  els.statusText.style.borderColor = isError
    ? "rgba(255, 124, 124, 0.4)"
    : "rgba(255,255,255,0.08)";
  els.statusText.style.background = isError
    ? "rgba(255, 124, 124, 0.10)"
    : "rgba(255,255,255,0.06)";
}

function normalizeError(err) {
  return err?.message || "Something went wrong.";
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