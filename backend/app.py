
from flask import Flask, jsonify, request
from flask_cors import CORS
from db import get_connection
from decimal import Decimal, InvalidOperation

app = Flask(__name__)
CORS(app)

ORDER_STATUSES = (
    "pending", "preparing", "served", "completed", "cancelled"
)


def get_json():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else None


def positive_id(value):
    return (
        isinstance(value, int)
        and not isinstance(value, bool)
        and value > 0
    )


def parse_price(value):
    if value is None or isinstance(value, bool):
        raise ValueError("A valid non-negative amount is required")

    try:
        result = Decimal(str(value))
        if not result.is_finite() or result < 0:
            raise ValueError("Invalid amount")
        return result
    except (InvalidOperation, ValueError):
        raise ValueError("A valid non-negative amount is required")


def database_error(message):
    app.logger.exception(message)
    return jsonify({"error": message}), 500


# HOME
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Restaurant Management System Backend is running!"
    })


# DATABASE HEALTH
@app.route("/api/health", methods=["GET"])
def health_check():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database();")
            result = cursor.fetchone()

        return jsonify({
            "status": "success",
            "message": "PostgreSQL connected successfully!",
            "database": result["current_database"]
        }), 200
    except Exception:
        return database_error("Database connection failed")
    finally:
        if connection:
            connection.close()


# ---------------- MENU ----------------

@app.route("/api/menu", methods=["GET"])
def get_menu():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT item_id, name, category, price, is_available
                FROM menu_items
                ORDER BY item_id;
            """)
            return jsonify(cursor.fetchall()), 200
    except Exception:
        return database_error("Could not fetch menu items")
    finally:
        if connection:
            connection.close()


@app.route("/api/menu", methods=["POST"])
def add_menu_item():
    data = get_json()
    if data is None:
        return jsonify({"error": "Send valid JSON"}), 400

    name = data.get("name")
    category = data.get("category")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Dish name is required"}), 400
    if not isinstance(category, str) or not category.strip():
        return jsonify({"error": "Category is required"}), 400

    try:
        price = parse_price(data.get("price"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO menu_items (name, category, price)
                    VALUES (%s, %s, %s)
                    RETURNING item_id, name, category, price, is_available;
                """, (name.strip(), category.strip(), price))
                item = cursor.fetchone()

        return jsonify({
            "message": "Menu item added successfully",
            "item": item
        }), 201
    except Exception:
        return database_error("Could not add menu item")
    finally:
        if connection:
            connection.close()


@app.route("/api/menu/<int:item_id>", methods=["PATCH"])
def update_menu_item(item_id):
    data = get_json()
    if not data:
        return jsonify({"error": "Send fields to update"}), 400

    if not set(data).issubset({"price", "is_available"}):
        return jsonify({
            "error": "Only price and is_available can be updated"
        }), 400

    updates = []
    values = []

    if "price" in data:
        try:
            price = parse_price(data["price"])
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        updates.append("price = %s")
        values.append(price)

    if "is_available" in data:
        if not isinstance(data["is_available"], bool):
            return jsonify({"error": "is_available must be true or false"}), 400
        updates.append("is_available = %s")
        values.append(data["is_available"])

    if not updates:
        return jsonify({"error": "No valid fields provided"}), 400

    values.append(item_id)
    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    UPDATE menu_items
                    SET {", ".join(updates)}
                    WHERE item_id = %s
                    RETURNING item_id, name, category, price, is_available;
                    """,
                    values
                )
                item = cursor.fetchone()

        if item is None:
            return jsonify({"error": "Menu item not found"}), 404
        return jsonify({"message": "Menu item updated", "item": item}), 200
    except Exception:
        return database_error("Could not update menu item")
    finally:
        if connection:
            connection.close()


@app.route("/api/menu/<int:item_id>", methods=["DELETE"])
def remove_menu_item(item_id):
    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE menu_items
                    SET is_available = FALSE
                    WHERE item_id = %s
                    RETURNING item_id, name, category, price, is_available;
                """, (item_id,))
                item = cursor.fetchone()

        if item is None:
            return jsonify({"error": "Menu item not found"}), 404
        return jsonify({
            "message": "Menu item marked unavailable",
            "item": item
        }), 200
    except Exception:
        return database_error("Could not update menu availability")
    finally:
        if connection:
            connection.close()


# ---------------- CUSTOMERS ----------------

@app.route("/api/customers", methods=["GET"])
def get_customers():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT customer_id, name, phone, created_at
                FROM customers ORDER BY customer_id;
            """)
            return jsonify(cursor.fetchall()), 200
    except Exception:
        return database_error("Could not fetch customers")
    finally:
        if connection:
            connection.close()


@app.route("/api/customers", methods=["POST"])
def add_customer():
    data = get_json()
    if data is None:
        return jsonify({"error": "Send valid JSON"}), 400

    name = data.get("name")
    phone = data.get("phone")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Customer name is required"}), 400
    if phone is not None and not isinstance(phone, str):
        return jsonify({"error": "Phone must be text"}), 400

    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO customers (name, phone)
                    VALUES (%s, %s)
                    RETURNING customer_id, name, phone, created_at;
                """, (name.strip(), phone.strip() if phone else None))
                customer = cursor.fetchone()

        return jsonify({
            "message": "Customer added successfully",
            "customer": customer
        }), 201
    except Exception:
        return database_error("Could not add customer; check for duplicate phone")
    finally:
        if connection:
            connection.close()


# ---------------- EMPLOYEES ----------------

@app.route("/api/employees", methods=["GET"])
def get_employees():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT employee_id, name, phone, role, salary,
                       hire_date, is_active
                FROM employees ORDER BY employee_id;
            """)
            return jsonify(cursor.fetchall()), 200
    except Exception:
        return database_error("Could not fetch employees")
    finally:
        if connection:
            connection.close()


@app.route("/api/employees", methods=["POST"])
def add_employee():
    data = get_json()
    if data is None:
        return jsonify({"error": "Send valid JSON"}), 400

    name = data.get("name")
    phone = data.get("phone")
    role = data.get("role")
    allowed_roles = {"waiter", "chef", "manager", "cashier"}

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Employee name is required"}), 400
    if role not in allowed_roles:
        return jsonify({"error": "Invalid employee role"}), 400
    if phone is not None and not isinstance(phone, str):
        return jsonify({"error": "Phone must be text"}), 400

    try:
        salary = parse_price(data.get("salary"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO employees (name, phone, role, salary)
                    VALUES (%s, %s, %s, %s)
                    RETURNING employee_id, name, phone, role, salary,
                              hire_date, is_active;
                """, (
                    name.strip(), phone.strip() if phone else None,
                    role, salary
                ))
                employee = cursor.fetchone()

        return jsonify({
            "message": "Employee added successfully",
            "employee": employee
        }), 201
    except Exception:
        return database_error("Could not add employee; check phone and data")
    finally:
        if connection:
            connection.close()


# ---------------- RESTAURANT TABLES ----------------

@app.route("/api/tables", methods=["GET"])
def get_tables():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT table_id, table_number, capacity, status
                FROM restaurant_tables ORDER BY table_number;
            """)
            return jsonify(cursor.fetchall()), 200
    except Exception:
        return database_error("Could not fetch restaurant tables")
    finally:
        if connection:
            connection.close()


@app.route("/api/tables", methods=["POST"])
def add_restaurant_table():
    data = get_json()
    if data is None:
        return jsonify({"error": "Send valid JSON"}), 400

    number = data.get("table_number")
    capacity = data.get("capacity")

    if not positive_id(number) or not positive_id(capacity):
        return jsonify({
            "error": "Positive table_number and capacity are required"
        }), 400

    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO restaurant_tables (table_number, capacity)
                    VALUES (%s, %s)
                    RETURNING table_id, table_number, capacity, status;
                """, (number, capacity))
                table = cursor.fetchone()

        return jsonify({"message": "Table added", "table": table}), 201
    except Exception:
        return database_error("Could not add table; table number may exist")
    finally:
        if connection:
            connection.close()


@app.route("/api/tables/<int:table_id>", methods=["PATCH"])
def update_restaurant_table(table_id):
    data = get_json()
    allowed = {"available", "occupied", "reserved"}

    if not isinstance(data, dict) or set(data) != {"status"}:
        return jsonify({"error": "Send only the status field"}), 400
    if data["status"] not in allowed:
        return jsonify({"error": "Invalid table status"}), 400

    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE restaurant_tables SET status = %s
                    WHERE table_id = %s
                    RETURNING table_id, table_number, capacity, status;
                """, (data["status"], table_id))
                table = cursor.fetchone()

        if table is None:
            return jsonify({"error": "Table not found"}), 404
        return jsonify({"message": "Table status updated", "table": table}), 200
    except Exception:
        return database_error("Could not update table")
    finally:
        if connection:
            connection.close()


# ---------------- ORDERS ----------------

@app.route("/api/orders", methods=["GET"])
def get_orders():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT order_id, customer_id, table_id, employee_id,
                       order_type, order_status, created_at
                FROM orders ORDER BY order_id DESC;
            """)
            return jsonify(cursor.fetchall()), 200
    except Exception:
        return database_error("Could not fetch orders")
    finally:
        if connection:
            connection.close()


@app.route("/api/orders", methods=["POST"])
def add_order():
    data = get_json()
    if data is None:
        return jsonify({"error": "Send valid JSON"}), 400

    order_type = data.get("order_type", "dine_in")
    if order_type not in {"dine_in", "takeaway"}:
        return jsonify({"error": "order_type must be dine_in or takeaway"}), 400

    customer_id = data.get("customer_id")
    table_id = data.get("table_id")
    employee_id = data.get("employee_id")

    for field, value in (
        ("customer_id", customer_id),
        ("table_id", table_id),
        ("employee_id", employee_id)
    ):
        if value is not None and not positive_id(value):
            return jsonify({"error": field + " must be a positive integer"}), 400

    if order_type == "dine_in" and table_id is None:
        return jsonify({"error": "A table_id is required for dine_in"}), 400

    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO orders
                        (customer_id, table_id, employee_id, order_type)
                    VALUES (%s, %s, %s, %s)
                    RETURNING order_id, customer_id, table_id, employee_id,
                              order_type, order_status, created_at;
                """, (customer_id, table_id, employee_id, order_type))
                order = cursor.fetchone()

                if order_type == "dine_in":
                    cursor.execute("""
                        UPDATE restaurant_tables SET status = 'occupied'
                        WHERE table_id = %s;
                    """, (table_id,))

        return jsonify({"message": "Order created", "order": order}), 201
    except Exception:
        return database_error("Could not create order; check supplied IDs")
    finally:
        if connection:
            connection.close()


@app.route("/api/orders/<int:order_id>", methods=["PATCH"])
def update_order_status(order_id):
    data = get_json()
    if not isinstance(data, dict) or set(data) != {"order_status"}:
        return jsonify({"error": "Send only order_status"}), 400

    status = data["order_status"]
    if status not in ORDER_STATUSES:
        return jsonify({"error": "Invalid order status"}), 400

    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE orders SET order_status = %s
                    WHERE order_id = %s
                    RETURNING order_id, customer_id, table_id, employee_id,
                              order_type, order_status, created_at;
                """, (status, order_id))
                order = cursor.fetchone()

                if order and status in {"completed", "cancelled"}:
                    if order["table_id"] is not None:
                        cursor.execute("""
                            UPDATE restaurant_tables SET status = 'available'
                            WHERE table_id = %s;
                        """, (order["table_id"],))

        if order is None:
            return jsonify({"error": "Order not found"}), 404
        return jsonify({"message": "Order status updated", "order": order}), 200
    except Exception:
        return database_error("Could not update order")
    finally:
        if connection:
            connection.close()


# ---------------- ORDER ITEMS ----------------

@app.route("/api/order-items", methods=["GET"])
def get_order_items():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT oi.order_item_id, oi.order_id, oi.item_id,
                       mi.name AS item_name, oi.quantity, oi.unit_price
                FROM order_items oi
                JOIN menu_items mi ON mi.item_id = oi.item_id
                ORDER BY oi.order_item_id;
            """)
            return jsonify(cursor.fetchall()), 200
    except Exception:
        return database_error("Could not fetch order items")
    finally:
        if connection:
            connection.close()


@app.route("/api/order-items", methods=["POST"])
def add_order_item():
    data = get_json()
    if data is None:
        return jsonify({"error": "Send valid JSON"}), 400

    order_id = data.get("order_id")
    item_id = data.get("item_id")
    quantity = data.get("quantity")

    if not positive_id(order_id) or not positive_id(item_id):
        return jsonify({"error": "Valid order_id and item_id are required"}), 400
    if not positive_id(quantity):
        return jsonify({"error": "Quantity must be a positive integer"}), 400

    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT price FROM menu_items
                    WHERE item_id = %s AND is_available = TRUE;
                """, (item_id,))
                menu_item = cursor.fetchone()

                if menu_item is None:
                    return jsonify({
                        "error": "Menu item not found or unavailable"
                    }), 404

                cursor.execute("""
                    INSERT INTO order_items (order_id, item_id, quantity, unit_price)
                    VALUES (%s, %s, %s, %s)
                    RETURNING order_item_id, order_id, item_id, quantity, unit_price;
                """, (order_id, item_id, quantity, menu_item["price"]))
                order_item = cursor.fetchone()

        return jsonify({
            "message": "Item added to order",
            "order_item": order_item
        }), 201
    except Exception:
        return database_error("Could not add item; check order_id and item_id")
    finally:
        if connection:
            connection.close()


# ---------------- PAYMENTS ----------------

@app.route("/api/payments", methods=["GET"])
def get_payments():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT payment_id, order_id, amount, payment_method,
                       payment_status, paid_at
                FROM payments ORDER BY payment_id DESC;
            """)
            return jsonify(cursor.fetchall()), 200
    except Exception:
        return database_error("Could not fetch payments")
    finally:
        if connection:
            connection.close()


@app.route("/api/payments", methods=["POST"])
def add_payment():
    data = get_json()
    if data is None:
        return jsonify({"error": "Send valid JSON"}), 400

    order_id = data.get("order_id")
    method = data.get("payment_method")
    status = data.get("payment_status", "paid")

    if not positive_id(order_id):
        return jsonify({"error": "Valid order_id is required"}), 400
    if method not in {"cash", "card", "upi"}:
        return jsonify({"error": "Method must be cash, card or upi"}), 400
    if status not in {"pending", "paid", "failed"}:
        return jsonify({"error": "Invalid payment status"}), 400

    try:
        amount = parse_price(data.get("amount"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    connection = None
    try:
        connection = get_connection()
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO payments
                        (order_id, amount, payment_method, payment_status, paid_at)
                    VALUES (%s, %s, %s, %s,
                            CASE WHEN %s = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END)
                    RETURNING payment_id, order_id, amount, payment_method,
                              payment_status, paid_at;
                """, (order_id, amount, method, status, status))
                payment = cursor.fetchone()

        return jsonify({"message": "Payment recorded", "payment": payment}), 201
    except Exception:
        return database_error("Could not record payment; check order or duplicate payment")
    finally:
        if connection:
            connection.close()


if __name__ == "__main__":
    app.run(debug=True, port=5000)
