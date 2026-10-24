const db = require('../config/db');

// GET /api/menu - List all menu items with category & availability filter
exports.getAllMenuItems = async (req, res, next) => {
  try {
    const { category, is_available, search } = req.query;
    let sql = 'SELECT menu_item_id, name, category, price, is_available, created_at FROM menu_items WHERE 1=1';
    const params = [];

    if (category && category.trim() !== '') {
      params.push(category.trim());
      sql += ` AND category ILIKE $${params.length}`;
    }

    if (is_available !== undefined && is_available !== '') {
      params.push(is_available === 'true');
      sql += ` AND is_available = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      sql += ` AND name ILIKE $${params.length}`;
    }

    sql += ' ORDER BY category ASC, name ASC';
    const { rows } = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      message: 'Menu items retrieved successfully',
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/menu/:id - Get single menu item
exports.getMenuItemById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'SELECT menu_item_id, name, category, price, is_available, created_at FROM menu_items WHERE menu_item_id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Menu item with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Menu item retrieved successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/menu - Create menu item
exports.createMenuItem = async (req, res, next) => {
  try {
    const { name, category, price, is_available } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Item name is required and must be a non-empty string',
      });
    }

    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Category is required and must be a non-empty string',
      });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number greater than zero',
      });
    }

    const available = is_available !== undefined ? Boolean(is_available) : true;

    const insertSql = `
      INSERT INTO menu_items (name, category, price, is_available)
      VALUES ($1, $2, $3, $4)
      RETURNING menu_item_id, name, category, price, is_available, created_at
    `;
    const { rows } = await db.query(insertSql, [name.trim(), category.trim(), numericPrice.toFixed(2), available]);

    return res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/menu/:id - Update menu item fully
exports.updateMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, price, is_available } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Item name is required and must be a non-empty string',
      });
    }

    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Category is required and must be a non-empty string',
      });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number greater than zero',
      });
    }

    const available = is_available !== undefined ? Boolean(is_available) : true;

    const updateSql = `
      UPDATE menu_items
      SET name = $1, category = $2, price = $3, is_available = $4
      WHERE menu_item_id = $5
      RETURNING menu_item_id, name, category, price, is_available, created_at
    `;
    const { rows } = await db.query(updateSql, [name.trim(), category.trim(), numericPrice.toFixed(2), available, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Menu item with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Menu item updated successfully',
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/menu/:id/availability - Quick toggle of item availability
exports.updateMenuAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_available } = req.body;

    if (is_available === undefined || typeof is_available !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Field is_available is required and must be a boolean (true or false)',
      });
    }

    const patchSql = `
      UPDATE menu_items
      SET is_available = $1
      WHERE menu_item_id = $2
      RETURNING menu_item_id, name, category, price, is_available, created_at
    `;
    const { rows } = await db.query(patchSql, [is_available, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Menu item with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Menu item availability updated to ${is_available}`,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/menu/:id - Delete menu item
exports.deleteMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM menu_items WHERE menu_item_id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Menu item with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Menu item with ID ${id} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

