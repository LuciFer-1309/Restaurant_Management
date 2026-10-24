const db = require('../config/db');

const VALID_PAYMENT_METHODS = ['cash', 'card', 'upi'];
const VALID_PAYMENT_STATUSES = ['pending', 'completed', 'failed'];

// GET /api/payments - List all payments with order summary
exports.getAllPayments = async (req, res, next) => {
  try {
    const { status, payment_method } = req.query;
    let sql = `
      SELECT 
        p.payment_id,
        p.order_id,
        o.order_type,
        COALESCE(c.name, 'Walk-in Guest') AS customer_name,
        p.amount,
        p.payment_method,
        p.payment_status,
        p.payment_time
      FROM payments p
      INNER JOIN orders o ON p.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status.trim() !== '') {
      params.push(status.trim().toLowerCase());
      sql += ` AND p.payment_status = $${params.length}`;
    }

    if (payment_method && payment_method.trim() !== '') {
      params.push(payment_method.trim().toLowerCase());
      sql += ` AND p.payment_method = $${params.length}`;
    }

    sql += ' ORDER BY p.payment_time DESC';
    const { rows } = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      message: 'Payments retrieved successfully',
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/payments/:id - Get single payment record
exports.getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        p.payment_id,
        p.order_id,
        o.order_type,
        o.status AS order_status,
        COALESCE(c.name, 'Walk-in Guest') AS customer_name,
        p.amount,
        p.payment_method,
        p.payment_status,
        p.payment_time
      FROM payments p
      INNER JOIN orders o ON p.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      WHERE p.payment_id = $1
    `;
    const { rows } = await db.query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Payment with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment retrieved successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments - Process a payment against an order
 * Business Rules:
 * 1. Validates order existence and prevents payments on cancelled orders.
 * 2. Calculates exact order total from order items in database.
 * 3. Checks previously completed payments to support partial or split payments.
 * 4. Rejects overpayment (amount exceeding remaining balance).
 * 5. If this payment satisfies the balance and status is completed, the order is settled.
 */
exports.createPayment = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { order_id, amount, payment_method, payment_status = 'completed' } = req.body;

    // 1. Basic field validations
    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id is required',
      });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'amount must be a positive number greater than zero',
      });
    }

    const cleanMethod = payment_method ? payment_method.trim().toLowerCase() : '';
    if (!VALID_PAYMENT_METHODS.includes(cleanMethod)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment_method. Permitted values: ${VALID_PAYMENT_METHODS.join(', ')}`,
      });
    }

    const cleanStatus = payment_status ? payment_status.trim().toLowerCase() : 'completed';
    if (!VALID_PAYMENT_STATUSES.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment_status. Permitted values: ${VALID_PAYMENT_STATUSES.join(', ')}`,
      });
    }

    await client.query('BEGIN');

    // 2. Fetch Order and verify status
    const orderResult = await client.query(
      'SELECT order_id, table_id, status FROM orders WHERE order_id = $1 FOR UPDATE',
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Order with ID ${order_id} does not exist.`,
      });
    }

    const order = orderResult.rows[0];
    if (order.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot accept payment for a cancelled order (Order ID: ${order_id}).`,
      });
    }

    // 3. Compute calculated order total from ORDER_ITEMS
    const totalResult = await client.query(
      'SELECT COALESCE(SUM(quantity * unit_price), 0)::NUMERIC(10,2) AS order_total FROM order_items WHERE order_id = $1',
      [order_id]
    );
    const orderTotal = parseFloat(totalResult.rows[0].order_total);

    if (orderTotal === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Order with ID ${order_id} has no order items or a total of 0.00.`,
      });
    }

    // 4. Compute existing completed payments
    const paymentsResult = await client.query(
      "SELECT COALESCE(SUM(amount), 0)::NUMERIC(10,2) AS total_paid FROM payments WHERE order_id = $1 AND payment_status = 'completed'",
      [order_id]
    );
    const alreadyPaid = parseFloat(paymentsResult.rows[0].total_paid);
    const remainingBalance = parseFloat((orderTotal - alreadyPaid).toFixed(2));

    // Check if already fully settled
    if (remainingBalance <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Order with ID ${order_id} is already fully paid. Total: Rs. ${orderTotal}, Paid: Rs. ${alreadyPaid}.`,
      });
    }

    // Check for overpayment
    if (cleanStatus === 'completed' && numericAmount > remainingBalance) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Payment amount (Rs. ${numericAmount.toFixed(2)}) exceeds remaining balance of Rs. ${remainingBalance.toFixed(2)}.`,
      });
    }

    // 5. Insert payment record
    const insertSql = `
      INSERT INTO payments (order_id, amount, payment_method, payment_status)
      VALUES ($1, $2, $3, $4)
      RETURNING payment_id, order_id, amount, payment_method, payment_status, payment_time
    `;
    const insertResult = await client.query(insertSql, [
      order_id,
      numericAmount.toFixed(2),
      cleanMethod,
      cleanStatus,
    ]);
    const recordedPayment = insertResult.rows[0];

    // 6. Update order status or table availability if completed and bill is satisfied
    const newPaidTotal = cleanStatus === 'completed' ? alreadyPaid + numericAmount : alreadyPaid;
    const isNowFullyPaid = newPaidTotal >= orderTotal;

    // Optional business logic: if fully paid and order was served, mark table available
    if (isNowFullyPaid && order.table_id) {
      // Table can become available once payment is complete and order was served
      if (order.status === 'served') {
        await client.query(
          "UPDATE restaurant_tables SET status = 'available' WHERE table_id = $1",
          [order.table_id]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        payment: recordedPayment,
        order_total: orderTotal,
        total_paid: parseFloat(newPaidTotal.toFixed(2)),
        remaining_balance: Math.max(0, parseFloat((orderTotal - newPaidTotal).toFixed(2))),
        is_fully_paid: isNowFullyPaid,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

