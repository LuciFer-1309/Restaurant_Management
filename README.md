# 🍽️ Restaurant Management System — Backend & Database

A beginner-friendly, modular RESTful API backend built with **Node.js**, **Express.js**, and **PostgreSQL** (`pg` package) for a college DBMS microproject.

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Folder Structure](#folder-structure)
4. [Database Design & Schema](#database-design--schema)
5. [Prerequisites & Installation](#prerequisites--installation)
6. [Database Setup Instructions](#database-setup-instructions)
7. [Running the Application](#running-the-application)
8. [API Documentation](#api-documentation)
9. [Postman Testing & Example Payloads](#postman-testing--example-payloads)
10. [DBMS Demonstration Queries (Viva Preparation)](#dbms-demonstration-queries)
11. [Connecting with the Frontend](#connecting-with-the-frontend)
12. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## 1. Project Overview

This backend is built for a restaurant management system to handle:
- **Customers**: Registering and managing customer contact records.
- **Menu Items**: Food catalog with categories, real-time availability, and pricing.
- **Dining Tables**: Seating capacity and status tracking (`available`, `occupied`, `reserved`).
- **Reservations**: Booking tables for specific party sizes and dates/times.
- **Multi-Item Orders**: Placing dine-in or takeaway orders inside an atomic PostgreSQL transaction.
- **Payments**: Processing cash, card, or UPI payments with partial/split payment support and overpayment prevention.

---

## 2. Technology Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js (v4.x)
- **Database**: PostgreSQL (v14+)
- **PostgreSQL Client**: `pg` (Node-Postgres connection pool with parameterized queries)
- **Environment Variables**: `dotenv`
- **CORS**: `cors` (enables frontend HTML/JS to communicate with backend)
- **Development Tool**: `nodemon` (auto-restarts server on code changes)
- **Format**: CommonJS modules (`require` / `module.exports`)

> ⚠️ **Notice**: No ORM (Prisma/Sequelize/Mongoose) is used. Raw parameterized SQL queries (`$1, $2`) are used to ensure SQL proficiency for DBMS microproject evaluation and avoid SQL injection.

---

## 3. Folder Structure

```
Restaurant_Management/
├── database/
│   ├── schema.sql         # DDL script creating 7 tables & indexes
│   ├── seed.sql           # Realistic fictional dataset
│   └── reports.sql        # Advanced SQL queries for DBMS demonstration/viva
├── src/
│   ├── config/
│   │   └── db.js          # PostgreSQL connection pool & transaction helper
│   ├── controllers/
│   │   ├── customers.controller.js
│   │   ├── menu.controller.js
│   │   ├── tables.controller.js
│   │   ├── reservations.controller.js
│   │   ├── orders.controller.js
│   │   └── payments.controller.js
│   ├── middleware/
│   │   └── errorHandler.js# Centralized error handler
│   ├── routes/
│   │   ├── customers.routes.js
│   │   ├── menu.routes.js
│   │   ├── tables.routes.js
│   │   ├── reservations.routes.js
│   │   ├── orders.routes.js
│   │   └── payments.routes.js
│   ├── app.js             # Express app, middleware, routes mount, health check
│   └── server.js          # Server entrypoint and graceful shutdown
├── .env.example           # Environment template
├── .gitignore             # Git ignore file (keeps .env and node_modules private)
├── package.json           # Dependencies and scripts
└── README.md              # Full documentation guide
```

---

## 4. Database Design & Schema

The database consists of 7 relational tables:

```
[CUSTOMERS] 1 ────< M [RESERVATIONS] M >──── 1 [RESTAURANT_TABLES]
    │                                                    │
    │ 1 (optional)                                       │ 1 (optional)
    ▼                                                    ▼
[ORDERS] 1 ─────────────────────────< M [ORDER_ITEMS] M >─── 1 [MENU_ITEMS]
    │
    │ 1
    ▼
[PAYMENTS] (1-to-many payments per order to support split/partial payments)
```

### Key Relationships & Constraints:
- **CUSTOMERS**: Has unique constraints on `phone` and `email` (where provided).
- **MENU_ITEMS**: Price must be numeric > 0. Boolean `is_available` toggles menu visibility.
- **RESTAURANT_TABLES**: Unique `table_number`, capacity > 0, status is one of (`available`, `occupied`, `reserved`).
- **RESERVATIONS**: Foreign keys to `customers` and `restaurant_tables`. ON DELETE RESTRICT on customer prevents deleting customer with reservation records.
- **ORDERS**: Can have a customer (or NULL for walk-ins) and a table (or NULL for takeaway).
- **ORDER_ITEMS**: Bridge table between `orders` and `menu_items`. Stores **historical unit price** at the moment of order placement so future price changes do not distort historical invoices. Unique constraint on `(order_id, menu_item_id)`.
- **PAYMENTS**: Links to `orders`. Amount > 0. Method is `cash`, `card`, or `upi`.

---

## 5. Prerequisites & Installation

### Step 1: Ensure Node.js and PostgreSQL are installed
Open PowerShell or Command Prompt:
```powershell
node -v
npm -v
psql --version
```

### Step 2: Install Node Dependencies
In the project root directory:
```powershell
npm install
```

---

## 6. Database Setup Instructions

### Option A: Using PostgreSQL `psql` Command Line

1. Open PowerShell and create the database:
```powershell
psql -U postgres -c "CREATE DATABASE restaurant_management_db;"
```
*(Enter your PostgreSQL postgres superuser password when prompted)*

2. Run the schema creation script:
```powershell
psql -U postgres -d restaurant_management_db -f database/schema.sql
```

3. Run the seed data script:
```powershell
psql -U postgres -d restaurant_management_db -f database/seed.sql
```

---

### Option B: Using pgAdmin 4 (GUI)

1. Open **pgAdmin 4** and connect to your local PostgreSQL server.
2. In the left panel, right-click on **Databases** -> **Create** -> **Database...**
3. Name it: `restaurant_management_db` and click **Save**.
4. Select `restaurant_management_db`, click on **Tools** in the top menu bar -> **Query Tool**.
5. Click the open folder icon (or copy-paste) the content of `database/schema.sql`. Press **F5** (or click the Play icon) to execute.
6. Open `database/seed.sql` in the Query Tool and press **F5** to populate the sample data.

---

## 7. Running the Application

### Step 1: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Edit `.env` with your PostgreSQL credentials:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=restaurant_management_db
DB_USER=postgres
DB_PASSWORD=your_actual_password_here
```

### Step 2: Start the Development Server
```powershell
npm run dev
```
Or for production mode:
```powershell
npm start
```

You should see:
```
====================================================
Restaurant Management System Backend Server
Running on: http://localhost:5000
Health Check: http://localhost:5000/api/health
Environment: development
====================================================
```

Verify the health check in your browser or curl:
`http://localhost:5000/api/health`

---

## 8. API Documentation

Base URL: `http://localhost:5000/api`

### Health Check
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Checks Node server and PostgreSQL connection |

### Customers
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/customers` | List all customers (supports `?search=query`) |
| `GET` | `/api/customers/:id` | Get customer by ID |
| `POST` | `/api/customers` | Register new customer |
| `PUT` | `/api/customers/:id` | Update customer details |
| `DELETE` | `/api/customers/:id` | Delete customer |

### Menu Items
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/menu` | List all items (`?category=...&is_available=true&search=...`) |
| `GET` | `/api/menu/:id` | Get item by ID |
| `POST` | `/api/menu` | Create new menu item |
| `PUT` | `/api/menu/:id` | Update entire menu item |
| `PATCH`| `/api/menu/:id/availability` | Quick toggle `is_available` |
| `DELETE`| `/api/menu/:id` | Delete menu item |

### Restaurant Tables
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tables` | List all tables (`?status=available&min_capacity=4`) |
| `GET` | `/api/tables/:id` | Get table details |
| `POST` | `/api/tables` | Add a new table |
| `PUT` | `/api/tables/:id` | Update table number and capacity |
| `PATCH`| `/api/tables/:id/status` | Update status (`available`, `occupied`, `reserved`) |
| `DELETE`| `/api/tables/:id` | Remove table |

### Reservations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reservations` | List reservations (`?status=confirmed&date=2026-10-24`) |
| `GET` | `/api/reservations/:id` | Get reservation by ID |
| `POST` | `/api/reservations` | Create new reservation |
| `PUT` | `/api/reservations/:id` | Update reservation |
| `PATCH`| `/api/reservations/:id/status` | Update status (`pending`, `confirmed`, `cancelled`, `completed`) |
| `DELETE`| `/api/reservations/:id` | Cancel/remove reservation |

### Orders (With Atomic Multi-Item Transactions)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/orders` | List orders (`?status=preparing&order_type=dine_in`) |
| `GET` | `/api/orders/:id` | Full order breakdown with items, calculated totals, and payments |
| `POST` | `/api/orders` | Place multi-item order (atomic SQL transaction) |
| `PATCH`| `/api/orders/:id/status` | Update order progress (`pending`, `preparing`, `ready`, `served`, `cancelled`) |

### Payments (Settlement & Validation)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/payments` | List payments (`?status=completed&payment_method=upi`) |
| `GET` | `/api/payments/:id` | Get payment transaction details |
| `POST` | `/api/payments` | Record payment against order (validates remaining balance) |

---

## 9. Postman Testing & Example Payloads

### 1. Place a Multi-Item Order (`POST /api/orders`)
**URL**: `http://localhost:5000/api/orders`  
**Method**: `POST`  
**Body** (`application/json`):
```json
{
  "customer_id": 1,
  "table_id": 1,
  "order_type": "dine_in",
  "items": [
    {
      "menu_item_id": 1,
      "quantity": 2
    },
    {
      "menu_item_id": 2,
      "quantity": 4
    },
    {
      "menu_item_id": 11,
      "quantity": 2
    }
  ]
}
```
**Response (201 Created)**:
```json
{
  "success": true,
  "message": "Order created successfully with items",
  "data": {
    "order_id": 6,
    "customer_id": 1,
    "table_id": 1,
    "order_time": "2026-10-24T13:00:00.000Z",
    "status": "pending",
    "order_type": "dine_in",
    "items": [
      {
        "order_item_id": 12,
        "order_id": 6,
        "menu_item_id": 1,
        "quantity": 2,
        "unit_price": "280.00",
        "name": "Paneer Butter Masala",
        "subtotal": 560
      },
      {
        "order_item_id": 13,
        "order_id": 6,
        "menu_item_id": 2,
        "quantity": 4,
        "unit_price": "45.00",
        "name": "Butter Naan",
        "subtotal": 180
      },
      {
        "order_item_id": 14,
        "order_id": 6,
        "menu_item_id": 11,
        "quantity": 2,
        "unit_price": "110.00",
        "name": "Mango Lassi",
        "subtotal": 220
      }
    ],
    "total_amount": 960
  }
}
```

### 2. Make a Payment (`POST /api/payments`)
**URL**: `http://localhost:5000/api/payments`  
**Method**: `POST`  
**Body** (`application/json`):
```json
{
  "order_id": 6,
  "amount": 960.00,
  "payment_method": "upi",
  "payment_status": "completed"
}
```
**Response (201 Created)**:
```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "payment": {
      "payment_id": 4,
      "order_id": 6,
      "amount": "960.00",
      "payment_method": "upi",
      "payment_status": "completed",
      "payment_time": "2026-10-24T13:05:00.000Z"
    },
    "order_total": 960,
    "total_paid": 960,
    "remaining_balance": 0,
    "is_fully_paid": true
  }
}
```

### 3. Register Customer (`POST /api/customers`)
```json
{
  "name": "Kavita Rao",
  "phone": "9812345678",
  "email": "kavita.rao@example.com"
}
```

### 4. Create Reservation (`POST /api/reservations`)
```json
{
  "customer_id": 1,
  "table_id": 5,
  "reservation_time": "2026-10-25 20:00:00+05:30",
  "party_size": 4,
  "status": "confirmed"
}
```

---

## 10. DBMS Demonstration Queries (Viva Preparation)

To demonstrate SQL capabilities in your presentation/viva, open `database/reports.sql`. The queries showcase:
1. **INNER JOIN**: Confirmed reservations with customer and table details.
2. **LEFT JOIN**: All customers with their reservation history (including customers without bookings).
3. **Multi-Table JOIN & COALESCE**: Orders with customers, tables, and fallback handling for takeaway/walk-ins.
4. **Historical Price Integrity**: Line items showing stored `unit_price` vs current menu price.
5. **Calculated Order Totals**: `SUM(quantity * unit_price)` grouped by order with dynamic settlement status (`PAID`, `PARTIAL`, `UNPAID`).
6. **Aggregations & Grouping**: Total revenue with `SUM()`, daily revenue breakdown with `GROUP BY DATE(payment_time)`.
7. **Best-Selling Menu Items**: Top items by total volume and revenue.

---

## 11. Connecting with the Frontend

Share this section with your frontend teammate.

### Base URL:
```javascript
const API_BASE = "http://localhost:5000/api";
```

### Example: Fetch Available Menu Items
```javascript
async function loadMenu() {
  try {
    const res = await fetch(`${API_BASE}/menu?is_available=true`);
    const result = await res.json();
    if (result.success) {
      console.log("Menu Items:", result.data);
      // Render cards in HTML
    }
  } catch (error) {
    console.error("Failed to load menu:", error);
  }
}
```

### Example: Place an Order from Frontend
```javascript
async function submitOrder(customerId, tableId, cartItems) {
  const payload = {
    customer_id: customerId || null,
    table_id: tableId || null,
    order_type: tableId ? "dine_in" : "takeaway",
    items: cartItems.map(item => ({
      menu_item_id: item.id,
      quantity: item.qty
    }))
  };

  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return await res.json();
}
```

---

## 12. Troubleshooting & FAQs

- **Error: `ECONNREFUSED 127.0.0.1:5432`**: PostgreSQL is not running or the port is wrong. Start the PostgreSQL service in Windows Services (`services.msc`) or verify port 5432.
- **Error: `password authentication failed for user "postgres"`**: Your password in `.env` does not match your PostgreSQL installation password. Update `DB_PASSWORD` in `.env`.
- **Error: `database "restaurant_management_db" does not exist`**: You have not created the database yet. Run `psql -U postgres -c "CREATE DATABASE restaurant_management_db;"` first.
- **CORS Error in Browser**: The backend has `cors()` middleware enabled by default. Ensure your frontend sends requests to `http://localhost:5000/api/...`.

