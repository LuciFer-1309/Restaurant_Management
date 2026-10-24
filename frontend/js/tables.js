/**
 * Restaurant Tables Floor Management Module
 * Dining floor table management, seating capacity, real-time status updates (available/occupied/reserved).
 */

import { supabase, handleDatabaseError } from "./supabaseClient.js";
import {
  renderBadge,
  escapeHtml,
  showToast,
  showConfirmModal,
  openModal,
  closeModal,
  setButtonLoading,
} from "./utils.js";

let allTables = [];
let isEditingTable = false;

/**
 * Initializes and loads tables view.
 */
export async function loadTables() {
  if (!supabase) return;
  setupTableEventListeners();
  await fetchTables();
}

/**
 * Fetches all restaurant tables from Supabase.
 */
async function fetchTables() {
  const container = document.getElementById("tables-grid-container");
  if (!container) return;

  container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">Loading restaurant tables...</div>`;

  try {
    const { data, error } = await supabase
      .from("restaurant_tables")
      .select("table_id, table_number, capacity, status")
      .order("table_number", { ascending: true });

    if (error) {
      console.error("Failed to load tables:", error);
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          ${escapeHtml(handleDatabaseError(error, "Failed to load tables"))}
        </div>
      `;
      showToast(handleDatabaseError(error, "Error loading tables"), "error");
      return;
    }

    allTables = data || [];
    renderFilteredTables();
  } catch (err) {
    console.error("Unexpected error in fetchTables:", err);
    container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">Unexpected error loading tables.</div>`;
  }
}

/**
 * Filters and renders tables in a responsive card grid.
 */
function renderFilteredTables() {
  const container = document.getElementById("tables-grid-container");
  if (!container) return;

  const statusFilter = document.getElementById("tables-status-filter")?.value || "";

  const filtered = allTables.filter((t) => {
    if (!statusFilter) return true;
    return t.status === statusFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-title">No tables found</div>
        <p class="empty-state-text">No tables match the selected status filter, or none have been created yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((tbl) => {
      return `
        <div class="restaurant-table-card" data-table-id="${escapeHtml(tbl.table_id)}">
          <div class="table-card-header">
            <span class="table-card-number">Table ${escapeHtml(tbl.table_number)}</span>
            ${renderBadge(tbl.status, "table")}
          </div>

          <div class="table-card-capacity">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            <span>Seats up to <strong>${escapeHtml(tbl.capacity)}</strong> guests</span>
          </div>

          <div style="margin-bottom: 14px;">
            <label class="form-label" style="font-size: 0.78rem; margin-bottom: 4px;">Quick Status:</label>
            <select class="form-control table-status-select" style="font-size: 0.82rem; padding: 6px 10px;">
              <option value="available" ${tbl.status === "available" ? "selected" : ""}>Available</option>
              <option value="occupied" ${tbl.status === "occupied" ? "selected" : ""}>Occupied</option>
              <option value="reserved" ${tbl.status === "reserved" ? "selected" : ""}>Reserved</option>
            </select>
          </div>

          <div class="table-card-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-edit-table">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Edit
            </button>
            <button type="button" class="btn btn-icon btn-icon-danger btn-delete-table" title="Delete table">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  attachTableCardListeners();
}

/**
 * Attaches event listeners for quick status update, edit, and delete on table cards.
 */
function attachTableCardListeners() {
  const container = document.getElementById("tables-grid-container");
  if (!container) return;

  // Quick Status Select
  container.querySelectorAll(".table-status-select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const card = e.target.closest(".restaurant-table-card");
      const tableId = card?.getAttribute("data-table-id");
      const newStatus = select.value;
      if (!tableId || !newStatus) return;

      select.disabled = true;

      try {
        const { error } = await supabase
          .from("restaurant_tables")
          .update({ status: newStatus })
          .eq("table_id", tableId);

        if (error) {
          showToast(handleDatabaseError(error, "Failed to update table status"), "error");
          await fetchTables(); // Revert select to database state
        } else {
          showToast(`Table status updated to ${newStatus}`, "success");
          const tbl = allTables.find((t) => String(t.table_id) === String(tableId));
          if (tbl) tbl.status = newStatus;
          renderFilteredTables();
        }
      } catch (err) {
        console.error("Status update error:", err);
      } finally {
        select.disabled = false;
      }
    });
  });

  // Edit Table
  container.querySelectorAll(".btn-edit-table").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const card = e.target.closest(".restaurant-table-card");
      const tableId = card?.getAttribute("data-table-id");
      if (!tableId) return;

      const tbl = allTables.find((t) => String(t.table_id) === String(tableId));
      if (!tbl) return;

      openEditModal(tbl);
    });
  });

  // Delete Table
  container.querySelectorAll(".btn-delete-table").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest(".restaurant-table-card");
      const tableId = card?.getAttribute("data-table-id");
      if (!tableId) return;

      const tbl = allTables.find((t) => String(t.table_id) === String(tableId));
      if (!tbl) return;

      const confirmed = await showConfirmModal({
        title: "Delete Table",
        message: `Are you sure you want to delete Table ${tbl.table_number}? If this table is referenced in past orders or active reservations, the database will preserve it.`,
        confirmText: "Delete Table",
        cancelText: "Cancel",
        danger: true,
      });

      if (!confirmed) return;

      try {
        const { error } = await supabase
          .from("restaurant_tables")
          .delete()
          .eq("table_id", tableId);

        if (error) {
          showToast(handleDatabaseError(error, `Cannot delete Table ${tbl.table_number}`), "error");
        } else {
          showToast(`Table ${tbl.table_number} deleted`, "success");
          await fetchTables();
        }
      } catch (err) {
        console.error("Error deleting table:", err);
        showToast("Unexpected error deleting table", "error");
      }
    });
  });
}

/**
 * Opens modal for adding a new table.
 */
function openAddModal() {
  isEditingTable = false;
  const form = document.getElementById("table-form");
  if (form) form.reset();

  const idInput = document.getElementById("table-id");
  const modalTitle = document.getElementById("table-modal-title");
  const statusSelect = document.getElementById("table-status");

  if (idInput) idInput.value = "";
  if (modalTitle) modalTitle.textContent = "Add Restaurant Table";
  if (statusSelect) statusSelect.value = "available";

  openModal("table-modal");
}

/**
 * Opens modal populated with table data for editing.
 */
function openEditModal(tbl) {
  isEditingTable = true;
  const idInput = document.getElementById("table-id");
  const numberInput = document.getElementById("table-number");
  const capacityInput = document.getElementById("table-capacity");
  const statusSelect = document.getElementById("table-status");
  const modalTitle = document.getElementById("table-modal-title");

  if (idInput) idInput.value = tbl.table_id;
  if (numberInput) numberInput.value = tbl.table_number;
  if (capacityInput) capacityInput.value = tbl.capacity;
  if (statusSelect) statusSelect.value = tbl.status;
  if (modalTitle) modalTitle.textContent = "Edit Restaurant Table";

  openModal("table-modal");
}

let tableListenersAttached = false;

/**
 * Sets up global table view event listeners.
 */
function setupTableEventListeners() {
  if (tableListenersAttached) return;
  tableListenersAttached = true;

  // Add Table Button
  const addBtn = document.getElementById("btn-add-table");
  if (addBtn) addBtn.addEventListener("click", openAddModal);

  // Status Filter Select
  const statusFilter = document.getElementById("tables-status-filter");
  if (statusFilter) statusFilter.addEventListener("change", renderFilteredTables);

  // Close Modal Buttons
  document.querySelectorAll('[data-close="table-modal"]').forEach((btn) => {
    btn.addEventListener("click", () => closeModal("table-modal"));
  });

  // Modal Form Submit
  const form = document.getElementById("table-form");
  const submitBtn = document.getElementById("table-submit-btn");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const tableNumberStr = document.getElementById("table-number")?.value;
      const capacityStr = document.getElementById("table-capacity")?.value;
      const status = document.getElementById("table-status")?.value;
      const tableId = document.getElementById("table-id")?.value;

      const table_number = parseInt(tableNumberStr, 10);
      const capacity = parseInt(capacityStr, 10);

      // Validation
      if (isNaN(table_number) || table_number < 1) {
        showToast("Table number must be a positive integer", "warning");
        return;
      }

      if (isNaN(capacity) || capacity < 1) {
        showToast("Capacity must be at least 1 guest", "warning");
        return;
      }

      const allowedStatuses = ["available", "occupied", "reserved"];
      if (!allowedStatuses.includes(status)) {
        showToast("Status must be available, occupied, or reserved", "warning");
        return;
      }

      setButtonLoading(submitBtn, true, "Saving...");

      try {
        if (isEditingTable && tableId) {
          // Update
          const { error } = await supabase
            .from("restaurant_tables")
            .update({
              table_number,
              capacity,
              status,
            })
            .eq("table_id", tableId);

          if (error) {
            showToast(handleDatabaseError(error, "Failed to update table"), "error");
          } else {
            showToast(`Table ${table_number} updated successfully`, "success");
            closeModal("table-modal");
            await fetchTables();
          }
        } else {
          // Insert
          const { error } = await supabase
            .from("restaurant_tables")
            .insert([{
              table_number,
              capacity,
              status,
            }]);

          if (error) {
            showToast(handleDatabaseError(error, "Failed to add table"), "error");
          } else {
            showToast(`Table ${table_number} created successfully`, "success");
            closeModal("table-modal");
            await fetchTables();
          }
        }
      } catch (err) {
        console.error("Table form submit error:", err);
        showToast("Unexpected error saving table", "error");
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  }
}
