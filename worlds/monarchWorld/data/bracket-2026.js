/* worlds/monarchWorld/data/bracket-2026.js */

import { SEASON } from "./nominees-2026.js";

export const BRACKET_SEASON = SEASON;

// Round IDs used everywhere
export const ROUND_IDS = {
  R1: "r1",
  R2: "r2",
  R3: "r3",
  FINAL: "final"
};

// Round 1 = 10 battles (20 books)
export const ROUND1_MATCHUPS = [
  ["Mr. S: A First Day of School Book", "Negative Cat"],
  ["Yoshi, Sea Turtle Genius", "Sydney and Taylor Explore the Whole Wide World"],
  ["Knight Owl", "Beneath"],
  ["Thunder and Cluck: Friends Do Not Eat Friends", "We Are Definitely Human"],
  ["The Red Jacket", "Hamsters Make Terrible Roommates"],
  ["The Flower Garden", "Butt or Face?: A Hilarious Animal Guessing Game for Kids"],
  ["Time to Make Art", "Bathe the Cat"],
  ["Who’s Afraid of the Light?", "Just SNOW Already!"],
  ["Home is Calling: The Journey of the Monarch Butterfly", "The World’s Best Class Plant"],
  ["Claude: The True Story of a White Alligator", "Homegrown"]
];

/**
 * For now, Round 2/3/final can be generated dynamically from votes
 * (teacher tool or auto-advance).
 * But if you ever want a fixed bracket, you can define them here later.
 */
export const EMPTY_ROUND = [];
