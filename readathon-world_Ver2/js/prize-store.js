// /js/student-prize-store.js

import {
  getCurrentUserId,
  getCurrentSchoolId,
  fetchStudentProfile,
  fetchAllPrizes,
  placePrizeOrder
} from "./prize-store-firebase.js";

/* ===============================
   ELEMENTS
=============================== */

const els = {
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),

  balanceAmount: document.getElementById("psBalanceAmount"),
  raisedAmount: document.getElementById("psRaisedAmount"),
  spentAmount: document.getElementById("psSpentAmount"),

  prizeGrid: document.getElementById("psPrizeGrid"),
  categoryFilter: document.getElementById("psCategoryFilter"),

  emptyState: document.getElementById("psEmptyState"),

  // NEW UI
  searchInput: document.getElementById("psSearchInput"),
  filterTabs: document.querySelectorAll(".psFilterTab"),
};

/* ===============================
   STATE
=============================== */

let ALL_PRIZES = [];
let FILTERED_PRIZES = [];
let USER = null;
let ACTIVE_FILTER = "all";

/* ===============================
   INIT
=============================== */

init();

async function init() {
  try {
    const userId = getCurrentUserId();
    const schoolId = getCurrentSchoolId();

    USER = await fetchStudentProfile(schoolId, userId);
    ALL_PRIZES = await fetchAllPrizes(schoolId);

    updateWalletUI();
    populateCategoryDropdown();
    applyFilters();

  } catch (err) {
    console.error("Prize Store Init Error:", err);
  }
}

/* ===============================
   WALLET DISPLAY
=============================== */

function updateWalletUI() {
  const balance = USER?.prizeBalance || 0;
  const raised = USER?.totalDonations || 0;
  const spent = USER?.totalSpent || 0;

  els.balanceAmount.textContent = `$${balance.toFixed(2)}`;
  els.raisedAmount.textContent = `$${raised.toFixed(2)}`;
  els.spentAmount.textContent = `$${spent.toFixed(2)}`;
}

/* ===============================
   CATEGORY DROPDOWN
=============================== */

function populateCategoryDropdown() {
  const categories = new Set();

  ALL_PRIZES.forEach(p => {
    if (p.category) categories.add(p.category);
  });

  els.categoryFilter.innerHTML = `<option value="all">All Categories</option>`;

  [...categories].sort().forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = capitalize(cat);
    els.categoryFilter.appendChild(opt);
  });
}

/* ===============================
   FILTERING SYSTEM
=============================== */

function applyFilters() {
  const search = els.searchInput?.value?.toLowerCase() || "";
  const category = els.categoryFilter.value;

  const balance = USER?.prizeBalance || 0;

  FILTERED_PRIZES = ALL_PRIZES.filter(p => {
    if (!p.active) return false;

    const matchesSearch =
      p.name.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search);

    const matchesCategory =
      category === "all" || p.category === category;

    let matchesTab = true;

    if (ACTIVE_FILTER === "canbuy") {
      matchesTab = balance >= p.price;
    }

    if (ACTIVE_FILTER === "almost") {
      matchesTab = balance < p.price && (p.price - balance <= 5);
    }

    if (ACTIVE_FILTER === "dream") {
      matchesTab = p.price >= 40;
    }

    return matchesSearch && matchesCategory && matchesTab;
  });

  sortPrizes(balance);
  renderPrizes();
}

/* ===============================
   SMART SORTING
=============================== */

function sortPrizes(balance) {
  FILTERED_PRIZES.sort((a, b) => {
    const canBuyA = balance >= a.price;
    const canBuyB = balance >= b.price;

    if (canBuyA && !canBuyB) return -1;
    if (!canBuyA && canBuyB) return 1;

    return a.price - b.price;
  });
}

/* ===============================
   RENDER
=============================== */

function renderPrizes() {
  els.prizeGrid.innerHTML = "";

  if (!FILTERED_PRIZES.length) {
    els.emptyState.style.display = "block";
    return;
  }

  els.emptyState.style.display = "none";

  FILTERED_PRIZES.forEach(prize => {
    els.prizeGrid.appendChild(createPrizeCard(prize));
  });
}

/* ===============================
   CARD BUILDER
=============================== */

function createPrizeCard(prize) {
  const balance = USER?.prizeBalance || 0;
  const canBuy = balance >= prize.price;
  const needed = (prize.price - balance).toFixed(2);

  const div = document.createElement("div");
  div.className = "psCard";

  div.innerHTML = `
    <img src="${prize.image}" class="psCardImg"/>

    <div class="psCardBody">
      <h3>${prize.name}</h3>

      <p class="psPrice">$${prize.price.toFixed(2)}</p>
      <p class="psDonations">Raise $${prize.donationsNeeded}</p>

      ${
        canBuy
          ? `<span class="psBadge success">Ready 🎉</span>`
          : `<span class="psBadge warn">Need $${needed} more</span>`
      }

      <button class="psBtn ${canBuy ? "" : "disabled"}">
        ${canBuy ? "Redeem" : "Keep Going 💪"}
      </button>
    </div>
  `;

  const btn = div.querySelector("button");

  if (canBuy) {
    btn.addEventListener("click", () => handleRedeem(prize));
  }

  return div;
}

/* ===============================
   REDEEM
=============================== */

async function handleRedeem(prize) {
  try {
    const confirmBuy = confirm(`Redeem ${prize.name}?`);
    if (!confirmBuy) return;

    await placePrizeOrder(prize);

    alert("🎉 Prize ordered!");

    init(); // refresh

  } catch (err) {
    console.error("Redeem error:", err);
    alert("Something went wrong.");
  }
}

/* ===============================
   FILTER EVENTS
=============================== */

els.categoryFilter.addEventListener("change", applyFilters);

els.searchInput?.addEventListener("input", applyFilters);

els.filterTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    els.filterTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    ACTIVE_FILTER = tab.dataset.filter;
    applyFilters();
  });
});

/* ===============================
   HELPERS
=============================== */

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}