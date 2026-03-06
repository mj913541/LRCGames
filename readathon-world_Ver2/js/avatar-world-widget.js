// /readathon-world_Ver2/js/avatar-world-widget.js

import {
  auth,
  db,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
} from "/readathon-world_Ver2/js/firebase.js";

import {
  normalizeError,
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

  const openUrl =
    opts.openUrl || "/readathon-world_Ver2/html/avatar-world.html";

  const role = opts.role || "student";
  const schoolId = opts.schoolId || getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = opts.userId || auth.currentUser?.uid;

  if (!schoolId || !userId) {
    mountEl.innerHTML = renderError("Missing schoolId or userId.");
    return;
  }

  try {
    mountEl.innerHTML = renderLoading();

    const [roomState, catalogById] = await Promise.all([
      loadRoomState(schoolId, userId),
      loadCatalogMap(schoolId),
    ]);

    mountEl.innerHTML = renderWidget({
      role,
      previewUrl: getPreviewUrl(roomState, catalogById),
      hasRoom: !!roomState,
      openUrl,
      showAdminTools: role === "admin",
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
  const snap = await getDocs(query(catalogColRef(schoolId), orderBy("__name__")));
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
  Preview logic
---------------------------- */
function getPreviewUrl(roomState, catalogById) {
  const fallback = "/readathon-world_Ver2/img/bg/index.png";

  if (!roomState?.equipped?.background) return fallback;

  const bgItem = catalogById.get(roomState.equipped.background);
  return bgItem?.imagePath || fallback;
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
      <div style="margin-top:8px; opacity:.8;">${escapeHtml(msg)}</div>
    </div>
  `;
}

function renderWidget({ role, previewUrl, hasRoom, openUrl, showAdminTools }) {
  return `
    <div class="awWidget">
      <div class="awWidgetHeader">
        <div class="awWidgetTitle">Avatar World</div>
        <div>${escapeHtml(role)}</div>
      </div>

      <div class="awWidgetPreview">
        <img src="${escapeAttr(previewUrl)}" alt="Avatar World room preview" />
      </div>

      <div style="margin-bottom:12px;">
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