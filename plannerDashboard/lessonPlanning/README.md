# LRC Lesson Planning Module

Place this whole `lessonPlanning` folder inside:

`LRCGames/plannerDashboard/`

Then open:

`LRCGames/plannerDashboard/lessonPlanning/index.html`

## Included
- Grade-level landing page
- Separate pages for grades 1–5
- 1st & 2nd: 10 Core + 20 Monarch lessons
- Prep completion checks:
  - Lesson Planned
  - Slides Ready
  - Supplies Ready
  - Website Ready
- Editable lesson title
- Standard
- Target week
- Lesson notes
- Supplies/materials notes
- Links/resources
- A–E class completion tracking
- Automatic prep percentage
- Automatic fully-taught count
- Local browser persistence via localStorage

## Important
This version intentionally stores data in localStorage so it works immediately
without requiring changes to your existing Firebase setup.

The next integration step can replace the storage read/write functions in
`lessonPlanning.js` with your LRC Quest Firestore path so progress syncs across
your iPad, iPhone, and computer.
