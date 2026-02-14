const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
    getDashboardSummary,
    getTopConsumed,
    getLowStockComponents,
    getConsumptionTrend,
    getProductionByPCB,
    getStockByCategory
} = require('../controllers/dashboardController');

router.get('/summary', authenticateToken, getDashboardSummary);
router.get('/top-consumed', authenticateToken, getTopConsumed);
router.get('/low-stock', authenticateToken, getLowStockComponents);
router.get('/consumption-trend', authenticateToken, getConsumptionTrend);
router.get('/production-by-pcb', authenticateToken, getProductionByPCB);
router.get('/stock-by-category', authenticateToken, getStockByCategory);

module.exports = router;
