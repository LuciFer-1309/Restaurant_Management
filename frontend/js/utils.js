/**
 * Utility functions for DOM manipulation, XSS protection, formatting, and UI notifications.
 */

/**
 * Escapes HTML characters to prevent Cross-Site Scripting (XSS).
 * Strictly used whenever rendering untrusted database content into HTML strings.
 *
 * @param {string|number|null|undefined} value - String or value to escape
 * @returns {string} - Safe string
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formats a numeric value as US currency ($0.00).
 *
 * @param {number|string} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats an ISO date-time string into a human-readable local date and time.
 *
 * @param {string} isoString
 * @returns {string}
 */
export function formatDateTime(isoString) {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return String(isoString);
  }
}

/**
 * Formats an ISO date-time string into just the date portion.
 *
 * @param {string} isoString
 * @returns {string}
 */
export function formatDate(isoString) {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return String(isoString);
  }
}

/**
 * Returns HTML for a styled status badge based on entity and status value.
 *
 * @param {string} status - Status code
 * @param {'table'|'order'|'reservation'|'payment'|'availability'} [type='order']
 * @returns {string} HTML markup
 */
export function renderBadge(status, type = "order") {
  if (!status) return `<span class="badge badge-neutral">—</span>`;

  const s = String(status).toLowerCase();
  let badgeClass = "badge-neutral";
  let label = status.replace(/_/g, " ");

  // Normalize label capitalize
  label = label.charAt(0).toUpperCase() + label.slice(1);

  if (type === "table") {
    if (s === "available") badgeClass = "badge-success";
    else if (s === "occupied") badgeClass = "badge-warning";
    else if (s === "reserved") badgeClass = "badge-info";
  } else if (type === "order") {
    if (s === "placed") badgeClass = "badge-info";
    else if (s === "preparing") badgeClass = "badge-warning";
    else if (s === "ready") badgeClass = "badge-primary";
    else if (s === "completed") badgeClass = "badge-success";
    else if (s === "cancelled") badgeClass = "badge-danger";
  } else if (type === "reservation") {
    if (s === "booked") badgeClass = "badge-info";
    else if (s === "confirmed") badgeClass = "badge-primary";
    else if (s === "completed") badgeClass = "badge-success";
    else if (s === "cancelled") badgeClass = "badge-danger";
  } else if (type === "payment") {
    if (s === "completed") badgeClass = "badge-success";
    else if (s === "pending") badgeClass = "badge-warning";
    else if (s === "failed") badgeClass = "badge-danger";
    else if (s === "refunded") badgeClass = "badge-neutral";
  } else if (type === "availability") {
    if (s === "true" || s === "available" || status === true) {
      badgeClass = "badge-success";
      label = "Available";
    } else {
      badgeClass = "badge-danger";
      label = "Unavailable";
    }
  }

  return `<span class="badge ${badgeClass}">${escapeHtml(label)}</span>`;
}

/**
 * Shows an accessible toast notification message.
 *
 * @param {string} message - Message text
 * @param {'success'|'error'|'warning'|'info'} [type='info'] - Severity type
 * @param {number} [duration=4000] - Duration in ms
 */
export function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");

  const iconSvg = {
    success: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
  }[type] || "";

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-message">${escapeHtml(message)}</div>
    <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
  `;

  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => {
    dismissToast(toast);
  });

  container.appendChild(toast);

  const timeoutId = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  toast._timeoutId = timeoutId;
}

function dismissToast(toast) {
  if (toast.classList.contains("toast-dismissing")) return;
  toast.classList.add("toast-dismissing");
  if (toast._timeoutId) clearTimeout(toast._timeoutId);
  setTimeout(() => {
    toast.remove();
  }, 250);
}

/**
 * Displays a modal confirmation dialog for destructive or sensitive operations.
 * Returns a Promise that resolves to true (confirmed) or false (cancelled).
 *
 * @param {Object} options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Confirmation explanation
 * @param {string} [options.confirmText='Confirm'] - Label on confirm button
 * @param {string} [options.cancelText='Cancel'] - Label on cancel button
 * @param {boolean} [options.danger=false] - Whether this is a destructive action
 * @returns {Promise<boolean>}
 */
export function showConfirmModal({
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    if (!modal) {
      // Fallback if modal DOM is absent
      resolve(window.confirm(`${title}\n\n${message}`));
      return;
    }

    const titleEl = modal.querySelector("#confirm-modal-title");
    const messageEl = modal.querySelector("#confirm-modal-message");
    const confirmBtn = modal.querySelector("#confirm-modal-ok");
    const cancelBtn = modal.querySelector("#confirm-modal-cancel");

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      confirmBtn.className = danger ? "btn btn-danger" : "btn btn-primary";
    }
    if (cancelBtn) cancelBtn.textContent = cancelText;

    const cleanup = () => {
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdropClick);
      document.removeEventListener("keydown", onKeyDown);
      closeModal("confirm-modal");
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onBackdropClick = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(false);
      }
    };

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdropClick);
    document.addEventListener("keydown", onKeyDown);

    openModal("confirm-modal");
    confirmBtn.focus();
  });
}

/**
 * Opens a modal dialog by ID.
 * @param {string} modalId
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("is-active");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

/**
 * Closes a modal dialog by ID.
 * @param {string} modalId
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("is-active");
  modal.setAttribute("aria-hidden", "true");
  // Check if any other modal is still active
  if (!document.querySelector(".modal-backdrop.is-active")) {
    document.body.classList.remove("modal-open");
  }
}

/**
 * Toggles button loading state to prevent double submissions.
 *
 * @param {HTMLButtonElement} button - Button element
 * @param {boolean} isLoading - Whether action is running
 * @param {string} [loadingText='Saving...'] - Text while loading
 */
export function setButtonLoading(button, isLoading, loadingText = "Saving...") {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.setAttribute("data-original-text", button.innerHTML);
    button.innerHTML = `<span class="spinner-small" aria-hidden="true"></span> ${escapeHtml(loadingText)}`;
  } else {
    button.disabled = false;
    const orig = button.getAttribute("data-original-text");
    if (orig) {
      button.innerHTML = orig;
      button.removeAttribute("data-original-text");
    }
  }
}

/**
 * Debounce helper for search inputs.
 *
 * @param {Function} func
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(func, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}
