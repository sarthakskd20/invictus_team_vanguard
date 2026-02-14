const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createProductionEntry, getProductionHistory, getProductionEntryDetail } = require('../controllers/productionController');

router.post('/entry', authenticateToken, createProductionEntry);
router.get('/history', authenticateToken, getProductionHistory);
router.get('/:id', authenticateToken, getProductionEntryDetail);

module.exports = router;
