import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, documentId, startAt, endAt } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

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

const SCHEDULE_BY_LETTER_DAY = {
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
let saveTimer = null;
let selectedDateKey = localDateKey(new Date());
let selectedWeekKey = getISOWeekKey(new Date());
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calendarData = new Map();
let eventsBound = false;
const $ = (id) => document.getElementById(id);

function localDateKey(date) {
  const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,"0"), d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function dateFromKey(key) { return new Date(`${key}T12:00:00`); }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function getISOWeekKey(date) {
  const copy=new Date(date); copy.setHours(0,0,0,0); copy.setDate(copy.getDate()+3-((copy.getDay()+6)%7));
  const week1=new Date(copy.getFullYear(),0,4);
  const week=1+Math.round(((copy-week1)/86400000-3+((week1.getDay()+6)%7))/7);
  return `${copy.getFullYear()}-W${String(week).padStart(2,"0")}`;
}
function dayDoc(dateKey=selectedDateKey) { return doc(db,"plannerDashboardUsers",user.uid,"days",dateKey); }
function weekDoc(weekKey=selectedWeekKey) { return doc(db,"plannerDashboardUsers",user.uid,"weeks",weekKey); }
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
      setDoc(dayDoc(), {...dayData, date:selectedDateKey, updatedAt:serverTimestamp()}, {merge:true}),
      setDoc(weekDoc(), {...weekData, week:selectedWeekKey, updatedAt:serverTimestamp()}, {merge:true}),
      setDoc(profileDoc(), {email:user.email, parkingLot:dayData.parkingLot || "", lastOpenedDay:selectedDateKey, updatedAt:serverTimestamp()}, {merge:true})
    ]);
    calendarData.set(selectedDateKey, structuredCloneSafe(dayData));
    markSaved();
  } catch(err) {
    console.error(err);
    $("saveStatus").textContent="Save failed";
    showToast("Could not save. Check your connection.");
  }
}
function structuredCloneSafe(value) { return JSON.parse(JSON.stringify(value)); }

onAuthStateChanged(auth, async currentUser => {
  if(!currentUser) { location.replace("../login.html?redirect=plannerDashboard/dashboard.html"); return; }
  if(!ALLOWED_EMAILS.has((currentUser.email||"").toLowerCase())) {
    await signOut(auth);
    location.replace("../login.html?reason=unauthorized");
    return;
  }
  user=currentUser;
  await loadSelectedDate(selectedDateKey);
  setupUI();
  $("loadingScreen").classList.add("done");
});

function defaultDayData(profileParking="") {
  return {
    date:selectedDateKey,
    context:null,
    completed:{},
    customItems:[],
    goals:DEFAULT_GOALS.map(g=>({...g,id:uid(),count:0})),
    lastTime:DEFAULT_LAST_TIME.map(i=>({...i,id:uid(),lastDone:null})),
    parkingLot:profileParking,
    ui:{hideChecked:false,hideCompletedGoals:false,collapsed:{}}
  };
}

async function loadSelectedDate(dateKey) {
  selectedDateKey=dateKey;
  selectedWeekKey=getISOWeekKey(dateFromKey(dateKey));
  const [daySnap,weekSnap,profileSnap] = await Promise.all([getDoc(dayDoc()),getDoc(weekDoc()),getDoc(profileDoc())]);
  dayData = daySnap.exists() ? daySnap.data() : defaultDayData(profileSnap.exists() ? profileSnap.data().parkingLot || "" : "");
  weekData = weekSnap.exists() ? weekSnap.data() : {week:selectedWeekKey,workTasks:[],homeTasks:DEFAULT_HOME_TASKS.map(name=>({id:uid(),name,status:"planned"}))};
  dayData.completed ||= {};
  dayData.customItems ||= [];
  dayData.goals ||= [];
  dayData.lastTime ||= [];
  dayData.ui ||= {hideChecked:false,hideCompletedGoals:false,collapsed:{}};
  dayData.ui.collapsed ||= {};
  updateSelectedDateUI();
}

function updateSelectedDateUI() {
  const date=dateFromKey(selectedDateKey);
  $("todayLabel").textContent = date.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const quote=QUOTES[date.getDate()%QUOTES.length];
  $("dailyQuote").innerHTML=`“${quote[0]}”<cite>${quote[1]}</cite>`;
}

function setupUI() {
  populateDailyControls();
  if(dayData.context) showDashboard(); else { $("contextCard").classList.remove("hidden"); $("dashboardContent").classList.add("hidden"); }
  restoreCollapsed();
  if(!eventsBound) bindEvents();
  renderAll();
}

function populateDailyControls() {
  const weekday=dateFromKey(selectedDateKey).toLocaleDateString("en-US",{weekday:"long"});
  $("dayOfWeek").value=dayData.context?.dayOfWeek || weekday;
  $("letterDay").value=dayData.context?.letterDay || "No School";
  document.querySelector(`input[name="daycare"][value="${dayData.context?.daycare || "no"}"]`).checked=true;
  $("parkingLot").value=dayData.parkingLot || "";
  $("hideCheckedTasks").checked=!!dayData.ui.hideChecked;
  $("hideCompletedGoals").checked=!!dayData.ui.hideCompletedGoals;
}

function bindEvents() {
  eventsBound=true;
  $("contextForm").addEventListener("submit", e=>{
    e.preventDefault();
    dayData.context={dayOfWeek:$("dayOfWeek").value,letterDay:$("letterDay").value,daycare:document.querySelector('input[name="daycare"]:checked').value};
    showDashboard(); renderTimeline(); queueSave();
  });
  $("editContextBtn").addEventListener("click",()=>{ switchView("daily"); $("contextCard").classList.remove("hidden"); $("contextCard").scrollIntoView({behavior:"smooth"}); });
  $("signOutBtn").addEventListener("click",async()=>{ await signOut(auth); });
  $("parkingLot").addEventListener("input",e=>{ dayData.parkingLot=e.target.value; queueSave(); });
  $("hideCheckedTasks").addEventListener("change",e=>{ dayData.ui.hideChecked=e.target.checked; renderTimeline(); queueSave(); });
  $("hideCompletedGoals").addEventListener("change",e=>{ dayData.ui.hideCompletedGoals=e.target.checked; renderGoals(); queueSave(); });
  document.querySelectorAll(".collapse-trigger").forEach(btn=>btn.addEventListener("click",()=>{
    const card=btn.closest(".collapsible-card"), key=card.dataset.card;
    card.classList.toggle("collapsed");
    btn.setAttribute("aria-expanded",String(!card.classList.contains("collapsed")));
    dayData.ui.collapsed[key]=card.classList.contains("collapsed");
    queueSave();
  }));
  document.querySelectorAll(".mini-hide").forEach(btn=>btn.addEventListener("click",()=>{
    const el=$(btn.dataset.target); el.classList.toggle("hidden"); btn.textContent=el.classList.contains("hidden")?"Show":"Hide";
  }));
  $("addAppointmentBtn").addEventListener("click",()=>openDialog("appointment"));
  $("addTodayTaskBtn").addEventListener("click",()=>openDialog("todayTask"));
  $("addWorkTaskBtn").addEventListener("click",()=>openDialog("workTask"));
  $("addHomeTaskBtn").addEventListener("click",()=>openDialog("homeTask"));
  $("addGoalBtn").addEventListener("click",()=>openDialog("goal"));
  $("addLastTimeBtn").addEventListener("click",()=>openDialog("lastTime"));
  $("dialogClose").addEventListener("click",()=>$("itemDialog").close());
  $("dialogCancel").addEventListener("click",()=>$("itemDialog").close());
  $("dailyViewBtn").addEventListener("click",()=>switchView("daily"));
  $("calendarViewBtn").addEventListener("click",()=>switchView("calendar"));
  $("previousMonthBtn").addEventListener("click",()=>changeCalendarMonth(-1));
  $("nextMonthBtn").addEventListener("click",()=>changeCalendarMonth(1));
  $("todayMonthBtn").addEventListener("click",()=>{ const now=new Date(); calendarCursor=new Date(now.getFullYear(),now.getMonth(),1); renderCalendar(); });
}

function restoreCollapsed() {
  document.querySelectorAll(".collapsible-card").forEach(card=>{
    card.classList.toggle("collapsed",!!dayData.ui.collapsed[card.dataset.card]);
    card.querySelector(".collapse-trigger").setAttribute("aria-expanded",String(!card.classList.contains("collapsed")));
  });
}
function showDashboard() { $("contextCard").classList.add("hidden"); $("dashboardContent").classList.remove("hidden"); }
function renderAll() { renderTimeline(); renderWeekly(); renderGoals(); renderLastTime(); }

async function switchView(view) {
  const calendar=view==="calendar";
  $("dailyView").classList.toggle("hidden",calendar);
  $("calendarView").classList.toggle("hidden",!calendar);
  $("dailyViewBtn").classList.toggle("active",!calendar);
  $("calendarViewBtn").classList.toggle("active",calendar);
  if(calendar) {
    clearTimeout(saveTimer);
    await saveAll();
    calendarCursor=new Date(dateFromKey(selectedDateKey).getFullYear(),dateFromKey(selectedDateKey).getMonth(),1);
    await renderCalendar();
  }
}

async function changeCalendarMonth(delta) {
  calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+delta,1);
  await renderCalendar();
}

async function fetchCalendarMonth() {
  const y=calendarCursor.getFullYear(), m=calendarCursor.getMonth();
  const firstKey=localDateKey(new Date(y,m,1));
  const lastKey=localDateKey(new Date(y,m+1,0));
  const q=query(collection(db,"plannerDashboardUsers",user.uid,"days"),orderBy(documentId()),startAt(firstKey),endAt(lastKey));
  const snap=await getDocs(q);
  calendarData=new Map();
  snap.forEach(d=>calendarData.set(d.id,d.data()));
  if(dayData && selectedDateKey>=firstKey && selectedDateKey<=lastKey) calendarData.set(selectedDateKey,structuredCloneSafe(dayData));
}

async function renderCalendar() {
  $("calendarGrid").innerHTML='<div class="empty-state" style="grid-column:1/-1">Loading calendar…</div>';
  try { await fetchCalendarMonth(); } catch(err) { console.error(err); showToast("Calendar could not load."); }
  const y=calendarCursor.getFullYear(), m=calendarCursor.getMonth();
  $("calendarMonthLabel").textContent=calendarCursor.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const first=new Date(y,m,1);
  const gridStart=new Date(y,m,1-first.getDay());
  const today=localDateKey(new Date());
  let html="";
  for(let i=0;i<42;i++) {
    const date=new Date(gridStart); date.setDate(gridStart.getDate()+i);
    const key=localDateKey(date), data=calendarData.get(key), context=data?.context;
    const custom=(data?.customItems||[]).sort((a,b)=>(a.time24||"").localeCompare(b.time24||""));
    const previews=custom.slice(0,2).map(item=>`<div class="calendar-event ${item.type==="Appointment"?"appointment":""}">${item.time24?formatTime(item.time24)+" ":""}${esc(item.title)}</div>`).join("");
    const more=custom.length>2?`<div class="calendar-more">+${custom.length-2} more</div>`:"";
    const markers=`${custom.some(i=>i.type==="Appointment")?'<i class="calendar-marker appointment"></i>':''}${context?.daycare==="yes"?'<i class="calendar-marker daycare"></i>':''}`;
    html+=`<button class="calendar-day ${date.getMonth()!==m?"outside-month":""} ${key===today?"today":""} ${key===selectedDateKey?"selected":""}" data-calendar-date="${key}" type="button" aria-label="Open ${date.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}">
      <span class="calendar-date-row"><span class="calendar-number">${date.getDate()}</span>${context?.letterDay && context.letterDay!=="No School"?`<span class="letter-badge">${esc(context.letterDay)}</span>`:""}</span>
      <span class="calendar-preview">${previews}${more}</span>
      <span class="calendar-markers">${markers}</span>
    </button>`;
  }
  $("calendarGrid").innerHTML=html;
  $("calendarGrid").querySelectorAll("[data-calendar-date]").forEach(btn=>btn.addEventListener("click",()=>openCalendarDate(btn.dataset.calendarDate)));
}

async function openCalendarDate(dateKey) {
  clearTimeout(saveTimer);
  await saveAll();
  await loadSelectedDate(dateKey);
  populateDailyControls();
  restoreCollapsed();
  if(dayData.context) showDashboard(); else { $("contextCard").classList.remove("hidden"); $("dashboardContent").classList.add("hidden"); }
  renderAll();
  switchView("daily");
  window.scrollTo({top:0,behavior:"smooth"});
}

function buildTimelineItems() {
  const c=dayData.context; if(!c) return [];
  const items=[]; const add=(time24,title,type,key,custom=false)=>items.push({time24,title,type,key,custom});
  AM_DAILY.forEach((t,i)=>add("06:00",t,"AM routine",`am-${i}`));
  const schoolWeek=["Monday","Tuesday","Wednesday","Thursday","Friday"].includes(c.dayOfWeek);
  if(schoolWeek) SCHOOL_AM.forEach((t,i)=>add("06:00",t,"School morning",`school-am-${i}`));
  if(c.daycare==="yes") DAYCARE_AM.forEach((t,i)=>add("06:00",t,"Daycare morning",`daycare-${i}`));
  if(c.letterDay!=="No School") {
    WORK_OPEN.forEach((t,i)=>add("09:00",t,"Work arrive",`open-${i}`));
    (SCHEDULE_BY_LETTER_DAY[c.letterDay]||[]).forEach((s,i)=>add(s.time24,s.title,`${c.letterDay} Day class`,`class-${c.letterDay}-${i}`));
    const schedule=SCHEDULE_BY_LETTER_DAY[c.letterDay]||[], last=schedule[schedule.length-1], closeTime=last ? addMinutes(last.time24,45) : "15:20";
    WORK_CLOSE.forEach((t,i)=>add(closeTime,t,"Work close",`close-${i}`));
  }
  PM_DAILY.forEach((t,i)=>add("20:00",t,"PM routine",`pm-${i}`));
  dayData.customItems.forEach(item=>add(item.time24,item.title,item.type,item.id,true));
  return items.sort((a,b)=>a.time24.localeCompare(b.time24) || a.type.localeCompare(b.type));
}
function addMinutes(time,mins) { const [h,m]=time.split(":").map(Number), total=h*60+m+mins; return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; }
function periodFor(time) { const h=Number(time.split(":")[0]); return h<10?"AM":h<17?"Midday":"PM"; }
function renderTimeline() {
  if(!dayData.context) { $("timeline").innerHTML=""; return; }
  const items=buildTimelineItems(), groups={AM:[],Midday:[],PM:[]}; items.forEach(i=>groups[periodFor(i.time24)].push(i));
  let html="";
  Object.entries(groups).forEach(([period,list])=>{
    html+=`<div class="period-heading">${period}</div>`;
    if(period==="Midday" && dayData.context.letterDay!=="No School") html+=`<div class="arrive-divider">Work arrive • open the LRC and begin the school-day flow</div>`;
    if(!list.length) html+=`<div class="empty-state">No ${period.toLowerCase()} items today.</div>`;
    list.forEach(item=>{
      const done=!!dayData.completed[item.key]; if(dayData.ui.hideChecked && done) return;
      html+=`<div class="timeline-item ${done?"done":""}" data-key="${esc(item.key)}"><span class="timeline-time">${formatTime(item.time24)}</span><button class="check-button" type="button" aria-label="Toggle ${esc(item.title)}">${done?"✓":""}</button><div><div class="timeline-title">${esc(item.title)}</div><div class="timeline-type">${esc(item.type)}</div></div>${item.custom?`<button class="delete-button" data-delete-custom="${esc(item.key)}" type="button" aria-label="Delete">×</button>`:"<span></span>"}</div>`;
    });
  });
  $("timeline").innerHTML=html;
  $("timeline").querySelectorAll(".check-button").forEach(btn=>btn.addEventListener("click",()=>{ const key=btn.closest(".timeline-item").dataset.key; dayData.completed[key]=!dayData.completed[key]; renderTimeline(); queueSave(); }));
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
  $("goalList").querySelectorAll("[data-goal-plus]").forEach(btn=>btn.addEventListener("click",()=>changeGoal(btn.dataset.goalPlus,1)));
  $("goalList").querySelectorAll("[data-goal-minus]").forEach(btn=>btn.addEventListener("click",()=>changeGoal(btn.dataset.goalMinus,-1)));
  $("goalList").querySelectorAll("[data-goal-delete]").forEach(btn=>btn.addEventListener("click",()=>{dayData.goals=dayData.goals.filter(g=>g.id!==btn.dataset.goalDelete);renderGoals();queueSave();}));
}
function changeGoal(id,delta) { const g=dayData.goals.find(x=>x.id===id); if(g) g.count=Math.max(0,g.count+delta); renderGoals(); queueSave(); }

function urgency(item) {
  if(!item.lastDone) return {level:"red",text:"Not recorded yet",days:99999};
  const days=Math.floor((dateFromKey(selectedDateKey)-dateFromKey(item.lastDone))/86400000);
  if(days<=item.greenDays) return {level:"green",text:days===0?"Done today":`${days} day${days===1?"":"s"} ago`,days};
  if(days<=item.yellowDays) return {level:"yellow",text:`${days} days ago • due soon`,days};
  return {level:"red",text:`${days} days ago • overdue`,days};
}
function renderLastTime() {
  const sorted=[...dayData.lastTime].sort((a,b)=>urgency(b).days-urgency(a).days);
  $("lastTimeList").innerHTML=sorted.length?sorted.map(i=>{const u=urgency(i);return `<div class="last-time-row"><span class="urgency-dot urgency-${u.level}"></span><div><div class="goal-name">${esc(i.name)}</div><div class="last-meta">${u.text} • Green ${i.greenDays}d, yellow through ${i.yellowDays}d</div></div><button class="just-did" data-just-did="${i.id}" type="button">Just did it</button><button class="delete-button" data-last-delete="${i.id}" type="button">×</button></div>`}).join(""):'<div class="empty-state">Add a recurring item to track it here.</div>';
  $("lastTimeList").querySelectorAll("[data-just-did]").forEach(btn=>btn.addEventListener("click",()=>{const i=dayData.lastTime.find(x=>x.id===btn.dataset.justDid);if(i)i.lastDone=selectedDateKey;renderLastTime();queueSave();showToast("Marked as done on this date.");}));
  $("lastTimeList").querySelectorAll("[data-last-delete]").forEach(btn=>btn.addEventListener("click",()=>{dayData.lastTime=dayData.lastTime.filter(i=>i.id!==btn.dataset.lastDelete);renderLastTime();queueSave();}));
}

function openDialog(type) {
  const dialog=$("itemDialog"), fields=$("dialogFields"), form=$("itemDialogForm");
  const configs={
    appointment:{title:"Add appointment",html:fieldHTML("Title","text","itemTitle")+fieldHTML("Time","time","itemTime","09:00")},
    todayTask:{title:"Add task for this day",html:fieldHTML("Task","text","itemTitle")+fieldHTML("Time","time","itemTime","12:00")},
    workTask:{title:"Add weekly work task",html:fieldHTML("Task","text","itemTitle")},
    homeTask:{title:"Add weekly home task",html:fieldHTML("Task","text","itemTitle")},
    goal:{title:"Add daily number goal",html:fieldHTML("Goal name","text","itemTitle")+fieldHTML("Target number","number","itemNumber","1")},
    lastTime:{title:"Add “last time” item",html:fieldHTML("Item","text","itemTitle")+fieldHTML("Green through how many days?","number","greenDays","3")+fieldHTML("Yellow through how many days?","number","yellowDays","5")+'<p class="help-text">After the yellow limit, the item turns red and moves toward the top.</p>'}
  };
  $("dialogTitle").textContent=configs[type].title;
  fields.innerHTML=`<div class="field-stack">${configs[type].html}</div>`;
  form.dataset.type=type;
  form.onsubmit=e=>{e.preventDefault();saveDialog(type);dialog.close();};
  dialog.showModal(); setTimeout(()=>fields.querySelector("input")?.focus(),50);
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
