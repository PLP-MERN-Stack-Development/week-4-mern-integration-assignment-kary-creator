const express = require('express');
const { body, validationResult, param } = require('express-validator');
const Post = require('../models/Post');
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
const upload = multer({ storage });

// GET /api/posts - Get all posts (with pagination, search, filter)
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) {
      query.category = category;
    }
    const [posts, total] = await Promise.all([
      Post.find(query).populate('category').skip(skip).limit(limit),
      Post.countDocuments(query),
    ]);
    res.json({ posts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/posts/:id - Get a specific post
router.get('/:id', param('id').isMongoId(), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const post = await Post.findById(req.params.id).populate('category');
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    next(err);
  }
});

// POST /api/posts - Create a new post
router.post(
  '/',
  auth,
  upload.single('featuredImage'),
  body('title').isString().trim().notEmpty().withMessage('Title is required'),
  body('content').isString().trim().notEmpty().withMessage('Content is required'),
  body('category').isMongoId().withMessage('Valid category is required'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { title, content, category } = req.body;
      const featuredImage = req.file ? `/uploads/${req.file.filename}` : '';
      const post = new Post({ title, content, category, featuredImage });
      await post.save();
      res.status(201).json(post);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/posts/:id - Update an existing post
router.put(
  '/:id',
  auth,
  upload.single('featuredImage'),
  param('id').isMongoId(),
  body('title').optional().isString().trim().notEmpty(),
  body('content').optional().isString().trim().notEmpty(),
  body('category').optional().isMongoId(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const update = req.body;
      if (req.file) {
        update.featuredImage = `/uploads/${req.file.filename}`;
      }
      const post = await Post.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!post) return res.status(404).json({ error: 'Post not found' });
      res.json(post);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/posts/:id - Delete a post
router.delete('/:id', auth, param('id').isMongoId(), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router; 