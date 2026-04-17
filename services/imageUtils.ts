
/**
 * Utility to crop white or transparent padding from a base64 image.
 * This ensures that the "30mm" measurement applies to the OBJECT, not the whitespace.
 */
export const cropJewelryAsset = async (base64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(base64);

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let foundContent = false;

      // Find boundaries of non-white/non-transparent pixels
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];

          // Threshold: Not fully transparent AND (not very close to pure white)
          // We assume "white" is > 245 on all channels
          const isWhite = r > 245 && g > 245 && b > 245;
          const isTransparent = a < 10;

          if (!isWhite && !isTransparent) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            foundContent = true;
          }
        }
      }

      if (!foundContent) return resolve(base64);

      // Zero-padding for absolute metric precision
      const cropWidth = maxX - minX;
      const cropHeight = maxY - minY;

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;
      const cropCtx = cropCanvas.getContext("2d");

      if (!cropCtx) return resolve(base64);
      cropCtx.drawImage(img, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      resolve(cropCanvas.toDataURL("image/png"));
    };
    img.onerror = reject;
  });
};

/**
 * Compresses and resizes an image to optimize for AI processing speed.
 * Target: Max 1024px dimension, 0.85 quality.
 */
export const compressImage = async (base64: string, maxDim: number = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Only resize if larger than maxDim
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height *= maxDim / width;
          width = maxDim;
        } else {
          width *= maxDim / height;
          height = maxDim;
        }
      } else {
        // If already small, just return original to save CPU
        return resolve(base64);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) return resolve(base64);

      // Use standard smoothing for best quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Export as compressed JPEG (much smaller than PNG for base64 transfer)
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
  });
};

/**
 * Surgically crops a jewelry asset to a specific focal box [ymin, xmin, ymax, xmax].
 * This is used to isolate a single earring from a pair image.
 */
export const surgicalJewelryCrop = async (
  base64: string, 
  focalBox: [number, number, number, number]
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(base64);

      // Convert normalized (0-1000) to pixel coordinates
      const ymin = (focalBox[0] / 1000) * img.height;
      const xmin = (focalBox[1] / 1000) * img.width;
      const ymax = (focalBox[2] / 1000) * img.height;
      const xmax = (focalBox[3] / 1000) * img.width;

      const cropWidth = Math.max(1, xmax - xmin);
      const cropHeight = Math.max(1, ymax - ymin);

      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      ctx.drawImage(img, xmin, ymin, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
  });
};

export const blendGenerativePatch = async (
  originalBase64: string,
  generativeBase64: string,
  origLandmarks: any[],
  genLandmarks: any[]
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const origImg = new Image();
    const genImg = new Image();

    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        processPatch();
      }
    };

    origImg.onload = onLoad;
    genImg.onload = onLoad;
    origImg.onerror = reject;
    genImg.onerror = reject;

    origImg.src = originalBase64;
    genImg.src = generativeBase64;

    function processPatch() {
      // 1. Identify Target Regions in both images
      const origTarget = origLandmarks.find(l => l.label.startsWith('target_region'));
      const genTarget = genLandmarks.find(l => l.label.startsWith('target_region'));
      
      const origFace = origLandmarks.find(l => l.label === 'face');
      const genFace = genLandmarks.find(l => l.label === 'face');

      // Fallback: If AI destroyed tracking, we can't patch reliably. Just return original.
      if (!origTarget || !genTarget || !origFace || !genFace) {
        console.warn("[Patch] Missing landmarks, falling back to raw AI output.");
        return resolve(generativeBase64);
      }

      // 2. Identify physical scale difference to detect if Gemini zoomed the output
      // We use the full face bounding box height for a highly stable profile-agnostic scale metric.
      const origFaceHeightPx = ((origFace.box_2d[2] - origFace.box_2d[0]) / 1000) * origImg.height;
      const genFaceHeightPx = ((genFace.box_2d[2] - genFace.box_2d[0]) / 1000) * genImg.height;
      
      const scaleToMatchOriginal = origFaceHeightPx / genFaceHeightPx;

      // 3. Find the exact center of the target regions
      const origCenterY = ((origTarget.box_2d[0] + origTarget.box_2d[2]) / 2 / 1000) * origImg.height;
      const origCenterX = ((origTarget.box_2d[1] + origTarget.box_2d[3]) / 2 / 1000) * origImg.width;
      
      const genCenterY = ((genTarget.box_2d[0] + genTarget.box_2d[2]) / 2 / 1000) * genImg.height;
      const genCenterX = ((genTarget.box_2d[1] + genTarget.box_2d[3]) / 2 / 1000) * genImg.width;

      // 4. Define Generative Patch Radius 
      // Calculate a VERY TIGHT radius based strictly on the generated target bounds 
      // to eliminate large skin halos or mismatched skin colors from the generative AI.
      const targetHeightPx = ((genTarget.box_2d[2] - genTarget.box_2d[0]) / 1000) * genImg.height;
      const targetWidthPx = ((genTarget.box_2d[3] - genTarget.box_2d[1]) / 1000) * genImg.width;
      
      // We set the radius to exactly wrap the bounding box + 30% padding for native drop shadows.
      const genRadius = Math.max(targetWidthPx, targetHeightPx) * 1.3; 

      // Create a temporary canvas for the masked patch
      const patchCanvas = document.createElement('canvas');
      patchCanvas.width = genRadius * 2;
      patchCanvas.height = genRadius * 2;
      const patchCtx = patchCanvas.getContext('2d');
      if (!patchCtx) return resolve(originalBase64);

      // Draw the generative image fragment into patch canvas
      patchCtx.drawImage(
        genImg,
        genCenterX - genRadius, genCenterY - genRadius, genRadius * 2, genRadius * 2,
        0, 0, genRadius * 2, genRadius * 2
      );

      // Apply soft radial gradient mask to the patch to blend seamlessly with original skin
      patchCtx.globalCompositeOperation = 'destination-in';
      const gradient = patchCtx.createRadialGradient(genRadius, genRadius, genRadius * 0.4, genRadius, genRadius, genRadius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); 
      gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.8)'); // High opacity over the metal
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Sharp falloff
      
      patchCtx.fillStyle = gradient;
      patchCtx.fillRect(0, 0, genRadius * 2, genRadius * 2);

      // 5. Composite the soft patch onto the ORIGINAL image
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = origImg.width;
      finalCanvas.height = origImg.height;
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) return resolve(originalBase64);

      finalCtx.drawImage(origImg, 0, 0);

      // Calculate final mapped size on original image
      const origPatchRadius = genRadius * scaleToMatchOriginal;

      finalCtx.globalCompositeOperation = 'source-over';
      finalCtx.drawImage(
        patchCanvas,
        0, 0, genRadius * 2, genRadius * 2,
        origCenterX - origPatchRadius, origCenterY - origPatchRadius, origPatchRadius * 2, origPatchRadius * 2
      );

      resolve(finalCanvas.toDataURL("image/jpeg", 0.95));
    }
  });
}

export const padImageToSquare = async (base64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const dim = Math.max(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = dim;
      canvas.height = dim;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(base64);

      // Fill with purely black padding
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, dim, dim);

      const dx = (dim - img.width) / 2;
      const dy = (dim - img.height) / 2;
      ctx.drawImage(img, dx, dy, img.width, img.height);

      resolve(canvas.toDataURL("image/jpeg", 1.0));
    };
    img.onerror = reject;
  });
};

export const removeSquarePadding = async (paddedBase64: string, originalBase64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const origImg = new Image();
    origImg.src = originalBase64;
    origImg.onload = () => {
      const padImg = new Image();
      padImg.src = paddedBase64;
      padImg.onload = () => {
        const canvas = document.createElement("canvas");
        // Revert to exactly vertical or horizontal dimensions
        canvas.width = origImg.width;
        canvas.height = origImg.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(paddedBase64);

        const dim = Math.max(origImg.width, origImg.height);
        const dx = (dim - origImg.width) / 2;
        const dy = (dim - origImg.height) / 2;

        // Draw only the central portion that corresponds to the original unpadded image
        ctx.drawImage(
          padImg,
          dx, dy, origImg.width, origImg.height,
          0, 0, origImg.width, origImg.height
        );

        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      padImg.onerror = reject;
    };
    origImg.onerror = reject;
  });
};;
