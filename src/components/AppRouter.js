// src/components/AppRouter.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';

// Private Route Component
function PrivateRoute({ isAuthenticated, children }) {
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Auth Route Component 
function AuthRoute({ isAuthenticated, children }) {
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
}

const AppRouter = ({ 
  isAuthenticated, 
  user, 
  onLogin, 
  onLogout, 
  onSwitchToRegister, 
  onSwitchToLogin 
}) => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login Route */}
        <Route 
          path="/login" 
          element={
            <AuthRoute isAuthenticated={isAuthenticated}>
              <Login onLogin={onLogin} onSwitchToRegister={onSwitchToRegister} />
            </AuthRoute>
          } 
        />

        {/* Register Route */}
        <Route 
          path="/register" 
          element={
            <AuthRoute isAuthenticated={isAuthenticated}>
              <Register onLogin={onLogin} onSwitchToLogin={onSwitchToLogin} />
            </AuthRoute>
          } 
        />

        {/* Protected Dashboard Route */}
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Dashboard user={user} onLogout={onLogout} />
            </PrivateRoute>
          } 
        />

        {/* Root Route */}
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
        />

        {/* Catch All Route */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
