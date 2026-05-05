import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';

import Login from './Login';
import AdminPanel from './AdminPanel';
import TesterPanel from './TesterPanel';

const PrivateRoute = ({ children, allowedRole }) => {
  const { currentUser, role, loading } = useAuth();
  
  React.useEffect(() => {
    console.log(`[Auth Diagnostic] Loading: ${loading}, User: ${currentUser?.email || 'none'}, Role: ${role || 'none'}`);
    if (loading) {
      const timer = setTimeout(() => {
        console.error('[Auth Timeout] App is stuck on the loading screen for more than 5 seconds! Check your internet connection or Firebase Auth initialization.');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [loading, currentUser, role]);

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
    </AuthProvider>
  );
}

export default App
