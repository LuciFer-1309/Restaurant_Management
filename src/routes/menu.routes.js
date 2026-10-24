const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menu.controller');

router.get('/', menuController.getAllMenuItems);
router.get('/:id', menuController.getMenuItemById);
router.post('/', menuController.createMenuItem);
router.put('/:id', menuController.updateMenuItem);
router.patch('/:id/availability', menuController.updateMenuAvailability);
router.delete('/:id', menuController.deleteMenuItem);

module.exports = router;

