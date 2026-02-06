// AI Layout Generator - Compliant building layout generation for Tamil Nadu

import type { Building, SiteBoundary, PlacedUnit, CityType, ZoneType, Coordinate } from '../types';
import { getRegulations, getSetbackCategory, calculateAllowedFSI, calculateMaxHeight } from '../data/regulations';
import { UNIT_TEMPLATES, getUnitsByType } from '../data/unitTemplates';
import { sqftToSqm } from './calculations';
import * as turf from '@turf/turf';

interface GenerationOptions {
  targetUnitMix: { [bhkType: string]: number }; // Percentage distribution
  maxFloors?: number;
  stiltParking: boolean;
  optimizeFor: 'units' | 'fsi' | 'profit' | 'balanced';
  vastuCompliant: boolean;
}

interface BuildableEnvelope {
  coordinates: Coordinate[];
  area: number;
  width: number;
  depth: number;
  centerLng: number;
  centerLat: number;
}

interface FloorPlate {
  width: number;  // meters
  depth: number;  // meters
  corridorWidth: number;
  liftLobbyArea: number;
  staircaseArea: number;
  usableArea: number; // For units
}

// Calculate buildable area after applying setbacks
export const calculateBuildableEnvelope = (
  site: SiteBoundary,
  city: CityType,
  zone: ZoneType
): BuildableEnvelope => {
  const regulations = getRegulations(city);
  const zoneRules = regulations.zones[zone];
  const setbackCategory = getSetbackCategory(site.area);
  const setbacks = zoneRules.setbacks[setbackCategory];
  
  // Calculate maximum setback for buffering
  const maxSetback = Math.max(setbacks.front, setbacks.rear, setbacks.side1, setbacks.side2);
  
  try {
    // Create polygon from site coordinates
    const polygon = turf.polygon([[
      ...site.coordinates.map(c => [c.lng, c.lat]),
      [site.coordinates[0].lng, site.coordinates[0].lat]
    ]]);
    
    // Buffer inward by setback distance (convert meters to kilometers)
    const buffered = turf.buffer(polygon, -maxSetback / 1000, { units: 'kilometers' });
    
    if (!buffered || !buffered.geometry) {
      // Site too small for setbacks, return minimal envelope
      return createMinimalEnvelope(site);
    }
    
    const bbox = turf.bbox(buffered);
    const center = turf.center(buffered);
    
    // Convert bbox to approximate meters (at ~13° latitude for Chennai)
    const metersPerDegreeLng = 111320 * Math.cos(center.geometry.coordinates[1] * Math.PI / 180);
    const metersPerDegreeLat = 110540;
    
    const width = (bbox[2] - bbox[0]) * metersPerDegreeLng;
    const depth = (bbox[3] - bbox[1]) * metersPerDegreeLat;
    
    // Get coordinates from buffered polygon
    const coords = (buffered.geometry as any).coordinates[0].map((c: number[]) => ({
      lng: c[0],
      lat: c[1],
    }));
    
    return {
      coordinates: coords,
      area: turf.area(buffered),
      width,
      depth,
      centerLng: center.geometry.coordinates[0],
      centerLat: center.geometry.coordinates[1],
    };
  } catch (e) {
    return createMinimalEnvelope(site);
  }
};

const createMinimalEnvelope = (site: SiteBoundary): BuildableEnvelope => {
  const center = site.coordinates.reduce(
    (acc, c) => ({ lng: acc.lng + c.lng / site.coordinates.length, lat: acc.lat + c.lat / site.coordinates.length }),
    { lng: 0, lat: 0 }
  );
  return {
    coordinates: site.coordinates,
    area: site.area * 0.5, // Assume 50% buildable
    width: Math.sqrt(site.area * 0.5),
    depth: Math.sqrt(site.area * 0.5),
    centerLng: center.lng,
    centerLat: center.lat,
  };
};

// Design a compliant floor plate
const designFloorPlate = (
  maxWidth: number,
  maxDepth: number,
  floors: number
): FloorPlate => {
  // Standard corridor width as per NBC India
  const corridorWidth = 1.8; // meters (minimum for residential)
  
  // Lift lobby and staircase areas based on building height
  const liftCount = Math.max(1, Math.ceil(floors / 8));
  const liftLobbyArea = liftCount * 12; // ~12 sqm per lift lobby
  const staircaseArea = 2 * 15; // 2 staircases, ~15 sqm each (fire safety requirement)
  
  // Efficient floor plate dimensions (typical residential block)
  // Double-loaded corridor design for efficiency
  const effectiveWidth = Math.min(maxWidth, 45); // Max ~45m for natural light compliance
  const effectiveDepth = Math.min(maxDepth, 18); // ~18m depth for dual aspect units
  
  // Calculate usable area for units
  const grossFloorArea = effectiveWidth * effectiveDepth;
  const circulationArea = (corridorWidth * effectiveWidth) + liftLobbyArea + staircaseArea;
  const usableArea = grossFloorArea - circulationArea;
  
  return {
    width: effectiveWidth,
    depth: effectiveDepth,
    corridorWidth,
    liftLobbyArea,
    staircaseArea,
    usableArea: Math.max(0, usableArea),
  };
};

// Generate optimal building layout with compliance
export const generateLayout = (
  site: SiteBoundary,
  city: CityType,
  zone: ZoneType,
  roadWidth: number,
  options: GenerationOptions
): Building[] => {
  const regulations = getRegulations(city);
  const zoneRules = regulations.zones[zone];
  const setbackCategory = getSetbackCategory(site.area);
  const setbacks = zoneRules.setbacks[setbackCategory];
  
  // Get regulatory limits
  const allowedFSI = calculateAllowedFSI(roadWidth, zone, city, false);
  const maxCoverage = zoneRules.maxGroundCoverage;
  const maxHeight = calculateMaxHeight(roadWidth, setbacks.front, zone, city);
  
  // Calculate buildable envelope
  const envelope = calculateBuildableEnvelope(site, city, zone);
  
  // CRITICAL: Calculate maximum allowed areas
  const maxGroundCoverageArea = site.area * maxCoverage; // Ground floor footprint limit
  const maxTotalBuiltUp = site.area * allowedFSI; // Total built-up area limit
  
  // Floor height as per TN regulations
  const floorHeight = 3.0; // meters
  
  // Calculate optimal floor count
  const maxFloorsByHeight = Math.floor(maxHeight / floorHeight);
  const startFloor = options.stiltParking ? 1 : 0;
  
  // Design the floor plate within coverage limit
  const maxBuildingFootprint = Math.min(envelope.area, maxGroundCoverageArea);
  
  // Calculate building dimensions that fit within coverage
  // Assuming roughly square building for simplicity
  const targetFootprintArea = maxBuildingFootprint * 0.9; // 90% of max for safety margin
  const buildingSide = Math.sqrt(targetFootprintArea);
  
  // Design floor plate
  const floorPlate = designFloorPlate(
    Math.min(buildingSide, envelope.width),
    Math.min(buildingSide, envelope.depth),
    options.maxFloors || maxFloorsByHeight
  );
  
  const actualFootprint = floorPlate.width * floorPlate.depth;
  
  // Calculate how many floors we can have within FSI limit
  const maxFloorsByFSI = Math.floor(maxTotalBuiltUp / actualFootprint);
  
  // Determine optimal floors (most restrictive wins)
  let optimalFloors = Math.min(
    options.maxFloors || 15,
    maxFloorsByHeight,
    maxFloorsByFSI + startFloor // Add back stilt floor if applicable
  );
  
  // Ensure at least 2 floors (G+1) for residential
  optimalFloors = Math.max(2, optimalFloors);
  
  const residentialFloors = optimalFloors - startFloor;
  
  // Generate building footprint as rectangle centered in envelope
  const halfWidth = (floorPlate.width / 2) / 111320 / Math.cos(envelope.centerLat * Math.PI / 180);
  const halfDepth = (floorPlate.depth / 2) / 110540;
  
  const buildingFootprint: Coordinate[] = [
    { lng: envelope.centerLng - halfWidth, lat: envelope.centerLat - halfDepth },
    { lng: envelope.centerLng + halfWidth, lat: envelope.centerLat - halfDepth },
    { lng: envelope.centerLng + halfWidth, lat: envelope.centerLat + halfDepth },
    { lng: envelope.centerLng - halfWidth, lat: envelope.centerLat + halfDepth },
  ];
  
  // Calculate available area per floor for units
  const usableAreaPerFloor = floorPlate.usableArea;
  const totalUsableArea = usableAreaPerFloor * residentialFloors;
  
  // Generate units based on mix and available area
  const units = generateUnitsForBuilding(
    options.targetUnitMix,
    totalUsableArea,
    residentialFloors,
    startFloor,
    floorPlate,
    options.vastuCompliant
  );
  
  const building: Building = {
    id: 'building-1',
    name: 'Tower A',
    footprint: buildingFootprint,
    floors: optimalFloors,
    floorHeight,
    units,
    stiltParking: options.stiltParking,
    liftCores: Math.max(1, Math.ceil(optimalFloors / 8)),
    staircases: 2,
  };
  
  return [building];
};

// Generate units that fit within the floor plate
const generateUnitsForBuilding = (
  targetMix: { [bhkType: string]: number },
  totalUsableArea: number, // in sqm
  floors: number,
  startFloor: number,
  floorPlate: FloorPlate,
  vastuCompliant: boolean
): PlacedUnit[] => {
  const units: PlacedUnit[] = [];
  
  // Calculate total percentage
  const totalPercentage = Object.values(targetMix).reduce((a, b) => a + b, 0);
  if (totalPercentage === 0) return units;
  
  // Calculate how many units of each type based on area
  const unitAllocation: { bhkType: string; count: number; template: typeof UNIT_TEMPLATES[0] }[] = [];
  let totalAllocatedArea = 0;
  
  Object.entries(targetMix).forEach(([bhkType, percentage]) => {
    if (percentage <= 0) return;
    
    const availableUnits = getUnitsByType(bhkType);
    if (availableUnits.length === 0) return;
    
    // Pick standard variant, or first available
    let template = availableUnits.find(u => u.name.includes('Standard')) || availableUnits[0];
    
    // If vastu compliant requested, prefer vastu units
    if (vastuCompliant) {
      const vastuUnit = availableUnits.find(u => u.vastuCompliant);
      if (vastuUnit) template = vastuUnit;
    }
    
    // Calculate how much area this BHK type should occupy
    const areaForType = totalUsableArea * (percentage / totalPercentage);
    const unitAreaSqm = sqftToSqm(template.superBuiltUpArea);
    const unitCount = Math.floor(areaForType / unitAreaSqm);
    
    if (unitCount > 0) {
      unitAllocation.push({ bhkType, count: unitCount, template });
      totalAllocatedArea += unitCount * unitAreaSqm;
    }
  });
  
  // Distribute units across floors
  const unitsPerFloor = Math.ceil(
    unitAllocation.reduce((sum, u) => sum + u.count, 0) / floors
  );
  
  let unitIndex = 0;
  let currentFloor = startFloor;
  let unitsOnCurrentFloor = 0;
  
  // Layout units in a grid pattern on each floor
  const corridorY = floorPlate.depth / 2; // Corridor runs through middle
  
  unitAllocation.forEach(({ count, template }) => {
    for (let i = 0; i < count; i++) {
      // Move to next floor if current is full
      if (unitsOnCurrentFloor >= unitsPerFloor && currentFloor < startFloor + floors - 1) {
        currentFloor++;
        unitsOnCurrentFloor = 0;
      }
      
      // Calculate position on floor (double-loaded corridor layout)
      const side = unitsOnCurrentFloor % 2; // 0 = north side, 1 = south side
      const position = Math.floor(unitsOnCurrentFloor / 2);
      
      // Calculate X position along the corridor
      const xOffset = 2 + position * (template.width + 0.3); // 0.3m wall thickness
      
      // Calculate Y position (above or below corridor)
      let yOffset: number;
      if (side === 0) {
        yOffset = corridorY + floorPlate.corridorWidth / 2; // North side of corridor
      } else {
        yOffset = corridorY - floorPlate.corridorWidth / 2 - template.depth; // South side
      }
      
      units.push({
        id: `unit-${unitIndex++}`,
        unitTypeId: template.id,
        x: Math.max(0, xOffset),
        y: Math.max(0, yOffset),
        rotation: side === 1 ? 180 : 0, // Flip south-side units
        floor: currentFloor,
      });
      
      unitsOnCurrentFloor++;
    }
  });
  
  return units;
};

// Default unit mix for different city/zone combinations
export const getDefaultUnitMix = (city: CityType, zone: ZoneType): { [bhkType: string]: number } => {
  if (zone === 'residential') {
    if (city === 'chennai') {
      return {
        '1BHK': 15,
        '2BHK': 45,
        '2.5BHK': 15,
        '3BHK': 20,
        '4BHK': 5,
      };
    } else {
      // Coimbatore - more spacious units preferred
      return {
        '1BHK': 10,
        '2BHK': 35,
        '3BHK': 40,
        '4BHK': 15,
      };
    }
  }
  
  if (zone === 'commercial' || zone === 'it-corridor') {
    return {
      '1BHK': 30,
      '2BHK': 50,
      '3BHK': 20,
    };
  }
  
  // Mixed use
  return {
    '1RK': 10,
    '1BHK': 25,
    '2BHK': 40,
    '3BHK': 25,
  };
};

// Optimize layout for different goals
export const optimizeForUnits = (
  buildings: Building[],
  _site: SiteBoundary,
  _city: CityType,
  _zone: ZoneType
): Building[] => {
  return buildings.map(building => ({
    ...building,
    units: building.units.map(unit => {
      const unitType = UNIT_TEMPLATES.find(u => u.id === unit.unitTypeId);
      if (unitType && !['1BHK', '1RK'].includes(unitType.bhkType)) {
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

export const optimizeForProfit = (
  buildings: Building[],
  _site: SiteBoundary,
  _city: CityType,
  _zone: ZoneType
): Building[] => {
  return buildings.map(building => ({
    ...building,
    units: building.units.map(unit => {
      const unitType = UNIT_TEMPLATES.find(u => u.id === unit.unitTypeId);
      if (unitType) {
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
