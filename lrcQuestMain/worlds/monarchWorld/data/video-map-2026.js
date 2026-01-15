/* worlds/monarchWorld/data/video-map-2026.js */

import { slugify } from "./nominees-2026.js";

export const VIDEO_BASE_2026 = "../videos/2026/";

/**
 * Explicit mapping (your current list).
 * Keep this explicit so a single mismatch doesn't break filenames silently.
 */
export const VIDEO_FILES_2026 = {
  "Mr. S: A First Day of School Book": "mr-s.mp4",
  "Negative Cat": "negative-cat.mp4",
  "Yoshi, Sea Turtle Genius": "yoshi-sea-turtle-genius.mp4",
  "Sydney and Taylor Explore the Whole Wide World": "sydney-and-taylor-explore-the-whole-wide-world.mp4",
  "Knight Owl": "knight-owl.mp4",
  "Beneath": "beneath.mp4",
  "Thunder and Cluck: Friends Do Not Eat Friends": "thunder-and-cluck-friends-do-not-eat-friends.mp4",
  "We Are Definitely Human": "we-are-definitely-human.mp4",
  "The Red Jacket": "the-red-jacket.mp4",
  "Hamsters Make Terrible Roommates": "hamsters-make-terrible-roommates.mp4",
  "The Flower Garden": "the-flower-garden.mp4",
  "Butt or Face?: A Hilarious Animal Guessing Game for Kids": "butt-or-face.mp4",
  "Time to Make Art": "time-to-make-art.mp4",
  "Bathe the Cat": "bathe-the-cat.mp4",
  "Who’s Afraid of the Light?": "whos-afraid-of-the-light.mp4",
  "Just SNOW Already!": "just-snow-already.mp4",
  "Home is Calling: The Journey of the Monarch Butterfly": "home-is-calling-the-journey-of-the-monarch-butterfly.mp4",
  "The World’s Best Class Plant": "the-worlds-best-class-plant.mp4",
  "Claude: The True Story of a White Alligator": "claude-the-true-story-of-a-white-alligator.mp4",
  "Homegrown": "homegrown.mp4"
};

export function getVideoUrl2026(title) {
  const file = VIDEO_FILES_2026[title];
  return file ? (VIDEO_BASE_2026 + file) : "";
}

// Optional fallback if you ever want "auto" mapping:
export function guessVideoFilename(title) {
  return `${slugify(title)}.mp4`;
}
