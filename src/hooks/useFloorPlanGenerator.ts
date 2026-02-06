// React hook for floor plan generation API
import { useState, useCallback } from 'react';
import {
  generateFloorPlan,
  generateFromBHK,
  checkHealth,
  polygonToWKT,
  createDoorWKT,
  latLngToLocal,
  type GenerateFloorPlanRequest,
  type GenerateFloorPlanResponse,
  type HealthResponse,
} from '../services/floorPlanApi';

interface UseFloorPlanGeneratorOptions {
  autoRetry?: boolean;
  maxRetries?: number;
}

interface UseFloorPlanGeneratorReturn {
  // State
  isGenerating: boolean;
  error: string | null;
  generatedPlan: GenerateFloorPlanResponse | null;
  apiHealth: HealthResponse | null;
  
  // Actions
  generate: (request: GenerateFloorPlanRequest) => Promise<GenerateFloorPlanResponse | null>;
  generateSimple: (
    boundaryCoords: [number, number][],
    doorPosition: [number, number],
    bhk: string,
    center?: [number, number]
  ) => Promise<GenerateFloorPlanResponse | null>;
  checkApiHealth: () => Promise<HealthResponse | null>;
  clearError: () => void;
  reset: () => void;
}

export function useFloorPlanGenerator(
  options: UseFloorPlanGeneratorOptions = {}
): UseFloorPlanGeneratorReturn {
  const { autoRetry = true, maxRetries = 2 } = options;
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<GenerateFloorPlanResponse | null>(null);
  const [apiHealth, setApiHealth] = useState<HealthResponse | null>(null);

  const checkApiHealth = useCallback(async (): Promise<HealthResponse | null> => {
    try {
      const health = await checkHealth();
      setApiHealth(health);
      return health;
    } catch (err) {
      setError('API server is not running. Start the backend server first.');
      return null;
    }
  }, []);

  const generate = useCallback(async (
    request: GenerateFloorPlanRequest
  ): Promise<GenerateFloorPlanResponse | null> => {
    setIsGenerating(true);
    setError(null);
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= (autoRetry ? maxRetries : 0); attempt++) {
      try {
        const result = await generateFloorPlan(request);
        setGeneratedPlan(result);
        setIsGenerating(false);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        
        // Don't retry on validation errors
        if (lastError.message.includes('required') || lastError.message.includes('400')) {
          break;
        }
        
        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    setError(lastError?.message || 'Failed to generate floor plan');
    setIsGenerating(false);
    return null;
  }, [autoRetry, maxRetries]);

  const generateSimple = useCallback(async (
    boundaryCoords: [number, number][],
    doorPosition: [number, number],
    bhk: string,
    center?: [number, number]
  ): Promise<GenerateFloorPlanResponse | null> => {
    setIsGenerating(true);
    setError(null);
    
    try {
      // If center is provided, convert from lat/lng to local coordinates
      let localBoundary = boundaryCoords;
      let localDoor = doorPosition;
      
      if (center) {
        localBoundary = boundaryCoords.map(coord => latLngToLocal(coord, center));
        localDoor = latLngToLocal(doorPosition, center);
      }
      
      // Close the polygon if not closed
      if (
        localBoundary[0][0] !== localBoundary[localBoundary.length - 1][0] ||
        localBoundary[0][1] !== localBoundary[localBoundary.length - 1][1]
      ) {
        localBoundary = [...localBoundary, localBoundary[0]];
      }
      
      const boundaryWkt = polygonToWKT(localBoundary);
      const doorWkt = createDoorWKT(localDoor[0], localDoor[1]);
      
      const result = await generateFromBHK(boundaryWkt, doorWkt, bhk);
      setGeneratedPlan(result);
      setIsGenerating(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsGenerating(false);
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setError(null);
    setGeneratedPlan(null);
  }, []);

  return {
    isGenerating,
    error,
    generatedPlan,
    apiHealth,
    generate,
    generateSimple,
    checkApiHealth,
    clearError,
    reset,
  };
}

// Utility hook for converting BHK config to room count
export function useBHKParser(bhk: string): {
  bedrooms: number;
  bathrooms: number;
  hasHall: boolean;
  hasKitchen: boolean;
} {
  const match = bhk.match(/^(\d+)BHK$/i);
  const numBedrooms = match ? parseInt(match[1], 10) : 2;
  
  return {
    bedrooms: numBedrooms,
    bathrooms: Math.min(numBedrooms, 2), // Max 2 bathrooms
    hasHall: true,
    hasKitchen: true,
  };
}


// =============================================================================
// FLOOR PLATE OPTIMIZER HOOK (Building-Level Generation)
// =============================================================================

import {
  generateFloorPlateVariants,
  getUnitTemplates,
  getBuildingShapes,
  type FloorPlateRequest,
  type FloorPlateResponse,
  type BuildingVariant,
  type UnitTemplate,
  type BuildingShape,
} from '../services/floorPlanApi';

interface FloorPlateOptions {
  siteCoordinates: { lng: number; lat: number }[];
  unitProgram: { [bhkType: string]: number };
  numFloors: number;
  stiltParking: boolean;
  maxFsi: number;
  maxCoverage: number;
  setbacks?: { front: number; rear: number; side1: number; side2: number };
}

interface UseFloorPlateOptimizerReturn {
  // State
  isGenerating: boolean;
  error: string | null;
  variants: BuildingVariant[];
  selectedVariant: BuildingVariant | null;
  siteArea: number;
  buildableArea: number;
  unitTemplates: UnitTemplate[];
  buildingShapes: BuildingShape[];
  
  // Actions
  generateVariants: (options: FloorPlateOptions, numVariants?: number) => Promise<BuildingVariant[]>;
  selectVariant: (variantId: string) => void;
  loadTemplates: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export function useFloorPlateOptimizer(): UseFloorPlateOptimizerReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<BuildingVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<BuildingVariant | null>(null);
  const [siteArea, setSiteArea] = useState(0);
  const [buildableArea, setBuildableArea] = useState(0);
  const [unitTemplates, setUnitTemplates] = useState<UnitTemplate[]>([]);
  const [buildingShapes, setBuildingShapes] = useState<BuildingShape[]>([]);

  const generateVariants = useCallback(async (
    options: FloorPlateOptions,
    numVariants: number = 5
  ): Promise<BuildingVariant[]> => {
    if (options.siteCoordinates.length < 3) {
      setError('Site must have at least 3 coordinates');
      return [];
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      const request: FloorPlateRequest = {
        site_coordinates: options.siteCoordinates,
        unit_program: options.unitProgram,
        num_floors: options.numFloors,
        num_variants: numVariants,
        stilt_parking: options.stiltParking,
        max_fsi: options.maxFsi,
        max_coverage: options.maxCoverage,
        setbacks: options.setbacks,
      };

      const response = await generateFloorPlateVariants(request);
      
      if (response.success && response.variants.length > 0) {
        setVariants(response.variants);
        setSelectedVariant(response.variants[0]); // Auto-select best variant
        setSiteArea(response.site_area);
        setBuildableArea(response.buildable_area);
        setIsGenerating(false);
        return response.variants;
      } else {
        setError(response.message || 'No variants generated');
        setIsGenerating(false);
        return [];
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsGenerating(false);
      return [];
    }
  }, []);

  const selectVariant = useCallback((variantId: string) => {
    const variant = variants.find(v => v.id === variantId);
    if (variant) {
      setSelectedVariant(variant);
    }
  }, [variants]);

  const loadTemplates = useCallback(async () => {
    try {
      const [templatesRes, shapesRes] = await Promise.all([
        getUnitTemplates(),
        getBuildingShapes(),
      ]);
      setUnitTemplates(templatesRes.templates);
      setBuildingShapes(shapesRes.shapes);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setError(null);
    setVariants([]);
    setSelectedVariant(null);
    setSiteArea(0);
    setBuildableArea(0);
  }, []);

  return {
    isGenerating,
    error,
    variants,
    selectedVariant,
    siteArea,
    buildableArea,
    unitTemplates,
    buildingShapes,
    generateVariants,
    selectVariant,
    loadTemplates,
    clearError,
    reset,
  };
}
