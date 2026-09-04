import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { 
  loginUser, 
  logoutUser, 
  fetchCurrentUser, 
  getStoredUser, 
  fetchDemoUsers, 
  DemoUsersResponse 
} from '../services/auth';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  demoUsers: DemoUsersResponse | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (roleName: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [demoUsers, setDemoUsers] = useState<DemoUsersResponse | null>(null);

  useEffect(() => {
    // Fetch available demo roles and credentials
    fetchDemoUsers()
      .then(setDemoUsers)
      .catch((err) => console.warn('Demo users fetch error:', err));

    // Verify token validity if stored
    const token = localStorage.getItem('chainstate_token');
    if (token) {
      fetchCurrentUser()
        .then(setUser)
        .catch(() => {
          logoutUser();
          setUser(null);
        });
    } else {
      // If no user logged in, default to Security Reviewer for smooth demo
      loginUser('security@chainstate.io', 'ChainState2026!')
        .then((res) => setUser(res.user))
        .catch(() => console.info('Initial local demo login fallback'));
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await loginUser(email, password);
    setUser(res.user);
  };

  const logout = () => {
    logoutUser();
    setUser(null);
  };

  const switchRole = async (targetRole: UserRole) => {
    if (!demoUsers) return;
    const target = demoUsers.roles.find(r => r.role === targetRole);
    if (target) {
      await login(target.email, demoUsers.default_password);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isAuthenticated: !!user,
        demoUsers,
        login,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
