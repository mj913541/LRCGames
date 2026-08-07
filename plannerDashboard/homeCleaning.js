
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

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
const PLANNER_PROFILE_ID = "mj";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DAY = 86400000;
const TODAY = toKey(new Date());
let user = null;
let state = null;
let saveTimer = null;
let activeFilter = "all";

const DAILY = { label:"Everyday reset", type:"interval", intervalDays:1 };
const WEEKLY = { label:"Weekly", type:"interval", intervalDays:7 };
const QUARTERLY = { label:"Quarterly", type:"interval", intervalDays:90 };

const bathroomDaily = [
  "Wipe sink & faucet","Wipe counter","Wipe toilet seat/rim","Quick toilet-bowl clean",
  "Put away bathroom clutter","Hang/straighten towels","Empty trash if full",
  "Restock toilet paper if low","Sweep/vacuum floor","Quick mop","Wipe mirror if needed"
];
const bathroomWeekly = [
  "Thoroughly clean toilet","Clean sink & faucet","Clean counter","Clean mirror","Scrub tub/shower",
  "Clean shower doors/curtain","Full mop","Dust surfaces","Wipe cabinet/vanity fronts",
  "Empty & clean trash can","Change hand towels","Wash bath mats",
  "Restock toilet paper & toiletries","Clean soap/toiletry holders"
];
const bathroomQuarterly = [
  "Deep-clean tub/shower","Deep-clean grout","Clean showerhead","Clean drains",
  "Wash/replace shower-curtain liner as needed","Clean baseboards","Clean walls & doors",
  "Clean windows & window sills, if applicable","Dust vent/exhaust fan","Dust light fixtures",
  "Deep-clean floors, edges & corners","Empty and clean inside vanity/cabinets",
  "Declutter toiletries & dispose of empties/expired products","Wash bathroom trash can",
  "Deep-clean around/behind toilet"
];

const ROOMS = [
  {
    id:"kitchen", floor:"main", icon:"🍳", name:"Kitchen",
    sections:[
      { ...DAILY, tasks:[
        "Load dishwasher","Unload dishwasher","Hand-wash remaining dishes","Wipe counters",
        "Wipe kitchen table","Clean/wipe sink","Wipe stovetop","Sweep/vacuum floor",
        "Quick mop","Take out trash","Quick clutter reset / put things away"
      ]},
      { ...WEEKLY, tasks:[
        "Clean microwave","Wipe appliance fronts","Wipe cabinet fronts","Clean backsplash",
        "Full mop","Clean outside of trash can","Wipe refrigerator shelves as needed"
      ]},
      { label:"Wednesday", type:"weekday", weekday:3, tasks:["Toss old/expired fridge food"] },
      { ...QUARTERLY, tasks:[
        "Deep-clean refrigerator","Clean oven","Clean dishwasher","Deep-clean sink & faucet",
        "Clean inside cabinets/drawers","Clean/organize pantry",
        "Clean under/behind movable appliances","Deep-clean floors & baseboards"
      ]}
    ]
  },
  {
    id:"dining-changing", floor:"main", icon:"🍽️", name:"Dining Room + Baby Changing Station",
    sections:[
      { ...DAILY, tasks:[
        "Sweep/vacuum floor","Quick mop","Put away dining-room clutter","Reset changing station",
        "Throw away diapers / changing trash","Wipe changing pad","Put away changing supplies",
        "Restock diapers & wipes if running low"
      ]},
      { ...WEEKLY, tasks:[
        "Full mop","Dust surfaces","Wipe changing station/furniture","Clean & disinfect diaper pail",
        "Wash/change changing-pad cover","Wipe diaper/wipe organizers",
        "Check changing supplies & restock from backstock"
      ]},
      { ...QUARTERLY, tasks:[
        "Clean baseboards","Clean walls/doors as needed","Clean windows & window sills",
        "Deep-clean floors/edges/corners","Clean under/behind changing station",
        "Empty & deep-clean changing-station drawers/storage",
        "Sort outgrown/unused changing supplies","Deep-clean diaper pail"
      ]}
    ]
  },
  {
    id:"living-toy", floor:"main", icon:"🛋️", name:"Living Room + Toy Room",
    sections:[
      { ...DAILY, tasks:[
        "Pick up toys","Return toys to their bins/areas","Put books back","Pick up general clutter",
        "Straighten couch pillows & blankets","Sweep/vacuum main floor","Quick mop hard floors",
        "Clear/wipe coffee & side tables","Reset play area","Gather anything that belongs in another room"
      ]},
      { ...WEEKLY, tasks:[
        "Full vacuum, including edges","Full mop hard floors","Dust surfaces","Dust TV/electronics",
        "Vacuum couch & cushions","Clean under couch cushions","Wipe toy shelves/bins",
        "Wipe frequently used toys","Clean tables","Rotate toy bins","Straighten/organize books",
        "Wash couch blankets"
      ]},
      { ...QUARTERLY, tasks:[
        "Move furniture & clean underneath","Clean baseboards","Clean windows & window sills",
        "Clean walls/doors as needed","Deep-clean couch/upholstery","Deep-clean rugs/carpet",
        "Deep-clean toy shelves & bins","Sort toys for keep/donate/store",
        "Remove broken/outgrown toys","Deep-clean toys that need it","Sort/outgrow books",
        "Wash pillows/cushion covers as appropriate","Dust vents & light fixtures","Dust ceiling fan"
      ]}
    ]
  },
  {
    id:"master-bedroom", floor:"main", icon:"🛏️", name:"Master Bedroom",
    sections:[
      { ...DAILY, tasks:[
        "Make bed","Pick up dirty clothes / put in hamper","Put away clean clothes","Clear nightstands",
        "Put away bedroom clutter","Return items that belong in other rooms",
        "Sweep/vacuum main floor","Quick mop, if applicable","Straighten pillows & blankets"
      ]},
      { ...WEEKLY, tasks:[
        "Change sheets","Wash bedding","Full vacuum, including edges","Full mop, if applicable",
        "Dust furniture/surfaces","Dust nightstands","Clean mirrors","Wipe high-touch surfaces",
        "Quick reset of dresser tops","Quick closet reset — hang/put away stragglers"
      ]},
      { ...QUARTERLY, tasks:[
        "Move/clean under bed","Clean baseboards","Clean windows & window sills",
        "Clean walls/doors as needed","Dust ceiling fan","Dust vents & light fixtures",
        "Deep-clean floors/rugs","Rotate mattress","Vacuum mattress","Wash pillows",
        "Wash mattress protector","Declutter dresser drawers","Declutter/organize closet",
        "Sort clothes for keep/donate/store"
      ]}
    ]
  },
  {
    id:"downstairs-bathroom", floor:"main", icon:"🚿", name:"Downstairs Bathroom",
    sections:[
      { ...DAILY, tasks:bathroomDaily },
      { ...WEEKLY, tasks:bathroomWeekly },
      { ...QUARTERLY, tasks:bathroomQuarterly }
    ]
  },
  {
    id:"nursery", floor:"upstairs", icon:"🍼", name:"Nursery",
    sections:[
      { ...DAILY, tasks:[
        "Make/straighten crib or sleep area","Put away nursery clutter","Reset changing/diaper supplies",
        "Gather used nighttime bottles","Reset nighttime bottle station",
        "Restock nighttime bottle supplies as needed","Sweep/vacuum main floor",
        "Quick mop, if applicable","Return things that belong in other rooms"
      ]},
      { ...WEEKLY, tasks:[
        "Change crib sheets/bedding","Wash crib bedding","Full vacuum, including edges",
        "Full mop, if applicable","Dust furniture & surfaces","Wipe crib",
        "Clean & sanitize nighttime bottle station","Check/restock nighttime bottle supplies",
        "Wipe changing area & organizers"
      ]},
      { ...QUARTERLY, tasks:[
        "Move/clean under crib & furniture","Clean baseboards","Clean windows & window sills",
        "Clean walls & doors as needed","Dust ceiling fan","Dust vents & light fixtures",
        "Deep-clean floors/rugs","Deep-clean crib","Deep-clean nighttime bottle station",
        "Empty & clean nursery storage","Sort outgrown/unused baby supplies","Wash curtains, if applicable"
      ]}
    ]
  },
  {
    id:"upstairs-bathroom", floor:"upstairs", icon:"🚿", name:"Upstairs Bathroom",
    sections:[
      { ...DAILY, tasks:bathroomDaily },
      { ...WEEKLY, tasks:bathroomWeekly },
      { ...QUARTERLY, tasks:bathroomQuarterly }
    ]
  },
  {
    id:"upstairs-hallway", floor:"upstairs", icon:"🚪", name:"Hallway + Mirrored Closet Doors",
    sections:[
      { ...DAILY, tasks:[
        "Pick up hallway clutter","Return stray items to where they belong","Sweep/vacuum floor",
        "Quick mop, if applicable","Spot-clean fingerprints/smudges on mirrored closet doors",
        "Clear anything blocking the hallway"
      ]},
      { ...WEEKLY, tasks:[
        "Full vacuum, including edges","Full mop, if applicable","Clean full-length mirrored closet doors",
        "Dust surfaces/trim","Wipe door handles","Wipe closet-door tracks/frames",
        "Reset anything accumulating in the hallway"
      ]},
      { ...QUARTERLY, tasks:[
        "Clean baseboards","Wipe walls & doors","Dust vents","Dust light fixtures",
        "Deep-clean floor edges & corners","Deep-clean mirrored closet-door tracks/frames",
        "Clean tops of door frames/trim"
      ]}
    ]
  },
  {
    id:"litter-box", floor:"upstairs", icon:"🐈", name:"Litter Box Area",
    sections:[
      { ...WEEKLY, tasks:[
        "Scoop litter box","Sweep/vacuum scattered litter","Check litter level & top off if needed",
        "Wipe up messes around box","Check surrounding area for accidents",
        "Empty litter waste container if needed"
      ]}
    ]
  }
];

function $(id){ return document.getElementById(id); }
function toKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fromKey(key){ return new Date(`${key}T12:00:00`); }
function addDays(key, n){ const d=fromKey(key); d.setDate(d.getDate()+n); return toKey(d); }
function diffDays(a,b){ return Math.round((fromKey(a)-fromKey(b))/DAY); }
function esc(v=""){ const d=document.createElement("div"); d.textContent=v; return d.innerHTML; }
function taskId(roomId, section, name){
  return `${roomId}__${section.type}-${section.intervalDays || section.weekday || 0}__${name}`
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function cleaningDoc(){ return doc(db,"plannerDashboardUsers",PLANNER_PROFILE_ID,"homeCleaning","state"); }
function showToast(message){ const t=$("toast"); t.textContent=message; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1800); }
function markSaving(){ $("saveStatus").textContent="Saving…"; }
function markSaved(){ $("saveStatus").textContent="Saved"; }

function defaultState(){
  return {
    initializedAt:TODAY,
    completions:{},
    ui:{collapsedRooms:{},collapsedFloors:{}},
    version:1
  };
}
function normalizeState(raw){
  const next={...defaultState(),...(raw||{})};
  next.completions ||= {};
  next.ui ||= {};
  next.ui.collapsedRooms ||= {};
  next.ui.collapsedFloors ||= {};
  return next;
}
function completionFor(id){ return state.completions[id] || null; }
function lastDone(id){ return completionFor(id)?.lastDone || null; }
function doneToday(id){ return lastDone(id) === TODAY; }

function nextWeekdayOnOrAfter(key, weekday){
  const d=fromKey(key);
  const delta=(weekday-d.getDay()+7)%7;
  d.setDate(d.getDate()+delta);
  return toKey(d);
}
function dueKeyFor(room, section, name){
  const id=taskId(room.id,section,name);
  const last=lastDone(id);
  if(section.type==="weekday"){
    if(last){
      const nextBase=addDays(last,1);
      return nextWeekdayOnOrAfter(nextBase,section.weekday);
    }
    return nextWeekdayOnOrAfter(state.initializedAt,section.weekday);
  }
  if(last) return addDays(last,section.intervalDays);
  if(section.intervalDays===1) return TODAY;
  return addDays(state.initializedAt,section.intervalDays);
}
function taskStatus(room, section, name){
  const id=taskId(room.id,section,name);
  if(doneToday(id)) return {kind:"completed-today",label:"Done today",dueKey:dueKeyFor(room,section,name),id};
  const dueKey=dueKeyFor(room,section,name);
  const delta=diffDays(TODAY,dueKey);
  if(delta>0) return {kind:"overdue",label:`Overdue ${delta} day${delta===1?"":"s"}`,dueKey,id};
  if(delta===0) return {kind:"due",label:"Due today",dueKey,id};
  return {kind:"future",label:`Due ${fromKey(dueKey).toLocaleDateString("en-US",{month:"short",day:"numeric"})}`,dueKey,id};
}
function allTasks(){
  const rows=[];
  for(const room of ROOMS) for(const section of room.sections) for(const name of section.tasks){
    rows.push({room,section,name,status:taskStatus(room,section,name)});
  }
  return rows;
}
function frequencyLabel(section){
  if(section.type==="weekday") return "Every Wednesday";
  if(section.intervalDays===1) return "Everyday";
  if(section.intervalDays===7) return "Weekly";
  if(section.intervalDays===90) return "Quarterly";
  return `Every ${section.intervalDays} days`;
}

function rowHTML(room, section, name, compact=false){
  const s=taskStatus(room,section,name);
  const last=lastDone(s.id);
  const meta=compact
    ? `${room.icon} ${room.name} · ${frequencyLabel(section)} · ${s.label}`
    : `${frequencyLabel(section)} · ${s.label}${last ? ` · Last done ${fromKey(last).toLocaleDateString("en-US",{month:"short",day:"numeric"})}` : ""}`;
  return `<div class="task-row ${s.kind}" data-task-id="${esc(s.id)}">
    <span class="status-dot" aria-hidden="true"></span>
    <div class="task-copy"><div class="task-name">${esc(name)}</div><div class="task-meta">${esc(meta)}</div></div>
    <button class="done-button ${doneToday(s.id)?"done":""}" type="button" data-done="${esc(s.id)}">${doneToday(s.id)?"✓ Done":"Done"}</button>
  </div>`;
}
function renderToday(){
  const due=allTasks().filter(x=>["due","overdue","completed-today"].includes(x.status.kind))
    .filter(x=>activeFilter==="all" || x.room.floor===activeFilter);
  $("todayTasks").innerHTML=due.length
    ? due.map(x=>rowHTML(x.room,x.section,x.name,true)).join("")
    : `<div class="empty-state">✨ Nothing due here right now. Enjoy the breathing room.</div>`;
}
function renderRoom(room){
  const dueCount=room.sections.flatMap(s=>s.tasks.map(n=>taskStatus(room,s,n)))
    .filter(s=>s.kind==="due"||s.kind==="overdue").length;
  const collapsed=!!state.ui.collapsedRooms[room.id];
  const sections=room.sections.map(section=>`
    <section class="frequency-section">
      <div class="frequency-title"><strong>${esc(section.label)}</strong><span>${esc(frequencyLabel(section))}</span></div>
      <div class="task-list">${section.tasks.map(name=>rowHTML(room,section,name)).join("")}</div>
    </section>`).join("");
  return `<article class="room-card ${collapsed?"collapsed":""}" data-room-card="${esc(room.id)}">
    <button class="room-header" type="button" data-room-toggle="${esc(room.id)}" aria-expanded="${!collapsed}">
      <span class="room-title">${room.icon} ${esc(room.name)}</span>
      <span class="room-badge">${dueCount ? `${dueCount} due` : "caught up"}</span>
    </button>
    <div class="room-body">${sections}</div>
  </article>`;
}
function renderFloors(){
  for(const floor of ["main","upstairs"]){
    const rooms=ROOMS.filter(r=>r.floor===floor);
    $(`${floor==="main"?"mainFloorRooms":"upstairsRooms"}`).innerHTML=rooms.map(renderRoom).join("");
    const due=allTasks().filter(x=>x.room.floor===floor && ["due","overdue"].includes(x.status.kind)).length;
    $(floor==="main"?"mainFloorStatus":"upstairsStatus").textContent=due ? `${due} task${due===1?"":"s"} due` : "Nothing due";
    const floorCard=document.querySelector(`[data-floor="${floor}"]`)?.closest(".floor-card");
    floorCard?.classList.toggle("collapsed",!!state.ui.collapsedFloors[floor]);
    document.querySelector(`[data-floor="${floor}"]`)?.setAttribute("aria-expanded",String(!state.ui.collapsedFloors[floor]));
  }
}
function renderSummary(){
  const tasks=allTasks();
  $("dueCount").textContent=tasks.filter(x=>x.status.kind==="due").length;
  $("overdueCount").textContent=tasks.filter(x=>x.status.kind==="overdue").length;
  $("doneTodayCount").textContent=tasks.filter(x=>x.status.kind==="completed-today").length;
}
function render(){
  renderSummary();
  renderToday();
  renderFloors();
  bindDynamic();
}
function bindDynamic(){
  document.querySelectorAll("[data-done]").forEach(btn=>{
    btn.onclick=()=>completeTask(btn.dataset.done);
  });
  document.querySelectorAll("[data-room-toggle]").forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.roomToggle;
      state.ui.collapsedRooms[id]=!state.ui.collapsedRooms[id];
      queueSave(); renderFloors(); bindDynamic();
    };
  });
}
function completeTask(id){
  const prior=state.completions[id] || {history:[]};
  const history=Array.isArray(prior.history)?prior.history:[];
  if(prior.lastDone===TODAY){
    // A same-day second tap is treated as undo.
    const trimmed=history.filter(x=>x!==TODAY);
    if(trimmed.length) state.completions[id]={lastDone:trimmed[trimmed.length-1],history:trimmed};
    else delete state.completions[id];
    showToast("Completion undone.");
  } else {
    const nextHistory=[...history.filter(x=>x!==TODAY),TODAY].slice(-24);
    state.completions[id]={lastDone:TODAY,history:nextHistory};
    showToast("Nice. That counts. ✓");
  }
  queueSave(); render();
}
function queueSave(){
  markSaving(); clearTimeout(saveTimer);
  saveTimer=setTimeout(save,350);
}
async function save(){
  try{
    await setDoc(cleaningDoc(),{
      ...state,
      updatedAt:serverTimestamp(),
      updatedBy:(user?.email||"").toLowerCase()
    },{merge:true});
    markSaved();
  }catch(err){
    console.error("Home cleaning save failed:",err);
    $("saveStatus").textContent="Save failed";
    showToast("Could not save cleaning progress.");
  }
}
function bindStatic(){
  $("signOutBtn").onclick=()=>signOut(auth);
  document.querySelectorAll("[data-filter]").forEach(btn=>{
    btn.onclick=()=>{
      activeFilter=btn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active",b===btn));
      renderToday(); bindDynamic();
    };
  });
  document.querySelectorAll("[data-floor]").forEach(btn=>{
    btn.onclick=()=>{
      const floor=btn.dataset.floor;
      state.ui.collapsedFloors[floor]=!state.ui.collapsedFloors[floor];
      queueSave(); renderFloors(); bindDynamic();
    };
  });
}

$("todayLabel").textContent=fromKey(TODAY).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});

onAuthStateChanged(auth,async current=>{
  if(!current){
    location.replace("../login.html?redirect=plannerDashboard/homeCleaning.html");
    return;
  }
  if(!ALLOWED_EMAILS.has((current.email||"").toLowerCase())){
    await signOut(auth);
    location.replace("../login.html?reason=unauthorized");
    return;
  }
  user=current;
  try{
    const snap=await getDoc(cleaningDoc());
    state=normalizeState(snap.exists()?snap.data():null);
    if(!snap.exists()) await save();
  }catch(err){
    console.error("Home cleaning load failed:",err);
    state=normalizeState(null);
    $("saveStatus").textContent="Local view";
    showToast("Cloud data could not be loaded.");
  }
  bindStatic();
  render();
  $("loadingScreen").classList.add("done");
});



  <script src="/js/load-header.js"></script>