const db = require('../config/db');

const VALID_ORDER_STATUSES = [
  'placed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
];

const VALID_ORDER_TYPES = ['dine_in', 'takeaway'];

// GET /api/orders - List all orders with customer, table and payment summary
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, order_type, date } = req.query;

    let sql = `
      SELECT
        o.order_id,
        o.customer_id,
        COALESCE(c.name, 'Walk-in Guest') AS customer_name,
        c.phone AS customer_phone,
        o.table_id,
        t.table_number,
        o.order_time,
        o.status,
        o.order_type,
        COUNT(oi.order_item_id)::INT AS total_items_count,
        COALESCE(
          SUM(oi.quantity * oi.unit_price),
          0.00
        )::NUMERIC(10,2) AS total_amount,
        COALESCE(p.paid_amount, 0.00)::NUMERIC(10,2) AS paid_amount,
        CASE
          WHEN COALESCE(p.paid_amount, 0) >=
               COALESCE(SUM(oi.quantity * oi.unit_price), 0)
               AND COALESCE(SUM(oi.quantity * oi.unit_price), 0) > 0
            THEN 'PAID'
          WHEN COALESCE(p.paid_amount, 0) > 0
            THEN 'PARTIAL'
          ELSE 'UNPAID'
        END AS payment_status
      FROM orders o
      LEFT JOIN customers c
        ON o.customer_id = c.customer_id
      LEFT JOIN restaurant_tables t
        ON o.table_id = t.table_id
      LEFT JOIN order_items oi
        ON o.order_id = oi.order_id
      LEFT JOIN (
        SELECT order_id, SUM(amount) AS paid_amount
        FROM payments
        WHERE payment_status = 'completed'
        GROUP BY order_id
      ) p ON o.order_id = p.order_id
      WHERE 1 = 1
    `;

    const params = [];

    if (status && status.trim() !== '') {
      params.push(status.trim().toLowerCase());
      sql += ` AND o.status = $${params.length}`;
    }

    if (order_type && order_type.trim() !== '') {
      params.push(order_type.trim().toLowerCase());
      sql += ` AND o.order_type = $${params.length}`;
    }

    if (date && date.trim() !== '') {
      params.push(date.trim());
      sql += ` AND DATE(o.order_time) = $${params.length}`;
    }

    sql += `
      GROUP BY
        o.order_id,
        o.customer_id,
        c.name,
        c.phone,
        o.table_id,
        t.table_number,
        o.order_time,
        o.status,
        o.order_type,
        p.paid_amount
      ORDER BY o.order_id DESC
    `;

    const { rows } = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/orders/:id - Get one order with items and payments
exports.getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orderId = Number(id);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid order ID.',
      });
    }

    const orderSql = `
      SELECT
        o.order_id,
        o.customer_id,
        COALESCE(c.name, 'Walk-in Guest') AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        o.table_id,
        t.table_number,
        o.order_time,
        o.status,
        o.order_type
      FROM orders o
      LEFT JOIN customers c
        ON o.customer_id = c.customer_id
      LEFT JOIN restaurant_tables t
        ON o.table_id = t.table_id
      WHERE o.order_id = $1
    `;

    const orderResult = await db.query(orderSql, [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} not found.`,
      });
    }

    const orderHeader = orderResult.rows[0];

    const itemsSql = `
      SELECT
        oi.order_item_id,
        oi.menu_item_id,
        m.name AS menu_item_name,
        m.category,
        oi.quantity,
        oi.unit_price,
        (oi.quantity * oi.unit_price)::NUMERIC(10,2) AS subtotal
      FROM order_items oi
      INNER JOIN menu_items m
        ON oi.menu_item_id = m.menu_item_id
      WHERE oi.order_id = $1
      ORDER BY oi.order_item_id ASC
    `;

    const itemsResult = await db.query(itemsSql, [orderId]);

    const paymentsSql = `
      SELECT
        payment_id,
        amount,
        payment_method,
        payment_status,
        payment_time
      FROM payments
      WHERE order_id = $1
      ORDER BY payment_time ASC
    `;

    const paymentsResult = await db.query(paymentsSql, [orderId]);

    const totalAmount = itemsResult.rows.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0
    );

    const paidAmount = paymentsResult.rows
      .filter((payment) => payment.payment_status === 'completed')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const remainingBalance = Math.max(0, totalAmount - paidAmount);

    return res.status(200).json({
      success: true,
      message: 'Order details retrieved successfully',
      data: {
        ...orderHeader,
        items: itemsResult.rows,
        payments: paymentsResult.rows,
        total_amount: Number(totalAmount.toFixed(2)),
        paid_amount: Number(paidAmount.toFixed(2)),
        remaining_balance: Number(remainingBalance.toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/orders - Create an order and its items in one transaction
exports.createOrder = async (req, res, next) => {
  let client;
  let transactionStarted = false;

  try {
    client = await db.getClient();

    const {
      customer_id,
      table_id,
      order_type = 'dine_in',
      items,
    } = req.body;

    // 1. Validate order type
    const cleanOrderType =
      typeof order_type === 'string'
        ? order_type.trim().toLowerCase()
        : '';

    if (!VALID_ORDER_TYPES.includes(cleanOrderType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid order_type. Permitted values: ${VALID_ORDER_TYPES.join(', ')}`,
      });
    }

    // 2. Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain an items array with at least one item.',
      });
    }

    // 3. Validate item IDs and quantities.
    // Use numeric Map keys to avoid string/number mismatches.
    const itemMap = new Map();

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Each item must be a valid object.',
        });
      }

      const menuItemId = Number(item.menu_item_id);
      const quantity = Number(item.quantity);

      if (
        !Number.isSafeInteger(menuItemId) ||
        menuItemId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Each item must specify a valid positive menu_item_id.',
        });
      }

      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Quantity for menu_item_id ${menuItemId} must be a positive integer.`,
        });
      }

      const existingQuantity = itemMap.get(menuItemId) || 0;
      const combinedQuantity = existingQuantity + quantity;

      if (!Number.isSafeInteger(combinedQuantity)) {
        return res.status(400).json({
          success: false,
          message: `Total quantity for menu_item_id ${menuItemId} is too large.`,
        });
      }

      // Duplicate menu items are combined.
      itemMap.set(menuItemId, combinedQuantity);
    }

    // 4. Start transaction
    await client.query('BEGIN');
    transactionStarted = true;

    // 5. Validate customer, if provided
    if (customer_id !== undefined && customer_id !== null && customer_id !== '') {
      const customerId = Number(customer_id);

      if (!Number.isSafeInteger(customerId) || customerId <= 0) {
        await client.query('ROLLBACK');
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: 'Please provide a valid customer_id.',
        });
      }

      const customerCheck = await client.query(
        'SELECT customer_id FROM customers WHERE customer_id = $1',
        [customerId]
      );

      if (customerCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: `Customer with ID ${customerId} does not exist.`,
        });
      }
    }

    // 6. Validate table, if provided
    if (table_id !== undefined && table_id !== null && table_id !== '') {
      const tableId = Number(table_id);

      if (!Number.isSafeInteger(tableId) || tableId <= 0) {
        await client.query('ROLLBACK');
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: 'Please provide a valid table_id.',
        });
      }

      const tableCheck = await client.query(
        'SELECT table_id FROM restaurant_tables WHERE table_id = $1',
        [tableId]
      );

      if (tableCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: `Table with ID ${tableId} does not exist.`,
        });
      }
    }

    const customerId =
      customer_id === undefined || customer_id === null || customer_id === ''
        ? null
        : Number(customer_id);

    const tableId =
      table_id === undefined || table_id === null || table_id === ''
        ? null
        : Number(table_id);

    // 7. Fetch authoritative menu details from the database
    const menuItemIds = Array.from(itemMap.keys());

    const menuResult = await client.query(
      `
        SELECT menu_item_id, name, price, is_available
        FROM menu_items
        WHERE menu_item_id = ANY($1::int[])
      `,
      [menuItemIds]
    );

    // PostgreSQL BIGINT IDs may be returned as strings by node-postgres.
    // Convert IDs to numbers before comparing them.
    const foundIds = new Set(
      menuResult.rows.map((menuItem) => Number(menuItem.menu_item_id))
    );

    const missingIds = menuItemIds.filter(
      (menuItemId) => !foundIds.has(Number(menuItemId))
    );

    if (missingIds.length > 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: `The following menu items do not exist: ${missingIds.join(', ')}`,
      });
    }

    const unavailableItems = menuResult.rows.filter(
      (menuItem) => !menuItem.is_available
    );

    if (unavailableItems.length > 0) {
      const names = unavailableItems
        .map(
          (menuItem) =>
            `"${menuItem.name}" (ID ${menuItem.menu_item_id})`
        )
        .join(', ');

      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: `Cannot place order. These items are unavailable: ${names}`,
      });
    }

    // 8. Create order header
    const orderInsertSql = `
      INSERT INTO orders (customer_id, table_id, status, order_type)
      VALUES ($1, $2, 'placed', $3)
      RETURNING order_id, customer_id, table_id, order_time, status, order_type
    `;

    const orderInsertResult = await client.query(orderInsertSql, [
      customerId,
      tableId,
      cleanOrderType,
    ]);

    const createdOrder = orderInsertResult.rows[0];

    // 9. Insert every order item using the correct numeric Map key
    const orderItemsInserted = [];
    let calculatedOrderTotal = 0;

    for (const menuItem of menuResult.rows) {
      const menuItemId = Number(menuItem.menu_item_id);
      const quantity = itemMap.get(menuItemId);

      // Prevent undefined quantity from reaching PostgreSQL.
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error(
          `Could not determine a valid quantity for menu_item_id ${menuItemId}.`
        );
      }

      const unitPrice = Number(menuItem.price);

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(
          `Invalid database price for menu_item_id ${menuItemId}.`
        );
      }

      const subtotal = Number((quantity * unitPrice).toFixed(2));
      calculatedOrderTotal += subtotal;

      const itemInsertSql = `
        INSERT INTO order_items
          (order_id, menu_item_id, quantity, unit_price)
        VALUES ($1, $2, $3, $4)
        RETURNING
          order_item_id,
          order_id,
          menu_item_id,
          quantity,
          unit_price
      `;

      const itemInsertResult = await client.query(itemInsertSql, [
        createdOrder.order_id,
        menuItemId,
        quantity,
        unitPrice,
      ]);

      orderItemsInserted.push({
        ...itemInsertResult.rows[0],
        name: menuItem.name,
        subtotal,
      });
    }

    // 10. Mark the table occupied for dine-in orders
    if (tableId !== null && cleanOrderType === 'dine_in') {
      await client.query(
        `
          UPDATE restaurant_tables
          SET status = 'occupied'
          WHERE table_id = $1
        `,
        [tableId]
      );
    }

    // 11. Commit only after all inserts and updates succeed
    await client.query('COMMIT');
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: 'Order created successfully with items',
      data: {
        ...createdOrder,
        items: orderItemsInserted,
        total_amount: Number(calculatedOrderTotal.toFixed(2)),
      },
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Transaction rollback failed:', rollbackError.message);
      }
    }

    next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
};

// PATCH /api/orders/:id/status - Update order status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (typeof status !== 'string' || !status.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Field "status" is required.',
      });
    }

    const orderId = Number(id);
    const cleanStatus = status.trim().toLowerCase();

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid order ID.',
      });
    }

    if (!VALID_ORDER_STATUSES.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Permitted values: ${VALID_ORDER_STATUSES.join(', ')}`,
      });
    }

    const patchSql = `
      UPDATE orders
      SET status = $1
      WHERE order_id = $2
      RETURNING order_id, customer_id, table_id, order_time, status, order_type
    `;

    const { rows } = await db.query(patchSql, [cleanStatus, orderId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${cleanStatus}.`,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};
