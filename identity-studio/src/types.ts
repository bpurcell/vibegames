export type Group = "portraits" | "expressions" | "body" | "variants";
export interface Shot {
  id: string;
  label: string;
  group: Group;
  instruction: string;
  yaw?: number;
  pitch?: number;
  optional?: boolean;
  manual?: boolean;
}
export interface Vision {
  faceDetected: boolean;
  centered: boolean | null;
  yaw: number | null;
  pitch: number | null;
  eyesOpen: boolean | null;
  faceSize: number | null;
}
export interface Quality {
  exposure: number;
  sharpness: number;
  resolution: boolean;
  hash: string;
  warnings: string[];
  vision: Vision | null;
  obstruction: null;
  lightingDelta: number | null;
  duplicateOf: string | null;
}
export interface Photo {
  shotId: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: string;
  source: "camera" | "import";
  quality: Quality;
}
export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  details: string;
  photos: Record<string, Photo>;
  skipped: string[];
}
