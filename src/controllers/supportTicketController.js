const SupportTicket = require('../models/SupportTicket');

const Staff = require('../models/Staff');

// Organization Endpoints

// @desc    Create a new support ticket
// @route   POST /api/organizations/:orgId/support-tickets
// @access  Private (Org Access)
exports.createTicket = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { feature, issueName, description } = req.body;

    // Fetch staff name if possible
    let userName = 'Organization User';
    const staff = await Staff.findOne({ userId: req.user.uid, orgId });
    if (staff) {
      userName = staff.name;
    }

    const ticket = new SupportTicket({
      organization: orgId,
      createdBy: {
        _id: req.user.uid,
        name: userName,
        email: req.user.email || 'unknown@example.com'
      },
      feature,
      issueName,
      description,
      status: 'Open'
    });

    await ticket.save();

    res.status(201).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ success: false, error: { message: 'Server error creating ticket' } });
  }
};

// @desc    Get all support tickets for an organization
// @route   GET /api/organizations/:orgId/support-tickets
// @access  Private (Org Access)
exports.getOrgTickets = async (req, res) => {
  try {
    const { orgId } = req.params;

    const tickets = await SupportTicket.find({ organization: orgId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching org support tickets:', error);
    res.status(500).json({ success: false, error: { message: 'Server error fetching tickets' } });
  }
};

// @desc    Reply to a support ticket as an org user
// @route   POST /api/organizations/:orgId/support-tickets/:id/reply
// @access  Private (Org Access)
exports.replyToTicketOrg = async (req, res) => {
  try {
    const { orgId, id } = req.params;
    const { message } = req.body;

    const ticket = await SupportTicket.findOne({ _id: id, organization: orgId });

    if (!ticket) {
      return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    }

    if (ticket.status === 'Closed') {
      return res.status(400).json({ success: false, error: { message: 'Cannot reply to a closed ticket' } });
    }

    let userName = 'Organization User';
    const staff = await Staff.findOne({ userId: req.user.uid, orgId });
    if (staff) {
      userName = staff.name;
    }

    ticket.replies.push({
      message,
      senderType: 'OrganizationUser',
      user: {
        _id: req.user.uid,
        name: userName,
        email: req.user.email || 'unknown@example.com'
      }
    });

    // If a user replies and it's resolved, maybe reopen it? 
    if (ticket.status === 'Resolved') {
      ticket.status = 'Open';
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error replying to ticket:', error);
    res.status(500).json({ success: false, error: { message: 'Server error replying to ticket' } });
  }
};

// Admin Endpoints

// @desc    Get all support tickets across the platform
// @route   GET /api/admin/support-tickets
// @access  Private (System Admin)
exports.getAllTicketsAdmin = async (req, res) => {
  try {
    const { status, orgId } = req.query;
    let query = {};
    if (status) query.status = status;
    if (orgId) query.organization = orgId;

    const tickets = await SupportTicket.find(query)
      .populate('organization', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching admin tickets:', error);
    res.status(500).json({ success: false, error: { message: 'Server error fetching tickets' } });
  }
};

// @desc    Update ticket status
// @route   PATCH /api/admin/support-tickets/:id/status
// @access  Private (System Admin)
exports.updateTicketStatusAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    }

    ticket.status = status;
    await ticket.save();

    await ticket.populate('organization', 'name');

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ success: false, error: { message: 'Server error updating status' } });
  }
};

// @desc    Reply to a support ticket as a system admin
// @route   POST /api/admin/support-tickets/:id/reply
// @access  Private (System Admin)
exports.replyToTicketAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, status } = req.body;

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    }

    if (message) {
      ticket.replies.push({
        message,
        senderType: 'SystemAdmin',
        user: {
          _id: req.user.uid || 'admin',
          name: 'System Admin',
          email: req.user.email || 'support@orgplus.com'
        }
      });
    }

    if (status) {
      ticket.status = status;
    }

    await ticket.save();

    await ticket.populate('organization', 'name');

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error Admin replying to ticket:', error);
    res.status(500).json({ success: false, error: { message: 'Server error replying to ticket' } });
  }
};
