
import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const getStyles = () => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-gradient-to-r from-emerald-500 to-green-600',
                    icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    )
                };
            case 'error':
                return {
                    bg: 'bg-gradient-to-r from-red-500 to-rose-600',
                    icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )
                };
            case 'warning':
                return {
                    bg: 'bg-gradient-to-r from-amber-500 to-orange-600',
                    icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    )
                };
            case 'info':
                return {
                    bg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
                    icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )
                };
        }
    };

    const styles = getStyles();

    return (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
            <div className={`${styles.bg} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] max-w-md backdrop-blur-sm`}>
                <div className="flex-shrink-0">
                    {styles.icon}
                </div>
                <p className="flex-1 text-sm font-semibold">{message}</p>
                <button
                    onClick={onClose}
                    className="flex-shrink-0 hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Toast;
