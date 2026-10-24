const db = require('../config/db');

// GET /api/customers - List all customers with optional search
exports.getAllCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT customer_id, name, phone, email, created_at FROM customers';
    const params = [];

    if (search && search.trim() !== '') {
      sql += ' WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1';
      params.push(`%${search.trim()}%`);
    }

    sql += ' ORDER BY customer_id ASC';
    const { rows } = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      message: 'Customers retrieved successfully',
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/customers/:id - Get single customer by ID
exports.getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'SELECT customer_id, name, phone, email, created_at FROM customers WHERE customer_id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Customer retrieved successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/customers - Create new customer
exports.createCustomer = async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required and must be a non-empty string',
      });
    }

    // Clean optional inputs (empty string treated as NULL for clean UNIQUE constraint checks)
    const cleanPhone = phone && phone.trim() !== '' ? phone.trim() : null;
    const cleanEmail = email && email.trim() !== '' ? email.trim() : null;

    const insertSql = `
      INSERT INTO customers (name, phone, email)
      VALUES ($1, $2, $3)
      RETURNING customer_id, name, phone, email, created_at
    `;
    const { rows } = await db.query(insertSql, [name.trim(), cleanPhone, cleanEmail]);

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/customers/:id - Update existing customer details
exports.updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, email } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required and must be a non-empty string',
      });
    }

    const cleanPhone = phone && phone.trim() !== '' ? phone.trim() : null;
    const cleanEmail = email && email.trim() !== '' ? email.trim() : null;

    const updateSql = `
      UPDATE customers
      SET name = $1, phone = $2, email = $3
      WHERE customer_id = $4
      RETURNING customer_id, name, phone, email, created_at
    `;
    const { rows } = await db.query(updateSql, [name.trim(), cleanPhone, cleanEmail, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/customers/:id - Remove customer
exports.deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM customers WHERE customer_id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Customer with ID ${id} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

