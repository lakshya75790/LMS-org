const { prisma, withId } = require('../config/prismaClient');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Create a new Training Category
 * @route   POST /api/categories
 * @access  Private (Organization Admin)
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    if (!name) {
      throw new ApiError(400, 'Category name is required');
    }

    const existingCategory = await prisma.trainingCategory.findFirst({
      where: {
        name: name.trim(),
        organizationId: orgId
      }
    });

    if (existingCategory && existingCategory.status === 'active') {
      throw new ApiError(400, 'Training category with this name already exists in your organization');
    }

    let category;
    if (existingCategory && existingCategory.status !== 'active') {
      category = await prisma.trainingCategory.update({
        where: { id: existingCategory.id },
        data: {
          name: name.trim(),
          description: description || null,
          status: 'active',
          createdAt: new Date()
        }
      });
    } else {
      category = await prisma.trainingCategory.create({
        data: {
          name: name.trim(),
          description: description || null,
          organizationId: orgId,
          status: 'active'
        }
      });
    }

    res.status(201).json(new ApiResponse(201, { category: withId(category) }, 'Training category created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all Training Categories
 * @route   GET /api/categories
 * @access  Private (Admin, Instructor, Employee)
 */
const getCategories = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    const categories = await prisma.trainingCategory.findMany({
      where: {
        organizationId: orgId,
        status: 'active'
      },
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(new ApiResponse(200, { categories: withId(categories) }, 'Training categories retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Training Category
 * @route   PUT /api/categories/:id
 * @access  Private (Organization Admin)
 */
const updateCategory = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const catId = String(req.params.id);

    const category = await prisma.trainingCategory.findFirst({
      where: {
        id: catId,
        organizationId: orgId
      }
    });

    if (!category) {
      throw new ApiError(404, 'Training category not found');
    }

    if (name && name.trim() !== category.name) {
      const existingActive = await prisma.trainingCategory.findFirst({
        where: {
          name: name.trim(),
          organizationId: orgId,
          status: 'active',
          id: { not: category.id }
        }
      });
      if (existingActive) {
        throw new ApiError(400, 'Training category with this name already exists in your organization');
      }
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (status) updateData.status = status;

    const updatedCategory = await prisma.trainingCategory.update({
      where: { id: category.id },
      data: updateData
    });

    res.status(200).json(new ApiResponse(200, { category: withId(updatedCategory) }, 'Training category updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete/Deactivate Training Category
 * @route   DELETE /api/categories/:id
 * @access  Private (Organization Admin)
 */
const deleteCategory = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const catId = String(req.params.id);

    const category = await prisma.trainingCategory.findFirst({
      where: {
        id: catId,
        organizationId: orgId
      }
    });

    if (!category) {
      throw new ApiError(404, 'Training category not found');
    }

    await prisma.trainingCategory.update({
      where: { id: category.id },
      data: { status: 'deactivated' }
    });

    res.status(200).json(new ApiResponse(200, {}, 'Training category deactivated successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory
};
