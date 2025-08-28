// src/App.js
import React, { useState, useEffect } from 'react';
import AppRouter from './components/AppRouter';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    const checkExistingSession = () => {
      try {
        const savedUser = localStorage.getItem('user');
        const savedAuth = localStorage.getItem('isAuthenticated');
        
        if (savedUser && savedAuth === 'true') {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setIsLoggedIn(true);
          console.log('✅ Restored user session:', userData.username);
        } else {
          console.log('ℹ️ No existing session found');
        }
      } catch (error) {
        console.error('❌ Error restoring session:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  const handleLogin = (userData) => {
    try {
      setIsLoggedIn(true);
      setUser(userData || { username: 'User' });
      
      localStorage.setItem('user', JSON.stringify(userData || { username: 'User' }));
      localStorage.setItem('isAuthenticated', 'true');
      
      console.log('✅ User logged in and session saved');
    } catch (error) {
      console.error('❌ Error saving session:', error);
    }
  };

  const handleLogout = () => {
    try {
      setIsLoggedIn(false);
      setUser(null);
      
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      
      console.log('✅ User logged out and session cleared');
    } catch (error) {
      console.error('❌ Error clearing session:', error);
    }
  };

  const switchToRegister = () => {
    window.location.href = '/register';
  };

  const switchToLogin = () => {
    window.location.href = '/login';
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <AppRouter
        isAuthenticated={isLoggedIn}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSwitchToRegister={switchToRegister}
        onSwitchToLogin={switchToLogin}
      />
    </div>
  );
}

export default App;
