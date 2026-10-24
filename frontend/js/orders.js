/**
 * Orders & Billing Module
 * Order lifecycle, POS catalog with interactive cart, order items, and payment processing.
 */

import { supabase, handleDatabaseError } from "./supabaseClient.js";
import {
  formatCurrency,
  formatDateTime,
  renderBadge,
  escapeHtml,
  showToast,
  showConfirmModal,
  openModal,
  closeModal,
  setButtonLoading,
  debounce,
} from "./utils.js";

let allOrders = [];
let availableMenuItems = [];
let availableCustomers = [];
let availableTables = [];
let activeOrderCart = []; // Array of { menu_item_id, name, price, quantity }
let selectedOrderIdForDetails = null;

/**
 * Initializes and loads orders view.
 */
export async function loadOrders() {
  if (!supabase) return;
  setupOrdersEventListeners();
  await Promise.all([fetchOrders(), fetchOrderMetaOptions()]);
}

/**
 * Fetches orders with joined customers, tables, items, and payments.
 */
async function fetchOrders() {
  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Loading orders...</td></tr>`;

  try {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        order_id,
        customer_id,
        table_id,
        order_type,
        order_time,
        status,
        created_at,
        customer:customers(customer_id, name, phone),
        table:restaurant_tables(table_id, table_number),
        order_items(
          order_item_id,
          menu_item_id,
          quantity,
          unit_price,
          menu_item:menu_items(name)
        ),
        payments(
          payment_id,
          amount,
          payment_method,
          payment_status,
          payment_time
        )
      `)
      .order("order_time", { ascending: false });

    if (error) {
      console.error("Failed to load orders:", error);
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-state">
            ${escapeHtml(handleDatabaseError(error, "Failed to load orders"))}
          </td>
        </tr>
      `;
      showToast(handleDatabaseError(error, "Error loading orders"), "error");
      return;
    }

    allOrders = data || [];
    renderFilteredOrders();
  } catch (err) {
    console.error("Unexpected error in fetchOrders:", err);
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Unexpected error loading orders.</td></tr>`;
  }
}

/**
 * Fetches customers, tables, and available menu items for the POS order creator.
 */
async function fetchOrderMetaOptions() {
  try {
    const [custRes, tblRes, menuRes] = await Promise.all([
      supabase.from("customers").select("customer_id, name, phone").order("name", { ascending: true }),
      supabase.from("restaurant_tables").select("table_id, table_number").order("table_number", { ascending: true }),
      supabase
        .from("menu_items")
        .select("menu_item_id, name, category, description, price, is_available")
        .eq("is_available", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    if (!custRes.error && custRes.data) availableCustomers = custRes.data;
    if (!tblRes.error && tblRes.data) availableTables = tblRes.data;
    if (!menuRes.error && menuRes.data) availableMenuItems = menuRes.data;

    populateOrderMetaDropdowns();
  } catch (err) {
    console.warn("Error fetching order metadata:", err);
  }
}

/**
 * Populates customer and table dropdowns for the Create Order modal.
 */
function populateOrderMetaDropdowns() {
  const custSelect = document.getElementById("order-create-customer");
  const tblSelect = document.getElementById("order-create-table");

  if (custSelect) {
    custSelect.innerHTML = `<option value="">-- Walk-in Guest (No Customer Record) --</option>`;
    for (const c of availableCustomers) {
      const opt = document.createElement("option");
      opt.value = c.customer_id;
      opt.textContent = `${c.name} (${c.phone})`;
      custSelect.appendChild(opt);
    }
  }

  if (tblSelect) {
    tblSelect.innerHTML = `<option value="">-- No Table Assigned --</option>`;
    for (const t of availableTables) {
      const opt = document.createElement("option");
      opt.value = t.table_id;
      opt.textContent = `Table ${t.table_number}`;
      tblSelect.appendChild(opt);
    }
  }

  // Populate POS category filter
  const posCatFilter = document.getElementById("pos-category-filter");
  if (posCatFilter) {
    const cats = Array.from(new Set(availableMenuItems.map((m) => m.category).filter(Boolean))).sort();
    posCatFilter.innerHTML = `<option value="">All Categories</option>`;
    for (const cat of cats) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      posCatFilter.appendChild(opt);
    }
  }
}

/**
 * Filters and renders orders in the main table.
 */
function renderFilteredOrders() {
  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  const searchVal = (document.getElementById("order-search-input")?.value || "").toLowerCase().trim();
  const statusVal = document.getElementById("order-status-filter")?.value || "";
  const typeVal = document.getElementById("order-type-filter")?.value || "";

  const filtered = allOrders.filter((ord) => {
    // Search match: order_id or customer name
    if (searchVal) {
      const idMatch = String(ord.order_id).includes(searchVal);
      const custMatch = (ord.customer?.name || "").toLowerCase().includes(searchVal);
      if (!idMatch && !custMatch) return false;
    }

    // Status filter
    if (statusVal && ord.status !== statusVal) return false;

    // Type filter
    if (typeVal && ord.order_type !== typeVal) return false;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="empty-state-title">No orders found</div>
          <p class="empty-state-text">No orders match your filter criteria.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((ord) => {
      const custName = ord.customer ? ord.customer.name : "Walk-in Guest";
      const typeLabel = (ord.order_type || "dine_in").replace("_", " ");
      const tableLabel = ord.table ? `Table ${ord.table.table_number}` : `Takeaway / Delivery`;

      // Calculate total strictly from saved unit_price in order_items
      const orderTotal = (ord.order_items || []).reduce((acc, item) => {
        return acc + (Number(item.unit_price) * Number(item.quantity) || 0);
      }, 0);

      // Calculate completed payments
      const completedPaymentTotal = (ord.payments || [])
        .filter((p) => p.payment_status === "completed")
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      let paymentBadgeHtml = "";
      if (completedPaymentTotal >= orderTotal && orderTotal > 0) {
        paymentBadgeHtml = `<span class="badge badge-success">Paid in Full</span>`;
      } else if (completedPaymentTotal > 0) {
        paymentBadgeHtml = `<span class="badge badge-warning">Partial (${formatCurrency(completedPaymentTotal)})</span>`;
      } else {
        paymentBadgeHtml = `<span class="badge badge-neutral">Unpaid</span>`;
      }

      return `
        <tr data-order-id="${escapeHtml(ord.order_id)}">
          <td><strong>#${escapeHtml(ord.order_id)}</strong></td>
          <td>${escapeHtml(custName)}</td>
          <td>${escapeHtml(tableLabel)}</td>
          <td style="text-transform: capitalize;">${escapeHtml(typeLabel)}</td>
          <td>${formatDateTime(ord.order_time)}</td>
          <td>${renderBadge(ord.status, "order")}</td>
          <td class="cell-numeric" style="font-weight: 700;">${formatCurrency(orderTotal)}</td>
          <td>${paymentBadgeHtml}</td>
          <td class="cell-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-view-order" title="View details, update kitchen status, or record payment">
              View & Pay
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  attachOrderRowListeners();
}

/**
 * Attaches row event listeners.
 */
function attachOrderRowListeners() {
  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  tbody.querySelectorAll(".btn-view-order").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const row = e.target.closest("tr");
      const orderId = row?.getAttribute("data-order-id");
      if (!orderId) return;

      openOrderDetailsModal(orderId);
    });
  });
}

/**
 * Opens and renders the POS style Create Order Modal.
 */
function openCreateOrderModal() {
  activeOrderCart = [];
  const createTableSelect = document.getElementById("order-create-table");
  const createCustSelect = document.getElementById("order-create-customer");
  const createTypeSelect = document.getElementById("order-create-type");

  if (createTableSelect) createTableSelect.value = "";
  if (createCustSelect) createCustSelect.value = "";
  if (createTypeSelect) createTypeSelect.value = "dine_in";

  populateOrderMetaDropdowns();
  renderPosMenuCatalog();
  renderPosCart();
  openModal("create-order-modal");
}

/**
 * Renders the dishes catalog in POS picker grid.
 */
function renderPosMenuCatalog() {
  const grid = document.getElementById("pos-menu-grid");
  if (!grid) return;

  const search = (document.getElementById("pos-menu-search")?.value || "").toLowerCase().trim();
  const category = document.getElementById("pos-category-filter")?.value || "";

  const filteredDishes = availableMenuItems.filter((dish) => {
    if (search && !dish.name.toLowerCase().includes(search) && !(dish.description || "").toLowerCase().includes(search)) {
      return false;
    }
    if (category && dish.category !== category) {
      return false;
    }
    return true;
  });

  if (filteredDishes.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding: 20px;">No available dishes found.</div>`;
    return;
  }

  grid.innerHTML = filteredDishes
    .map((dish) => {
      return `
        <div class="menu-picker-card" data-dish-id="${escapeHtml(dish.menu_item_id)}">
          <div>
            <div class="menu-picker-name">${escapeHtml(dish.name)}</div>
            <div class="menu-picker-desc">${escapeHtml(dish.description || dish.category)}</div>
          </div>
          <div class="menu-picker-footer">
            <span class="menu-picker-price">${formatCurrency(dish.price)}</span>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 3px 8px;">+ Add</button>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach card click handlers to add item to cart
  grid.querySelectorAll(".menu-picker-card").forEach((card) => {
    card.addEventListener("click", () => {
      const dishId = card.getAttribute("data-dish-id");
      const dish = availableMenuItems.find((d) => String(d.menu_item_id) === String(dishId));
      if (!dish) return;

      addItemToCart(dish);
    });
  });
}

/**
 * Adds an item to active cart.
 * Respects unique constraint on (order_id, menu_item_id) by combining duplicate cart entries.
 */
function addItemToCart(dish) {
  const existing = activeOrderCart.find((item) => String(item.menu_item_id) === String(dish.menu_item_id));
  if (existing) {
    existing.quantity += 1;
  } else {
    activeOrderCart.push({
      menu_item_id: dish.menu_item_id,
      name: dish.name,
      price: Number(dish.price),
      quantity: 1,
    });
  }
  renderPosCart();
}

/**
 * Updates cart quantity or removes item.
 */
function updateCartItemQuantity(menu_item_id, delta) {
  const item = activeOrderCart.find((i) => String(i.menu_item_id) === String(menu_item_id));
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    activeOrderCart = activeOrderCart.filter((i) => String(i.menu_item_id) !== String(menu_item_id));
  }
  renderPosCart();
}

/**
 * Renders the interactive order cart sidebar in modal.
 */
function renderPosCart() {
  const container = document.getElementById("pos-cart-items");
  const countBadge = document.getElementById("cart-item-count");
  const subtotalEl = document.getElementById("cart-subtotal");
  const totalEl = document.getElementById("cart-total");
  const submitBtn = document.getElementById("btn-submit-order");

  const totalItems = activeOrderCart.reduce((sum, i) => sum + i.quantity, 0);
  const totalCost = activeOrderCart.reduce((sum, i) => sum + i.quantity * i.price, 0);

  if (countBadge) countBadge.textContent = totalItems;
  if (subtotalEl) subtotalEl.textContent = formatCurrency(totalCost);
  if (totalEl) totalEl.textContent = formatCurrency(totalCost);
  if (submitBtn) submitBtn.disabled = activeOrderCart.length === 0;

  if (!container) return;

  if (activeOrderCart.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 30px 10px;">
        <p class="empty-state-text" style="font-size: 0.82rem;">Cart is empty. Click dishes on the left to add items.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = activeOrderCart
    .map((item) => {
      const lineTotal = item.quantity * item.price;
      return `
        <div class="cart-item" data-cart-id="${escapeHtml(item.menu_item_id)}">
          <div class="cart-item-info">
            <div class="cart-item-title">${escapeHtml(item.name)}</div>
            <div class="cart-item-sub">${formatCurrency(item.price)} each &bull; <strong>${formatCurrency(lineTotal)}</strong></div>
          </div>
          <div class="cart-qty-controls">
            <button type="button" class="cart-qty-btn btn-cart-minus" title="Decrease quantity">&minus;</button>
            <span class="cart-qty-num">${escapeHtml(item.quantity)}</span>
            <button type="button" class="cart-qty-btn btn-cart-plus" title="Increase quantity">&plus;</button>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach cart controls
  container.querySelectorAll(".cart-item").forEach((card) => {
    const id = card.getAttribute("data-cart-id");
    card.querySelector(".btn-cart-minus")?.addEventListener("click", () => updateCartItemQuantity(id, -1));
    card.querySelector(".btn-cart-plus")?.addEventListener("click", () => updateCartItemQuantity(id, 1));
  });
}

/**
 * Submits the created order to Supabase.
 * Note: Browser-side multiple queries; production checkout requires server-side atomic transaction.
 */
async function submitCreatedOrder() {
  if (activeOrderCart.length === 0) {
    showToast("Please add at least one item to the cart", "warning");
    return;
  }

  const submitBtn = document.getElementById("btn-submit-order");
  const order_type = document.getElementById("order-create-type")?.value || "dine_in";
  const custVal = document.getElementById("order-create-customer")?.value;
  const tblVal = document.getElementById("order-create-table")?.value;

  const customer_id = custVal ? custVal : null;
  const table_id = tblVal ? tblVal : null;
  const order_time = new Date().toISOString();
  const status = "placed";

  setButtonLoading(submitBtn, true, "Placing Order...");

  try {
    // 1. Insert into orders
    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .insert([{
        customer_id,
        table_id,
        order_type,
        order_time,
        status,
      }])
      .select("order_id")
      .single();

    if (orderErr) {
      showToast(handleDatabaseError(orderErr, "Failed to create order"), "error");
      setButtonLoading(submitBtn, false);
      return;
    }

    const newOrderId = orderData.order_id;

    // 2. Prepare order_items with historical unit_price
    const orderItemsRows = activeOrderCart.map((item) => ({
      order_id: newOrderId,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.price,
    }));

    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(orderItemsRows);

    if (itemsErr) {
      console.error("Order items insert error:", itemsErr);
      showToast(handleDatabaseError(itemsErr, `Order #${newOrderId} created, but failed to save line items`), "error");
    } else {
      showToast(`Order #${newOrderId} placed successfully!`, "success");
      closeModal("create-order-modal");
      activeOrderCart = [];
      await fetchOrders();
      // Optionally open the newly created order for payment right away
      openOrderDetailsModal(newOrderId);
    }
  } catch (err) {
    console.error("Order submit unexpected error:", err);
    showToast("Unexpected error submitting order", "error");
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Opens and renders the Order Details & Payment Modal.
 *
 * @param {string|number} orderId
 */
export async function openOrderDetailsModal(orderId) {
  selectedOrderIdForDetails = orderId;

  const orderIdSpan = document.getElementById("detail-order-id");
  const orderMetaDiv = document.getElementById("detail-order-meta");
  const customerDiv = document.getElementById("detail-customer");
  const tableTypeDiv = document.getElementById("detail-table-type");
  const statusBadgeDiv = document.getElementById("detail-order-status-badge");
  const payBadgeDiv = document.getElementById("detail-payment-status-badge");
  const itemsTbody = document.getElementById("detail-order-items-body");
  const totalAmountTh = document.getElementById("detail-items-total");
  const paymentsTbody = document.getElementById("detail-payments-body");
  const remainingBalEl = document.getElementById("detail-remaining-balance");
  const paymentAmountInput = document.getElementById("payment-amount");

  if (orderIdSpan) orderIdSpan.textContent = orderId;
  if (itemsTbody) itemsTbody.innerHTML = `<tr><td colspan="4" class="empty-state">Loading order details...</td></tr>`;
  if (paymentsTbody) paymentsTbody.innerHTML = `<tr><td colspan="5" class="empty-state">Loading payment history...</td></tr>`;

  openModal("order-details-modal");

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        order_id,
        customer_id,
        table_id,
        order_type,
        order_time,
        status,
        created_at,
        customer:customers(customer_id, name, phone, email),
        table:restaurant_tables(table_id, table_number),
        order_items(
          order_item_id,
          menu_item_id,
          quantity,
          unit_price,
          menu_item:menu_items(name)
        ),
        payments(
          payment_id,
          amount,
          payment_method,
          payment_status,
          payment_time
        )
      `)
      .eq("order_id", orderId)
      .single();

    if (error || !order) {
      showToast(handleDatabaseError(error, "Could not load order details"), "error");
      closeModal("order-details-modal");
      return;
    }

    // Populate order header
    const custText = order.customer ? `${order.customer.name} (${order.customer.phone})` : "Walk-in Guest";
    const typeText = (order.order_type || "dine_in").replace("_", " ");
    const tableText = order.table ? `Table ${order.table.table_number}` : "Takeaway / Delivery";

    if (orderMetaDiv) orderMetaDiv.textContent = `Placed on ${formatDateTime(order.order_time)}`;
    if (customerDiv) customerDiv.textContent = custText;
    if (tableTypeDiv) tableTypeDiv.textContent = `${tableText} • ${typeText.toUpperCase()}`;
    if (statusBadgeDiv) statusBadgeDiv.innerHTML = renderBadge(order.status, "order");

    // Populate line items
    const items = order.order_items || [];
    let calculatedTotal = 0;

    if (items.length === 0) {
      if (itemsTbody) itemsTbody.innerHTML = `<tr><td colspan="4" class="empty-state">No items found for this order.</td></tr>`;
    } else {
      if (itemsTbody) {
        itemsTbody.innerHTML = items
          .map((item) => {
            const lineCost = Number(item.quantity) * Number(item.unit_price);
            calculatedTotal += lineCost;
            const dishName = item.menu_item?.name || `Item #${item.menu_item_id}`;

            return `
              <tr>
                <td><strong>${escapeHtml(dishName)}</strong></td>
                <td class="cell-numeric">${formatCurrency(item.unit_price)}</td>
                <td class="cell-numeric">${escapeHtml(item.quantity)}</td>
                <td class="cell-numeric" style="font-weight: 600;">${formatCurrency(lineCost)}</td>
              </tr>
            `;
          })
          .join("");
      }
    }

    if (totalAmountTh) totalAmountTh.textContent = formatCurrency(calculatedTotal);

    // Populate payments history
    const payments = (order.payments || []).sort(
      (a, b) => new Date(b.payment_time).getTime() - new Date(a.payment_time).getTime()
    );

    const completedPaid = payments
      .filter((p) => p.payment_status === "completed")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const remainingBalance = Math.max(0, calculatedTotal - completedPaid);

    if (remainingBalEl) remainingBalEl.textContent = formatCurrency(remainingBalance);
    if (paymentAmountInput) {
      paymentAmountInput.value = remainingBalance > 0 ? remainingBalance.toFixed(2) : "";
    }

    // Payment status badge
    if (payBadgeDiv) {
      if (completedPaid >= calculatedTotal && calculatedTotal > 0) {
        payBadgeDiv.innerHTML = `<span class="badge badge-success">Paid in Full (${formatCurrency(completedPaid)})</span>`;
      } else if (completedPaid > 0) {
        payBadgeDiv.innerHTML = `<span class="badge badge-warning">Partial (${formatCurrency(completedPaid)} / ${formatCurrency(calculatedTotal)})</span>`;
      } else {
        payBadgeDiv.innerHTML = `<span class="badge badge-neutral">Unpaid</span>`;
      }
    }

    if (payments.length === 0) {
      if (paymentsTbody) paymentsTbody.innerHTML = `<tr><td colspan="5" class="empty-state">No payments recorded for this order yet.</td></tr>`;
    } else {
      if (paymentsTbody) {
        paymentsTbody.innerHTML = payments
          .map((p) => {
            return `
              <tr>
                <td>#${escapeHtml(p.payment_id)}</td>
                <td>${formatDateTime(p.payment_time)}</td>
                <td style="text-transform: uppercase; font-size: 0.82rem; font-weight: 600;">${escapeHtml(p.payment_method)}</td>
                <td>${renderBadge(p.payment_status, "payment")}</td>
                <td class="cell-numeric" style="font-weight: 600;">${formatCurrency(p.amount)}</td>
              </tr>
            `;
          })
          .join("");
      }
    }

    // Bind Quick Order Status buttons
    const statusBtnContainer = document.getElementById("order-status-quick-btns");
    if (statusBtnContainer) {
      statusBtnContainer.querySelectorAll("button").forEach((btn) => {
        const targetStatus = btn.getAttribute("data-status");
        if (targetStatus === order.status) {
          btn.className = "btn btn-primary btn-sm";
        } else {
          btn.className = "btn btn-secondary btn-sm";
        }

        btn.onclick = async () => {
          try {
            const { error: updateErr } = await supabase
              .from("orders")
              .update({ status: targetStatus })
              .eq("order_id", orderId);

            if (updateErr) {
              showToast(handleDatabaseError(updateErr, "Failed to update order status"), "error");
            } else {
              showToast(`Order status updated to ${targetStatus}`, "success");
              await openOrderDetailsModal(orderId);
              await fetchOrders();
            }
          } catch (err) {
            console.error("Order status update error:", err);
          }
        };
      });
    }
  } catch (err) {
    console.error("Error loading order modal:", err);
    showToast("Unexpected error loading order", "error");
  }
}

let orderListenersAttached = false;

/**
 * Sets up global order event listeners.
 */
function setupOrdersEventListeners() {
  if (orderListenersAttached) return;
  orderListenersAttached = true;

  // New Order Button
  const newOrderBtn = document.getElementById("btn-create-order");
  if (newOrderBtn) newOrderBtn.addEventListener("click", openCreateOrderModal);

  // Search input with Debounce
  const searchInput = document.getElementById("order-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(renderFilteredOrders, 250));
  }

  // Filter dropdowns
  const statusFilter = document.getElementById("order-status-filter");
  if (statusFilter) statusFilter.addEventListener("change", renderFilteredOrders);

  const typeFilter = document.getElementById("order-type-filter");
  if (typeFilter) typeFilter.addEventListener("change", renderFilteredOrders);

  // POS Menu Search & Category Filter
  const posSearch = document.getElementById("pos-menu-search");
  if (posSearch) posSearch.addEventListener("input", debounce(renderPosMenuCatalog, 200));

  const posCatFilter = document.getElementById("pos-category-filter");
  if (posCatFilter) posCatFilter.addEventListener("change", renderPosMenuCatalog);

  // Submit Order Button in POS
  const submitOrderBtn = document.getElementById("btn-submit-order");
  if (submitOrderBtn) submitOrderBtn.addEventListener("click", submitCreatedOrder);

  // Close Modal Buttons
  document.querySelectorAll('[data-close="create-order-modal"]').forEach((btn) => {
    btn.addEventListener("click", () => closeModal("create-order-modal"));
  });

  document.querySelectorAll('[data-close="order-details-modal"]').forEach((btn) => {
    btn.addEventListener("click", () => closeModal("order-details-modal"));
  });

  // Record Payment Form Submit
  const paymentForm = document.getElementById("record-payment-form");
  const submitPaymentBtn = document.getElementById("btn-submit-payment");

  if (paymentForm) {
    paymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!selectedOrderIdForDetails) return;

      const amountStr = document.getElementById("payment-amount")?.value;
      const payment_method = document.getElementById("payment-method")?.value;
      const payment_status = document.getElementById("payment-status")?.value;
      const amount = parseFloat(amountStr);

      if (isNaN(amount) || amount <= 0) {
        showToast("Payment amount must be greater than zero", "warning");
        return;
      }

      setButtonLoading(submitPaymentBtn, true, "Processing Payment...");

      try {
        const { error: payErr } = await supabase
          .from("payments")
          .insert([{
            order_id: selectedOrderIdForDetails,
            amount,
            payment_method,
            payment_status,
            payment_time: new Date().toISOString(),
          }]);

        if (payErr) {
          showToast(handleDatabaseError(payErr, "Failed to record payment"), "error");
        } else {
          showToast(`Payment of ${formatCurrency(amount)} recorded successfully!`, "success");
          paymentForm.reset();
          await openOrderDetailsModal(selectedOrderIdForDetails);
          await fetchOrders();
        }
      } catch (err) {
        console.error("Payment submit error:", err);
        showToast("Unexpected error recording payment", "error");
      } finally {
        setButtonLoading(submitPaymentBtn, false);
      }
    });
  }
}
