#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const BASE_DIR = path.resolve(__dirname, "../readathon-world_Ver2/img/avatar-world");

// Add any new filenames here
const files = [
  "head/head_baseball_cap_01.png",
  "head/head_wizard_hat_01.png",
  "head/head_astronaut_helmet_01.png",
  "head/head_crown_01.png",

  "clothes/clothes_hero_cape_01.png",
  "clothes/clothes_fairy_wings_01.png",
  "clothes/clothes_mermaid_costume_01.png",
  "clothes/clothes_dino_costume_01.png",
  "clothes/clothes_space_ranger_suit_01.png",

  "accessory/accessory_round_glasses_01.png",
  "accessory/accessory_star_glasses_01.png",
  "accessory/accessory_sparkles_aura_01.png",
  "accessory/accessory_soft_glow_01.png",
  "accessory/accessory_cool_shadow_01.png",
  "accessory/accessory_badge_reading_streak_01.png",
  "accessory/accessory_badge_book_boss_01.png",
  "accessory/accessory_title_page_turner_01.png",
  "accessory/accessory_title_library_legend_01.png",

  "pet/pet_robot_buddy_01.png",
  "pet/pet_kawaii_kitty_01.png",
  "pet/pet_kawaii_puppy_01.png",
  "pet/pet_hamster_01.png",
  "pet/pet_gecko_01.png",
  "pet/pet_tiny_dragon_01.png",
  "pet/pet_spirit_fox_01.png",
  "pet/pet_book_sprite_01.png",
  "pet/pet_baby_tiger_01.png",
  "pet/pet_merpup_01.png",
  "pet/pet_alien_blob_01.png",
  "pet/pet_mini_dino_01.png",
  "pet/pet_hockey_penguin_01.png",
  "pet/pet_hybrid_bunfox_01.png",
  "pet/pet_mystery_egg_01.png",
];

async function create() {
  for (const file of files) {
    const fullPath = path.join(BASE_DIR, file);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(fullPath)) {
      console.log("Skipping existing:", file);
      continue;
    }

    await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .png()
      .toFile(fullPath);

    console.log("Created:", file);
  }

  console.log("🎉 All placeholders generated.");
}

create();