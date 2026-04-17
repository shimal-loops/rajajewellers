
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

const AdminLogin: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/rajaJewellers/api/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const text = await response.text();
            try {
                const data = JSON.parse(text);
                if (response.ok) {
                    window.location.href = '/rajaJewellers/admin';
                } else {
                    setError(data.message || 'Login failed');
                }
            } catch (jsonErr) {
                console.error("Login API Error:", text.substring(0, 100));
                setError("An unexpected error occurred.");
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/rajaJewellers/api/google_login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: credentialResponse.credential })
            });

            const data = await response.json();
            if (response.ok) {
                window.location.href = '/rajaJewellers/admin';
            } else {
                setError(data.message || 'Google Login failed');
            }
        } catch (err) {
            console.error("Google Login Error:", err);
            setError('An error occurred during Google Login.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-700">
                <div className="p-10">
                    <div className="flex justify-center mb-8">
                        <img
                            src="https://ai.loopsintegrated.co/logo/rajalogo.png"
                            alt="Logo"
                            className="h-16 object-contain"
                        />
                    </div>

                    <div className="text-center mb-10">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Manager Access</h1>
                        <p className="text-slate-500 text-sm">Sign in to manage jewelry registry</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-xs font-bold animate-shake">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] transition-all"
                                placeholder="Enter username"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-[var(--brand-primary)] to-[#7a2cb1] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {isLoading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    Authenticate
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </span>
                            )}
                        </button>

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-200"></span>
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black">
                                <span className="bg-white px-4 text-slate-400">Or continue with</span>
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setError('Google Login Failed')}
                                useOneTap
                                theme="outline"
                                shape="pill"
                                size="large"
                                width="100%"
                            />
                        </div>
                    </form>
                </div>

                <div className="bg-slate-50 px-10 py-6 border-t border-slate-100 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RAJA JEWELLERS AI</p>
                    <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
