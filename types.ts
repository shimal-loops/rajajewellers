
export interface ImageData {
  base64: string | null;
  previewUrl: string;
  name: string;
}

export enum JewelryCategory {
  NECKLACE = 'NECKLACE',
  PENDANT = 'PENDANT',
  EARRINGS = 'EARRINGS',
  BRACELET = 'BRACELET',
  BANGLE = 'BANGLE',
  RINGS = 'RINGS'
}

export interface JewelryItem {
  id: string;
  name: string;
  category: JewelryCategory;
  image: ImageData;
  height: number;
  width: number;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export enum ManagerStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface Manager {
  id: string;
  username: string;
  email: string | null;
  google_id: string | null;
  status: ManagerStatus;
  last_login: string | null;
  created_at: string;
}

export interface Fitting {
  id: string;
  userName: string;
  userEmail: string | null;
  userPhone: string | null;
  portraitPath: string;
  resultPath: string;
  createdAt: string;
}

export interface LandmarkBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface AnatomicalAnalysis {
  landmarks: {
    label: string;
    box_2d: [number, number, number, number];
  }[];
  ppi_estimate?: number; // Pixels Per Inch (or MM) for scaling
}
