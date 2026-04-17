import React, { useState, useMemo } from 'react';
import Header from '../components/layouts/Header';
import Footer from '../components/layouts/Footer';
import ImageUploadCard from '../components/ImageUploadCard';
import { ImageData, ProcessingStatus, JewelryItem, JewelryCategory } from '../types';
import PrecisionStage from '../components/PrecisionStage';
import { useEffect } from 'react';
import { analyzeJewelryAsset, detectAnatomy, processJewelryFitting } from '../services/geminiService';
import { getDeterministicLandmarks } from '../services/mediaPipeService';
import { cropJewelryAsset, compressImage, surgicalJewelryCrop, padImageToSquare, cropImageToOriginalSize } from '../services/imageUtils';

interface LandingPageProps {
    jewelryItems: JewelryItem[];
}

const LandingPage: React.FC<LandingPageProps> = ({ jewelryItems }) => {
    const [personImage, setPersonImage] = useState<ImageData | null>(null);
    const [selectedJewelry, setSelectedJewelry] = useState<JewelryItem | null>(null);
    const [customJewelry, setCustomJewelry] = useState<ImageData | null>(null);
    const [activeCategory, setActiveCategory] = useState<JewelryCategory | null>(JewelryCategory.NECKLACE);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userPhone, setUserPhone] = useState('');

    const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [resultKey, setResultKey] = useState(0);

    // Custom Jewelry Dimension state
    const [customHeight, setCustomHeight] = useState('0');
    const [customWidth, setCustomWidth] = useState('0');
    const [heightUnit, setHeightUnit] = useState<'mm' | 'cm'>('mm');
    const [widthUnit, setWidthUnit] = useState<'mm' | 'cm'>('mm');

    // Deterministic State
    const [renderingData, setRenderingData] = useState<{
        person: string;
        jewelry: string;
        landmarks: any[];
        calibration: any;
        dimensions: any;
        focalBox: [number, number, number, number];
        category: JewelryCategory;
    } | null>(null);

    // Form Validation 
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isValidPhone = (phone: string) => /^\+?[\d\s\-()]{8,20}$/.test(phone);

    const isEmailValid = useMemo(() => !userEmail || isValidEmail(userEmail), [userEmail]);
    const isPhoneValid = useMemo(() => !userPhone || isValidPhone(userPhone), [userPhone]);
    const isFormValid = useMemo(() =>
        userName.trim().length >= 3 &&
        userEmail && isValidEmail(userEmail) &&
        userPhone && isValidPhone(userPhone),
        [userName, userEmail, userPhone]);

    // Default selection effect
    useEffect(() => {
        if (jewelryItems.length > 0) {
            // 1. Initialize activeCategory if not set
            if (!activeCategory) {
                setActiveCategory(JewelryCategory.NECKLACE);
            }

            // 2. Select the first item in the active category if none selected
            if (!selectedJewelry && activeCategory) {
                const firstInCat = jewelryItems.find(item => item.category === activeCategory);
                if (firstInCat) {
                    setSelectedJewelry(firstInCat);
                }
            }
        }
    }, [jewelryItems, activeCategory, selectedJewelry]);

    const fetchImageMeta = async (base64: string): Promise<{ width: number, height: number, aspectRatio: number }> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    width: img.width,
                    height: img.height,
                    aspectRatio: img.width / img.height
                });
            };
            img.src = base64;
        });
    };

    const fetchImageAsBase64 = async (url: string): Promise<string> => {
        // Prepare the URL - handle both absolute and relative paths
        const finalUrl = url.startsWith('http') ? url : `/rajaJewellers/${url}`;

        const response = await fetch(finalUrl);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleTryOn = async () => {
        let targetJewelryBase64 = customJewelry?.base64;

        // If it's a selected jewelry item and we don't have the base64, fetch it
        if (!targetJewelryBase64 && selectedJewelry) {
            setStatus(ProcessingStatus.PROCESSING);
            try {
                // Check if we already have it (unlikely with new API but for safety)
                if (selectedJewelry.image.base64) {
                    targetJewelryBase64 = selectedJewelry.image.base64;
                } else {
                    // Fetch on-demand
                    targetJewelryBase64 = await fetchImageAsBase64(selectedJewelry.image.previewUrl);
                }
            } catch (err) {
                setError("Could not load high-resolution jewelry asset.");
                setStatus(ProcessingStatus.ERROR);
                return;
            }
        }

        if (!personImage || !targetJewelryBase64) return;

        setStatus(ProcessingStatus.PROCESSING);
        setError(null);

        try {
            // Use the already optimized assets
            const optimizedJewelry = targetJewelryBase64;
            
            // PHYSICS ENFORCEMENT: Pad the original image to a perfect 1:1 square
            // This mathematically prevents the AI from auto-cropping out of-bounds pixels
            const squarePadData = await padImageToSquare(personImage.base64);
            const optimizedPerson = squarePadData.base64;

            let dimensions = undefined;
            const meta = await fetchImageMeta(optimizedJewelry);

            if (selectedJewelry && selectedJewelry.width > 0) {
                dimensions = {
                    height: Number(selectedJewelry.height),
                    width: Number(selectedJewelry.width),
                    aspectRatio: meta.aspectRatio
                };
            } else if (customJewelry && (parseFloat(customWidth) > 0 || parseFloat(customHeight) > 0)) {
                dimensions = {
                    height: (parseFloat(customHeight) * (heightUnit === 'cm' ? 10 : 1)) || 0,
                    width: (parseFloat(customWidth) * (widthUnit === 'cm' ? 10 : 1)) || 0,
                    aspectRatio: meta.aspectRatio
                };
            }

            const activeCategoryValue = activeCategory || selectedJewelry?.category;

            // --- STAGE 1: DETECT DETERMINISTIC CALIBRATION (MediaPipe) ---
            const mediaPipeResult = await getDeterministicLandmarks(optimizedPerson, activeCategoryValue as JewelryCategory);
            if (!mediaPipeResult) {
                throw new Error("Could not detect landmarks. Please ensure your face/hands are clear.");
            }

            // --- STAGE 2: AI ANATOMY REFINEMENT (Gemini) ---
            const aiAnatomy = await detectAnatomy(optimizedPerson, activeCategoryValue?.toLowerCase() || "jewelry");

            // --- STAGE 3: ASSET ANALYSIS & SURGICAL EXTRACTION ---
            const assetResult = await analyzeJewelryAsset(optimizedJewelry, activeCategoryValue?.toLowerCase() || "jewelry");
            
            // Redo everything related to earring: isolate 1 earring from the image surgically
            const surgicallyCleanedAsset = await surgicalJewelryCrop(optimizedJewelry, assetResult.focal_box);

            // The asset sent to the generative model is now the cropped image.
            // We MUST update the dimensions.aspectRatio to match the surgically cropped image,
            // otherwise, the generative bounding boxes will be disproportionately squished/stretched.
            const cleanMeta = await fetchImageMeta(surgicallyCleanedAsset);
            const correctedDimensions = dimensions ? {
                ...dimensions,
                aspectRatio: cleanMeta.aspectRatio
            } : undefined;

            // --- STAGE 4: AI-GENERATIVE FITTING (Synthesis) ---
            // We favor Stage 3 (Generative) for realistic shadows, but with the CLEANED asset
            const rawSquareResult = await processJewelryFitting(
                optimizedPerson,
                surgicallyCleanedAsset,
                activeCategoryValue as JewelryCategory,
                correctedDimensions,
                {
                    landmarks: [
                        ...aiAnatomy.landmarks,
                        ...mediaPipeResult.landmarks.filter(l => !l.label.startsWith('target_region'))
                    ],
                    calibration: mediaPipeResult.calibration
                }
            );

            // --- STAGE 5: PHYSICS RESTORATION ---
            // Slice the black padding back off to restore the exact original aspect ratio
            const framePerfectResult = await cropImageToOriginalSize(rawSquareResult, squarePadData);

            // --- DISPLAY RESULT ---
            setResultImage(framePerfectResult);
            setResultKey(prev => prev + 1);
            setStatus(ProcessingStatus.SUCCESS);
            setRenderingData(null); 

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Something went wrong during the fitting process.";
            setError(errorMessage);
            setResultImage(null); // Clear image only on error
            setStatus(ProcessingStatus.ERROR);
        }
    };

    const filteredJewelry = useMemo(() => {
        if (!activeCategory) return [];
        return jewelryItems.filter(item =>
            item.category.trim().toUpperCase() === activeCategory.trim().toUpperCase()
        );
    }, [jewelryItems, activeCategory]);

    const handleReset = () => {
        setStatus(ProcessingStatus.IDLE);
        setResultImage(null);
        setError(null);
    };

    return (
        <div className="w-full h-screen flex flex-col relative bg-slate-100/30 overflow-hidden">
            {isFullscreen && resultImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in duration-300">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setIsFullscreen(false)}></div>
                    <div className="relative max-w-full max-h-full flex flex-col items-center gap-6">
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(false)}
                            className="absolute -top-12 right-0 text-white/50 hover:text-white transition-colors bg-white/10 p-2 rounded-full hover:bg-white/20"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <img
                            src={resultImage}
                            alt="Fullscreen Render"
                            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-[0_0_100px_rgba(168,85,247,0.3)] ring-1 ring-white/20"
                        />
                        <div className="flex gap-4">
                            <a
                                href={resultImage}
                                download={`jeweltry-render-${Date.now()}.png`}
                                className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-full font-black text-[10px] md:text-sm uppercase tracking-widest transition-all shadow-xl active:scale-95"
                            >
                                Download Master
                            </a>
                            <button
                                type="button"
                                onClick={() => setIsFullscreen(false)}
                                className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-full font-black text-[10px] md:text-sm uppercase tracking-widest transition-all"
                            >
                                Close View
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Header showAdminLink={false} />

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-1000 items-stretch px-4 md:px-6 pb-6 mt-2">
                {/* Step 1: Identity */}
                <div className="bg-white backdrop-blur-xl rounded-3xl md:rounded-[2.5rem] border border-slate-200/50 elevated-card flex flex-col h-full overflow-hidden relative transition-all duration-500">
                    <div className="px-8 py-4 border-b border-slate-100/50 flex items-center justify-between shrink-0">
                        <h3 className="text-xs md:text-sm font-black text-slate-500 uppercase tracking-[0.25em] opacity-80">Step 1: Identity</h3>
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] shadow-[0_0_8px_rgba(86,31,122,0.3)]"></div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder="Full Name"
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs md:text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder:text-slate-400"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <input
                                        type="email"
                                        value={userEmail}
                                        onChange={(e) => setUserEmail(e.target.value)}
                                        placeholder="Email Address"
                                        className={`w-full bg-white border rounded-xl px-4 py-2.5 text-xs md:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder:text-slate-400 ${!isEmailValid ? 'border-red-400 focus:ring-red-400' : 'border-slate-200'}`}
                                    />
                                    {!isEmailValid && <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider ml-1">Invalid Format</p>}
                                </div>
                                <div className="space-y-1">
                                    <input
                                        type="tel"
                                        value={userPhone}
                                        onChange={(e) => setUserPhone(e.target.value)}
                                        placeholder="Mobile Number"
                                        className={`w-full bg-white border rounded-xl px-4 py-2.5 text-xs md:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder:text-slate-400 ${!isPhoneValid ? 'border-red-400 focus:ring-red-400' : 'border-slate-200'}`}
                                    />
                                    {!isPhoneValid && <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider ml-1">Invalid Format</p>}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ImageUploadCard
                                label="Portrait Asset"
                                description="Frontal face & neck capture"
                                image={personImage}
                                onImageChange={async (img) => {
                                    if (img) {
                                        const optimized = await compressImage(img.base64);
                                        setPersonImage({ ...img, base64: optimized });
                                    } else {
                                        setPersonImage(null);
                                    }
                                    handleReset();
                                }}
                                className="md:h-full"
                                showCamera={true}
                                disabled={false}
                                icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                            />
                        </div>
                        <div className="bg-slate-50/30 p-4 rounded-2xl border border-slate-100/30 shrink-0 text-center">
                            <p className="text-[10px] md:text-xs text-slate-400 leading-tight font-medium"><span className="font-bold text-slate-900">Disclaimer:</span><br /> Use a clear portrait for necklaces, pendants, and earrings.
                                <br />Use a clear hand photo for rings, bangles, and bracelets.</p>
                        </div>
                    </div>
                </div>

                {/* Step 2: Selection */}
                <div className="bg-white backdrop-blur-xl rounded-3xl md:rounded-[2.5rem] border border-slate-200/50 elevated-card overflow-hidden flex flex-col h-full relative transition-all duration-500">
                    <div className="px-8 py-4 border-b border-slate-100/50 flex items-center justify-between shrink-0">
                        <h3 className="text-xs md:text-sm font-black text-slate-500 uppercase tracking-[0.25em] opacity-80">Step 2: Selection</h3>
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] shadow-[0_0_8px_rgba(86,31,122,0.3)]"></div>
                    </div>
                    <div className="p-4 bg-slate-50/40 flex flex-col gap-3 shrink-0">
                        <div className="grid grid-cols-3 gap-2">
                            {Object.values(JewelryCategory).map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => { setActiveCategory(cat); if (selectedJewelry?.category !== cat) setSelectedJewelry(null); }}
                                    className={`py-2 text-[8px] md:text-[10px] font-black tracking-widest uppercase transition-all rounded-lg border text-center truncate px-1 ${activeCategory === cat
                                        ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-[0_0_10px_rgba(86,31,122,0.2)]'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-[var(--brand-primary)]/30 hover:text-[var(--brand-primary)] transition-all'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => { if (!customJewelry) setCustomJewelry({ base64: '', previewUrl: '', name: 'Custom' }); setSelectedJewelry(null); }}
                            disabled={!activeCategory}
                            className={`w-full py-2.5 text-[10px] md:text-xs font-black tracking-[0.2em] uppercase transition-all rounded-xl border flex items-center justify-center gap-2 ${!activeCategory ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60' : customJewelry ? 'bg-[#D4AF37] text-white border-[#D4AF37] shadow-lg' : 'bg-slate-200/50 text-slate-600 border-transparent hover:bg-slate-200'}`}
                        >
                            {!activeCategory ? 'Select Category First' : 'Upload Private Asset'}
                        </button>
                    </div>
                    <div className="p-4 md:p-6 flex-1 flex flex-col overflow-y-auto min-h-0">
                        {customJewelry ? (
                            <div className="animate-in fade-in zoom-in-95 h-full flex flex-col gap-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <ImageUploadCard
                                        label="Custom Selection"
                                        description="Private collection asset"
                                        image={customJewelry.base64 ? customJewelry : null}
                                        onImageChange={async (img) => {
                                            if (img) {
                                                const cropped = await cropJewelryAsset(img.base64);
                                                const optimized = await compressImage(cropped);
                                                setCustomJewelry({ ...img, base64: optimized });
                                            } else {
                                                setCustomJewelry(null);
                                            }
                                        }}
                                        className="h-44 md:h-52"
                                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
                                    />

                                    <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-2xl space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-600">Precision Dimensions</h4>
                                            <span className="bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter">AI Scaling Mode</span>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="group/dim">
                                                <div className="flex justify-between items-center mb-1 px-1">
                                                    <label className="text-[8px] font-black uppercase text-slate-400 group-focus-within/dim:text-purple-600 transition-colors">Physical Height</label>
                                                    <div className="flex bg-white rounded-md p-0.5 border border-slate-200 shadow-sm">
                                                        {['mm', 'cm'].map((u) => (
                                                            <button key={u} type="button" onClick={() => setHeightUnit(u as 'mm' | 'cm')} className={`px-1.5 py-0.5 text-[7px] font-black uppercase rounded-sm transition-all ${heightUnit === u ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>{u}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <input type="number" step="0.1" value={customHeight} onChange={e => setCustomHeight(e.target.value)} className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-900 focus:ring-1 focus:ring-purple-500 outline-none transition-all shadow-sm" placeholder="0.0" />
                                            </div>

                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="group/dim">
                                                    <div className="flex justify-between items-center mb-1 px-1">
                                                        <label className="text-[8px] font-black uppercase text-slate-400 group-focus-within/dim:text-purple-600 transition-colors">Width</label>
                                                        <div className="flex bg-white rounded-md p-0.5 border border-slate-200 shadow-sm">
                                                            {['mm', 'cm'].map((u) => (
                                                                <button key={u} type="button" onClick={() => setWidthUnit(u as 'mm' | 'cm')} className={`px-1.5 py-0.5 text-[7px] font-black uppercase rounded-sm transition-all ${widthUnit === u ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>{u}</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <input type="number" step="0.1" value={customWidth} onChange={e => setCustomWidth(e.target.value)} className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-900 focus:ring-1 focus:ring-purple-500 outline-none transition-all shadow-sm" placeholder="0.0" />
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[8px] text-slate-400 italic px-1 pt-1">Provide exact physical sizes for high-fidelity anatomical scaling.</p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => { setCustomJewelry(null); setCustomHeight('0'); setCustomWidth('0'); }}
                                        className="text-[9px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors py-1"
                                    >
                                        Cancel Custom Selection
                                    </button>
                                </div>
                            </div>
                        ) : activeCategory ? (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {filteredJewelry.map(item => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => { setSelectedJewelry(item); setCustomJewelry(null); }}
                                        className={`group p-2 rounded-2xl border-2 transition-all duration-300 relative flex flex-col ${selectedJewelry?.id === item.id ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-[0_0_15px_rgba(86,31,122,0.1)]' : 'border-transparent bg-white hover:bg-slate-50'}`}
                                    >
                                        <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-slate-50 border border-slate-100">
                                            <img src={item.image.previewUrl} className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform duration-500" alt={item.name} />
                                        </div>
                                        <p className="text-[10px] md:text-xs font-black text-slate-900 truncate px-1">{item.name}</p>
                                        {(item.width > 0 || item.height > 0) && (
                                            <p className="text-[8px] font-bold text-slate-400 mt-0.5 px-1 uppercase tracking-tighter italic">
                                                {item.width}x{item.height} mm
                                            </p>
                                        )}
                                    </button>
                                ))}
                                {filteredJewelry.length === 0 && (
                                    <div className="col-span-2 flex flex-col items-center justify-center opacity-20 py-10">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No {activeCategory?.toLowerCase()}s available</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center animate-pulse">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Category Above</p>
                            </div>
                        )}
                    </div>
                    <div className="p-6 bg-slate-50/30 border-t border-slate-100/50 shrink-0">
                        <button
                            type="button"
                            onClick={handleTryOn}
                            disabled={!personImage || (!selectedJewelry && (!customJewelry || !customJewelry.base64)) || status === ProcessingStatus.PROCESSING}
                            className={`w-full py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-lg uppercase tracking-[0.3em] transition-all duration-500 flex items-center justify-center gap-3 active:scale-[0.98] ${!personImage || (!selectedJewelry && (!customJewelry || !customJewelry.base64)) || status === ProcessingStatus.PROCESSING
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-[var(--brand-primary)] to-[#7a2cb1] text-white shadow-lg hover:shadow-xl hover:-translate-y-1'
                                }`}
                        >
                            {status === ProcessingStatus.PROCESSING ? (
                                <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></div>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                </svg>
                            )}
                            <span className="tracking-[0.2em] uppercase text-[10px] md:text-sm">Process Fitting</span>
                        </button>
                    </div>
                </div>

                {/* Step 3: Result Preview */}
                <div className="bg-white backdrop-blur-sm rounded-3xl md:rounded-[2.5rem] border border-slate-100/60 elevated-card overflow-hidden relative flex flex-col h-full result-stage ring-1 ring-white/10 shadow-xl">
                    {status === ProcessingStatus.IDLE && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-1000">
                            <div className="w-24 h-24 bg-white shadow-xl rounded-[2rem] flex items-center justify-center mb-6 rotate-6 border border-slate-100">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-2 tracking-tighter">Studio Stage</h3>
                            <p className="text-slate-400 text-[11px] md:text-sm max-w-[200px] leading-relaxed">High-fidelity render results will be projected here.</p>
                        </div>
                    )}

                    {/* Processing State with persistent image fallback */}
                    {status === ProcessingStatus.PROCESSING && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden h-full">
                            {resultImage && (
                                <img src={resultImage} alt="Current Result" className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm scale-95" />
                            )}
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-20 h-20 border-[6px] border-slate-100 border-t-[#D4AF37] rounded-full animate-spin shadow-[0_0_30px_rgba(212,175,55,0.1)] mb-6"></div>
                                <p className="text-slate-900 font-black text-lg md:text-2xl tracking-tight">Syncing Realism</p>
                                <p className="text-[#D4AF37] text-[10px] md:text-xs font-black uppercase tracking-[0.4em] animate-pulse">Neural Interface Active</p>
                            </div>
                        </div>
                    )}

                    {status === ProcessingStatus.ERROR && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-red-50/5">
                            <h3 className="font-black text-slate-900 text-xl md:text-2xl mb-2">Sync Error</h3>
                            <p className="text-red-500 font-bold text-[10px] md:text-sm mb-6 max-w-[200px] bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20">{error}</p>
                            <button type="button" onClick={() => setStatus(ProcessingStatus.IDLE)} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] md:text-sm uppercase tracking-widest shadow-xl">Reinitialize</button>
                        </div>
                    )}

                    {status === ProcessingStatus.SUCCESS && resultImage && (
                        <div key={resultKey} className="flex-1 flex flex-col animate-in fade-in zoom-in-105 duration-1000 ease-out h-full overflow-hidden">
                            <div className="flex-1 flex items-center justify-center p-2 overflow-hidden min-h-0 relative group/result">
                                <img src={resultImage} alt="Fitting Result" className="w-full h-full object-contain rounded-3xl shadow-xl border-2 border-slate-100 shadow-slate-200" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/result:opacity-100 transition-opacity bg-black/10 rounded-3xl m-2">
                                    <button type="button" onClick={() => setIsFullscreen(true)} className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-full border border-white/20 shadow-2xl backdrop-blur-md transition-all flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                        <span className="text-[10px] md:text-sm font-black uppercase tracking-widest">Maximize</span>
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 bg-white/90 backdrop-blur-2xl border-t border-slate-100 flex gap-3 shrink-0">
                                <a href={resultImage} download={`jeweltry-fitting-${Date.now()}.png`} className="flex-1 bg-gradient-to-r from-[var(--brand-primary)] to-[#7a2cb1] text-white py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] md:text-sm tracking-[0.2em] uppercase transition-all shadow-lg group">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Download
                                </a>
                                <button type="button" onClick={handleReset} className="aspect-square w-12 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-200 flex items-center justify-center transition-all shadow-xl">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {renderingData && (
                <PrecisionStage
                    personBase64={renderingData.person}
                    jewelryBase64={renderingData.jewelry}
                    category={renderingData.category}
                    landmarks={renderingData.landmarks}
                    calibration={renderingData.calibration}
                    dimensions={renderingData.dimensions}
                    focalBox={renderingData.focalBox}
                    onRenderComplete={async (result) => {
                        setResultImage(result);
                        setResultKey(prev => prev + 1);
                        setStatus(ProcessingStatus.SUCCESS);
                        setRenderingData(null); // Clear trigger

                        // Save to server (background)
                        try {
                            await fetch('/rajaJewellers/api/save_render.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    userName: userName || 'Anonymous',
                                    userEmail: userEmail,
                                    userPhone: userPhone,
                                    personImage: personImage?.base64,
                                    resultImage: result
                                })
                            });
                        } catch (saveErr) { }
                    }}
                    onError={(msg) => {
                        setError(msg);
                        setStatus(ProcessingStatus.ERROR);
                        setRenderingData(null);
                    }}
                />
            )}
        </div>
    );
};

export default LandingPage;
