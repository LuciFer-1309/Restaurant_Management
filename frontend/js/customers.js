/**
 * Customers Directory Module
 * Customer records CRUD, search, unique phone constraint validation, and FK deletion safety.
 */

import { supabase, handleDatabaseError } from "./supabaseClient.js";
import {
  formatDate,
  escapeHtml,
  showToast,
  showConfirmModal,
  openModal,
  closeModal,
  setButtonLoading,
  debounce,
} from "./utils.js";

let allCustomers = [];
let isEditingCustomer = false;

/**
 * Initializes and loads the customers view.
 */
export async function loadCustomers() {
  if (!supabase) return;
  setupCustomerEventListeners();
  await fetchCustomers();
}

/**
 * Fetches all customers from Supabase.
 */
async function fetchCustomers() {
  const tbody = document.getElementById("customers-table-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Loading customers...</td></tr>`;

  try {
    const { data, error } = await supabase
      .from("customers")
      .select("customer_id, name, phone, email, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load customers:", error);
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            ${escapeHtml(handleDatabaseError(error, "Failed to load customers"))}
          </td>
        </tr>
      `;
      showToast(handleDatabaseError(error, "Error loading customers"), "error");
      return;
    }

    allCustomers = data || [];
    renderFilteredCustomers();
  } catch (err) {
    console.error("Unexpected error in fetchCustomers:", err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Unexpected error loading customers.</td></tr>`;
  }
}

/**
 * Filters and renders customers in the table.
 */
function renderFilteredCustomers() {
  const tbody = document.getElementById("customers-table-body");
  if (!tbody) return;

  const searchVal = (document.getElementById("customer-search-input")?.value || "").toLowerCase().trim();

  const filtered = allCustomers.filter((c) => {
    if (!searchVal) return true;
    const nameMatch = (c.name || "").toLowerCase().includes(searchVal);
    const phoneMatch = (c.phone || "").toLowerCase().includes(searchVal);
    const emailMatch = (c.email || "").toLowerCase().includes(searchVal);
    return nameMatch || phoneMatch || emailMatch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-state-title">No customers found</div>
          <p class="empty-state-text">No guest records match your search criteria.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((cust) => {
      return `
        <tr data-customer-id="${escapeHtml(cust.customer_id)}">
          <td>#${escapeHtml(cust.customer_id)}</td>
          <td><strong>${escapeHtml(cust.name)}</strong></td>
          <td>${escapeHtml(cust.phone)}</td>
          <td>${escapeHtml(cust.email || "—")}</td>
          <td>${formatDate(cust.created_at)}</td>
          <td class="cell-actions">
            <button type="button" class="btn btn-icon btn-edit-customer" title="Edit guest profile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
            <button type="button" class="btn btn-icon btn-icon-danger btn-delete-customer" title="Delete customer">
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

  attachCustomerActionListeners();
}

/**
 * Attaches event listeners for edit and delete actions on customer rows.
 */
function attachCustomerActionListeners() {
  const tbody = document.getElementById("customers-table-body");
  if (!tbody) return;

  // Edit Customer
  tbody.querySelectorAll(".btn-edit-customer").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const row = e.target.closest("tr");
      const custId = row?.getAttribute("data-customer-id");
      if (!custId) return;

      const customer = allCustomers.find((c) => String(c.customer_id) === String(custId));
      if (!customer) return;

      openEditModal(customer);
    });
  });

  // Delete Customer
  tbody.querySelectorAll(".btn-delete-customer").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const custId = row?.getAttribute("data-customer-id");
      if (!custId) return;

      const customer = allCustomers.find((c) => String(c.customer_id) === String(custId));
      if (!customer) return;

      const confirmed = await showConfirmModal({
        title: "Delete Customer",
        message: `Are you sure you want to delete customer record "${customer.name}"? If this customer has existing orders or reservations, the database will preserve their record.`,
        confirmText: "Delete Customer",
        cancelText: "Cancel",
        danger: true,
      });

      if (!confirmed) return;

      try {
        const { error } = await supabase
          .from("customers")
          .delete()
          .eq("customer_id", custId);

        if (error) {
          showToast(handleDatabaseError(error, `Cannot delete customer '${customer.name}'`), "error");
        } else {
          showToast(`Customer '${customer.name}' deleted`, "success");
          await fetchCustomers();
        }
      } catch (err) {
        console.error("Error deleting customer:", err);
        showToast("Unexpected error deleting customer", "error");
      }
    });
  });
}

/**
 * Opens modal for adding a new customer.
 */
function openAddModal() {
  isEditingCustomer = false;
  const form = document.getElementById("customer-form");
  if (form) form.reset();

  const idInput = document.getElementById("customer-id");
  const modalTitle = document.getElementById("customer-modal-title");

  if (idInput) idInput.value = "";
  if (modalTitle) modalTitle.textContent = "Add Customer";

  openModal("customer-modal");
}

/**
 * Opens modal populated with customer data for editing.
 */
function openEditModal(customer) {
  isEditingCustomer = true;
  const idInput = document.getElementById("customer-id");
  const nameInput = document.getElementById("customer-name");
  const phoneInput = document.getElementById("customer-phone");
  const emailInput = document.getElementById("customer-email");
  const modalTitle = document.getElementById("customer-modal-title");

  if (idInput) idInput.value = customer.customer_id;
  if (nameInput) nameInput.value = customer.name;
  if (phoneInput) phoneInput.value = customer.phone;
  if (emailInput) emailInput.value = customer.email || "";
  if (modalTitle) modalTitle.textContent = "Edit Customer";

  openModal("customer-modal");
}

let customerListenersAttached = false;

/**
 * Sets up global customer view event listeners.
 */
function setupCustomerEventListeners() {
  if (customerListenersAttached) return;
  customerListenersAttached = true;

  // Add Customer Button
  const addBtn = document.getElementById("btn-add-customer");
  if (addBtn) addBtn.addEventListener("click", openAddModal);

  // Search Input with Debounce
  const searchInput = document.getElementById("customer-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(renderFilteredCustomers, 250));
  }

  // Close Modal Buttons
  document.querySelectorAll('[data-close="customer-modal"]').forEach((btn) => {
    btn.addEventListener("click", () => closeModal("customer-modal"));
  });

  // Modal Form Submit
  const form = document.getElementById("customer-form");
  const submitBtn = document.getElementById("customer-submit-btn");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("customer-name")?.value.trim();
      const phone = document.getElementById("customer-phone")?.value.trim();
      const email = document.getElementById("customer-email")?.value.trim() || null;
      const custId = document.getElementById("customer-id")?.value;

      // Validation
      if (!name || !phone) {
        showToast("Customer name and phone number are required", "warning");
        return;
      }

      setButtonLoading(submitBtn, true, "Saving...");

      try {
        if (isEditingCustomer && custId) {
          // Update
          const { error } = await supabase
            .from("customers")
            .update({
              name,
              phone,
              email,
            })
            .eq("customer_id", custId);

          if (error) {
            showToast(handleDatabaseError(error, "Failed to update customer"), "error");
          } else {
            showToast(`Customer '${name}' updated successfully`, "success");
            closeModal("customer-modal");
            await fetchCustomers();
          }
        } else {
          // Insert
          const { error } = await supabase
            .from("customers")
            .insert([{
              name,
              phone,
              email,
            }]);

          if (error) {
            showToast(handleDatabaseError(error, "Failed to add customer"), "error");
          } else {
            showToast(`Customer '${name}' registered successfully`, "success");
            closeModal("customer-modal");
            await fetchCustomers();
          }
        }
      } catch (err) {
        console.error("Customer form submit error:", err);
        showToast("Unexpected error saving customer", "error");
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  }
}
