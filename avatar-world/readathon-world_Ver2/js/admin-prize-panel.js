// /js/admin-prize-panel.js

import {
  db,
  schoolRoot,
  fnFulfillPrizeOrder,
  fnDeliverPrizeOrder,
  fnCancelPrizeOrder,
} from "./firebase.js";

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export async function mountPrizeAdminDashboard({ mountEl, schoolId }) {
  const mount = document.querySelector(mountEl);
  if (!mount) return;

  mount.innerHTML = `
    <section class="panel panel--prize-admin">
      <div class="prizeAdminHeader">
        <div>
          <div class="pill">Prize Store Admin</div>
          <h2 class="h2 prizeAdminTitle">Prize Orders</h2>
          <p class="sub prizeAdminSub">
            View requests, mark prizes ready, deliver them, or cancel/refund.
          </p>
        </div>
        <button class="btn-action btn-submit-minutes" id="refreshPrizeOrdersBtn">
          Refresh
        </button>
      </div>

      <div class="prizeAdminStats" id="prizeAdminStats">
        <div class="emptyNote">Loading prize stats...</div>
      </div>

      <div class="prizeAdminList" id="prizeAdminList">
        <div class="emptyNote">Loading orders...</div>
      </div>
    </section>
  `;

  mount.querySelector("#refreshPrizeOrdersBtn")?.addEventListener("click", () => {
    loadOrders({ schoolId, mount });
  });

  await loadOrders({ schoolId, mount });
}

async function loadOrders({ schoolId, mount }) {
  const listEl = mount.querySelector("#prizeAdminList");
  const statsEl = mount.querySelector("#prizeAdminStats");

  listEl.innerHTML = `<div class="emptyNote">Loading orders...</div>`;

  const qRef = query(
    collection(db, `${schoolRoot(schoolId)}/prizeOrders`),
    orderBy("createdAt", "desc"),
    limit(100)
  );

  const snap = await getDocs(qRef);
  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  renderStats(orders, statsEl);
  renderOrders({ orders, listEl, schoolId, mount });
}

function renderStats(orders, el) {
  const counts = {
    reserved: 0,
    fulfilled: 0,
    delivered: 0,
    cancelled: 0,
  };

  for (const o of orders) {
    if (o.status === "cancelled") counts.cancelled += 1;
    else if (o.fulfillmentStatus === "delivered") counts.delivered += 1;
    else if (o.fulfillmentStatus === "fulfilled") counts.fulfilled += 1;
    else counts.reserved += 1;
  }

  el.innerHTML = `
    ${statCard("Reserved", counts.reserved)}
    ${statCard("Ready", counts.fulfilled)}
    ${statCard("Delivered", counts.delivered)}
    ${statCard("Cancelled", counts.cancelled)}
  `;
}

function statCard(label, value) {
  return `
    <div class="prizeStatCard">
      <div class="prizeStatCard__label">${label}</div>
      <div class="prizeStatCard__value">${value}</div>
    </div>
  `;
}

function renderOrders({ orders, listEl, schoolId, mount }) {
  listEl.innerHTML = "";

  if (!orders.length) {
    listEl.innerHTML = `<div class="emptyNote">No prize orders yet.</div>`;
    return;
  }

  for (const order of orders) {
    const card = document.createElement("article");
    card.className = "prizeOrderCard";

    const statusLabel = getStatusLabel(order);
    const price = formatMoney(order.price);
    const requestedDate = formatDate(order.requestedAt || order.createdAt);
    const userId = order.userId || "unknown user";
    const role = order.requestedByRole || "student";

    card.innerHTML = `
      <div class="prizeOrderCard__top">
        <div class="prizeOrderCard__main">
          <h3 class="prizeOrderCard__title">
            ${escapeHtml(order.prizeName || "Prize")}
          </h3>
          <p class="prizeOrderCard__student">
            ${escapeHtml(order.studentDisplayName || "No display name")}
          </p>
          <p class="prizeOrderCard__student">
            ${escapeHtml(userId)} • ${escapeHtml(role)}
          </p>
        </div>

        <div class="prizeOrderCard__status prizeOrderCard__status--${getStatusClass(order)}">
          ${escapeHtml(statusLabel)}
        </div>
      </div>

      <div class="prizeOrderCard__meta">
        <div class="prizeOrderCard__metaRow">
          <span>Price</span>
          <strong>${price}</strong>
        </div>

        <div class="prizeOrderCard__metaRow">
          <span>Requested</span>
          <strong>${escapeHtml(requestedDate)}</strong>
        </div>

        <div class="prizeOrderCard__metaRow">
          <span>Order ID</span>
          <strong>${escapeHtml(order.orderId || order.id)}</strong>
        </div>
      </div>

      <div class="prizeOrderCard__actions">
        ${buildActions(order)}
      </div>
    `;

    wireButtons({ card, order, schoolId, mount });
    listEl.appendChild(card);
  }
}

function buildActions(order) {
  if (order.status === "cancelled") {
    return `<span class="prizeOrderDone">Cancelled</span>`;
  }

  if (order.fulfillmentStatus === "delivered") {
    return `<span class="prizeOrderDone">Delivered</span>`;
  }

  if (order.fulfillmentStatus === "fulfilled") {
    return `
      <button type="button" class="btn-action btn-donate" data-action="deliver">
        Mark Delivered
      </button>
      <button type="button" class="btn-action btn-approve-minutes" data-action="cancel">
        Cancel + Refund
      </button>
    `;
  }

  return `
    <button type="button" class="btn-action btn-submit-minutes" data-action="fulfill">
      Mark Ready
    </button>
    <button type="button" class="btn-action btn-approve-minutes" data-action="cancel">
      Cancel + Refund
    </button>
  `;
}

function wireButtons({ card, order, schoolId, mount }) {
  const btns = card.querySelectorAll("button");

  btns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;

      try {
        btn.disabled = true;

        if (action === "fulfill") {
          await fnFulfillPrizeOrder({
            orderId: order.id,
            schoolId,
          });
        }

        if (action === "deliver") {
          await fnDeliverPrizeOrder({
            orderId: order.id,
            schoolId,
          });
        }

        if (action === "cancel") {
          const cancelReason = window.prompt(
            "Why are you cancelling this order?",
            "Cancelled by admin."
          );

          if (cancelReason === null) {
            btn.disabled = false;
            return;
          }

          await fnCancelPrizeOrder({
            orderId: order.id,
            schoolId,
            cancelReason,
          });
        }

        await loadOrders({ schoolId, mount });
      } catch (err) {
        console.error(err);
        btn.disabled = false;
        window.alert(err?.message || "Something went wrong.");
      }
    });
  });
}

function getStatusLabel(order) {
  if (order.status === "cancelled") return "Cancelled";
  if (order.fulfillmentStatus === "delivered") return "Delivered";
  if (order.fulfillmentStatus === "fulfilled") return "Ready";
  return "Reserved";
}

function getStatusClass(order) {
  if (order.status === "cancelled") return "cancelled";
  if (order.fulfillmentStatus === "delivered") return "delivered";
  if (order.fulfillmentStatus === "fulfilled") return "fulfilled";
  return "reserved";
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Unknown";

  const date =
    typeof value.toDate === "function"
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleString("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}