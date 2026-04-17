
import React, { useRef, useEffect, useState } from 'react';

interface CameraViewProps {
    onCapture: (imageData: string) => void;
    onClose: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        let stream: MediaStream | null = null;

        const startCamera = async () => {
            try {
                // Use more standard constraints for better compatibility
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    console.log("Camera stream assigned");
                }
            } catch (err: any) {
                console.error("Camera access error:", err);
                setError(err.message || "Failed to access camera. Please check permissions.");
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleVideoReady = () => {
        console.log("Video metadata/stream ready");
        setIsStreaming(true);
    };

    const handleCapture = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        console.log("Capture button clicked");

        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            // Fallback to videoWidth if not ready, but check if it's greater than 0
            const w = video.videoWidth || 1280;
            const h = video.videoHeight || 720;

            if (context) {
                // Target 3:4 portrait ratio
                const targetRatio = 3 / 4;
                const targetWidth = h * targetRatio;
                const offsetX = (w - targetWidth) / 2;

                canvas.width = targetWidth;
                canvas.height = h;

                console.log(`Capturing portrait crop at ${targetWidth.toFixed(0)}x${h} (from ${w}x${h})`);

                // Mirror the capture and center-crop
                context.translate(canvas.width, 0);
                context.scale(-1, 1);
                context.drawImage(
                    video,
                    offsetX, 0, targetWidth, h, // Source rectangle (center crop)
                    0, 0, targetWidth, h      // Destination (full canvas)
                );

                const imageData = canvas.toDataURL('image/png');
                onCapture(imageData);
            }
        } else {
            console.error("Capture failed: video or canvas ref missing");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden">
            {/* Header Overlay */}
            <div className="absolute top-0 inset-x-0 z-50 px-6 py-8 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <h3 className="text-[10px] md:text-sm font-black text-white uppercase tracking-[0.3em]">Studio Lens</h3>
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="text-white bg-white/10 p-4 rounded-full backdrop-blur-xl pointer-events-auto active:scale-90 transition-all border border-white/10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Video Container */}
            <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
                {error ? (
                    <div className="p-8 text-center bg-red-500/10 w-full h-full flex flex-col items-center justify-center z-50">
                        <p className="text-red-400 font-bold mb-6 max-w-[280px]">{error}</p>
                        <button onClick={onClose} className="px-10 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest pointer-events-auto">Return</button>
                    </div>
                ) : (
                    <div className="relative h-full max-h-screen aspect-[3/4] bg-black overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] border-x border-white/5 mx-auto">
                        {!isStreaming && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-40">
                                <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin mb-4"></div>
                                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.4em]">Calibrating Studio</p>
                            </div>
                        )}

                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            onLoadedMetadata={handleVideoReady}
                            onCanPlay={handleVideoReady}
                            onPlaying={handleVideoReady}
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ transform: 'scaleX(-1)' }}
                        />

                        {/* Immersive Portrait Guides */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                            {/* Head & Neck Guide Area */}
                            <div className="w-[85%] h-[75%] border border-dashed border-white/20 rounded-[4rem] relative">
                                <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] border border-white/10 rounded-full"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-px h-full bg-white/5"></div>
                            </div>
                            <div className="absolute inset-x-0 bottom-10 flex justify-center">
                                <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                                    <p className="text-[8px] font-black text-white/60 uppercase tracking-widest">Portrait Safe Zone</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls Overlay - Truly on top */}
            <div className="absolute bottom-0 inset-x-0 z-[60] px-8 pb-10 pt-20 flex flex-col items-center justify-center bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
                <div className="relative flex flex-col items-center gap-4 pointer-events-none">
                    <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.5em] mb-2">Align Portrait & Tap</p>

                    <button
                        onClick={handleCapture}
                        className={`w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-90 transition-all pointer-events-auto cursor-pointer relative z-[70] ${!isStreaming ? 'opacity-50 grayscale' : ''}`}
                    >
                        <div className="w-14 h-14 md:w-16 md:h-16 border-[3px] border-black/5 rounded-full flex items-center justify-center">
                            <div className="w-11 h-11 md:w-13 md:h-13 bg-[#561f7a] rounded-full flex items-center justify-center shadow-inner group">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                </svg>
                            </div>
                        </div>
                    </button>

                    <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${isStreaming ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`}></div>
                </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default CameraView;
