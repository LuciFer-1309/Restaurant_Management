/**
 * Menu Management Module
 * Complete CRUD operations, real-time search, category filtering, and availability toggles.
 */

import { supabase, handleDatabaseError } from "./supabaseClient.js";
import {
  formatCurrency,
  renderBadge,
  escapeHtml,
  showToast,
  showConfirmModal,
  openModal,
  closeModal,
  setButtonLoading,
  debounce,
} from "./utils.js";

let allMenuItems = [];
let isEditing = false;

/**
 * Initializes and loads menu view.
 */
export async function loadMenu() {
  if (!supabase) return;
  setupMenuEventListeners();
  await fetchMenuItems();
}

/**
 * Fetches all menu items from Supabase.
 */
async function fetchMenuItems() {
  const tbody = document.getElementById("menu-table-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Loading menu items...</td></tr>`;

  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("menu_item_id, name, category, description, price, is_available, created_at")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to load menu items:", error);
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            ${escapeHtml(handleDatabaseError(error, "Failed to load menu items"))}
          </td>
        </tr>
      `;
      showToast(handleDatabaseError(error, "Error loading menu"), "error");
      return;
    }

    allMenuItems = data || [];
    populateCategoryFilter();
    renderFilteredMenu();
  } catch (err) {
    console.error("Unexpected error in fetchMenuItems:", err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Unexpected error loading menu.</td></tr>`;
  }
}

/**
 * Populates the category select filter dynamically from unique categories.
 */
function populateCategoryFilter() {
  const categoryFilter = document.getElementById("menu-category-filter");
  if (!categoryFilter) return;

  const currentSelection = categoryFilter.value;
  const categories = Array.from(new Set(allMenuItems.map((i) => i.category).filter(Boolean))).sort();

  categoryFilter.innerHTML = `<option value="">All Categories</option>`;
  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    if (cat === currentSelection) opt.selected = true;
    categoryFilter.appendChild(opt);
  }
}

/**
 * Filters and renders menu items in the table.
 */
function renderFilteredMenu() {
  const tbody = document.getElementById("menu-table-body");
  if (!tbody) return;

  const searchVal = (document.getElementById("menu-search-input")?.value || "").toLowerCase().trim();
  const categoryVal = document.getElementById("menu-category-filter")?.value || "";
  const availVal = document.getElementById("menu-availability-filter")?.value || "";

  const filtered = allMenuItems.filter((item) => {
    // Search match
    if (searchVal) {
      const nameMatch = (item.name || "").toLowerCase().includes(searchVal);
      const descMatch = (item.description || "").toLowerCase().includes(searchVal);
      if (!nameMatch && !descMatch) return false;
    }

    // Category match
    if (categoryVal && item.category !== categoryVal) {
      return false;
    }

    // Availability match
    if (availVal === "available" && !item.is_available) return false;
    if (availVal === "unavailable" && item.is_available) return false;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-state-title">No menu items found</div>
          <p class="empty-state-text">Try adjusting your search filters or click "Add Menu Item" to create one.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((item) => {
      const availLabel = item.is_available ? "Disable" : "Enable";
      const availBtnClass = item.is_available ? "btn-secondary" : "btn-primary";

      return `
        <tr data-item-id="${escapeHtml(item.menu_item_id)}">
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td><span class="badge badge-neutral">${escapeHtml(item.category)}</span></td>
          <td style="max-width: 280px; font-size: 0.82rem; color: var(--color-text-secondary);">
            ${escapeHtml(item.description || "—")}
          </td>
          <td class="cell-numeric" style="font-weight: 600;">${formatCurrency(item.price)}</td>
          <td>${renderBadge(item.is_available, "availability")}</td>
          <td class="cell-actions">
            <button type="button" class="btn ${availBtnClass} btn-sm btn-toggle-avail" title="${availLabel} dish" style="margin-right: 4px;">
              ${availLabel}
            </button>
            <button type="button" class="btn btn-icon btn-edit-menu" title="Edit dish">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
            <button type="button" class="btn btn-icon btn-icon-danger btn-delete-menu" title="Delete dish">
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

  attachRowActionListeners();
}

/**
 * Attaches event listeners for edit, delete, and toggle availability buttons.
 */
function attachRowActionListeners() {
  const tbody = document.getElementById("menu-table-body");
  if (!tbody) return;

  // Toggle Availability
  tbody.querySelectorAll(".btn-toggle-avail").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const itemId = row?.getAttribute("data-item-id");
      if (!itemId) return;

      const item = allMenuItems.find((i) => String(i.menu_item_id) === String(itemId));
      if (!item) return;

      const newStatus = !item.is_available;
      btn.disabled = true;

      try {
        const { error } = await supabase
          .from("menu_items")
          .update({ is_available: newStatus })
          .eq("menu_item_id", itemId);

        if (error) {
          showToast(handleDatabaseError(error, "Failed to update availability"), "error");
        } else {
          item.is_available = newStatus;
          showToast(`'${item.name}' marked as ${newStatus ? "Available" : "Unavailable"}`, "success");
          renderFilteredMenu();
        }
      } catch (err) {
        console.error("Availability toggle error:", err);
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Edit Menu Item
  tbody.querySelectorAll(".btn-edit-menu").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const row = e.target.closest("tr");
      const itemId = row?.getAttribute("data-item-id");
      if (!itemId) return;

      const item = allMenuItems.find((i) => String(i.menu_item_id) === String(itemId));
      if (!item) return;

      openEditModal(item);
    });
  });

  // Delete Menu Item
  tbody.querySelectorAll(".btn-delete-menu").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const itemId = row?.getAttribute("data-item-id");
      if (!itemId) return;

      const item = allMenuItems.find((i) => String(i.menu_item_id) === String(itemId));
      if (!item) return;

      const confirmed = await showConfirmModal({
        title: "Delete Menu Item",
        message: `Are you sure you want to permanently delete "${item.name}"? If this item was ever ordered, database constraints may prevent deletion to protect historical order history.`,
        confirmText: "Delete Item",
        cancelText: "Keep Item",
        danger: true,
      });

      if (!confirmed) return;

      try {
        const { error } = await supabase
          .from("menu_items")
          .delete()
          .eq("menu_item_id", itemId);

        if (error) {
          showToast(handleDatabaseError(error, `Cannot delete '${item.name}'`), "error");
        } else {
          showToast(`'${item.name}' has been deleted`, "success");
          await fetchMenuItems();
        }
      } catch (err) {
        console.error("Error deleting menu item:", err);
        showToast("Unexpected error deleting menu item", "error");
      }
    });
  });
}

/**
 * Opens modal for adding a new item.
 */
function openAddModal() {
  isEditing = false;
  const form = document.getElementById("menu-item-form");
  if (form) form.reset();

  const idInput = document.getElementById("menu-item-id");
  const modalTitle = document.getElementById("menu-modal-title");
  const availCheckbox = document.getElementById("menu-item-available");

  if (idInput) idInput.value = "";
  if (modalTitle) modalTitle.textContent = "Add Menu Item";
  if (availCheckbox) availCheckbox.checked = true;

  openModal("menu-modal");
}

/**
 * Opens modal populated with existing item data for editing.
 */
function openEditModal(item) {
  isEditing = true;
  const idInput = document.getElementById("menu-item-id");
  const nameInput = document.getElementById("menu-item-name");
  const categoryInput = document.getElementById("menu-item-category");
  const priceInput = document.getElementById("menu-item-price");
  const descInput = document.getElementById("menu-item-desc");
  const availCheckbox = document.getElementById("menu-item-available");
  const modalTitle = document.getElementById("menu-modal-title");

  if (idInput) idInput.value = item.menu_item_id;
  if (nameInput) nameInput.value = item.name;
  if (categoryInput) categoryInput.value = item.category;
  if (priceInput) priceInput.value = item.price;
  if (descInput) descInput.value = item.description || "";
  if (availCheckbox) availCheckbox.checked = item.is_available;
  if (modalTitle) modalTitle.textContent = "Edit Menu Item";

  openModal("menu-modal");
}

let eventListenersAttached = false;

/**
 * Sets up global menu view event listeners.
 */
function setupMenuEventListeners() {
  if (eventListenersAttached) return;
  eventListenersAttached = true;

  // Add Item Button
  const addBtn = document.getElementById("btn-add-menu-item");
  if (addBtn) addBtn.addEventListener("click", openAddModal);

  // Search Input with Debounce
  const searchInput = document.getElementById("menu-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(renderFilteredMenu, 250));
  }

  // Category and Availability Filter dropdowns
  const catFilter = document.getElementById("menu-category-filter");
  if (catFilter) catFilter.addEventListener("change", renderFilteredMenu);

  const availFilter = document.getElementById("menu-availability-filter");
  if (availFilter) availFilter.addEventListener("change", renderFilteredMenu);

  // Close Modal Buttons
  document.querySelectorAll('[data-close="menu-modal"]').forEach((btn) => {
    btn.addEventListener("click", () => closeModal("menu-modal"));
  });

  // Modal Form Submit
  const form = document.getElementById("menu-item-form");
  const submitBtn = document.getElementById("menu-item-submit-btn");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("menu-item-name")?.value.trim();
      const category = document.getElementById("menu-item-category")?.value.trim();
      const priceStr = document.getElementById("menu-item-price")?.value;
      const description = document.getElementById("menu-item-desc")?.value.trim() || null;
      const is_available = document.getElementById("menu-item-available")?.checked ?? true;
      const itemId = document.getElementById("menu-item-id")?.value;

      const price = parseFloat(priceStr);

      // Validation
      if (!name || !category) {
        showToast("Dish name and category are required", "warning");
        return;
      }

      if (isNaN(price) || price < 0) {
        showToast("Price must be a valid non-negative number", "warning");
        return;
      }

      setButtonLoading(submitBtn, true, "Saving...");

      try {
        if (isEditing && itemId) {
          // Update
          const { error } = await supabase
            .from("menu_items")
            .update({
              name,
              category,
              description,
              price,
              is_available,
            })
            .eq("menu_item_id", itemId);

          if (error) {
            showToast(handleDatabaseError(error, "Failed to update item"), "error");
          } else {
            showToast(`'${name}' updated successfully`, "success");
            closeModal("menu-modal");
            await fetchMenuItems();
          }
        } else {
          // Insert
          const { error } = await supabase
            .from("menu_items")
            .insert([{
              name,
              category,
              description,
              price,
              is_available,
            }]);

          if (error) {
            showToast(handleDatabaseError(error, "Failed to create item"), "error");
          } else {
            showToast(`'${name}' added to menu`, "success");
            closeModal("menu-modal");
            await fetchMenuItems();
          }
        }
      } catch (err) {
        console.error("Form submit error:", err);
        showToast("Unexpected error saving menu item", "error");
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  }
}
