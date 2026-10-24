# Restaurant Management System — Frontend

A professional, modular, responsive web frontend for a college database project: **Restaurant Management System**.

Built using standard **HTML5, Vanilla CSS3, and modern Vanilla JavaScript ES Modules**, integrating with a PostgreSQL database hosted on **Supabase** via the official Supabase JavaScript client (`@supabase/supabase-js@2` loaded via CDN).

---

## 1. Architecture & Technology Stack

- **HTML5**: Semantic, accessible markup with modal dialogs, status badges, and tabbed single-page routing.
- **Vanilla CSS3**: Tailored hospitality management theme (dark deep-forest slate `#121c17` and emerald `#059669` accents) with responsive drawer sidebar for mobile/tablet screens, accessible focus rings, and CSS variables.
- **Vanilla JavaScript (ES Modules)**: Clean, modular architecture divided by business domain. No build tools, bundlers, or frameworks (no React, Next.js, Vue, Angular, or TypeScript).
- **Supabase JS Client**: Loaded directly via ES module CDN (`https://esm.sh/@supabase/supabase-js@2`).
- **Zero Build Step**: Runs directly in any modern browser via VS Code Live Server or any static HTTP server.

---

## 2. File Structure

```
frontend/
├── index.html              # Main application shell with SEO meta tags, navigation, views & modals
├── css/
│   └── style.css           # Design system tokens, responsive layout, tables, cards, toasts, modals
├── js/
│   ├── config.js           # Supabase project URL & publishable key (git-ignored)
│   ├── config.example.js   # Configuration template with setup instructions
│   ├── supabaseClient.js   # Supabase client singleton, credential validation & Postgres error mapping
│   ├── utils.js            # XSS escaping, currency/date formatters, badges, toasts, confirm modal
│   ├── auth.js             # Staff authentication (signInWithPassword, session detection, signOut)
│   ├── dashboard.js        # Real-time metrics, revenue calculations, occupancy breakdown & recent orders
│   ├── menu.js             # Menu CRUD, search, category/availability filters, and quick toggle
│   ├── customers.js        # Guest directory CRUD, search, and phone uniqueness handling
│   ├── tables.js           # Dining floor layout, seating capacity, and real-time status management
│   ├── reservations.js     # Guest booking lifecycle, customer/table dropdowns, and party size checks
│   ├── orders.js           # POS ordering catalog, interactive cart, historical pricing & payment collection
│   └── app.js              # Application router, mobile drawer menu, and global state coordinator
├── .gitignore              # Git ignore file protecting config.js
└── README.md               # Complete setup, RLS policies, architectural guide & testing checklist
```

---

## 3. Quick Start & Setup Instructions

### Step 1: Configure Supabase Credentials

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project and navigate to **Project Settings** (gear icon) -> **API**.
3. Copy the **Project URL** and the **anon (public)** key (or the new **Publishable** key).
4. Open `frontend/js/config.js` in your editor and replace the placeholder strings:

```javascript
export const SUPABASE_URL = "https://your-project-id.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

> **Security Warning:** Never paste the `service_role` secret key, database password, or administrative token into `config.js`. Only the public `anon` / publishable key is intended for browser usage.

### Step 2: Run the Frontend Locally

Because the frontend uses ES Modules (`import`/`export`), it must be served through an HTTP server rather than opened directly via `file://`.

#### Option A: VS Code Live Server (Recommended)
1. Open the repository root or the `frontend` folder in VS Code.
2. Install the **Live Server** extension by Ritwick Dey.
3. Right-click `frontend/index.html` and select **"Open with Live Server"**.
4. The application opens at `http://127.0.0.1:5500/frontend/index.html` (or `http://127.0.0.1:5500/`).

#### Option B: Python Simple HTTP Server
Open your terminal and run:
```bash
# From the repository root:
python3 -m http.server 8080 --directory frontend

# Or from inside the frontend directory:
cd frontend
python3 -m http.server 8080
```
Then visit `http://localhost:8080` in your web browser.

#### Option C: Node static server (npx)
```bash
npx serve frontend
```

---

## 4. Supabase Authentication Setup

Public registration is intentionally disabled. Staff members are provisioned by the restaurant administrator through Supabase Auth:

1. In the Supabase Dashboard, go to **Authentication** -> **Users**.
2. Click **Add User** -> **Create User**.
3. Enter the staff email (e.g. `staff@restaurant.com`) and a secure password.
4. Set **Auto Confirm User?** to **Yes** so email verification is not required.
5. Save the user.
6. Use these credentials to sign in to the application's **Staff Sign In** portal.

---

## 5. PostgreSQL Schema & Database Assumptions

The system integrates with the following 7 PostgreSQL tables:

| Table | Primary Key | Key Columns & Constraints |
| :--- | :--- | :--- |
| `customers` | `customer_id` (bigint identity) | `name` (text, req), `phone` (text, unique), `email` (text), `created_at` (timestamptz) |
| `menu_items` | `menu_item_id` (bigint identity) | `name` (text, req), `category` (text, req), `description` (text), `price` (numeric(10,2) >= 0), `is_available` (bool default true), `created_at` (timestamptz) |
| `restaurant_tables` | `table_id` (bigint identity) | `table_number` (int, unique), `capacity` (int), `status` ('available', 'occupied', 'reserved') |
| `reservations` | `reservation_id` (bigint identity) | `customer_id` (FK customers), `table_id` (nullable FK tables), `reservation_time` (timestamptz), `party_size` (int), `status` ('booked', 'confirmed', 'completed', 'cancelled') |
| `orders` | `order_id` (bigint identity) | `customer_id` (nullable FK customers), `table_id` (nullable FK tables), `order_type` ('dine_in', 'takeaway', 'delivery'), `order_time` (timestamptz), `status` ('placed', 'preparing', 'ready', 'completed', 'cancelled') |
| `order_items` | `order_item_id` (bigint identity) | `order_id` (FK orders), `menu_item_id` (FK menu_items), `quantity` (int > 0), `unit_price` (numeric(10,2) >= 0), `UNIQUE(order_id, menu_item_id)` |
| `payments` | `payment_id` (bigint identity) | `order_id` (FK orders), `amount` (numeric(10,2) > 0), `payment_method` ('cash', 'card', 'upi', 'other'), `payment_status` ('pending', 'completed', 'failed', 'refunded'), `payment_time` (timestamptz) |

---

## 6. Supabase Row-Level Security (RLS) Requirements

If Row-Level Security (RLS) is enabled on your Supabase tables, authenticated staff users must have permission to `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

To enable full staff access, run the following SQL snippet in your **Supabase Dashboard -> SQL Editor**:

```sql
-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Grant authenticated staff full access to all tables
CREATE POLICY "Staff manage customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff manage menu" ON menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff manage tables" ON restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff manage reservations" ON reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff manage orders" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff manage order_items" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff manage payments" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

*(If you also want public read-only access to menu items for an external digital menu, add `CREATE POLICY "Public read menu" ON menu_items FOR SELECT TO anon USING (is_available = true);`)*

---

## 7. Architecture Notes & Known Production Limitations

1. **Transactional Checkout & Billing**:
   - In this browser-based prototype, creating an order executes two consecutive API calls: inserting into `orders`, followed by inserting rows into `order_items`.
   - **Production Requirement**: A production checkout system must execute atomically inside a single PostgreSQL transaction or protected Supabase Database Function (`RPC`). This prevents orphaned order rows if network interruptions occur between writing the parent order and child items.
2. **Price Integrity**:
   - The application fetches active dish prices from `menu_items` when rendering the POS cart and saves that price into `order_items.unit_price`.
   - Historical orders calculate revenue and totals strictly using the saved `order_items.unit_price`. Modifying a menu item's price today will **never** alter past invoices or completed payment totals.
   - **Production Requirement**: A production backend must re-validate submitted prices server-side against current menu rates before committing the order.
3. **Foreign Key Integrity**:
   - The application intercepts Postgres Foreign Key constraint errors (`code: 23503`) when deleting items, customers, or tables that have order or reservation history, presenting clear guidance to mark items unavailable rather than corrupting audit trails.

---

## 8. Manual Testing Checklist

| View / Feature | Test Steps | Expected Outcome |
| :--- | :--- | :--- |
| **Config Validation** | Leave `config.js` with placeholders | Amber warning banner is visible; login form is disabled with explanatory text |
| **Authentication** | Enter invalid password | Red error message: "Invalid login credentials"; no login |
| **Authentication** | Sign in with valid staff credentials | Login screen disappears; App shell opens with staff email in sidebar |
| **Dashboard** | View metrics on initial load | Accurate counts for menu items, customers, today's orders, and completed revenue |
| **Menu Management** | Click **+ Add Menu Item** and submit dish | New item created in PostgreSQL; appears in table |
| **Menu Availability** | Click **Disable** on a menu item | Status badge updates to "Unavailable"; quick toggle updates database |
| **Menu Search/Filter** | Type dish name or change category | Table filters instantaneously |
| **Menu Deletion** | Delete a dish ordered in a past order | Dialog warns user; database FK constraint caught; clear guidance displayed |
| **Customers** | Add new customer with duplicate phone | Caught by unique constraint; user-friendly notification displayed |
| **Tables Floor** | Change table status dropdown (Available -> Occupied) | Status updates in `restaurant_tables`; color badge changes immediately |
| **Reservations** | Book reservation for existing customer | Customer and table dropdowns populated from DB; booking created |
| **POS Order Creation** | Click dishes in catalog to build cart | Dishes added to cart; duplicate clicks increment quantity (satisfying `UNIQUE(order_id, menu_item_id)`) |
| **Order Details** | Open an existing order | Displays historical saved unit prices, item line totals, and payment status |
| **Payment Recording**| Submit payment for remaining balance | Payment inserted into `payments`; order balance updates to `$0.00`; badge shows "Paid in Full" |
| **Logout** | Click **Sign Out** in sidebar | User session terminates; returns immediately to Staff Sign In screen |
