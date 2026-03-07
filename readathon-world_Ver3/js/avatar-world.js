import { auth, db, getSchoolId } from "./firebase.js";

import {
doc,
getDoc,
collection,
getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {

roomBg: document.getElementById("roomBackground"),
avatarLayer: document.getElementById("avatarLayer"),
petLayer: document.getElementById("petLayer"),
wallLayer: document.getElementById("wallLayer"),
floorLayer: document.getElementById("floorLayer"),

inventoryGrid: document.getElementById("inventoryGrid"),
tabs: document.querySelectorAll(".aw-tabs button"),

btnBack: document.getElementById("btnBack"),
btnShop: document.getElementById("btnShop")

};

let schoolId;
let userId;
let inventory = [];

init();

async function init(){

const user = auth.currentUser;
userId = user.uid;

schoolId = await getSchoolId();

await loadRoom();
await loadInventory();

wireTabs();

}

async function loadRoom(){

const ref = doc(
db,
`readathonV2_schools/${schoolId}/userRoomState/${userId}`
);

const snap = await getDoc(ref);

if(!snap.exists()) return;

const room = snap.data();

renderRoom(room);

}

function renderRoom(room){

if(room.background){
els.roomBg.style.backgroundImage = `url(${room.background})`;
}

if(room.avatar){

els.avatarLayer.innerHTML =
`<img src="${room.avatar}">`;

}

if(room.pet){

els.petLayer.innerHTML =
`<img src="${room.pet}">`;

}

}

async function loadInventory(){

const ref = collection(
db,
`readathonV2_schools/${schoolId}/userInventory/${userId}/items`
);

const snap = await getDocs(ref);

inventory = snap.docs.map(d => ({
id:d.id,
...d.data()
}));

renderInventory("wearables");

}

function wireTabs(){

els.tabs.forEach(btn => {

btn.onclick = () => {

els.tabs.forEach(b => b.classList.remove("active"));
btn.classList.add("active");

renderInventory(btn.dataset.tab);

};

});

}

function renderInventory(tab){

els.inventoryGrid.innerHTML = "";

const items = inventory.filter(i => i.slot === tab);

items.forEach(item => {

const div = document.createElement("div");
div.className="aw-item";

div.innerHTML = `<img src="${item.imageUrl}">`;

div.onclick = () => equipItem(item);

els.inventoryGrid.appendChild(div);

});

}

function equipItem(item){

console.log("equip", item);

}