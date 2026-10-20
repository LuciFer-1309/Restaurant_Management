# Restaurant Management System — Backend

A database-driven Restaurant Management System backend developed using **Python, Flask, and PostgreSQL**. It provides REST APIs to manage restaurant menu items, customers, employees, tables, orders, order items, and payments.

## Features

- Menu management
- Customer record management
- Employee management
- Restaurant table management
- Order creation and status updates
- Order item management
- Payment record management
- PostgreSQL database integration
- REST API testing using PowerShell
- Relational database constraints and foreign keys

## Technologies Used

- **Programming Language:** Python
- **Backend Framework:** Flask
- **Database:** PostgreSQL
- **Database Driver:** Psycopg
- **Environment Configuration:** python-dotenv
- **API Testing:** PowerShell

## Project Structure

```text
Restaurant_Management/
├── backend/
│   ├── app.py
│   ├── db.py
│   ├── .env
│   └── requirements.txt
└── venv/
```

## Database Design

The PostgreSQL database is named `Restaurant_Management_DB`.

It contains seven tables:

| Table | Purpose |
|---|---|
| `customers` | Stores customer information |
| `employees` | Stores employee details and roles |
| `restaurant_tables` | Stores table numbers, capacity, and availability |
| `menu_items` | Stores food item names, categories, and prices |
| `orders` | Stores customer orders and their status |
| `order_items` | Stores food items associated with each order |
| `payments` | Stores payment amounts, methods, and statuses |

### Database Relationships

- A customer can place multiple orders.
- An employee can be associated with multiple orders.
- A restaurant table can be associated with multiple orders over time.
- An order can contain multiple order items.
- Each order item references a menu item.
- Each order can have one payment record.

Primary keys, foreign keys, `NOT NULL`, `UNIQUE`, `CHECK`, and default constraints help maintain data integrity.

## Installation and Setup

### 1. Install prerequisites

Install Python and PostgreSQL. Ensure PostgreSQL is running and the database `Restaurant_Management_DB` has been created with the required tables.

### 2. Open the project directory

```powershell
cd D:\Restaurant_Management
```

### 3. Activate the virtual environment

```powershell
.\venv\Scripts\Activate.ps1
```

### 4. Install dependencies

```powershell
cd backend
pip install -r requirements.txt
```

### 5. Configure environment variables

Create a `.env` file inside the `backend` directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Restaurant_Management_DB
DB_USER=postgres
DB_PASSWORD=your_postgres_password
```

Replace `your_postgres_password` with your actual PostgreSQL password.

**Security:** Do not upload your actual `.env` file or database password to a public repository.

### 6. Run the Flask application

From the `backend` directory, execute:

```powershell
python app.py
```

The backend should start at:

`http://127.0.0.1:5000`

Keep the terminal running while testing the APIs.

## API Endpoints

Base URL: `http://127.0.0.1:5000`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Home or API information |
| GET | `/api/health` | Check backend and database health |
| GET | `/api/menu` | Retrieve menu items |
| POST | `/api/menu` | Add a menu item |
| PATCH | `/api/menu/<item_id>` | Update a menu item |
| DELETE | `/api/menu/<item_id>` | Mark a menu item unavailable |
| GET | `/api/customers` | Retrieve customers |
| POST | `/api/customers` | Add a customer |
| GET | `/api/employees` | Retrieve employees |
| POST | `/api/employees` | Add an employee |
| GET | `/api/tables` | Retrieve restaurant tables |
| POST | `/api/tables` | Add a restaurant table |
| PATCH | `/api/tables/<table_id>` | Update table information or status |
| GET | `/api/orders` | Retrieve orders |
| POST | `/api/orders` | Create an order |
| PATCH | `/api/orders/<order_id>` | Update order status |
| GET | `/api/order-items` | Retrieve order items |
| POST | `/api/order-items` | Add an item to an order |
| GET | `/api/payments` | Retrieve payment records |
| POST | `/api/payments` | Create a payment record |

## API Testing Examples

### Check backend health

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

### Retrieve the menu

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/menu
```

### Create an order

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/orders" -Method POST -ContentType "application/json" -Body '{"customer_id":1,"table_id":1,"employee_id":1,"order_type":"dine_in"}'
```

Use valid customer, employee, and table IDs that exist in the database.

### Add an order item

```powershell
Invoke