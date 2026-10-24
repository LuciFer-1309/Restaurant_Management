-- =============================================================================
-- Restaurant Management System - DBMS Project Demonstration Queries
-- Comprehensive SQL demonstration script for presentation / viva
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. INNER JOIN DEMONSTRATION: Confirmed Reservations with Customer and Table Details
-- -----------------------------------------------------------------------------
SELECT 
    r.reservation_id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    t.table_number,
    t.capacity AS table_capacity,
    r.reservation_time,
    r.party_size,
    r.status
FROM reservations r
INNER JOIN customers c ON r.customer_id = c.customer_id
INNER JOIN restaurant_tables t ON r.table_id = t.table_id
WHERE r.status = 'confirmed'
ORDER BY r.reservation_time ASC;

-- -----------------------------------------------------------------------------
-- 2. LEFT JOIN DEMONSTRATION: All Customers with their Reservations (including those who haven't booked)
-- -----------------------------------------------------------------------------
SELECT 
    c.customer_id,
    c.name AS customer_name,
    c.phone,
    r.reservation_id,
    r.reservation_time,
    r.status AS reservation_status
FROM customers c
LEFT JOIN reservations r ON c.customer_id = r.customer_id
ORDER BY c.customer_id, r.reservation_time;

-- -----------------------------------------------------------------------------
-- 3. ORDERS WITH CUSTOMER & TABLE DETAILS (handling walk-in & takeaway gracefully)
-- -----------------------------------------------------------------------------
SELECT 
    o.order_id,
    COALESCE(c.name, 'Walk-in Guest') AS customer_name,
    COALESCE(t.table_number, 'N/A (Takeaway)') AS table_number,
    o.order_type,
    o.status AS order_status,
    o.order_time
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
LEFT JOIN restaurant_tables t ON o.table_id = t.table_id
ORDER BY o.order_id DESC;

-- -----------------------------------------------------------------------------
-- 4. DETAILED BREAKDOWN: Orders with their Line Items and Stored Historical Unit Prices
-- -----------------------------------------------------------------------------
SELECT 
    o.order_id,
    o.order_type,
    m.name AS item_name,
    m.category,
    oi.quantity,
    oi.unit_price,
    (oi.quantity * oi.unit_price) AS line_total
FROM orders o
INNER JOIN order_items oi ON o.order_id = oi.order_id
INNER JOIN menu_items m ON oi.menu_item_id = m.menu_item_id
ORDER BY o.order_id ASC, m.name ASC;

-- -----------------------------------------------------------------------------
-- 5. TOTAL BILL CALCULATION FOR EACH ORDER (Aggregation via SUM, with Paid Status)
-- Notice: Does not rely on client-supplied values; calculated dynamically from line items.
-- -----------------------------------------------------------------------------
SELECT 
    o.order_id,
    o.order_type,
    o.status AS order_status,
    COALESCE(c.name, 'Walk-in Guest') AS customer_name,
    COUNT(oi.order_item_id) AS total_items_count,
    COALESCE(SUM(oi.quantity * oi.unit_price), 0.00) AS calculated_order_total,
    COALESCE(p.total_paid, 0.00) AS total_amount_paid,
    CASE 
        WHEN COALESCE(p.total_paid, 0.00) >= COALESCE(SUM(oi.quantity * oi.unit_price), 0.00) AND COALESCE(SUM(oi.quantity * oi.unit_price), 0.00) > 0 THEN 'PAID'
        WHEN COALESCE(p.total_paid, 0.00) > 0 THEN 'PARTIALLY_PAID'
        ELSE 'UNPAID'
    END AS payment_settlement_status
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN (
    SELECT order_id, SUM(amount) AS total_paid
    FROM payments
    WHERE payment_status = 'completed'
    GROUP BY order_id
) p ON o.order_id = p.order_id
GROUP BY o.order_id, o.order_type, o.status, c.name, p.total_paid
ORDER BY o.order_id ASC;

-- -----------------------------------------------------------------------------
-- 6. TOTAL RESTAURANT REVENUE USING SUM()
-- -----------------------------------------------------------------------------
SELECT 
    COUNT(payment_id) AS completed_transactions_count,
    COALESCE(SUM(amount), 0.00) AS total_revenue_inr
FROM payments
WHERE payment_status = 'completed';

-- -----------------------------------------------------------------------------
-- 7. REVENUE GROUPED BY DATE USING GROUP BY
-- -----------------------------------------------------------------------------
SELECT 
    DATE(payment_time) AS sales_date,
    payment_method,
    COUNT(payment_id) AS transaction_count,
    SUM(amount) AS daily_revenue
FROM payments
WHERE payment_status = 'completed'
GROUP BY DATE(payment_time), payment_method
ORDER BY sales_date DESC, daily_revenue DESC;

-- -----------------------------------------------------------------------------
-- 8. BEST-SELLING MENU ITEMS (RANKED BY QUANTITY ORDERED AND REVENUE GENERATED)
-- -----------------------------------------------------------------------------
SELECT 
    m.menu_item_id,
    m.name AS item_name,
    m.category,
    SUM(oi.quantity) AS total_quantity_sold,
    SUM(oi.quantity * oi.unit_price) AS total_sales_volume
FROM order_items oi
INNER JOIN menu_items m ON oi.menu_item_id = m.menu_item_id
INNER JOIN orders o ON oi.order_id = o.order_id
WHERE o.status != 'cancelled'
GROUP BY m.menu_item_id, m.name, m.category
ORDER BY total_quantity_sold DESC, total_sales_volume DESC;

-- -----------------------------------------------------------------------------
-- 9. RESTAURANT TABLE AVAILABILITY & CAPACITY REPORT
-- -----------------------------------------------------------------------------
SELECT 
    status AS table_status,
    COUNT(table_id) AS table_count,
    SUM(capacity) AS total_seating_capacity
FROM restaurant_tables
GROUP BY status
ORDER BY table_count DESC;

-- -----------------------------------------------------------------------------
-- 10. CUSTOMERS WITH THEIR TOTAL ORDER COUNTS AND LIFETIME EXPENDITURE
-- -----------------------------------------------------------------------------
SELECT 
    c.customer_id,
    c.name AS customer_name,
    c.phone,
    COUNT(DISTINCT o.order_id) AS total_orders_placed,
    COALESCE(SUM(oi.quantity * oi.unit_price), 0.00) AS lifetime_spent
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id AND o.status != 'cancelled'
LEFT JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY c.customer_id, c.name, c.phone
ORDER BY lifetime_spent DESC, total_orders_placed DESC;

