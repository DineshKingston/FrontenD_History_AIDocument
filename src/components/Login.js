// src/components/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const Login = ({ onLogin, onSwitchToRegister }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const loginData = {
      username: credentials.username,
      password: credentials.password
    };

    axios.post(`${API_BASE_URL}/api/auth/login`, loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      console.log('Login response:', response.data);
      onLogin(response.data);
      navigate('/dashboard');
    })
    .catch(error => {
      console.error('Login error:', error);
      if (error.response) {
        setError(`Login failed: ${error.response.data?.error || 'Invalid credentials'}`);
      } else if (error.request) {
        setError('Network error. Please check your connection.');
      } else {
        setError('An unexpected error occurred.');
      }
    })
    .finally(() => {
      setIsLoading(false);
    });
  };

  const handleChange = (e) => {
    setCredentials(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const switchToRegister = () => {
    navigate('/register');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            📄
          </div>
          <h2>Welcome Back</h2>
          <p>Sign in to your account</p>
        </div>

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
              autoComplete="current-password"
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
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <span>
            Don't have an account?{' '}
            <button
              type="button"
              className="link-button"
              onClick={switchToRegister}
              disabled={isLoading}
            >
              Create Account
            </button>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Login;
