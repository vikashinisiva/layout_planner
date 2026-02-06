// Core Types for Layout Planner

export interface Coordinate {
  lng: number;
  lat: number;
}

export interface SiteBoundary {
  coordinates: Coordinate[];
  area: number; // in square meters
  roadWidth: number; // in meters
  zone: ZoneType;
}

export type ZoneType = 'residential' | 'commercial' | 'mixed' | 'it-corridor';
export type CityType = 'chennai' | 'coimbatore';

export interface SetbackRules {
  front: number;
  rear: number;
  side1: number;
  side2: number;
}

export interface ParkingRules {
  carSpacesPerSqm: number;
  twoWheelerPerSqm: number;
  visitorPercentage: number;
}

export interface CityRegulations {
  city: CityType;
  zones: {
    [key in ZoneType]: {
      baseFSI: number;
      premiumFSI: number;
      maxGroundCoverage: number;
      setbacks: {
        [plotSize: string]: SetbackRules;
      };
      parking: ParkingRules;
      maxHeightFormula: string;
    };
  };
}

export interface UnitType {
  id: string;
  name: string;
  bhkType: '1RK' | '1BHK' | '1.5BHK' | '2BHK' | '2.5BHK' | '3BHK' | '4BHK';
  carpetArea: number; // sq ft
  builtUpArea: number;
  superBuiltUpArea: number;
  width: number; // meters
  depth: number; // meters
  rooms: Room[];
  color: string;
  vastuCompliant: boolean;
}

export interface Room {
  name: string;
  type: 'bedroom' | 'living' | 'kitchen' | 'bathroom' | 'balcony' | 'utility' | 'pooja' | 'dining';
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface PlacedUnit {
  id: string;
  unitTypeId: string;
  x: number;
  y: number;
  rotation: number;
  floor: number;
}

export interface Building {
  id: string;
  name: string;
  footprint: Coordinate[];
  floors: number;
  floorHeight: number; // meters
  units: PlacedUnit[];
  stiltParking: boolean;
  liftCores: number;
  staircases: number;
}

export interface Project {
  id: string;
  name: string;
  city: CityType;
  address: string;
  site: SiteBoundary;
  buildings: Building[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Metrics {
  totalPlotArea: number;
  totalBuiltUpArea: number;
  totalCarpetArea: number;
  totalSuperBuiltUpArea: number;
  fsi: number;
  groundCoverage: number;
  allowedFSI: number;
  allowedCoverage: number;
  totalUnits: number;
  unitMix: { [key: string]: number };
  parkingRequired: number;
  parkingProvided: number;
  twoWheelerRequired: number;
  twoWheelerProvided: number;
  compliance: {
    fsi: boolean;
    coverage: boolean;
    setbacks: boolean;
    parking: boolean;
    height: boolean;
  };
}

export interface FinancialAnalysis {
  totalSaleableArea: number;
  pricePerSqft: number;
  grossDevelopmentValue: number;
  constructionCost: number;
  landCost: number;
  stampDuty: number;
  registrationCharges: number;
  gst: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
}

export interface VastuScore {
  overall: number;
  entranceDirection: 'N' | 'E' | 'S' | 'W' | 'NE' | 'SE' | 'SW' | 'NW';
  entranceScore: number;
  kitchenPlacement: boolean;
  masterBedroomPlacement: boolean;
  toiletPlacement: boolean;
  recommendations: string[];
}

// AI-Generated Floor Plan Types (from GAT-Net backend)
export interface GeneratedRoom {
  type: 'living' | 'bedroom' | 'kitchen' | 'bathroom' | string;
  category: number;  // 0=living, 1=bedroom, 2=kitchen, 3=bathroom
  coordinates: [number, number][];  // Polygon coordinates in local/model space
  centroid: [number, number];
  width: number;
  height: number;
  area: number;
  inside_bedroom?: boolean;  // True if bath/kitchen is inside a bedroom
}

export interface GeneratedFloorPlan {
  success: boolean;
  rooms: GeneratedRoom[];
  boundary: [number, number][];
  total_area: number;
  message?: string;
  // Metadata for coordinate transformation
  siteCenter?: Coordinate;
  bhkConfig?: string;
  doorSide?: 'north' | 'south' | 'east' | 'west';
}
