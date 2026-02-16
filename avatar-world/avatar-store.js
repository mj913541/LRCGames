// avatar-store.js
// Kid-friendly Avatar Store using Reading Rubies + Closet equip
//
// Firestore expectations (matches your existing store script):
// - users/{uid} doc contains: { studentId: "<studentDocId>" }
// - students/{studentId} doc contains: { rubiesBalance: number, equipped?: { head?: string|null, body?: string|null, back?: string|null, pet?: string|null }, level?: number }
// - students/{studentId}/inventory/{itemId} docs created on purchase
// - storeItems/{itemId} docs: { active:true, sortOrder:number, name, category, price, description, emoji?, imageUrl? }
//
// NOTE: This file keeps your transaction-based purchase flow, but upgrades UI + adds equip/unequip.
//
// Uses your existing Firebase init at /readathon-world/js/firebase.js

import { auth, db } from "/readathon-world/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection, query, where, orderBy, getDocs, doc, getDoc,
  runTransaction, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);

const userNameLabel = $("userNameLabel");
const userGradeLabel = $("userGradeLabel");
const userHint = $("userHint");

const rubiesAmountLabel = $("rubiesAmountLabel");

const avatarLevelLabel = $("avatarLevelLabel");
const avatarHeadChip = $("avatarHeadChip");
const avatarBodyChip = $("avatarBodyChip");
const avatarBackChip = $("avatarBackChip");
const avatarPetChip = $("avatarPetChip");

const shopCategoryLabel = $("shopCategoryLabel");
const closetCategoryLabel = $("closetCategoryLabel");
const shopList = $("shopList");
const closetList = $("closetList");
const shopEmptyMessage = $("shopEmptyMessage");
const closetEmptyMessage = $("closetEmptyMessage");
const msg = $("msg");

const categoryBtns = Array.from(document.querySelectorAll("[data-category]"));
const tabBtns = Array.from(document.querySelectorAll("[data-tab]"));

// ---------- Constants ----------
const CATEGORY_LABELS = {
  head: "Headgear",
  body: "Outfits",
  back: "Back",
  pet: "Pets"
};

// ---------- State ----------
let uid = null;
let session = null;

let rubiesBalance = 0;
let level = 1;

let activeCategory = "head";
let activeTab = "shop"; // "shop" | "closet"

let items = [];            // store items
let owned = new Set();     // inventory item ids
let equipped = { head: null, body: null, back: null, pet: null };

// ---------- Helpers ----------
function showMsg(text, kind = "bad") {
  if (!msg) return;
  if (!text) {
    msg.style.display = "none";
    msg.textContent = "";
    return;
  }
  msg.style.display = "block";
  msg.textContent = text;
  msg.classList.remove("good", "bad");
  msg.classList.add(kind === "good" ? "good" : "bad");
}

function setRubies(n) {
  rubiesBalance = Number.isFinite(Number(n)) ? Number(n) : 0;
  if (rubiesAmountLabel) rubiesAmountLabel.textContent = String(rubiesBalance);
}

function setLevel(n) {
  level = Number.isFinite(Number(n)) ? Number(n) : 1;
  if (avatarLevelLabel) avatarLevelLabel.textContent = String(level);
}

function getItemById(id) {
  if (!id) return null;
  return items.find((it) => it.id === id) || null;
}

function isOwned(itemId) {
  return owned.has(itemId);
}

function isEquipped(itemId) {
  const it = getItemById(itemId);
  if (!it) return false;
  return (equipped?.[it.category] || null) === itemId;
}

function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || "Items";
}

function setActiveCategory(cat) {
  activeCategory = cat;
  categoryBtns.forEach((b) => b.classList.toggle("active", b.dataset.category === cat));
  if (shopCategoryLabel) shopCategoryLabel.textContent = categoryLabel(cat);
  if (closetCategoryLabel) closetCategoryLabel.textContent = categoryLabel(cat);
  render();
}

function setActiveTab(tab) {
  activeTab = tab;
  tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  render();
}

function updateAvatarChips() {
  const head = getItemById(equipped?.head);
  const body = getItemById(equipped?.body);
  const back = getItemById(equipped?.back);
  const pet  = getItemById(equipped?.pet);

  avatarHeadChip.textContent = head ? `${head.emoji || "🧢"} ${head.name || head.id}` : "";
  avatarBodyChip.textContent = body ? `${body.emoji || "🧥"} ${body.name || body.id}` : "";
  avatarBackChip.textContent = back ? `${back.emoji || "🎒"} ${back.name || back.id}` : "";
  avatarPetChip.textContent  = pet  ? `${pet.emoji  || "🐾"} ${pet.name  || pet.id}`  : "";
}

// ---------- Firestore loads ----------
async function loadSession(u) {
  const s = await getDoc(doc(db, "users", u));
  return s.exists() ? s.data() : null;
}

async function loadStudent(studentId) {
  const snap = await getDoc(doc(db, "students", studentId));
  const data = snap.exists() ? snap.data() : {};
  setRubies(data.rubiesBalance ?? 0);
  setLevel(data.level ?? 1);

  // Equipped map is optional
  const eq = data.equipped || {};
  equipped = {
    head: eq.head ?? null,
    body: eq.body ?? null,
    back: eq.back ?? null,
    pet:  eq.pet  ?? null
  };
}

async function loadOwned(studentId) {
  owned = new Set();
  const invCol = collection(db, "students", studentId, "inventory");
  const invSnap = await getDocs(invCol);
  invSnap.forEach((d) => owned.add(d.id));
}

async function loadItems() {
  const qRef = query(
    collection(db, "storeItems"),
    where("active", "==", true),
    orderBy("sortOrder", "asc")
  );
  const snap = await getDocs(qRef);
  items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- Render ----------
function render() {
  showMsg("");

  updateAvatarChips();

  if (activeTab === "shop") {
    renderShop();
    // keep closet panel visible too (nice for kids) but update contents:
    renderCloset();
  } else {
    renderShop();
    renderCloset();
  }
}

function renderShop() {
  if (!shopList) return;

  const list = items
    .filter((it) => it.category === activeCategory)
    .filter((it) => !isOwned(it.id));

  shopList.innerHTML = "";

  if (!list.length) {
    if (shopEmptyMessage) shopEmptyMessage.style.display = "block";
    return;
  }
  if (shopEmptyMessage) shopEmptyMessage.style.display = "none";

  list.forEach((it) => {
    const price = Number(it.price ?? 0);
    const affordable = rubiesBalance >= price;

    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <div class="cardTop">
        <div class="leftMini">
          <div class="emoji" aria-hidden="true">${it.emoji || "🧺"}</div>
          <div class="titleBox">
            <p class="itemName" title="${escapeHtml(it.name || it.id)}">${escapeHtml(it.name || it.id)}</p>
            <div class="meta">${escapeHtml(categoryLabel(it.category))}</div>
          </div>
        </div>

        <div class="priceTag">
          <div class="rubyRow">💎 <span>${price}</span></div>
          <div class="hint">${affordable ? "You can afford this" : "Need more rubies"}</div>
        </div>
      </div>

      <p class="desc">${escapeHtml(it.description || "A fun new item for your guardian!")}</p>

      <div class="btnRow">
        <div class="status">${affordable ? "This will move into your closet." : "Keep reading to earn more rubies!"}</div>
        <button class="btn buy" data-buy="${it.id}" ${affordable ? "" : "disabled"}>
          ${affordable ? "Buy" : "Not enough 💎"}
        </button>
      </div>
    `;

    shopList.appendChild(card);
  });

  shopList.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => buy(btn.getAttribute("data-buy")));
  });
}

function renderCloset() {
  if (!closetList) return;

  const list = items
    .filter((it) => it.category === activeCategory)
    .filter((it) => isOwned(it.id));

  closetList.innerHTML = "";

  if (!list.length) {
    if (closetEmptyMessage) closetEmptyMessage.style.display = "block";
    return;
  }
  if (closetEmptyMessage) closetEmptyMessage.style.display = "none";

  list.forEach((it) => {
    const eq = isEquipped(it.id);

    const card = document.createElement("article");
    card.className = "card owned" + (eq ? " equipped" : "");

    card.innerHTML = `
      <div class="cardTop">
        <div class="leftMini">
          <div class="emoji" aria-hidden="true">${it.emoji || "🧺"}</div>
          <div class="titleBox">
            <p class="itemName" title="${escapeHtml(it.name || it.id)}">${escapeHtml(it.name || it.id)}</p>
            <div class="meta">${eq ? "Equipped" : "Owned"}</div>
          </div>
        </div>

        <button class="btn ${eq ? "unequip" : "equip"}" data-equip="${it.id}">
          ${eq ? "Unequip" : "Equip"}
        </button>
      </div>

      <p class="desc">${escapeHtml(it.description || "A fun new item for your guardian!")}</p>
    `;

    closetList.appendChild(card);
  });

  closetList.querySelectorAll("[data-equip]").forEach((btn) => {
    btn.addEventListener("click", () => equipToggle(btn.getAttribute("data-equip")));
  });
}

// ---------- Actions ----------
async function buy(itemId) {
  showMsg("");
  const studentId = session?.studentId;
  if (!uid || !studentId) return showMsg("Please sign in again.");

  const itemRef = doc(db, "storeItems", itemId);
  const studentRef = doc(db, "students", studentId);
  const invRef = doc(db, "students", studentId, "inventory", itemId);
  const purchaseRef = doc(collection(db, "purchases")); // auto id

  try {
    await runTransaction(db, async (tx) => {
      const [itemSnap, stuSnap, invSnap] = await Promise.all([
        tx.get(itemRef),
        tx.get(studentRef),
        tx.get(invRef)
      ]);

      if (!itemSnap.exists()) throw new Error("Item missing.");
      const item = itemSnap.data();
      if (!item.active) throw new Error("Item not active.");
      if (invSnap.exists()) throw new Error("You already own this.");

      const price = Number(item.price ?? 0);
      const stu = stuSnap.exists() ? stuSnap.data() : {};
      const current = Number(stu.rubiesBalance ?? 0);

      if (current < price) throw new Error("Not enough rubies.");

      // 1) deduct rubies
      tx.set(studentRef, { rubiesBalance: current - price }, { merge: true });

      // 2) inventory doc
      tx.set(invRef, {
        itemId,
        pricePaid: price,
        purchasedAt: serverTimestamp()
      });

      // 3) ledger entry
      tx.set(purchaseRef, {
        studentId,
        studentUid: uid,
        itemId,
        pricePaid: price,
        purchasedAt: serverTimestamp()
      });
    });

    await refreshStudent(studentId);
    showMsg("Purchased! 🎉 It’s in your closet now.", "good");
  } catch (err) {
    console.error(err);
    showMsg(err?.message || "Purchase failed.");
  }
}

async function equipToggle(itemId) {
  showMsg("");
  const studentId = session?.studentId;
  if (!uid || !studentId) return showMsg("Please sign in again.");

  const it = getItemById(itemId);
  if (!it) return showMsg("That item is not available right now.");

  if (!isOwned(itemId)) return showMsg("Buy it first, then equip it from your closet!");

  const studentRef = doc(db, "students", studentId);
  const currently = equipped?.[it.category] || null;
  const next = (currently === itemId) ? null : itemId;

  try {
    // Merge nested "equipped" map
    await setDoc(studentRef, { equipped: { [it.category]: next } }, { merge: true });

    await refreshStudent(studentId);
    showMsg(next ? "Equipped! ✨" : "Unequipped.", "good");
  } catch (err) {
    console.error(err);
    showMsg(err?.message || "Could not change equipped item.");
  }
}

async function refreshStudent(studentId) {
  await Promise.all([loadItems(), loadStudent(studentId), loadOwned(studentId)]);
  render();
}

// ---------- Init ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/readathon-world/index.html";
    return;
  }

  uid = user.uid;

  session = await loadSession(uid);
  if (!session?.studentId) {
    showMsg("No student session found. Please sign in again.");
    if (userHint) userHint.textContent = "Session missing";
    return;
  }

  // Basic name (from auth) + optional grade from session
  if (userNameLabel) userNameLabel.textContent = user.displayName || "Guardian";
  if (userGradeLabel) {
    const g = session?.gradeLabel || session?.grade || "";
    userGradeLabel.textContent = g ? ` • Grade ${g}` : "";
  }
  if (userHint) userHint.textContent = "Ready to shop!";

  await refreshStudent(session.studentId);

  categoryBtns.forEach((b) => b.addEventListener("click", () => setActiveCategory(b.dataset.category)));
  tabBtns.forEach((b) => b.addEventListener("click", () => setActiveTab(b.dataset.tab)));
});

// ---------- tiny util ----------
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
