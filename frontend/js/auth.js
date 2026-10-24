/**
 * Authentication Module
 * Manages Supabase Auth session, sign in, sign out, and auth listener subscription.
 */

import { supabase, isSupabaseConfigured, getConfigError } from "./supabaseClient.js";
import { showToast, setButtonLoading } from "./utils.js";

let authSubscription = null;
let currentSession = null;
let onAuthChangedHandler = null;

/**
 * Initializes authentication states and binds event listeners.
 * 
 * @param {Function} onAuthChange - Callback when authentication state changes: (user, session) => void
 */
export async function initAuth(onAuthChange) {
  onAuthChangedHandler = onAuthChange;

  const configBanner = document.getElementById("config-banner");
  const authSection = document.getElementById("auth-section");
  const appShell = document.getElementById("app-shell");
  const loginForm = document.getElementById("login-form");
  const loginSubmitBtn = document.getElementById("login-submit-btn");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("btn-logout");

  // Check Supabase Configuration
  if (!isSupabaseConfigured()) {
    const errorMsg = getConfigError();
    if (configBanner) {
      configBanner.style.display = "flex";
      const configText = document.getElementById("config-banner-text");
      if (configText && errorMsg) {
        configText.innerHTML = `${errorMsg}<br>Please update <code>frontend/js/config.js</code> with valid credentials to enable staff login and database queries.`;
      }
    }

    if (authSection) authSection.style.display = "flex";
    if (appShell) appShell.style.display = "none";
    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = true;
      loginSubmitBtn.title = "Supabase configuration required";
    }
    if (loginError) {
      loginError.style.display = "block";
      loginError.textContent = "Supabase project URL & publishable key are not configured in config.js.";
    }
    return;
  }

  // Bind Login Form Submit
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!supabase) return;

      const emailInput = document.getElementById("login-email");
      const passwordInput = document.getElementById("login-password");
      const email = emailInput ? emailInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      if (!email || !password) {
        if (loginError) {
          loginError.style.display = "block";
          loginError.textContent = "Please enter both email and password.";
        }
        return;
      }

      setButtonLoading(loginSubmitBtn, true, "Authenticating...");
      if (loginError) loginError.style.display = "none";

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("Sign in failed:", error);
          if (loginError) {
            loginError.style.display = "block";
            loginError.textContent = error.message || "Invalid login credentials.";
          }
          showToast(error.message || "Authentication failed", "error");
        } else {
          showToast("Staff signed in successfully", "success");
          if (loginForm) loginForm.reset();
        }
      } catch (err) {
        console.error("Unexpected error during login:", err);
        if (loginError) {
          loginError.style.display = "block";
          loginError.textContent = "Network error. Please try again.";
        }
      } finally {
        setButtonLoading(loginSubmitBtn, false);
      }
    });
  }

  // Bind Logout Button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (!supabase) return;
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          showToast(`Sign out error: ${error.message}`, "error");
        } else {
          showToast("Signed out successfully", "info");
        }
      } catch (err) {
        console.error("Sign out error:", err);
      }
    });
  }

  // Subscribe to Auth State Changes
  if (supabase && !authSubscription) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      handleSessionState(session);
    });
    authSubscription = data.subscription;
  }

  // Check Initial Session
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn("Could not retrieve existing session:", error);
        handleSessionState(null);
      } else {
        handleSessionState(data?.session || null);
      }
    } catch (err) {
      console.error("Failed to check session:", err);
      handleSessionState(null);
    }
  }
}

/**
 * Handles session state changes, updates DOM visibility and informs listener.
 * 
 * @param {Object|null} session
 */
function handleSessionState(session) {
  currentSession = session;
  const user = session?.user || null;

  const authSection = document.getElementById("auth-section");
  const appShell = document.getElementById("app-shell");
  const staffEmail = document.getElementById("staff-email");
  const staffAvatar = document.getElementById("staff-avatar");

  if (user) {
    // Authenticated
    if (authSection) authSection.style.display = "none";
    if (appShell) appShell.style.display = "flex";

    if (staffEmail) staffEmail.textContent = user.email || "Staff Member";
    if (staffAvatar) {
      const initial = (user.email || "S").charAt(0).toUpperCase();
      staffAvatar.textContent = initial;
    }

    if (typeof onAuthChangedHandler === "function") {
      onAuthChangedHandler(user, session);
    }
  } else {
    // Unauthenticated
    if (appShell) appShell.style.display = "none";
    if (authSection) authSection.style.display = "flex";

    if (typeof onAuthChangedHandler === "function") {
      onAuthChangedHandler(null, null);
    }
  }
}

/**
 * Returns current authenticated user or null.
 */
export function getCurrentUser() {
  return currentSession?.user || null;
}

/**
 * Unsubscribes from auth changes when cleaning up.
 */
export function teardownAuth() {
  if (authSubscription) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }
}
