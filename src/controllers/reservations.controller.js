const db = require('../config/db');

const VALID_RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];

// GET /api/reservations - List all reservations with join to customer & table
exports.getAllReservations = async (req, res, next) => {
  try {
    const { status, date } = req.query;
    let sql = `
      SELECT 
        r.reservation_id,
        r.customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        r.table_id,
        t.table_number,
        r.reservation_time,
        r.party_size,
        r.status,
        r.created_at
      FROM reservations r
      INNER JOIN customers c ON r.customer_id = c.customer_id
      LEFT JOIN restaurant_tables t ON r.table_id = t.table_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status.trim() !== '') {
      params.push(status.trim().toLowerCase());
      sql += ` AND r.status = $${params.length}`;
    }

    if (date && date.trim() !== '') {
      params.push(date.trim());
      sql += ` AND DATE(r.reservation_time) = $${params.length}`;
    }

    sql += ' ORDER BY r.reservation_time ASC';
    const { rows } = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      message: 'Reservations retrieved successfully',
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reservations/:id - Get single reservation
exports.getReservationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        r.reservation_id,
        r.customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        r.table_id,
        t.table_number,
        t.capacity AS table_capacity,
        r.reservation_time,
        r.party_size,
        r.status,
        r.created_at
      FROM reservations r
      INNER JOIN customers c ON r.customer_id = c.customer_id
      LEFT JOIN restaurant_tables t ON r.table_id = t.table_id
      WHERE r.reservation_id = $1
    `;
    const { rows } = await db.query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Reservation with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reservation retrieved successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/reservations - Create new reservation
exports.createReservation = async (req, res, next) => {
  try {
    const { customer_id, table_id, reservation_time, party_size, status } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: 'customer_id is required',
      });
    }

    if (!reservation_time) {
      return res.status(400).json({
        success: false,
        message: 'reservation_time is required (ISO timestamp e.g. 2026-10-24 19:30:00)',
      });
    }

    const parsedDate = new Date(reservation_time);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reservation_time format. Please provide a valid timestamp.',
      });
    }

    const numericPartySize = parseInt(party_size, 10);
    if (isNaN(numericPartySize) || numericPartySize <= 0) {
      return res.status(400).json({
        success: false,
        message: 'party_size must be a positive integer greater than zero',
      });
    }

    const resStatus = status ? status.trim().toLowerCase() : 'pending';
    if (!VALID_RESERVATION_STATUSES.includes(resStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Permitted values are: ${VALID_RESERVATION_STATUSES.join(', ')}`,
      });
    }

    // Verify customer exists
    const customerCheck = await db.query('SELECT customer_id FROM customers WHERE customer_id = $1', [customer_id]);
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${customer_id} does not exist`,
      });
    }

    // If table_id provided, verify table exists
    if (table_id) {
      const tableCheck = await db.query('SELECT table_id, capacity FROM restaurant_tables WHERE table_id = $1', [table_id]);
      if (tableCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Table with ID ${table_id} does not exist`,
        });
      }
    }

    const insertSql = `
      INSERT INTO reservations (customer_id, table_id, reservation_time, party_size, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING reservation_id, customer_id, table_id, reservation_time, party_size, status, created_at
    `;
    const { rows } = await db.query(insertSql, [
      customer_id,
      table_id || null,
      reservation_time,
      numericPartySize,
      resStatus,
    ]);

    return res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/reservations/:id - Update reservation
exports.updateReservation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { customer_id, table_id, reservation_time, party_size, status } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: 'customer_id is required',
      });
    }

    if (!reservation_time) {
      return res.status(400).json({
        success: false,
        message: 'reservation_time is required',
      });
    }

    const numericPartySize = parseInt(party_size, 10);
    if (isNaN(numericPartySize) || numericPartySize <= 0) {
      return res.status(400).json({
        success: false,
        message: 'party_size must be a positive integer greater than zero',
      });
    }

    const resStatus = status ? status.trim().toLowerCase() : 'pending';
    if (!VALID_RESERVATION_STATUSES.includes(resStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Permitted values are: ${VALID_RESERVATION_STATUSES.join(', ')}`,
      });
    }

    const updateSql = `
      UPDATE reservations
      SET customer_id = $1, table_id = $2, reservation_time = $3, party_size = $4, status = $5
      WHERE reservation_id = $6
      RETURNING reservation_id, customer_id, table_id, reservation_time, party_size, status, created_at
    `;
    const { rows } = await db.query(updateSql, [
      customer_id,
      table_id || null,
      reservation_time,
      numericPartySize,
      resStatus,
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Reservation with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reservation updated successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/reservations/:id/status - Update reservation status
exports.updateReservationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Field "status" is required',
      });
    }

    const cleanStatus = status.trim().toLowerCase();
    if (!VALID_RESERVATION_STATUSES.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Permitted values are: ${VALID_RESERVATION_STATUSES.join(', ')}`,
      });
    }

    const patchSql = `
      UPDATE reservations
      SET status = $1
      WHERE reservation_id = $2
      RETURNING reservation_id, customer_id, table_id, reservation_time, party_size, status, created_at
    `;
    const { rows } = await db.query(patchSql, [cleanStatus, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Reservation with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Reservation status updated to ${cleanStatus}`,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/reservations/:id - Delete reservation
exports.deleteReservation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM reservations WHERE reservation_id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Reservation with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Reservation with ID ${id} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

