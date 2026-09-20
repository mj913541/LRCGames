
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
  role: "",
  summary: null,

  donationsRaisedCents: 0,
  totalAllowedCents: 0,
  alreadySpentCents: 0,
  availableToSpendCents: 0,

  allPrizes: [],
  filteredPrizes: [],

  cart: [],
  pendingOrders: [],
};

init().catch((error) => {
  console.error("Prize store init failed:", error);
  setStatus("Unable to load prize store.");
  renderEmpty("Could not load the prize store.");
});

async function init() {
  setHeader();

  state.schoolId = getSchoolId() || DEFAULT_SCHOOL_ID;

  if (els.schoolIdDisplay) {
    els.schoolIdDisplay.textContent = state.schoolId;
  }

  bindUi();

  await waitForAuthReady();

  if (!auth.currentUser) {
    setStatus("Please sign in to request prizes.");
    updateSummaryDisplays();
    renderEmpty("Please sign in to view the prize store.");
    return;
  }

  state.userId = auth.currentUser.uid;

  const token = await auth.currentUser.getIdTokenResult(true);
  state.role = token?.claims?.role || "";

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

  if (!auth.currentUser) {
    setStatus("Please sign in to view your prize balance.");
    updateSummaryDisplays();
    return;
  }

  state.userId = auth.currentUser.uid;

  try {
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
    state.totalAllowedCents = totalAllowedCents;
    state.alreadySpentCents = alreadySpentCents;
    state.availableToSpendCents = Math.max(0, totalAllowedCents - alreadySpentCents);

    updateSummaryDisplays();
  } catch (error) {
    console.error("Failed to load student summary:", error);
    setStatus("Could not load your prize balance yet.");
    updateSummaryDisplays();
  }
}

async function loadPendingOrders() {
  // This is a safe placeholder for now.
  // Your Firestore rules currently only allow admins to LIST all prizeOrders.
  // Later, we can add a Cloud Function to return this user's pending orders.
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

    return normalizePrize({
      id: docSnap.id,
      ...data,
    });
  });

  setStatus(`${rows.length} active prize${rows.length === 1 ? "" : "s"} loaded.`);
  return rows;
}

function normalizePrize(raw) {
  return {
    id: String(raw.prizeId || raw.id || "").trim(),
    image: String(raw.image || "").trim(),
    name: String(raw.name || "Untitled Prize").trim(),
    price: Number(raw.price || 0),
    donationsNeeded: Number(raw.donationsNeeded || 0),
    shelf: String(raw.shelf || "Shelf 1").trim(),
    sort: Number(raw.sort || 9999),
    category: String(raw.category || "General").trim(),
    description: String(raw.description || "").trim(),
    misc: String(raw.misc || "Quantity, color, style, and exact item may vary from the picture.").trim(),
    active: raw.active === true,
  };
}

function populateCategoryFilter(prizes) {
  if (!els.categoryFilter) return;

  const categories = [...new Set(prizes.map((p) => p.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  els.categoryFilter.innerHTML = `<option value="all">All Categories</option>`;

  for (const category of categories) {
    const opt = document.createElement("option");
    opt.value = category;
    opt.textContent = category;
    els.categoryFilter.appendChild(opt);
  }
}

function applyFilters() {
  const selectedCategory = els.categoryFilter?.value || "all";
  const searchTerm = (els.searchInput?.value || "").trim().toLowerCase();

  state.filteredPrizes = state.allPrizes.filter((prize) => {
    const matchesCategory =
      selectedCategory === "all" || prize.category === selectedCategory;

    const haystack = [
      prize.name,
      prize.description,
      prize.misc,
      prize.category,
      prize.shelf,
      String(prize.price || ""),
      String(prize.donationsNeeded || ""),
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchTerm || haystack.includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  renderPrizeTiers(state.filteredPrizes);
}

function renderPrizeTiers(prizes) {
  if (!els.prizeShelfGrid) return;

  els.prizeShelfGrid.innerHTML = "";

  if (!prizes.length) {
    renderEmpty("No prizes match your current filters.");
    return;
  }

  const grouped = groupPrizesByPrice(prizes);
  const frag = document.createDocumentFragment();

  for (const tier of grouped) {
    frag.appendChild(buildTierRow(tier));
  }

  els.prizeShelfGrid.appendChild(frag);
}

function groupPrizesByPrice(prizes) {
  const map = new Map();

  for (const prize of prizes) {
    const priceCents = normalizePriceToCents(prize.price);

    if (!map.has(priceCents)) {
      map.set(priceCents, []);
    }

    map.get(priceCents).push({
      ...prize,
      priceCents,
    });
  }

  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([priceCents, items]) => {
      const sortedItems = [...items].sort((a, b) => {
        const donationDiff =
          Number(a.donationsNeeded || 0) - Number(b.donationsNeeded || 0);
        if (donationDiff !== 0) return donationDiff;
        return Number(a.sort || 9999) - Number(b.sort || 9999);
      });

      const minDonationsNeeded = getTierMinDonation(sortedItems, priceCents);

      return {
        priceCents,
        donationsNeeded: minDonationsNeeded,
        items: sortedItems,
      };
    });
}

function getTierMinDonation(items, priceCents) {
  const explicit = items
    .map((item) => Number(item.donationsNeeded || 0))
    .filter((value) => value > 0);

  if (explicit.length) {
    return Math.min(...explicit);
  }

  return (Number(priceCents || 0) / 100) * 5;
}

function buildTierRow(tier) {
  const section = document.createElement("section");
  section.className = "prize-tier-row";
  section.dataset.priceTier = String(tier.priceCents);

  const tierUnlocked = state.availableToSpendCents >= tier.priceCents;
  if (tierUnlocked) {
    section.classList.add("prize-tier-row--unlocked");
  }

  const header = document.createElement("div");
  header.className = "prize-tier-header";

  const heading = document.createElement("h2");
  heading.className = "prize-tier-heading tier-title";
  heading.textContent = `Raise ${formatMoney(tier.donationsNeeded)} to choose from this row`;

  const subtitle = document.createElement("p");
  subtitle.className = "prize-tier-subtitle";
  subtitle.textContent = `These prizes cost ${formatMoneyCents(
    tier.priceCents
  )} each. You currently have ${formatMoneyCents(
    state.availableToSpendCents
  )} available to spend.`;

  header.appendChild(heading);
  header.appendChild(subtitle);

  const carousel = document.createElement("div");
  carousel.className = "prize-carousel";

  for (const prize of tier.items) {
    carousel.appendChild(buildPrizeCard(prize));
  }

  section.appendChild(header);
  section.appendChild(carousel);

  return section;
}

function buildPrizeCard(prize) {
  const tpl = els.prizeCardTemplate?.content.cloneNode(true);

  if (!tpl) {
    const fallback = document.createElement("div");
    fallback.textContent = prize.name;
    return fallback;
  }

  const card = tpl.querySelector(".prize-card");
  const image = tpl.querySelector(".prize-image");
  const category = tpl.querySelector(".prize-category");
  const shelf = tpl.querySelector(".prize-shelf");
  const name = tpl.querySelector(".prize-name");
  const description = tpl.querySelector(".prize-description");
  const misc = tpl.querySelector(".prize-misc");
  const price = tpl.querySelector(".prize-price");
  const donations = tpl.querySelector(".prize-donations");
  const addBtn = tpl.querySelector(".add-to-cart-btn");
  const lockOverlay = tpl.querySelector(".prize-lock-overlay");
  const lockSubtitle = tpl.querySelector(".lock-subtitle");

  const priceCents = normalizePriceToCents(prize.price);
  const cartTotal = getCartTotal();
  const canAfford = state.availableToSpendCents >= priceCents;
  const canAffordWithCart = state.availableToSpendCents >= cartTotal + priceCents;

  if (image) {
    image.src = prize.image || "../img/prizes/placeholder-prize.png";
    image.alt = prize.name || "Prize image";

    image.addEventListener("error", () => {
      image.src = "../img/prizes/placeholder-prize.png";
    });
  }

  if (category) category.textContent = prize.category || "General";
  if (shelf) shelf.textContent = prize.shelf || "Shelf";
  if (name) name.textContent = prize.name || "Untitled Prize";
  if (description) description.textContent = prize.description || "No description available.";
  if (misc) misc.textContent = prize.misc || "Quantity, color, style, and exact item may vary from the picture.";
  if (price) price.textContent = formatMoneyCents(priceCents);
  if (donations) donations.textContent = formatMoney(prize.donationsNeeded);

  if (card) {
    card.dataset.prizeId = prize.id;
    card.dataset.category = prize.category;
    card.dataset.shelf = prize.shelf;
    card.dataset.price = String(prize.price || 0);
    card.dataset.donationsNeeded = String(prize.donationsNeeded || 0);
  }

  if (!canAfford) {
    const neededCents = Math.max(0, priceCents - state.availableToSpendCents);

    card?.classList.add("prize-card--locked");

    if (lockSubtitle) {
      lockSubtitle.textContent = `Need ${formatMoneyCents(neededCents)} more`;
    }

    if (addBtn) {
      addBtn.disabled = true;
      addBtn.textContent = "Locked";
    }
  } else if (!canAffordWithCart) {
    if (lockOverlay) lockOverlay.remove();

    card?.classList.add("prize-card--affordable");

    if (addBtn) {
      addBtn.disabled = true;
      addBtn.textContent = "Cart Too Full";
    }
  } else {
    if (lockOverlay) lockOverlay.remove();

    card?.classList.add("prize-card--affordable");

    if (addBtn) {
      addBtn.disabled = false;
      addBtn.textContent = "Add To Cart";
      addBtn.addEventListener("click", () => addPrizeToCart(prize));
    }
  }

  return tpl.firstElementChild;
}

function addPrizeToCart(prize) {
  const priceCents = normalizePriceToCents(prize.price);
  const nextTotal = getCartTotal() + priceCents;

  if (nextTotal > state.availableToSpendCents) {
    alert("You do not have enough available prize credit for that item.");
    return;
  }

  state.cart.push(prize);

  renderCart();
  applyFilters();
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
  } else {
    state.cart.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "cart-item";

      row.innerHTML = `
        <div>
          <strong>${escapeHtml(item.name)}</strong>
        </div>

        <div class="cart-right">
          <span>${formatMoney(item.price)}</span>
          <button class="remove-cart-btn" type="button">Remove</button>
        </div>
      `;

      row.querySelector(".remove-cart-btn")?.addEventListener("click", () => {
        state.cart.splice(index, 1);
        renderCart();
        applyFilters();
      });

      els.cartItems.appendChild(row);
    });
  }

  if (els.cartCount) {
    els.cartCount.textContent = `${state.cart.length} Item${state.cart.length === 1 ? "" : "s"}`;
  }

  if (els.cartTotal) {
    els.cartTotal.textContent = formatMoneyCents(getCartTotal());
  }

  if (els.submitCartBtn) {
    els.submitCartBtn.disabled = state.cart.length === 0;
  }
}

async function submitCart() {
  await waitForAuthReady();

  const currentUser = auth.currentUser;

  if (!currentUser) {
    alert("Please sign in again before requesting prizes.");
    window.location.href = "../html/student-login.html";
    return;
  }

  await currentUser.getIdToken(true);

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

      state.pendingOrders.push({
        ...prize,
        status: "pending",
      });
    }

    state.cart = [];

    await loadStudentStoreSummary();

    renderCart();
    renderPendingOrders();
    applyFilters();

    setStatus("Prize requests submitted successfully.");
  } catch (error) {
    console.error("Prize request failed:", error);

    alert(
      error?.message ||
      "Unable to submit prize requests. Please try signing in again."
    );
  } finally {
    els.submitCartBtn.disabled = state.cart.length === 0;
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
  } else {
    for (const order of state.pendingOrders) {
      const row = document.createElement("div");
      row.className = "pending-order-item";

      row.innerHTML = `
        <div>
          <strong>${escapeHtml(order.name)}</strong>
        </div>

        <span class="pending-badge">Pending</span>
      `;

      els.pendingOrdersList.appendChild(row);
    }
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

function renderEmpty(message) {
  if (!els.prizeShelfGrid) return;

  els.prizeShelfGrid.innerHTML = `
    <div class="empty-state">${escapeHtml(message)}</div>
  `;
}

function setStatus(message) {
  if (els.storeStatus) {
    els.storeStatus.textContent = message;
  }
}

function normalizePriceToCents(value) {
  const amount = Number(value || 0);
  return Math.round(amount * 100);
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