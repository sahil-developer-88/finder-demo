import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border-t border-white/10">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60" />
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-white/30 text-xs">&copy; {new Date().getFullYear()} BarterEx. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <button className="text-white/30 hover:text-white/60 text-xs transition-colors">Privacy Policy</button>
          <button className="text-white/30 hover:text-white/60 text-xs transition-colors">Terms of Service</button>
          <button className="text-white/30 hover:text-white/60 text-xs transition-colors">Contact</button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
