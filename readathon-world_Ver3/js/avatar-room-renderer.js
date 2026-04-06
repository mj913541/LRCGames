// /readathon-world_Ver2/js/avatar-room-renderer.js

export function renderAvatarRoom(sceneEl, roomState, catalogById, opts = {}) {
  if (!sceneEl) return;

  const mode = opts.mode === "widget" ? "widget" : "full";
  const selectedPlacement = opts.selectedPlacement || null;
  const onWireElement =
    typeof opts.onWireElement === "function" ? opts.onWireElement : null;

  const layers = ensureSceneLayers(sceneEl, opts.layers);

  clearLayer(layers.wall);
  clearLayer(layers.avatar);
  clearLayer(layers.pet);
  clearLayer(layers.floor);

  renderBackground(layers.background, roomState, catalogById, opts);
  renderPlacedObjects(layers.wall, roomState?.wallPlacements || [], catalogById, {
    kind: "wall",
    mode,
    selectedPlacement,
    onWireElement,
  });

  renderAvatar(layers.avatar, roomState, catalogById, {
    mode,
    selectedPlacement,
    onWireElement,
  });

  renderPets(layers.pet, roomState?.petPlacements || [], catalogById, {
    mode,
    selectedPlacement,
    onWireElement,
  });

  renderPlacedObjects(layers.floor, roomState?.floorPlacements || [], catalogById, {
    kind: "floor",
    mode,
    selectedPlacement,
    onWireElement,
  });
}

function ensureSceneLayers(sceneEl, providedLayers = null) {
  if (providedLayers?.background && providedLayers?.wall && providedLayers?.avatar && providedLayers?.pet && providedLayers?.floor) {
    return providedLayers;
  }

  let background = sceneEl.querySelector(".aw-room-background");
  let wall = sceneEl.querySelector(".aw-layer-wall");
  let avatar = sceneEl.querySelector(".aw-layer-avatar");
  let pet = sceneEl.querySelector(".aw-layer-pet");
  let floor = sceneEl.querySelector(".aw-layer-floor");

  if (!background) {
    background = document.createElement("div");
    background.className = "aw-room-background";
    sceneEl.appendChild(background);
  }

  if (!wall) {
    wall = document.createElement("div");
    wall.className = "aw-layer aw-layer-wall";
    sceneEl.appendChild(wall);
  }

  if (!avatar) {
    avatar = document.createElement("div");
    avatar.className = "aw-layer aw-layer-avatar";
    sceneEl.appendChild(avatar);
  }

  if (!pet) {
    pet = document.createElement("div");
    pet.className = "aw-layer aw-layer-pet";
    sceneEl.appendChild(pet);
  }

  if (!floor) {
    floor = document.createElement("div");
    floor.className = "aw-layer aw-layer-floor";
    sceneEl.appendChild(floor);
  }

  return { background, wall, avatar, pet, floor };
}

function clearLayer(layerEl) {
  if (layerEl) layerEl.innerHTML = "";
}

function renderBackground(backgroundEl, roomState, catalogById, opts = {}) {
  if (!backgroundEl) return;

  const fallbackBg = opts.backgroundFallback || "../img/bg/index.png";
  const bgItem = roomState?.backgroundId
    ? catalogById.get(roomState.backgroundId)
    : null;

  backgroundEl.style.backgroundImage = `url("${escapeHtml(bgItem?.imageUrl || fallbackBg)}")`;
}

function renderAvatar(layerEl, roomState, catalogById, opts = {}) {
  if (!layerEl) return;

  const avatarPlacement = roomState?.avatarPlacement || defaultPlacementForGroup("avatar");
  const base = roomState?.avatarBaseId
    ? catalogById.get(roomState.avatarBaseId)
    : null;

  const wearables = Array.isArray(roomState?.wearableIds)
    ? roomState.wearableIds
        .map((id) => catalogById.get(id))
        .filter(Boolean)
        .sort((a, b) => (a.layerOrder ?? 0) - (b.layerOrder ?? 0))
    : [];

  const selected = isSelected(opts.selectedPlacement, "avatar", 0);
  const el = createPlacementElement({
    mode: opts.mode,
    kind: "avatar",
    index: 0,
    selected,
    extraClass: "aw-avatar-object",
  });

  el.style.left = `${avatarPlacement.x}%`;
  el.style.top = `${avatarPlacement.y}%`;
  el.style.width = `${Math.round(240 * avatarPlacement.scale)}px`;
  el.style.zIndex = String(avatarPlacement.z ?? 25);

  const pieces = [];

  if (base?.imageUrl) {
    pieces.push(`
      <div class="aw-avatar-piece" data-piece="base" style="z-index:${base.layerOrder ?? 10};">
        <img src="${escapeHtml(base.imageUrl)}" alt="" draggable="false">
      </div>
    `);
  }

  wearables.forEach((item) => {
    pieces.push(`
      <div
        class="aw-avatar-piece"
        data-piece="${escapeHtml(item.wearableClass || "wearable")}"
        style="z-index:${item.layerOrder ?? 50};"
      >
        <img src="${escapeHtml(item.imageUrl)}" alt="" draggable="false">
      </div>
    `);
  });

  el.innerHTML = `
    <div class="aw-avatar-stack">
      ${pieces.join("")}
    </div>
    ${selected && opts.mode === "full" ? `<span class="aw-resize-handle" data-resize-handle="true" aria-hidden="true"></span>` : ""}
  `;

  if (opts.mode === "full" && opts.onWireElement) {
    opts.onWireElement(el, "avatar", 0);
  }

  layerEl.appendChild(el);
}

function renderPets(layerEl, petPlacements, catalogById, opts = {}) {
  if (!layerEl) return;

  petPlacements.forEach((pet, index) => {
    const item = catalogById.get(pet.itemId);
    if (!item?.imageUrl) return;

    const selected = isSelected(opts.selectedPlacement, "pet", index);
    const el = createPlacementElement({
      mode: opts.mode,
      kind: "pet",
      index,
      selected,
      extraClass: "aw-pet-object",
    });

    el.style.left = `${pet.x}%`;
    el.style.top = `${pet.y}%`;
    el.style.width = `${Math.round(128 * pet.scale)}px`;
    el.style.zIndex = String(pet.z ?? (32 + index));

    el.innerHTML = `
      <img src="${escapeHtml(item.imageUrl)}" alt="" draggable="false">
      ${selected && opts.mode === "full" ? `<span class="aw-resize-handle" data-resize-handle="true" aria-hidden="true"></span>` : ""}
    `;

    if (opts.mode === "full" && opts.onWireElement) {
      opts.onWireElement(el, "pet", index);
    }

    layerEl.appendChild(el);
  });
}

function renderPlacedObjects(layerEl, list, catalogById, opts = {}) {
  if (!layerEl) return;

  const kind = opts.kind === "wall" ? "wall" : "floor";

  list.forEach((placement, index) => {
    const item = catalogById.get(placement.itemId);
    if (!item?.imageUrl) return;

    const selected = isSelected(opts.selectedPlacement, kind, index);
    const el = createPlacementElement({
      mode: opts.mode,
      kind,
      index,
      selected,
    });

    const baseWidth = kind === "wall" ? 190 : 170;
    const fallbackZ = kind === "wall" ? 12 + index : 42 + index;

    el.style.left = `${placement.x}%`;
    el.style.top = `${placement.y}%`;
    el.style.width = `${Math.round(baseWidth * placement.scale)}px`;
    el.style.zIndex = String(placement.z ?? fallbackZ);

    el.innerHTML = `
      <img src="${escapeHtml(item.imageUrl)}" alt="" draggable="false">
      ${selected && opts.mode === "full" ? `<span class="aw-resize-handle" data-resize-handle="true" aria-hidden="true"></span>` : ""}
    `;

    if (opts.mode === "full" && opts.onWireElement) {
      opts.onWireElement(el, kind, index);
    }

    layerEl.appendChild(el);
  });
}

function createPlacementElement({ mode, kind, index, selected, extraClass = "" }) {
  const tag = mode === "full" ? "button" : "div";
  const el = document.createElement(tag);

  if (tag === "button") {
    el.type = "button";
  }

  el.className = [
    "aw-room-object",
    extraClass,
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  el.dataset.kind = kind;
  el.dataset.index = String(index);

  return el;
}

function isSelected(selectedPlacement, kind, index) {
  return (
    selectedPlacement?.kind === kind &&
    Number(selectedPlacement?.index) === Number(index)
  );
}

function defaultPlacementForGroup(kind) {
  if (kind === "avatar") return { x: 50, y: 78, scale: 1, z: 25 };
  if (kind === "wall") return { x: 26, y: 30, scale: 1, z: 12 };
  if (kind === "floor") return { x: 26, y: 78, scale: 1, z: 42 };
  if (kind === "pets") return { x: 77, y: 78, scale: 1, z: 32 };
  return { x: 50, y: 50, scale: 1, z: 10 };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}