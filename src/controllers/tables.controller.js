const db = require('../config/db');

const VALID_TABLE_STATUSES = ['available', 'occupied', 'reserved'];

// GET /api/tables - List all tables with optional status or min_capacity filter
exports.getAllTables = async (req, res, next) => {
  try {
    const { status, min_capacity } = req.query;
    let sql = 'SELECT table_id, table_number, capacity, status FROM restaurant_tables WHERE 1=1';
    const params = [];

    if (status && status.trim() !== '') {
      params.push(status.trim().toLowerCase());
      sql += ` AND status = $${params.length}`;
    }

    if (min_capacity) {
      const cap = parseInt(min_capacity, 10);
      if (!isNaN(cap)) {
        params.push(cap);
        sql += ` AND capacity >= $${params.length}`;
      }
    }

    sql += ' ORDER BY table_number ASC';
    const { rows } = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      message: 'Tables retrieved successfully',
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/tables/:id - Get single table details
exports.getTableById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'SELECT table_id, table_number, capacity, status FROM restaurant_tables WHERE table_id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Table with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Table retrieved successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/tables - Add new restaurant table
exports.createTable = async (req, res, next) => {
  try {
    const { table_number, capacity, status } = req.body;

    if (!table_number || typeof table_number !== 'string' || table_number.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Table number is required and must be a non-empty string (e.g. "T-01")',
      });
    }

    const numericCapacity = parseInt(capacity, 10);
    if (isNaN(numericCapacity) || numericCapacity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be a positive integer greater than zero',
      });
    }

    const tableStatus = status ? status.trim().toLowerCase() : 'available';
    if (!VALID_TABLE_STATUSES.includes(tableStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Permitted values are: ${VALID_TABLE_STATUSES.join(', ')}`,
      });
    }

    const insertSql = `
      INSERT INTO restaurant_tables (table_number, capacity, status)
      VALUES ($1, $2, $3)
      RETURNING table_id, table_number, capacity, status
    `;
    const { rows } = await db.query(insertSql, [table_number.trim(), numericCapacity, tableStatus]);

    return res.status(201).json({
      success: true,
      message: 'Table created successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/tables/:id - Update table info
exports.updateTable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { table_number, capacity, status } = req.body;

    if (!table_number || typeof table_number !== 'string' || table_number.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Table number is required and must be a non-empty string',
      });
    }

    const numericCapacity = parseInt(capacity, 10);
    if (isNaN(numericCapacity) || numericCapacity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be a positive integer greater than zero',
      });
    }

    const tableStatus = status ? status.trim().toLowerCase() : 'available';
    if (!VALID_TABLE_STATUSES.includes(tableStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Permitted values are: ${VALID_TABLE_STATUSES.join(', ')}`,
      });
    }

    const updateSql = `
      UPDATE restaurant_tables
      SET table_number = $1, capacity = $2, status = $3
      WHERE table_id = $4
      RETURNING table_id, table_number, capacity, status
    `;
    const { rows } = await db.query(updateSql, [table_number.trim(), numericCapacity, tableStatus, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Table with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Table updated successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/tables/:id/status - Update table seating status
exports.updateTableStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Field "status" is required',
      });
    }

    const cleanStatus = status.trim().toLowerCase();
    if (!VALID_TABLE_STATUSES.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Permitted values are: ${VALID_TABLE_STATUSES.join(', ')}`,
      });
    }

    const patchSql = `
      UPDATE restaurant_tables
      SET status = $1
      WHERE table_id = $2
      RETURNING table_id, table_number, capacity, status
    `;
    const { rows } = await db.query(patchSql, [cleanStatus, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Table with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Table status updated to ${cleanStatus}`,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/tables/:id - Delete table
exports.deleteTable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM restaurant_tables WHERE table_id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Table with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Table with ID ${id} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

