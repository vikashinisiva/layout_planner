// Floor Plan Generation API Service
// Connects React frontend to Python FastAPI backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export interface Coordinate {
  x: number;
  y: number;
}

export interface RoomRequest {
  type: 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'balcony';
  centroid: Coordinate;
  min_area?: number;
}

export interface GenerateFloorPlanRequest {
  boundary_wkt: string;
  front_door_wkt: string;
  rooms: RoomRequest[];
  bhk_config?: string;
  scale_origin?: [number, number];
}

export interface RoomOutput {
  type: string;
  category: number;
  coordinates: number[][];
  centroid: number[];
  width: number;
  height: number;
  area: number;
}

export interface GenerateFloorPlanResponse {
  success: boolean;
  rooms: RoomOutput[];
  boundary: number[][];
  total_area: number;
  message?: string;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  device: string;
}

/**
 * Check API health and model status
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Generate floor plan using AI model
 */
export async function generateFloorPlan(
  request: GenerateFloorPlanRequest
): Promise<GenerateFloorPlanResponse> {
  const response = await fetch(`${API_BASE_URL}/api/generate-floor-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to generate floor plan');
  }

  return response.json();
}

/**
 * Convert site polygon coordinates to WKT format
 */
export function polygonToWKT(coordinates: [number, number][]): string {
  const coordStr = coordinates.map(([x, y]) => `${x} ${y}`).join(', ');
  return `POLYGON((${coordStr}))`;
}

/**
 * Create a door polygon from a point and dimensions
 */
export function createDoorWKT(
  x: number,
  y: number,
  width: number = 4,
  height: number = 1
): string {
  const halfW = width / 2;
  const halfH = height / 2;
  return `POLYGON((${x - halfW} ${y - halfH}, ${x + halfW} ${y - halfH}, ${x + halfW} ${y + halfH}, ${x - halfW} ${y + halfH}, ${x - halfW} ${y - halfH}))`;
}

/**
 * Generate floor plan from BHK configuration (simplified)
 */
export async function generateFromBHK(
  boundaryWkt: string,
  frontDoorWkt: string,
  bhk: string = '2BHK'
): Promise<GenerateFloorPlanResponse> {
  const params = new URLSearchParams({
    boundary_wkt: boundaryWkt,
    front_door_wkt: frontDoorWkt,
    bhk: bhk,
  });

  const response = await fetch(`${API_BASE_URL}/api/generate-from-bhk?${params}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to generate floor plan');
  }

  return response.json();
}

/**
 * Get available room types
 */
export async function getRoomTypes(): Promise<{
  room_types: Record<string, number>;
  bhk_options: string[];
}> {
  const response = await fetch(`${API_BASE_URL}/api/room-types`);
  if (!response.ok) {
    throw new Error('Failed to fetch room types');
  }
  return response.json();
}

/**
 * Convert site boundary from lat/lng to local coordinates
 * Uses a simple equirectangular projection centered on the site
 */
export function latLngToLocal(
  latLng: [number, number],
  center: [number, number],
  scale: number = 1000
): [number, number] {
  const [lat, lng] = latLng;
  const [centerLat, centerLng] = center;
  
  // Simple equirectangular projection
  const x = (lng - centerLng) * Math.cos((centerLat * Math.PI) / 180) * scale;
  const y = (lat - centerLat) * scale;
  
  return [x + 128, y + 128]; // Center at (128, 128) for model
}

/**
 * Convert local coordinates back to lat/lng
 */
export function localToLatLng(
  local: [number, number],
  center: [number, number],
  scale: number = 1000
): [number, number] {
  const [x, y] = local;
  const [centerLat, centerLng] = center;
  
  const lng = (x - 128) / (Math.cos((centerLat * Math.PI) / 180) * scale) + centerLng;
  const lat = (y - 128) / scale + centerLat;
  
  return [lat, lng];
}

/**
 * Convert room output back to lat/lng coordinates
 */
export function convertRoomToLatLng(
  room: RoomOutput,
  center: [number, number],
  scale: number = 1000
): RoomOutput & { latLngCoordinates: [number, number][] } {
  const latLngCoords = room.coordinates.map(([x, y]) =>
    localToLatLng([x, y], center, scale)
  ) as [number, number][];

  return {
    ...room,
    latLngCoordinates: latLngCoords,
  };
}


// =============================================================================
// FLOOR PLATE OPTIMIZER API (Building-Level Generation)
// =============================================================================

export interface FloorPlateRequest {
  site_coordinates: { lng: number; lat: number }[];
  unit_program: { [bhkType: string]: number };
  num_floors: number;
  num_variants: number;
  stilt_parking: boolean;
  max_fsi: number;
  max_coverage: number;
  setbacks?: { front: number; rear: number; side1: number; side2: number };
}

export interface PlacedUnit {
  id: string;
  unitTypeId: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
  floor: number;
  hasBalcony: boolean;
  ventilationSides: string[];
  lng?: number;
  lat?: number;
}

export interface PlacedCore {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  liftCount: number;
  stairCount: number;
}

export interface Corridor {
  x: number;
  y: number;
  width: number;
  depth: number;
  type: string;
}

export interface FloorPlateResult {
  floorNumber: number;
  units: PlacedUnit[];
  cores: PlacedCore[];
  corridors: Corridor[];
  boundaryPolygon: [number, number][];
  boundaryPolygonLatLon?: { lng: number; lat: number }[];
  totalArea: number;
  usableArea: number;
  efficiency: number;
}

export interface BuildingVariant {
  id: string;
  name: string;
  shape: string;
  corridorType: string;
  floors: FloorPlateResult[];
  totalUnits: number;
  unitMix: { [bhkType: string]: number };
  totalBuiltUpArea: number;
  totalCarpetArea: number;
  fsiAchieved: number;
  groundCoverage: number;
  score: number;
}

export interface FloorPlateResponse {
  success: boolean;
  variants: BuildingVariant[];
  site_area: number;
  buildable_area: number;
  message: string;
}

export interface UnitTemplate {
  id: string;
  name: string;
  bhkType: string;
  width: number;
  depth: number;
  carpetArea: number;
  superBuiltUp: number;
  color: string;
}

export interface BuildingShape {
  id: string;
  name: string;
  description: string;
}

/**
 * Generate multiple building layout variants
 * This is the main Zenerate-level generation endpoint
 */
export async function generateFloorPlateVariants(
  request: FloorPlateRequest
): Promise<FloorPlateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/generate-floor-plate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to generate floor plate variants');
  }

  return response.json();
}

/**
 * Get available unit templates
 */
export async function getUnitTemplates(): Promise<{ templates: UnitTemplate[] }> {
  const response = await fetch(`${API_BASE_URL}/api/unit-templates`);
  if (!response.ok) {
    throw new Error('Failed to fetch unit templates');
  }
  return response.json();
}

/**
 * Get available building shapes
 */
export async function getBuildingShapes(): Promise<{
  shapes: BuildingShape[];
  corridorTypes: { id: string; name: string; description: string }[];
}> {
  const response = await fetch(`${API_BASE_URL}/api/building-shapes`);
  if (!response.ok) {
    throw new Error('Failed to fetch building shapes');
  }
  return response.json();
}
