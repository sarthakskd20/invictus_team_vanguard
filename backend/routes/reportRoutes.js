const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { exportInventory, exportConsumption, getTransactionHistory } = require('../controllers/reportController');

router.get('/inventory-export', authenticateToken, exportInventory);
router.get('/consumption-export', authenticateToken, exportConsumption);
router.get('/transaction-history/:componentId', authenticateToken, getTransactionHistory);

module.exports = router;
