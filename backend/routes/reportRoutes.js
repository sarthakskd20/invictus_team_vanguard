const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { exportInventory, exportConsumption, getTransactionHistory, exportBOM, exportShortageReport, exportProcurementList } = require('../controllers/reportController');

router.get('/inventory-export', authenticateToken, exportInventory);
router.get('/consumption-export', authenticateToken, exportConsumption);
router.get('/transaction-history/:componentId', authenticateToken, getTransactionHistory);
router.get('/bom-export/:pcbId', authenticateToken, exportBOM);
router.get('/shortage-report/:pcbId', authenticateToken, exportShortageReport);
router.get('/procurement-list/:pcbId', authenticateToken, exportProcurementList);

module.exports = router;

