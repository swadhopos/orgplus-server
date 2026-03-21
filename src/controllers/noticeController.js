const Notice = require('../models/Notice');
const storage = require('../services/storage');
const audienceResolver = require('../services/audienceResolver');
const fcmService = require('../services/fcmService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// ─── List Notices ──────────────────────────────────────────────────────────────
exports.listNotices = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { organizationId: orgId, isDeleted: false };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notices, total] = await Promise.all([
      Notice.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notice.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: notices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    logger.error('[NoticeController] listNotices error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch notices' } });
  }
};

// ─── Get Single Notice ─────────────────────────────────────────────────────────
exports.getNotice = async (req, res) => {
  try {
    const { orgId, id } = req.params;
    const notice = await Notice.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
    if (!notice) return res.status(404).json({ success: false, error: { message: 'Notice not found' } });
    res.json({ success: true, data: notice });
  } catch (err) {
    logger.error('[NoticeController] getNotice error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch notice' } });
  }
};

// ─── Create Notice (Draft) ─────────────────────────────────────────────────────
exports.createNotice = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { title, body, audienceType = 'all', targetIds = [] } = req.body;
    const userId = req.user.uid;

    let imageUrl = null;
    let imageKey = null;

    if (req.file) {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const key = `notices/${orgId}/${uuidv4()}${ext}`;
      const result = await storage.upload(req.file.buffer, key, req.file.mimetype);
      imageUrl = result.url;
      imageKey = result.key;
    }

    const notice = await Notice.create({
      organizationId: orgId,
      title,
      body,
      imageUrl,
      imageKey,
      audienceType,
      targetIds: Array.isArray(targetIds) ? targetIds : JSON.parse(targetIds || '[]'),
      createdByUserId: userId,
    });

    res.status(201).json({ success: true, data: notice });
  } catch (err) {
    logger.error('[NoticeController] createNotice error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to create notice' } });
  }
};

// ─── Update Notice ─────────────────────────────────────────────────────────────
exports.updateNotice = async (req, res) => {
  try {
    const { orgId, id } = req.params;
    const { title, body, audienceType, targetIds } = req.body;

    const notice = await Notice.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!notice) return res.status(404).json({ success: false, error: { message: 'Notice not found' } });

    if (notice.status === 'published') {
      return res.status(400).json({ success: false, error: { message: 'Published notices cannot be edited. Archive it first.' } });
    }

    if (title) notice.title = title;
    if (body) notice.body = body;
    if (audienceType) notice.audienceType = audienceType;
    if (targetIds) notice.targetIds = Array.isArray(targetIds) ? targetIds : JSON.parse(targetIds || '[]');

    // Handle new image upload
    if (req.file) {
      // Delete old image if exists
      if (notice.imageKey) {
        await storage.delete(notice.imageKey).catch(err => logger.warn('[Notice] Old image delete failed:', err));
      }
      const ext = path.extname(req.file.originalname) || '.jpg';
      const key = `notices/${orgId}/${uuidv4()}${ext}`;
      const result = await storage.upload(req.file.buffer, key, req.file.mimetype);
      notice.imageUrl = result.url;
      notice.imageKey = result.key;
    }

    await notice.save();
    res.json({ success: true, data: notice });
  } catch (err) {
    logger.error('[NoticeController] updateNotice error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to update notice' } });
  }
};

// ─── Publish Notice + Send FCM ─────────────────────────────────────────────────
exports.publishNotice = async (req, res) => {
  try {
    const { orgId, id } = req.params;

    const notice = await Notice.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!notice) return res.status(404).json({ success: false, error: { message: 'Notice not found' } });

    if (notice.status === 'published') {
      return res.status(400).json({ success: false, error: { message: 'Notice is already published' } });
    }

    // Update status first (fast response to client)
    notice.status = 'published';
    notice.publishedAt = new Date();
    await notice.save();

    res.json({ success: true, data: notice, message: 'Notice published. Push notifications are being sent.' });

    // Send FCM asynchronously (don't block the response)
    setImmediate(async () => {
      try {
        const resolved = await audienceResolver.resolve(orgId, notice.audienceType, notice.targetIds);
        const fcmData = {
          noticeId: notice._id.toString(),
          link: `/notices/${notice._id}`,
        };

        if (resolved.type === 'topic') {
          await fcmService.sendToTopic(resolved.topic, notice.title, notice.body, fcmData);
        } else {
          await fcmService.sendToTokens(
            resolved.tokens,
            notice.title,
            notice.body,
            fcmData,
            resolved.tokenToMemberMap
          );
        }
      } catch (fcmErr) {
        logger.error(`[NoticeController] FCM send failed for notice ${id}:`, fcmErr);
      }
    });
  } catch (err) {
    logger.error('[NoticeController] publishNotice error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to publish notice' } });
  }
};

// ─── Archive Notice ────────────────────────────────────────────────────────────
exports.archiveNotice = async (req, res) => {
  try {
    const { orgId, id } = req.params;
    const notice = await Notice.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { status: 'archived' },
      { new: true }
    );
    if (!notice) return res.status(404).json({ success: false, error: { message: 'Notice not found' } });
    res.json({ success: true, data: notice });
  } catch (err) {
    logger.error('[NoticeController] archiveNotice error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to archive notice' } });
  }
};

// ─── Delete Notice (Soft) ──────────────────────────────────────────────────────
exports.deleteNotice = async (req, res) => {
  try {
    const { orgId, id } = req.params;
    const userId = req.user.uid;

    const notice = await Notice.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!notice) return res.status(404).json({ success: false, error: { message: 'Notice not found' } });

    notice.isDeleted = true;
    notice.deletedAt = new Date();
    notice.deletedByUserId = userId;
    await notice.save();

    // Delete image from storage if present
    if (notice.imageKey) {
      await storage.delete(notice.imageKey).catch(err => logger.warn('[Notice] Image delete on soft-delete failed:', err));
    }

    res.json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    logger.error('[NoticeController] deleteNotice error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to delete notice' } });
  }
};
