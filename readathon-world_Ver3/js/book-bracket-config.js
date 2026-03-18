// /readathon-world_Ver3/js/book-bracket-config.js

/* =========================================================
   EVENT CONSTANTS
========================================================= */

export const BOOK_BRACKET_FEATURE_KEY = "bookBracket";
export const BOOK_BRACKET_EVENT_ID = "book_madness_2026";
export const BOOK_BRACKET_EVENT_TITLE = "Book Madness 2026";

export const BOOK_BRACKET_ROUNDS = {
  1: "Sweet 16",
  2: "Elite 8",
  3: "Final 4",
  4: "Championship"
};

export const BOOK_BRACKET_EVENT_STATUS = {
  draft: "draft",
  live: "live",
  paused: "paused",
  completed: "completed"
};

export const BOOK_BRACKET_MATCHUP_STATUS = {
  locked: "locked",
  live: "live",
  closed: "closed",
  complete: "complete"
};

export const BOOK_BRACKET_ROLES = {
  student: "student",
  staff: "staff",
  admin: "admin"
};

export const BOOK_BRACKET_REGION_KEYS = {
  food: "Food & Funny",
  higgins: "Higgins Hilarity",
  feelings: "Kindness & Feelings",
  animals: "Animals & Adventure",
  final4: "Final 4",
  championship: "Championship"
};

export const BOOK_BRACKET_REWARD_RULES = {
  bookAComplete: 10,
  bookBComplete: 10,
  voteCast: 5,
  matchupComplete: 5,
  totalPerMatchup: 30
};

export const BOOK_BRACKET_VIDEO_RULES = {
  completionThresholdPercent: 0.9,
  minimumWatchSecondsFloor: 30,
  requireEmbeddedPlayback: true,
  allowTeacherUnlockOverride: true,
  blockSkippingAhead: true
};

export const BOOK_BRACKET_ACTION_TYPES = {
  watchSessionStarted: "watch_session_started",
  watchProgressPing: "watch_progress_ping",
  bookCompleted: "book_completed",
  voteCast: "vote_cast",
  matchupCompleted: "matchup_completed",
  rewardAwarded: "reward_awarded",
  teacherUnlockUsed: "teacher_unlock_used",
  roundAdvanced: "round_advanced"
};

export const BOOK_BRACKET_REWARD_TYPES = {
  bookCompletion: "book_completion",
  voteCast: "vote_cast",
  matchupCompletion: "matchup_completion"
};

/* =========================================================
   REGION DISPLAY ORDER
========================================================= */

export const BOOK_BRACKET_REGION_ORDER = [
  "food",
  "higgins",
  "feelings",
  "animals"
];

/* =========================================================
   BOOKS
========================================================= */

export const BOOK_BRACKET_BOOKS = [
  // ======================================================
  // FOOD & FUNNY
  // ======================================================
  {
    bookId: "food_01_the_smart_cookie",
    regionKey: "food",
    regionLabel: "Food & Funny",
    seed: 1,
    sortOrder: 1,
    title: "The Smart Cookie",
    author: "Jory John",
    coverImage: "/img/book-bracket/the-smart-cookie.jpg",
    youtubeVideoId: "LJq-7-wycqY",
    youtubeUrl: "https://youtu.be/LJq-7-wycqY",
    isActive: true
  },
  {
    bookId: "food_02_the_couch_potato",
    regionKey: "food",
    regionLabel: "Food & Funny",
    seed: 2,
    sortOrder: 2,
    title: "The Couch Potato",
    author: "Jory John",
    coverImage: "/img/book-bracket/the-couch-potato.jpg",
    youtubeVideoId: "qfwF75e4BYc",
    youtubeUrl: "https://youtu.be/qfwF75e4BYc",
    isActive: true
  },
  {
    bookId: "food_03_the_sour_grape",
    regionKey: "food",
    regionLabel: "Food & Funny",
    seed: 3,
    sortOrder: 3,
    title: "The Sour Grape",
    author: "Jory John",
    coverImage: "/img/book-bracket/the-sour-grape.jpg",
    youtubeVideoId: "QZn1SCPtOw4",
    youtubeUrl: "https://youtu.be/QZn1SCPtOw4",
    isActive: true
  },
  {
    bookId: "food_04_the_big_cheese",
    regionKey: "food",
    regionLabel: "Food & Funny",
    seed: 4,
    sortOrder: 4,
    title: "The Big Cheese",
    author: "Jory John",
    coverImage: "/img/book-bracket/the-big-cheese.jpg",
    youtubeVideoId: "8X0x7mqwJiU",
    youtubeUrl: "https://youtu.be/8X0x7mqwJiU",
    isActive: true
  },

  // ======================================================
  // HIGGINS HILARITY
  // ======================================================
  {
    bookId: "higgins_01_we_dont_eat_our_classmates",
    regionKey: "higgins",
    regionLabel: "Higgins Hilarity",
    seed: 1,
    sortOrder: 1,
    title: "We Don't Eat Our Classmates",
    author: "Ryan T. Higgins",
    coverImage: "/img/book-bracket/we-dont-eat-our-classmates.jpg",
    youtubeVideoId: "th6exRnPixg",
    youtubeUrl: "https://youtu.be/th6exRnPixg",
    isActive: true
  },
  {
    bookId: "higgins_02_knight_owl",
    regionKey: "higgins",
    regionLabel: "Higgins Hilarity",
    seed: 2,
    sortOrder: 2,
    title: "Knight Owl",
    author: "Christopher Denise",
    coverImage: "/img/book-bracket/knight-owl.jpg",
    youtubeVideoId: "503VhkZAEfw",
    youtubeUrl: "https://youtu.be/503VhkZAEfw",
    isActive: true
  },
  {
    bookId: "higgins_03_dragons_love_tacos",
    regionKey: "higgins",
    regionLabel: "Higgins Hilarity",
    seed: 3,
    sortOrder: 3,
    title: "Dragons Love Tacos",
    author: "Adam Rubin",
    coverImage: "/img/book-bracket/dragons-love-tacos.jpg",
    youtubeVideoId: "JYy9gbv44QE",
    youtubeUrl: "https://youtu.be/JYy9gbv44QE",
    isActive: true
  },
  {
    bookId: "higgins_04_how_to_catch_a_snowman",
    regionKey: "higgins",
    regionLabel: "Higgins Hilarity",
    seed: 4,
    sortOrder: 4,
    title: "How to Catch a Snowman",
    author: "Adam Wallace",
    coverImage: "/img/book-bracket/how-to-catch-a-snowman.jpg",
    youtubeVideoId: "Xtd-mTRcu7U",
    youtubeUrl: "https://youtu.be/Xtd-mTRcu7U",
    isActive: true
  },

  // ======================================================
  // KINDNESS & FEELINGS
  // ======================================================
  {
    bookId: "feelings_01_gym_teacher_black_lagoon",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    seed: 1,
    sortOrder: 1,
    title: "The Gym Teacher from the Black Lagoon",
    author: "Mike Thaler",
    coverImage: "/img/book-bracket/gym-teacher-black-lagoon.jpg",
    youtubeVideoId: "AR9oL1YfpRU",
    youtubeUrl: "https://youtu.be/AR9oL1YfpRU",
    isActive: true
  },
  {
    bookId: "feelings_02_music_teacher_black_lagoon",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    seed: 2,
    sortOrder: 2,
    title: "The Music Teacher from the Black Lagoon",
    author: "Mike Thaler",
    coverImage: "/img/book-bracket/music-teacher-black-lagoon.jpg",
    youtubeVideoId: "7-s0hcwQOaE",
    youtubeUrl: "https://youtu.be/7-s0hcwQOaE",
    isActive: true
  },
  {
    bookId: "feelings_03_librarian_black_lagoon",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    seed: 3,
    sortOrder: 3,
    title: "The Librarian from the Black Lagoon",
    author: "Mike Thaler",
    coverImage: "/img/book-bracket/librarian-black-lagoon.jpg",
    youtubeVideoId: "ZOZ7ExGHsCw",
    youtubeUrl: "https://youtu.be/ZOZ7ExGHsCw",
    isActive: true
  },
  {
    bookId: "feelings_04_class_pet_black_lagoon",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    seed: 4,
    sortOrder: 4,
    title: "The Class Pet from the Black Lagoon",
    author: "Mike Thaler",
    coverImage: "/img/book-bracket/class-pet-black-lagoon.jpg",
    youtubeVideoId: "r54lszFx_8g",
    youtubeUrl: "https://youtu.be/r54lszFx_8g",
    isActive: true
  },

  // ======================================================
  // ANIMALS & ADVENTURE
  // ======================================================
  {
    bookId: "animals_01_pig_the_star",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    seed: 1,
    sortOrder: 1,
    title: "Pig the Star",
    author: "Aaron Blabey",
    coverImage: "/img/book-bracket/pig-the-star.jpg",
    youtubeVideoId: "Ic_Ar31iFwA",
    youtubeUrl: "https://youtu.be/Ic_Ar31iFwA",
    isActive: true
  },
  {
    bookId: "animals_02_pig_the_stinker",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    seed: 2,
    sortOrder: 2,
    title: "Pig the Stinker",
    author: "Aaron Blabey",
    coverImage: "/img/book-bracket/pig-the-stinker.jpg",
    youtubeVideoId: "OSaC4JBsOjE",
    youtubeUrl: "https://youtu.be/OSaC4JBsOjE",
    isActive: true
  },
  {
    bookId: "animals_03_pig_the_winner",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    seed: 3,
    sortOrder: 3,
    title: "Pig the Winner",
    author: "Aaron Blabey",
    coverImage: "/img/book-bracket/pig-the-winner.jpg",
    youtubeVideoId: "7Zhzv3RfqGM",
    youtubeUrl: "https://youtu.be/7Zhzv3RfqGM",
    isActive: true
  },
  {
    bookId: "animals_04_pig_the_slob",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    seed: 4,
    sortOrder: 4,
    title: "Pig the Slob",
    author: "Aaron Blabey",
    coverImage: "/img/book-bracket/pig-the-slob.jpg",
    youtubeVideoId: "S5UA0LajxOE",
    youtubeUrl: "https://youtu.be/S5UA0LajxOE",
    isActive: true
  }
];

/* =========================================================
   MATCHUPS
========================================================= */

export const BOOK_BRACKET_MATCHUPS = [
  // ======================================================
  // ROUND 1 — SWEET 16
  // ======================================================
  {
    matchupId: "r1_food_m1",
    roundNumber: 1,
    roundLabel: "Sweet 16",
    regionKey: "food",
    regionLabel: "Food & Funny",
    matchupNumber: 1,
    sortOrder: 1,
    bookAId: "food_01_the_smart_cookie",
    bookBId: "food_04_the_big_cheese",
    seedA: 1,
    seedB: 4,
    nextMatchupId: "r2_food_final",
    nextMatchupSide: "A"
  },
  {
    matchupId: "r1_food_m2",
    roundNumber: 1,
    roundLabel: "Sweet 16",
    regionKey: "food",
    regionLabel: "Food & Funny",
    matchupNumber: 2,
    sortOrder: 2,
    bookAId: "food_02_the_couch_potato",
    bookBId: "food_03_the_sour_grape",
    seedA: 2,
    seedB: 3,
    nextMatchupId: "r2_food_final",
    nextMatchupSide: "B"
  },
  {
    matchupId: "r1_higgins_m1",
    roundNumber: 1,
    roundLabel: "Sweet 16",
    regionKey: "higgins",
    regionLabel: "Higgins Hilarity",
    matchupNumber: 1,
    sortOrder: 3,
    bookAId: "higgins_01_we_dont_eat_our_classmates",
    bookBId: "higgins_04_how_to_catch_a_snowman",
    seedA: 1,
    seedB: 4,
    nextMatchupId: "r2_higgins_final",
    nextMatchupSide: "A"
  },
  {
    matchupId: "r1_higgins_m2",
    roundNumber: 1,
    roundLabel: "Sweet 16",
    regionKey: "higgins",
    regionLabel: "Higgins Hilarity",
    matchupNumber: 2,
    sortOrder: 4,
    bookAId: "higgins_02_knight_owl",
    bookBId: "higgins_03_dragons_love_tacos",
    seedA: 2,
    seedB: 3,
    nextMatchupId: "r2_higgins_final",
    nextMatchupSide: "B"
  },
  {
    matchupId: "r1_feelings_m1",
    roundNumber: 1,
    roundLabel: "Sweet 16",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    matchupNumber: 1,
    sortOrder: 5,
    bookAId: "feelings_01_gym_teacher_black_lagoon",
    bookBId: "feelings_04_class_pet_black_lagoon",
    seedA: 1,
    seedB: 4,
    nextMatchupId: "r2_feelings_final",
    nextMatchupSide: "A"
  },
  {
    matchupId: "r1_feelings_m2",
    roundNumber: 1,
    roundLabel: "Sweet 16",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    matchupNumber: 2,
    sortOrder: 6,
    bookAId: "feelings_02_music_teacher_black_lagoon",
    bookBId: "feelings_03_librarian_black_lagoon",
    seedA: 2,
    seedB: 3,
    nextMatchupId: "r2_feelings_final",
    nextMatchupSide: "B"
  },
  {
    matchupId: "r1_animals_m1",
    roundNumber: 1,
    roundLabel: "Sweet 16",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    matchupNumber: 1,
    sortOrder: 7,
    bookAId: "animals_01_pig_the_star",
    bookBId: "animals_04_pig_the_slob",
    seedA: 1,
    seedB: 4,
    nextMatchupId: "r2_animals_final",
    nextMatchupSide: "A"
  },
  {
    matchupId: "r1_animals_m2",
    roundNumber: 1,
    roundLabel: "Sweet 16",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    matchupNumber: 2,
    sortOrder: 8,
    bookAId: "animals_02_pig_the_stinker",
    bookBId: "animals_03_pig_the_winner",
    seedA: 2,
    seedB: 3,
    nextMatchupId: "r2_animals_final",
    nextMatchupSide: "B"
  },

  // ======================================================
  // ROUND 2 — ELITE 8
  // ======================================================
  {
    matchupId: "r2_food_final",
    roundNumber: 2,
    roundLabel: "Elite 8",
    regionKey: "food",
    regionLabel: "Food & Funny",
    matchupNumber: 1,
    sortOrder: 9,
    sourceMatchupAId: "r1_food_m1",
    sourceMatchupBId: "r1_food_m2",
    nextMatchupId: "r3_semifinal_1",
    nextMatchupSide: "A"
  },
  {
    matchupId: "r2_higgins_final",
    roundNumber: 2,
    roundLabel: "Elite 8",
    regionKey: "higgins",
    regionLabel: "Higgins Hilarity",
    matchupNumber: 1,
    sortOrder: 10,
    sourceMatchupAId: "r1_higgins_m1",
    sourceMatchupBId: "r1_higgins_m2",
    nextMatchupId: "r3_semifinal_1",
    nextMatchupSide: "B"
  },
  {
    matchupId: "r2_feelings_final",
    roundNumber: 2,
    roundLabel: "Elite 8",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    matchupNumber: 1,
    sortOrder: 11,
    sourceMatchupAId: "r1_feelings_m1",
    sourceMatchupBId: "r1_feelings_m2",
    nextMatchupId: "r3_semifinal_2",
    nextMatchupSide: "A"
  },
  {
    matchupId: "r2_animals_final",
    roundNumber: 2,
    roundLabel: "Elite 8",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    matchupNumber: 1,
    sortOrder: 12,
    sourceMatchupAId: "r1_animals_m1",
    sourceMatchupBId: "r1_animals_m2",
    nextMatchupId: "r3_semifinal_2",
    nextMatchupSide: "B"
  },

  // ======================================================
  // ROUND 3 — FINAL 4
  // ======================================================
  {
    matchupId: "r3_semifinal_1",
    roundNumber: 3,
    roundLabel: "Final 4",
    regionKey: "final4",
    regionLabel: "Final 4",
    matchupNumber: 1,
    sortOrder: 13,
    sourceMatchupAId: "r2_food_final",
    sourceMatchupBId: "r2_higgins_final",
    nextMatchupId: "r4_championship",
    nextMatchupSide: "A"
  },
  {
    matchupId: "r3_semifinal_2",
    roundNumber: 3,
    roundLabel: "Final 4",
    regionKey: "final4",
    regionLabel: "Final 4",
    matchupNumber: 2,
    sortOrder: 14,
    sourceMatchupAId: "r2_feelings_final",
    sourceMatchupBId: "r2_animals_final",
    nextMatchupId: "r4_championship",
    nextMatchupSide: "B"
  },

  // ======================================================
  // ROUND 4 — CHAMPIONSHIP
  // ======================================================
  {
    matchupId: "r4_championship",
    roundNumber: 4,
    roundLabel: "Championship",
    regionKey: "championship",
    regionLabel: "Championship",
    matchupNumber: 1,
    sortOrder: 15,
    sourceMatchupAId: "r3_semifinal_1",
    sourceMatchupBId: "r3_semifinal_2"
  }
];

/* =========================================================
   EVENT SEED OBJECT
========================================================= */

export const BOOK_BRACKET_EVENT_SEED = {
  eventId: BOOK_BRACKET_EVENT_ID,
  title: BOOK_BRACKET_EVENT_TITLE,
  featureKey: BOOK_BRACKET_FEATURE_KEY,
  status: BOOK_BRACKET_EVENT_STATUS.draft,
  activeRound: 1,
  activeRoundLabel: BOOK_BRACKET_ROUNDS[1],
  totalRounds: 4,
  roundAdvanceMode: "admin",
  listenMode: "youtube_embedded_monitored",
  listenRequiredBeforeVote: true,
  teacherOverrideEnabled: true,
  completionThresholdPercent: BOOK_BRACKET_VIDEO_RULES.completionThresholdPercent,
  rewardBookA: BOOK_BRACKET_REWARD_RULES.bookAComplete,
  rewardBookB: BOOK_BRACKET_REWARD_RULES.bookBComplete,
  rewardVote: BOOK_BRACKET_REWARD_RULES.voteCast,
  rewardMatchupComplete: BOOK_BRACKET_REWARD_RULES.matchupComplete,
  rewardTotalPerMatchup: BOOK_BRACKET_REWARD_RULES.totalPerMatchup,
  currentChampionBookId: null
};

/* =========================================================
   DEFAULT PROGRESS HELPERS
========================================================= */

export function createEmptyBookState() {
  return {
    started: false,
    completed: false,
    watchSeconds: 0,
    watchPercent: 0,
    maxObservedTime: 0,
    durationSeconds: 0,
    completionMethod: null,
    rewardAwarded: false,
    rewardAmount: 0,
    completedAt: null
  };
}

export function createEmptyMatchupState() {
  return {
    bookACompleted: false,
    bookBCompleted: false,
    voteUnlocked: false,
    voted: false,
    voteRewardAwarded: false,
    matchupRewardAwarded: false,
    matchupCompleted: false,
    teacherUnlocked: false,
    teacherUnlockedBy: null,
    teacherUnlockedAt: null,
    teacherUnlockReason: null
  };
}

export function createEmptyUserProgress({ schoolId = "", userId = "" } = {}) {
  return {
    userId,
    eventId: BOOK_BRACKET_EVENT_ID,
    schoolId,
    totalRubiesAwarded: 0,
    completedMatchupIds: [],
    votedMatchupIds: [],
    teacherUnlockedMatchupIds: [],
    bookStates: {},
    matchupStates: {},
    roundCompletion: {}
  };
}

/* =========================================================
   LOOKUP HELPERS
========================================================= */

export function getBookById(bookId) {
  return BOOK_BRACKET_BOOKS.find((book) => book.bookId === bookId) || null;
}

export function getMatchupById(matchupId) {
  return BOOK_BRACKET_MATCHUPS.find((matchup) => matchup.matchupId === matchupId) || null;
}

export function getBooksByRegion(regionKey) {
  return BOOK_BRACKET_BOOKS
    .filter((book) => book.regionKey === regionKey)
    .sort((a, b) => a.seed - b.seed);
}

export function getRoundMatchups(roundNumber) {
  return BOOK_BRACKET_MATCHUPS
    .filter((matchup) => matchup.roundNumber === roundNumber)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/* =========================================================
   OPTIONAL VALIDATION HELPERS
   Useful for debugging broken IDs during setup
========================================================= */

export function validateBookBracketConfig() {
  const booksById = new Map(BOOK_BRACKET_BOOKS.map((book) => [book.bookId, book]));
  const matchupIds = new Set(BOOK_BRACKET_MATCHUPS.map((matchup) => matchup.matchupId));

  const errors = [];

  for (const matchup of BOOK_BRACKET_MATCHUPS) {
    if (matchup.bookAId && !booksById.has(matchup.bookAId)) {
      errors.push(`Matchup ${matchup.matchupId} is missing bookAId: ${matchup.bookAId}`);
    }

    if (matchup.bookBId && !booksById.has(matchup.bookBId)) {
      errors.push(`Matchup ${matchup.matchupId} is missing bookBId: ${matchup.bookBId}`);
    }

    if (matchup.sourceMatchupAId && !matchupIds.has(matchup.sourceMatchupAId)) {
      errors.push(`Matchup ${matchup.matchupId} is missing sourceMatchupAId: ${matchup.sourceMatchupAId}`);
    }

    if (matchup.sourceMatchupBId && !matchupIds.has(matchup.sourceMatchupBId)) {
      errors.push(`Matchup ${matchup.matchupId} is missing sourceMatchupBId: ${matchup.sourceMatchupBId}`);
    }

    if (matchup.nextMatchupId && !matchupIds.has(matchup.nextMatchupId)) {
      errors.push(`Matchup ${matchup.matchupId} is missing nextMatchupId: ${matchup.nextMatchupId}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}