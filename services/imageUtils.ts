
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

export interface PaddedImageResult {
  base64: string;
  originalWidth: number;
  originalHeight: number;
  offsetX: number;
  offsetY: number;
}

export const padImageToSquare = async (base64: string): Promise<PaddedImageResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const maxDim = Math.max(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = maxDim;
      canvas.height = maxDim;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("No Canvas Context");

      const offsetX = Math.floor((maxDim - img.width) / 2);
      const offsetY = Math.floor((maxDim - img.height) / 2);

      ctx.fillStyle = "rgba(0,0,0,1)"; // Black pad limits hallucination vs transparent
      ctx.fillRect(0, 0, maxDim, maxDim);
      ctx.drawImage(img, offsetX, offsetY, img.width, img.height);

      resolve({
        base64: canvas.toDataURL("image/png"),
        originalWidth: img.width,
        originalHeight: img.height,
        offsetX,
        offsetY
      });
    };
    img.onerror = reject;
  });
};

export const cropImageToOriginalSize = async (
  base64: string,
  padData: PaddedImageResult
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = padData.originalWidth;
      canvas.height = padData.originalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("No context");

      const originalMaxDim = Math.max(padData.originalWidth, padData.originalHeight);
      const scale = img.width / originalMaxDim;
      
      const scaledOffsetX = padData.offsetX * scale;
      const scaledOffsetY = padData.offsetY * scale;
      const scaledWidth = padData.originalWidth * scale;
      const scaledHeight = padData.originalHeight * scale;

      ctx.drawImage(
        img,
        scaledOffsetX, scaledOffsetY, scaledWidth, scaledHeight,
        0, 0, padData.originalWidth, padData.originalHeight
      );
      
      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = reject;
  });
};
