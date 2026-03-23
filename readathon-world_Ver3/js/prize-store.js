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
  remainingAfterCartDisplay: document.getElementById("remainingAfterCartDisplay"),
  categoryFilter: document.getElementById("categoryFilter"),
  searchInput: document.getElementById("searchInput"),
  storeStatus: document.getElementById("storeStatus"),
  prizeShelfGrid: document.getElementById("prizeShelfGrid"),
  prizeCardTemplate: document.getElementById("prizeCardTemplate"),

  cartList: document.getElementById("cartList"),
  cartEmptyState: document.getElementById("cartEmptyState"),
  cartTotalDisplay: document.getElementById("cartTotalDisplay"),
  cartAvailableDisplay: document.getElementById("cartAvailableDisplay"),
  cartRemainingDisplay: document.getElementById("cartRemainingDisplay"),
  clearCartBtn: document.getElementById("clearCartBtn"),
  submitCartBtn: document.getElementById("submitCartBtn"),
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
  isSubmittingCart: false,
};

init().catch((error) => {
  console.error("Prize store init failed:", error);
  setStatus("Unable to load prize store.");
  renderEmpty("Could not load the prize store.");
});

async function init() {
  setHeader();

  state.schoolId = resolveSchoolId();

  if (!state.schoolId) {
    setStatus("Missing schoolId.");
    renderEmpty("No school selected.");
    return;
  }

  if (els.schoolIdDisplay) {
    els.schoolIdDisplay.textContent = state.schoolId;
  }

  bindUi();

  await loadStudentStoreSummary();
  const prizes = await loadPrizeCatalog(state.schoolId);

  state.allPrizes = prizes;
  state.filteredPrizes = prizes;

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
      "Raise donations to unlock prize rows. Add prizes to your cart and submit one request without going over budget.";
  }
}

function bindUi() {
  if (els.categoryFilter) {
    els.categoryFilter.addEventListener("change", applyFilters);
  }

  if (els.searchInput) {
    els.searchInput.addEventListener("input", applyFilters);
  }

  if (els.clearCartBtn) {
    els.clearCartBtn.addEventListener("click", () => {
      state.cart = [];
      renderCart();
      applyFilters();
      setStatus("Cart cleared.");
    });
  }

  if (els.submitCartBtn) {
    els.submitCartBtn.addEventListener("click", submitCart);
  }
}

function resolveSchoolId() {
  return getSchoolId() || DEFAULT_SCHOOL_ID;
}

async function loadStudentStoreSummary() {
  await waitForAuthReady();

  const user = auth.currentUser;
  if (!user) {
    setStatus("Please sign in to view your donations and available amount.");
    updateSummaryDisplays();
    return;
  }

  state.userId = user.uid;

  try {
    const summary = await fetchUserSummary(state.schoolId, state.userId);
    state.summary = summary || null;

    const moneyRaisedCents = Number(summary?.moneyRaisedCents || 0);
    state.donationsRaisedCents = moneyRaisedCents;
    state.availableToSpendCents = Math.floor(moneyRaisedCents * 0.2);

    updateSummaryDisplays();
  } catch (error) {
    console.error("Failed to load student summary:", error);
    updateSummaryDisplays();
  }
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

  const remaining = getRemainingSpendCents();

  if (els.remainingAfterCartDisplay) {
    els.remainingAfterCartDisplay.textContent = formatMoneyCents(remaining);
  }

  if (els.cartAvailableDisplay) {
    els.cartAvailableDisplay.textContent = formatMoneyCents(
      state.availableToSpendCents
    );
  }

  if (els.cartTotalDisplay) {
    els.cartTotalDisplay.textContent = formatMoneyCents(getCartTotalCents());
  }

  if (els.cartRemainingDisplay) {
    els.cartRemainingDisplay.textContent = formatMoneyCents(remaining);
  }
}

async function loadPrizeCatalog(schoolId) {
  setStatus("Loading prize catalog.");

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
    misc: String(raw.misc || "").trim(),
    active: raw.active === true || raw.active === undefined,
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
  updateSummaryDisplays();
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

  const tierUnlocked = getRemainingSpendCents() >= tier.priceCents;
  if (tierUnlocked) {
    section.classList.add("prize-tier-row--unlocked");
  }

  const header = document.createElement("div");
  header.className = "prize-tier-header";

  const heading = document.createElement("h2");
  heading.className = "prize-tier-heading";
  heading.textContent = `Raise ${formatMoney(tier.donationsNeeded)} to choose from this row`;

  const subtitle = document.createElement("p");
  subtitle.className = "prize-tier-subtitle";
  subtitle.textContent = `These prizes cost ${formatMoneyCents(
    tier.priceCents
  )} each. You currently have ${formatMoneyCents(
    getRemainingSpendCents()
  )} remaining to spend.`;

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
  const qtyValue = tpl.querySelector(".qty-value");
  const qtyMinus = tpl.querySelector(".qty-minus");
  const qtyPlus = tpl.querySelector(".qty-plus");
  const requestBtn = tpl.querySelector(".prize-request-btn");

  const priceCents = normalizePriceToCents(prize.price);
  const remainingSpendCents = getRemainingSpendCents();
  const currentCartQty = getCartQuantity(prize.id);
  const maxAddableQuantity =
    priceCents > 0 ? Math.floor(remainingSpendCents / priceCents) : 0;

  let quantity = Math.max(1, Math.min(1, maxAddableQuantity || 1));

  if (image) {
    image.src = prize.image || "../img/prizes/placeholder-prize.png";
    image.alt = prize.name || "Prize image";

    image.addEventListener("error", () => {
      image.src = "../img/prizes/placeholder-prize.png";
    });
  }

  if (category) category.textContent = prize.category || "";
  if (shelf) shelf.textContent = prize.shelf || "";
  if (name) name.textContent = prize.name || "Untitled Prize";

  if (description) {
    description.textContent = prize.description || "No description available.";
  }

  if (misc) {
    misc.textContent =
      prize.misc || "Quantity, color, style, and exact item may vary from the picture.";
  }

  if (price) {
    price.textContent = formatMoneyCents(priceCents);
  }

  if (donations) {
    donations.textContent = formatMoney(prize.donationsNeeded);
  }

  if (card) {
    card.dataset.prizeId = prize.id;
    card.dataset.category = prize.category;
    card.dataset.shelf = prize.shelf;
    card.dataset.price = String(prize.price || 0);
    card.dataset.donationsNeeded = String(prize.donationsNeeded || 0);

    if (maxAddableQuantity > 0) {
      card.classList.add("prize-card--affordable");
    } else {
      card.classList.add("prize-card--locked");
    }

    if (currentCartQty > 0) {
      card.classList.add("prize-card--in-cart");
    }
  }

  function updateQuantityUI() {
    if (qtyValue) {
      qtyValue.textContent = String(quantity);
    }

    if (qtyMinus) {
      qtyMinus.disabled = quantity <= 1;
    }

    if (qtyPlus) {
      qtyPlus.disabled = quantity >= Math.max(1, maxAddableQuantity);
    }

    if (requestBtn) {
      if (maxAddableQuantity <= 0) {
        requestBtn.textContent =
          currentCartQty > 0 ? `In Cart: ${currentCartQty}` : "Not Enough Left";
        requestBtn.disabled = true;
      } else {
        requestBtn.textContent =
          currentCartQty > 0
            ? `Add to Cart (${currentCartQty} already)`
            : "Add to Cart";
        requestBtn.disabled = false;
      }
    }
  }

  if (qtyMinus) {
    qtyMinus.addEventListener("click", () => {
      if (quantity > 1) {
        quantity -= 1;
        updateQuantityUI();
      }
    });
  }

  if (qtyPlus) {
    qtyPlus.addEventListener("click", () => {
      if (quantity < maxAddableQuantity) {
        quantity += 1;
        updateQuantityUI();
      }
    });
  }

  if (requestBtn) {
    requestBtn.addEventListener("click", () => {
      if (maxAddableQuantity <= 0) return;

      const addQty = Math.min(quantity, maxAddableQuantity);
      if (addQty <= 0) return;

      addToCart(prize, addQty);
      setStatus(`Added ${addQty} ${prize.name}${addQty === 1 ? "" : "s"} to your cart.`);
    });
  }

  updateQuantityUI();

  return tpl.firstElementChild;
}

function addToCart(prize, quantityToAdd) {
  const priceCents = normalizePriceToCents(prize.price);
  if (!(priceCents > 0) || quantityToAdd <= 0) return;

  const maxAddable =
    priceCents > 0 ? Math.floor(getRemainingSpendCents() / priceCents) : 0;

  const safeQty = Math.min(quantityToAdd, maxAddable);
  if (safeQty <= 0) return;

  const existing = state.cart.find((item) => item.prizeId === prize.id);

  if (existing) {
    existing.quantity += safeQty;
  } else {
    state.cart.push({
      prizeId: prize.id,
      prizeName: prize.name,
      image: prize.image || "",
      priceCents,
      quantity: safeQty,
      category: prize.category || "",
    });
  }

  renderCart();
  applyFilters();
}

function getCartQuantity(prizeId) {
  const item = state.cart.find((entry) => entry.prizeId === prizeId);
  return item ? Number(item.quantity || 0) : 0;
}

function getCartTotalCents() {
  return state.cart.reduce((sum, item) => {
    return sum + Number(item.priceCents || 0) * Number(item.quantity || 0);
  }, 0);
}

function getRemainingSpendCents() {
  return Math.max(0, state.availableToSpendCents - getCartTotalCents());
}

function renderCart() {
  if (!els.cartList) return;

  els.cartList.innerHTML = "";

  if (els.cartEmptyState) {
    els.cartEmptyState.hidden = state.cart.length > 0;
  }

  const frag = document.createDocumentFragment();

  for (const item of state.cart) {
    frag.appendChild(buildCartItem(item));
  }

  els.cartList.appendChild(frag);

  if (els.submitCartBtn) {
    els.submitCartBtn.disabled =
      state.isSubmittingCart || state.cart.length === 0 || getCartTotalCents() <= 0;
    els.submitCartBtn.textContent = state.isSubmittingCart
      ? "Submitting..."
      : "Submit Prize Request";
  }

  if (els.clearCartBtn) {
    els.clearCartBtn.disabled = state.isSubmittingCart || state.cart.length === 0;
  }

  updateSummaryDisplays();
}

function buildCartItem(item) {
  const row = document.createElement("div");
  row.className = "cart-item";

  const main = document.createElement("div");
  main.className = "cart-item__main";

  const title = document.createElement("p");
  title.className = "cart-item__name";
  title.textContent = item.prizeName;

  const meta = document.createElement("div");
  meta.className = "cart-item__meta";
  meta.textContent = `${formatMoneyCents(item.priceCents)} each`;

  main.appendChild(title);
  main.appendChild(meta);

  const right = document.createElement("div");
  right.className = "cart-item__right";

  const total = document.createElement("div");
  total.className = "cart-item__total";
  total.textContent = formatMoneyCents(item.priceCents * item.quantity);

  const controls = document.createElement("div");
  controls.className = "cart-item__controls";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.className = "cart-mini-btn";
  minusBtn.textContent = "-";
  minusBtn.disabled = state.isSubmittingCart;
  minusBtn.addEventListener("click", () => {
    updateCartItemQuantity(item.prizeId, item.quantity - 1);
  });

  const qty = document.createElement("span");
  qty.className = "qty-value";
  qty.textContent = String(item.quantity);

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.className = "cart-mini-btn";
  plusBtn.textContent = "+";
  plusBtn.disabled =
    state.isSubmittingCart || getRemainingSpendCents() < item.priceCents;
  plusBtn.addEventListener("click", () => {
    updateCartItemQuantity(item.prizeId, item.quantity + 1);
  });

  controls.appendChild(minusBtn);
  controls.appendChild(qty);
  controls.appendChild(plusBtn);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "cart-remove-btn";
  removeBtn.textContent = "Remove";
  removeBtn.disabled = state.isSubmittingCart;
  removeBtn.addEventListener("click", () => {
    removeFromCart(item.prizeId);
  });

  right.appendChild(total);
  right.appendChild(controls);
  right.appendChild(removeBtn);

  row.appendChild(main);
  row.appendChild(right);

  return row;
}

function updateCartItemQuantity(prizeId, nextQuantity) {
  const item = state.cart.find((entry) => entry.prizeId === prizeId);
  if (!item) return;

  if (nextQuantity <= 0) {
    removeFromCart(prizeId);
    return;
  }

  if (nextQuantity > item.quantity) {
    const extraNeeded = nextQuantity - item.quantity;
    const maxExtra =
      item.priceCents > 0
        ? Math.floor(getRemainingSpendCents() / item.priceCents)
        : 0;

    item.quantity += Math.min(extraNeeded, maxExtra);
  } else {
    item.quantity = nextQuantity;
  }

  renderCart();
  applyFilters();
}

function removeFromCart(prizeId) {
  state.cart = state.cart.filter((entry) => entry.prizeId !== prizeId);
  renderCart();
  applyFilters();
}

async function submitCart() {
  if (state.isSubmittingCart) return;

  if (!state.userId) {
    setStatus("Please sign in first.");
    return;
  }

  if (!state.cart.length) {
    setStatus("Your cart is empty.");
    return;
  }

  if (getCartTotalCents() > state.availableToSpendCents) {
    setStatus("Your cart is over budget.");
    return;
  }

  state.isSubmittingCart = true;
  renderCart();
  setStatus("Submitting your prize request...");

  try {
    for (const item of state.cart) {
      for (let i = 0; i < item.quantity; i += 1) {
        await fnRedeemPrizeCredit({
          schoolId: state.schoolId,
          prizeId: item.prizeId,
        });
      }
    }

    state.cart = [];
    await loadStudentStoreSummary();
    applyFilters();
    renderCart();
    setStatus("Your prize request was submitted.");
  } catch (error) {
    console.error("Cart submit failed:", error);
    setStatus(normalizeError(error) || "Could not submit your prize request.");
  } finally {
    state.isSubmittingCart = false;
    renderCart();
  }
}

function renderEmpty(message) {
  if (!els.prizeShelfGrid) return;

  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message || "Nothing to show right now.";

  els.prizeShelfGrid.innerHTML = "";
  els.prizeShelfGrid.appendChild(empty);
}

function setStatus(message) {
  if (els.storeStatus) {
    els.storeStatus.textContent = message || "";
  }
}

function normalizePriceToCents(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;

  if (n >= 1000) return Math.round(n);
  return Math.round(n * 100);
}

function formatMoney(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function formatMoneyCents(cents) {
  const n = Number(cents || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n / 100);
}

function normalizeError(error) {
  return (
    error?.message ||
    error?.details ||
    "Something went wrong. Please try again."
  );
}