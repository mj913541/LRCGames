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

import { renderAvatarRoom } from "./avatar-room-renderer.js";

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

    avatarPlacement:
      normalizeFreePlacement(raw.avatarPlacement || raw.avatar || null, "avatar"),

    petPlacements: Array.isArray(raw.petPlacements)
      ? raw.petPlacements.map((p) => normalizePlacement(p, "pets")).filter(Boolean)
      : raw.petPlacement
      ? [normalizePlacement(raw.petPlacement, "pets")].filter(Boolean)
      : raw.pet
      ? [normalizePlacement(raw.pet, "pets")].filter(Boolean)
      : [],

    wallPlacements: Array.isArray(raw.wallPlacements)
      ? raw.wallPlacements.map((p) => normalizePlacement(p, "wall")).filter(Boolean)
      : [],

    floorPlacements: Array.isArray(raw.floorPlacements)
      ? raw.floorPlacements.map((p) => normalizePlacement(p, "floor")).filter(Boolean)
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
    layerOrder: Number(raw.layerOrder ?? raw.zIndex ?? defaultLayerOrderFor(wearableClass)),
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

function defaultPlacementForGroup(kind) {
  if (kind === "avatar") return { x: 50, y: 78, scale: 1, z: 25 };
  if (kind === "wall") return { x: 26, y: 30, scale: 1, z: 12 };
  if (kind === "floor") return { x: 26, y: 78, scale: 1, z: 42 };
  if (kind === "pets") return { x: 77, y: 78, scale: 1, z: 32 };
  return { x: 50, y: 50, scale: 1, z: 10 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
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

/* ----------------------------
  Shared-renderer-style widget scene
---------------------------- */
function renderRoomSceneIntoWidget(mountEl, roomState, catalogById) {
  const sceneEl = mountEl.querySelector("[data-aw-room-scene]");
  if (!sceneEl) return;

  renderAvatarRoom(sceneEl, roomState, catalogById, {
    mode: "widget",
  });
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