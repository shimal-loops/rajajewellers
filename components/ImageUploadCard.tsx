
import React, { useState } from 'react';
import { ImageData } from '../types';
import CameraView from './CameraView';

interface ImageUploadCardProps {
  label: string;
  description: string;
  image: ImageData | null;
  onImageChange: (image: ImageData | null) => void;
  icon: React.ReactNode;
  className?: string;
  showCamera?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
  enforceAspect?: number;
}

const ImageUploadCard: React.FC<ImageUploadCardProps> = ({
  label,
  description,
  image,
  onImageChange,
  icon,
  className = '',
  showCamera = false,
  disabled = false,
  disabledMessage = "Complete Step 1 Identity first",
  enforceAspect = undefined
}) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const resizeImage = (base64: string, maxWidth: number = 2048): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (enforceAspect) {
            const currentAspect = img.width / img.height;
            if (currentAspect > enforceAspect) {
                // Too wide, crop sides
                sw = img.height * enforceAspect;
                sx = (img.width - sw) / 2;
            } else if (currentAspect < enforceAspect) {
                // Too tall, crop top and bottom
                sh = img.width / enforceAspect;
                sy = (img.height - sh) / 2;
            }
        }

        let finalWidth = sw;
        let finalHeight = sh;

        if (finalWidth > maxWidth) {
          finalHeight = (maxWidth / finalWidth) * finalHeight;
          finalWidth = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, finalWidth, finalHeight);
          // Draw using the source crop rect and destination rect
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, finalWidth, finalHeight);
        }
        
        // Lossless PNG for cleaner jewelry details (prevents JPEG artifacts)
        resolve(canvas.toDataURL('image/png', 1.0));
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalBase64 = reader.result as string;
        const compressedBase64 = await resizeImage(originalBase64);
        onImageChange({
          base64: compressedBase64,
          previewUrl: URL.createObjectURL(file),
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = async (base64: string) => {
    // Compress camera captures too
    const compressedBase64 = await resizeImage(base64);
    onImageChange({
      base64: compressedBase64,
      previewUrl: compressedBase64,
      name: `capture-${Date.now()}.jpg`
    });
    setIsCameraOpen(false);
  };

  return (
    <div className={`flex flex-col bg-white rounded-3xl elevated-card border border-slate-200/60 overflow-hidden transition-all hover:border-[var(--brand-primary)]/30 hover:shadow-2xl group/card min-h-[150px] relative ${className}`}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <div className={`p-2 bg-slate-50 rounded-xl text-[var(--brand-primary)] group-hover/card:scale-110 transition-transform shadow-sm ${disabled ? 'grayscale opacity-50' : ''}`}>
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'h-4 w-4' }) : icon}
        </div>
        <div className="overflow-hidden">
          <h3 className={`font-bold text-slate-900 text-[10px] tracking-widest uppercase leading-tight truncate ${disabled ? 'opacity-50' : ''}`}>{label}</h3>
          <p className="text-[9px] text-slate-500 truncate font-medium">{disabled ? disabledMessage : description}</p>
        </div>
      </div>

      <div className="relative flex-1 bg-[#fcfcfc] flex flex-col items-center justify-center p-2 text-center min-h-0 overflow-hidden">
        {image ? (
          <div className="relative max-w-full max-h-full group flex items-center justify-center overflow-hidden rounded-xl">
            <img
              src={image.previewUrl}
              alt={label}
              className="max-w-full max-h-full object-contain pointer-events-none"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
              <button
                onClick={() => onImageChange(null)}
                className="bg-red-500/90 p-3 rounded-full shadow-lg text-white hover:bg-red-600 transition-all active:scale-90 pointer-events-auto"
                title="Remove Image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex flex-col items-center gap-4 w-full h-full justify-center p-4 ${disabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <div className="flex gap-4">
              <label className={`flex flex-col items-center group ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md mb-2 border border-slate-100 group-hover:scale-110 group-hover:border-[var(--brand-primary)]/30 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[var(--brand-primary)] opacity-60 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase group-hover:text-[var(--brand-primary)] transition-colors">Select Asset</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={disabled}
                />
              </label>

              {showCamera && (
                <button
                  onClick={() => !disabled && setIsCameraOpen(true)}
                  disabled={disabled}
                  className={`flex flex-col items-center group ${disabled ? 'cursor-not-allowed' : ''}`}
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md mb-2 border border-slate-100 group-hover:scale-110 group-hover:border-[#D4AF37]/30 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#D4AF37] opacity-60 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase group-hover:text-[#D4AF37] transition-colors">Live Capture</span>
                </button>
              )}
            </div>
            {disabled && (
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest animate-pulse mt-2">Identity Required</p>
            )}
          </div>
        )}
      </div>

      {isCameraOpen && (
        <CameraView
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
};

export default ImageUploadCard;
