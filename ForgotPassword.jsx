import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './src/firebase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return setError('Please enter your email address');
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setMessage('Password reset email sent! Redirecting to login...');
      setEmail('');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg border border-gray-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-gray-900">
            Reset Password
          </h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm text-center">
            {error}
          </div>
        )}
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm text-center">
          {message}
        </div>
      )}

      <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
        <div>
          <label className="block text-sm font-medium text-gray-700">Enter your email address</label>
          <input
            type="email"
            required
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70">
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
        <div className="text-center">
          <Link to="/login" className="text-sm font-medium text-gray-500 hover:text-gray-900">Back to log in</Link>
        </div>
      </form>
      </div>
    </div>
  );
}