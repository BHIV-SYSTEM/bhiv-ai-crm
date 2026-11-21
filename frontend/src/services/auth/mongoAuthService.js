import apiClient from '../api/baseAPI';
import authAPI from '../api/authAPI';

// Updated auth service for MongoDB backend
export const authService = {
  // Sign in with email and password
  async signIn({ email, password, rememberMe = true }) {
    try {
      const response = await authAPI.login({ email, password });
      
      if (response.data?.success && response.data?.data?.token) {
        const token = response.data.data.token;
        if (rememberMe) {
          localStorage.setItem('token', token);
          sessionStorage.removeItem('token');
          localStorage.setItem('setu_remembered_email', email);
        } else {
          sessionStorage.setItem('token', token);
          localStorage.removeItem('token');
          localStorage.removeItem('setu_remembered_email');
        }
        
        return {
          user: response.data.data.user,
          session: {
            access_token: token,
            user: response.data.data.user
          }
        };
      }
      
      throw new Error(response.data?.message || 'Login failed');
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'Login failed');
    }
  },

  // Sign up (only for first admin)
  async signUp({ email, password, name, firstName, lastName }) {
    try {
      const response = await authAPI.register({
        email,
        password,
        name: name || `${firstName} ${lastName}`
      });
      
      if (response.data?.success && response.data?.data?.token) {
        localStorage.setItem('token', response.data.data.token);
        
        return {
          user: response.data.data.user,
          session: {
            access_token: response.data.data.token,
            user: response.data.data.user
          }
        };
      }
      
      throw new Error(response.data?.message || 'Registration failed');
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'Registration failed');
    }
  },

  // Sign out
  async signOut() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    return { error: null };
  },

  // Get user profile
  async getUserProfile(userId) {
    try {
      const response = await authAPI.getCurrentUser();
      return response.data?.data?.user || null;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  },

  // Get session
  async getSession() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    if (!token) {
      return { data: { session: null } };
    }

    try {
      const response = await authAPI.getCurrentUser();
      
      if (response.data?.success && response.data?.data?.user) {
        return {
          data: {
            session: {
              access_token: token,
              user: response.data.data.user
            }
          }
        };
      }
    } catch (error) {
      // Invalid token
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    }
    
    return { data: { session: null } };
  },

  // OAuth (not supported in MongoDB backend)
  async signInWithOAuth(provider) {
    throw new Error('OAuth login not supported. Please use email/password login.');
  },

  async resetPasswordForEmail(email) {
    throw new Error('Password reset not yet implemented');
  },

  async updatePassword(password) {
    throw new Error('Password update not yet implemented');
  },

  async resendVerificationEmail() {
    throw new Error('Email verification not required');
  }
};

export default authService;
