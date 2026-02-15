const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { reconcileBOM, exportMissingReport, addMissingToInventory } = require('../controllers/missingComponentsController');

// POST reconcile BOM components against inventory
router.post('/reconcile', authenticateToken, reconcileBOM);

// POST export missing components report as Excel
router.post('/export-report', authenticateToken, exportMissingReport);

// POST add missing components to inventory DB
router.post('/add-to-inventory', authenticateToken, addMissingToInventory);

module.exports = router;
