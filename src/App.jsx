/* eslint-disable no-unused-vars */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';

import Login from './Login';
import AdminPanel from './AdminPanel';
import TesterPanel from './TesterPanel';
import PullToRefresh from './PullToRefresh';

const PrivateRoute = ({ children, allowedRole }) => {
  const { currentUser, role, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!currentUser) return <Navigate to="/login" />;
  
  // Admin overrides or strict role checking
  if (role !== allowedRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/tester'} />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <PullToRefresh>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin/*" element={
              <PrivateRoute allowedRole="admin"><AdminPanel /></PrivateRoute>
            } />
            <Route path="/tester/*" element={
              <PrivateRoute allowedRole="tester"><TesterPanel /></PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </PullToRefresh>
    </AuthProvider>
  );
}

export default App
