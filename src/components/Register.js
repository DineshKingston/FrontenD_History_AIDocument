// src/components/Register.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const Register = ({ onLogin, onSwitchToLogin }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Validation
    if (!credentials.username || !credentials.password || !credentials.confirmPassword) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (credentials.password !== credentials.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (credentials.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const registerData = {
        username: credentials.username,
        password: credentials.password
      };

      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registerData)
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Registration successful:', data);
        setSuccess('✅ Registration successful! Redirecting to login...');
        
        setCredentials({
          username: '',
          password: '',
          confirmPassword: ''
        });

        setTimeout(() => {
          navigate('/login');
        }, 2000);

      } else {
        setError(`Registration failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      if (error.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setCredentials(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const switchToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            📄
          </div>
          <h2>Create Account</h2>
          <p>Join the Document Search System</p>
        </div>

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              value={credentials.username}
              onChange={handleChange}
              disabled={isLoading}
              placeholder="Enter your username"
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={credentials.password}
              onChange={handleChange}
              disabled={isLoading}
              placeholder="Enter your password"
              autoComplete="new-password"
            />
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={credentials.confirmPassword}
              onChange={handleChange}
              disabled={isLoading}
              placeholder="Confirm your password"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            className="login-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="login-footer">
          <span>
            Already have an account?{' '}
            <button
              type="button"
              className="link-button"
              onClick={switchToLogin}
              disabled={isLoading}
            >
              Sign In
            </button>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Register;
