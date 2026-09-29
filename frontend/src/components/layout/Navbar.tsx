import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Droplets, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-water-700 to-water-500 text-white flex items-center justify-center shadow-sm group-hover:shadow transition-shadow">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-slate-900 tracking-tight">WASHWISE</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-water-50 text-water-700 border border-water-200">
                REC
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Campus Laundry Management
            </p>
          </div>
        </Link>

        {/* Right side navigation / user state */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-bold text-slate-800">{user.name}</span>
                <span className="text-[11px] text-slate-500">
                  {user.role} {user.hostelName ? `(${user.hostelName})` : ''}
                </span>
              </div>

              <Badge
                variant={
                  user.role === 'ADMIN' ? 'red' : user.role === 'STAFF' ? 'amber' : 'water'
                }
                size="sm"
                icon={
                  user.role === 'ADMIN' ? (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )
                }
              >
                {user.role}
              </Badge>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 hover:bg-red-50 transition-colors"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 hidden md:inline">
                Rajalakshmi Engineering College
              </span>
              <span className="h-4 w-px bg-slate-200 hidden md:inline" />
              <Link
                to="/"
                className="text-xs font-semibold text-water-700 hover:text-water-800 transition-colors px-2.5 py-1.5 rounded-md hover:bg-water-50"
              >
                Hostel Laundry Portal
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
