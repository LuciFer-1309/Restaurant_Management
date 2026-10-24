/**
 * Supabase Configuration Example
 * 
 * Instructions:
 * 1. Copy this file to `frontend/js/config.js` if it doesn't already exist.
 * 2. Log in to your Supabase Dashboard: https://supabase.com/dashboard
 * 3. Select your project and navigate to Project Settings -> API.
 * 4. Copy the "Project URL" and paste it as `SUPABASE_URL`.
 * 5. Copy the "anon" / "public" key (or the new "publishable" key) and paste it as `SUPABASE_PUBLISHABLE_KEY`.
 * 
 * IMPORTANT:
 * - NEVER use the `service_role` key, database password, or secret key here!
 * - Only use the public/publishable anon key intended for browser clients.
 * - `config.js` is ignored by Git to prevent accidentally committing your credentials.
 */

export const SUPABASE_URL = "https://your-project-id.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY = "your-anon-or-publishable-key-here";
