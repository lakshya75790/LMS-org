import React, { createContext, useContext, useState } from 'react';

const FocusContext = createContext();

export const FocusProvider = ({ children }) => {
  const [isFocusMode, setIsFocusMode] = useState(false);

  return (
    <FocusContext.Provider value={{ isFocusMode, setIsFocusMode }}>
      {children}
    </FocusContext.Provider>
  );
};

export const useFocusMode = () => {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocusMode must be used within a FocusProvider');
  }
  return context;
};
