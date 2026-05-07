import {
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