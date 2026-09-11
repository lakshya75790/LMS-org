import React, { createContext, useContext, useState, useEffect } from 'react';
import { getNotifications as fetchNotificationsApi, markNotificationRead, markAllNotificationsRead } from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [serverUnreadCount, setServerUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  // Compute unreadCount dynamically from notifications state to prevent count inflation or stale drift
  const unreadCount = (notifications.length >= 50 && serverUnreadCount > notifications.filter(n => !n.isRead).length)
    ? serverUnreadCount
    : notifications.filter(n => !n.isRead).length;

  const loadNotifications = async () => {
    if (!user || user.role === 'SuperAdmin') {
      setNotifications([]);
      setServerUnreadCount(0);
      return;
    }
    try {
      const res = await fetchNotificationsApi();
      if (res.data && res.data.data) {
        const notifsList = res.data.data.notifications || [];
        setNotifications(notifsList);
        setServerUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'SuperAdmin') {
      loadNotifications();
    } else {
      setNotifications([]);
      setServerUnreadCount(0);
    }
  }, [user?.id, user?.role]);

  // Real-time listener for Socket.IO notifications
  useEffect(() => {
    if (!socket || !user || user.role === 'SuperAdmin') return;

    const handleNewNotification = (newNotif) => {
      if (!newNotif) return;
      const notifId = newNotif.id || newNotif._id;
      
      setNotifications(prev => {
        if (notifId && prev.some(n => (n.id === notifId || n._id === notifId))) {
          return prev;
        }
        return [newNotif, ...prev];
      });
      setServerUnreadCount(count => count + 1);
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket, user]);

  const addToast = (type, message, title = '') => {
    if (!message) return;
    const cleanMsg = String(message).trim();
    const cleanTitle = String(title).trim();

    setToasts(prev => {
      const now = Date.now();
      // Suppress duplicate toasts with identical title and message triggered within 3 seconds
      const isDuplicate = prev.some(
        t => t.title === cleanTitle && t.message === cleanMsg && (now - t.id < 3000)
      );
      if (isDuplicate) return prev;

      const id = now;
      setTimeout(() => {
        removeToast(id);
      }, 5000);

      return [...prev, { id, type, message: cleanMsg, title: cleanTitle }];
    });
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const markAsRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => (n.id === id || n._id === id) ? { ...n, isRead: true } : n));
      setServerUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setServerUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        addToast,
        removeToast,
        markAsRead,
        markAllRead,
        refreshNotifications: loadNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
