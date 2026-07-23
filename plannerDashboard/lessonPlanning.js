
const LessonPlanner = (() => {
  const curriculum = {"1": {"label": "1st Grade", "core": [{"title": "LRC Orientation"}, {"title": "Book Care & Checkout Routines"}, {"title": "Research Starts With a Question"}, {"title": "Finding Information"}, {"title": "Keywords"}, {"title": "Choosing a Resource"}, {"title": "Author / Illustrator / Creator"}, {"title": "Basic Citation"}, {"title": "Using Simple Quotes"}, {"title": "Research Celebration & Review"}], "monarch": [{"title": "Monarch Lesson 1"}, {"title": "Monarch Lesson 2"}, {"title": "Monarch Lesson 3"}, {"title": "Monarch Lesson 4"}, {"title": "Monarch Lesson 5"}, {"title": "Monarch Lesson 6"}, {"title": "Monarch Lesson 7"}, {"title": "Monarch Lesson 8"}, {"title": "Monarch Lesson 9"}, {"title": "Monarch Lesson 10"}, {"title": "Monarch Lesson 11"}, {"title": "Monarch Lesson 12"}, {"title": "Monarch Lesson 13"}, {"title": "Monarch Lesson 14"}, {"title": "Monarch Lesson 15"}, {"title": "Monarch Lesson 16"}, {"title": "Monarch Lesson 17"}, {"title": "Monarch Lesson 18"}, {"title": "Monarch Lesson 19"}, {"title": "Monarch Lesson 20"}], "spiral": []}, "2": {"label": "2nd Grade", "core": [{"title": "LRC Orientation"}, {"title": "Book Care & Checkout Routines"}, {"title": "Research Starts With a Question"}, {"title": "Finding Information"}, {"title": "Keywords"}, {"title": "Choosing a Resource"}, {"title": "Author / Illustrator / Creator"}, {"title": "Basic Citation"}, {"title": "Using Simple Quotes"}, {"title": "Research Celebration & Review"}], "monarch": [{"title": "Monarch Lesson 1"}, {"title": "Monarch Lesson 2"}, {"title": "Monarch Lesson 3"}, {"title": "Monarch Lesson 4"}, {"title": "Monarch Lesson 5"}, {"title": "Monarch Lesson 6"}, {"title": "Monarch Lesson 7"}, {"title": "Monarch Lesson 8"}, {"title": "Monarch Lesson 9"}, {"title": "Monarch Lesson 10"}, {"title": "Monarch Lesson 11"}, {"title": "Monarch Lesson 12"}, {"title": "Monarch Lesson 13"}, {"title": "Monarch Lesson 14"}, {"title": "Monarch Lesson 15"}, {"title": "Monarch Lesson 16"}, {"title": "Monarch Lesson 17"}, {"title": "Monarch Lesson 18"}, {"title": "Monarch Lesson 19"}, {"title": "Monarch Lesson 20"}], "spiral": []}, "3": {"label": "3rd Grade", "core": [{"title": "Research Begins with a Purpose", "bigIdea": "Good research starts with meaningful questions and a clear purpose.", "essentialQuestion": "What am I trying to learn?", "standards": "1.A, 1.B", "activity": "Build a clear research purpose from a topic or information need."}, {"title": "Search Like a Researcher", "bigIdea": "Different questions require different search strategies.", "essentialQuestion": "Where should I search first?", "standards": "1.B, 1.C, 3.A", "activity": "Compare search strategies and choose the best starting place for different questions."}, {"title": "Keywords, Search Tools & Databases", "bigIdea": "Better searches lead to better information.", "essentialQuestion": "How can I improve my searches?", "standards": "1.C, 3.A", "activity": "Practice improving search terms and choosing appropriate search tools or databases."}, {"title": "Evaluating Sources", "bigIdea": "Not every source is equally trustworthy.", "essentialQuestion": "Can I trust this information?", "standards": "2.A", "activity": "Evaluate sources using age-appropriate reliability and relevance checks."}, {"title": "Giving Credit to Others", "bigIdea": "Information belongs to creators.", "essentialQuestion": "How do we use others' work ethically?", "standards": "1.D, 3.A, 3.D", "activity": "Practice identifying creators and giving credit for information, images, and ideas."}, {"title": "Organizing Research", "bigIdea": "Good researchers stay organized.", "essentialQuestion": "How do I keep track of information?", "standards": "1.D, 2.B", "activity": "Organize notes, sources, and evidence so research is easier to use."}, {"title": "Media Literacy", "bigIdea": "Every message has a purpose and point of view.", "essentialQuestion": "Who created this and why?", "standards": "2.A", "activity": "Analyze the creator, purpose, audience, and point of view of a media message."}, {"title": "Digital Citizenship", "bigIdea": "Our online choices matter.", "essentialQuestion": "How do I stay safe and responsible online?", "standards": "3.B–3.D", "activity": "Practice safe, respectful, and responsible choices in realistic online scenarios."}, {"title": "Reading for Growth", "bigIdea": "Readers choose books intentionally.", "essentialQuestion": "What should I read next?", "standards": "4.A–4.C", "activity": "Use interests, goals, genres, authors, and formats to choose a next read."}, {"title": "Libraries Power Learning", "bigIdea": "Libraries connect people with ideas.", "essentialQuestion": "How can the library help me succeed?", "standards": "4.C", "activity": "Explore how print, digital, technology, and librarian support can help solve real needs."}], "monarch": [], "spiral": [{"title": "Ask Better Questions", "bigIdea": "Spiral practice: Research Purpose.", "essentialQuestion": "", "standards": "", "activity": "Turn broad topics into research questions.", "skills": "Research Purpose", "week": 11}, {"title": "Search Challenge", "bigIdea": "Spiral practice: Keywords • Databases.", "essentialQuestion": "", "standards": "", "activity": "Compete to find information using different search tools.", "skills": "Keywords • Databases", "week": 12}, {"title": "Website Detective", "bigIdea": "Spiral practice: Evaluating Sources.", "essentialQuestion": "", "standards": "", "activity": "Compare reliable and unreliable websites.", "skills": "Evaluating Sources", "week": 13}, {"title": "Fact, Opinion & Point of View", "bigIdea": "Spiral practice: Media Literacy.", "essentialQuestion": "", "standards": "", "activity": "Analyze articles, advertisements, or videos.", "skills": "Media Literacy", "week": 14}, {"title": "Research Notes", "bigIdea": "Spiral practice: Summarizing • Paraphrasing.", "essentialQuestion": "", "standards": "", "activity": "Practice note-taking without copying.", "skills": "Summarizing • Paraphrasing", "week": 15}, {"title": "Copyright & Fair Use", "bigIdea": "Spiral practice: Intellectual Property.", "essentialQuestion": "", "standards": "", "activity": "Decide when and how to give credit.", "skills": "Intellectual Property", "week": 16}, {"title": "Create an Infographic", "bigIdea": "Spiral practice: Organizing Information.", "essentialQuestion": "", "standards": "", "activity": "Present research visually.", "skills": "Organizing Information", "week": 17}, {"title": "Media Creator Challenge", "bigIdea": "Spiral practice: Audience & Purpose.", "essentialQuestion": "", "standards": "", "activity": "Create a public service announcement, poster, or digital slide.", "skills": "Audience & Purpose", "week": 18}, {"title": "Online Safety Scenarios", "bigIdea": "Spiral practice: Digital Citizenship.", "essentialQuestion": "", "standards": "", "activity": "Solve real-world online situations.", "skills": "Digital Citizenship", "week": 19}, {"title": "Digital Footprint", "bigIdea": "Spiral practice: Online Presence.", "essentialQuestion": "", "standards": "", "activity": "Explore how online actions can have lasting effects.", "skills": "Online Presence", "week": 20}, {"title": "Book Tasting", "bigIdea": "Spiral practice: Reading Identity.", "essentialQuestion": "", "standards": "", "activity": "Explore new genres, authors, or formats.", "skills": "Reading Identity", "week": 21}, {"title": "Award-Winning Books", "bigIdea": "Spiral practice: Literary Awards.", "essentialQuestion": "", "standards": "", "activity": "Compare award criteria and recommend books.", "skills": "Literary Awards", "week": 22}, {"title": "Diverse Perspectives", "bigIdea": "Spiral practice: Empathy.", "essentialQuestion": "", "standards": "", "activity": "Compare multiple viewpoints in texts.", "skills": "Empathy", "week": 23}, {"title": "Library Resource Challenge", "bigIdea": "Spiral practice: Using Library Resources.", "essentialQuestion": "", "standards": "", "activity": "Locate print, digital, and database resources efficiently.", "skills": "Using Library Resources", "week": 24}, {"title": "Mini Research Investigation", "bigIdea": "Spiral practice: Research Process.", "essentialQuestion": "", "standards": "", "activity": "Complete a short inquiry from question to conclusion.", "skills": "Research Process", "week": 25}, {"title": "Collaborative Research", "bigIdea": "Spiral practice: Teamwork.", "essentialQuestion": "", "standards": "", "activity": "Work in groups to investigate a topic and share findings.", "skills": "Teamwork", "week": 26}, {"title": "Present Like a Pro", "bigIdea": "Spiral practice: Communication.", "essentialQuestion": "", "standards": "", "activity": "Deliver a short presentation using evidence.", "skills": "Communication", "week": 27}, {"title": "Reflect & Revise", "bigIdea": "Spiral practice: Audience Feedback.", "essentialQuestion": "", "standards": "", "activity": "Improve work based on peer feedback.", "skills": "Audience Feedback", "week": 28}, {"title": "Passion Project", "bigIdea": "Spiral practice: Independent Inquiry.", "essentialQuestion": "", "standards": "", "activity": "Research a self-selected topic using the full research process.", "skills": "Independent Inquiry", "week": 29}, {"title": "Library Showcase", "bigIdea": "Spiral practice: Reflection.", "essentialQuestion": "", "standards": "", "activity": "Share learning, celebrate growth, and reflect on progress.", "skills": "Reflection", "week": 30}]}, "4": {"label": "4th Grade", "core": [{"title": "Research Begins with a Purpose", "bigIdea": "Good research starts with meaningful questions and a clear purpose.", "essentialQuestion": "What am I trying to learn?", "standards": "1.A, 1.B", "activity": "Build a clear research purpose from a topic or information need."}, {"title": "Search Like a Researcher", "bigIdea": "Different questions require different search strategies.", "essentialQuestion": "Where should I search first?", "standards": "1.B, 1.C, 3.A", "activity": "Compare search strategies and choose the best starting place for different questions."}, {"title": "Keywords, Search Tools & Databases", "bigIdea": "Better searches lead to better information.", "essentialQuestion": "How can I improve my searches?", "standards": "1.C, 3.A", "activity": "Practice improving search terms and choosing appropriate search tools or databases."}, {"title": "Evaluating Sources", "bigIdea": "Not every source is equally trustworthy.", "essentialQuestion": "Can I trust this information?", "standards": "2.A", "activity": "Evaluate sources using age-appropriate reliability and relevance checks."}, {"title": "Giving Credit to Others", "bigIdea": "Information belongs to creators.", "essentialQuestion": "How do we use others' work ethically?", "standards": "1.D, 3.A, 3.D", "activity": "Practice identifying creators and giving credit for information, images, and ideas."}, {"title": "Organizing Research", "bigIdea": "Good researchers stay organized.", "essentialQuestion": "How do I keep track of information?", "standards": "1.D, 2.B", "activity": "Organize notes, sources, and evidence so research is easier to use."}, {"title": "Media Literacy", "bigIdea": "Every message has a purpose and point of view.", "essentialQuestion": "Who created this and why?", "standards": "2.A", "activity": "Analyze the creator, purpose, audience, and point of view of a media message."}, {"title": "Digital Citizenship", "bigIdea": "Our online choices matter.", "essentialQuestion": "How do I stay safe and responsible online?", "standards": "3.B–3.D", "activity": "Practice safe, respectful, and responsible choices in realistic online scenarios."}, {"title": "Reading for Growth", "bigIdea": "Readers choose books intentionally.", "essentialQuestion": "What should I read next?", "standards": "4.A–4.C", "activity": "Use interests, goals, genres, authors, and formats to choose a next read."}, {"title": "Libraries Power Learning", "bigIdea": "Libraries connect people with ideas.", "essentialQuestion": "How can the library help me succeed?", "standards": "4.C", "activity": "Explore how print, digital, technology, and librarian support can help solve real needs."}], "monarch": [], "spiral": [{"title": "Ask Better Questions", "bigIdea": "Spiral practice: Research Purpose.", "essentialQuestion": "", "standards": "", "activity": "Turn broad topics into research questions.", "skills": "Research Purpose", "week": 11}, {"title": "Search Challenge", "bigIdea": "Spiral practice: Keywords • Databases.", "essentialQuestion": "", "standards": "", "activity": "Compete to find information using different search tools.", "skills": "Keywords • Databases", "week": 12}, {"title": "Website Detective", "bigIdea": "Spiral practice: Evaluating Sources.", "essentialQuestion": "", "standards": "", "activity": "Compare reliable and unreliable websites.", "skills": "Evaluating Sources", "week": 13}, {"title": "Fact, Opinion & Point of View", "bigIdea": "Spiral practice: Media Literacy.", "essentialQuestion": "", "standards": "", "activity": "Analyze articles, advertisements, or videos.", "skills": "Media Literacy", "week": 14}, {"title": "Research Notes", "bigIdea": "Spiral practice: Summarizing • Paraphrasing.", "essentialQuestion": "", "standards": "", "activity": "Practice note-taking without copying.", "skills": "Summarizing • Paraphrasing", "week": 15}, {"title": "Copyright & Fair Use", "bigIdea": "Spiral practice: Intellectual Property.", "essentialQuestion": "", "standards": "", "activity": "Decide when and how to give credit.", "skills": "Intellectual Property", "week": 16}, {"title": "Create an Infographic", "bigIdea": "Spiral practice: Organizing Information.", "essentialQuestion": "", "standards": "", "activity": "Present research visually.", "skills": "Organizing Information", "week": 17}, {"title": "Media Creator Challenge", "bigIdea": "Spiral practice: Audience & Purpose.", "essentialQuestion": "", "standards": "", "activity": "Create a public service announcement, poster, or digital slide.", "skills": "Audience & Purpose", "week": 18}, {"title": "Online Safety Scenarios", "bigIdea": "Spiral practice: Digital Citizenship.", "essentialQuestion": "", "standards": "", "activity": "Solve real-world online situations.", "skills": "Digital Citizenship", "week": 19}, {"title": "Digital Footprint", "bigIdea": "Spiral practice: Online Presence.", "essentialQuestion": "", "standards": "", "activity": "Explore how online actions can have lasting effects.", "skills": "Online Presence", "week": 20}, {"title": "Book Tasting", "bigIdea": "Spiral practice: Reading Identity.", "essentialQuestion": "", "standards": "", "activity": "Explore new genres, authors, or formats.", "skills": "Reading Identity", "week": 21}, {"title": "Award-Winning Books", "bigIdea": "Spiral practice: Literary Awards.", "essentialQuestion": "", "standards": "", "activity": "Compare award criteria and recommend books.", "skills": "Literary Awards", "week": 22}, {"title": "Diverse Perspectives", "bigIdea": "Spiral practice: Empathy.", "essentialQuestion": "", "standards": "", "activity": "Compare multiple viewpoints in texts.", "skills": "Empathy", "week": 23}, {"title": "Library Resource Challenge", "bigIdea": "Spiral practice: Using Library Resources.", "essentialQuestion": "", "standards": "", "activity": "Locate print, digital, and database resources efficiently.", "skills": "Using Library Resources", "week": 24}, {"title": "Mini Research Investigation", "bigIdea": "Spiral practice: Research Process.", "essentialQuestion": "", "standards": "", "activity": "Complete a short inquiry from question to conclusion.", "skills": "Research Process", "week": 25}, {"title": "Collaborative Research", "bigIdea": "Spiral practice: Teamwork.", "essentialQuestion": "", "standards": "", "activity": "Work in groups to investigate a topic and share findings.", "skills": "Teamwork", "week": 26}, {"title": "Present Like a Pro", "bigIdea": "Spiral practice: Communication.", "essentialQuestion": "", "standards": "", "activity": "Deliver a short presentation using evidence.", "skills": "Communication", "week": 27}, {"title": "Reflect & Revise", "bigIdea": "Spiral practice: Audience Feedback.", "essentialQuestion": "", "standards": "", "activity": "Improve work based on peer feedback.", "skills": "Audience Feedback", "week": 28}, {"title": "Passion Project", "bigIdea": "Spiral practice: Independent Inquiry.", "essentialQuestion": "", "standards": "", "activity": "Research a self-selected topic using the full research process.", "skills": "Independent Inquiry", "week": 29}, {"title": "Library Showcase", "bigIdea": "Spiral practice: Reflection.", "essentialQuestion": "", "standards": "", "activity": "Share learning, celebrate growth, and reflect on progress.", "skills": "Reflection", "week": 30}]}, "5": {"label": "5th Grade", "core": [{"title": "Research Begins with a Purpose", "bigIdea": "Good research starts with meaningful questions and a clear purpose.", "essentialQuestion": "What am I trying to learn?", "standards": "1.A, 1.B", "activity": "Build a clear research purpose from a topic or information need."}, {"title": "Search Like a Researcher", "bigIdea": "Different questions require different search strategies.", "essentialQuestion": "Where should I search first?", "standards": "1.B, 1.C, 3.A", "activity": "Compare search strategies and choose the best starting place for different questions."}, {"title": "Keywords, Search Tools & Databases", "bigIdea": "Better searches lead to better information.", "essentialQuestion": "How can I improve my searches?", "standards": "1.C, 3.A", "activity": "Practice improving search terms and choosing appropriate search tools or databases."}, {"title": "Evaluating Sources", "bigIdea": "Not every source is equally trustworthy.", "essentialQuestion": "Can I trust this information?", "standards": "2.A", "activity": "Evaluate sources using age-appropriate reliability and relevance checks."}, {"title": "Giving Credit to Others", "bigIdea": "Information belongs to creators.", "essentialQuestion": "How do we use others' work ethically?", "standards": "1.D, 3.A, 3.D", "activity": "Practice identifying creators and giving credit for information, images, and ideas."}, {"title": "Organizing Research", "bigIdea": "Good researchers stay organized.", "essentialQuestion": "How do I keep track of information?", "standards": "1.D, 2.B", "activity": "Organize notes, sources, and evidence so research is easier to use."}, {"title": "Media Literacy", "bigIdea": "Every message has a purpose and point of view.", "essentialQuestion": "Who created this and why?", "standards": "2.A", "activity": "Analyze the creator, purpose, audience, and point of view of a media message."}, {"title": "Digital Citizenship", "bigIdea": "Our online choices matter.", "essentialQuestion": "How do I stay safe and responsible online?", "standards": "3.B–3.D", "activity": "Practice safe, respectful, and responsible choices in realistic online scenarios."}, {"title": "Reading for Growth", "bigIdea": "Readers choose books intentionally.", "essentialQuestion": "What should I read next?", "standards": "4.A–4.C", "activity": "Use interests, goals, genres, authors, and formats to choose a next read."}, {"title": "Libraries Power Learning", "bigIdea": "Libraries connect people with ideas.", "essentialQuestion": "How can the library help me succeed?", "standards": "4.C", "activity": "Explore how print, digital, technology, and librarian support can help solve real needs."}], "monarch": [], "spiral": [{"title": "Ask Better Questions", "bigIdea": "Spiral practice: Research Purpose.", "essentialQuestion": "", "standards": "", "activity": "Turn broad topics into research questions.", "skills": "Research Purpose", "week": 11}, {"title": "Search Challenge", "bigIdea": "Spiral practice: Keywords • Databases.", "essentialQuestion": "", "standards": "", "activity": "Compete to find information using different search tools.", "skills": "Keywords • Databases", "week": 12}, {"title": "Website Detective", "bigIdea": "Spiral practice: Evaluating Sources.", "essentialQuestion": "", "standards": "", "activity": "Compare reliable and unreliable websites.", "skills": "Evaluating Sources", "week": 13}, {"title": "Fact, Opinion & Point of View", "bigIdea": "Spiral practice: Media Literacy.", "essentialQuestion": "", "standards": "", "activity": "Analyze articles, advertisements, or videos.", "skills": "Media Literacy", "week": 14}, {"title": "Research Notes", "bigIdea": "Spiral practice: Summarizing • Paraphrasing.", "essentialQuestion": "", "standards": "", "activity": "Practice note-taking without copying.", "skills": "Summarizing • Paraphrasing", "week": 15}, {"title": "Copyright & Fair Use", "bigIdea": "Spiral practice: Intellectual Property.", "essentialQuestion": "", "standards": "", "activity": "Decide when and how to give credit.", "skills": "Intellectual Property", "week": 16}, {"title": "Create an Infographic", "bigIdea": "Spiral practice: Organizing Information.", "essentialQuestion": "", "standards": "", "activity": "Present research visually.", "skills": "Organizing Information", "week": 17}, {"title": "Media Creator Challenge", "bigIdea": "Spiral practice: Audience & Purpose.", "essentialQuestion": "", "standards": "", "activity": "Create a public service announcement, poster, or digital slide.", "skills": "Audience & Purpose", "week": 18}, {"title": "Online Safety Scenarios", "bigIdea": "Spiral practice: Digital Citizenship.", "essentialQuestion": "", "standards": "", "activity": "Solve real-world online situations.", "skills": "Digital Citizenship", "week": 19}, {"title": "Digital Footprint", "bigIdea": "Spiral practice: Online Presence.", "essentialQuestion": "", "standards": "", "activity": "Explore how online actions can have lasting effects.", "skills": "Online Presence", "week": 20}, {"title": "Book Tasting", "bigIdea": "Spiral practice: Reading Identity.", "essentialQuestion": "", "standards": "", "activity": "Explore new genres, authors, or formats.", "skills": "Reading Identity", "week": 21}, {"title": "Award-Winning Books", "bigIdea": "Spiral practice: Literary Awards.", "essentialQuestion": "", "standards": "", "activity": "Compare award criteria and recommend books.", "skills": "Literary Awards", "week": 22}, {"title": "Diverse Perspectives", "bigIdea": "Spiral practice: Empathy.", "essentialQuestion": "", "standards": "", "activity": "Compare multiple viewpoints in texts.", "skills": "Empathy", "week": 23}, {"title": "Library Resource Challenge", "bigIdea": "Spiral practice: Using Library Resources.", "essentialQuestion": "", "standards": "", "activity": "Locate print, digital, and database resources efficiently.", "skills": "Using Library Resources", "week": 24}, {"title": "Mini Research Investigation", "bigIdea": "Spiral practice: Research Process.", "essentialQuestion": "", "standards": "", "activity": "Complete a short inquiry from question to conclusion.", "skills": "Research Process", "week": 25}, {"title": "Collaborative Research", "bigIdea": "Spiral practice: Teamwork.", "essentialQuestion": "", "standards": "", "activity": "Work in groups to investigate a topic and share findings.", "skills": "Teamwork", "week": 26}, {"title": "Present Like a Pro", "bigIdea": "Spiral practice: Communication.", "essentialQuestion": "", "standards": "", "activity": "Deliver a short presentation using evidence.", "skills": "Communication", "week": 27}, {"title": "Reflect & Revise", "bigIdea": "Spiral practice: Audience Feedback.", "essentialQuestion": "", "standards": "", "activity": "Improve work based on peer feedback.", "skills": "Audience Feedback", "week": 28}, {"title": "Passion Project", "bigIdea": "Spiral practice: Independent Inquiry.", "essentialQuestion": "", "standards": "", "activity": "Research a self-selected topic using the full research process.", "skills": "Independent Inquiry", "week": 29}, {"title": "Library Showcase", "bigIdea": "Spiral practice: Reflection.", "essentialQuestion": "", "standards": "", "activity": "Share learning, celebrate growth, and reflect on progress.", "skills": "Reflection", "week": 30}]}};
  const pageMap = {
    "1":"firstGrade.html",
    "2":"secondGrade.html",
    "3":"thirdGrade.html",
    "4":"fourthGrade.html",
    "5":"fifthGrade.html"
  };
  const icons = {"1":"🌱","2":"🌿","3":"📘","4":"📗","5":"📙"};
  const classCounts = {"1":3,"2":3,"3":3,"4":4,"5":3};
  const storageKey = "lrcLessonPlannerV3";
  const firestoreCollection = "plannerDashboard";
  const firestoreDocument = "lessonPlanning";
  const allowedEmails = new Set([
    "malbrecht@sd308.org",
    "malbrecht3317@gmail.com"
  ]);

  let currentGrade = null;
  let currentLessonKey = null;
  let stateCache = {};
  let firestoreReady = false;
  let saveTimer = null;

  function readLocalState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch {
      return {};
    }
  }

  function readState() {
    return stateCache;
  }

  function writeLocalState(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  async function initData() {
    stateCache = readLocalState();

    if (!window.firebase || !firebase.apps) {
      console.warn("Firebase SDK not available. Using local storage only.");
      return;
    }

    try {
      if (!firebase.apps.length) {
        if (!window.LRC_FIREBASE_CONFIG) {
          throw new Error("LRC_FIREBASE_CONFIG is missing.");
        }
        firebase.initializeApp(window.LRC_FIREBASE_CONFIG);
      }

      const auth = firebase.auth();
      const user = await new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(u => {
          unsubscribe();
          resolve(u);
        });
      });

      if (!user) {
        window.location.href = "../../login.html";
        return;
      }

      const email = (user.email || "").toLowerCase();
      if (!allowedEmails.has(email)) {
        document.body.innerHTML = `
          <main class="page-shell">
            <section class="summary-panel">
              <p class="eyebrow">ACCESS RESTRICTED</p>
              <h1>Lesson Planner</h1>
              <p>This planner is only available to the approved accounts.</p>
              <a class="back-link" href="../../login.html">Return to login</a>
            </section>
          </main>`;
        return;
      }

      const db = firebase.firestore();
      const ref = db.collection(firestoreCollection).doc(firestoreDocument);
      const snap = await ref.get();

      if (snap.exists && snap.data()?.grades) {
        stateCache = snap.data().grades;
        writeLocalState(stateCache);
      } else if (Object.keys(stateCache).length) {
        await ref.set({
          grades: stateCache,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: email
        }, { merge: true });
      }

      firestoreReady = true;
      setSyncStatus("☁️ Synced");
    } catch (error) {
      console.error("Firestore initialization failed:", error);
      setSyncStatus("⚠️ Local only");
    }
  }

  function setSyncStatus(text) {
    document.querySelectorAll("[data-sync-status]").forEach(el => {
      el.textContent = text;
    });
  }

  function writeState(state) {
    stateCache = state;
    writeLocalState(stateCache);
    scheduleFirestoreSave();
  }

  function scheduleFirestoreSave() {
    if (!firestoreReady) return;

    clearTimeout(saveTimer);
    setSyncStatus("☁️ Saving…");

    saveTimer = setTimeout(async () => {
      try {
        const user = firebase.auth().currentUser;
        const email = (user?.email || "").toLowerCase();
        const db = firebase.firestore();
        await db.collection(firestoreCollection).doc(firestoreDocument).set({
          grades: stateCache,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: email
        }, { merge: true });
        setSyncStatus("☁️ Synced");
      } catch (error) {
        console.error("Firestore save failed:", error);
        setSyncStatus("⚠️ Save failed");
      }
    }, 350);
  }

  function lessonKey(type, index) {
    return `${type}-${index}`;
  }

  function defaultLesson(title) {
    return {
      title,
      planned:false,
      slides:false,
      supplies:false,
      website:false,
      standard:"",
      targetWeek:"",
      notes:"",
      materials:"",
      links:"",
      classes:{}
    };
  }

  function getLesson(state, grade, type, index, defaultTitle) {
    state[grade] ??= {};
    const key = lessonKey(type,index);
    state[grade][key] ??= defaultLesson(defaultTitle);
    return ensureClasses(state[grade][key], grade);
  }

  function ensureClasses(lesson, grade) {
    const count = classCounts[grade];
    lesson.classes ??= {};
    const next = {};
    for (let i = 1; i <= count; i++) {
      const key = String(i);
      next[key] = !!lesson.classes[key];
    }
    lesson.classes = next;
    return lesson;
  }

  function prepCount(lesson) {
    return ["planned","slides","supplies","website"].filter(k => lesson[k]).length;
  }

  function classCount(lesson) {
    return Object.values(lesson.classes || {}).filter(Boolean).length;
  }

  function totalLessons(grade) {
    const g = curriculum[grade];
    return g.core.length + g.monarch.length + (g.spiral?.length || 0);
  }

  function statsForGrade(grade) {
    const state = readState();
    const g = curriculum[grade];
    let prepDone = 0, prepPossible = 0, taught = 0, lessons = 0;
    [["core",g.core],["monarch",g.monarch],["spiral",g.spiral || []]].forEach(([type,list]) => {
      list.forEach((item,i) => {
        const lesson = getLesson(state, grade, type, i, item.title || item);
        prepDone += prepCount(lesson);
        prepPossible += 4;
        taught += classCount(lesson) === classCounts[grade] ? 1 : 0;
        lessons += 1;
      });
    });
    writeState(state);
    return {
      prepPercent: prepPossible ? Math.round(prepDone/prepPossible*100) : 0,
      taught,
      lessons
    };
  }

  async function renderHome() {
    await initData();
    const grid = document.getElementById("gradeGrid");
    if (!grid) return;
    let combinedPrep = 0, combinedLessons = 0, totalTaught = 0;
    grid.innerHTML = Object.keys(curriculum).map(grade => {
      const g = curriculum[grade];
      const stats = statsForGrade(grade);
      combinedPrep += stats.prepPercent * stats.lessons;
      combinedLessons += stats.lessons;
      totalTaught += stats.taught;
      const curriculumText = g.monarch.length
        ? `${g.core.length} Core + ${g.monarch.length} Monarch`
        : `${g.core.length} Core + ${(g.spiral?.length || 0)} Spiral Practice`;
      return `
        <a class="grade-card" href="${pageMap[grade]}">
          <div class="grade-icon">${icons[grade]}</div>
          <h3>${g.label}</h3>
          <div class="grade-meta">${curriculumText}</div>
          <div class="progress-track small"><div class="progress-bar" style="width:${stats.prepPercent}%"></div></div>
          <div class="grade-progress">
            <span>${stats.prepPercent}% prep ready</span>
            <span>${stats.taught}/${stats.lessons} taught</span>
          </div>
        </a>`;
    }).join("");

    const overall = combinedLessons ? Math.round(combinedPrep/combinedLessons) : 0;
    document.getElementById("overallPercent").textContent = overall + "%";
    document.getElementById("overallBar").style.width = overall + "%";
    document.getElementById("overallDetail").textContent =
      `${totalTaught} lessons fully taught across all grade levels.`;
  }

  function lessonCard(grade, type, index, defaultTitle) {
    const state = readState();
    const lesson = getLesson(state, grade, type, index, defaultTitle);
    writeState(state);
    const checks = [
      ["planned","Plan"],
      ["slides","Slides"],
      ["supplies","Supplies"],
      ["website","Website"]
    ];
    return `
      <article class="lesson-card">
        <div class="lesson-main" data-open="${type}-${index}">
          <div class="lesson-number">${type === "core" ? "CORE" : "MONARCH"} ${index+1}</div>
          <div class="lesson-title">${escapeHtml(lesson.title)}</div>
        </div>
        ${checks.map(([key,label]) => `
          <div class="status-cell">
            <span>${label}</span>
            <div class="status-dot ${lesson[key] ? "done" : ""}">${lesson[key] ? "✓" : "○"}</div>
          </div>`).join("")}
        <div class="class-status">${classCount(lesson)} / ${classCounts[grade]} classes</div>
      </article>`;
  }

  async function renderGrade(grade) {
    await initData();
    currentGrade = grade;
    const g = curriculum[grade];
    if (!document.getElementById("coreLessons")) return;

    document.getElementById("coreCount").textContent = `${g.core.length} lessons`;
    document.getElementById("coreLessons").innerHTML =
      g.core.map((item,i)=>lessonCard(grade,"core",i,item)).join("");

    const monarchSection = document.getElementById("monarchSection");
    if (g.monarch.length) {
      document.getElementById("monarchCount").textContent = `${g.monarch.length} lessons`;
      document.getElementById("monarchLessons").innerHTML =
        g.monarch.map((item,i)=>lessonCard(grade,"monarch",i,item)).join("");
    } else {
      monarchSection.hidden = true;
    }

    const spiralSection = document.getElementById("spiralSection");
    if (spiralSection) {
      if (g.spiral?.length) {
        document.getElementById("spiralCount").textContent = `${g.spiral.length} lessons`;
        document.getElementById("spiralLessons").innerHTML =
          g.spiral.map((item,i)=>lessonCard(grade,"spiral",i,item)).join("");
      } else {
        spiralSection.hidden = true;
      }
    }

    document.querySelectorAll("[data-open]").forEach(el => {
      el.addEventListener("click", () => openLesson(el.dataset.open));
    });

    document.getElementById("saveLesson").addEventListener("click", saveCurrentLesson);
    document.getElementById("resetLesson").addEventListener("click", resetCurrentLesson);
    refreshSummary();
  }

  function openLesson(key) {
    currentLessonKey = key;
    const [type,indexString] = key.split("-");
    const index = Number(indexString);
    const item = curriculum[currentGrade][type][index];
    const defaultTitle = item.title || item;
    const state = readState();
    const lesson = getLesson(state,currentGrade,type,index,defaultTitle);
    if (!lesson.standard && item.standards) lesson.standard = item.standards;
    if (!lesson.notes && (item.bigIdea || item.essentialQuestion || item.activity)) {
      lesson.notes = [
        item.bigIdea ? `Big Idea: ${item.bigIdea}` : "",
        item.essentialQuestion ? `Essential Question: ${item.essentialQuestion}` : "",
        item.skills ? `Core Skills Reinforced: ${item.skills}` : "",
        item.activity ? `Possible Activity: ${item.activity}` : ""
      ].filter(Boolean).join("\n\n");
    }
    writeState(state);

    document.getElementById("dialogType").textContent =
      `${type === "core" ? "CORE LESSON" : type === "monarch" ? "MONARCH LESSON" : "SPIRAL PRACTICE"} ${type === "spiral" ? (item.week || index + 11) : index+1}`;
    document.getElementById("dialogTitle").textContent = lesson.title;
    document.getElementById("lessonTitleInput").value = lesson.title;
    ["planned","slides","supplies","website"].forEach(k => {
      document.getElementById(k).checked = !!lesson[k];
    });
    document.getElementById("standard").value = lesson.standard || "";
    document.getElementById("targetWeek").value = lesson.targetWeek || "";
    document.getElementById("notes").value = lesson.notes || "";
    document.getElementById("materials").value = lesson.materials || "";
    document.getElementById("links").value = lesson.links || "";
    const classChecks = document.getElementById("classChecks");
    classChecks.innerHTML = Array.from({length: classCounts[currentGrade]}, (_, i) => {
      const key = String(i + 1);
      return `<label><input type="checkbox" data-class="${key}" ${lesson.classes?.[key] ? "checked" : ""}> Class ${key}</label>`;
    }).join("");
    document.getElementById("lessonDialog").showModal();
  }

  function saveCurrentLesson() {
    if (!currentLessonKey) return;
    const [type,indexString] = currentLessonKey.split("-");
    const index = Number(indexString);
    const item = curriculum[currentGrade][type][index];
    const defaultTitle = item.title || item;
    const state = readState();
    const lesson = getLesson(state,currentGrade,type,index,defaultTitle);
    if (!lesson.standard && item.standards) lesson.standard = item.standards;
    if (!lesson.notes && (item.bigIdea || item.essentialQuestion || item.activity)) {
      lesson.notes = [
        item.bigIdea ? `Big Idea: ${item.bigIdea}` : "",
        item.essentialQuestion ? `Essential Question: ${item.essentialQuestion}` : "",
        item.skills ? `Core Skills Reinforced: ${item.skills}` : "",
        item.activity ? `Possible Activity: ${item.activity}` : ""
      ].filter(Boolean).join("\n\n");
    }

    lesson.title = document.getElementById("lessonTitleInput").value.trim() || defaultTitle;
    ["planned","slides","supplies","website"].forEach(k => {
      lesson[k] = document.getElementById(k).checked;
    });
    lesson.standard = document.getElementById("standard").value.trim();
    lesson.targetWeek = document.getElementById("targetWeek").value.trim();
    lesson.notes = document.getElementById("notes").value;
    lesson.materials = document.getElementById("materials").value;
    lesson.links = document.getElementById("links").value;
    lesson.classes = {};
    document.querySelectorAll("[data-class]").forEach(cb => {
      lesson.classes[cb.dataset.class] = cb.checked;
    });

    writeState(state);
    document.getElementById("lessonDialog").close();
    rerenderGrade();
  }

  function resetCurrentLesson() {
    if (!currentLessonKey) return;
    const [type,indexString] = currentLessonKey.split("-");
    const index = Number(indexString);
    const item = curriculum[currentGrade][type][index];
    const defaultTitle = item.title || item;
    const state = readState();
    state[currentGrade] ??= {};
    state[currentGrade][currentLessonKey] = defaultLesson(defaultTitle);
    writeState(state);
    document.getElementById("lessonDialog").close();
    rerenderGrade();
  }

  function rerenderGrade() {
    const g = curriculum[currentGrade];
    document.getElementById("coreLessons").innerHTML =
      g.core.map((item,i)=>lessonCard(currentGrade,"core",i,item)).join("");
    if (g.monarch.length) {
      document.getElementById("monarchLessons").innerHTML =
        g.monarch.map((item,i)=>lessonCard(currentGrade,"monarch",i,item)).join("");
    }
    if (g.spiral?.length && document.getElementById("spiralLessons")) {
      document.getElementById("spiralLessons").innerHTML =
        g.spiral.map((item,i)=>lessonCard(currentGrade,"spiral",i,item)).join("");
    }
    document.querySelectorAll("[data-open]").forEach(el => {
      el.addEventListener("click", () => openLesson(el.dataset.open));
    });
    refreshSummary();
  }

  function refreshSummary() {
    const stats = statsForGrade(currentGrade);
    document.getElementById("prepPercent").textContent = stats.prepPercent + "%";
    document.getElementById("prepBar").style.width = stats.prepPercent + "%";
    document.getElementById("taughtCount").textContent = `${stats.taught} / ${stats.lessons}`;
    const taughtPercent = stats.lessons ? Math.round(stats.taught/stats.lessons*100) : 0;
    document.getElementById("taughtBar").style.width = taughtPercent + "%";
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  return { renderHome, renderGrade };
})();
