const express = require('express');
const {
  createTicket,
  getOrgTickets,
  replyToTicketOrg
} = require('../controllers/supportTicketController');

const router = express.Router({ mergeParams: true });

router.route('/')
  .get(getOrgTickets)
  .post(createTicket);

router.route('/:id/reply')
  .post(replyToTicketOrg);

module.exports = router;
