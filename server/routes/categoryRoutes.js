const express = require('express');
const router = express.Router();
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(protect);

router.route('/')
  .get(getCategories)
  .post(authorizeRoles('Admin'), createCategory);

router.route('/:id')
  .put(authorizeRoles('Admin'), updateCategory)
  .delete(authorizeRoles('Admin'), deleteCategory);

module.exports = router;
