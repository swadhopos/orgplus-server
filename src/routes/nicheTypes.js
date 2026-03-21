const express = require('express');
const router = express.Router();
const nicheTypeController = require('../controllers/nicheTypeController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');

// All routes require authentication
router.use(authenticateToken);

// List all niche types (authenticated users)
router.get('/', nicheTypeController.listNicheTypes);

// CRUD for Super Admin only
router.post('/', requireRole('systemAdmin'), nicheTypeController.createNicheType);
router.put('/:key', requireRole('systemAdmin'), nicheTypeController.updateNicheType);
router.patch('/:key/status', requireRole('systemAdmin'), nicheTypeController.toggleNicheStatus);

module.exports = router;
