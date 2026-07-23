
const LessonPlanner = (() => {
  const curriculum = {"1": {"label": "1st Grade", "core": ["LRC Orientation", "Book Care & Checkout Routines", "Research Starts With a Question", "Finding Information", "Keywords", "Choosing a Resource", "Author / Illustrator / Creator", "Basic Citation", "Using Simple Quotes", "Research Celebration & Review"], "monarch": ["Monarch Lesson 1", "Monarch Lesson 2", "Monarch Lesson 3", "Monarch Lesson 4", "Monarch Lesson 5", "Monarch Lesson 6", "Monarch Lesson 7", "Monarch Lesson 8", "Monarch Lesson 9", "Monarch Lesson 10", "Monarch Lesson 11", "Monarch Lesson 12", "Monarch Lesson 13", "Monarch Lesson 14", "Monarch Lesson 15", "Monarch Lesson 16", "Monarch Lesson 17", "Monarch Lesson 18", "Monarch Lesson 19", "Monarch Lesson 20"]}, "2": {"label": "2nd Grade", "core": ["LRC Orientation", "Book Care & Checkout Routines", "Research Starts With a Question", "Finding Information", "Keywords", "Choosing a Resource", "Author / Illustrator / Creator", "Basic Citation", "Using Simple Quotes", "Research Celebration & Review"], "monarch": ["Monarch Lesson 1", "Monarch Lesson 2", "Monarch Lesson 3", "Monarch Lesson 4", "Monarch Lesson 5", "Monarch Lesson 6", "Monarch Lesson 7", "Monarch Lesson 8", "Monarch Lesson 9", "Monarch Lesson 10", "Monarch Lesson 11", "Monarch Lesson 12", "Monarch Lesson 13", "Monarch Lesson 14", "Monarch Lesson 15", "Monarch Lesson 16", "Monarch Lesson 17", "Monarch Lesson 18", "Monarch Lesson 19", "Monarch Lesson 20"]}, "3": {"label": "3rd Grade", "core": ["Core Lesson 1", "Core Lesson 2", "Core Lesson 3", "Core Lesson 4", "Core Lesson 5", "Core Lesson 6", "Core Lesson 7", "Core Lesson 8", "Core Lesson 9", "Core Lesson 10"], "monarch": []}, "4": {"label": "4th Grade", "core": ["Core Lesson 1", "Core Lesson 2", "Core Lesson 3", "Core Lesson 4", "Core Lesson 5", "Core Lesson 6", "Core Lesson 7", "Core Lesson 8", "Core Lesson 9", "Core Lesson 10"], "monarch": []}, "5": {"label": "5th Grade", "core": ["Core Lesson 1", "Core Lesson 2", "Core Lesson 3", "Core Lesson 4", "Core Lesson 5", "Core Lesson 6", "Core Lesson 7", "Core Lesson 8", "Core Lesson 9", "Core Lesson 10"], "monarch": []}};
  const pageMap = {
    "1":"firstGrade.html",
    "2":"secondGrade.html",
    "3":"thirdGrade.html",
    "4":"fourthGrade.html",
    "5":"fifthGrade.html"
  };
  const icons = {"1":"🌱","2":"🌿","3":"📘","4":"📗","5":"📙"};
  const storageKey = "lrcLessonPlannerV1";
  let currentGrade = null;
  let currentLessonKey = null;

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch {
      return {};
    }
  }

  function writeState(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
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
      classes:{A:false,B:false,C:false,D:false,E:false}
    };
  }

  function getLesson(state, grade, type, index, defaultTitle) {
    state[grade] ??= {};
    const key = lessonKey(type,index);
    state[grade][key] ??= defaultLesson(defaultTitle);
    return state[grade][key];
  }

  function prepCount(lesson) {
    return ["planned","slides","supplies","website"].filter(k => lesson[k]).length;
  }

  function classCount(lesson) {
    return Object.values(lesson.classes || {}).filter(Boolean).length;
  }

  function totalLessons(grade) {
    const g = curriculum[grade];
    return g.core.length + g.monarch.length;
  }

  function statsForGrade(grade) {
    const state = readState();
    const g = curriculum[grade];
    let prepDone = 0, prepPossible = 0, taught = 0, lessons = 0;
    [["core",g.core],["monarch",g.monarch]].forEach(([type,list]) => {
      list.forEach((title,i) => {
        const lesson = getLesson(state, grade, type, i, title);
        prepDone += prepCount(lesson);
        prepPossible += 4;
        taught += classCount(lesson) === 5 ? 1 : 0;
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

  function renderHome() {
    const grid = document.getElementById("gradeGrid");
    let combinedPrep = 0, combinedLessons = 0, totalTaught = 0;
    grid.innerHTML = Object.keys(curriculum).map(grade => {
      const g = curriculum[grade];
      const stats = statsForGrade(grade);
      combinedPrep += stats.prepPercent * stats.lessons;
      combinedLessons += stats.lessons;
      totalTaught += stats.taught;
      const curriculumText = g.monarch.length
        ? `${g.core.length} Core + ${g.monarch.length} Monarch`
        : `${g.core.length} Core Lessons`;
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
        <div class="class-status">${classCount(lesson)} / 5 classes</div>
      </article>`;
  }

  function renderGrade(grade) {
    currentGrade = grade;
    const g = curriculum[grade];

    document.getElementById("coreCount").textContent = `${g.core.length} lessons`;
    document.getElementById("coreLessons").innerHTML =
      g.core.map((t,i)=>lessonCard(grade,"core",i,t)).join("");

    const monarchSection = document.getElementById("monarchSection");
    if (g.monarch.length) {
      document.getElementById("monarchCount").textContent = `${g.monarch.length} lessons`;
      document.getElementById("monarchLessons").innerHTML =
        g.monarch.map((t,i)=>lessonCard(grade,"monarch",i,t)).join("");
    } else {
      monarchSection.hidden = true;
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
    const defaultTitle = curriculum[currentGrade][type][index];
    const state = readState();
    const lesson = getLesson(state,currentGrade,type,index,defaultTitle);
    writeState(state);

    document.getElementById("dialogType").textContent =
      `${type === "core" ? "CORE LESSON" : "MONARCH LESSON"} ${index+1}`;
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
    document.querySelectorAll("[data-class]").forEach(cb => {
      cb.checked = !!lesson.classes?.[cb.dataset.class];
    });
    document.getElementById("lessonDialog").showModal();
  }

  function saveCurrentLesson() {
    if (!currentLessonKey) return;
    const [type,indexString] = currentLessonKey.split("-");
    const index = Number(indexString);
    const defaultTitle = curriculum[currentGrade][type][index];
    const state = readState();
    const lesson = getLesson(state,currentGrade,type,index,defaultTitle);

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
    const defaultTitle = curriculum[currentGrade][type][index];
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
      g.core.map((t,i)=>lessonCard(currentGrade,"core",i,t)).join("");
    if (g.monarch.length) {
      document.getElementById("monarchLessons").innerHTML =
        g.monarch.map((t,i)=>lessonCard(currentGrade,"monarch",i,t)).join("");
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
