
import { FaceLandmarker, FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { JewelryCategory } from "../types";

let faceLandmarker: FaceLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;

const visionBaseUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

/**
 * Initialize MediaPipe Vision Tasks
 */
const initMediaPipe = async () => {
  const vision = await FilesetResolver.forVisionTasks(visionBaseUrl);

  if (!faceLandmarker) {
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        delegate: "GPU"
      },
      outputFaceBlendshapes: true,
      runningMode: "IMAGE",
      numFaces: 1,
    });
  }

  if (!handLandmarker) {
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "IMAGE",
      numHands: 2,
    });
  }
};

/**
 * Extracts normalized [ymin, xmin, ymax, xmax] bounding box for a specific jewelry category
 */
export const getDeterministicLandmarks = async (
  base64Image: string,
  category: JewelryCategory
): Promise<{
  landmarks: { label: string; box_2d: [number, number, number, number] }[];
  calibration?: { pupilDistancePx: number; referenceMm: number; pxPerMm: number };
} | null> => {
  try {
    await initMediaPipe();

    // Create an image element to process
    const img = new Image();
    img.src = base64Image;
    await new Promise((resolve) => { img.onload = resolve; });

    const landmarks: { label: string; box_2d: [number, number, number, number] }[] = [];
    let calibration = undefined;

    // 1. Run Detectors based on category
    const needsFace = [JewelryCategory.EARRINGS, JewelryCategory.NECKLACE, JewelryCategory.PENDANT].includes(category);
    const needsHands = [JewelryCategory.RINGS].includes(category);

    if (needsFace) {
      const result = faceLandmarker!.detect(img);
      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        const face = result.faceLandmarks[0];

        // --- CALIBRATION: Metric Reconstruction ---
        if (face.length >= 478) {
          // Biometric Constants (Averages)
          const REF_EYE_TO_CHIN_MM = 115;
          const REF_IRIS_DIAMETER_MM = 11.7;

          const lp = face[468]; // Left pupil
          const rp = face[473]; // Right pupil

          // Iris vertical bounds (Left Eye)
          const irisTop = face[470];
          const irisBottom = face[472];

          // 1. Eye-to-Chin Baseline (Broad Anchor)
          const pupilMidpointY = (lp.y + rp.y) / 2;
          const chinY = face[152].y;
          const eyeToChinUnits = Math.abs(chinY - pupilMidpointY) * 1000;

          // 2. Iris Diameter Baseline (Precision Anchor)
          const irisHeightUnits = Math.abs(irisTop.y - irisBottom.y) * 1000;

          if (eyeToChinUnits > 10) {
            // --- ROTATION DETECTION (Stability Check) ---
            // Vertical distance from eyes to nose vs eyes to chin
            const topOfNoseY = face[1].y;
            const eyeToNoseUnits = Math.abs(topOfNoseY - pupilMidpointY) * 1000;

            // Horizontal bias (Yaw check): 
            // In frontal view, eyes are equidistant from nose center.
            const noseX = face[1].x;
            const leftEyeDist = Math.abs(lp.x - noseX);
            const rightEyeDist = Math.abs(rp.x - noseX);
            const yawBias = Math.abs(leftEyeDist - rightEyeDist) / Math.max(0.001, Math.max(leftEyeDist, rightEyeDist));
            const isHeavyYaw = yawBias > 0.4; // Head is turned significantly

            // Calculate units/mm using both methods
            const unitsPerMm_ETC = eyeToChinUnits / REF_EYE_TO_CHIN_MM;
            const unitsPerMm_IRIS = irisHeightUnits / REF_IRIS_DIAMETER_MM;

            // Hybrid Logic with Rotation Compensation
            let finalUnitsPerMm;
            let calibrationMethod;

            if (isHeavyYaw) {
              // In profile views, IRIS height/width is highly unstable. Favor ETC.
              finalUnitsPerMm = unitsPerMm_ETC;
              calibrationMethod = "EYE_TO_CHIN (Profile Mode)";
            } else {
              // Normal View: Weighted blend (60% Iris for precision, 40% ETC for baseline)
              // Only use Iris if it seems reasonably accurate
              if (irisHeightUnits > 5 && Math.abs(unitsPerMm_IRIS / unitsPerMm_ETC - 1) < 0.3) {
                finalUnitsPerMm = (unitsPerMm_IRIS * 0.6) + (unitsPerMm_ETC * 0.4);
                calibrationMethod = "HYBRID_IRIS_ETC";
              } else {
                finalUnitsPerMm = unitsPerMm_ETC;
                calibrationMethod = "EYE_TO_CHIN (Fallback)";
              }
            }

            calibration = {
              pupilDistancePx: eyeToChinUnits,
              referenceMm: REF_EYE_TO_CHIN_MM,
              unitsPerMm: finalUnitsPerMm,
              eyeWidthUnits: irisHeightUnits,
              method: calibrationMethod
            };

            console.log(`[MediaPipe] ${calibrationMethod} ACTIVE: 1mm = ${finalUnitsPerMm.toFixed(2)}px (YawBias: ${yawBias.toFixed(2)})`);
          }
        }

        // --- BASELINE ORIENTATION LANDMARKS (Needed for all categories) ---
        const lp = face[468]; // Left pupil
        const rp = face[473]; // Right pupil
        const chinPt = face[152]; // Chin
        const foreheadPt = face[10]; // Top of head

        landmarks.push({ label: "left_pupil", box_2d: [lp.y * 1000 - 5, lp.x * 1000 - 5, lp.y * 1000 + 5, lp.x * 1000 + 5] });
        landmarks.push({ label: "right_pupil", box_2d: [rp.y * 1000 - 5, rp.x * 1000 - 5, rp.y * 1000 + 5, rp.x * 1000 + 5] });
        landmarks.push({ label: "chin", box_2d: [chinPt.y * 1000 - 5, chinPt.x * 1000 - 5, chinPt.y * 1000 + 5, chinPt.x * 1000 + 5] });
        landmarks.push({ label: "face", box_2d: [foreheadPt.y * 1000, 0, chinPt.y * 1000, 1000] });


        // --- ASSIGN LANDMARKS ---
        if (category === JewelryCategory.EARRINGS) {
          const leftEar = face[177]; // Precise left earlobe
          const rightEar = face[401]; // Precise right earlobe

          const createBox = (point: any, padding = 40): [number, number, number, number] => {
            const y = point.y * 1000;
            const x = point.x * 1000;
            return [y - padding, x - padding, y + padding, x + padding];
          };

          // Visibility Check: Z-coordinate is depth. Smaller Z is closer to camera.
          // If the difference in Z is significant, one ear is likely occluded.
          const zDiff = Math.abs(leftEar.z - rightEar.z);
          const isProfileView = zDiff > 0.15; // Profile threshold

          if (isProfileView) {
            // Only target the visible ear (the one with the smaller Z)
            const visibleEar = leftEar.z < rightEar.z ? leftEar : rightEar;
            const label = leftEar.z < rightEar.z ? "left_ear_visible" : "right_ear_visible";
            landmarks.push({ label: "left_ear", box_2d: createBox(leftEar) }); // Still provide for context
            landmarks.push({ label: "right_ear", box_2d: createBox(rightEar) });
            landmarks.push({ label: "target_region", box_2d: createBox(visibleEar) });
            console.log(`[MediaPipe] Profile View Detected. Targeting visible ear only (zDiff=${zDiff.toFixed(3)})`);
          } else {
            // Target both or default to left for backward compatibility
            landmarks.push({ label: "left_ear", box_2d: createBox(leftEar) });
            landmarks.push({ label: "right_ear", box_2d: createBox(rightEar) });
            landmarks.push({ label: "target_region", box_2d: createBox(leftEar) });
            landmarks.push({ label: "target_region_2", box_2d: createBox(rightEar) });
          }

        } else if (category === JewelryCategory.NECKLACE || category === JewelryCategory.PENDANT) {
          const chin = face[152];
          // Sternum is approx 0.6x face-scale-dist below chin
          const faceScale = calibration?.pupilDistancePx || 150;
          const yOffset = faceScale * 0.6;
          const y = (chin.y * 1000) + yOffset;
          const x = chin.x * 1000;

          // Tighter sternum region
          landmarks.push({ label: "target_region", box_2d: [y - 30, x - 50, y + 100, x + 50] });
        }
      }
    }

    if (needsHands) {
      const result = handLandmarker!.detect(img);
      if (result.landmarks && result.landmarks.length > 0) {
        const hand = result.landmarks[0];
        const ringPoint = hand[14]; // Ring finger MCP joint area
        const y = ringPoint.y * 1000;
        const x = ringPoint.x * 1000;
        landmarks.push({ label: "target_region", box_2d: [y - 30, x - 30, y + 30, x + 30] });
      }
    }

    return landmarks.length > 0 ? { landmarks, calibration } : null;
  } catch (err) {
    console.error("MediaPipe detection failed:", err);
    return null;
  }
};
