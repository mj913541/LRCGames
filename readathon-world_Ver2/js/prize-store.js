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
} from "./firebase.js";

const els = {
  title: document.querySelector("[data-title]"),
  subtitle: document.querySelector("[data-subtitle]"),
  schoolIdDisplay: document.getElementById("schoolIdDisplay"),
  currentDonationsDisplay: document.getElementById("currentDonationsDisplay"),
  currentCreditsDisplay: document.getElementById("currentCreditsDisplay"),
  categoryFilter: document.getElementById("categoryFilter"),
  searchInput: document.getElementById("searchInput"),
  storeStatus: document.getElementById("storeStatus"),
  prizeShelfGrid: document.getElementById("prizeShelfGrid"),
  prizeCardTemplate: document.getElementById("prizeCardTemplate"),
};

const state = {
  schoolId: "",
  userId: "",
  summary: null,
  donationsRaisedCents: 0,
  storeCredit: 0,
  allPrizes: [],
  filteredPrizes: [],
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

  populateCategoryFilter(prizes);
  applyFilters();
}

function setHeader() {
  if (els.title) {
    els.title.textContent = "Prize Store";
  }

  if (els.subtitle) {
    els.subtitle.textContent =
      "Raise donations to unlock prize rows. Your prize store credit is 20% of what you raise.";
  }
}

function bindUi() {
  if (els.categoryFilter) {
    els.categoryFilter.addEventListener("change", applyFilters);
  }

  if (els.searchInput) {
    els.searchInput.addEventListener("input", applyFilters);
  }
}

function resolveSchoolId() {
  return getSchoolId() || DEFAULT_SCHOOL_ID;
}

async function loadStudentStoreSummary() {
  await waitForAuthReady();

  const user = auth.currentUser;
  if (!user) {
    setStatus("Please sign in to view your donations and store credit.");
    updateSummaryDisplays();
    return;
  }

  state.userId = user.uid;

  try {
    const summary = await fetchUserSummary(state.schoolId, state.userId);
    state.summary = summary || null;

    const moneyRaisedCents = Number(summary?.moneyRaisedCents || 0);
    state.donationsRaisedCents = moneyRaisedCents;

    // 20% of donations raised
    // Example: $100 raised => 20 store credits
    state.storeCredit = Math.floor(moneyRaisedCents / 500);

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

  if (els.currentCreditsDisplay) {
    els.currentCreditsDisplay.textContent = formatNumber(state.storeCredit);
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
    active: raw.active === true,
  };
}

function populateCategoryFilter(prizes) {
  if (!els.categoryFilter) return;

  const categories = [...new Set(prizes.map((p) => p.category).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );

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
    const key = Number(prize.price || 0);

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(prize);
  }

  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([price, items]) => {
      const sortedItems = [...items].sort((a, b) => {
        const donationDiff = Number(a.donationsNeeded || 0) - Number(b.donationsNeeded || 0);
        if (donationDiff !== 0) return donationDiff;
        return Number(a.sort || 9999) - Number(b.sort || 9999);
      });

      const minDonationsNeeded = getTierMinDonation(sortedItems, price);

      return {
        price,
        donationsNeeded: minDonationsNeeded,
        items: sortedItems,
      };
    });
}

function getTierMinDonation(items, price) {
  const explicit = items
    .map((item) => Number(item.donationsNeeded || 0))
    .filter((value) => value > 0);

  if (explicit.length) {
    return Math.min(...explicit);
  }

  // Fallback based on store credit rule:
  // store credit = 20% of donations
  // price credits -> roughly price * 5 dollars raised
  return Number(price || 0) * 5;
}

function buildTierRow(tier) {
  const section = document.createElement("section");
  section.className = "prize-tier-row";
  section.dataset.priceTier = String(tier.price);

  const header = document.createElement("div");
  header.className = "prize-tier-header";

  const heading = document.createElement("h2");
  heading.className = "prize-tier-heading";
  heading.textContent = `Raise $${formatNumber(tier.donationsNeeded)} to choose from this row`;

  const subtitle = document.createElement("p");
  subtitle.className = "prize-tier-subtitle";
  subtitle.textContent = `These prizes cost ${formatNumber(tier.price)} credit${
    tier.price === 1 ? "" : "s"
  }. You currently have ${formatNumber(state.storeCredit)}.`;

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
  const price = tpl.querySelector(".prize-price");
  const donations = tpl.querySelector(".prize-donations");

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

  if (description) {
    description.textContent = prize.description || "No description available.";
  }

  if (price) {
    price.textContent = formatNumber(prize.price);
  }

  if (donations) {
    donations.textContent = `$${formatNumber(prize.donationsNeeded)}`;
  }

  if (card) {
    card.dataset.prizeId = prize.id;
    card.dataset.category = prize.category;
    card.dataset.shelf = prize.shelf;
    card.dataset.price = String(prize.price || 0);
    card.dataset.donationsNeeded = String(prize.donationsNeeded || 0);
  }

  return tpl.firstElementChild;
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

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatMoneyCents(value) {
  const dollars = Number(value || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}