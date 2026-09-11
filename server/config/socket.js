const { Server } = require('socket.io');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    // Client emits join_room with { userId, organizationId, role }
    socket.on('join_room', (data) => {
      if (!data) return;
      const { userId, organizationId, role } = data;

      if (userId) {
        const userRoom = `user_${userId}`;
        socket.join(userRoom);
      }

      if (organizationId && role === 'Admin') {
        const adminRoom = `org_${organizationId}_Admin`;
        socket.join(adminRoom);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    console.warn('Socket.IO is not initialized yet');
  }
  return io;
};

const emitToUser = (userId, event, data) => {
  if (!io || !userId) return;
  io.to(`user_${userId}`).emit(event, data);
};

const emitToRoom = (roomName, event, data) => {
  if (!io || !roomName) return;
  io.to(roomName).emit(event, data);
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToRoom
};
