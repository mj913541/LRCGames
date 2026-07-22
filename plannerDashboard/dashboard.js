import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDTKYFcm26i0LsrLo9UjtLnZpNKx4XsWG4",
  authDomain: "lrcquest-3039e.firebaseapp.com",
  projectId: "lrcquest-3039e",
  storageBucket: "lrcquest-3039e.firebasestorage.app",
  messagingSenderId: "72063656342",
  appId: "1:72063656342:web:bc08c6538437f50b53bdb7",
  measurementId: "G-5VXRYJ733C"
};
const ALLOWED_EMAILS = new Set(["malbrecht@sd308.org", "malbrecht3317@gmail.com"]);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_SCHEDULE_BY_LETTER_DAY = {
  A: [{time24:"09:05",title:"4th Rosenthal"},{time24:"10:05",title:"2nd Peterson"},{time24:"11:05",title:"3rd Hossain"},{time24:"13:45",title:"5th Altruismo"},{time24:"14:45",title:"1st Rogers"}],
  B: [{time24:"09:05",title:"4th Cavello"},{time24:"10:05",title:"2nd Schmidt"},{time24:"13:45",title:"5th Isibindi"}],
  C: [{time24:"08:45",title:"AM Duty"},{time24:"10:05",title:"2nd Adams"},{time24:"11:05",title:"3rd Pulsa"},{time24:"13:45",title:"5th Amistad"}],
  D: [{time24:"09:20",title:"HC 5th Green"},{time24:"10:05",title:"HC 1st Green"},{time24:"14:45",title:"1st Wilson"}],
  E: [{time24:"09:05",title:"4th Tomter"},{time24:"11:05",title:"3rd Carroll"},{time24:"13:45",title:"5th Reveur"},{time24:"14:45",title:"1st Day"}]
};
const AM_DAILY = ["Switch Dishwasher","Clean Glasses","Deodorant","Eat Breakfast","Levothyroxine","Brush teeth","Floss","Get Dressed","Wash Face","Style Hair","Feed Cat & Refresh Water"];
const PM_DAILY = ["Brush teeth","Floss","Wash Face","Water Bottle & Lunch dishes in dishwasher","Clothes for tomorrow"];
const SCHOOL_AM = ["Water Bottle","Pack Lunch","Pack School bag"];
const DAYCARE_AM = ["Lincoln Diaper Changed","Lincoln Bottle","Lincoln Morning Routine","Daycare bag packed","Daycare Notebook Filled Out"];
const WORK_OPEN = ["Projector on","Lunch in fridge","Sign into laptops & pull up Destiny","Name tags out"];
const WORK_CLOSE = ["Sign out / projector off","Collect name tags","5 minutes classroom straighten","Clear desk"];
const DEFAULT_HOME_TASKS = ["Meal planning","Grocery list & Walmart runs","Meal prep / leftovers cleanup","Cleaning zone: workout room","Cleaning zone: living room","Cleaning zone: kitchen","Cleaning zone: downstairs bathroom","Cleaning zone: dining room / baby changing station","Cleaning zone: upstairs bathroom","Cleaning zone: nursery","Cleaning zone: upstairs hallway","Cleaning zone: adult bedroom","Diaper inventory & baby supplies","Litter box","Trash / recycling (Thursday)","Mail (Tuesday and Thursday)"];
const DEFAULT_GOALS = [{name:"Cups of water",goal:8},{name:"Minutes walked",goal:20},{name:"Fruits / vegetables",goal:5}];
const DEFAULT_LAST_TIME = [{name:"Change sheets",greenDays:7,yellowDays:10},{name:"Clean litter box",greenDays:1,yellowDays:2},{name:"Check diaper inventory",greenDays:5,yellowDays:7},{name:"Clean bathroom floor",greenDays:7,yellowDays:10}];
const QUOTES = [
  ["You do not need to finish everything. You only need to choose the next kind thing.","A gentle reminder"],
  ["Small steps still move the day forward.","Your calm dashboard"],
  ["Make the task visible, make the next step tiny, then begin.","For an ADHD brain"],
  ["Done gently is still done.","Today’s permission slip"]
];

let user = null;
let dayData = null;
let weekData = null;
let plannerSettings = null;
let saveTimer = null;
const todayKey = localDateKey(new Date());
const weekKey = getISOWeekKey(new Date());
const $ = (id) => document.getElementById(id);

function localDateKey(date) { const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,"0"), d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function getISOWeekKey(date) { const copy=new Date(date); copy.setHours(0,0,0,0); copy.setDate(copy.getDate()+3-((copy.getDay()+6)%7)); const week1=new Date(copy.getFullYear(),0,4); const week=1+Math.round(((copy-week1)/86400000-3+((week1.getDay()+6)%7))/7); return `${copy.getFullYear()}-W${String(week).padStart(2,"0")}`; }
function dayDoc() { return doc(db,"plannerDashboardUsers",user.uid,"days",todayKey); }
function weekDoc() { return doc(db,"plannerDashboardUsers",user.uid,"weeks",weekKey); }
function profileDoc() { return doc(db,"plannerDashboardUsers",user.uid); }
function esc(v="") { const d=document.createElement("div"); d.textContent=v; return d.innerHTML; }
function formatTime(time24) { const [h,m]=time24.split(":").map(Number); return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(new Date(2000,0,1,h,m)); }
function showToast(message) { const t=$("toast"); t.textContent=message; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); }
function markSaving() { $("saveStatus").textContent="Saving…"; }
function markSaved() { $("saveStatus").textContent="Saved"; }
function queueSave() { markSaving(); clearTimeout(saveTimer); saveTimer=setTimeout(saveAll,500); }
async function saveAll() {
  if(!user || !dayData || !weekData) return;
  try {
    await Promise.all([
      setDoc(dayDoc(), {...dayData, updatedAt:serverTimestamp()}, {merge:true}),
      setDoc(weekDoc(), {...weekData, updatedAt:serverTimestamp()}, {merge:true}),
      setDoc(profileDoc(), {email:user.email, parkingLot:dayData.parkingLot || "", lastOpenedDay:todayKey, plannerSettings, updatedAt:serverTimestamp()}, {merge:true})
    ]);
    markSaved();
  } catch(err) { console.error(err); $("saveStatus").textContent="Save failed"; showToast("Could not save. Check your connection."); }
}

onAuthStateChanged(auth, async currentUser => {
  if(!currentUser) { location.replace("../login.html?redirect=plannerDashboard/dashboard.html"); return; }
  if(!ALLOWED_EMAILS.has((currentUser.email||"").toLowerCase())) { await signOut(auth); location.replace("../login.html?reason=unauthorized"); return; }
  user=currentUser;
  await loadData();
  setupUI();
  $("loadingScreen").classList.add("done");
});

async function loadData() {
  const [daySnap,weekSnap,profileSnap] = await Promise.all([getDoc(dayDoc()),getDoc(weekDoc()),getDoc(profileDoc())]);
  const now = new Date();
  const profileData = profileSnap.exists() ? profileSnap.data() : {};
  plannerSettings = profileData.plannerSettings || {
    classSchedule: structuredClone(DEFAULT_SCHEDULE_BY_LETTER_DAY),
    futureAssignments: {}
  };
  plannerSettings.classSchedule ||= structuredClone(DEFAULT_SCHEDULE_BY_LETTER_DAY);
  plannerSettings.futureAssignments ||= {};
  const assignedToday = plannerSettings.futureAssignments[todayKey] || null;
  dayData = daySnap.exists() ? daySnap.data() : {
    date:todayKey,
    context: assignedToday ? {dayOfWeek:now.toLocaleDateString("en-US",{weekday:"long"}), letterDay:assignedToday.letterDay, daycare:assignedToday.daycare} : null,
    completed:{}, customItems:[], goals:DEFAULT_GOALS.map(g=>({...g,id:uid(),count:0})),
    lastTime:DEFAULT_LAST_TIME.map(i=>({...i,id:uid(),lastDone:null})), parkingLot:profileData.parkingLot || "",
    ui:{hideChecked:false,hideCompletedGoals:false,collapsed:{}}
  };
  if(assignedToday && assignedToday.override !== false) {
    dayData.context ||= {};
    dayData.context.dayOfWeek = now.toLocaleDateString("en-US",{weekday:"long"});
    dayData.context.letterDay = assignedToday.letterDay;
    dayData.context.daycare = assignedToday.daycare;
  }
  weekData = weekSnap.exists() ? weekSnap.data() : {week:weekKey,workTasks:[],homeTasks:DEFAULT_HOME_TASKS.map(name=>({id:uid(),name,status:"planned"}))};
  dayData.completed ||= {}; dayData.customItems ||= []; dayData.goals ||= []; dayData.lastTime ||= []; dayData.ui ||= {hideChecked:false,hideCompletedGoals:false,collapsed:{}}; dayData.ui.collapsed ||= {};
  $("todayLabel").textContent = now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const quote=QUOTES[now.getDate()%QUOTES.length]; $("dailyQuote").innerHTML=`“${quote[0]}”<cite>${quote[1]}</cite>`;
}

function setupUI() {
  const weekday=new Date().toLocaleDateString("en-US",{weekday:"long"});
  $("dayOfWeek").value=dayData.context?.dayOfWeek || weekday;
  $("letterDay").value=dayData.context?.letterDay || "No School";
  document.querySelector(`input[name="daycare"][value="${dayData.context?.daycare || "no"}"]`).checked=true;
  $("parkingLot").value=dayData.parkingLot || "";
  $("hideCompletedGoals").checked=!!dayData.ui.hideCompletedGoals;
  if(dayData.context) showDashboard(); else $("contextCard").classList.remove("hidden");
  restoreCollapsed(); bindEvents(); renderAll();
}

function bindEvents() {
  $("contextForm").addEventListener("submit", e=>{ e.preventDefault(); dayData.context={dayOfWeek:$("dayOfWeek").value,letterDay:$("letterDay").value,daycare:document.querySelector('input[name="daycare"]:checked').value}; showDashboard(); renderTimeline(); queueSave(); });
  $("editContextBtn").addEventListener("click",()=>{ $("contextCard").classList.remove("hidden"); $("contextCard").scrollIntoView({behavior:"smooth"}); });
  $("signOutBtn").addEventListener("click",async()=>{ await signOut(auth); });
  $("parkingLot").addEventListener("input",e=>{ dayData.parkingLot=e.target.value; queueSave(); });
  $("hideCompletedGoals").addEventListener("change",e=>{ dayData.ui.hideCompletedGoals=e.target.checked; renderGoals(); queueSave(); });
  document.querySelectorAll(".collapse-trigger").forEach(btn=>btn.addEventListener("click",()=>{ const card=btn.closest(".collapsible-card"), key=card.dataset.card; card.classList.toggle("collapsed"); btn.setAttribute("aria-expanded",String(!card.classList.contains("collapsed"))); dayData.ui.collapsed[key]=card.classList.contains("collapsed"); queueSave(); }));
  document.querySelectorAll(".mini-hide").forEach(btn=>btn.addEventListener("click",()=>{ const el=$(btn.dataset.target); el.classList.toggle("hidden"); btn.textContent=el.classList.contains("hidden")?"Show":"Hide"; }));
  $("addAppointmentBtn").addEventListener("click",()=>openDialog("appointment")); $("addTodayTaskBtn").addEventListener("click",()=>openDialog("todayTask"));
  $("editClassScheduleBtn").addEventListener("click",openClassScheduleEditor);
  $("addFutureDayBtn").addEventListener("click",openFutureAssignmentDialog);
  $("addWorkTaskBtn").addEventListener("click",()=>openDialog("workTask")); $("addHomeTaskBtn").addEventListener("click",()=>openDialog("homeTask"));
  $("addGoalBtn").addEventListener("click",()=>openDialog("goal")); $("addLastTimeBtn").addEventListener("click",()=>openDialog("lastTime"));
  $("dialogClose").addEventListener("click",()=>$("itemDialog").close()); $("dialogCancel").addEventListener("click",()=>$("itemDialog").close());
}
function restoreCollapsed() { document.querySelectorAll(".collapsible-card").forEach(card=>{ if(dayData.ui.collapsed[card.dataset.card]) { card.classList.add("collapsed"); card.querySelector(".collapse-trigger").setAttribute("aria-expanded","false"); } }); }
function showDashboard() { $("contextCard").classList.add("hidden"); $("dashboardContent").classList.remove("hidden"); }
function renderAll() { renderTimeline(); renderWeekly(); renderGoals(); renderLastTime(); renderScheduleSettings(); }

function buildTimelineItems() {
  const c=dayData.context; if(!c) return [];
  const items=[]; const add=(time24,title,type,key,custom=false)=>items.push({time24,title,type,key,custom});
  AM_DAILY.forEach((t,i)=>add("06:00",t,"AM routine",`am-${i}`));
  const schoolWeek=["Monday","Tuesday","Wednesday","Thursday","Friday"].includes(c.dayOfWeek);
  if(schoolWeek) SCHOOL_AM.forEach((t,i)=>add("06:00",t,"School morning",`school-am-${i}`));
  if(c.daycare==="yes") DAYCARE_AM.forEach((t,i)=>add("06:00",t,"Daycare morning",`daycare-${i}`));
  if(c.letterDay!=="No School") {
    WORK_OPEN.forEach((t,i)=>add("09:00",t,"Work arrive",`open-${i}`));
    (plannerSettings.classSchedule[c.letterDay]||[]).forEach((s,i)=>add(s.time24,s.title,`${c.letterDay} Day class`,`class-${c.letterDay}-${i}`));
    const schedule=plannerSettings.classSchedule[c.letterDay]||[]; const last=schedule[schedule.length-1]; const closeTime=last ? addMinutes(last.time24,45) : "15:20";
    WORK_CLOSE.forEach((t,i)=>add(closeTime,t,"Work close",`close-${i}`));
  }
  PM_DAILY.forEach((t,i)=>add("20:00",t,"PM routine",`pm-${i}`));
  dayData.customItems.forEach(item=>add(item.time24,item.title,item.type,item.id,true));
  return items.sort((a,b)=>a.time24.localeCompare(b.time24) || a.type.localeCompare(b.type));
}
function addMinutes(time,mins) { const [h,m]=time.split(":").map(Number), total=h*60+m+mins; return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; }
function periodFor(time) { const h=Number(time.split(":")[0]); return h<10?"AM":h<17?"Midday":"PM"; }
function renderTimeline() {
  if(!dayData.context) return;
  const unfinished = buildTimelineItems().filter(item => !dayData.completed[item.key]);
  const groups={AM:[],Midday:[],PM:[]};
  unfinished.forEach(i=>groups[periodFor(i.time24)].push(i));
  let html="";
  Object.entries(groups).forEach(([period,list])=>{
    if(!list.length) return;
    html+=`<div class="period-heading">${period}</div>`;
    if(period==="Midday" && dayData.context.letterDay!=="No School") html+=`<div class="arrive-divider">Work arrive • open the LRC and begin the school-day flow</div>`;
    list.forEach(item=>{ html+=`<div class="timeline-item" data-key="${esc(item.key)}"><span class="timeline-time">${formatTime(item.time24)}</span><button class="check-button" type="button" aria-label="Complete ${esc(item.title)}"></button><div><div class="timeline-title">${esc(item.title)}</div><div class="timeline-type">${esc(item.type)}</div></div>${item.custom?`<button class="delete-button" data-delete-custom="${esc(item.key)}" type="button" aria-label="Delete">×</button>`:"<span></span>"}</div>`; });
  });
  if(!html) html='<div class="empty-state">Everything on today’s timeline is complete. Beautiful work!</div>';
  $("timeline").innerHTML=html;
  $("timeline").querySelectorAll(".check-button").forEach(btn=>btn.addEventListener("click",async()=>{
    const key=btn.closest(".timeline-item").dataset.key;
    dayData.completed[key]=true;
    renderTimeline();
    markSaving();
    try { await setDoc(dayDoc(), {completed:dayData.completed,updatedAt:serverTimestamp()}, {merge:true}); markSaved(); }
    catch(err){ console.error(err); $("saveStatus").textContent="Save failed"; }
  }));
  $("timeline").querySelectorAll("[data-delete-custom]").forEach(btn=>btn.addEventListener("click",()=>{ dayData.customItems=dayData.customItems.filter(i=>i.id!==btn.dataset.deleteCustom); renderTimeline(); queueSave(); }));
}

function renderWeekly() { renderWeeklyList("workTaskList",weekData.workTasks,"work"); renderWeeklyList("homeTaskList",weekData.homeTasks,"home"); }
function renderWeeklyList(id,tasks,kind) {
  const el=$(id); if(!tasks.length) { el.innerHTML='<div class="empty-state">No tasks yet. Add one when you are ready.</div>'; return; }
  const steps={planned:34,prepped:67,completed:100};
  el.innerHTML=tasks.map(t=>`<div class="weekly-task"><div class="weekly-name">${esc(t.name)}</div><div class="status-control">${["planned","prepped","completed"].map(s=>`<button class="${t.status===s?"active":""}" data-status="${s}" data-id="${t.id}" type="button">${s}</button>`).join("")}</div><button class="delete-button" data-week-delete="${t.id}" type="button">×</button><div class="weekly-progress"><span style="width:${steps[t.status]||34}%"></span></div></div>`).join("");
  el.querySelectorAll("[data-status]").forEach(btn=>btn.addEventListener("click",()=>{ const arr=kind==="work"?weekData.workTasks:weekData.homeTasks; const task=arr.find(t=>t.id===btn.dataset.id); if(task) task.status=btn.dataset.status; renderWeekly(); queueSave(); }));
  el.querySelectorAll("[data-week-delete]").forEach(btn=>btn.addEventListener("click",()=>{ const key=kind==="work"?"workTasks":"homeTasks"; weekData[key]=weekData[key].filter(t=>t.id!==btn.dataset.weekDelete); renderWeekly(); queueSave(); }));
}

function renderGoals() {
  const sorted=[...dayData.goals].sort((a,b)=>(a.count>=a.goal)-(b.count>=b.goal));
  const visible=sorted.filter(g=>!(dayData.ui.hideCompletedGoals && g.count>=g.goal));
  $("goalList").innerHTML=visible.length?visible.map(g=>`<div class="goal-row ${g.count>=g.goal?"complete":""}"><div><div class="goal-name">${esc(g.name)}</div><div class="goal-count">Goal: ${g.goal}${g.count>=g.goal?" • Complete!":""}</div></div><div class="counter"><button data-goal-minus="${g.id}" type="button">−</button><strong>${g.count}</strong><button data-goal-plus="${g.id}" type="button">+</button></div><button class="delete-button" data-goal-delete="${g.id}" type="button">×</button></div>`).join(""):'<div class="empty-state">All completed goals are hidden.</div>';
  $("goalList").querySelectorAll("[data-goal-plus]").forEach(btn=>btn.addEventListener("click",()=>changeGoal(btn.dataset.goalPlus,1))); $("goalList").querySelectorAll("[data-goal-minus]").forEach(btn=>btn.addEventListener("click",()=>changeGoal(btn.dataset.goalMinus,-1))); $("goalList").querySelectorAll("[data-goal-delete]").forEach(btn=>btn.addEventListener("click",()=>{dayData.goals=dayData.goals.filter(g=>g.id!==btn.dataset.goalDelete);renderGoals();queueSave();}));
}
function changeGoal(id,delta) { const g=dayData.goals.find(x=>x.id===id); if(g) g.count=Math.max(0,g.count+delta); renderGoals(); queueSave(); }

function urgency(item) { if(!item.lastDone) return {level:"red",text:"Not recorded yet",days:99999}; const days=Math.floor((new Date(todayKey+"T12:00:00")-new Date(item.lastDone+"T12:00:00"))/86400000); if(days<=item.greenDays) return {level:"green",text:days===0?"Done today":`${days} day${days===1?"":"s"} ago`,days}; if(days<=item.yellowDays) return {level:"yellow",text:`${days} days ago • due soon`,days}; return {level:"red",text:`${days} days ago • overdue`,days}; }
function renderLastTime() {
  const sorted=[...dayData.lastTime].sort((a,b)=>urgency(b).days-urgency(a).days);
  $("lastTimeList").innerHTML=sorted.length?sorted.map(i=>{const u=urgency(i);return `<div class="last-time-row"><span class="urgency-dot urgency-${u.level}"></span><div><div class="goal-name">${esc(i.name)}</div><div class="last-meta">${u.text} • Green ${i.greenDays}d, yellow through ${i.yellowDays}d</div></div><button class="just-did" data-just-did="${i.id}" type="button">Just did it</button><button class="delete-button" data-last-delete="${i.id}" type="button">×</button></div>`}).join(""):'<div class="empty-state">Add a recurring item to track it here.</div>';
  $("lastTimeList").querySelectorAll("[data-just-did]").forEach(btn=>btn.addEventListener("click",()=>{const i=dayData.lastTime.find(x=>x.id===btn.dataset.justDid);if(i)i.lastDone=todayKey;renderLastTime();queueSave();showToast("Marked as done today.");})); $("lastTimeList").querySelectorAll("[data-last-delete]").forEach(btn=>btn.addEventListener("click",()=>{dayData.lastTime=dayData.lastTime.filter(i=>i.id!==btn.dataset.lastDelete);renderLastTime();queueSave();}));
}

function renderScheduleSettings() {
  const preview=$("classSchedulePreview");
  if(preview) preview.innerHTML=["A","B","C","D","E"].map(letter=>{
    const classes=plannerSettings.classSchedule[letter]||[];
    return `<div class="schedule-day-row"><div class="schedule-letter">${letter} Day</div><div class="schedule-class-list">${classes.length?classes.map(c=>`<span class="schedule-chip">${formatTime(c.time24)} · ${esc(c.title)}</span>`).join(""):'<span class="subtle">No classes</span>'}</div></div>`;
  }).join("");
  const future=$("futureAssignmentsList");
  if(!future) return;
  const entries=Object.entries(plannerSettings.futureAssignments).sort(([a],[b])=>a.localeCompare(b));
  future.innerHTML=entries.length?entries.map(([date,a])=>`<div class="future-row"><div class="future-date">${new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div><div><div>${esc(a.letterDay)} · Daycare ${a.daycare==="yes"?"Yes":"No"}</div><div class="future-meta">${a.override!==false?"Date override":"Planned assignment"}${a.note?` · ${esc(a.note)}`:""}</div></div><button class="delete-button" data-future-delete="${date}" type="button">×</button></div>`).join(""):'<div class="empty-state">No future dates assigned yet.</div>';
  future.querySelectorAll("[data-future-delete]").forEach(btn=>btn.addEventListener("click",()=>{ delete plannerSettings.futureAssignments[btn.dataset.futureDelete]; renderScheduleSettings(); queueSave(); }));
}

function openClassScheduleEditor() {
  const dialog=$("itemDialog"), fields=$("dialogFields"), form=$("itemDialogForm");
  $("dialogTitle").textContent="Edit A–E class times";
  fields.innerHTML=`<div class="schedule-editor">${["A","B","C","D","E"].map(letter=>`<section class="schedule-editor-day" data-letter="${letter}"><h3>${letter} Day</h3><div class="schedule-entry-list">${(plannerSettings.classSchedule[letter]||[]).map(c=>scheduleEntryHTML(c)).join("")}</div><button class="mini-button add-schedule-entry" type="button">+ Add class</button></section>`).join("")}</div>`;
  fields.querySelectorAll(".add-schedule-entry").forEach(btn=>btn.addEventListener("click",()=>{ btn.previousElementSibling.insertAdjacentHTML("beforeend",scheduleEntryHTML({time24:"09:00",title:"New class"})); bindScheduleDeleteButtons(fields); }));
  bindScheduleDeleteButtons(fields);
  form.dataset.type="classSchedule";
  form.onsubmit=e=>{
    e.preventDefault();
    const next={};
    fields.querySelectorAll(".schedule-editor-day").forEach(section=>{
      next[section.dataset.letter]=[...section.querySelectorAll(".schedule-entry")].map(row=>({time24:row.querySelector("[data-time]").value,title:row.querySelector("[data-title]").value.trim()})).filter(x=>x.time24&&x.title).sort((a,b)=>a.time24.localeCompare(b.time24));
    });
    plannerSettings.classSchedule=next;
    renderAll(); queueSave(); dialog.close(); showToast("Class times updated.");
  };
  dialog.showModal();
}
function scheduleEntryHTML(c){ return `<div class="schedule-entry"><input data-time type="time" value="${esc(c.time24)}" required><input data-title type="text" value="${esc(c.title)}" required><button class="delete-button remove-schedule-entry" type="button">×</button></div>`; }
function bindScheduleDeleteButtons(root){ root.querySelectorAll(".remove-schedule-entry").forEach(btn=>btn.onclick=()=>btn.closest(".schedule-entry").remove()); }

function openFutureAssignmentDialog() {
  const dialog=$("itemDialog"), fields=$("dialogFields"), form=$("itemDialogForm");
  $("dialogTitle").textContent="Assign a future date";
  fields.innerHTML=`<div class="field-stack"><label>Date<input id="futureDate" type="date" min="${todayKey}" required></label><label>Letter day<select id="futureLetter"><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option><option>No School</option></select></label><fieldset><legend>Daycare day?</legend><div class="segmented"><label><input type="radio" name="futureDaycare" value="yes"><span>Yes</span></label><label><input type="radio" name="futureDaycare" value="no" checked><span>No</span></label></div></fieldset><label class="toggle"><input id="futureOverride" type="checkbox" checked><span></span>Override any normal pattern for this date</label><label class="override-note">Optional note<input id="futureNote" type="text" placeholder="Assembly, holiday, changed daycare…"></label></div>`;
  form.dataset.type="futureAssignment";
  form.onsubmit=e=>{ e.preventDefault(); const date=$("futureDate").value; plannerSettings.futureAssignments[date]={letterDay:$("futureLetter").value,daycare:document.querySelector('input[name="futureDaycare"]:checked').value,override:$("futureOverride").checked,note:$("futureNote").value.trim()}; renderScheduleSettings(); queueSave(); dialog.close(); showToast("Future date assigned."); };
  dialog.showModal();
}

function openDialog(type) {
  const dialog=$("itemDialog"), fields=$("dialogFields"), form=$("itemDialogForm");
  const configs={
    appointment:{title:"Add appointment",html:fieldHTML("Title","text","itemTitle")+fieldHTML("Time","time","itemTime","09:00")},
    todayTask:{title:"Add task for today",html:fieldHTML("Task","text","itemTitle")+fieldHTML("Time","time","itemTime","12:00")},
    workTask:{title:"Add weekly work task",html:fieldHTML("Task","text","itemTitle")},
    homeTask:{title:"Add weekly home task",html:fieldHTML("Task","text","itemTitle")},
    goal:{title:"Add daily number goal",html:fieldHTML("Goal name","text","itemTitle")+fieldHTML("Target number","number","itemNumber","1")},
    lastTime:{title:"Add “last time” item",html:fieldHTML("Item","text","itemTitle")+fieldHTML("Green through how many days?","number","greenDays","3")+fieldHTML("Yellow through how many days?","number","yellowDays","5")+'<p class="help-text">After the yellow limit, the item turns red and moves toward the top.</p>'}
  };
  $("dialogTitle").textContent=configs[type].title; fields.innerHTML=`<div class="field-stack">${configs[type].html}</div>`; form.dataset.type=type;
  form.onsubmit=e=>{e.preventDefault();saveDialog(type);dialog.close();}; dialog.showModal(); setTimeout(()=>fields.querySelector("input")?.focus(),50);
}
function fieldHTML(label,type,id,value="") { return `<label>${label}<input id="${id}" type="${type}" value="${value}" ${type==="number"?'min="1"':''} required></label>`; }
function saveDialog(type) {
  const title=$("itemTitle")?.value.trim(); if(!title) return;
  if(type==="appointment"||type==="todayTask") dayData.customItems.push({id:uid(),title,time24:$("itemTime").value,type:type==="appointment"?"Appointment":"Added task"});
  if(type==="workTask") weekData.workTasks.push({id:uid(),name:title,status:"planned"});
  if(type==="homeTask") weekData.homeTasks.push({id:uid(),name:title,status:"planned"});
  if(type==="goal") dayData.goals.push({id:uid(),name:title,goal:Number($("itemNumber").value),count:0});
  if(type==="lastTime") dayData.lastTime.push({id:uid(),name:title,greenDays:Number($("greenDays").value),yellowDays:Number($("yellowDays").value),lastDone:null});
  renderAll(); queueSave();
}
