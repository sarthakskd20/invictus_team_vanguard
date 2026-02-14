const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getAllTriggers, acknowledgeTrigger, resolveTrigger } = require('../controllers/procurementController');

router.get('/', authenticateToken, getAllTriggers);
router.put('/:id/acknowledge', authenticateToken, acknowledgeTrigger);
router.put('/:id/resolve', authenticateToken, resolveTrigger);

module.exports = router;
