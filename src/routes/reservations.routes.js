const express = require('express');
const router = express.Router();
const reservationsController = require('../controllers/reservations.controller');

router.get('/', reservationsController.getAllReservations);
router.get('/:id', reservationsController.getReservationById);
router.post('/', reservationsController.createReservation);
router.put('/:id', reservationsController.updateReservation);
router.patch('/:id/status', reservationsController.updateReservationStatus);
router.delete('/:id', reservationsController.deleteReservation);

module.exports = router;

