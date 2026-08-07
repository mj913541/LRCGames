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

const SCHEDULE_BY_LETTER_DAY = {
  A: [
    {time24:"09:05",end24:"09:50",title:"4th • Isibindi"},
    {time24:"10:05",end24:"10:50",title:"2nd • Schmidt"},
    {time24:"11:05",end24:"11:50",title:"5th • Szwaya"},
    {time24:"12:45",end24:"13:15",title:"K • Stukel"},
    {time24:"13:45",end24:"14:30",title:"3rd • Carroll"},
    {time24:"14:45",end24:"15:30",title:"1st • Wilson"}
  ],
  B: [
    {time24:"09:05",end24:"09:50",title:"4th • Reveur"},
    {time24:"10:05",end24:"10:50",title:"2nd • Peterson"},
    {time24:"11:05",end24:"11:50",title:"5th • Basic"},
    {time24:"12:40",end24:"13:10",title:"3 PHH"},
    {time24:"13:10",end24:"13:40",title:"1 PHH"},
    {time24:"13:45",end24:"14:30",title:"3rd • Cocco"},
    {time24:"15:05",end24:"15:30",title:"K PHH"}
  ],
  C: [
    {time24:"09:05",end24:"09:50",title:"4th • Altruismo"},
    {time24:"12:45",end24:"13:15",title:"K • Mederich"},
    {time24:"13:45",end24:"14:15",title:"4 PHH"},
    {time24:"15:05",end24:"15:30",title:"K PHH"}
  ],
  D: [
    {time24:"09:05",end24:"09:50",title:"4th • Amistad"},
    {time24:"10:05",end24:"10:50",title:"2nd • Adams"},
    {time24:"12:05",end24:"12:35",title:"5 PHH • Isibindi House"},
    {time24:"12:40",end24:"13:10",title:"3 PHH"},
    {time24:"13:10",end24:"13:40",title:"1 PHH"},
    {time24:"13:45",end24:"14:30",title:"3rd • Hossain"},
    {time24:"14:45",end24:"15:30",title:"1st • Day"}
  ],
  E: [
    {time24:"09:35",end24:"10:05",title:"2 PHH"},
    {time24:"12:05",end24:"12:35",title:"5 PHH"},
    {time24:"12:45",end24:"13:15",title:"K • Johnson"},
    {time24:"13:45",end24:"14:15",title:"4 PHH"},
    {time24:"14:45",end24:"15:30",title:"1st • Rogers"}
  ]
};
const SCHOOL_YEAR_2026_27 = {
  "2026-07-27":"No School",
  "2026-07-28":"No School",
  "2026-07-29":"No School",
  "2026-07-30":"No School",
  "2026-07-31":"No School",
  "2026-08-03":"No School",
  "2026-08-04":"No School",
  "2026-08-05":"No School",
  "2026-08-06":"No School",
  "2026-08-07":"No School",
  "2026-08-10":"SIP",
  "2026-08-11":"SIP",
  "2026-08-12":"SIP",
  "2026-08-13":"SIP",
  "2026-08-14":"SIP",
  "2026-08-17":"SIP",
  "2026-08-18":"SIP",
  "2026-08-19":"SIP",
  "2026-08-20":"A",
  "2026-08-21":"B",
  "2026-08-24":"C",
  "2026-08-25":"D",
  "2026-08-26":"E",
  "2026-08-27":"A",
  "2026-08-28":"B",
  "2026-08-31":"C",
  "2026-09-01":"D",
  "2026-09-02":"E",
  "2026-09-03":"A",
  "2026-09-04":"B",
  "2026-09-07":"No School",
  "2026-09-08":"C",
  "2026-09-09":"D",
  "2026-09-10":"E",
  "2026-09-11":"A",
  "2026-09-14":"B",
  "2026-09-15":"C",
  "2026-09-16":"D",
  "2026-09-17":"E",
  "2026-09-18":"A",
  "2026-09-21":"B",
  "2026-09-22":"C",
  "2026-09-23":"D",
  "2026-09-24":"E",
  "2026-09-25":"A",
  "2026-09-28":"B",
  "2026-09-29":"C",
  "2026-09-30":"D",
  "2026-10-01":"E",
  "2026-10-02":"A",
  "2026-10-05":"B",
  "2026-10-06":"C",
  "2026-10-07":"D",
  "2026-10-08":"E",
  "2026-10-09":"SIP",
  "2026-10-12":"No School",
  "2026-10-13":"A",
  "2026-10-14":"B",
  "2026-10-15":"C",
  "2026-10-16":"D",
  "2026-10-19":"E",
  "2026-10-20":"A",
  "2026-10-21":"B",
  "2026-10-22":"C",
  "2026-10-23":"D",
  "2026-10-26":"E",
  "2026-10-27":"A",
  "2026-10-28":"B",
  "2026-10-29":"C",
  "2026-10-30":"D",
  "2026-11-02":"SIP",
  "2026-11-03":"No School",
  "2026-11-04":"E",
  "2026-11-05":"A",
  "2026-11-06":"B",
  "2026-11-09":"C",
  "2026-11-10":"D",
  "2026-11-11":"E",
  "2026-11-12":"A",
  "2026-11-13":"B",
  "2026-11-16":"C",
  "2026-11-17":"D",
  "2026-11-18":"E",
  "2026-11-19":"A",
  "2026-11-20":"SIP",
  "2026-11-23":"No School",
  "2026-11-24":"No School",
  "2026-11-25":"No School",
  "2026-11-26":"No School",
  "2026-11-27":"No School",
  "2026-11-30":"B",
  "2026-12-01":"C",
  "2026-12-02":"D",
  "2026-12-03":"E",
  "2026-12-04":"A",
  "2026-12-07":"B",
  "2026-12-08":"C",
  "2026-12-09":"D",
  "2026-12-10":"E",
  "2026-12-11":"A",
  "2026-12-14":"B",
  "2026-12-15":"C",
  "2026-12-16":"D",
  "2026-12-17":"E",
  "2026-12-18":"A",
  "2026-12-21":"No School",
  "2026-12-22":"No School",
  "2026-12-23":"No School",
  "2026-12-24":"No School",
  "2026-12-25":"No School",
  "2026-12-28":"No School",
  "2026-12-29":"No School",
  "2026-12-30":"No School",
  "2026-12-31":"No School",
  "2027-01-01":"No School",
  "2027-01-04":"SIP",
  "2027-01-05":"B",
  "2027-01-06":"C",
  "2027-01-07":"D",
  "2027-01-08":"E",
  "2027-01-11":"A",
  "2027-01-12":"B",
  "2027-01-13":"C",
  "2027-01-14":"D",
  "2027-01-15":"E",
  "2027-01-18":"No School",
  "2027-01-19":"A",
  "2027-01-20":"B",
  "2027-01-21":"C",
  "2027-01-22":"D",
  "2027-01-25":"E",
  "2027-01-26":"A",
  "2027-01-27":"B",
  "2027-01-28":"C",
  "2027-01-29":"D",
  "2027-02-01":"E",
  "2027-02-02":"A",
  "2027-02-03":"B",
  "2027-02-04":"C",
  "2027-02-05":"D",
  "2027-02-08":"E",
  "2027-02-09":"A",
  "2027-02-10":"B",
  "2027-02-11":"C",
  "2027-02-12":"D",
  "2027-02-15":"No School",
  "2027-02-16":"E",
  "2027-02-17":"A",
  "2027-02-18":"B",
  "2027-02-19":"C",
  "2027-02-22":"D",
  "2027-02-23":"E",
  "2027-02-24":"A",
  "2027-02-25":"B",
  "2027-02-26":"SIP",
  "2027-03-01":"C",
  "2027-03-02":"D",
  "2027-03-03":"E",
  "2027-03-04":"A",
  "2027-03-05":"B",
  "2027-03-08":"C",
  "2027-03-09":"D",
  "2027-03-10":"E",
  "2027-03-11":"A",
  "2027-03-12":"B",
  "2027-03-15":"C",
  "2027-03-16":"D",
  "2027-03-17":"E",
  "2027-03-18":"A",
  "2027-03-19":"B",
  "2027-03-22":"No School",
  "2027-03-23":"No School",
  "2027-03-24":"No School",
  "2027-03-25":"No School",
  "2027-03-26":"No School",
  "2027-03-29":"No School",
  "2027-03-30":"C",
  "2027-03-31":"D",
  "2027-04-01":"E",
  "2027-04-02":"A",
  "2027-04-05":"B",
  "2027-04-06":"SIP",
  "2027-04-07":"C",
  "2027-04-08":"D",
  "2027-04-09":"E",
  "2027-04-12":"A",
  "2027-04-13":"B",
  "2027-04-14":"C",
  "2027-04-15":"D",
  "2027-04-16":"E",
  "2027-04-19":"A",
  "2027-04-20":"B",
  "2027-04-21":"C",
  "2027-04-22":"D",
  "2027-04-23":"E",
  "2027-04-26":"A",
  "2027-04-27":"B",
  "2027-04-28":"C",
  "2027-04-29":"D",
  "2027-04-30":"E",
  "2027-05-03":"A",
  "2027-05-04":"B",
  "2027-05-05":"C",
  "2027-05-06":"D",
  "2027-05-07":"E",
  "2027-05-10":"A",
  "2027-05-11":"B",
  "2027-05-12":"C",
  "2027-05-13":"D",
  "2027-05-14":"E",
  "2027-05-17":"A",
  "2027-05-18":"B",
  "2027-05-19":"C",
  "2027-05-20":"D",
  "2027-05-21":"E",
  "2027-05-24":"A",
  "2027-05-25":"B",
  "2027-05-26":"C",
  "2027-05-27":"D",
  "2027-05-28":"E",
  "2027-05-31":"No School",
  "2027-06-01":"No School",
  "2027-06-02":"No School",
  "2027-06-03":"No School",
  "2027-06-04":"No School",
  "2027-06-07":"No School",
  "2027-06-08":"No School",
  "2027-06-09":"No School",
  "2027-06-10":"No School",
  "2027-06-11":"No School",
  "2027-06-14":"No School",
  "2027-06-15":"No School",
  "2027-06-16":"No School",
  "2027-06-17":"No School",
  "2027-06-18":"No School",
  "2027-06-21":"No School",
  "2027-06-22":"No School",
  "2027-06-23":"No School",
  "2027-06-24":"No School",
  "2027-06-25":"No School",
  "2027-06-28":"No School",
  "2027-06-29":"No School",
  "2027-06-30":"No School",
  "2027-07-01":"No School",
  "2027-07-02":"No School",
  "2027-07-05":"No School",
  "2027-07-06":"No School",
  "2027-07-07":"No School",
  "2027-07-08":"No School",
  "2027-07-09":"No School",
  "2027-07-12":"No School",
  "2027-07-13":"No School",
  "2027-07-14":"No School",
  "2027-07-15":"No School",
  "2027-07-16":"No School",
  "2027-07-19":"No School",
  "2027-07-20":"No School",
  "2027-07-21":"No School",
  "2027-07-22":"No School",
  "2027-07-23":"No School",
  "2027-07-26":"No School",
  "2027-07-27":"No School",
  "2027-07-28":"No School",
  "2027-07-29":"No School",
  "2027-07-30":"No School"
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
const todayKey = localDateKey(new Date());
let selectedDateKey = todayKey;
let weekKey = getISOWeekKey(new Date());
let calendarCursor = new Date();
const $ = (id) => document.getElementById(id);

function localDateKey(date) { const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,"0"), d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }

function officialLetterDay(dateKey) { return SCHOOL_YEAR_2026_27[dateKey] || null; }
function defaultContextForDate(dateKey) {
  const d=new Date(dateKey+"T12:00:00");
  const official=officialLetterDay(dateKey);
  return official ? {dayOfWeek:d.toLocaleDateString("en-US",{weekday:"long"}),letterDay:official,daycare:"no",fromMasterSchedule:true} : null;
}
function effectiveContext(dateKey, storedDay=null) { const official=defaultContextForDate(dateKey); return storedDay?.context?.manualOverride ? storedDay.context : (official || storedDay?.context || null); }

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function getISOWeekKey(date) { const copy=new Date(date); copy.setHours(0,0,0,0); copy.setDate(copy.getDate()+3-((copy.getDay()+6)%7)); const week1=new Date(copy.getFullYear(),0,4); const week=1+Math.round(((copy-week1)/86400000-3+((week1.getDay()+6)%7))/7); return `${copy.getFullYear()}-W${String(week).padStart(2,"0")}`; }
function dayDoc(dateKey=selectedDateKey) { return doc(db,"plannerDashboardUsers","mj","days",dateKey); }
function weekDoc(key=weekKey) { return doc(db,"plannerDashboardUsers","mj","weeks",key); }
function profileDoc() { return doc(db,"plannerDashboardUsers","mj"); }
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
      setDoc(profileDoc(), {email:user.email, parkingLot:dayData.parkingLot || "", lastOpenedDay:selectedDateKey, updatedAt:serverTimestamp()}, {merge:true})
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
  const now = new Date(selectedDateKey+"T12:00:00");
  dayData = daySnap.exists() ? daySnap.data() : {
    date:selectedDateKey, context:defaultContextForDate(selectedDateKey), completed:{}, customItems:[], goals:DEFAULT_GOALS.map(g=>({...g,id:uid(),count:0})),
    lastTime:DEFAULT_LAST_TIME.map(i=>({...i,id:uid(),lastDone:null})), parkingLot:profileSnap.exists() ? profileSnap.data().parkingLot || "" : "",
    ui:{hideChecked:false,hideCompletedGoals:false,collapsed:{}}
  };
  weekData = weekSnap.exists() ? weekSnap.data() : {week:weekKey,workTasks:[],homeTasks:DEFAULT_HOME_TASKS.map(name=>({id:uid(),name,status:"planned"}))};
  const officialContext=defaultContextForDate(selectedDateKey); if(officialContext && !dayData.context?.manualOverride) dayData.context=officialContext;
  dayData.completed ||= {}; dayData.customItems ||= []; dayData.goals ||= []; dayData.lastTime ||= []; dayData.ui ||= {hideChecked:false,hideCompletedGoals:false,collapsed:{}}; dayData.ui.collapsed ||= {}; dayData.ui.contextHidden=!!dayData.ui.contextHidden;
  $("todayLabel").textContent = now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const quote=QUOTES[now.getDate()%QUOTES.length]; $("dailyQuote").innerHTML=`“${quote[0]}”<cite>${quote[1]}</cite>`;
}

function setupUI() {
  const weekday=new Date(selectedDateKey+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"});
  $("dayOfWeek").value=dayData.context?.dayOfWeek || weekday;
  $("letterDay").value=dayData.context?.letterDay || "No School";
  document.querySelector(`input[name="daycare"][value="${dayData.context?.daycare || "no"}"]`).checked=true;
  $("parkingLot").value=dayData.parkingLot || "";
  $("hideCheckedTasks").checked=!!dayData.ui.hideChecked;
  $("hideCompletedGoals").checked=!!dayData.ui.hideCompletedGoals;
  if(dayData.context) showDashboard(); else $("contextCard").classList.remove("hidden");
  $("contextCard").classList.toggle("hidden",!!dayData.ui.contextHidden);
  restoreCollapsed(); bindEvents(); bindPlannerViews(); renderAll(); renderPlannerViews();
}

function bindEvents() {
  $("contextForm").addEventListener("submit", e=>{ e.preventDefault(); dayData.context={dayOfWeek:$("dayOfWeek").value,letterDay:$("letterDay").value,daycare:document.querySelector('input[name="daycare"]:checked').value,manualOverride:true}; showDashboard(); renderTimeline(); renderDailyPage(); queueSave(); });
  $("editContextBtn").addEventListener("click",()=>{ dayData.ui.contextHidden=false; $("contextCard").classList.remove("hidden"); $("contextCard").scrollIntoView({behavior:"smooth"}); queueSave(); });
  $("hideContextBtn")?.addEventListener("click",()=>{ dayData.ui.contextHidden=true; $("contextCard").classList.add("hidden"); queueSave(); });
  $("signOutBtn").addEventListener("click",async()=>{ await signOut(auth); });
  $("parkingLot").addEventListener("input",e=>{ dayData.parkingLot=e.target.value; queueSave(); });
  $("hideCheckedTasks").addEventListener("change",e=>{ dayData.ui.hideChecked=e.target.checked; renderTimeline(); queueSave(); });
  $("hideCompletedGoals").addEventListener("change",e=>{ dayData.ui.hideCompletedGoals=e.target.checked; renderGoals(); queueSave(); });
  document.querySelectorAll(".collapse-trigger").forEach(btn=>btn.addEventListener("click",()=>{ const card=btn.closest(".collapsible-card"), key=card.dataset.card; card.classList.toggle("collapsed"); btn.setAttribute("aria-expanded",String(!card.classList.contains("collapsed"))); dayData.ui.collapsed[key]=card.classList.contains("collapsed"); queueSave(); }));
  document.querySelectorAll(".mini-hide").forEach(btn=>btn.addEventListener("click",()=>{ const el=$(btn.dataset.target); el.classList.toggle("hidden"); btn.textContent=el.classList.contains("hidden")?"Show":"Hide"; }));
  $("addAppointmentBtn").addEventListener("click",()=>openDialog("appointment")); $("addTodayTaskBtn").addEventListener("click",()=>openDialog("todayTask"));
  $("addWorkTaskBtn").addEventListener("click",()=>openDialog("workTask")); $("addHomeTaskBtn").addEventListener("click",()=>openDialog("homeTask"));
  $("addGoalBtn").addEventListener("click",()=>openDialog("goal")); $("addLastTimeBtn").addEventListener("click",()=>openDialog("lastTime"));
  $("dialogClose").addEventListener("click",()=>$("itemDialog").close()); $("dialogCancel").addEventListener("click",()=>$("itemDialog").close());
}
function restoreCollapsed() { document.querySelectorAll(".collapsible-card").forEach(card=>{ if(dayData.ui.collapsed[card.dataset.card]) { card.classList.add("collapsed"); card.querySelector(".collapse-trigger").setAttribute("aria-expanded","false"); } }); }
function showDashboard() { $("contextCard").classList.toggle("hidden",!!dayData?.ui?.contextHidden); $("dashboardContent").classList.remove("hidden"); }
function renderAll() { renderTimeline(); renderWeekly(); renderGoals(); renderLastTime(); renderDailyPage(); }

function buildTimelineItems() {
  const c=dayData.context; if(!c) return [];
  const items=[]; const add=(time24,title,type,key,custom=false)=>items.push({time24,title,type,key,custom});
  AM_DAILY.forEach((t,i)=>add("06:00",t,"AM routine",`am-${i}`));
  const schoolWeek=["Monday","Tuesday","Wednesday","Thursday","Friday"].includes(c.dayOfWeek);
  if(schoolWeek) SCHOOL_AM.forEach((t,i)=>add("06:00",t,"School morning",`school-am-${i}`));
  if(c.daycare==="yes") DAYCARE_AM.forEach((t,i)=>add("06:00",t,"Daycare morning",`daycare-${i}`));
  if(["A","B","C","D","E"].includes(c.letterDay)) {
    WORK_OPEN.forEach((t,i)=>add("09:00",t,"Work arrive",`open-${i}`));
    (SCHEDULE_BY_LETTER_DAY[c.letterDay]||[]).forEach((s,i)=>add(s.time24,s.title,`${c.letterDay} Day class`,`class-${c.letterDay}-${i}`));
    const schedule=SCHEDULE_BY_LETTER_DAY[c.letterDay]||[]; const last=schedule[schedule.length-1]; const closeTime=last ? (last.end24 || addMinutes(last.time24,45)) : "15:20";
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
  const items=buildTimelineItems(); const groups={AM:[],Midday:[],PM:[]}; items.forEach(i=>groups[periodFor(i.time24)].push(i));
  let html="";
  Object.entries(groups).forEach(([period,list])=>{
    html+=`<div class="period-heading">${period}</div>`;
    if(period==="Midday" && ["A","B","C","D","E"].includes(dayData.context.letterDay)) html+=`<div class="arrive-divider">Work arrive • open the LRC and begin the school-day flow</div>`;
    if(!list.length) html+=`<div class="empty-state">No ${period.toLowerCase()} items today.</div>`;
    list.forEach(item=>{ const done=!!dayData.completed[item.key]; if(dayData.ui.hideChecked && done) return; html+=`<div class="timeline-item ${done?"done":""}" data-key="${esc(item.key)}"><span class="timeline-time">${formatTime(item.time24)}</span><button class="check-button" type="button" aria-label="Toggle ${esc(item.title)}">${done?"✓":""}</button><div><div class="timeline-title">${esc(item.title)}</div><div class="timeline-type">${esc(item.type)}</div></div>${item.custom?`<button class="delete-button" data-delete-custom="${esc(item.key)}" type="button" aria-label="Delete">×</button>`:"<span></span>"}</div>`; });
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
  $("goalList").querySelectorAll("[data-goal-plus]").forEach(btn=>btn.addEventListener("click",()=>changeGoal(btn.dataset.goalPlus,1))); $("goalList").querySelectorAll("[data-goal-minus]").forEach(btn=>btn.addEventListener("click",()=>changeGoal(btn.dataset.goalMinus,-1))); $("goalList").querySelectorAll("[data-goal-delete]").forEach(btn=>btn.addEventListener("click",()=>{dayData.goals=dayData.goals.filter(g=>g.id!==btn.dataset.goalDelete);renderGoals();queueSave();}));
}
function changeGoal(id,delta) { const g=dayData.goals.find(x=>x.id===id); if(g) g.count=Math.max(0,g.count+delta); renderGoals(); queueSave(); }

function urgency(item) { if(!item.lastDone) return {level:"red",text:"Not recorded yet",days:99999}; const days=Math.floor((new Date(selectedDateKey+"T12:00:00")-new Date(item.lastDone+"T12:00:00"))/86400000); if(days<=item.greenDays) return {level:"green",text:days===0?"Done today":`${days} day${days===1?"":"s"} ago`,days}; if(days<=item.yellowDays) return {level:"yellow",text:`${days} days ago • due soon`,days}; return {level:"red",text:`${days} days ago • overdue`,days}; }
function renderLastTime() {
  const sorted=[...dayData.lastTime].sort((a,b)=>urgency(b).days-urgency(a).days);
  $("lastTimeList").innerHTML=sorted.length?sorted.map(i=>{const u=urgency(i);return `<div class="last-time-row"><span class="urgency-dot urgency-${u.level}"></span><div><div class="goal-name">${esc(i.name)}</div><div class="last-meta">${u.text} • Green ${i.greenDays}d, yellow through ${i.yellowDays}d</div></div><button class="just-did" data-just-did="${i.id}" type="button">Just did it</button><button class="delete-button" data-last-delete="${i.id}" type="button">×</button></div>`}).join(""):'<div class="empty-state">Add a recurring item to track it here.</div>';
  $("lastTimeList").querySelectorAll("[data-just-did]").forEach(btn=>btn.addEventListener("click",()=>{const i=dayData.lastTime.find(x=>x.id===btn.dataset.justDid);if(i)i.lastDone=selectedDateKey;renderLastTime();queueSave();showToast("Marked as done today.");})); $("lastTimeList").querySelectorAll("[data-last-delete]").forEach(btn=>btn.addEventListener("click",()=>{dayData.lastTime=dayData.lastTime.filter(i=>i.id!==btn.dataset.lastDelete);renderLastTime();queueSave();}));
}


function blankDayData(dateKey, profile={}) {
  return {date:dateKey,context:defaultContextForDate(dateKey),completed:{},customItems:[],goals:DEFAULT_GOALS.map(g=>({...g,id:uid(),count:0})),lastTime:DEFAULT_LAST_TIME.map(i=>({...i,id:uid(),lastDone:null})),parkingLot:profile.parkingLot||"",ui:{hideChecked:false,hideCompletedGoals:false,collapsed:{}}};
}

function bindPlannerViews() {
  document.querySelectorAll(".planner-tab").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));
  document.querySelectorAll(".month-tab").forEach(btn=>btn.addEventListener("click",()=>{
    const [year,month]=btn.dataset.month.split("-").map(Number);
    calendarCursor=new Date(year,month-1,1,12);
    switchView("calendar");
  }));
  $("paperTodayBtn")?.addEventListener("click",()=>openDate(todayKey));
  $("prevMonthBtn")?.addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderMonthCalendar();});
  $("nextMonthBtn")?.addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderMonthCalendar();});
  $("todayMonthBtn")?.addEventListener("click",()=>{calendarCursor=new Date();renderMonthCalendar();});
  $("prevWeekBtn")?.addEventListener("click",()=>shiftWeek(-7));
  $("nextWeekBtn")?.addEventListener("click",()=>shiftWeek(7));
  $("thisWeekBtn")?.addEventListener("click",async()=>{await loadSelectedDate(todayKey,false);renderWeekView();});
  $("prevDayBtn")?.addEventListener("click",()=>shiftSelectedDay(-1));
  $("nextDayBtn")?.addEventListener("click",()=>shiftSelectedDay(1));
  $("todayDayBtn")?.addEventListener("click",()=>openDate(todayKey));
  $("editSelectedDayBtn")?.addEventListener("click",()=>switchView("setup"));
  $("dailyAddAppointmentBtn")?.addEventListener("click",()=>openDialog("appointment"));
}

function switchView(view) {
  document.querySelectorAll(".planner-view").forEach(v=>v.classList.add("hidden"));
  $(view+"View")?.classList.remove("hidden");
  document.querySelectorAll(".planner-tab").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  if(view==="calendar") renderMonthCalendar();
  if(view==="weekly") renderWeekView();
  if(view==="daily") renderDailyPage();
  window.scrollTo({top:0,behavior:"smooth"});
}

async function loadSelectedDate(dateKey, saveCurrent=true) {
  if(saveCurrent && dayData && weekData) await saveAll();
  selectedDateKey=dateKey;
  weekKey=getISOWeekKey(new Date(dateKey+"T12:00:00"));
  const [daySnap,weekSnap,profileSnap]=await Promise.all([getDoc(dayDoc()),getDoc(weekDoc()),getDoc(profileDoc())]);
  const profile=profileSnap.exists()?profileSnap.data():{};
  dayData=daySnap.exists()?daySnap.data():blankDayData(dateKey,profile);
  const official=defaultContextForDate(dateKey); if(official && !dayData.context?.manualOverride) dayData.context=official; else if(!dayData.context) dayData.context=official;
  weekData=weekSnap.exists()?weekSnap.data():{week:weekKey,workTasks:[],homeTasks:DEFAULT_HOME_TASKS.map(name=>({id:uid(),name,status:"planned"}))};
  dayData.completed||={};dayData.customItems||=[];dayData.goals||=[];dayData.lastTime||=[];dayData.ui||={hideChecked:false,hideCompletedGoals:false,collapsed:{}};dayData.ui.collapsed||={}; dayData.ui.contextHidden=!!dayData.ui.contextHidden;
  const d=new Date(dateKey+"T12:00:00");
  $("todayLabel").textContent=d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  $("dayOfWeek").value=dayData.context?.dayOfWeek||d.toLocaleDateString("en-US",{weekday:"long"});
  $("letterDay").value=dayData.context?.letterDay||"No School";
  document.querySelector(`input[name="daycare"][value="${dayData.context?.daycare||"no"}"]`).checked=true;
  $("parkingLot").value=dayData.parkingLot||"";
  $("hideCheckedTasks").checked=!!dayData.ui.hideChecked;$("hideCompletedGoals").checked=!!dayData.ui.hideCompletedGoals;
  if(dayData.context) showDashboard(); else {$("contextCard").classList.remove("hidden");$("dashboardContent").classList.add("hidden");}
  renderAll();
}

async function openDate(dateKey) { await loadSelectedDate(dateKey); switchView("daily"); }
async function shiftSelectedDay(delta) { const d=new Date(selectedDateKey+"T12:00:00");d.setDate(d.getDate()+delta);await openDate(localDateKey(d)); }
async function shiftWeek(delta) { const d=new Date(selectedDateKey+"T12:00:00");d.setDate(d.getDate()+delta);await loadSelectedDate(localDateKey(d));renderWeekView(); }

function renderPlannerViews(){renderMonthCalendar();renderWeekView();renderDailyPage();}

async function getDaySummary(dateKey){const snap=await getDoc(dayDoc(dateKey));return snap.exists()?snap.data():null;}

function updatePaperMonthTabs(){
  const key=`${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth()+1).padStart(2,"0")}`;
  document.querySelectorAll(".month-tab").forEach(btn=>btn.classList.toggle("active",btn.dataset.month===key));
}

async function renderMonthCalendar(){
  const first=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1,12);
  updatePaperMonthTabs();
  $("calendarTitle").textContent=first.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const start=new Date(first);start.setDate(1-first.getDay());
  const dates=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
  const data=await Promise.all(dates.map(d=>getDaySummary(localDateKey(d))));
  $("monthCalendar").innerHTML=dates.map((d,i)=>{const key=localDateKey(d),ctx=effectiveContext(key,data[i]),items=(data[i]?.customItems||[]).filter(x=>x.type==="Appointment"); const badge=ctx?.letterDay==="No School"?"NS":ctx?.letterDay==="SIP"?"SIP":ctx?.letterDay?ctx.letterDay+" Day":"";return `<button class="calendar-day ${d.getMonth()!==first.getMonth()?"outside":""} ${key===todayKey?"today":""} ${key===selectedDateKey?"selected":""}" data-open-date="${key}" type="button"><span class="calendar-number">${d.getDate()}</span>${badge?`<span class="calendar-badge">${esc(badge)}</span>`:""}${ctx?.daycare==="yes"?'<span class="calendar-badge">Daycare</span>':""}${items.slice(0,2).map(x=>`<span class="calendar-note">${formatTime(x.time24)} ${esc(x.title)}</span>`).join("")}</button>`;}).join("");
  $("monthCalendar").querySelectorAll("[data-open-date]").forEach(b=>b.addEventListener("click",()=>openDate(b.dataset.openDate)));
}

function sundayFor(dateKey){const d=new Date(dateKey+"T12:00:00");d.setDate(d.getDate()-d.getDay());return d;}
async function renderWeekView(){
  const start=sundayFor(selectedDateKey);const dates=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
  const data=await Promise.all(dates.map(d=>getDaySummary(localDateKey(d))));
  const end=dates[6];$("weekTitle").textContent=`${start.toLocaleDateString("en-US",{month:"short",day:"numeric"})}–${end.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
  const slotHeight=8,totalMinutes=13*60,height=(totalMinutes/10)*slotHeight;
  $("weekDateGrid").innerHTML=dates.map((d,i)=>{const key=localDateKey(d),stored=data[i],ctx=effectiveContext(key,stored),events=[];
    if(["A","B","C","D","E"].includes(ctx?.letterDay)) (SCHEDULE_BY_LETTER_DAY[ctx.letterDay]||[]).forEach((x,n)=>events.push({...x,id:`class-${n}`,custom:false}));
    (stored?.customItems||[]).filter(x=>x.type==="Appointment").forEach(x=>events.push({...x,custom:true})); events.sort((a,b)=>a.time24.localeCompare(b.time24));
    let lines="";for(let min=0;min<=totalMinutes;min+=10){const top=(min/10)*slotHeight,hour=min%60===0,half=min%30===0,actual=360+min,h=Math.floor(actual/60),m=actual%60;lines+=`<div class="week-slot ${hour?"hour":half?"half":""}" style="top:${top}px">${hour?`<span>${formatTime(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`)}</span>`:""}</div>`;}
    const blocks=events.map(e=>{const [h,m]=e.time24.split(":").map(Number),offset=h*60+m-360;if(offset<0||offset>totalMinutes)return"";const top=(offset/10)*slotHeight;return `<div class="week-grid-event ${e.custom?"custom":""}" style="top:${top}px" title="${esc(formatTime(e.time24)+" "+e.title)}"><time>${formatTime(e.time24)}</time><strong>${esc(e.title)}</strong></div>`;}).join("");
    const badge=ctx?.letterDay==="No School"?"NS":ctx?.letterDay||"";return `<section class="weekly-day-column ${key===todayKey?"today":""} ${key===selectedDateKey?"selected":""}"><button class="weekly-day-header" data-open-date="${key}" type="button"><span>${d.toLocaleDateString("en-US",{weekday:"short"})}</span><strong>${d.getDate()}</strong>${badge?`<em>${esc(badge)}</em>`:""}</button><div class="weekly-day-timeline" style="height:${height}px">${lines}${blocks}</div></section>`;
  }).join("");
  $("weekDateGrid").querySelectorAll("[data-open-date]").forEach(b=>b.addEventListener("click",()=>openDate(b.dataset.openDate)));
}

function renderDailyPage(){
  if(!dayData)return;const d=new Date(selectedDateKey+"T12:00:00");
  $("dailyViewTitle") && ($("dailyViewTitle").textContent=d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}));
  const c=dayData.context;$("dailyViewMeta") && ($("dailyViewMeta").textContent=c?`${c.letterDay}${c.daycare==="yes"?" • Daycare":""}`:"This day has not been set up yet.");
  if($("dailyContextSummary")) $("dailyContextSummary").innerHTML=c?`<div class="context-summary-row"><span>Day</span><strong>${esc(c.dayOfWeek)}</strong></div><div class="context-summary-row"><span>Letter day</span><strong>${esc(c.letterDay)}</strong></div><div class="context-summary-row"><span>Daycare</span><strong>${c.daycare==="yes"?"Yes":"No"}</strong></div>`:'<div class="empty-state">Use Daily Spread to set up this date.</div>';
  if(!$("dailyPageTimeline"))return;
  if(!c){$("dailyPageTimeline").innerHTML='<div class="empty-state">This date has not been set up yet.</div>';return;}
  const items=buildTimelineItems();
  $("dailyPageTimeline").innerHTML=items.length?items.map(item=>`<div class="timeline-item ${dayData.completed[item.key]?"done":""}" data-key="${esc(item.key)}"><span class="timeline-time">${formatTime(item.time24)}</span><button class="check-button" type="button">${dayData.completed[item.key]?"✓":""}</button><div><div class="timeline-title">${esc(item.title)}</div><div class="timeline-type">${esc(item.type)}</div></div><span></span></div>`).join(""):'<div class="empty-state">Nothing scheduled.</div>';
  $("dailyPageTimeline").querySelectorAll(".check-button").forEach(btn=>btn.addEventListener("click",()=>{const key=btn.closest(".timeline-item").dataset.key;dayData.completed[key]=!dayData.completed[key];renderTimeline();renderDailyPage();queueSave();}));
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
