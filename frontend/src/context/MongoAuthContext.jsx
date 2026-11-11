import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '@/services/auth/mongoAuthService';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      console.warn('Auth initialization timeout - forcing loading to false');
      setLoading(false);
    }, 5000);

    // Initialize auth from stored token
    const initializeAuth = async () => {
      try {
        const { data } = await authService.getSession();
        
        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
          setProfile(data.session.user);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      clearTimeout(safetyTimeout);
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const result = await authService.signIn({ email, password });
      
      if (result?.user && result?.session) {
        setUser(result.user);
        setSession(result.session);
        setProfile(result.user);
        
        toast.success(`Welcome back, ${result.user.name}!`);
        return result;
      }
      
      throw new Error('Login failed');
    } catch (error) {
      toast.error(error.message || 'Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async ({ email, password, name, firstName, lastName }) => {
    setLoading(true);
    try {
      const result = await authService.signUp({
        email,
        password,
        name: name || `${firstName} ${lastName}`,
        firstName,
        lastName
      });
      
      if (result?.user && result?.session) {
        setUser(result.user);
        setSession(result.session);
        setProfile(result.user);
        
        toast.success('Account created successfully!');
        return result;
      }
      
      throw new Error('Registration failed');
    } catch (error) {
      toast.error(error.message || 'Registration failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Keep API compatibility with existing auth pages/components
  // (Some pages call this `signup`, others call it `register`.)
  const signup = async ({ email, password, name, firstName, lastName, companyName }) => {
    return register({ email, password, name, firstName, lastName, companyName });
  };

  const loginWithOAuth = async (provider) => {
    setLoading(true);
    try {
      const result = await authService.signInWithOAuth(provider);
      return result;
    } catch (error) {
      toast.error(error.message || 'OAuth login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    setLoading(true);
    try {
      const result = await authService.resetPasswordForEmail(email);
      toast.success('Password reset email sent');
      return result;
    } catch (error) {
      toast.error(error.message || 'Password reset failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (password) => {
    setLoading(true);
    try {
      const result = await authService.updatePassword(password);
      toast.success('Password updated');
      return result;
    } catch (error) {
      toast.error(error.message || 'Password update failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const userProfile = await authService.getUserProfile(user?.id);
      if (userProfile) {
        setProfile(userProfile);
        setUser(userProfile);
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const updateProfile = async (data) => {
    try {
      // This would need an update endpoint in the backend
      toast.info('Profile update not yet implemented');
    } catch (error) {
      toast.error('Failed to update profile');
      throw error;
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    login,
    register,
    signup,
    loginWithOAuth,
    logout,
    refreshProfile,
    updateProfile,
    resetPassword,
    updatePassword,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    isSeller: user?.role === 'seller',
    isCustomer: user?.role === 'customer'
  };

  return (
    <AuthContext.Provider value={value}>
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

export default AuthContext;
