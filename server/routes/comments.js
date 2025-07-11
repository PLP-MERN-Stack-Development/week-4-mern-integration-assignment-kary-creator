const express = require('express');
const { body, validationResult, param } = require('express-validator');
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/comments/:postId - Get all comments for a post
router.get('/:postId', param('postId').isMongoId(), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const comments = await Comment.find({ post: req.params.postId }).populate('user', 'username');
    res.json(comments);
  } catch (err) {
    next(err);
  }
});

// POST /api/comments/:postId - Add a comment to a post
router.post(
  '/:postId',
  auth,
  param('postId').isMongoId(),
  body('content').isString().trim().notEmpty().withMessage('Content is required'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const comment = new Comment({
        post: req.params.postId,
        user: req.user.userId,
        content: req.body.content,
      });
      await comment.save();
      await comment.populate('user', 'username');
      res.status(201).json(comment);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/comments/:id - Delete a comment by id
router.delete('/:id', auth, param('id').isMongoId(), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    // Only allow the comment's author or an admin (not implemented) to delete
    if (comment.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await comment.deleteOne();
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router; 