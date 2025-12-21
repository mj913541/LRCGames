/* worlds/monarchWorld/data/nominees-2026.js */

export const SEASON = "2026";

// Simple slugifier for consistent filenames/IDs
export function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/['’]/g, "")          // remove apostrophes
    .replace(/[^a-z0-9]+/g, "-")   // non-alnum -> hyphen
    .replace(/^-+|-+$/g, "");      // trim hyphens
}

// Your 2026 nominees (titles only; keep as the human-readable truth)
export const NOMINEES_2026 = [
  "Mr. S: A First Day of School Book",
  "Negative Cat",
  "Yoshi, Sea Turtle Genius",
  "Sydney and Taylor Explore the Whole Wide World",
  "Knight Owl",
  "Beneath",
  "Thunder and Cluck: Friends Do Not Eat Friends",
  "We Are Definitely Human",
  "The Red Jacket",
  "Hamsters Make Terrible Roommates",
  "The Flower Garden",
  "Butt or Face?: A Hilarious Animal Guessing Game for Kids",
  "Time to Make Art",
  "Bathe the Cat",
  "Who’s Afraid of the Light?",
  "Just SNOW Already!",
  "Home is Calling: The Journey of the Monarch Butterfly",
  "The World’s Best Class Plant",
  "Claude: The True Story of a White Alligator",
  "Homegrown"
];

export function slugify(title) {
  return String(title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function coverPath2026(title) {
  return `../assets/covers/2026/${slugify(title)}.png`;
}


// Optional: richer objects (future covers, authors, etc.)
export const NOMINEE_OBJECTS_2026 = NOMINEES_2026.map((title) => ({
  title,
  slug: slugify(title),
  // optional later:
  // cover: `../assets/covers/2026/${slugify(title)}.png`
}));
