import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, login as mockLoginService, logout as mockLogoutService, switchRole as mockSwitchService, ROLES } from '../services/mockAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Sync state with storage changes if any
    const syncUser = () => {
      setUser(getCurrentUser());
    };
    window.addEventListener('storage', syncUser);
    return () => window.removeEventListener('storage', syncUser);
  }, []);

  const login = (role) => {
    setLoading(true);
    const authedUser = mockLoginService(role);
    setUser(authedUser);
    setLoading(false);
    return authedUser;
  };

  const logout = () => {
    mockLogoutService();
    setUser(null);
  };

  const switchRole = (newRole) => {
    setLoading(true);
    const authedUser = mockSwitchService(newRole);
    setUser(authedUser);
    setLoading(false);
    return authedUser;
  };

  const value = {
    user,
    role: user ? user.role : null,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    switchRole,
    ROLES
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
