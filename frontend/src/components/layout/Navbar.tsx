import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Bell, User as UserIcon, LogOut, ShieldCheck, PlusCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Logo & Brand */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center text-white shadow-sm shadow-brand-700/30">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">
              Charge<span className="text-brand-700">Neighbor</span>
            </span>
            <div className="text-[10px] text-slate-500 font-medium tracking-tight -mt-1 hidden sm:block">
              Charge Smarter. Together.
            </div>
          </div>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600">
          <Link to="/" className="hover:text-brand-700 transition">Find Chargers</Link>
          <Link to="/host/add" className="hover:text-brand-700 transition">Become a Host</Link>
          <Link to="/how-it-works" className="hover:text-brand-700 transition">How It Works</Link>
          {user && (
            <Link to="/bookings" className="hover:text-brand-700 transition">My Bookings</Link>
          )}
        </nav>

        {/* Right: Auth & Profile */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link 
                to="/host/add"
                className="hidden sm:inline-flex items-center gap-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold py-2 px-3 rounded-lg border border-brand-200 transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>List Charger</span>
              </Link>

              {user.roles.includes('host') && (
                <Link
                  to="/host/dashboard"
                  className="hidden md:inline-flex text-xs font-semibold text-slate-600 hover:text-brand-700 transition"
                >
                  Host Portal
                </Link>
              )}

              {user.roles.includes('admin') && (
                <Link
                  to="/admin"
                  className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-200 transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </Link>
              )}

              <div className="h-6 w-px bg-slate-200 mx-1"></div>

              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 leading-none">{user.name}</div>
                  <div className="text-[10px] text-brand-700 font-semibold mt-0.5">Level {user.verification_level} Verified</div>
                </div>
                <button
                  onClick={() => { logout(); navigate('/'); }}
                  title="Sign out"
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-700 hover:text-brand-700 px-3 py-2 rounded-lg transition"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="text-xs font-bold bg-brand-700 hover:bg-brand-800 text-white px-4 py-2 rounded-lg shadow-sm shadow-brand-700/20 transition"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
