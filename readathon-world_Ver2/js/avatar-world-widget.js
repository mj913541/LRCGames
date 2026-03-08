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

    const preview = buildPreviewModel(roomState, catalogById);

    mountEl.innerHTML = renderWidget({
      role,
      preview,
      hasRoom: !!roomState,
      openUrl,
      showAdminTools: role === "admin",
      rubiesBalance: summary?.rubiesBalance ?? 0,
    });

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
  Preview model
---------------------------- */
function buildPreviewModel(roomState, catalogById) {
  const fallbackBg = "../img/bg/index.png";

  const backgroundItem = roomState?.backgroundId
    ? catalogById.get(roomState.backgroundId)
    : null;

  const baseItem = roomState?.avatarBaseId
    ? catalogById.get(roomState.avatarBaseId)
    : null;

  const wearableItems = Array.isArray(roomState?.wearableIds)
    ? roomState.wearableIds
        .map((id) => catalogById.get(id))
        .filter(Boolean)
    : [];

  const headItem =
    wearableItems.find((item) => item.wearableClass === "head") || null;

  const accessoryItem =
    wearableItems.find((item) => item.wearableClass === "accessory") || null;

  const petItem = roomState?.petPlacement?.itemId
    ? catalogById.get(roomState.petPlacement.itemId)
    : null;

  const wallItems = Array.isArray(roomState?.wallPlacements)
    ? roomState.wallPlacements
        .map((p) => catalogById.get(p?.itemId))
        .filter(Boolean)
        .slice(0, 2)
    : [];

  const floorItems = Array.isArray(roomState?.floorPlacements)
    ? roomState.floorPlacements
        .map((p) => catalogById.get(p?.itemId))
        .filter(Boolean)
        .slice(0, 2)
    : [];

  return {
    backgroundUrl: backgroundItem?.imageUrl || fallbackBg,
    baseUrl: baseItem?.imageUrl || "",
    headUrl: headItem?.imageUrl || "",
    accessoryUrl: accessoryItem?.imageUrl || "",
    petUrl: petItem?.imageUrl || "",
    wallUrls: wallItems.map((x) => x.imageUrl).filter(Boolean),
    floorUrls: floorItems.map((x) => x.imageUrl).filter(Boolean),
  };
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
  preview,
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
        <img
          src="${escapeAttr(preview.backgroundUrl)}"
          alt="Avatar World room background preview"
        />

        ${
          preview.wallUrls[0]
            ? `<img class="awWidgetPreviewLayer awWidgetWall1" src="${escapeAttr(preview.wallUrls[0])}" alt="" />`
            : ""
        }
        ${
          preview.wallUrls[1]
            ? `<img class="awWidgetPreviewLayer awWidgetWall2" src="${escapeAttr(preview.wallUrls[1])}" alt="" />`
            : ""
        }

        ${
          preview.baseUrl
            ? `<img class="awWidgetPreviewLayer awWidgetAvatar" src="${escapeAttr(preview.baseUrl)}" alt="" />`
            : ""
        }
        ${
          preview.headUrl
            ? `<img class="awWidgetPreviewLayer awWidgetAvatar" src="${escapeAttr(preview.headUrl)}" alt="" />`
            : ""
        }
        ${
          preview.accessoryUrl
            ? `<img class="awWidgetPreviewLayer awWidgetAvatar" src="${escapeAttr(preview.accessoryUrl)}" alt="" />`
            : ""
        }

        ${
          preview.petUrl
            ? `<img class="awWidgetPreviewLayer awWidgetPet" src="${escapeAttr(preview.petUrl)}" alt="" />`
            : ""
        }

        ${
          preview.floorUrls[0]
            ? `<img class="awWidgetPreviewLayer awWidgetFloor1" src="${escapeAttr(preview.floorUrls[0])}" alt="" />`
            : ""
        }
        ${
          preview.floorUrls[1]
            ? `<img class="awWidgetPreviewLayer awWidgetFloor2" src="${escapeAttr(preview.floorUrls[1])}" alt="" />`
            : ""
        }
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