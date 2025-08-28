import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ 
    username: '', 
    password: '' 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Send JSON data instead of form data
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
      alert('Login successful!');
      onLogin(response.data);
    })
    .catch(error => {
      console.error('Login error:', error);
      if (error.response) {
        // Server responded with error
        setError(`Login failed: ${error.response.data?.error || 'Invalid credentials'}`);
      } else if (error.request) {
        // Network error
        setError('Network error. Please check your connection.');
      } else {
        setError('An unexpected error occurred.');
      }
    })
    .finally(() => {
      setIsLoading(false);
    });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">📄</div>
          <h2>Sign in to your account</h2>
          <p>Document Search System</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              placeholder="Enter your username"
              value={credentials.username}
              onChange={(e) => setCredentials({...credentials, username: e.target.value})}
              disabled={isLoading}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Enter your password"
              value={credentials.password}
              onChange={(e) => setCredentials({...credentials, password: e.target.value})}
              disabled={isLoading}
              required
            />
          </div>
          
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}
          
          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="login-footer">
          <p>Need help? Contact your administrator</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
