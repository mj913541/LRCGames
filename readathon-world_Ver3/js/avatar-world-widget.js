// /readathon-world_Ver2/js/avatar-world-widget.js

import {
  auth,
  db,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
} from "./firebase.js";

import {
  normalizeError,
  loadSummary,
  fmtInt,
} from "./app.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ----------------------------
  Public mount
---------------------------- */
export async function mountAvatarWorldWidget(opts = {}) {
  const mountEl =
    typeof opts.mountEl === "string"
      ? document.querySelector(opts.mountEl)
      : opts.mountEl;

  if (!mountEl) {
    console.warn("avatar-world-widget: mount element not found");
    return;
  }

  const openUrl = opts.openUrl || "../html/avatar-world.html";
  const role = String(opts.role || "student").toLowerCase();
  const schoolId = opts.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = String(opts.userId || auth.currentUser?.uid || "").toLowerCase();

  if (!schoolId || !userId) {
    mountEl.innerHTML = renderError("Missing schoolId or userId.");
    return;
  }

  try {
    mountEl.innerHTML = renderLoading();

    const [roomState, catalogById, summary] = await Promise.all([
      loadRoomState(schoolId, userId),
      loadCatalogMap(schoolId),
      loadSummary({ schoolId, userId }),
    ]);

    mountEl.innerHTML = renderWidget({
      role,
      hasRoom: !!roomState,
      openUrl,
      showAdminTools: role === "admin",
      rubiesBalance: summary?.rubiesBalance ?? 0,
    });

    renderRoomSceneIntoWidget(mountEl, roomState, catalogById);
    wireWidget(mountEl, { openUrl });
  } catch (err) {
    console.error("mountAvatarWorldWidget failed:", err);
    mountEl.innerHTML = renderError(normalizeError(err));
  }
}

/* ----------------------------
  Firestore refs
---------------------------- */
function roomStateRef(schoolId, userId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    "userRoomState",
    userId
  );
}

function catalogColRef(schoolId) {
  return collection(
    db,
    "readathonV2_schools",
    schoolId,
    "avatarCatalog",
    "catalog",
    "items"
  );
}

/* ----------------------------
  Loaders
---------------------------- */
async function loadRoomState(schoolId, userId) {
  const snap = await getDoc(roomStateRef(schoolId, userId));
  if (!snap.exists()) return null;
  return normalizeRoomState(snap.data() || {});
}

async function loadCatalogMap(schoolId) {
  const snap = await getDocs(
    query(catalogColRef(schoolId), orderBy("__name__"))
  );

  const items = [];

  snap.forEach((d) => {
    const raw = d.data() || {};
    if (raw.active === false || raw.enabled === false) return;

    const normalized = normalizeCatalogItem(d.id, raw);
    if (normalized) items.push(normalized);
  });

  return new Map(items.map((it) => [it.id, it]));
}

/* ----------------------------
  Normalizers
---------------------------- */
function normalizeRoomState(raw = {}) {
  return {
    backgroundId: raw.backgroundId || raw.background || raw.bgId || null,
    avatarBaseId: raw.avatarBaseId || raw.baseId || raw.avatarId || raw.bodyId || null,

    wearableIds: Array.isArray(raw.wearableIds)
      ? raw.wearableIds.filter(Boolean)
      : Array.isArray(raw.equippedWearableIds)
      ? raw.equippedWearableIds.filter(Boolean)
      : [],

    avatarPlacement: raw.avatarPlacement || raw.avatar || null,
    petPlacement: raw.petPlacement || raw.pet || null,

    wallPlacements: Array.isArray(raw.wallPlacements)
      ? raw.wallPlacements.filter(Boolean)
      : [],

    floorPlacements: Array.isArray(raw.floorPlacements)
      ? raw.floorPlacements.filter(Boolean)
      : [],
  };
}

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
    itemId: id,
    name: String(raw.name || raw.title || raw.label || id).trim(),
    imageUrl,
    thumbUrl: raw.thumbnailUrl || raw.thumbUrl || raw.imagePath || imageUrl,
    group,
    wearableClass,
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

/* ----------------------------
  Widget scene renderer
---------------------------- */
function renderRoomSceneIntoWidget(mountEl, roomState, catalogById) {
  const sceneEl = mountEl.querySelector("[data-aw-room-scene]");
  if (!sceneEl) return;

  sceneEl.innerHTML = "";

  const ROOM_W = 1024;
  const ROOM_H = 1024;
  const fallbackBg = "../img/bg/index.png";

  const backgroundItem = roomState?.backgroundId
    ? catalogById.get(roomState.backgroundId)
    : null;

  const baseItem = roomState?.avatarBaseId
    ? catalogById.get(roomState.avatarBaseId)
    : null;

  const wearableItems = Array.isArray(roomState?.wearableIds)
    ? roomState.wearableIds.map((id) => catalogById.get(id)).filter(Boolean)
    : [];

  const petItem = roomState?.petPlacement?.itemId
    ? catalogById.get(roomState.petPlacement.itemId)
    : null;

  const wallPlacements = Array.isArray(roomState?.wallPlacements)
    ? roomState.wallPlacements
    : [];

  const floorPlacements = Array.isArray(roomState?.floorPlacements)
    ? roomState.floorPlacements
    : [];

  const avatarPlacement = roomState?.avatarPlacement || {
    x: ROOM_W * 0.5,
    y: ROOM_H * 0.78,
    scale: 1,
    rotation: 0,
  };

  const petPlacement = roomState?.petPlacement || null;

  sceneEl.appendChild(
    createSceneImg({
      src: backgroundItem?.imageUrl || fallbackBg,
      className: "awSceneBg",
    })
  );

  wallPlacements.forEach((placement) => {
    const item = catalogById.get(placement?.itemId);
    if (!item?.imageUrl) return;

    sceneEl.appendChild(
      createPlacedSceneImg({
        src: item.imageUrl,
        placement,
        className: "awSceneWall",
        roomW: ROOM_W,
        roomH: ROOM_H,
        defaultWidthPct: 18,
      })
    );
  });

  if (baseItem?.imageUrl) {
    sceneEl.appendChild(
      createPlacedAvatarImg({
        src: baseItem.imageUrl,
        placement: avatarPlacement,
        className: "awSceneAvatarBase",
        roomW: ROOM_W,
        roomH: ROOM_H,
      })
    );
  }

  wearableItems.forEach((item) => {
    if (!item?.imageUrl) return;

    sceneEl.appendChild(
      createPlacedAvatarImg({
        src: item.imageUrl,
        placement: avatarPlacement,
        className: "awSceneAvatarWearable",
        roomW: ROOM_W,
        roomH: ROOM_H,
      })
    );
  });

  floorPlacements.forEach((placement) => {
    const item = catalogById.get(placement?.itemId);
    if (!item?.imageUrl) return;

    sceneEl.appendChild(
      createPlacedSceneImg({
        src: item.imageUrl,
        placement,
        className: "awSceneFloor",
        roomW: ROOM_W,
        roomH: ROOM_H,
        defaultWidthPct: 20,
      })
    );
  });

  if (petItem?.imageUrl && petPlacement) {
    sceneEl.appendChild(
      createPlacedPetImg({
        src: petItem.imageUrl,
        placement: petPlacement,
        className: "awScenePet",
        roomW: ROOM_W,
        roomH: ROOM_H,
      })
    );
  }
}

function createSceneImg({ src, className = "" }) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.className = className;
  img.draggable = false;
  return img;
}

function createPlacedSceneImg({
  src,
  placement = {},
  className = "",
  roomW = 1024,
  roomH = 1024,
  defaultWidthPct = 20,
}) {
  const img = createSceneImg({ src, className });

  const x = Number(placement.x ?? placement.left ?? roomW * 0.5);
  const y = Number(placement.y ?? placement.top ?? roomH * 0.5);
  const scale = Number(placement.scale ?? 1);
  const rotation = Number(placement.rotation ?? placement.rotate ?? 0);
  const widthPct = Number(
    placement.widthPct ??
    placement.previewWidthPct ??
    defaultWidthPct
  );

  img.style.left = `${(x / roomW) * 100}%`;
  img.style.top = `${(y / roomH) * 100}%`;
  img.style.width = `${widthPct}%`;
  img.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`;

  return img;
}

function createPlacedAvatarImg({
  src,
  placement = {},
  className = "",
  roomW = 1024,
  roomH = 1024,
}) {
  const img = createSceneImg({ src, className });

  const x = Number(placement.x ?? roomW * 0.5);
  const y = Number(placement.y ?? roomH * 0.78);
  const scale = Number(placement.scale ?? 1);
  const rotation = Number(placement.rotation ?? 0);
  const widthPct = Number(
    placement.widthPct ??
    placement.previewWidthPct ??
    28
  );

  img.style.left = `${(x / roomW) * 100}%`;
  img.style.top = `${(y / roomH) * 100}%`;
  img.style.width = `${widthPct}%`;
  img.style.transform = `translate(-50%, -100%) scale(${scale}) rotate(${rotation}deg)`;

  return img;
}

function createPlacedPetImg({
  src,
  placement = {},
  className = "",
  roomW = 1024,
  roomH = 1024,
}) {
  const img = createSceneImg({ src, className });

  const x = Number(placement.x ?? roomW * 0.72);
  const y = Number(placement.y ?? roomH * 0.84);
  const scale = Number(placement.scale ?? 1);
  const rotation = Number(placement.rotation ?? 0);
  const widthPct = Number(
    placement.widthPct ??
    placement.previewWidthPct ??
    14
  );

  img.style.left = `${(x / roomW) * 100}%`;
  img.style.top = `${(y / roomH) * 100}%`;
  img.style.width = `${widthPct}%`;
  img.style.transform = `translate(-50%, -100%) scale(${scale}) rotate(${rotation}deg)`;

  return img;
}

/* ----------------------------
  Rendering
---------------------------- */
function renderLoading() {
  return `
    <div class="awWidget">
      <div class="awWidgetTitle">Avatar World</div>
      <div style="margin-top:8px;">Loading Avatar World…</div>
    </div>
  `;
}

function renderError(msg) {
  return `
    <div class="awWidget">
      <div class="awWidgetTitle">Avatar World</div>
      <div style="margin-top:8px;">Could not load Avatar World.</div>
      <div class="awWidgetError">${escapeHtml(msg)}</div>
    </div>
  `;
}

function renderWidget({
  role,
  hasRoom,
  openUrl,
  showAdminTools,
  rubiesBalance,
}) {
  return `
    <div class="awWidget">
      <div class="awWidgetHeader">
        <div class="awWidgetTitle">Avatar World</div>
        <div class="awWidgetRole">${escapeHtml(role)}</div>
      </div>

      <div class="awWidgetPreview" aria-label="Avatar World preview">
        <div class="awRoomScene" data-aw-room-scene></div>
      </div>

      <div class="awWidgetMeta">
        💎 Rubies: ${fmtInt(rubiesBalance)}
      </div>

      <div class="awWidgetText">
        ${hasRoom ? "Open your room and keep decorating!" : "Open Avatar World to start building your room!"}
      </div>

      <div class="awWidgetActions">
        <button type="button" class="awBtn awBtnPrimary" data-aw-open>
          Open Avatar World
        </button>

        ${
          showAdminTools
            ? `<button type="button" class="awBtn awBtnSecondary" data-aw-admin>
                 Catalog Tools
               </button>`
            : ""
        }
      </div>
    </div>
  `;
}

function wireWidget(mountEl, { openUrl }) {
  const openBtn = mountEl.querySelector("[data-aw-open]");
  const adminBtn = mountEl.querySelector("[data-aw-admin]");

  openBtn?.addEventListener("click", () => {
    window.location.href = openUrl;
  });

  adminBtn?.addEventListener("click", () => {
    window.location.href = "../html/avatar-catalog-admin.html";
  });
}

/* ----------------------------
  Escaping
---------------------------- */
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(str) {
  return escapeHtml(str).replaceAll("`", "&#096;");
}