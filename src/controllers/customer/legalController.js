const LegalContent = require('../../models/LegalContent');

/**
 * Controller to fetch legal content and FAQ for members.
 */

// Fetch Legal Content (ToS, Privacy Policy)
exports.getLegalContent = async (req, res, next) => {
  try {
    const { type } = req.params; // 'tos' or 'privacy'
    const { orgId } = req.user;

    if (!['tos', 'privacy', 'support'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid content type' });
    }

    // 1. Try to find org-specific content
    let content = await LegalContent.findOne({ 
      type, 
      organizationId: orgId, 
      isActive: true 
    }).lean();

    // 2. Fallback to global/system default if not found
    if (!content) {
      content = await LegalContent.findOne({ 
        type, 
        organizationId: null, 
        isActive: true 
      }).lean();
    }

    if (!content) {
      return res.status(404).json({ success: false, message: `${type} not found` });
    }

    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    next(error);
  }
};

// Fetch FAQs
exports.getFAQs = async (req, res, next) => {
  try {
    const { orgId } = req.user;

    // Load org-specific FAQs or global ones
    // We prioritize org-specific if they exist, or just show all relevant ones
    
    // For now, let's just fetch all active FAQs from either the org or global default
    const faqs = await LegalContent.find({ 
      type: 'faq', 
      $or: [
        { organizationId: orgId },
        { organizationId: null }
      ],
      isActive: true 
    })
    .sort({ organizationId: -1, createdAt: 1 }) // Org specific first
    .lean();

    res.json({
      success: true,
      data: faqs
    });
  } catch (error) {
    next(error);
  }
};
