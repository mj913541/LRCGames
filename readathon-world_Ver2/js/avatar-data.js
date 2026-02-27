// /readathon-world_Ver2/js/avatar-data.js
// IMPORTANT: itemIds are designed to work with your existing pickSlotForItem(itemId)
// which checks if the id includes "head", "body", "pet", "room/bg" else accessory.

export const AVATAR_ASSETS = {
  // Base layers (you can swap images later)
  avatarBase: "/readathon-world_Ver2/assets/avatar/base/avatar_base.png",

  // Room background image (CSS uses this too; keep consistent if you want)
  roomBg: "/readathon-world_Ver2/assets/avatar/room/room_bg_1024.png",
};

// Firestore paths (CONFIRMED inventory path from your app.js)
export function userInventoryItemPath(schoolId, userId, itemId) {
  // readathonV2_schools/{schoolId}/users/{userId}/readathon/summary/inventory/{itemId}
  return [
    "readathonV2_schools", schoolId,
    "users", userId,
    "readathon", "summary",
    "inventory", itemId,
  ];
}

export function userAvatarRoomStatePath(schoolId, userId) {
  // store room state in a separate doc (does not break existing student-home preview)
  return [
    "readathonV2_schools", schoolId,
    "users", userId,
    "avatarRoom", "state",
  ];
}

export function avatarCatalogItemPath(schoolId, itemId) {
  return ["readathonV2_schools", schoolId, "avatarCatalog", "items", itemId];
}

export function avatarCatalogColPath(schoolId) {
  return ["readathonV2_schools", schoolId, "avatarCatalog", "items"];
}

// ---- Seeded catalog (10–15 items across categories) ----
// NOTE: We store catalog docs with id = itemId and also include itemId field for convenience.
// All imagePath values are placeholders; missing images will show placeholders in the UI.

export const SEEDED_CATALOG = [
  // Head
  {
    itemId: "item_head_explorer_hat",
    name: "Explorer Hat",
    type: "head",
    price: 50,
    imagePath: "/readathon-world_Ver2/assets/avatar/wearables/head/explorer_hat.png",
    enabled: true,
    rarity: "common",
  },
  {
    itemId: "item_head_jungle_crown",
    name: "Jungle Crown",
    type: "head",
    price: 120,
    imagePath: "/readathon-world_Ver2/assets/avatar/wearables/head/jungle_crown.png",
    enabled: true,
    rarity: "rare",
  },

  // Body
  {
    itemId: "item_body_jungle_vest",
    name: "Jungle Vest",
    type: "body",
    price: 80,
    imagePath: "/readathon-world_Ver2/assets/avatar/wearables/body/jungle_vest.png",
    enabled: true,
    rarity: "common",
  },
  {
    itemId: "item_body_ranger_uniform",
    name: "Ranger Uniform",
    type: "body",
    price: 140,
    imagePath: "/readathon-world_Ver2/assets/avatar/wearables/body/ranger_uniform.png",
    enabled: true,
    rarity: "rare",
  },

  // Accessory (your pickSlotForItem defaults to accessory unless it matches head/body/pet/room)
  {
    itemId: "item_accessory_binoculars",
    name: "Binoculars",
    type: "accessory",
    price: 60,
    imagePath: "/readathon-world_Ver2/assets/avatar/wearables/accessory/binoculars.png",
    enabled: true,
    rarity: "common",
  },
  {
    itemId: "item_accessory_magic_compass",
    name: "Magic Compass",
    type: "accessory",
    price: 150,
    imagePath: "/readathon-world_Ver2/assets/avatar/wearables/accessory/magic_compass.png",
    enabled: true,
    rarity: "epic",
  },

  // Pet
  {
    itemId: "item_pet_toucan",
    name: "Toucan Buddy",
    type: "pet",
    price: 100,
    imagePath: "/readathon-world_Ver2/assets/avatar/pets/toucan.png",
    enabled: true,
    rarity: "common",
  },
  {
    itemId: "item_pet_baby_panther",
    name: "Baby Panther",
    type: "pet",
    price: 180,
    imagePath: "/readathon-world_Ver2/assets/avatar/pets/baby_panther.png",
    enabled: true,
    rarity: "rare",
  },

  // Wall
  {
    itemId: "item_wall_map_poster",
    name: "Treasure Map Poster",
    type: "wall",
    price: 70,
    imagePath: "/readathon-world_Ver2/assets/avatar/room/wall/map_poster.png",
    enabled: true,
    rarity: "common",
  },
  {
    itemId: "item_wall_bookshelf",
    name: "Tiny Bookshelf",
    type: "wall",
    price: 160,
    imagePath: "/readathon-world_Ver2/assets/avatar/room/wall/bookshelf.png",
    enabled: true,
    rarity: "rare",
  },

  // Floor
  {
    itemId: "item_floor_guitar",
    name: "Campfire Guitar",
    type: "floor",
    price: 120,
    imagePath: "/readathon-world_Ver2/assets/avatar/room/floor/guitar.png",
    enabled: true,
    rarity: "common",
  },
  {
    itemId: "item_floor_plant",
    name: "Jungle Plant",
    type: "floor",
    price: 90,
    imagePath: "/readathon-world_Ver2/assets/avatar/room/floor/plant.png",
    enabled: true,
    rarity: "common",
  },
  {
    itemId: "item_floor_tiger_rug",
    name: "Tiger Rug",
    type: "floor",
    price: 200,
    imagePath: "/readathon-world_Ver2/assets/avatar/room/floor/tiger_rug.png",
    enabled: true,
    rarity: "epic",
  },
];

// Basic grouping helper for inventory panel
export function panelForType(type) {
  if (type === "pet") return "pets";
  if (type === "wall") return "wall";
  if (type === "floor") return "floor";
  return "wear"; // head/body/accessory
}
