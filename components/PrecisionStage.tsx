import React, { useEffect, useRef, useState } from 'react';
import { JewelryCategory, ProcessingStatus } from '../types';
import { calculateRoll } from '../services/poseUtils';

interface PrecisionStageProps {
  personBase64: string;
  jewelryBase64: string;
  category: JewelryCategory;
  landmarks: { label: string; box_2d: [number, number, number, number] }[];
  calibration: { unitsPerMm: number } | null;
  dimensions: { height: number; width: number } | null;
  focalBox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in 0-1000
  onRenderComplete: (dataUrl: string) => void;
  onError: (msg: string) => void;
}

const PrecisionStage: React.FC<PrecisionStageProps> = ({
  personBase64,
  jewelryBase64,
  category,
  landmarks,
  calibration,
  dimensions,
  focalBox = [0, 0, 1000, 1000],
  onRenderComplete,
  onError
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const render = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      try {
        // 1. Load Images
        const [personImg, jewelryImg] = await Promise.all([
          loadImage(personBase64),
          loadImage(jewelryBase64)
        ]);

        // 2. Setup Canvas
        canvas.width = personImg.width;
        canvas.height = personImg.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 3. Draw Person (Background)
        ctx.drawImage(personImg, 0, 0);

        // 4. Calculate Transforms
        const roll = calculateRoll(landmarks);
        const unitsPerMm = calibration?.unitsPerMm || 1.0;

        // Target regions
        const targets = landmarks.filter(l => l.label.startsWith('target_region'));

        // Jewelry Focal Math
        const focalHeightNorm = (focalBox[2] - focalBox[0]) / 1000;
        const focalWidthNorm = (focalBox[3] - focalBox[1]) / 1000;
        const focalCenterYNorm = (focalBox[0] + focalBox[2]) / 2000;
        const focalCenterXNorm = (focalBox[1] + focalBox[3]) / 2000;

        if (targets.length === 0) {
          throw new Error("Could not locate the required anatomical region (Neck/Ear/Hand). Please ensure your features are visible and try again.");
        }

        // --- DRAW EACH INSTANCE ---
        targets.forEach((target) => {
          ctx.save();

          // Target Point in Pixels (landmarks are 0-1000)
          const targetY = (target.box_2d[0] + target.box_2d[2]) / 2 * (canvas.height / 1000);
          const targetX = (target.box_2d[1] + target.box_2d[3]) / 2 * (canvas.width / 1000);

          // --- SCALING LOGIC (PRECISION FIX) ---
          let drawHeight, drawWidth;
          if (dimensions && dimensions.height > 0) {
            // 1. Convert normalized units per mm to screen pixels per mm
            const pxPerNormUnit = canvas.height / 1000;
            const pxPerMm = unitsPerMm * pxPerNormUnit;

            // 2. Target pixels for the FOCAL element only
            const focalPxHeight = dimensions.height * pxPerMm;

            // 3. Scale the WHOLE asset so the FOCAL element matches the target height
            drawHeight = focalPxHeight / focalHeightNorm;
            drawWidth = (drawHeight / jewelryImg.height) * jewelryImg.width;
          } else {
            // Fallback: 15% of canvas height
            drawHeight = canvas.height * 0.15;
            drawWidth = (drawHeight / jewelryImg.height) * jewelryImg.width;
          }

          // Offset to align FOCAL CENTER with TARGET CENTER
          const jewelryCenterY = focalCenterYNorm * drawHeight;
          const jewelryCenterX = focalCenterXNorm * drawWidth;

          ctx.translate(targetX, targetY);
          ctx.rotate(roll);

          // 5. Lighting Integration (Ambient Match)
          // Sample a small region near the target to get the "background light"
          const sampleY = Math.max(0, targetY - 10);
          const sampleX = Math.max(0, targetX - 10);
          const pixelData = ctx.getImageData(sampleX, sampleY, 20, 20).data;
          let totalBrightness = 0;
          for (let i = 0; i < pixelData.length; i += 4) {
            totalBrightness += (pixelData[i] + pixelData[i + 1] + pixelData[i + 2]) / 3;
          }
          const avgBrightness = totalBrightness / (pixelData.length / 4);
          const brightnessFactor = 0.8 + (avgBrightness / 255) * 0.4; // Range 0.8 - 1.2

          ctx.filter = `brightness(${brightnessFactor.toFixed(2)}) contrast(1.05)`;

          // 6. Draw Jewelry with Multi-layer Shadows
          // Layer 1: Sharp contact shadow
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 2 * (drawHeight / 500);
          ctx.shadowOffsetY = 1 * (drawHeight / 500);

          ctx.drawImage(
            jewelryImg,
            -jewelryCenterX,
            -jewelryCenterY,
            drawWidth,
            drawHeight
          );

          // Layer 2: Soft ambient shadow (applied via second draw or offset)
          ctx.shadowBlur = 20 * (drawHeight / 500);
          ctx.shadowColor = 'rgba(0,0,0,0.2)';
          ctx.shadowOffsetY = 10 * (drawHeight / 500);
          ctx.globalAlpha = 0.3; // Very subtle for second pass
          ctx.drawImage(jewelryImg, -jewelryCenterX, -jewelryCenterY, drawWidth, drawHeight);
          ctx.globalAlpha = 1.0;

          ctx.restore();
        });

        // 7. Final Polish
        const finalDataUrl = canvas.toDataURL('image/png', 1.0);
        onRenderComplete(finalDataUrl);
        setIsRendered(true);

      } catch (err: any) {
        onError(err.message || "Failed to render precision overlay.");
      }
    };

    render();
  }, [personBase64, jewelryBase64, landmarks, calibration, dimensions, focalBox]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'none' }} // Hidden as it works as a processing stage
    />
  );
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image asset."));
    img.src = src;
  });
};

export default PrecisionStage;
