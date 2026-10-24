/**
 * Supabase Client Initialization & Error Handling Module
 * 
 * Uses the official Supabase JS client loaded via esm.sh CDN.
 * Safely validates configuration placeholders to prevent silent runtime crashes.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

/**
 * Validates if the user has provided real Supabase configuration values.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateConfig() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR_") || !SUPABASE_URL.startsWith("http")) {
    return {
      valid: false,
      error: "Supabase Project URL is missing or set to placeholder. Please update `frontend/js/config.js` with your real Supabase URL.",
    };
  }

  if (
    !SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR_") ||
    SUPABASE_PUBLISHABLE_KEY.trim().length < 20
  ) {
    return {
      valid: false,
      error: "Supabase Publishable/Anon key is missing or set to placeholder. Please update `frontend/js/config.js` with your real Supabase key.",
    };
  }

  return { valid: true };
}

const configStatus = validateConfig();

export const isSupabaseConfigured = () => configStatus.valid;
export const getConfigError = () => configStatus.error || null;

/**
 * Exported Supabase client singleton
 */
let client = null;

if (configStatus.valid) {
  try {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
  }
}

export const supabase = client;

/**
 * Standardized database error translator for Postgres & PostgREST errors.
 * Provides user-friendly explanations instead of cryptic database codes.
 *
 * @param {Error|Object} error - Supabase error object
 * @param {string} [context] - Contextual description of the failed action
 * @returns {string} - Human-readable error message
 */
export function handleDatabaseError(error, context = "Database operation failed") {
  if (!error) return `${context}. An unexpected error occurred.`;

  console.error(`[Supabase Error] ${context}:`, error);

  const code = error.code || "";
  const msg = (error.message || "").toLowerCase();
  const details = error.details || "";

  // Row-Level Security (RLS) Permission Denied
  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) {
    return `${context}: Access denied by Row-Level Security (RLS). Please ensure staff permissions or RLS policies are configured in Supabase.`;
  }

  // Foreign Key Constraint Violation (e.g. deleting record with child references)
  if (code === "23503" || msg.includes("foreign key constraint") || details.includes("still referenced")) {
    return `${context}: This record cannot be deleted because it is referenced by existing records (such as past orders, reservations, or line items).`;
  }

  // Unique Constraint Violation (e.g. duplicate table_number or customer phone)
  if (code === "23505" || msg.includes("unique constraint") || msg.includes("duplicate key")) {
    return `${context}: A record with this unique value (such as phone number or table number) already exists.`;
  }

  // Check Constraint Violation (e.g. negative price or invalid quantity)
  if (code === "23514" || msg.includes("check constraint")) {
    return `${context}: The submitted value violates database validation rules (e.g. price must be non-negative, quantity must be positive).`;
  }

  // PostgREST single item not found
  if (code === "PGRST116") {
    return `${context}: The requested record was not found or has been removed.`;
  }

  // Network / Connection errors
  if (msg.includes("failed to fetch") || msg.includes("networkerror")) {
    return `${context}: Network error connecting to Supabase. Check your internet connection or project status.`;
  }

  // Fallback to error message
  return `${context}: ${error.message || "Unknown database error"}`;
}
