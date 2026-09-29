import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white border-t border-slate-200/80 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">WASHWISE</span>
          <span>-</span>
          <span>Rajalakshmi Engineering College</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Hostels: Habitat, Thandalam, Girls</span>
          <span>-</span>
          <span>Campus Laundry Services</span>
        </div>
      </div>
    </footer>
  );
};
