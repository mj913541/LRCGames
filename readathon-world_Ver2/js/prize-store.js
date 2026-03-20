// /js/prize-store.js
// Front-end only jungle shelf prize store
// Keeps backend redemption flow untouched.
// Requires:
// - #dataTitle and #dataSubtitle in header
// - [data-title] and [data-subtitle] attributes present
// - existing Firebase/app bootstrapping available globally

(function () {
  "use strict";

  const state = {
    schoolId: null,
    userId: null,
    userProfile: null,
    prizes: [],
    filteredPrizes: [],
    activeQuickFilter: "all",
    activeCategory: "all",
    activeSearch: "",
    shelfOrder: ["shelf1", "shelf2", "shelf3", "shelf4"],
    redeemingPrize: null,
  };

  const els = {
    dataTitle: document.getElementById("dataTitle"),
    dataSubtitle: document.getElementById("dataSubtitle"),

    balanceAmount: document.getElementById("psBalanceAmount"),
    raisedAmount: document.getElementById("psRaisedAmount"),
    spentAmount: document.getElementById("psSpentAmount"),
    nextGoalText: document.getElementById("psNextGoalText"),
    nextGoalFill: document.getElementById("psNextGoalFill"),
    nextGoalHint: document.getElementById("psNextGoalHint"),

    searchInput: document.getElementById("psSearchInput"),
    categoryFilter: document.getElementById("psCategoryFilter"),
    quickFilterButtons: Array.from(document.querySelectorAll(".psQuickFilter")),
    shelfJumpButtons: Array.from(document.querySelectorAll(".psShelfJump")),

    shelf1Track: document.getElementById("psShelf1Track"),
    shelf2Track: document.getElementById("psShelf2Track"),
    shelf3Track: document.getElementById("psShelf3Track"),
    shelf4Track: document.getElementById("psShelf4Track"),

    shelf1Empty: document.getElementById("psShelf1Empty"),
    shelf2Empty: document.getElementById("psShelf2Empty"),
    shelf3Empty: document.getElementById("psShelf3Empty"),
    shelf4Empty: document.getElementById("psShelf4Empty"),

    allShelves: Array.from(document.querySelectorAll("[data-shelf-section]")),

    modal: document.getElementById("psRedeemModal"),
    modalClose: document.getElementById("psRedeemClose"),
    modalCancel: document.getElementById("psRedeemCancel"),
    modalConfirm: document.getElementById("psRedeemConfirm"),
    modalName: document.getElementById("psRedeemPrizeName"),
    modalCost: document.getElementById("psRedeemPrizeCost"),
    modalHint: document.getElementById("psRedeemPrizeHint"),
  };

  const SHELF_CONFIG = {
    shelf1: {
      label: "Quick Finds",
      min: 1,
      max: 5,
      donationsLabel: "$5–$25 raised",
      track: () => els.shelf1Track,
      empty: () => els.shelf1Empty,
    },
    shelf2: {
      label: "Explorer Gear",
      min: 7.5,
      max: 10,
      donationsLabel: "$37.50–$50 raised",
      track: () => els.shelf2Track,
      empty: () => els.shelf2Empty,
    },
    shelf3: {
      label: "Treasure Picks",
      min: 15,
      max: 20,
      donationsLabel: "$75–$100 raised",
      track: () => els.shelf3Track,
      empty: () => els.shelf3Empty,
    },
    shelf4: {
      label: "Legendary Rewards",
      min: 100,
      max: Infinity,
      donationsLabel: "$500+ raised",
      track: () => els.shelf4Track,
      empty: () => els.shelf4Empty,
    },
  };

  const PRICE_GOALS = [1, 1.5, 2.5, 5, 7.5, 10, 15, 20, 100];

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindUI();
    setHeader();
    await loadData();
    renderAll();
  }

  function bindUI() {
    if (els.searchInput) {
      els.searchInput.addEventListener("input", (e) => {
        state.activeSearch = String(e.target.value || "").trim().toLowerCase();
        renderAll();
      });
    }

    if (els.categoryFilter) {
      els.categoryFilter.addEventListener("change", (e) => {
        state.activeCategory = e.target.value || "all";
        renderAll();
      });
    }

    els.quickFilterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        els.quickFilterButtons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.activeQuickFilter = btn.dataset.filter || "all";
        renderAll();
      });
    });

    els.shelfJumpButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        const section = document.querySelector(`[data-shelf-section="${target}"]`);
        if (section) {
          section.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });

    if (els.modalClose) els.modalClose.addEventListener("click", closeRedeemModal);
    if (els.modalCancel) els.modalCancel.addEventListener("click", closeRedeemModal);
    if (els.modal) {
      els.modal.addEventListener("click", (e) => {
        if (e.target === els.modal) closeRedeemModal();
      });
    }
    if (els.modalConfirm) {
      els.modalConfirm.addEventListener("click", confirmRedeem);
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.modal?.classList.contains("is-open")) {
        closeRedeemModal();
      }
    });
  }

  function setHeader() {
    const title = "Prize Store";
    const subtitle = "Explore the jungle shelves and redeem your fundraising rewards.";

    if (els.dataTitle) els.dataTitle.textContent = title;
    if (els.dataSubtitle) els.dataSubtitle.textContent = subtitle;

    document.querySelectorAll("[data-title]").forEach((node) => {
      node.textContent = title;
    });
    document.querySelectorAll("[data-subtitle]").forEach((node) => {
      node.textContent = subtitle;
    });
  }

  async function loadData() {
    try {
      state.schoolId =
        (typeof window.getCurrentSchoolId === "function" && window.getCurrentSchoolId()) ||
        (typeof window.getSchoolId === "function" && window.getSchoolId()) ||
        localStorage.getItem("schoolId") ||
        "";

      state.userId =
        (typeof window.getCurrentUserId === "function" && window.getCurrentUserId()) ||
        (typeof window.getUserId === "function" && window.getUserId()) ||
        localStorage.getItem("uid") ||
        localStorage.getItem("userId") ||
        "";

      state.userProfile = await fetchStudentProfileSafe(state.schoolId, state.userId);
      state.prizes = await fetchPrizesSafe(state.schoolId);

      if (!Array.isArray(state.prizes)) state.prizes = [];
      state.prizes = state.prizes
        .filter((p) => p && p.active !== false)
        .map(normalizePrize);

      buildCategoryFilter();
    } catch (error) {
      console.error("Prize store init error:", error);
      state.userProfile = state.userProfile || {};
      state.prizes = [];
      buildCategoryFilter();
    }
  }

  async function fetchStudentProfileSafe(schoolId, userId) {
    try {
      if (typeof window.fetchStudentProfile === "function") {
        return (await window.fetchStudentProfile(schoolId, userId)) || {};
      }
      if (typeof window.getStudentProfile === "function") {
        return (await window.getStudentProfile(schoolId, userId)) || {};
      }
      return {};
    } catch (error) {
      console.warn("Could not load student profile:", error);
      return {};
    }
  }

  async function fetchPrizesSafe(schoolId) {
    try {
      if (typeof window.fetchAllPrizes === "function") {
        return (await window.fetchAllPrizes(schoolId)) || [];
      }
      if (typeof window.fetchPrizeCatalog === "function") {
        return (await window.fetchPrizeCatalog(schoolId)) || [];
      }
      if (typeof window.getPrizeStoreItems === "function") {
        return (await window.getPrizeStoreItems(schoolId)) || [];
      }
      return [];
    } catch (error) {
      console.warn("Could not load prizes:", error);
      return [];
    }
  }

  function normalizePrize(prize) {
    const price = Number(prize.price || 0);
    const donationsNeeded =
      prize.donationsNeeded != null ? Number(prize.donationsNeeded) : Number((price * 5).toFixed(2));

    return {
      ...prize,
      name: prize.name || "Prize",
      category: String(prize.category || "other").toLowerCase(),
      description: prize.description || "",
      image: prize.image || "../img/prizes/placeholder.png",
      price,
      donationsNeeded,
      stock: prize.stock == null ? 0 : Number(prize.stock),
      shelfKey: getShelfForPrice(price),
      sort: prize.sort == null ? 9999 : Number(prize.sort),
    };
  }

  function buildCategoryFilter() {
    if (!els.categoryFilter) return;

    const categories = Array.from(
      new Set(state.prizes.map((p) => p.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    els.categoryFilter.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All Categories";
    els.categoryFilter.appendChild(allOpt);

    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = prettifyCategory(cat);
      els.categoryFilter.appendChild(opt);
    });

    els.categoryFilter.value = state.activeCategory;
  }

  function renderAll() {
    renderWallet();
    state.filteredPrizes = getFilteredPrizes();
    renderShelves();
  }

  function renderWallet() {
    const balance =
      Number(
        state.userProfile?.prizeBalance ??
          state.userProfile?.availablePrizeBalance ??
          state.userProfile?.currentPrizeBalance ??
          0
      ) || 0;

    const raised =
      Number(
        state.userProfile?.totalDonations ??
          state.userProfile?.donationsRaised ??
          state.userProfile?.fundraisingTotal ??
          0
      ) || 0;

    const spent =
      Number(
        state.userProfile?.totalPrizeSpent ??
          state.userProfile?.prizeSpent ??
          state.userProfile?.spentPrizeBalance ??
          0
      ) || 0;

    if (els.balanceAmount) els.balanceAmount.textContent = money(balance);
    if (els.raisedAmount) els.raisedAmount.textContent = money(raised);
    if (els.spentAmount) els.spentAmount.textContent = money(spent);

    const nextPriceGoal = PRICE_GOALS.find((goal) => goal > balance);
    if (!nextPriceGoal) {
      if (els.nextGoalText) els.nextGoalText.textContent = "You can unlock any current shelf reward!";
      if (els.nextGoalFill) els.nextGoalFill.style.width = "100%";
      if (els.nextGoalHint) els.nextGoalHint.textContent = "Legendary shopping power unlocked.";
      return;
    }

    const previousGoal = [...PRICE_GOALS].reverse().find((goal) => goal < nextPriceGoal) || 0;
    const span = nextPriceGoal - previousGoal;
    const progress = span > 0 ? Math.max(0, Math.min(100, ((balance - previousGoal) / span) * 100)) : 0;
    const needed = Math.max(0, nextPriceGoal - balance);

    if (els.nextGoalText) {
      els.nextGoalText.textContent = `You’re ${money(needed)} away from the next reward tier.`;
    }
    if (els.nextGoalFill) {
      els.nextGoalFill.style.width = `${progress}%`;
    }
    if (els.nextGoalHint) {
      const nextShelf = getShelfForPrice(nextPriceGoal);
      const shelfLabel = SHELF_CONFIG[nextShelf]?.label || "next shelf";
      els.nextGoalHint.textContent = `Next stop: ${shelfLabel} at ${money(nextPriceGoal)} prize balance.`;
    }
  }

  function getFilteredPrizes() {
    const balance =
      Number(
        state.userProfile?.prizeBalance ??
          state.userProfile?.availablePrizeBalance ??
          state.userProfile?.currentPrizeBalance ??
          0
      ) || 0;

    return state.prizes
      .filter((prize) => {
        if (state.activeCategory !== "all" && prize.category !== state.activeCategory) {
          return false;
        }

        if (state.activeSearch) {
          const haystack = `${prize.name} ${prize.description} ${prize.category}`.toLowerCase();
          if (!haystack.includes(state.activeSearch)) return false;
        }

        if (state.activeQuickFilter === "buy-now" && prize.price > balance) return false;
        if (state.activeQuickFilter === "almost-there") {
          const gap = prize.price - balance;
          if (!(gap > 0 && gap <= 5)) return false;
        }
        if (state.activeQuickFilter === "dream" && prize.shelfKey !== "shelf4") return false;

        return true;
      })
      .sort((a, b) => {
        const affordableA = a.price <= balance ? 0 : 1;
        const affordableB = b.price <= balance ? 0 : 1;
        if (affordableA !== affordableB) return affordableA - affordableB;
        if (a.shelfKey !== b.shelfKey) return state.shelfOrder.indexOf(a.shelfKey) - state.shelfOrder.indexOf(b.shelfKey);
        if (a.sort !== b.sort) return a.sort - b.sort;
        return a.price - b.price || a.name.localeCompare(b.name);
      });
  }

  function renderShelves() {
    state.shelfOrder.forEach((shelfKey) => {
      const config = SHELF_CONFIG[shelfKey];
      const track = config.track();
      const empty = config.empty();
      const shelfPrizes = state.filteredPrizes.filter((prize) => prize.shelfKey === shelfKey);

      if (!track) return;
      track.innerHTML = "";

      if (!shelfPrizes.length) {
        if (empty) empty.hidden = false;
        return;
      }

      if (empty) empty.hidden = true;

      shelfPrizes.forEach((prize) => {
        track.appendChild(buildPrizeCard(prize));
      });
    });
  }

  function buildPrizeCard(prize) {
    const balance =
      Number(
        state.userProfile?.prizeBalance ??
          state.userProfile?.availablePrizeBalance ??
          state.userProfile?.currentPrizeBalance ??
          0
      ) || 0;

    const affordable = prize.price <= balance;
    const gap = Math.max(0, prize.price - balance);

    const card = document.createElement("article");
    card.className = `psPrizeCard ${affordable ? "is-affordable" : ""}`;
    card.innerHTML = `
      <div class="psPrizeImageWrap">
        <img class="psPrizeImage" src="${escapeHtml(prize.image)}" alt="${escapeHtml(prize.name)}">
        <div class="psPrizeBadges">
          ${affordable ? `<span class="psBadge psBadge--buy">Can Buy Now</span>` : ""}
          ${!affordable && gap <= 5 ? `<span class="psBadge psBadge--almost">Almost There</span>` : ""}
          ${prize.shelfKey === "shelf4" ? `<span class="psBadge psBadge--dream">Legendary</span>` : ""}
        </div>
      </div>
      <div class="psPrizeBody">
        <div class="psPrizeTop">
          <h3 class="psPrizeName">${escapeHtml(prize.name)}</h3>
          <div class="psPrizePrice">${money(prize.price)}</div>
        </div>
        <div class="psPrizeMeta">
          <span>${escapeHtml(prettifyCategory(prize.category))}</span>
          <span>${escapeHtml(SHELF_CONFIG[prize.shelfKey].donationsLabel)}</span>
        </div>
        <p class="psPrizeDescription">${escapeHtml(prize.description)}</p>
        <div class="psPrizeFooter">
          <div class="psPrizeStatus">
            ${
              affordable
                ? `Ready to redeem 🎉`
                : `Need ${money(gap)} more`
            }
          </div>
          <button class="psRedeemBtn" ${affordable ? "" : "disabled"} type="button">
            ${affordable ? "Redeem Prize" : "Keep Going"}
          </button>
        </div>
      </div>
    `;

    const redeemBtn = card.querySelector(".psRedeemBtn");
    if (redeemBtn && affordable) {
      redeemBtn.addEventListener("click", () => openRedeemModal(prize));
    }

    return card;
  }

  function openRedeemModal(prize) {
    state.redeemingPrize = prize;
    if (els.modalName) els.modalName.textContent = prize.name;
    if (els.modalCost) els.modalCost.textContent = money(prize.price);
    if (els.modalHint) {
      els.modalHint.textContent = `This redemption uses ${money(prize.price)} of your prize balance.`;
    }
    if (els.modal) {
      els.modal.classList.add("is-open");
      els.modal.removeAttribute("hidden");
    }
  }

  function closeRedeemModal() {
    state.redeemingPrize = null;
    if (els.modal) {
      els.modal.classList.remove("is-open");
      els.modal.setAttribute("hidden", "hidden");
    }
  }

  async function confirmRedeem() {
    const prize = state.redeemingPrize;
    if (!prize) return;

    if (els.modalConfirm) {
      els.modalConfirm.disabled = true;
      els.modalConfirm.textContent = "Redeeming...";
    }

    try {
      await redeemPrizeWithExistingBackend(prize);
      closeRedeemModal();
      await loadData();
      renderAll();
      alert(`🎉 ${prize.name} has been redeemed!`);
    } catch (error) {
      console.error("Redeem failed:", error);
      alert(error?.message || "Sorry, something went wrong redeeming this prize.");
    } finally {
      if (els.modalConfirm) {
        els.modalConfirm.disabled = false;
        els.modalConfirm.textContent = "Confirm Redeem";
      }
    }
  }

  async function redeemPrizeWithExistingBackend(prize) {
    if (typeof window.placePrizeOrder === "function") {
      return window.placePrizeOrder(prize);
    }

    if (typeof window.redeemPrize === "function") {
      return window.redeemPrize(prize);
    }

    if (typeof window.fnRedeemPrizeCredit === "function") {
      return window.fnRedeemPrizeCredit({
        schoolId: state.schoolId,
        userId: state.userId,
        prizeId: prize.prizeId,
      });
    }

    const callable = window.httpsCallable || window.firebase?.functions?.httpsCallable;
    const functionsInstance = window.functions || window.firebaseFunctions;

    if (typeof callable === "function" && functionsInstance) {
      const redeemFn = callable(functionsInstance, "fnRedeemPrizeCredit");
      return redeemFn({
        schoolId: state.schoolId,
        userId: state.userId,
        prizeId: prize.prizeId,
      });
    }

    throw new Error("No redemption function was found on the page.");
  }

  function getShelfForPrice(price) {
    if (price >= 100) return "shelf4";
    if (price >= 15) return "shelf3";
    if (price >= 7.5) return "shelf2";
    return "shelf1";
  }

  function prettifyCategory(category) {
    return String(category || "other")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();