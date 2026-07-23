# LRC Lesson Planning Module — Firestore Version

Place the whole `lessonPlanning` folder inside:

`LRCGames/plannerDashboard/`

Open:

`LRCGames/plannerDashboard/lessonPlanning/index.html`

## Firestore sync

This version saves the lesson planner to one shared Firestore document:

`plannerDashboard / lessonPlanning`

Both approved accounts use the SAME planner data:
- malbrecht@sd308.org
- malbrecht3317@gmail.com

That means progress can follow you between your school account, Gmail account,
computer, iPad, and phone.

## One setup step

Open `firebaseConfig.js` and paste the Firebase Web App config from the SAME
Firebase project used by LRC Quest.

Do NOT put your service-account JSON/private key into browser code.

## Firestore Rules

Use the rule snippet in:

`firestore-rules-snippet.txt`

Merge it inside your existing Firestore `match /databases/{database}/documents`
block. It restricts this planner document to your two approved authenticated
email addresses.

## Offline/local fallback

The planner still writes to localStorage immediately.

If Firestore cannot connect, the planner continues working locally and shows:
`⚠️ Local only`

When Firestore is active it shows:
`☁️ Synced`

## Included

- 1st: 10 Core + 20 Monarch, 3 classes
- 2nd: 10 Core + 20 Monarch, 3 classes
- 3rd: 10 Core, 3 classes
- 4th: 10 Core, 4 classes
- 5th: 10 Core, 3 classes
- Lesson Planned check
- Slides Ready check
- Supplies Ready check
- Website Ready check
- Editable title, standard, target week, notes, materials, links
- Per-class completion
- Automatic prep and fully-taught progress
- Shared Firestore persistence


## Grades 3–5 curriculum structure

Grades 3, 4, and 5 now use:

- 10 Core Lessons (Weeks 1–10)
- 20 Spiral Practice Lessons (Weeks 11–30)

The spiral lessons center on authentic library work:
research questions, search challenges, source evaluation, media literacy,
digital citizenship, book discovery, mini research, collaboration,
presentations, passion projects, and a library showcase.

Each 3–5 lesson opens with its curriculum context prefilled in Lesson Notes,
including the Big Idea, Essential Question and/or Core Skills Reinforced,
plus a Possible Activity.
