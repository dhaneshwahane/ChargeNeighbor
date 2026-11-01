import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Zap, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const res = await axios.post(`${API_BASE}/api/v1/auth/login`, { email, password });
      login(res.data.access_token, res.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center text-white mx-auto mb-3 shadow-sm">
            <Zap className="w-6 h-6 fill-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Sign In to ChargeNeighbor</h2>
          <p className="text-xs text-slate-500 mt-1">Book neighborhood charging or manage your host slots.</p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-red-700 text-xs font-semibold mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs py-3 rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Fast Logins */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
            Quick Pilot Demo Accounts
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { setEmail('driver@chargeneighbor.com'); setPassword('password123'); }}
              className="text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-lg border border-slate-200 transition"
            >
              Driver
            </button>
            <button
              onClick={() => { setEmail('host@chargeneighbor.com'); setPassword('password123'); }}
              className="text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-lg border border-slate-200 transition"
            >
              Host
            </button>
            <button
              onClick={() => { setEmail('admin@chargeneighbor.com'); setPassword('admin123'); }}
              className="text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-lg border border-slate-200 transition"
            >
              Admin
            </button>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-slate-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-700 font-bold hover:underline">
            Sign Up
          </Link>
        </div>

      </div>
    </div>
  );
};
