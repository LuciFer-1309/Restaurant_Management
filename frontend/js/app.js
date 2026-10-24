/**
 * Main Application Orchestrator & Router
 * Manages view routing, mobile drawer navigation, top bar state, and data refresh cycles.
 */

import { initAuth } from "./auth.js";
import { loadDashboard } from "./dashboard.js";
import { loadMenu } from "./menu.js";
import { loadOrders } from "./orders.js";
import { loadReservations } from "./reservations.js";
import { loadTables } from "./tables.js";
import { loadCustomers } from "./customers.js";

const VIEW_TITLES = {
  dashboard: "Dashboard Overview",
  menu: "Menu Catalog Management",
  orders: "Orders & Billing",
  reservations: "Table Reservations",
  tables: "Restaurant Tables Floor",
  customers: "Customer Directory",
};

let currentActiveView = "dashboard";

/**
 * Initializes the application on DOM ready.
 */
document.addEventListener("DOMContentLoaded", async () => {
  setupNavigationHandlers();
  setupMobileDrawerHandlers();
  setupRefreshButton();
  setupDashboardQuickLinks();

  // Initialize Supabase Auth state listener
  await initAuth((user, session) => {
    if (user) {
      // User is authenticated -> load current view
      const initialView = getHashView() || "dashboard";
      navigateToView(initialView);
    }
  });

  // Handle browser back/forward buttons
  window.addEventListener("hashchange", () => {
    const hashView = getHashView();
    if (hashView && hashView !== currentActiveView) {
      navigateToView(hashView);
    }
  });
});

/**
 * Extracts view name from window.location.hash.
 */
function getHashView() {
  const hash = window.location.hash.replace("#", "").toLowerCase().trim();
  if (VIEW_TITLES[hash]) return hash;
  return null;
}

/**
 * Switches the active view and loads real Supabase data.
 *
 * @param {string} viewName - Name of view (e.g. 'dashboard', 'menu', 'orders')
 */
export async function navigateToView(viewName) {
  if (!VIEW_TITLES[viewName]) viewName = "dashboard";
  currentActiveView = viewName;
  window.location.hash = `#${viewName}`;

  // Update Page Title
  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = VIEW_TITLES[viewName];

  // Update Sidebar Active Class
  document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
    const target = link.getAttribute("data-view");
    if (target === viewName) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Switch View Sections
  document.querySelectorAll(".view-section").forEach((sec) => {
    sec.classList.remove("active");
  });

  const activeSection = document.getElementById(`view-${viewName}`);
  if (activeSection) {
    activeSection.classList.add("active");
  }

  // Close Mobile Drawer if open
  closeMobileDrawer();

  // Trigger Data Load for specific view
  await triggerViewDataLoad(viewName);
}

/**
 * Calls data loading functions for the active view.
 */
async function triggerViewDataLoad(viewName) {
  switch (viewName) {
    case "dashboard":
      await loadDashboard();
      break;
    case "menu":
      await loadMenu();
      break;
    case "orders":
      await loadOrders();
      break;
    case "reservations":
      await loadReservations();
      break;
    case "tables":
      await loadTables();
      break;
    case "customers":
      await loadCustomers();
      break;
  }
}

/**
 * Binds click events to sidebar navigation buttons.
 */
function setupNavigationHandlers() {
  document.querySelectorAll(".sidebar-nav .nav-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      if (view) navigateToView(view);
    });
  });
}

/**
 * Binds mobile hamburger toggle and backdrop click.
 */
function setupMobileDrawerHandlers() {
  const toggleBtn = document.getElementById("mobile-menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      sidebar?.classList.toggle("mobile-open");
      overlay?.classList.toggle("mobile-open");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", closeMobileDrawer);
  }
}

function closeMobileDrawer() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  sidebar?.classList.remove("mobile-open");
  overlay?.classList.remove("mobile-open");
}

/**
 * Binds the global top bar Refresh button.
 */
function setupRefreshButton() {
  const refreshBtn = document.getElementById("btn-refresh-view");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      try {
        await triggerViewDataLoad(currentActiveView);
      } finally {
        setTimeout(() => {
          refreshBtn.disabled = false;
        }, 300);
      }
    });
  }
}

/**
 * Binds quick link buttons located on the dashboard card view.
 */
function setupDashboardQuickLinks() {
  const viewOrdersBtn = document.getElementById("dash-view-all-orders");
  const viewTablesBtn = document.getElementById("dash-view-all-tables");

  if (viewOrdersBtn) {
    viewOrdersBtn.addEventListener("click", () => navigateToView("orders"));
  }

  if (viewTablesBtn) {
    viewTablesBtn.addEventListener("click", () => navigateToView("tables"));
  }
}
