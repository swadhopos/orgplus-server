const express = require('express');
const {
  getAllTicketsAdmin,
  updateTicketStatusAdmin,
  replyToTicketAdmin
} = require('../controllers/supportTicketController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');

const router = express.Router();

// Allow CORS preflight to pass through without auth
router.options('*', (req, res) => res.sendStatus(204));

router.use(authenticateToken);
router.use(requireRole('systemAdmin'));

router.route('/')
  .get(getAllTicketsAdmin);

router.route('/:id/status')
  .patch(updateTicketStatusAdmin);

router.route('/:id/reply')
  .post(replyToTicketAdmin);

module.exports = router;
