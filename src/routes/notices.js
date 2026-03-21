const express = require('express');
const multer = require('multer');
const router = express.Router({ mergeParams: true });
const noticeController = require('../controllers/noticeController');
const { authenticateToken } = require('../middleware/auth');

// Multer: store in memory, 5MB limit, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// GET  /notices              — list notices (paginated)
// POST /notices              — create notice (draft)
router.route('/')
  .get(noticeController.listNotices)
  .post(upload.single('image'), noticeController.createNotice);

// GET    /notices/:id         — get single notice
// PUT    /notices/:id         — update notice
// DELETE /notices/:id         — soft delete notice
router.route('/:id')
  .get(noticeController.getNotice)
  .put(upload.single('image'), noticeController.updateNotice)
  .delete(noticeController.deleteNotice);

// PATCH /notices/:id/publish  — publish notice + send FCM
router.patch('/:id/publish', noticeController.publishNotice);

// PATCH /notices/:id/archive  — archive notice
router.patch('/:id/archive', noticeController.archiveNotice);

module.exports = router;
