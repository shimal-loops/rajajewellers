
import React, { useEffect } from 'react';

interface ImageModalProps {
    isOpen: boolean;
    imageUrl: string;
    imageName: string;
    onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, imageUrl, imageName, onClose }) => {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            />
            <div className="relative max-w-5xl w-full max-h-[90vh] animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-all backdrop-blur-sm"
                    title="Close (ESC)"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div className="bg-white rounded-3xl p-4 shadow-2xl">
                    <img
                        src={imageUrl}
                        alt={imageName}
                        className="w-full h-full object-contain max-h-[80vh] rounded-2xl"
                    />
                    <p className="text-center text-sm font-bold text-slate-700 mt-4">{imageName}</p>
                </div>
            </div>
        </div>
    );
};

export default ImageModal;
