// AI Layout Generator - Constraint-based building layout generation

import type { Building, SiteBoundary, PlacedUnit, CityType, ZoneType, Coordinate } from '../types';
import { getRegulations, getSetbackCategory, calculateAllowedFSI, calculateMaxHeight } from '../data/regulations';
import { UNIT_TEMPLATES, getUnitsByType } from '../data/unitTemplates';
import { calculatePolygonArea } from './calculations';
import * as turf from '@turf/turf';

interface GenerationOptions {
  targetUnitMix: { [bhkType: string]: number }; // Percentage distribution
  maxFloors?: number;
  stiltParking: boolean;
  optimizeFor: 'units' | 'fsi' | 'profit';
  vastuCompliant: boolean;
}

interface BuildableArea {
  coordinates: Coordinate[];
  area: number;
  width: number;
  depth: number;
  centerX: number;
  centerY: number;
}

// Calculate buildable area after applying setbacks
export const calculateBuildableArea = (
  site: SiteBoundary,
  city: CityType,
  zone: ZoneType
): BuildableArea => {
  const regulations = getRegulations(city);
  const zoneRules = regulations.zones[zone];
  const setbackCategory = getSetbackCategory(site.area);
  const setbacks = zoneRules.setbacks[setbackCategory];
  
  // For simplicity, assume rectangular site and apply uniform setback
  // In production, use proper polygon buffering
  const avgSetback = (setbacks.front + setbacks.rear + setbacks.side1 + setbacks.side2) / 4;
  
  // Buffer the polygon inward
  const polygon = turf.polygon([[
    ...site.coordinates.map(c => [c.lng, c.lat]),
    [site.coordinates[0].lng, site.coordinates[0].lat]
  ]]);
  
  const buffered = turf.buffer(polygon, -avgSetback / 1000, { units: 'kilometers' });
  
  if (!buffered) {
    return {
      coordinates: [],
      area: 0,
      width: 0,
      depth: 0,
      centerX: 0,
      centerY: 0,
    };
  }
  
  const bbox = turf.bbox(buffered);
  const center = turf.center(buffered);
  
  // Convert back to our coordinate format
  const coords = (buffered.geometry as any).coordinates[0].map((c: number[]) => ({
    lng: c[0],
    lat: c[1],
  }));
  
  return {
    coordinates: coords,
    area: turf.area(buffered),
    width: (bbox[2] - bbox[0]) * 111000, // Approximate meters
    depth: (bbox[3] - bbox[1]) * 111000,
    centerX: center.geometry.coordinates[0],
    centerY: center.geometry.coordinates[1],
  };
};

// Generate optimal building layout
export const generateLayout = (
  site: SiteBoundary,
  city: CityType,
  zone: ZoneType,
  roadWidth: number,
  options: GenerationOptions
): Building[] => {
  const regulations = getRegulations(city);
  const zoneRules = regulations.zones[zone];
  
  const allowedFSI = calculateAllowedFSI(roadWidth, zone, city, false);
  const maxCoverage = zoneRules.maxGroundCoverage;
  const maxHeight = calculateMaxHeight(roadWidth, 3, zone, city); // Assuming 3m front setback
  
  const buildableArea = calculateBuildableArea(site, city, zone);
  
  // Calculate maximum buildable floor area
  const maxGroundFloorArea = site.area * maxCoverage;
  const maxTotalBuiltUp = site.area * allowedFSI;
  
  // Determine optimal number of floors
  const floorHeight = 3.0; // meters
  let optimalFloors = Math.min(
    options.maxFloors || 15,
    Math.floor(maxHeight / floorHeight),
    Math.ceil(maxTotalBuiltUp / maxGroundFloorArea)
  );
  
  // Account for stilt parking
  if (options.stiltParking) {
    optimalFloors = Math.max(1, optimalFloors); // At least ground + stilt
  }
  
  // Generate building footprint
  const buildings: Building[] = [];
  
  // For MVP, generate a single building covering buildable area
  const buildingFootprint = buildableArea.coordinates.length > 0 
    ? buildableArea.coordinates 
    : site.coordinates;
  
  const groundFloorArea = calculatePolygonArea(buildingFootprint);
  
  // Generate units for each floor
  const units: PlacedUnit[] = [];
  const startFloor = options.stiltParking ? 1 : 0; // Skip ground floor if stilt parking
  
  // Calculate how many units can fit per floor based on unit mix
  const totalFloors = optimalFloors - startFloor;
  const targetTotalUnits = Math.floor((groundFloorArea * totalFloors) / 100); // Rough estimate: 100 sqm per unit avg
  
  // Distribute units according to mix
  Object.entries(options.targetUnitMix).forEach(([bhkType, percentage]) => {
    const unitCount = Math.round(targetTotalUnits * (percentage / 100));
    const availableUnits = getUnitsByType(bhkType);
    
    if (availableUnits.length === 0) return;
    
    // Pick the standard variant
    const unitTemplate = availableUnits.find(u => u.name.includes('Standard')) || availableUnits[0];
    
    // Distribute across floors
    for (let i = 0; i < unitCount; i++) {
      const floor = startFloor + (i % totalFloors);
      const positionOnFloor = Math.floor(i / totalFloors);
      
      // Calculate position (simple grid layout)
      const unitsPerRow = Math.floor(Math.sqrt(groundFloorArea) / unitTemplate.width);
      const row = Math.floor(positionOnFloor / Math.max(1, unitsPerRow));
      const col = positionOnFloor % Math.max(1, unitsPerRow);
      
      units.push({
        id: `unit-${bhkType}-${i}`,
        unitTypeId: unitTemplate.id,
        x: col * unitTemplate.width,
        y: row * unitTemplate.depth,
        rotation: 0,
        floor,
      });
    }
  });
  
  buildings.push({
    id: 'building-1',
    name: 'Tower A',
    footprint: buildingFootprint,
    floors: optimalFloors,
    floorHeight,
    units,
    stiltParking: options.stiltParking,
    liftCores: Math.ceil(optimalFloors / 8), // 1 lift per 8 floors
    staircases: 2, // Minimum 2 staircases for fire safety
  });
  
  return buildings;
};

// Default unit mix for different city/zone combinations
export const getDefaultUnitMix = (city: CityType, zone: ZoneType): { [bhkType: string]: number } => {
  if (zone === 'residential') {
    if (city === 'chennai') {
      // Chennai preferences
      return {
        '1BHK': 15,
        '2BHK': 45,
        '2.5BHK': 15,
        '3BHK': 20,
        '4BHK': 5,
      };
    } else {
      // Coimbatore preferences - more 2BHK and 3BHK
      return {
        '1BHK': 10,
        '2BHK': 40,
        '3BHK': 35,
        '4BHK': 15,
      };
    }
  }
  
  // Mixed use - more compact units
  return {
    '1RK': 10,
    '1BHK': 25,
    '2BHK': 40,
    '3BHK': 25,
  };
};

// Optimize layout for maximum units
export const optimizeForUnits = (
  buildings: Building[],
  _site: SiteBoundary,
  _city: CityType,
  _zone: ZoneType
): Building[] => {
  // Use smaller unit types to maximize count
  return buildings.map(building => ({
    ...building,
    units: building.units.map(unit => {
      const unitType = UNIT_TEMPLATES.find(u => u.id === unit.unitTypeId);
      if (unitType && unitType.bhkType !== '1BHK' && unitType.bhkType !== '1RK') {
        // Try to find a smaller variant
        const smallerVariant = UNIT_TEMPLATES.find(
          u => u.bhkType === unitType.bhkType && u.name.includes('Compact')
        );
        if (smallerVariant) {
          return { ...unit, unitTypeId: smallerVariant.id };
        }
      }
      return unit;
    }),
  }));
};

// Optimize layout for maximum profit
export const optimizeForProfit = (
  buildings: Building[],
  _site: SiteBoundary,
  _city: CityType,
  _zone: ZoneType
): Building[] => {
  // Use premium unit types which typically have better margins
  return buildings.map(building => ({
    ...building,
    units: building.units.map(unit => {
      const unitType = UNIT_TEMPLATES.find(u => u.id === unit.unitTypeId);
      if (unitType) {
        // Try to find a premium variant
        const premiumVariant = UNIT_TEMPLATES.find(
          u => u.bhkType === unitType.bhkType && u.name.includes('Premium')
        );
        if (premiumVariant) {
          return { ...unit, unitTypeId: premiumVariant.id };
        }
      }
      return unit;
    }),
  }));
};
