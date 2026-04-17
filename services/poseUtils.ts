
/**
 * Utility for calculating transformation parameters for virtual try-on.
 */

export interface PoseTransform {
    rotation: number; // in radians
    scale: number;    // relative scale multiplier
    translateX: number;
    translateY: number;
}

/**
 * Calculates the rotation angle (roll) of the head based on pupil positions.
 */
export const calculateRoll = (landmarks: { label: string; box_2d: [number, number, number, number] }[]): number => {
    const lp = landmarks.find(l => l.label === "left_pupil");
    const rp = landmarks.find(l => l.label === "right_pupil");

    if (!lp || !rp) return 0;

    // Center points of the boxes
    const lpX = (lp.box_2d[1] + lp.box_2d[3]) / 2;
    const lpY = (lp.box_2d[0] + lp.box_2d[2]) / 2;
    const rpX = (rp.box_2d[1] + rp.box_2d[3]) / 2;
    const rpY = (rp.box_2d[0] + rp.box_2d[2]) / 2;

    // Calculate angle between the eyes
    const dy = rpY - lpY;
    const dx = rpX - lpX;

    return Math.atan2(dy, dx);
};

/**
 * Calculates the horizontal rotation (yaw) bias.
 * Returns a value where 0 is perfectly frontal, and >0 is turned.
 */
export const calculateYawBias = (landmarks: { label: string; box_2d: [number, number, number, number] }[]): number => {
    const lp = landmarks.find(l => l.label === "left_pupil");
    const rp = landmarks.find(l => l.label === "right_pupil");
    const chin = landmarks.find(l => l.label === "chin");

    if (!lp || !rp || !chin) return 0;

    const lpX = (lp.box_2d[1] + lp.box_2d[3]) / 2;
    const rpX = (rp.box_2d[1] + rp.box_2d[3]) / 2;
    const chinX = (chin.box_2d[1] + chin.box_2d[3]) / 2;

    const leftDist = Math.abs(lpX - chinX);
    const rightDist = Math.abs(rpX - chinX);

    return (leftDist - rightDist) / Math.max(1, leftDist + rightDist);
};

/**
 * Adjusts the anchor point for a specific jewelry category based on head rotation.
 */
export const getAdjustedAnchor = (
    baseAnchor: { x: number; y: number },
    roll: number,
    yawBias: number,
    category: string
): { x: number; y: number } => {
    // Basic implementation - can be expanded for more complex perspective shifts
    return baseAnchor;
};
