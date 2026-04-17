import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { JewelryCategory } from "../types";

const MODEL_NAME = "gemini-2.5-flash-image";
const ANALYSIS_MODEL = "gemini-2.0-flash"; // Fast coordinate detection

// Use VITE_ prefix for browser-side environment variables
const GET_API_KEY = () => import.meta.env.VITE_GEMINI_API_KEY || "";

const detectMimeType = (base64: string): string => {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
};

const cleanBase64 = (data: string): string => {
  return data.includes(",") ? data.split(",")[1] : data;
};

/**
 * Stage 1: Spatial Analysis
 * Uses Gemini to detect precise anatomical landmarks in the person's photo.
 */
export const detectAnatomy = async (
  base64Image: string,
  category: string
): Promise<{ landmarks: { label: string; box_2d: [number, number, number, number] }[] }> => {
  const apiKey = GET_API_KEY();
  if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is not set in .env.local");

  const ai = new GoogleGenAI({ apiKey });
  const mimeType = detectMimeType(cleanBase64(base64Image));

  const detectionPrompt = `
    Detect the exact placement coordinates for the category "${category}":
    
    - "target_region": The precision anchor point.
      • For NECKLACE: Detect the sternum (the V-shaped area where the pendant should naturally rest on the chest, centered horizontally).
      • For EARRINGS: Detect the center of the earlobe (ear piercing point).
      • For RINGS: Detect the midpoint of the proximal phalanx (the base section) of the ring finger.
    
    Return the coordinates in normalized [ymin, xmin, ymax, xmax] format (0-1000).
    Return ONLY valid JSON: { "landmarks": [{ "label": "target_region", "box_2d": [...] }] }
  `;

  const result = await (ai.models as any).generateContent({
    model: ANALYSIS_MODEL,
    contents: [{
      role: "user",
      parts: [
        { text: detectionPrompt },
        { inlineData: { data: cleanBase64(base64Image), mimeType } }
      ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.0,
    }
  });

  try {
    let text = result.response.text().trim();
    // Healing: Sometimes model wraps JSON in markdown blocks even with mimeType set
    if (text.startsWith("```json")) text = text.replace(/```json|```/g, "").trim();

    const data = JSON.parse(text);

    // Healing: If the model returns just an array, wrap it
    if (Array.isArray(data)) {
      return { landmarks: data };
    }

    if (data.landmarks) {
      return data;
    }

    return { landmarks: [] };
  } catch (e) {
    console.warn("[Gemini] Landmark parsing failed:", e);
    return { landmarks: [] };
  }
};

/**
 * Stage 0: Jewelry Asset Analysis
 * Detects the bounding box of the actual "focal piece" (pendant, earring body, etc.) 
 * within the jewelry asset image itself. This allows us to scale the PENDANT to 
 * X mm, rather than scaling the WHOLE ASSET (which may include a long chain) to X mm.
 */
export const analyzeJewelryAsset = async (
  base64Image: string,
  category: string
): Promise<{ focal_box: [number, number, number, number] }> => {
  const apiKey = GET_API_KEY();
  if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is not set.");

  const ai = new GoogleGenAI({ apiKey });
  const mimeType = detectMimeType(cleanBase64(base64Image));

  const analysisPrompt = `
    Analyze this jewelry asset image for the category "${category}".
    Identify the bounding box [ymin, xmin, ymax, xmax] (0-1000) for the PRIMARY focal element ONLY.
    - If it's a necklace/pendant, detect the central pendant/charm area only, EXCLUDING the chain reaching the top.
    - If it's an earring, detect the main earring body, excluding the hook if possible.
    - If no distinct focal piece exists (e.g. a simple band), detect the entire object.
    
    Return ONLY valid JSON: { "focal_box": [ymin, xmin, ymax, xmax] }
  `;

  try {
    const result = await (ai.models as any).generateContent({
      model: ANALYSIS_MODEL,
      contents: [{
        role: "user",
        parts: [
          { text: analysisPrompt },
          { inlineData: { data: cleanBase64(base64Image), mimeType } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    });

    let text = result.response.text().trim();
    // Healing: Sometimes model wraps JSON in markdown blocks even with mimeType set
    if (text.startsWith("```json")) text = text.replace(/```json|```/g, "").trim();
    else if (text.startsWith("```")) text = text.replace(/```/g, "").trim();

    return JSON.parse(text);
  } catch (e) {
    console.warn("Jewelry asset analysis failed, defaulting to whole image focus.", e);
    return { focal_box: [0, 0, 1000, 1000] };
  }
};

export const processJewelryFitting = async (
  personImageBase64: string,
  jewelryImageBase64: string,
  category?: JewelryCategory,
  dimensions?: { height: number; width: number; aspectRatio?: number },
  deterministicData?: {
    landmarks: { label: string; box_2d: [number, number, number, number] }[];
    calibration?: { pupilDistancePx: number; referenceMm: number; unitsPerMm: number; eyeWidthUnits?: number; method?: string };
  } | null
): Promise<string> => {
  const apiKey = GET_API_KEY();
  if (!apiKey) {
    throw new Error("An API Key must be set in .env.local (VITE_GEMINI_API_KEY)");
  }

  const ai = new GoogleGenAI({ apiKey });
  const cleanPerson = cleanBase64(personImageBase64);
  const cleanJewelry = cleanBase64(jewelryImageBase64);
  const personMime = detectMimeType(cleanPerson);
  const jewelryMime = detectMimeType(cleanJewelry);

  const normalizedCategory = category?.toLowerCase();

  // --- STAGE 0: ASSET ANALYSIS ---
  const assetAnalysis = await analyzeJewelryAsset(jewelryImageBase64, normalizedCategory || "jewelry");
  const focalBox = assetAnalysis.focal_box;
  const focalHeightUnits = focalBox[2] - focalBox[0];
  const focalToAssetHeightRatio = Math.max(0.1, focalHeightUnits / 1000);

  // Normalized center of the focal piece WITHIN the asset image (0-1000)
  const focalCenterYInAsset = (focalBox[0] + focalBox[2]) / 2;
  const focalCenterXInAsset = (focalBox[1] + focalBox[3]) / 2;

  // --- STAGE 1: SPATIAL ANALYSIS ---
  let analysis: { landmarks: { label: string; box_2d: [number, number, number, number] }[] };
  const calibration = deterministicData?.calibration;

  if (deterministicData?.landmarks && deterministicData.landmarks.length > 0) {
    analysis = { landmarks: deterministicData.landmarks };
  } else {
    analysis = await detectAnatomy(personImageBase64, normalizedCategory || "jewelry");
  }

  const targetLandmarks = analysis.landmarks.filter(l => l.label.startsWith("target_region"));

  let spatialGuidance = "";
  let targetTotalPxHeight = 0;

  if (targetLandmarks.length > 0) {
    // We'll use the first target for primary scaling math
    const primaryTarget = targetLandmarks[0];
    const ymin = primaryTarget.box_2d[0], xmin = primaryTarget.box_2d[1], ymax = primaryTarget.box_2d[2], xmax = primaryTarget.box_2d[3];
    const targetAnchorY = (ymin + ymax) / 2;
    const targetAnchorX = (xmin + xmax) / 2;

    let halfH = 30;
    let halfW = 20;

    // --- DETERMINISTIC SCALING MODE (Accuracy Lockdown) ---
    let effectiveHeight = dimensions?.height || 0;
    
    if (dimensions && (dimensions.height > 0 || dimensions.width > 0) && calibration) {
      const assetAR = dimensions.aspectRatio || 1.0;

      // Determine driving dimension 
      if (!effectiveHeight || effectiveHeight <= 0) {
          effectiveHeight = dimensions.width / assetAR; 
      }

      // Convert user's goal height (for the FOCAL PIECE) to total ASSET pixel height
      const focalPxHeight = effectiveHeight * calibration.unitsPerMm;
      targetTotalPxHeight = focalPxHeight / focalToAssetHeightRatio;
      const targetTotalPxWidth = targetTotalPxHeight * assetAR;

      halfH = targetTotalPxHeight / 2;
      halfW = targetTotalPxWidth / 2;

      /**
       * FOCAL ALIGNMENT LOGIC:
       */
      const assetCenterY = 500;
      const unitOffsetFromCenter = (focalCenterYInAsset - assetCenterY);
      const pxOffsetFromCenter = (unitOffsetFromCenter / 1000) * targetTotalPxHeight;

      var finalCenterY = targetAnchorY - pxOffsetFromCenter;
      var finalCenterX = targetAnchorX;
    } else {
      var finalCenterY = targetAnchorY;
      var finalCenterX = targetAnchorX;
    }

    const finalBoxes = targetLandmarks.map(tl => {
      const tAY = (tl.box_2d[0] + tl.box_2d[2]) / 2;
      const tAX = (tl.box_2d[1] + tl.box_2d[3]) / 2;
      const fCY = tAY - (targetTotalPxHeight ? ((focalCenterYInAsset - 500) / 1000) * targetTotalPxHeight : 0);
      return [
        fCY - halfH,
        tAX - halfW,
        fCY + halfH,
        tAX + halfW
      ].map(v => Math.round(Math.max(0, Math.min(1000, v))));
    });

    const focalScalePercentage = (calibration?.pupilDistancePx && effectiveHeight > 0)
      ? ((effectiveHeight * calibration.unitsPerMm / calibration.pupilDistancePx) * 100).toFixed(1)
      : "unknown";

    console.log(`[Focal-Scale] Active Targets: ${targetLandmarks.length}`);

    spatialGuidance = `
### MATHEMATICAL SCALING (CRITICAL TRUTH):
1. TARGET BOUNDING BOXES: You MUST render the jewelry focal element exactly within these bounding boxes: ${JSON.stringify(finalBoxes)}.
   - The coordinates are formatted exactly as [ymin, xmin, ymax, xmax].
   - The coordinates use a strictly normalized 0 to 1000 scale (where 0,0 is the top-left and 1000,1000 is the bottom-right of the image).
2. PHYSICAL SCALE RATIO: The height of the jewelry's core piece represents exactly ${focalScalePercentage}% of the physical distance between the user's eyes and their chin. 
3. ALIGNMENT: Lock the center of the jewelry strictly to: ${JSON.stringify(targetLandmarks.map(tl => [(tl.box_2d[0] + tl.box_2d[2]) / 2, (tl.box_2d[1] + tl.box_2d[3]) / 2]))}.
`;
  }

  // --- CATEGORY RULES ---
  let categoryRules = `• Place jewelry on correct anatomical location.`;
  if (normalizedCategory === "earrings") {
    categoryRules += ` 
    • EXCLUSIVE ANCHOR: Earring must anchor ONLY at the ear piercing point/earlobe center. 
    • PROFILE_VIEW_LOGIC: In profile or side views (like the one provided), only render ONE earring on the visible ear. Do not hallucinate a second earring on the cheek or neck.
    • FORBIDDEN: NEVER place earrings on skin, hair, neck, shoulders, sunglasses, or clothing.`;
  } else if (normalizedCategory === "necklace" || normalizedCategory === "pendant") {
    categoryRules += ` • Center the pendant precisely on the sternum area (the V-shaped notch at the base of the neck). • The chain must flow naturally following the body's curves.`;
  }

  const synthesisPrompt = `
### Role: Precision Jewelry Compositor.
### Task: Render the JEWELRY_ASSET onto the PERSON_IMAGE.

${spatialGuidance}

### VISUAL INTEGRATION & FRAME COMPLIANCE:
${categoryRules}
• FULL FRAME PRESERVATION (CRITICAL): You MUST output the ENTIRE PERSON_IMAGE. You are explicitly FORBIDDEN from cropping the original image. 
• NO SQUARE CROPPING: Do NOT default to a 1:1 square output unless the source is square. You MUST maintain the exact original aspect ratio (e.g. vertical portrait, widescreen).
• LIGHTING: Apply realistic lighting, matching the face's specular highlights and environmental tone.
• CONTACT SHADOW: Apply a subtle 20% opacity shadow where the jewelry touches the skin.

### MICRO-SCALE LOCKDOWN:
• AREA STRICTNESS: The bounding box is the ONLY source of truth for size. Never adjust the size dynamically.
• STREAK ACCURACY: If the designated box area is visually tiny or microscopic, the jewelry MUST be tiny/microscopic. DO NOT enlarge it for visibility. 
• HONOR THE BOX: The provided [TARGET BOUNDING BOXES] are absolute and mathematically proven. Do not deviate from them.

Return ONLY the processed image without any padding or borders beyond the original frame.
`;

  try {
    const response: GenerateContentResponse = await (ai.models as any).generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: "user",
          parts: [
            { text: "SOURCE_PERSON:" },
            { inlineData: { data: cleanPerson, mimeType: personMime } },
            { text: "MASTER_ASSET:" },
            { inlineData: { data: cleanJewelry, mimeType: jewelryMime } },
            { text: synthesisPrompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1
      }
    });

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(part => part.inlineData);

    if (imagePart?.inlineData?.data) {
      return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
    }
    throw new Error("Model failed to return image.");
  } catch (error) {
    console.error("Jewelry fitting error:", error);
    throw new Error("Failed to generate edited jewelry image.");
  }
};