const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
    getAllComponents,
    getComponentById,
    createComponent,
    updateComponent,
    deleteComponent,
    importComponents,
    exportComponents,
    getCategories,
    importSchematic,
    batchUpsertComponents
} = require('../controllers/componentController');

router.get('/', authenticateToken, getAllComponents);
router.get('/categories', authenticateToken, getCategories);
router.get('/export', authenticateToken, exportComponents);
router.get('/:id', authenticateToken, getComponentById);
router.post('/', authenticateToken, createComponent);
router.post('/import', authenticateToken, upload.single('file'), importComponents);
router.post('/import-schematic', authenticateToken, upload.single('file'), importSchematic);
router.post('/batch-upsert', authenticateToken, batchUpsertComponents);
router.put('/:id', authenticateToken, updateComponent);
router.delete('/:id', authenticateToken, deleteComponent);

module.exports = router;
