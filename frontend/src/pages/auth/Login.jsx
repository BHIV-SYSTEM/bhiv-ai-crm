import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Loader2, AlertCircle, Info } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import Button from '../../components/common/ui/Button';
import Input from '../../components/common/forms/Input';
import SocialLogin from '../../components/auth/SocialLogin';
import Alert from '../../components/common/ui/Alert';
import { useAuth } from '../../context/MongoAuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithOAuth } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password);
      const role = result?.user?.role;
      navigate(role === 'customer' ? '/customer-portal' : '/');
    } catch (err) {
      console.error('Login error:', err);
      
      // Check for specific error messages
      if (err.message?.includes('Email not confirmed')) {
        setError('Please verify your email address. Check your inbox for the confirmation link.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(err.message || 'An error occurred during login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithOAuth('google');
    } catch (err) {
      setError('Google login failed. Please try again.');
    }
  };

  const handleGitHubLogin = async () => {
    try {
      await loginWithOAuth('github');
    } catch (err) {
      setError('GitHub login failed. Please try again.');
    }
  };

  if (showSplash) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow-primary mx-auto">
            <Loader2 className="h-8 w-8 text-primary-foreground animate-spin" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight text-white">
              SETU
            </h1>
            <p className="mt-3 text-base md:text-lg text-slate-300">
              Preparing your intelligent logistics workspace&hellip;
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Optimizing dashboards, agents, and workflows. This will only take a moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthLayout
      title="Welcome Back!"
      subtitle="Sign in to access your AI-powered logistics dashboard"
    >
      <div className="space-y-6">
        <div className="text-center lg:text-left">
          <h2 className="text-2xl font-heading font-bold tracking-tight">
            Sign in to your account
          </h2>
          <p className="text-muted-foreground mt-2">
            Enter your credentials to continue
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                className="pl-10"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                className="pl-10 pr-10"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm">
                Remember me
              </label>
            </div>

            <Link
              to="/auth/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full gradient-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <SocialLogin
          onGoogleLogin={handleGoogleLogin}
          onGitHubLogin={handleGitHubLogin}
        />

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              to="/auth/signup"
              className="text-primary hover:underline font-medium"
            >
              Create one now
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;
