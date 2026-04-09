const express = require('express');
const {
  getAllTicketsAdmin,
  updateTicketStatusAdmin,
  replyToTicketAdmin
} = require('../controllers/supportTicketController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole('systemAdmin'));

router.route('/')
  .get(getAllTicketsAdmin);

router.route('/:id/status')
  .patch(updateTicketStatusAdmin);

router.route('/:id/reply')
  .post(replyToTicketAdmin);

module.exports = router;
