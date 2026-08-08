import { auth, db } from "../../js/firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// =====================================================
// SETTINGS
// =====================================================

const ALLOWED_EMAILS = new Set([
    "malbrecht@sd308.org",
    "malbrecht3317@gmail.com"
]);

const PLANNER_PROFILE_ID = "mj";

const PAGE_MAP = {
    "1": "1st.html",
    "2": "2nd.html",
    "3": "3rd.html",
    "4": "4th.html",
    "5": "5th.html"
};

const GRADE_ICONS = {
    "1": "🌱",
    "2": "🌿",
    "3": "📘",
    "4": "📗",
    "5": "📙"
};

const CLASS_COUNTS = {
    "1": 3,
    "2": 3,
    "3": 3,
    "4": 4,
    "5": 3
};

const LOCAL_STORAGE_KEY = "lrcLessonPlannerV4";

// =====================================================
// CURRICULUM
// =====================================================

const CURRICULUM = {
    "1": {
        label: "1st Grade",

        core: [
            { title: "LRC Orientation" },
            { title: "Book Care & Checkout Routines" },
            { title: "Research Starts With a Question" },
            { title: "Finding Information" },
            { title: "Keywords" },
            { title: "Choosing a Resource" },
            { title: "Author / Illustrator / Creator" },
            { title: "Basic Citation" },
            { title: "Using Simple Quotes" },
            { title: "Research Celebration & Review" }
        ],

        monarch: [
            { title: "Monarch Lesson 1" },
            { title: "Monarch Lesson 2" },
            { title: "Monarch Lesson 3" },
            { title: "Monarch Lesson 4" },
            { title: "Monarch Lesson 5" },
            { title: "Monarch Lesson 6" },
            { title: "Monarch Lesson 7" },
            { title: "Monarch Lesson 8" },
            { title: "Monarch Lesson 9" },
            { title: "Monarch Lesson 10" },
            { title: "Monarch Lesson 11" },
            { title: "Monarch Lesson 12" },
            { title: "Monarch Lesson 13" },
            { title: "Monarch Lesson 14" },
            { title: "Monarch Lesson 15" },
            { title: "Monarch Lesson 16" },
            { title: "Monarch Lesson 17" },
            { title: "Monarch Lesson 18" },
            { title: "Monarch Lesson 19" },
            { title: "Monarch Lesson 20" }
        ],

        spiral: []
    },

    "2": {
        label: "2nd Grade",

        core: [
            { title: "LRC Orientation" },
            { title: "Book Care & Checkout Routines" },
            { title: "Research Starts With a Question" },
            { title: "Finding Information" },
            { title: "Keywords" },
            { title: "Choosing a Resource" },
            { title: "Author / Illustrator / Creator" },
            { title: "Basic Citation" },
            { title: "Using Simple Quotes" },
            { title: "Research Celebration & Review" }
        ],

        monarch: [
            { title: "Monarch Lesson 1" },
            { title: "Monarch Lesson 2" },
            { title: "Monarch Lesson 3" },
            { title: "Monarch Lesson 4" },
            { title: "Monarch Lesson 5" },
            { title: "Monarch Lesson 6" },
            { title: "Monarch Lesson 7" },
            { title: "Monarch Lesson 8" },
            { title: "Monarch Lesson 9" },
            { title: "Monarch Lesson 10" },
            { title: "Monarch Lesson 11" },
            { title: "Monarch Lesson 12" },
            { title: "Monarch Lesson 13" },
            { title: "Monarch Lesson 14" },
            { title: "Monarch Lesson 15" },
            { title: "Monarch Lesson 16" },
            { title: "Monarch Lesson 17" },
            { title: "Monarch Lesson 18" },
            { title: "Monarch Lesson 19" },
            { title: "Monarch Lesson 20" }
        ],

        spiral: []
    },

    "3": {
        label: "3rd Grade",

        core: [
            {
                title: "Research Begins with a Purpose",
                bigIdea: "Good research starts with meaningful questions and a clear purpose.",
                essentialQuestion: "What am I trying to learn?",
                standards: "1.A, 1.B",
                activity: "Build a clear research purpose from a topic or information need."
            },
            {
                title: "Search Like a Researcher",
                bigIdea: "Different questions require different search strategies.",
                essentialQuestion: "Where should I search first?",
                standards: "1.B, 1.C, 3.A",
                activity: "Compare search strategies and choose the best starting place for different questions."
            },
            {
                title: "Keywords, Search Tools & Databases",
                bigIdea: "Better searches lead to better information.",
                essentialQuestion: "How can I improve my searches?",
                standards: "1.C, 3.A",
                activity: "Practice improving search terms and choosing appropriate search tools or databases."
            },
            {
                title: "Evaluating Sources",
                bigIdea: "Not every source is equally trustworthy.",
                essentialQuestion: "Can I trust this information?",
                standards: "2.A",
                activity: "Evaluate sources using age-appropriate reliability and relevance checks."
            },
            {
                title: "Giving Credit to Others",
                bigIdea: "Information belongs to creators.",
                essentialQuestion: "How do we use others' work ethically?",
                standards: "1.D, 3.A, 3.D",
                activity: "Practice identifying creators and giving credit for information, images, and ideas."
            },
            {
                title: "Organizing Research",
                bigIdea: "Good researchers stay organized.",
                essentialQuestion: "How do I keep track of information?",
                standards: "1.D, 2.B",
                activity: "Organize notes, sources, and evidence so research is easier to use."
            },
            {
                title: "Media Literacy",
                bigIdea: "Every message has a purpose and point of view.",
                essentialQuestion: "Who created this and why?",
                standards: "2.A",
                activity: "Analyze the creator, purpose, audience, and point of view of a media message."
            },
            {
                title: "Digital Citizenship",
                bigIdea: "Our online choices matter.",
                essentialQuestion: "How do I stay safe and responsible online?",
                standards: "3.B–3.D",
                activity: "Practice safe, respectful, and responsible choices in realistic online scenarios."
            },
            {
                title: "Reading for Growth",
                bigIdea: "Readers choose books intentionally.",
                essentialQuestion: "What should I read next?",
                standards: "4.A–4.C",
                activity: "Use interests, goals, genres, authors, and formats to choose a next read."
            },
            {
                title: "Libraries Power Learning",
                bigIdea: "Libraries connect people with ideas.",
                essentialQuestion: "How can the library help me succeed?",
                standards: "4.C",
                activity: "Explore how print, digital, technology, and librarian support can help solve real needs."
            }
        ],

        monarch: [],

        spiral: createSpiralLessons()
    },

    "4": {
        label: "4th Grade",

        core: [
            {
                title: "Research Begins with a Purpose",
                bigIdea: "Good research starts with meaningful questions and a clear purpose.",
                essentialQuestion: "What am I trying to learn?",
                standards: "1.A, 1.B",
                activity: "Build a clear research purpose from a topic or information need."
            },
            {
                title: "Search Like a Researcher",
                bigIdea: "Different questions require different search strategies.",
                essentialQuestion: "Where should I search first?",
                standards: "1.B, 1.C, 3.A",
                activity: "Compare search strategies and choose the best starting place for different questions."
            },
            {
                title: "Keywords, Search Tools & Databases",
                bigIdea: "Better searches lead to better information.",
                essentialQuestion: "How can I improve my searches?",
                standards: "1.C, 3.A",
                activity: "Practice improving search terms and choosing appropriate search tools or databases."
            },
            {
                title: "Evaluating Sources",
                bigIdea: "Not every source is equally trustworthy.",
                essentialQuestion: "Can I trust this information?",
                standards: "2.A",
                activity: "Evaluate sources using age-appropriate reliability and relevance checks."
            },
            {
                title: "Giving Credit to Others",
                bigIdea: "Information belongs to creators.",
                essentialQuestion: "How do we use others' work ethically?",
                standards: "1.D, 3.A, 3.D",
                activity: "Practice identifying creators and giving credit for information, images, and ideas."
            },
            {
                title: "Organizing Research",
                bigIdea: "Good researchers stay organized.",
                essentialQuestion: "How do I keep track of information?",
                standards: "1.D, 2.B",
                activity: "Organize notes, sources, and evidence so research is easier to use."
            },
            {
                title: "Media Literacy",
                bigIdea: "Every message has a purpose and point of view.",
                essentialQuestion: "Who created this and why?",
                standards: "2.A",
                activity: "Analyze the creator, purpose, audience, and point of view of a media message."
            },
            {
                title: "Digital Citizenship",
                bigIdea: "Our online choices matter.",
                essentialQuestion: "How do I stay safe and responsible online?",
                standards: "3.B–3.D",
                activity: "Practice safe, respectful, and responsible choices in realistic online scenarios."
            },
            {
                title: "Reading for Growth",
                bigIdea: "Readers choose books intentionally.",
                essentialQuestion: "What should I read next?",
                standards: "4.A–4.C",
                activity: "Use interests, goals, genres, authors, and formats to choose a next read."
            },
            {
                title: "Libraries Power Learning",
                bigIdea: "Libraries connect people with ideas.",
                essentialQuestion: "How can the library help me succeed?",
                standards: "4.C",
                activity: "Explore how print, digital, technology, and librarian support can help solve real needs."
            }
        ],

        monarch: [],

        spiral: createSpiralLessons()
    },

    "5": {
        label: "5th Grade",

        core: [
            {
                title: "Research Begins with a Purpose",
                bigIdea: "Good research starts with meaningful questions and a clear purpose.",
                essentialQuestion: "What am I trying to learn?",
                standards: "1.A, 1.B",
                activity: "Build a clear research purpose from a topic or information need."
            },
            {
                title: "Search Like a Researcher",
                bigIdea: "Different questions require different search strategies.",
                essentialQuestion: "Where should I search first?",
                standards: "1.B, 1.C, 3.A",
                activity: "Compare search strategies and choose the best starting place for different questions."
            },
            {
                title: "Keywords, Search Tools & Databases",
                bigIdea: "Better searches lead to better information.",
                essentialQuestion: "How can I improve my searches?",
                standards: "1.C, 3.A",
                activity: "Practice improving search terms and choosing appropriate search tools or databases."
            },
            {
                title: "Evaluating Sources",
                bigIdea: "Not every source is equally trustworthy.",
                essentialQuestion: "Can I trust this information?",
                standards: "2.A",
                activity: "Evaluate sources using age-appropriate reliability and relevance checks."
            },
            {
                title: "Giving Credit to Others",
                bigIdea: "Information belongs to creators.",
                essentialQuestion: "How do we use others' work ethically?",
                standards: "1.D, 3.A, 3.D",
                activity: "Practice identifying creators and giving credit for information, images, and ideas."
            },
            {
                title: "Organizing Research",
                bigIdea: "Good researchers stay organized.",
                essentialQuestion: "How do I keep track of information?",
                standards: "1.D, 2.B",
                activity: "Organize notes, sources, and evidence so research is easier to use."
            },
            {
                title: "Media Literacy",
                bigIdea: "Every message has a purpose and point of view.",
                essentialQuestion: "Who created this and why?",
                standards: "2.A",
                activity: "Analyze the creator, purpose, audience, and point of view of a media message."
            },
            {
                title: "Digital Citizenship",
                bigIdea: "Our online choices matter.",
                essentialQuestion: "How do I stay safe and responsible online?",
                standards: "3.B–3.D",
                activity: "Practice safe, respectful, and responsible choices in realistic online scenarios."
            },
            {
                title: "Reading for Growth",
                bigIdea: "Readers choose books intentionally.",
                essentialQuestion: "What should I read next?",
                standards: "4.A–4.C",
                activity: "Use interests, goals, genres, authors, and formats to choose a next read."
            },
            {
                title: "Libraries Power Learning",
                bigIdea: "Libraries connect people with ideas.",
                essentialQuestion: "How can the library help me succeed?",
                standards: "4.C",
                activity: "Explore how print, digital, technology, and librarian support can help solve real needs."
            }
        ],

        monarch: [],

        spiral: createSpiralLessons()
    }
};

// =====================================================
// SHARED 3–5 SPIRAL LESSONS
// =====================================================

function createSpiralLessons() {
    return [
        {
            title: "Ask Better Questions",
            bigIdea: "Spiral practice: Research Purpose.",
            essentialQuestion: "",
            standards: "",
            activity: "Turn broad topics into research questions.",
            skills: "Research Purpose",
            week: 11
        },
        {
            title: "Search Challenge",
            bigIdea: "Spiral practice: Keywords • Databases.",
            essentialQuestion: "",
            standards: "",
            activity: "Compete to find information using different search tools.",
            skills: "Keywords • Databases",
            week: 12
        },
        {
            title: "Website Detective",
            bigIdea: "Spiral practice: Evaluating Sources.",
            essentialQuestion: "",
            standards: "",
            activity: "Compare reliable and unreliable websites.",
            skills: "Evaluating Sources",
            week: 13
        },
        {
            title: "Fact, Opinion & Point of View",
            bigIdea: "Spiral practice: Media Literacy.",
            essentialQuestion: "",
            standards: "",
            activity: "Analyze articles, advertisements, or videos.",
            skills: "Media Literacy",
            week: 14
        },
        {
            title: "Research Notes",
            bigIdea: "Spiral practice: Summarizing • Paraphrasing.",
            essentialQuestion: "",
            standards: "",
            activity: "Practice note-taking without copying.",
            skills: "Summarizing • Paraphrasing",
            week: 15
        },
        {
            title: "Copyright & Fair Use",
            bigIdea: "Spiral practice: Intellectual Property.",
            essentialQuestion: "",
            standards: "",
            activity: "Decide when and how to give credit.",
            skills: "Intellectual Property",
            week: 16
        },
        {
            title: "Create an Infographic",
            bigIdea: "Spiral practice: Organizing Information.",
            essentialQuestion: "",
            standards: "",
            activity: "Present research visually.",
            skills: "Organizing Information",
            week: 17
        },
        {
            title: "Media Creator Challenge",
            bigIdea: "Spiral practice: Audience & Purpose.",
            essentialQuestion: "",
            standards: "",
            activity: "Create a public service announcement, poster, or digital slide.",
            skills: "Audience & Purpose",
            week: 18
        },
        {
            title: "Online Safety Scenarios",
            bigIdea: "Spiral practice: Digital Citizenship.",
            essentialQuestion: "",
            standards: "",
            activity: "Solve real-world online situations.",
            skills: "Digital Citizenship",
            week: 19
        },
        {
            title: "Digital Footprint",
            bigIdea: "Spiral practice: Online Presence.",
            essentialQuestion: "",
            standards: "",
            activity: "Explore how online actions can have lasting effects.",
            skills: "Online Presence",
            week: 20
        },
        {
            title: "Book Tasting",
            bigIdea: "Spiral practice: Reading Identity.",
            essentialQuestion: "",
            standards: "",
            activity: "Explore new genres, authors, or formats.",
            skills: "Reading Identity",
            week: 21
        },
        {
            title: "Award-Winning Books",
            bigIdea: "Spiral practice: Literary Awards.",
            essentialQuestion: "",
            standards: "",
            activity: "Compare award criteria and recommend books.",
            skills: "Literary Awards",
            week: 22
        },
        {
            title: "Diverse Perspectives",
            bigIdea: "Spiral practice: Empathy.",
            essentialQuestion: "",
            standards: "",
            activity: "Compare multiple viewpoints in texts.",
            skills: "Empathy",
            week: 23
        },
        {
            title: "Library Resource Challenge",
            bigIdea: "Spiral practice: Using Library Resources.",
            essentialQuestion: "",
            standards: "",
            activity: "Locate print, digital, and database resources efficiently.",
            skills: "Using Library Resources",
            week: 24
        },
        {
            title: "Mini Research Investigation",
            bigIdea: "Spiral practice: Research Process.",
            essentialQuestion: "",
            standards: "",
            activity: "Complete a short inquiry from question to conclusion.",
            skills: "Research Process",
            week: 25
        },
        {
            title: "Collaborative Research",
            bigIdea: "Spiral practice: Teamwork.",
            essentialQuestion: "",
            standards: "",
            activity: "Work in groups to investigate a topic and share findings.",
            skills: "Teamwork",
            week: 26
        },
        {
            title: "Present Like a Pro",
            bigIdea: "Spiral practice: Communication.",
            essentialQuestion: "",
            standards: "",
            activity: "Deliver a short presentation using evidence.",
            skills: "Communication",
            week: 27
        },
        {
            title: "Reflect & Revise",
            bigIdea: "Spiral practice: Audience Feedback.",
            essentialQuestion: "",
            standards: "",
            activity: "Improve work based on peer feedback.",
            skills: "Audience Feedback",
            week: 28
        },
        {
            title: "Passion Project",
            bigIdea: "Spiral practice: Independent Inquiry.",
            essentialQuestion: "",
            standards: "",
            activity: "Research a self-selected topic using the full research process.",
            skills: "Independent Inquiry",
            week: 29
        },
        {
            title: "Library Showcase",
            bigIdea: "Spiral practice: Reflection.",
            essentialQuestion: "",
            standards: "",
            activity: "Share learning, celebrate growth, and reflect on progress.",
            skills: "Reflection",
            week: 30
        }
    ];
}

// =====================================================
// STATE
// =====================================================

let currentUser = null;
let currentGrade = null;
let currentLessonKey = null;

let stateCache = {};
let firestoreReady = false;
let saveTimer = null;

// =====================================================
// FIRESTORE PATH
// =====================================================

function lessonPlannerDoc() {
    return doc(
        db,
        "plannerDashboardUsers",
        PLANNER_PROFILE_ID,
        "lessonPlanning",
        "progress"
    );
}

// =====================================================
// OPTIONAL OLD UID PATH
// =====================================================

function legacyLessonPlannerDoc() {
    if (!currentUser) {
        return null;
    }

    return doc(
        db,
        "plannerDashboardUsers",
        currentUser.uid,
        "lessonPlanning",
        "progress"
    );
}

// =====================================================
// LOCAL CACHE
// =====================================================

function readLocalState() {
    try {
        return JSON.parse(
            localStorage.getItem(
                LOCAL_STORAGE_KEY
            )
        ) || {};
    } catch {
        return {};
    }
}

function writeLocalState(state) {
    try {
        localStorage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify(state)
        );
    } catch (error) {
        console.warn(
            "Lesson planner local cache failed:",
            error
        );
    }
}

// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href =
            "../../index.html";

        return;
    }

    const email =
        (user.email || "").toLowerCase();

    if (!ALLOWED_EMAILS.has(email)) {
        await signOut(auth);

        window.location.href =
            "../../index.html";

        return;
    }

    currentUser = user;

    console.log(
        "Lesson planner signed in as:",
        user.email
    );

    await loadPlannerData();

    const page =
        document.body.dataset.page;

    if (page === "home") {
        renderHome();
    }

    if (page === "grade") {
        renderGrade(
            document.body.dataset.grade
        );
    }
});

// =====================================================
// LOAD DATA
// =====================================================

async function loadPlannerData() {
    setSyncStatus(
        "☁️ Connecting…"
    );

    stateCache =
        readLocalState();

    try {
        let snapshot =
            await getDoc(
                lessonPlannerDoc()
            );

        // ---------------------------------------------
        // ONE-TIME LEGACY IMPORT
        // ---------------------------------------------

        if (!snapshot.exists()) {
            const legacyRef =
                legacyLessonPlannerDoc();

            if (legacyRef) {
                const legacy =
                    await getDoc(
                        legacyRef
                    );

                if (
                    legacy.exists() &&
                    legacy.data()?.grades
                ) {
                    stateCache =
                        legacy.data().grades;

                    await setDoc(
                        lessonPlannerDoc(),
                        {
                            grades:
                                stateCache,

                            migratedFrom:
                                `plannerDashboardUsers/${currentUser.uid}/lessonPlanning/progress`,

                            updatedAt:
                                serverTimestamp(),

                            updatedBy:
                                currentUser.email
                        },
                        {
                            merge: true
                        }
                    );

                    snapshot =
                        await getDoc(
                            lessonPlannerDoc()
                        );
                }
            }
        }

        // ---------------------------------------------
        // FIRESTORE DATA EXISTS
        // ---------------------------------------------

        if (
            snapshot.exists() &&
            snapshot.data()?.grades
        ) {
            stateCache =
                snapshot.data().grades;

            writeLocalState(
                stateCache
            );
        }

        // ---------------------------------------------
        // LOCAL DATA EXISTS BUT FIRESTORE DOES NOT
        // ---------------------------------------------

        else if (
            Object.keys(
                stateCache
            ).length > 0
        ) {
            await setDoc(
                lessonPlannerDoc(),
                {
                    grades:
                        stateCache,

                    updatedAt:
                        serverTimestamp(),

                    updatedBy:
                        currentUser.email
                },
                {
                    merge: true
                }
            );
        }

        firestoreReady = true;

        setSyncStatus(
            "☁️ Synced"
        );
    } catch (error) {
        console.error(
            "Lesson planner load failed:",
            error
        );

        setSyncStatus(
            "⚠️ Local cache"
        );
    }
}

// =====================================================
// SYNC STATUS
// =====================================================

function setSyncStatus(text) {
    document
        .querySelectorAll(
            "[data-sync-status]"
        )
        .forEach(element => {
            element.textContent =
                text;
        });
}

// =====================================================
// STATE HELPERS
// =====================================================

function readState() {
    return stateCache;
}

function writeState(state) {
    stateCache = state;

    writeLocalState(
        stateCache
    );

    scheduleFirestoreSave();
}

// =====================================================
// FIRESTORE SAVE
// =====================================================

function scheduleFirestoreSave() {
    if (!firestoreReady) {
        return;
    }

    clearTimeout(
        saveTimer
    );

    setSyncStatus(
        "☁️ Saving…"
    );

    saveTimer =
        setTimeout(
            saveStateToFirestore,
            400
        );
}

async function saveStateToFirestore() {
    try {
        await setDoc(
            lessonPlannerDoc(),
            {
                grades:
                    stateCache,

                updatedAt:
                    serverTimestamp(),

                updatedBy:
                    currentUser?.email || ""
            },
            {
                merge: true
            }
        );

        setSyncStatus(
            "☁️ Synced"
        );

        console.log(
            "Lesson planner saved."
        );
    } catch (error) {
        console.error(
            "Lesson planner save failed:",
            error
        );

        setSyncStatus(
            "⚠️ Save failed"
        );
    }
}

// =====================================================
// LESSON HELPERS
// =====================================================

function lessonKey(type, index) {
    return `${type}-${index}`;
}

function defaultLesson(title) {
    return {
        title,
        planned: false,
        slides: false,
        supplies: false,
        website: false,
        standard: "",
        targetWeek: "",
        notes: "",
        materials: "",
        links: "",
        classes: {}
    };
}

function getLesson(
    state,
    grade,
    type,
    index,
    defaultTitle
) {
    state[grade] ??= {};

    const key =
        lessonKey(
            type,
            index
        );

    state[grade][key] ??=
        defaultLesson(
            defaultTitle
        );

    return ensureClasses(
        state[grade][key],
        grade
    );
}

function ensureClasses(
    lesson,
    grade
) {
    const count =
        CLASS_COUNTS[grade];

    lesson.classes ??= {};

    const next = {};

    for (
        let i = 1;
        i <= count;
        i++
    ) {
        const key =
            String(i);

        next[key] =
            !!lesson.classes[key];
    }

    lesson.classes =
        next;

    return lesson;
}

// =====================================================
// STATS
// =====================================================

function prepCount(lesson) {
    return [
        "planned",
        "slides",
        "supplies",
        "website"
    ].filter(
        key =>
            lesson[key]
    ).length;
}

function classCount(lesson) {
    return Object
        .values(
            lesson.classes || {}
        )
        .filter(Boolean)
        .length;
}

function statsForGrade(grade) {
    const state =
        readState();

    const gradeCurriculum =
        CURRICULUM[grade];

    let prepDone = 0;
    let prepPossible = 0;
    let taught = 0;
    let lessons = 0;

    const sections = [
        [
            "core",
            gradeCurriculum.core
        ],
        [
            "monarch",
            gradeCurriculum.monarch
        ],
        [
            "spiral",
            gradeCurriculum.spiral || []
        ]
    ];

    sections.forEach(
        ([type, list]) => {
            list.forEach(
                (item, index) => {
                    const lesson =
                        getLesson(
                            state,
                            grade,
                            type,
                            index,
                            item.title || item
                        );

                    prepDone +=
                        prepCount(
                            lesson
                        );

                    prepPossible += 4;

                    if (
                        classCount(
                            lesson
                        ) ===
                        CLASS_COUNTS[
                            grade
                        ]
                    ) {
                        taught += 1;
                    }

                    lessons += 1;
                }
            );
        }
    );

    writeLocalState(
        state
    );

    return {
        prepPercent:
            prepPossible
                ? Math.round(
                    prepDone /
                    prepPossible *
                    100
                )
                : 0,

        taught,
        lessons
    };
}

// =====================================================
// HOME PAGE
// =====================================================

function renderHome() {
    const grid =
        document.getElementById(
            "gradeGrid"
        );

    if (!grid) {
        return;
    }

    let combinedPrep = 0;
    let combinedLessons = 0;
    let totalTaught = 0;

    grid.innerHTML =
        Object.keys(
            CURRICULUM
        )
        .map(grade => {
            const gradeData =
                CURRICULUM[grade];

            const stats =
                statsForGrade(
                    grade
                );

            combinedPrep +=
                stats.prepPercent *
                stats.lessons;

            combinedLessons +=
                stats.lessons;

            totalTaught +=
                stats.taught;

            const curriculumText =
                gradeData.monarch.length
                    ? `${gradeData.core.length} Core + ${gradeData.monarch.length} Monarch`
                    : `${gradeData.core.length} Core + ${gradeData.spiral.length} Spiral Practice`;

            return `
                <a
                    class="grade-card"
                    href="./${PAGE_MAP[grade]}"
                >
                    <div class="grade-icon">
                        ${GRADE_ICONS[grade]}
                    </div>

                    <h3>
                        ${gradeData.label}
                    </h3>

                    <div class="grade-meta">
                        ${curriculumText}
                    </div>

                    <div class="progress-track small">
                        <div
                            class="progress-bar"
                            style="width:${stats.prepPercent}%"
                        ></div>
                    </div>

                    <div class="grade-progress">
                        <span>
                            ${stats.prepPercent}% prep ready
                        </span>

                        <span>
                            ${stats.taught}/${stats.lessons} taught
                        </span>
                    </div>
                </a>
            `;
        })
        .join("");

    const overall =
        combinedLessons
            ? Math.round(
                combinedPrep /
                combinedLessons
            )
            : 0;

    document.getElementById(
        "overallPercent"
    ).textContent =
        `${overall}%`;

    document.getElementById(
        "overallBar"
    ).style.width =
        `${overall}%`;

    document.getElementById(
        "overallDetail"
    ).textContent =
        `${totalTaught} lessons fully taught across all grade levels.`;
}

// =====================================================
// GRADE PAGE
// =====================================================

function renderGrade(grade) {
    currentGrade =
        grade;

    const gradeData =
        CURRICULUM[grade];

    if (
        !gradeData ||
        !document.getElementById(
            "coreLessons"
        )
    ) {
        return;
    }

    // CORE
    document.getElementById(
        "coreCount"
    ).textContent =
        `${gradeData.core.length} lessons`;

    document.getElementById(
        "coreLessons"
    ).innerHTML =
        gradeData.core
            .map(
                (item, index) =>
                    lessonCard(
                        grade,
                        "core",
                        index,
                        item
                    )
            )
            .join("");

    // MONARCH
    const monarchSection =
        document.getElementById(
            "monarchSection"
        );

    if (
        gradeData.monarch.length
    ) {
        monarchSection.hidden =
            false;

        document.getElementById(
            "monarchCount"
        ).textContent =
            `${gradeData.monarch.length} lessons`;

        document.getElementById(
            "monarchLessons"
        ).innerHTML =
            gradeData.monarch
                .map(
                    (item, index) =>
                        lessonCard(
                            grade,
                            "monarch",
                            index,
                            item
                        )
                )
                .join("");
    } else {
        monarchSection.hidden =
            true;
    }

    // SPIRAL
    const spiralSection =
        document.getElementById(
            "spiralSection"
        );

    if (
        gradeData.spiral.length
    ) {
        spiralSection.hidden =
            false;

        document.getElementById(
            "spiralCount"
        ).textContent =
            `${gradeData.spiral.length} lessons`;

        document.getElementById(
            "spiralLessons"
        ).innerHTML =
            gradeData.spiral
                .map(
                    (item, index) =>
                        lessonCard(
                            grade,
                            "spiral",
                            index,
                            item
                        )
                )
                .join("");
    } else {
        spiralSection.hidden =
            true;
    }

    bindLessonCards();
    bindGradeButtons();
    refreshSummary();
}

// =====================================================
// LESSON CARD
// =====================================================

function lessonCard(
    grade,
    type,
    index,
    item
) {
    const defaultTitle =
        item.title || item;

    const state =
        readState();

    const lesson =
        getLesson(
            state,
            grade,
            type,
            index,
            defaultTitle
        );

    const checks = [
        [
            "planned",
            "Plan"
        ],
        [
            "slides",
            "Slides"
        ],
        [
            "supplies",
            "Supplies"
        ],
        [
            "website",
            "Website"
        ]
    ];

    const label =
        type === "core"
            ? "CORE"
            : type === "monarch"
                ? "MONARCH"
                : "SPIRAL";

    const number =
        type === "spiral"
            ? (
                item.week ||
                index + 11
            )
            : index + 1;

    const meta =
        type === "spiral"
            ? [
                item.skills,
                item.activity
            ]
            .filter(Boolean)
            .join(" • ")
            : (
                item.essentialQuestion
                    ? `Essential Question: ${item.essentialQuestion}`
                    : ""
            );

    return `
        <article class="lesson-card">

            <div
                class="lesson-main"
                data-open="${type}-${index}"
                role="button"
                tabindex="0"
            >
                <div class="lesson-number">
                    ${label} ${number}
                </div>

                <div class="lesson-title">
                    ${escapeHtml(lesson.title)}
                </div>

                ${
                    meta
                        ? `
                            <div class="lesson-meta">
                                ${escapeHtml(meta)}
                            </div>
                        `
                        : ""
                }
            </div>

            ${checks.map(
                ([key, text]) => `
                    <div class="status-cell">
                        <span>
                            ${text}
                        </span>

                        <div
                            class="status-dot ${lesson[key] ? "done" : ""}"
                        >
                            ${lesson[key] ? "✓" : "○"}
                        </div>
                    </div>
                `
            ).join("")}

            <div class="class-status">
                ${classCount(lesson)}
                /
                ${CLASS_COUNTS[grade]}
                classes
            </div>

        </article>
    `;
}

// =====================================================
// BIND LESSON CARDS
// =====================================================

function bindLessonCards() {
    document
        .querySelectorAll(
            "[data-open]"
        )
        .forEach(element => {
            element.addEventListener(
                "click",
                () => {
                    openLesson(
                        element.dataset.open
                    );
                }
            );

            element.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();

                        openLesson(
                            element.dataset.open
                        );
                    }
                }
            );
        });
}

// =====================================================
// GRADE PAGE BUTTONS
// =====================================================

function bindGradeButtons() {
    document.getElementById(
        "saveLesson"
    )?.addEventListener(
        "click",
        saveCurrentLesson
    );

    document.getElementById(
        "resetLesson"
    )?.addEventListener(
        "click",
        resetCurrentLesson
    );

    document.getElementById(
        "closeLessonDialog"
    )?.addEventListener(
        "click",
        () => {
            document.getElementById(
                "lessonDialog"
            )?.close();
        }
    );

    document.getElementById(
        "lessonDialog"
    )?.addEventListener(
        "click",
        event => {
            if (
                event.target.id ===
                "lessonDialog"
            ) {
                event.target.close();
            }
        }
    );
}

// =====================================================
// OPEN LESSON
// =====================================================

function openLesson(key) {
    currentLessonKey =
        key;

    const [
        type,
        indexString
    ] =
        key.split("-");

    const index =
        Number(
            indexString
        );

    const item =
        CURRICULUM[
            currentGrade
        ][type][index];

    const defaultTitle =
        item.title || item;

    const state =
        readState();

    const lesson =
        getLesson(
            state,
            currentGrade,
            type,
            index,
            defaultTitle
        );

    // ---------------------------------------------
    // ADD CURRICULUM DEFAULTS THE FIRST TIME
    // ---------------------------------------------

    if (
        !lesson.standard &&
        item.standards
    ) {
        lesson.standard =
            item.standards;
    }

    if (
        !lesson.targetWeek &&
        item.week
    ) {
        lesson.targetWeek =
            `Week ${item.week}`;
    }

    if (
        !lesson.notes &&
        (
            item.bigIdea ||
            item.essentialQuestion ||
            item.skills ||
            item.activity
        )
    ) {
        lesson.notes =
            [
                item.bigIdea
                    ? `Big Idea: ${item.bigIdea}`
                    : "",

                item.essentialQuestion
                    ? `Essential Question: ${item.essentialQuestion}`
                    : "",

                item.skills
                    ? `Core Skills Reinforced: ${item.skills}`
                    : "",

                item.activity
                    ? `Possible Activity: ${item.activity}`
                    : ""
            ]
            .filter(Boolean)
            .join("\n\n");

        writeState(
            state
        );
    }

    // ---------------------------------------------
    // DIALOG HEADER
    // ---------------------------------------------

    const typeLabel =
        type === "core"
            ? "CORE LESSON"
            : type === "monarch"
                ? "MONARCH LESSON"
                : "SPIRAL PRACTICE";

    const displayNumber =
        type === "spiral"
            ? (
                item.week ||
                index + 11
            )
            : index + 1;

    document.getElementById(
        "dialogType"
    ).textContent =
        `${typeLabel} ${displayNumber}`;

    document.getElementById(
        "dialogTitle"
    ).textContent =
        lesson.title;

    // ---------------------------------------------
    // FIELDS
    // ---------------------------------------------

    document.getElementById(
        "lessonTitleInput"
    ).value =
        lesson.title;

    [
        "planned",
        "slides",
        "supplies",
        "website"
    ].forEach(key => {
        document.getElementById(
            key
        ).checked =
            !!lesson[key];
    });

    document.getElementById(
        "standard"
    ).value =
        lesson.standard || "";

    document.getElementById(
        "targetWeek"
    ).value =
        lesson.targetWeek || "";

    document.getElementById(
        "notes"
    ).value =
        lesson.notes || "";

    document.getElementById(
        "materials"
    ).value =
        lesson.materials || "";

    document.getElementById(
        "links"
    ).value =
        lesson.links || "";

    // ---------------------------------------------
    // CLASS CHECKBOXES
    // ---------------------------------------------

    const classChecks =
        document.getElementById(
            "classChecks"
        );

    classChecks.innerHTML =
        Array.from(
            {
                length:
                    CLASS_COUNTS[
                        currentGrade
                    ]
            },
            (_, index) => {
                const key =
                    String(
                        index + 1
                    );

                return `
                    <label>
                        <input
                            type="checkbox"
                            data-class="${key}"
                            ${lesson.classes?.[key] ? "checked" : ""}
                        >

                        Class ${key}
                    </label>
                `;
            }
        )
        .join("");

    document.getElementById(
        "lessonDialog"
    ).showModal();
}

// =====================================================
// SAVE LESSON
// =====================================================

function saveCurrentLesson() {
    if (!currentLessonKey) {
        return;
    }

    const [
        type,
        indexString
    ] =
        currentLessonKey.split("-");

    const index =
        Number(
            indexString
        );

    const item =
        CURRICULUM[
            currentGrade
        ][type][index];

    const defaultTitle =
        item.title || item;

    const state =
        readState();

    const lesson =
        getLesson(
            state,
            currentGrade,
            type,
            index,
            defaultTitle
        );

    lesson.title =
        document.getElementById(
            "lessonTitleInput"
        ).value.trim() ||
        defaultTitle;

    [
        "planned",
        "slides",
        "supplies",
        "website"
    ].forEach(key => {
        lesson[key] =
            document.getElementById(
                key
            ).checked;
    });

    lesson.standard =
        document.getElementById(
            "standard"
        ).value.trim();

    lesson.targetWeek =
        document.getElementById(
            "targetWeek"
        ).value.trim();

    lesson.notes =
        document.getElementById(
            "notes"
        ).value;

    lesson.materials =
        document.getElementById(
            "materials"
        ).value;

    lesson.links =
        document.getElementById(
            "links"
        ).value;

    lesson.classes = {};

    document
        .querySelectorAll(
            "[data-class]"
        )
        .forEach(checkbox => {
            lesson.classes[
                checkbox.dataset.class
            ] =
                checkbox.checked;
        });

    writeState(
        state
    );

    document.getElementById(
        "lessonDialog"
    ).close();

    rerenderGrade();
}

// =====================================================
// RESET LESSON
// =====================================================

function resetCurrentLesson() {
    if (!currentLessonKey) {
        return;
    }

    const confirmed =
        window.confirm(
            "Reset this lesson? This will clear its prep status, notes, links, and class progress."
        );

    if (!confirmed) {
        return;
    }

    const [
        type,
        indexString
    ] =
        currentLessonKey.split("-");

    const index =
        Number(
            indexString
        );

    const item =
        CURRICULUM[
            currentGrade
        ][type][index];

    const defaultTitle =
        item.title || item;

    const state =
        readState();

    state[currentGrade] ??= {};

    state[currentGrade][
        currentLessonKey
    ] =
        defaultLesson(
            defaultTitle
        );

    writeState(
        state
    );

    document.getElementById(
        "lessonDialog"
    ).close();

    rerenderGrade();
}

// =====================================================
// RERENDER GRADE
// =====================================================

function rerenderGrade() {
    const gradeData =
        CURRICULUM[
            currentGrade
        ];

    document.getElementById(
        "coreLessons"
    ).innerHTML =
        gradeData.core
            .map(
                (item, index) =>
                    lessonCard(
                        currentGrade,
                        "core",
                        index,
                        item
                    )
            )
            .join("");

    if (
        gradeData.monarch.length
    ) {
        document.getElementById(
            "monarchLessons"
        ).innerHTML =
            gradeData.monarch
                .map(
                    (item, index) =>
                        lessonCard(
                            currentGrade,
                            "monarch",
                            index,
                            item
                        )
                )
                .join("");
    }

    if (
        gradeData.spiral.length
    ) {
        document.getElementById(
            "spiralLessons"
        ).innerHTML =
            gradeData.spiral
                .map(
                    (item, index) =>
                        lessonCard(
                            currentGrade,
                            "spiral",
                            index,
                            item
                        )
                )
                .join("");
    }

    bindLessonCards();

    refreshSummary();
}

// =====================================================
// GRADE SUMMARY
// =====================================================

function refreshSummary() {
    const stats =
        statsForGrade(
            currentGrade
        );

    document.getElementById(
        "prepPercent"
    ).textContent =
        `${stats.prepPercent}%`;

    document.getElementById(
        "prepBar"
    ).style.width =
        `${stats.prepPercent}%`;

    document.getElementById(
        "taughtCount"
    ).textContent =
        `${stats.taught} / ${stats.lessons}`;

    const taughtPercent =
        stats.lessons
            ? Math.round(
                stats.taught /
                stats.lessons *
                100
            )
            : 0;

    document.getElementById(
        "taughtBar"
    ).style.width =
        `${taughtPercent}%`;
}

// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value = "") {
    return String(value)
        .replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]
        );
}