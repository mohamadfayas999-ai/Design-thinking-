import React from 'react';
import { Link } from 'react-router-dom';
import { Droplets, Home } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-water-50 text-water-600 flex items-center justify-center mb-4 border border-water-200">
        <Droplets className="w-7 h-7" />
      </div>
      <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">404</h1>
      <h2 className="text-lg font-bold text-slate-700 mt-2">Page Not Found</h2>
      <p className="text-sm text-slate-500 mt-1 max-w-sm mb-6">
        The requested laundry portal page does not exist or has been moved.
      </p>
      <Link to="/">
        <Button variant="primary" icon={<Home className="w-4 h-4" />}>
          Back to Homepage
        </Button>
      </Link>
    </div>
  );
};
