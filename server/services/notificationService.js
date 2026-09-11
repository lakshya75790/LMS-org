const { prisma, withId } = require('../config/prismaClient');
const { emitToUser, emitToRoom } = require('../config/socket');

const formatNotification = (n) => {
  if (!n) return null;
  const transformed = withId(n);
  transformed.relatedEntity = {
    entityType: n.relatedEntityType,
    entityId: n.relatedEntityId
  };
  return transformed;
};

/**
 * Send notification to a specific user (Employee or Instructor)
 */
const sendUserNotification = async (recipientId, organizationId, role, type, title, message, relatedEntity = null, options = {}) => {
  try {
    const recId = recipientId ? String(recipientId.id || recipientId._id || recipientId) : null;
    const orgId = String(organizationId.id || organizationId._id || organizationId);

    const relType = relatedEntity?.entityType ? String(relatedEntity.entityType) : null;
    const relId = relatedEntity?.entityId ? String(relatedEntity.entityId.id || relatedEntity.entityId._id || relatedEntity.entityId) : null;

    if (options.preventDuplicates && recId) {
      const existing = await prisma.notification.findFirst({
        where: {
          recipientId: recId,
          organizationId: orgId,
          type,
          relatedEntityType: relType,
          relatedEntityId: relId
        }
      });
      if (existing) {
        return formatNotification(existing);
      }
    }

    const notification = await prisma.notification.create({
      data: {
        recipientId: recId,
        organizationId: orgId,
        role,
        type,
        title,
        message,
        relatedEntityType: relType,
        relatedEntityId: relId
      }
    });

    const formatted = formatNotification(notification);

    // Real-time emit to user room
    if (recId) {
      emitToUser(recId, 'new_notification', formatted);
    }

    return formatted;
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

/**
 * Send notification specifically to an Instructor
 */
const sendInstructorNotification = async (instructorId, organizationId, type, title, message, relatedEntity = null, options = {}) => {
  if (!instructorId) return;
  return sendUserNotification(instructorId, organizationId, 'Instructor', type, title, message, relatedEntity, options);
};

/**
 * Send aggregated notification to all Organization Admins
 */
const sendAdminNotification = async (organizationId, type, title, message, relatedEntity = null, options = {}) => {
  try {
    const orgId = String(organizationId.id || organizationId._id || organizationId);
    const admins = await prisma.user.findMany({
      where: { organizationId: orgId, role: 'Admin' }
    });

    if (admins.length > 0) {
      const relType = relatedEntity?.entityType ? String(relatedEntity.entityType) : null;
      const relId = relatedEntity?.entityId ? String(relatedEntity.entityId.id || relatedEntity.entityId._id || relatedEntity.entityId) : null;

      for (const admin of admins) {
        if (options.preventDuplicates) {
          const existing = await prisma.notification.findFirst({
            where: {
              recipientId: admin.id,
              organizationId: orgId,
              type,
              relatedEntityType: relType,
              relatedEntityId: relId
            }
          });
          if (existing) continue;
        }

        const notification = await prisma.notification.create({
          data: {
            recipientId: admin.id,
            organizationId: orgId,
            role: 'Admin',
            type,
            title,
            message,
            relatedEntityType: relType,
            relatedEntityId: relId
          }
        });

        const formatted = formatNotification(notification);
        emitToUser(admin.id, 'new_notification', formatted);
      }
    }
  } catch (error) {
    console.error('Failed to send admin notification:', error);
  }
};

module.exports = {
  sendUserNotification,
  sendInstructorNotification,
  sendAdminNotification,
  formatNotification
};
