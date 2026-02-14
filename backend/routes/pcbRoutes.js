const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getAllPCBTypes, getPCBById, getPCBBom, createPCBType, updatePCBType, deletePCBType } = require('../controllers/pcbController');

router.get('/', authenticateToken, getAllPCBTypes);
router.get('/:id', authenticateToken, getPCBById);
router.get('/:id/bom', authenticateToken, getPCBBom);
router.post('/', authenticateToken, createPCBType);
router.put('/:id', authenticateToken, updatePCBType);
router.delete('/:id', authenticateToken, deletePCBType);

module.exports = router;
