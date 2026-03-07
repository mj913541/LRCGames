// /readathon-world_Ver2/js/avatar-world-widget.js

import {
  auth,
  db,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
} from "/readathon-world_Ver2/js/firebase.js";

import {
  normalizeError,
  loadSummary,
  fmtInt,
} from "/readathon-world_Ver2/js/app.js";

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

  const openUrl = opts.openUrl || "/readathon-world_Ver2/html/avatar-world.html";
  const role = opts.role || "student";
  const schoolId = opts.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = opts.userId || auth.currentUser?.uid;

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

async function loadCatalogMap(schoolId) {
  const snap = await getDocs(
    query(catalogColRef(schoolId), orderBy("__name__"))
  );

  const items = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    if (x.enabled === false) return;
    items.push({
      ...x,
      itemId: x.itemId || d.id,
    });
  });

  return new Map(items.map((it) => [it.itemId, it]));
}

/* ----------------------------
  Preview model
---------------------------- */
function buildPreviewModel(roomState, catalogById) {
  const fallbackBg = "/readathon-world_Ver2/img/bg/index.png";

  const equipped = roomState?.equipped || {};

  const bgItem = equipped.background ? catalogById.get(equipped.background) : null;
  const baseItem = equipped.base ? catalogById.get(equipped.base) : null;
  const headItem = equipped.head ? catalogById.get(equipped.head) : null;
  const bodyItem = equipped.body ? catalogById.get(equipped.body) : null;
  const accItem = equipped.accessory ? catalogById.get(equipped.accessory) : null;
  const petItem = equipped.pet ? catalogById.get(equipped.pet) : null;

  return {
    backgroundUrl: bgItem?.imagePath || fallbackBg,
    baseUrl: baseItem?.imagePath || "",
    headUrl: headItem?.imagePath || "",
    bodyUrl: bodyItem?.imagePath || "",
    accessoryUrl: accItem?.imagePath || "",
    petUrl: petItem?.imagePath || "",
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
        <img src="${escapeAttr(preview.backgroundUrl)}" alt="Avatar World room background preview" />

        ${preview.baseUrl ? `<img class="awWidgetPreviewLayer" src="${escapeAttr(preview.baseUrl)}" alt="" />` : ""}
        ${preview.bodyUrl ? `<img class="awWidgetPreviewLayer" src="${escapeAttr(preview.bodyUrl)}" alt="" />` : ""}
        ${preview.headUrl ? `<img class="awWidgetPreviewLayer" src="${escapeAttr(preview.headUrl)}" alt="" />` : ""}
        ${preview.accessoryUrl ? `<img class="awWidgetPreviewLayer" src="${escapeAttr(preview.accessoryUrl)}" alt="" />` : ""}
        ${preview.petUrl ? `<img class="awWidgetPreviewLayer" src="${escapeAttr(preview.petUrl)}" alt="" />` : ""}
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
    window.location.href = "/readathon-world_Ver2/html/avatar-catalog-admin.html";
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