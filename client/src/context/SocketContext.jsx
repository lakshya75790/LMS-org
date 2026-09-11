import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user || user.role === 'SuperAdmin') {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Connect to backend Socket.IO server using VITE_API_URL or fallback logic
    const socketUrl = import.meta.env.VITE_API_URL || (
      window.location.origin.includes('localhost:5173')
        ? 'http://localhost:5000'
        : window.location.origin
    );

    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      const userId = user.id || user._id;
      const organizationId = user.organizationId?.id || user.organizationId?._id || user.organizationId;
      newSocket.emit('join_room', {
        userId: String(userId),
        organizationId: organizationId ? String(organizationId) : null,
        role: user.role
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
