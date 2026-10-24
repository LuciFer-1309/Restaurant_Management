/**
 * Reservations Management Module
 * Guest bookings, table assignments, party size verification, status lifecycle (booked, confirmed, completed, cancelled).
 */

import { supabase, handleDatabaseError } from "./supabaseClient.js";
import {
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

let allReservations = [];
let availableCustomers = [];
let availableTables = [];
let isEditingReservation = false;

/**
 * Initializes and loads reservations view.
 */
export async function loadReservations() {
  if (!supabase) return;
  setupReservationEventListeners();
  await Promise.all([fetchReservations(), fetchReservationDropdownData()]);
}

/**
 * Fetches reservations joined with customer and table records.
 */
async function fetchReservations() {
  const tbody = document.getElementById("reservations-table-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Loading reservations...</td></tr>`;

  try {
    const { data, error } = await supabase
      .from("reservations")
      .select(`
        reservation_id,
        customer_id,
        table_id,
        reservation_time,
        party_size,
        status,
        created_at,
        customer:customers(customer_id, name, phone),
        table:restaurant_tables(table_id, table_number, capacity)
      `)
      .order("reservation_time", { ascending: false });

    if (error) {
      console.error("Failed to load reservations:", error);
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            ${escapeHtml(handleDatabaseError(error, "Failed to load reservations"))}
          </td>
        </tr>
      `;
      showToast(handleDatabaseError(error, "Error loading reservations"), "error");
      return;
    }

    allReservations = data || [];
    renderFilteredReservations();
  } catch (err) {
    console.error("Unexpected error in fetchReservations:", err);
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Unexpected error loading reservations.</td></tr>`;
  }
}

/**
 * Loads customers and tables for modal dropdown selectors.
 */
async function fetchReservationDropdownData() {
  try {
    const [custRes, tblRes] = await Promise.all([
      supabase.from("customers").select("customer_id, name, phone").order("name", { ascending: true }),
      supabase.from("restaurant_tables").select("table_id, table_number, capacity").order("table_number", { ascending: true }),
    ]);

    if (!custRes.error && custRes.data) {
      availableCustomers = custRes.data;
    }
    if (!tblRes.error && tblRes.data) {
      availableTables = tblRes.data;
    }

    populateDropdowns();
  } catch (err) {
    console.warn("Error fetching dropdown data for reservations:", err);
  }
}

/**
 * Populates customer and table select dropdowns in reservation modal.
 */
function populateDropdowns() {
  const customerSelect = document.getElementById("reservation-customer");
  const tableSelect = document.getElementById("reservation-table");

  if (customerSelect) {
    customerSelect.innerHTML = `<option value="">-- Choose registered customer --</option>`;
    for (const c of availableCustomers) {
      const opt = document.createElement("option");
      opt.value = c.customer_id;
      opt.textContent = `${c.name} (${c.phone})`;
      customerSelect.appendChild(opt);
    }
  }

  if (tableSelect) {
    tableSelect.innerHTML = `<option value="">-- None / Unassigned --</option>`;
    for (const t of availableTables) {
      const opt = document.createElement("option");
      opt.value = t.table_id;
      opt.textContent = `Table ${t.table_number} (${t.capacity} seats)`;
      tableSelect.appendChild(opt);
    }
  }
}

/**
 * Filters and renders reservations in table.
 */
function renderFilteredReservations() {
  const tbody = document.getElementById("reservations-table-body");
  if (!tbody) return;

  const searchVal = (document.getElementById("reservation-search-input")?.value || "").toLowerCase().trim();
  const statusVal = document.getElementById("reservation-status-filter")?.value || "";

  const filtered = allReservations.filter((res) => {
    // Search match
    if (searchVal) {
      const guestName = (res.customer?.name || "").toLowerCase();
      const guestPhone = (res.customer?.phone || "").toLowerCase();
      if (!guestName.includes(searchVal) && !guestPhone.includes(searchVal)) {
        return false;
      }
    }

    // Status filter
    if (statusVal && res.status !== statusVal) {
      return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-title">No reservations found</div>
          <p class="empty-state-text">No guest bookings match your current filter criteria.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((res) => {
      const guestName = res.customer ? res.customer.name : `<span class="badge badge-neutral">Deleted Guest (#${res.customer_id})</span>`;
      const guestPhone = res.customer ? res.customer.phone : "—";
      const tableLabel = res.table ? `Table ${res.table.table_number}` : `<span style="color:var(--color-text-muted);">Unassigned</span>`;

      return `
        <tr data-reservation-id="${escapeHtml(res.reservation_id)}">
          <td><strong>#${escapeHtml(res.reservation_id)}</strong></td>
          <td>${guestName}</td>
          <td>${escapeHtml(guestPhone)}</td>
          <td>${tableLabel}</td>
          <td>${formatDateTime(res.reservation_time)}</td>
          <td><strong>${escapeHtml(res.party_size)}</strong> guests</td>
          <td>${renderBadge(res.status, "reservation")}</td>
          <td class="cell-actions">
            <select class="form-control reservation-status-select" style="display:inline-block; width:auto; font-size:0.8rem; padding:4px 8px; margin-right:4px;">
              <option value="booked" ${res.status === "booked" ? "selected" : ""}>Booked</option>
              <option value="confirmed" ${res.status === "confirmed" ? "selected" : ""}>Confirmed</option>
              <option value="completed" ${res.status === "completed" ? "selected" : ""}>Completed</option>
              <option value="cancelled" ${res.status === "cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
            <button type="button" class="btn btn-icon btn-edit-reservation" title="Edit booking">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
            <button type="button" class="btn btn-icon btn-icon-danger btn-delete-reservation" title="Delete booking">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  attachReservationActionListeners();
}

/**
 * Attaches row event listeners for status change, edit, and delete.
 */
function attachReservationActionListeners() {
  const tbody = document.getElementById("reservations-table-body");
  if (!tbody) return;

  // Quick Status Select
  tbody.querySelectorAll(".reservation-status-select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const row = e.target.closest("tr");
      const resId = row?.getAttribute("data-reservation-id");
      const newStatus = select.value;
      if (!resId || !newStatus) return;

      select.disabled = true;

      try {
        const { error } = await supabase
          .from("reservations")
          .update({ status: newStatus })
          .eq("reservation_id", resId);

        if (error) {
          showToast(handleDatabaseError(error, "Failed to update reservation status"), "error");
          await fetchReservations();
        } else {
          showToast(`Reservation #${resId} updated to ${newStatus}`, "success");
          const res = allReservations.find((r) => String(r.reservation_id) === String(resId));
          if (res) res.status = newStatus;
          renderFilteredReservations();
        }
      } catch (err) {
        console.error("Status update error:", err);
      } finally {
        select.disabled = false;
      }
    });
  });

  // Edit Reservation
  tbody.querySelectorAll(".btn-edit-reservation").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const row = e.target.closest("tr");
      const resId = row?.getAttribute("data-reservation-id");
      if (!resId) return;

      const res = allReservations.find((r) => String(r.reservation_id) === String(resId));
      if (!res) return;

      openEditModal(res);
    });
  });

  // Delete Reservation
  tbody.querySelectorAll(".btn-delete-reservation").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const resId = row?.getAttribute("data-reservation-id");
      if (!resId) return;

      const confirmed = await showConfirmModal({
        title: "Cancel / Delete Reservation",
        message: `Are you sure you want to remove Reservation #${resId}?`,
        confirmText: "Delete",
        cancelText: "Keep",
        danger: true,
      });

      if (!confirmed) return;

      try {
        const { error } = await supabase
          .from("reservations")
          .delete()
          .eq("reservation_id", resId);

        if (error) {
          showToast(handleDatabaseError(error, "Failed to delete reservation"), "error");
        } else {
          showToast(`Reservation #${resId} removed`, "success");
          await fetchReservations();
        }
      } catch (err) {
        console.error("Error deleting reservation:", err);
        showToast("Unexpected error deleting reservation", "error");
      }
    });
  });
}

/**
 * Formats date into datetime-local value string (YYYY-MM-DDTHH:mm).
 */
function toDateTimeLocalString(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Opens modal for adding a new reservation.
 */
function openAddModal() {
  isEditingReservation = false;
  const form = document.getElementById("reservation-form");
  if (form) form.reset();

  const idInput = document.getElementById("reservation-id");
  const modalTitle = document.getElementById("reservation-modal-title");
  const timeInput = document.getElementById("reservation-time");
  const partyInput = document.getElementById("reservation-party-size");
  const statusSelect = document.getElementById("reservation-status");

  if (idInput) idInput.value = "";
  if (modalTitle) modalTitle.textContent = "New Reservation";
  if (partyInput) partyInput.value = "2";
  if (statusSelect) statusSelect.value = "booked";

  // Default time to tomorrow at 7:00 PM
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 1);
  defaultDate.setHours(19, 0, 0, 0);
  if (timeInput) timeInput.value = toDateTimeLocalString(defaultDate);

  populateDropdowns();
  openModal("reservation-modal");
}

/**
 * Opens modal populated with reservation data for editing.
 */
function openEditModal(res) {
  isEditingReservation = true;
  populateDropdowns();

  const idInput = document.getElementById("reservation-id");
  const custSelect = document.getElementById("reservation-customer");
  const tableSelect = document.getElementById("reservation-table");
  const timeInput = document.getElementById("reservation-time");
  const partyInput = document.getElementById("reservation-party-size");
  const statusSelect = document.getElementById("reservation-status");
  const modalTitle = document.getElementById("reservation-modal-title");

  if (idInput) idInput.value = res.reservation_id;
  if (custSelect) custSelect.value = res.customer_id;
  if (tableSelect) tableSelect.value = res.table_id || "";
  if (partyInput) partyInput.value = res.party_size;
  if (statusSelect) statusSelect.value = res.status;
  if (modalTitle) modalTitle.textContent = `Edit Reservation #${res.reservation_id}`;

  if (timeInput && res.reservation_time) {
    timeInput.value = toDateTimeLocalString(new Date(res.reservation_time));
  }

  openModal("reservation-modal");
}

let resListenersAttached = false;

/**
 * Sets up global reservation view event listeners.
 */
function setupReservationEventListeners() {
  if (resListenersAttached) return;
  resListenersAttached = true;

  // Add Reservation Button
  const addBtn = document.getElementById("btn-add-reservation");
  if (addBtn) addBtn.addEventListener("click", openAddModal);

  // Search Input with Debounce
  const searchInput = document.getElementById("reservation-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(renderFilteredReservations, 250));
  }

  // Status Filter
  const statusFilter = document.getElementById("reservation-status-filter");
  if (statusFilter) statusFilter.addEventListener("change", renderFilteredReservations);

  // Close Modal Buttons
  document.querySelectorAll('[data-close="reservation-modal"]').forEach((btn) => {
    btn.addEventListener("click", () => closeModal("reservation-modal"));
  });

  // Modal Form Submit
  const form = document.getElementById("reservation-form");
  const submitBtn = document.getElementById("reservation-submit-btn");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const customer_id = document.getElementById("reservation-customer")?.value;
      const tableIdVal = document.getElementById("reservation-table")?.value;
      const table_id = tableIdVal ? tableIdVal : null;
      const timeStr = document.getElementById("reservation-time")?.value;
      const partyStr = document.getElementById("reservation-party-size")?.value;
      const status = document.getElementById("reservation-status")?.value;
      const resId = document.getElementById("reservation-id")?.value;

      const party_size = parseInt(partyStr, 10);

      // Validation
      if (!customer_id) {
        showToast("Please select a customer for this reservation", "warning");
        return;
      }

      if (!timeStr) {
        showToast("Reservation date and time is required", "warning");
        return;
      }

      if (isNaN(party_size) || party_size < 1) {
        showToast("Party size must be at least 1 guest", "warning");
        return;
      }

      const reservation_time = new Date(timeStr).toISOString();

      setButtonLoading(submitBtn, true, "Saving...");

      try {
        if (isEditingReservation && resId) {
          // Update
          const { error } = await supabase
            .from("reservations")
            .update({
              customer_id,
              table_id,
              reservation_time,
              party_size,
              status,
            })
            .eq("reservation_id", resId);

          if (error) {
            showToast(handleDatabaseError(error, "Failed to update reservation"), "error");
          } else {
            showToast(`Reservation #${resId} updated successfully`, "success");
            closeModal("reservation-modal");
            await fetchReservations();
          }
        } else {
          // Insert
          const { error } = await supabase
            .from("reservations")
            .insert([{
              customer_id,
              table_id,
              reservation_time,
              party_size,
              status,
            }]);

          if (error) {
            showToast(handleDatabaseError(error, "Failed to create reservation"), "error");
          } else {
            showToast("New reservation booked successfully", "success");
            closeModal("reservation-modal");
            await fetchReservations();
          }
        }
      } catch (err) {
        console.error("Reservation submit error:", err);
        showToast("Unexpected error saving reservation", "error");
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  }
}
