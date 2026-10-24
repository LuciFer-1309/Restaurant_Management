/**
 * Dashboard View Module
 * Fetches and displays real-time restaurant statistics, recent orders, and floor occupancy.
 */

import { supabase, handleDatabaseError } from "./supabaseClient.js";
import { formatCurrency, formatDateTime, renderBadge, escapeHtml, showToast } from "./utils.js";

/**
 * Loads dashboard metrics and recent activity from Supabase.
 */
export async function loadDashboard() {
  if (!supabase) return;

  const menuCountEl = document.getElementById("dash-menu-count");
  const customerCountEl = document.getElementById("dash-customer-count");
  const orderCountEl = document.getElementById("dash-order-count");
  const revenueCountEl = document.getElementById("dash-revenue-count");
  const recentOrdersTbody = document.getElementById("dash-recent-orders-body");
  const tableAvailEl = document.getElementById("dash-tables-avail");
  const tableOccEl = document.getElementById("dash-tables-occ");
  const tableResEl = document.getElementById("dash-tables-res");

  // Show loading indicators
  if (menuCountEl) menuCountEl.innerHTML = `<span class="loading-skeleton" style="display:inline-block; width:50px; height:28px;"></span>`;
  if (customerCountEl) customerCountEl.innerHTML = `<span class="loading-skeleton" style="display:inline-block; width:50px; height:28px;"></span>`;
  if (orderCountEl) orderCountEl.innerHTML = `<span class="loading-skeleton" style="display:inline-block; width:50px; height:28px;"></span>`;
  if (revenueCountEl) revenueCountEl.innerHTML = `<span class="loading-skeleton" style="display:inline-block; width:70px; height:28px;"></span>`;

  try {
    // 1. Menu Items Count
    const { count: menuCount, error: menuErr } = await supabase
      .from("menu_items")
      .select("*", { count: "exact", head: true });
    
    if (menuErr) console.warn("Menu count error:", menuErr);
    if (menuCountEl) menuCountEl.textContent = menuErr ? "0" : (menuCount ?? 0);

    // 2. Customers Count
    const { count: customerCount, error: custErr } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true });

    if (custErr) console.warn("Customer count error:", custErr);
    if (customerCountEl) customerCountEl.textContent = custErr ? "0" : (customerCount ?? 0);

    // 3. Today's Orders Count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayIso = startOfToday.toISOString();

    const { count: todayOrderCount, error: orderErr } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("order_time", startOfTodayIso);

    if (orderErr) console.warn("Today orders count error:", orderErr);
    if (orderCountEl) orderCountEl.textContent = orderErr ? "0" : (todayOrderCount ?? 0);

    // 4. Completed Payment Revenue (Sum of amount where payment_status = 'completed')
    const { data: paymentsData, error: payErr } = await supabase
      .from("payments")
      .select("amount")
      .eq("payment_status", "completed");

    if (payErr) {
      console.warn("Payments revenue error:", payErr);
      if (revenueCountEl) revenueCountEl.textContent = "$0.00";
    } else {
      const totalRevenue = (paymentsData || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      if (revenueCountEl) revenueCountEl.textContent = formatCurrency(totalRevenue);
    }

    // 5. Table Occupancy Breakdown
    const { data: tablesData, error: tablesErr } = await supabase
      .from("restaurant_tables")
      .select("status");

    if (!tablesErr && tablesData) {
      let avail = 0;
      let occ = 0;
      let res = 0;
      for (const t of tablesData) {
        if (t.status === "available") avail++;
        else if (t.status === "occupied") occ++;
        else if (t.status === "reserved") res++;
      }
      if (tableAvailEl) tableAvailEl.textContent = avail;
      if (tableOccEl) tableOccEl.textContent = occ;
      if (tableResEl) tableResEl.textContent = res;
    } else {
      if (tableAvailEl) tableAvailEl.textContent = "0";
      if (tableOccEl) tableOccEl.textContent = "0";
      if (tableResEl) tableResEl.textContent = "0";
    }

    // 6. Recent Orders (Latest 6 orders with customer and items)
    if (recentOrdersTbody) {
      const { data: recentOrders, error: recentErr } = await supabase
        .from("orders")
        .select(`
          order_id,
          order_type,
          order_time,
          status,
          customer:customers(name),
          table:restaurant_tables(table_number),
          order_items(quantity, unit_price)
        `)
        .order("order_time", { ascending: false })
        .limit(6);

      if (recentErr) {
        console.error("Recent orders error:", recentErr);
        recentOrdersTbody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              ${escapeHtml(handleDatabaseError(recentErr, "Unable to load recent orders"))}
            </td>
          </tr>
        `;
      } else if (!recentOrders || recentOrders.length === 0) {
        recentOrdersTbody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <div class="empty-state-title">No orders placed yet</div>
              <p class="empty-state-text">New orders will show up here as they are entered.</p>
            </td>
          </tr>
        `;
      } else {
        recentOrdersTbody.innerHTML = recentOrders.map(order => {
          const custName = order.customer?.name || "Walk-in Guest";
          const typeFormatted = (order.order_type || "dine_in").replace("_", " ");
          const totalAmount = (order.order_items || []).reduce((acc, item) => {
            return acc + (Number(item.unit_price) * Number(item.quantity) || 0);
          }, 0);

          return `
            <tr>
              <td><strong>#${escapeHtml(order.order_id)}</strong></td>
              <td>${escapeHtml(custName)}</td>
              <td style="text-transform: capitalize;">${escapeHtml(typeFormatted)}</td>
              <td>${renderBadge(order.status, "order")}</td>
              <td>${formatDateTime(order.order_time)}</td>
              <td class="cell-numeric" style="font-weight: 600;">${formatCurrency(totalAmount)}</td>
            </tr>
          `;
        }).join("");
      }
    }

  } catch (err) {
    console.error("Dashboard error:", err);
    showToast("Error updating dashboard statistics", "error");
  }
}
