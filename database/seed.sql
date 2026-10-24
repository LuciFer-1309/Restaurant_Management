-- =============================================================================
-- Seed Data Script for Restaurant Management System
-- Clean, predictable, and realistic fictional dataset
-- =============================================================================

-- Clear existing data cleanly in reverse dependency order
TRUNCATE TABLE payments, order_items, orders, reservations, restaurant_tables, menu_items, customers RESTART IDENTITY CASCADE;

-- 1. SEED CUSTOMERS
INSERT INTO customers (name, phone, email, created_at) VALUES
('Aarav Sharma', '9876543210', 'aarav.sharma@example.com', '2026-10-01 10:30:00+05:30'),
('Priya Patel', '9876543211', 'priya.patel@example.com', '2026-10-02 11:15:00+05:30'),
('Rohan Verma', '9876543212', 'rohan.verma@example.com', '2026-10-03 14:00:00+05:30'),
('Ananya Iyer', '9876543213', 'ananya.iyer@example.com', '2026-10-04 16:45:00+05:30'),
('Vikram Malhotra', '9876543214', 'vikram.m@example.com', '2026-10-05 19:20:00+05:30'),
('Sneha Kulkarni', '9876543215', 'sneha.k@example.com', '2026-10-06 12:10:00+05:30');

-- 2. SEED MENU ITEMS
INSERT INTO menu_items (name, category, price, is_available) VALUES
('Paneer Butter Masala', 'Main Course', 280.00, TRUE),
('Butter Naan', 'Breads', 45.00, TRUE),
('Chicken Biryani', 'Main Course', 320.00, TRUE),
('Veg Spring Rolls', 'Appetizers', 180.00, TRUE),
('Garlic Bread with Cheese', 'Appetizers', 160.00, TRUE),
('Dal Makhani', 'Main Course', 240.00, TRUE),
('Jeera Rice', 'Rice', 150.00, TRUE),
('Gulab Jamun (2 pcs)', 'Desserts', 90.00, TRUE),
('Chocolate Brownie with Ice Cream', 'Desserts', 180.00, TRUE),
('Fresh Lime Soda', 'Beverages', 80.00, TRUE),
('Mango Lassi', 'Beverages', 110.00, TRUE),
('Tandoori Roti', 'Breads', 30.00, FALSE); -- Marked unavailable for testing

-- 3. SEED RESTAURANT TABLES
INSERT INTO restaurant_tables (table_number, capacity, status) VALUES
('T-01', 2, 'available'),
('T-02', 2, 'occupied'),
('T-03', 4, 'occupied'),
('T-04', 4, 'reserved'),
('T-05', 6, 'available'),
('T-06', 6, 'available'),
('T-07', 8, 'reserved'),
('T-08', 4, 'available');

-- 4. SEED RESERVATIONS
INSERT INTO reservations (customer_id, table_id, reservation_time, party_size, status, created_at) VALUES
(1, 4, '2026-10-24 19:30:00+05:30', 4, 'confirmed', '2026-10-24 10:00:00+05:30'),
(2, 7, '2026-10-24 20:30:00+05:30', 8, 'confirmed', '2026-10-24 11:30:00+05:30'),
(3, 1, '2026-10-23 13:00:00+05:30', 2, 'completed', '2026-10-22 17:00:00+05:30'),
(4, NULL, '2026-10-25 18:00:00+05:30', 3, 'pending', '2026-10-24 12:00:00+05:30'),
(5, 5, '2026-10-22 20:00:00+05:30', 5, 'cancelled', '2026-10-21 09:00:00+05:30');

-- 5. SEED ORDERS
-- Order 1: Dine-in, Table T-02, Customer 1
INSERT INTO orders (customer_id, table_id, order_time, status, order_type) VALUES
(1, 2, '2026-10-23 19:45:00+05:30', 'served', 'dine_in');

-- Order 2: Dine-in, Table T-03, Customer 2
INSERT INTO orders (customer_id, table_id, order_time, status, order_type) VALUES
(2, 3, '2026-10-23 20:00:00+05:30', 'served', 'dine_in');

-- Order 3: Takeaway, Anonymous Walk-in Customer (customer_id IS NULL, table_id IS NULL)
INSERT INTO orders (customer_id, table_id, order_time, status, order_type) VALUES
(NULL, NULL, '2026-10-24 12:30:00+05:30', 'ready', 'takeaway');

-- Order 4: Dine-in, Customer 3, Table T-02 (Active in kitchen)
INSERT INTO orders (customer_id, table_id, order_time, status, order_type) VALUES
(3, 2, '2026-10-24 13:00:00+05:30', 'preparing', 'dine_in');

-- Order 5: Cancelled Order, Customer 4
INSERT INTO orders (customer_id, table_id, order_time, status, order_type) VALUES
(4, 8, '2026-10-24 13:15:00+05:30', 'cancelled', 'dine_in');

-- 6. SEED ORDER_ITEMS
-- Items for Order 1: Paneer Butter Masala (1 x 280), Butter Naan (3 x 45), Mango Lassi (2 x 110)
-- Total = 280 + 135 + 220 = 635.00
INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES
(1, 1, 1, 280.00),
(1, 2, 3, 45.00),
(1, 11, 2, 110.00);

-- Items for Order 2: Chicken Biryani (2 x 320), Fresh Lime Soda (2 x 80), Chocolate Brownie (1 x 180)
-- Total = 640 + 160 + 180 = 980.00
INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES
(2, 3, 2, 320.00),
(2, 10, 2, 80.00),
(2, 9, 1, 180.00);

-- Items for Order 3: Veg Spring Rolls (2 x 180), Dal Makhani (1 x 240), Jeera Rice (1 x 150)
-- Total = 360 + 240 + 150 = 750.00
INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES
(3, 4, 2, 180.00),
(3, 6, 1, 240.00),
(3, 7, 1, 150.00);

-- Items for Order 4: Garlic Bread with Cheese (2 x 160), Gulab Jamun (1 x 90)
-- Total = 320 + 90 = 410.00
INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES
(4, 5, 2, 160.00),
(4, 8, 1, 90.00);

-- Items for Order 5: Paneer Butter Masala (1 x 280)
-- Total = 280.00
INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES
(5, 1, 1, 280.00);

-- 7. SEED PAYMENTS
-- Order 1 is fully paid via UPI
INSERT INTO payments (order_id, amount, payment_method, payment_status, payment_time) VALUES
(1, 635.00, 'upi', 'completed', '2026-10-23 20:45:00+05:30');

-- Order 2 is paid split: Card (500.00) and Cash (480.00)
INSERT INTO payments (order_id, amount, payment_method, payment_status, payment_time) VALUES
(2, 500.00, 'card', 'completed', '2026-10-23 21:00:00+05:30'),
(2, 480.00, 'cash', 'completed', '2026-10-23 21:05:00+05:30');

-- Order 3: Payment attempted via Card but failed
INSERT INTO payments (order_id, amount, payment_method, payment_status, payment_time) VALUES
(3, 750.00, 'card', 'failed', '2026-10-24 12:45:00+05:30');

-- Order 4 has no payment yet (pending preparation)

