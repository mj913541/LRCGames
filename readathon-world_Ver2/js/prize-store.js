
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  auth,
  db,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  waitForAuthReady,
  fetchUserSummary,
  fnRedeemPrizeCredit,
} from "./firebase.js";

const els = {
  title: document.querySelector("[data-title]"),
  subtitle: document.querySelector("[data-subtitle]"),
  schoolIdDisplay: document.getElementById("schoolIdDisplay"),
  currentDonationsDisplay: document.getElementById("currentDonationsDisplay"),
  availableToSpendDisplay: document.getElementById("availableToSpendDisplay"),
  categoryFilter: document.getElementById("categoryFilter"),
  searchInput: document.getElementById("searchInput"),
  storeStatus: document.getElementById("storeStatus"),
  prizeShelfGrid: document.getElementById("prizeShelfGrid"),
  prizeCardTemplate: document.getElementById("prizeCardTemplate"),

  cartItems: document.getElementById("cartItems"),
  cartCount: document.getElementById("cartCount"),
  cartTotal: document.getElementById("cartTotal"),
  submitCartBtn: document.getElementById("submitCartBtn"),

  pendingOrdersList: document.getElementById("pendingOrdersList"),
  pendingOrdersCount: document.getElementById("pendingOrdersCount"),
};

const state = {
  schoolId: "",
  userId: "",
  summary: null,

  donationsRaisedCents: 0,
  availableToSpendCents: 0,

  allPrizes: [],
  filteredPrizes: [],

  cart: [],
  pendingOrders: [],
};

init().catch((error) => {
  console.error(error);
  setStatus("Unable to load prize store.");
});

async function init() {
  setHeader();

  state.schoolId = getSchoolId() || DEFAULT_SCHOOL_ID;

  bindUi();

  await loadStudentStoreSummary();

  await loadPendingOrders();

  const prizes = await loadPrizeCatalog(state.schoolId);

  state.allPrizes = prizes;

  populateCategoryFilter(prizes);

  applyFilters();

  renderCart();
}

function setHeader() {
  if (els.title) {
    els.title.textContent = "Prize Store";
  }

  if (els.subtitle) {
    els.subtitle.textContent =
      "Raise donations to unlock prize rows and build your reward cart.";
  }
}

function bindUi() {
  if (els.categoryFilter) {
    els.categoryFilter.addEventListener("change", applyFilters);
  }

  if (els.searchInput) {
    els.searchInput.addEventListener("input", applyFilters);
  }

  if (els.submitCartBtn) {
    els.submitCartBtn.addEventListener("click", submitCart);
  }
}

async function loadStudentStoreSummary() {
  await waitForAuthReady();

  const user = auth.currentUser;

  if (!user) {
    return;
  }

  state.userId = user.uid;

  const summary = await fetchUserSummary(state.schoolId, state.userId);

  state.summary = summary || null;

  const moneyRaisedCents = Number(summary?.moneyRaisedCents || 0);

  const totalAllowedCents = Math.floor(moneyRaisedCents * 0.2);

  const alreadySpentCents =
    Number(summary?.prizeCreditSpentCents || 0) ||
    Number(summary?.redeemedPrizeCreditCents || 0) ||
    Number(summary?.spentPrizeCreditCents || 0) ||
    Number(summary?.pendingPrizeOrderCents || 0) ||
    0;

  state.donationsRaisedCents = moneyRaisedCents;

  state.availableToSpendCents = Math.max(
    0,
    totalAllowedCents - alreadySpentCents
  );

  updateSummaryDisplays();
}

async function loadPendingOrders() {
  state.pendingOrders = [];
  renderPendingOrders();
}

function updateSummaryDisplays() {
  if (els.currentDonationsDisplay) {
    els.currentDonationsDisplay.textContent = formatMoneyCents(
      state.donationsRaisedCents
    );
  }

  if (els.availableToSpendDisplay) {
    els.availableToSpendDisplay.textContent = formatMoneyCents(
      state.availableToSpendCents
    );
  }
}

async function loadPrizeCatalog(schoolId) {
  setStatus("Loading prize catalog...");

  const prizeCatalogRef = collection(
    db,
    "readathonV2_schools",
    schoolId,
    "prizeCatalog"
  );

  const qRef = query(
    prizeCatalogRef,
    where("active", "==", true),
    orderBy("price", "asc"),
    orderBy("donationsNeeded", "asc"),
    orderBy("sort", "asc")
  );

  const snap = await getDocs(qRef);

  const rows = snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};

    return {
      id: String(data.prizeId || docSnap.id || ""),
      image: String(data.image || "").trim(),
      name: String(data.name || "Prize").trim(),
      price: Number(data.price || 0),
      donationsNeeded: Number(data.donationsNeeded || 0),
      category: String(data.category || "General"),
      shelf: String(data.shelf || "Shelf 1"),
      description: String(data.description || ""),
      misc: String(data.misc || ""),
    };
  });

  setStatus(`${rows.length} prizes loaded.`);

  return rows;
}

function populateCategoryFilter(prizes) {
  if (!els.categoryFilter) return;

  const categories = [...new Set(prizes.map((p) => p.category))];

  els.categoryFilter.innerHTML = `
    <option value="all">All Categories</option>
  `;

  for (const category of categories) {
    const opt = document.createElement("option");
    opt.value = category;
    opt.textContent = category;
    els.categoryFilter.appendChild(opt);
  }
}

function applyFilters() {
  const selectedCategory = els.categoryFilter?.value || "all";

  const searchTerm = (
    els.searchInput?.value || ""
  ).toLowerCase();

  state.filteredPrizes = state.allPrizes.filter((prize) => {
    const categoryMatch =
      selectedCategory === "all" ||
      prize.category === selectedCategory;

    const textMatch = [
      prize.name,
      prize.description,
      prize.category,
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm);

    return categoryMatch && textMatch;
  });

  renderPrizeRows();
}

function renderPrizeRows() {
  if (!els.prizeShelfGrid) return;

  els.prizeShelfGrid.innerHTML = "";

  const grouped = new Map();

  for (const prize of state.filteredPrizes) {
    const priceCents = normalizePriceToCents(prize.price);

    if (!grouped.has(priceCents)) {
      grouped.set(priceCents, []);
    }

    grouped.get(priceCents).push(prize);
  }

  for (const [priceCents, prizes] of grouped.entries()) {
    const section = document.createElement("section");
    section.className = "prize-tier-row";

    const heading = document.createElement("h2");

    heading.className = "tier-title";

    heading.textContent = `Prize Row • ${formatMoneyCents(priceCents)}`;

    const carousel = document.createElement("div");
    carousel.className = "prize-carousel";

    for (const prize of prizes) {
      carousel.appendChild(buildPrizeCard(prize));
    }

    section.appendChild(heading);
    section.appendChild(carousel);

    els.prizeShelfGrid.appendChild(section);
  }
}

function buildPrizeCard(prize) {
  const tpl = els.prizeCardTemplate.content.cloneNode(true);

  const card = tpl.querySelector(".prize-card");
  const image = tpl.querySelector(".prize-image");
  const name = tpl.querySelector(".prize-name");
  const description = tpl.querySelector(".prize-description");
  const misc = tpl.querySelector(".prize-misc");
  const price = tpl.querySelector(".prize-price");
  const donations = tpl.querySelector(".prize-donations");
  const addBtn = tpl.querySelector(".add-to-cart-btn");
  const lockOverlay = tpl.querySelector(".prize-lock-overlay");
  const lockSubtitle = tpl.querySelector(".lock-subtitle");

  const priceCents = normalizePriceToCents(prize.price);

  const canAfford = state.availableToSpendCents >= priceCents;

  image.src = prize.image || "../img/prizes/placeholder-prize.png";
  name.textContent = prize.name;
  description.textContent = prize.description;
  misc.textContent = prize.misc;
  price.textContent = formatMoneyCents(priceCents);
  donations.textContent = formatMoney(prize.donationsNeeded);

  if (!canAfford) {
    card.classList.add("prize-card--locked");

    const needed = priceCents - state.availableToSpendCents;

    lockSubtitle.textContent = `Need ${formatMoneyCents(needed)} more`;

    addBtn.disabled = true;
    addBtn.textContent = "Locked";
  } else {
    lockOverlay.remove();

    addBtn.addEventListener("click", () => {
      addPrizeToCart(prize);
    });
  }

  return tpl.firstElementChild;
}

function addPrizeToCart(prize) {
  const priceCents = normalizePriceToCents(prize.price);

  const currentTotal = getCartTotal();

  if (currentTotal + priceCents > state.availableToSpendCents) {
    alert("You do not have enough available prize credit.");
    return;
  }

  state.cart.push(prize);

  renderCart();
}

function renderCart() {
  if (!els.cartItems) return;

  els.cartItems.innerHTML = "";

  if (!state.cart.length) {
    els.cartItems.innerHTML = `
      <div class="cart-empty">
        Your cart is empty.
      </div>
    `;
  }

  state.cart.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cart-item";

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.name)}</strong>
      </div>

      <div class="cart-right">
        <span>${formatMoney(item.price)}</span>

        <button class="remove-cart-btn">
          Remove
        </button>
      </div>
    `;

    row
      .querySelector(".remove-cart-btn")
      .addEventListener("click", () => {
        state.cart.splice(index, 1);
        renderCart();
      });

    els.cartItems.appendChild(row);
  });

  if (els.cartCount) {
    els.cartCount.textContent = `${state.cart.length} Items`;
  }

  if (els.cartTotal) {
    els.cartTotal.textContent = formatMoneyCents(getCartTotal());
  }
}

async function submitCart() {
  await waitForAuthReady();

  if (!auth.currentUser) {
    alert("Please sign in again before requesting prizes.");
    window.location.href = "../html/student-login.html";
    return;
  }

  if (!state.cart.length) {
    alert("Your cart is empty.");
    return;
  }

  const cartTotal = getCartTotal();

  if (cartTotal > state.availableToSpendCents) {
    alert("You do not have enough available prize credit for this cart.");
    return;
  }

  els.submitCartBtn.disabled = true;
  els.submitCartBtn.textContent = "Submitting...";

  try {
    for (const prize of state.cart) {
      await fnRedeemPrizeCredit({
        schoolId: state.schoolId,
        prizeId: prize.id,
        quantity: 1,
      });

      state.pendingOrders.push(prize);
    }

    state.cart = [];

    await loadStudentStoreSummary();

    renderCart();
    renderPendingOrders();
    applyFilters();

    setStatus("Prize requests submitted successfully.");
  } catch (error) {
    console.error(error);

    alert(
      error?.message ||
      "Unable to submit requests. Please try signing in again."
    );
  } finally {
    els.submitCartBtn.disabled = false;
    els.submitCartBtn.textContent = "Submit Prize Requests";
  }
}

function renderPendingOrders() {
  if (!els.pendingOrdersList) return;

  els.pendingOrdersList.innerHTML = "";

  if (!state.pendingOrders.length) {
    els.pendingOrdersList.innerHTML = `
      <div class="pending-empty">
        No pending prize requests yet.
      </div>
    `;
  }

  for (const order of state.pendingOrders) {
    const row = document.createElement("div");
    row.className = "pending-order-item";

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(order.name)}</strong>
      </div>

      <span class="pending-badge">
        Pending
      </span>
    `;

    els.pendingOrdersList.appendChild(row);
  }

  if (els.pendingOrdersCount) {
    els.pendingOrdersCount.textContent = `${state.pendingOrders.length} Pending`;
  }
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => {
    return sum + normalizePriceToCents(item.price);
  }, 0);
}

function setStatus(message) {
  if (els.storeStatus) {
    els.storeStatus.textContent = message;
  }
}

function normalizePriceToCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function formatMoneyCents(value) {
  const dollars = Number(value || 0) / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}