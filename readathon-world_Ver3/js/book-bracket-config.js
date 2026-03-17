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
   For now, keep covers + YouTube info here.
   Later, these same values can be seeded into Firestore.
========================================================= */

export const BOOK_BRACKET_BOOKS = [
  // ======================================================
  // FOOD & FUNNY
  // ======================================================
  {
    bookId: "food_01_dragons_love_tacos",
    regionKey: "food",
    regionLabel: "Food & Funny",
    seed: 1,
    sortOrder: 1,
    title: "Dragons Love Tacos",
    author: "Adam Rubin",
    coverImage: "/img/book-bracket/dragons-love-tacos.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "food_02_the_bad_seed",
    regionKey: "food",
    regionLabel: "Food & Funny",
    seed: 2,
    sortOrder: 2,
    title: "The Bad Seed",
    author: "Jory John",
    coverImage: "/img/book-bracket/the-bad-seed.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "food_03_the_good_egg",
    regionKey: "food",
    regionLabel: "Food & Funny",
    seed: 3,
    sortOrder: 3,
    title: "The Good Egg",
    author: "Jory John",
    coverImage: "/img/book-bracket/the-good-egg.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "food_04_cloudy_with_a_chance_of_meatballs",
    regionKey: "food",
    regionLabel: "Food & Funny",
    seed: 4,
    sortOrder: 4,
    title: "Cloudy with a Chance of Meatballs",
    author: "Judi Barrett",
    coverImage: "/img/book-bracket/cloudy-with-a-chance-of-meatballs.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
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
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "higgins_02_mother_bruce",
    regionKey: "higgins",
    regionLabel: "Higgins Hilarity",
    seed: 2,
    sortOrder: 2,
    title: "Mother Bruce",
    author: "Ryan T. Higgins",
    coverImage: "/img/book-bracket/mother-bruce.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "higgins_03_norman_didnt_do_it",
    regionKey: "higgins",
    regionLabel: "Higgins Hilarity",
    seed: 3,
    sortOrder: 3,
    title: "Norman Didn't Do It! (Yes He Did)",
    author: "Ryan T. Higgins",
    coverImage: "/img/book-bracket/norman-didnt-do-it.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "higgins_04_be_quiet",
    regionKey: "higgins",
    regionLabel: "Higgins Hilarity",
    seed: 4,
    sortOrder: 4,
    title: "Be Quiet!",
    author: "Ryan T. Higgins",
    coverImage: "/img/book-bracket/be-quiet.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },

  // ======================================================
  // KINDNESS & FEELINGS
  // ======================================================
  {
    bookId: "feelings_01_the_day_you_begin",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    seed: 1,
    sortOrder: 1,
    title: "The Day You Begin",
    author: "Jacqueline Woodson",
    coverImage: "/img/book-bracket/the-day-you-begin.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "feelings_02_the_invisible_boy",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    seed: 2,
    sortOrder: 2,
    title: "The Invisible Boy",
    author: "Trudy Ludwig",
    coverImage: "/img/book-bracket/the-invisible-boy.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "feelings_03_after_the_fall",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    seed: 3,
    sortOrder: 3,
    title: "After the Fall",
    author: "Dan Santat",
    coverImage: "/img/book-bracket/after-the-fall.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "feelings_04_have_you_filled_a_bucket_today",
    regionKey: "feelings",
    regionLabel: "Kindness & Feelings",
    seed: 4,
    sortOrder: 4,
    title: "Have You Filled a Bucket Today?",
    author: "Carol McCloud",
    coverImage: "/img/book-bracket/have-you-filled-a-bucket-today.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },

  // ======================================================
  // ANIMALS & ADVENTURE
  // ======================================================
  {
    bookId: "animals_01_the_gruffalo",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    seed: 1,
    sortOrder: 1,
    title: "The Gruffalo",
    author: "Julia Donaldson",
    coverImage: "/img/book-bracket/the-gruffalo.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "animals_02_dont_let_the_pigeon_drive_the_bus",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    seed: 2,
    sortOrder: 2,
    title: "Don't Let the Pigeon Drive the Bus!",
    author: "Mo Willems",
    coverImage: "/img/book-bracket/dont-let-the-pigeon-drive-the-bus.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "animals_03_interrupting_chicken",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    seed: 3,
    sortOrder: 3,
    title: "Interrupting Chicken",
    author: "David Ezra Stein",
    coverImage: "/img/book-bracket/interrupting-chicken.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
    isActive: true
  },
  {
    bookId: "animals_04_bear_came_along",
    regionKey: "animals",
    regionLabel: "Animals & Adventure",
    seed: 4,
    sortOrder: 4,
    title: "Bear Came Along",
    author: "Richard T. Morris",
    coverImage: "/img/book-bracket/bear-came-along.jpg",
    youtubeVideoId: "",
    youtubeUrl: "",
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
    bookAId: "food_01_dragons_love_tacos",
    bookBId: "food_04_cloudy_with_a_chance_of_meatballs",
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
    bookAId: "food_02_the_bad_seed",
    bookBId: "food_03_the_good_egg",
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
    bookBId: "higgins_04_be_quiet",
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
    bookAId: "higgins_02_mother_bruce",
    bookBId: "higgins_03_norman_didnt_do_it",
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
    bookAId: "feelings_01_the_day_you_begin",
    bookBId: "feelings_04_have_you_filled_a_bucket_today",
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
    bookAId: "feelings_02_the_invisible_boy",
    bookBId: "feelings_03_after_the_fall",
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
    bookAId: "animals_01_the_gruffalo",
    bookBId: "animals_04_bear_came_along",
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
    bookAId: "animals_02_dont_let_the_pigeon_drive_the_bus",
    bookBId: "animals_03_interrupting_chicken",
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
  return BOOK_BRACKET_BOOKS.find(book => book.bookId === bookId) || null;
}

export function getMatchupById(matchupId) {
  return BOOK_BRACKET_MATCHUPS.find(matchup => matchup.matchupId === matchupId) || null;
}

export function getBooksByRegion(regionKey) {
  return BOOK_BRACKET_BOOKS.filter(book => book.regionKey === regionKey)
    .sort((a, b) => a.seed - b.seed);
}

export function getRoundMatchups(roundNumber) {
  return BOOK_BRACKET_MATCHUPS.filter(matchup => matchup.roundNumber === roundNumber)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}