// Calculation Utilities

import * as turf from '@turf/turf';
import type { 
  Coordinate, 
  Building, 
  Metrics, 
  FinancialAnalysis,
  CityType,
  ZoneType,
  SiteBoundary
} from '../types';
import { 
  getRegulations, 
  getSetbackCategory, 
  calculateAllowedFSI,
  CHENNAI_PRICING,
  COIMBATORE_PRICING,
  CONSTRUCTION_COSTS,
  TN_TAX_RATES
} from '../data/regulations';
import { getUnitById } from '../data/unitTemplates';

export const calculatePolygonArea = (coordinates: Coordinate[]): number => {
  if (coordinates.length < 3) return 0;
  
  const polygon = turf.polygon([[
    ...coordinates.map(c => [c.lng, c.lat]),
    [coordinates[0].lng, coordinates[0].lat]
  ]]);
  
  return turf.area(polygon); // Returns area in square meters
};

export const sqmToSqft = (sqm: number): number => sqm * 10.764;
export const sqftToSqm = (sqft: number): number => sqft / 10.764;

export const calculateMetrics = (
  site: SiteBoundary,
  buildings: Building[],
  city: CityType,
  zone: ZoneType,
  roadWidth: number,
  usePremiumFSI: boolean
): Metrics => {
  const regulations = getRegulations(city);
  const zoneRules = regulations.zones[zone];
  const setbackCategory = getSetbackCategory(site.area);
  const setbacks = zoneRules.setbacks[setbackCategory];
  
  // Calculate total built-up area
  let totalBuiltUpArea = 0;
  let totalCarpetArea = 0;
  let totalSuperBuiltUpArea = 0;
  let totalUnits = 0;
  const unitMix: { [key: string]: number } = {};
  
  buildings.forEach(building => {
    const buildingFootprint = calculatePolygonArea(building.footprint);
    totalBuiltUpArea += buildingFootprint * building.floors;
    
    building.units.forEach(unit => {
      const unitType = getUnitById(unit.unitTypeId);
      if (unitType) {
        totalCarpetArea += sqftToSqm(unitType.carpetArea);
        totalSuperBuiltUpArea += sqftToSqm(unitType.superBuiltUpArea);
        totalUnits++;
        unitMix[unitType.bhkType] = (unitMix[unitType.bhkType] || 0) + 1;
      }
    });
  });
  
  // Calculate ground coverage
  let totalGroundCoverage = 0;
  buildings.forEach(building => {
    totalGroundCoverage += calculatePolygonArea(building.footprint);
  });
  
  const fsi = site.area > 0 ? totalBuiltUpArea / site.area : 0;
  const groundCoverage = site.area > 0 ? totalGroundCoverage / site.area : 0;
  const allowedFSI = calculateAllowedFSI(roadWidth, zone, city, usePremiumFSI);
  
  // Parking calculations
  const parkingRequired = Math.ceil(totalBuiltUpArea / zoneRules.parking.carSpacesPerSqm);
  const twoWheelerRequired = Math.ceil(totalBuiltUpArea / zoneRules.parking.twoWheelerPerSqm);
  
  // TODO: Calculate provided parking from building data
  const parkingProvided = buildings.reduce((acc, b) => {
    // Estimate based on stilt parking
    if (b.stiltParking) {
      const footprint = calculatePolygonArea(b.footprint);
      return acc + Math.floor(footprint / 25); // ~25 sqm per car space
    }
    return acc;
  }, 0);
  
  // Calculate max allowed height
  const maxHeight = 1.5 * (roadWidth + setbacks.front);
  const actualMaxHeight = Math.max(...buildings.map(b => b.floors * b.floorHeight));
  
  return {
    totalPlotArea: site.area,
    totalBuiltUpArea,
    totalCarpetArea,
    totalSuperBuiltUpArea,
    fsi,
    groundCoverage,
    allowedFSI,
    allowedCoverage: zoneRules.maxGroundCoverage,
    totalUnits,
    unitMix,
    parkingRequired,
    parkingProvided,
    twoWheelerRequired,
    twoWheelerProvided: Math.floor(parkingProvided * 1.5), // Estimate
    compliance: {
      fsi: fsi <= allowedFSI,
      coverage: groundCoverage <= zoneRules.maxGroundCoverage,
      setbacks: true, // TODO: Implement setback validation
      parking: parkingProvided >= parkingRequired,
      height: actualMaxHeight <= maxHeight,
    }
  };
};

export const calculateFinancials = (
  metrics: Metrics,
  city: CityType,
  locality: string = 'default',
  constructionType: 'basic' | 'standard' | 'premium' | 'luxury' = 'standard',
  landCostPerSqft: number = 0
): FinancialAnalysis => {
  const pricing = city === 'chennai' ? CHENNAI_PRICING : COIMBATORE_PRICING;
  const pricePerSqft = pricing[locality] || pricing['default'];
  
  const totalSaleableArea = sqmToSqft(metrics.totalSuperBuiltUpArea);
  const grossDevelopmentValue = totalSaleableArea * pricePerSqft;
  
  const constructionCostPerSqft = CONSTRUCTION_COSTS[constructionType];
  const constructionCost = sqmToSqft(metrics.totalBuiltUpArea) * constructionCostPerSqft;
  
  const landCost = landCostPerSqft > 0 
    ? sqmToSqft(metrics.totalPlotArea) * landCostPerSqft 
    : grossDevelopmentValue * 0.35; // Estimate land at 35% of GDV
  
  const stampDuty = grossDevelopmentValue * TN_TAX_RATES.stampDuty;
  const registrationCharges = grossDevelopmentValue * TN_TAX_RATES.registrationCharges;
  const gst = constructionCost * TN_TAX_RATES.gstUnderConstruction;
  
  const totalCost = constructionCost + landCost + stampDuty + registrationCharges + gst;
  const profit = grossDevelopmentValue - totalCost;
  const profitMargin = grossDevelopmentValue > 0 ? (profit / grossDevelopmentValue) * 100 : 0;
  
  return {
    totalSaleableArea,
    pricePerSqft,
    grossDevelopmentValue,
    constructionCost,
    landCost,
    stampDuty,
    registrationCharges,
    gst,
    totalCost,
    profit,
    profitMargin,
  };
};

// Generate TNRERA compliant area statement
export const generateAreaStatement = (buildings: Building[]): string => {
  let statement = 'TNRERA COMPLIANT AREA STATEMENT\n';
  statement += '================================\n\n';
  
  let totalCarpet = 0;
  let totalBuiltUp = 0;
  let totalSuperBuiltUp = 0;
  
  buildings.forEach((building, bIndex) => {
    statement += `Building ${bIndex + 1}: ${building.name}\n`;
    statement += '-'.repeat(40) + '\n';
    
    const floorWise: { [floor: number]: any[] } = {};
    building.units.forEach(unit => {
      const unitType = getUnitById(unit.unitTypeId);
      if (unitType) {
        if (!floorWise[unit.floor]) floorWise[unit.floor] = [];
        floorWise[unit.floor].push({
          type: unitType.bhkType,
          carpet: unitType.carpetArea,
          builtUp: unitType.builtUpArea,
          superBuiltUp: unitType.superBuiltUpArea,
        });
      }
    });
    
    Object.entries(floorWise).forEach(([floor, units]) => {
      statement += `\nFloor ${floor}:\n`;
      units.forEach((unit, idx) => {
        statement += `  Unit ${idx + 1} (${unit.type}): `;
        statement += `Carpet: ${unit.carpet} sqft, `;
        statement += `Built-up: ${unit.builtUp} sqft, `;
        statement += `Super Built-up: ${unit.superBuiltUp} sqft\n`;
        totalCarpet += unit.carpet;
        totalBuiltUp += unit.builtUp;
        totalSuperBuiltUp += unit.superBuiltUp;
      });
    });
    
    statement += '\n';
  });
  
  statement += '='.repeat(40) + '\n';
  statement += 'TOTAL SUMMARY\n';
  statement += `Total Carpet Area: ${totalCarpet.toFixed(2)} sq.ft\n`;
  statement += `Total Built-up Area: ${totalBuiltUp.toFixed(2)} sq.ft\n`;
  statement += `Total Super Built-up Area: ${totalSuperBuiltUp.toFixed(2)} sq.ft\n`;
  statement += `Loading Factor: ${((totalSuperBuiltUp / totalCarpet - 1) * 100).toFixed(1)}%\n`;
  
  return statement;
};
