import React from 'react';
import { Link } from 'react-router-dom';

interface HeaderProps {
    showAdminLink?: boolean;
}

const Header: React.FC<HeaderProps> = ({ showAdminLink = true }) => {
    return (
        <header className="w-full py-4 px-6 mb-2 animate-in fade-in slide-in-from-top-4 duration-1000 shrink-0">
            <div className="max-w-[1600px] mx-auto flex justify-between items-center gap-4">
                {/* Brand Logo Section */}
                <div className="flex items-center gap-3">
                    <div className="bg-white/80 backdrop-blur-md p-2.5 rounded-2xl shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-500">
                        <img
                            src="https://ai.loopsintegrated.co/logo/rajalogo.png"
                            alt="JewelTry AI"
                            className="h-8 md:h-10 w-auto object-contain"
                        />
                    </div>
                    <div className="hidden md:block">
                        <h1 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em] leading-none mb-1">Raja Jewellers</h1>
                        <p className="text-[8px] font-bold text-[#D4AF37] uppercase tracking-widest opacity-80">Virtual Fitting Studio</p>
                    </div>
                </div>

                {/* Status / Link Section */}
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-green-500/5 border border-green-500/10 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">AI Interface Active</span>
                    </div>

                    {showAdminLink && (
                        <Link
                            to="/admin"
                            className="text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-white transition-all bg-white border border-slate-200 hover:bg-[#561f7a] hover:border-[#561f7a] px-5 py-2.5 rounded-xl shadow-sm active:scale-95"
                        >
                            Log Portal
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
