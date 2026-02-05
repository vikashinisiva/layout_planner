// Tamil Nadu Building Regulations - Chennai & Coimbatore
// Based on TNCDBR 2019 (Tamil Nadu Combined Development and Building Rules)

import type { CityRegulations, CityType, ZoneType } from '../types';

export const CHENNAI_REGULATIONS: CityRegulations = {
  city: 'chennai',
  zones: {
    residential: {
      baseFSI: 1.5,
      premiumFSI: 3.25, // On roads >= 18m with premium payment
      maxGroundCoverage: 0.55,
      setbacks: {
        'upto300': { front: 1.5, rear: 1.5, side1: 0, side2: 0 },
        '301to500': { front: 2.0, rear: 1.5, side1: 1.0, side2: 1.0 },
        '501to1000': { front: 3.0, rear: 2.0, side1: 1.5, side2: 1.5 },
        '1001to2000': { front: 4.0, rear: 2.5, side1: 2.0, side2: 2.0 },
        '2001to5000': { front: 5.0, rear: 3.0, side1: 3.0, side2: 3.0 },
        'above5000': { front: 6.0, rear: 3.0, side1: 3.0, side2: 3.0 },
      },
      parking: {
        carSpacesPerSqm: 100, // 1 ECS per 100 sqm
        twoWheelerPerSqm: 50, // 1 per 50 sqm
        visitorPercentage: 0.25,
      },
      maxHeightFormula: '1.5 * (roadWidth + frontSetback)',
    },
    commercial: {
      baseFSI: 2.0,
      premiumFSI: 4.0,
      maxGroundCoverage: 0.60,
      setbacks: {
        'upto300': { front: 2.0, rear: 2.0, side1: 1.0, side2: 1.0 },
        '301to500': { front: 3.0, rear: 2.0, side1: 1.5, side2: 1.5 },
        '501to1000': { front: 4.0, rear: 2.5, side1: 2.0, side2: 2.0 },
        '1001to2000': { front: 5.0, rear: 3.0, side1: 2.5, side2: 2.5 },
        '2001to5000': { front: 6.0, rear: 3.5, side1: 3.0, side2: 3.0 },
        'above5000': { front: 8.0, rear: 4.0, side1: 4.0, side2: 4.0 },
      },
      parking: {
        carSpacesPerSqm: 75,
        twoWheelerPerSqm: 40,
        visitorPercentage: 0.30,
      },
      maxHeightFormula: '1.5 * (roadWidth + frontSetback)',
    },
    mixed: {
      baseFSI: 1.75,
      premiumFSI: 3.5,
      maxGroundCoverage: 0.55,
      setbacks: {
        'upto300': { front: 2.0, rear: 1.5, side1: 1.0, side2: 1.0 },
        '301to500': { front: 2.5, rear: 2.0, side1: 1.5, side2: 1.5 },
        '501to1000': { front: 3.5, rear: 2.5, side1: 2.0, side2: 2.0 },
        '1001to2000': { front: 4.5, rear: 3.0, side1: 2.5, side2: 2.5 },
        '2001to5000': { front: 5.5, rear: 3.5, side1: 3.0, side2: 3.0 },
        'above5000': { front: 7.0, rear: 4.0, side1: 3.5, side2: 3.5 },
      },
      parking: {
        carSpacesPerSqm: 85,
        twoWheelerPerSqm: 45,
        visitorPercentage: 0.25,
      },
      maxHeightFormula: '1.5 * (roadWidth + frontSetback)',
    },
    'it-corridor': {
      baseFSI: 2.5,
      premiumFSI: 4.5,
      maxGroundCoverage: 0.50,
      setbacks: {
        'upto300': { front: 3.0, rear: 2.0, side1: 1.5, side2: 1.5 },
        '301to500': { front: 4.0, rear: 2.5, side1: 2.0, side2: 2.0 },
        '501to1000': { front: 5.0, rear: 3.0, side1: 2.5, side2: 2.5 },
        '1001to2000': { front: 6.0, rear: 3.5, side1: 3.0, side2: 3.0 },
        '2001to5000': { front: 8.0, rear: 4.0, side1: 4.0, side2: 4.0 },
        'above5000': { front: 10.0, rear: 5.0, side1: 5.0, side2: 5.0 },
      },
      parking: {
        carSpacesPerSqm: 60,
        twoWheelerPerSqm: 35,
        visitorPercentage: 0.35,
      },
      maxHeightFormula: '2.0 * (roadWidth + frontSetback)',
    },
  },
};

export const COIMBATORE_REGULATIONS: CityRegulations = {
  city: 'coimbatore',
  zones: {
    residential: {
      baseFSI: 1.5,
      premiumFSI: 2.5,
      maxGroundCoverage: 0.60,
      setbacks: {
        'upto300': { front: 1.5, rear: 1.0, side1: 0, side2: 0 },
        '301to500': { front: 1.5, rear: 1.5, side1: 1.0, side2: 1.0 },
        '501to1000': { front: 2.5, rear: 2.0, side1: 1.5, side2: 1.5 },
        '1001to2000': { front: 3.5, rear: 2.5, side1: 2.0, side2: 2.0 },
        '2001to5000': { front: 4.5, rear: 3.0, side1: 2.5, side2: 2.5 },
        'above5000': { front: 5.0, rear: 3.0, side1: 3.0, side2: 3.0 },
      },
      parking: {
        carSpacesPerSqm: 100,
        twoWheelerPerSqm: 50,
        visitorPercentage: 0.20,
      },
      maxHeightFormula: '1.5 * (roadWidth + frontSetback)',
    },
    commercial: {
      baseFSI: 2.0,
      premiumFSI: 3.0,
      maxGroundCoverage: 0.70,
      setbacks: {
        'upto300': { front: 2.0, rear: 1.5, side1: 1.0, side2: 1.0 },
        '301to500': { front: 2.5, rear: 2.0, side1: 1.5, side2: 1.5 },
        '501to1000': { front: 3.5, rear: 2.5, side1: 2.0, side2: 2.0 },
        '1001to2000': { front: 4.5, rear: 3.0, side1: 2.5, side2: 2.5 },
        '2001to5000': { front: 5.5, rear: 3.5, side1: 3.0, side2: 3.0 },
        'above5000': { front: 6.0, rear: 4.0, side1: 3.5, side2: 3.5 },
      },
      parking: {
        carSpacesPerSqm: 80,
        twoWheelerPerSqm: 40,
        visitorPercentage: 0.25,
      },
      maxHeightFormula: '1.5 * (roadWidth + frontSetback)',
    },
    mixed: {
      baseFSI: 1.75,
      premiumFSI: 2.75,
      maxGroundCoverage: 0.65,
      setbacks: {
        'upto300': { front: 1.75, rear: 1.25, side1: 0.5, side2: 0.5 },
        '301to500': { front: 2.0, rear: 1.75, side1: 1.25, side2: 1.25 },
        '501to1000': { front: 3.0, rear: 2.25, side1: 1.75, side2: 1.75 },
        '1001to2000': { front: 4.0, rear: 2.75, side1: 2.25, side2: 2.25 },
        '2001to5000': { front: 5.0, rear: 3.25, side1: 2.75, side2: 2.75 },
        'above5000': { front: 5.5, rear: 3.5, side1: 3.25, side2: 3.25 },
      },
      parking: {
        carSpacesPerSqm: 90,
        twoWheelerPerSqm: 45,
        visitorPercentage: 0.22,
      },
      maxHeightFormula: '1.5 * (roadWidth + frontSetback)',
    },
    'it-corridor': {
      baseFSI: 2.0,
      premiumFSI: 3.5,
      maxGroundCoverage: 0.55,
      setbacks: {
        'upto300': { front: 2.5, rear: 2.0, side1: 1.5, side2: 1.5 },
        '301to500': { front: 3.5, rear: 2.5, side1: 2.0, side2: 2.0 },
        '501to1000': { front: 4.5, rear: 3.0, side1: 2.5, side2: 2.5 },
        '1001to2000': { front: 5.5, rear: 3.5, side1: 3.0, side2: 3.0 },
        '2001to5000': { front: 7.0, rear: 4.0, side1: 3.5, side2: 3.5 },
        'above5000': { front: 8.0, rear: 4.5, side1: 4.0, side2: 4.0 },
      },
      parking: {
        carSpacesPerSqm: 65,
        twoWheelerPerSqm: 35,
        visitorPercentage: 0.30,
      },
      maxHeightFormula: '1.75 * (roadWidth + frontSetback)',
    },
  },
};

export const getRegulations = (city: CityType): CityRegulations => {
  return city === 'chennai' ? CHENNAI_REGULATIONS : COIMBATORE_REGULATIONS;
};

export const getSetbackCategory = (plotArea: number): string => {
  if (plotArea <= 300) return 'upto300';
  if (plotArea <= 500) return '301to500';
  if (plotArea <= 1000) return '501to1000';
  if (plotArea <= 2000) return '1001to2000';
  if (plotArea <= 5000) return '2001to5000';
  return 'above5000';
};

export const calculateMaxHeight = (
  roadWidth: number,
  frontSetback: number,
  zone: ZoneType,
  city: CityType
): number => {
  getRegulations(city); // Load regulations for city context
  
  // Parse and evaluate the formula
  const multiplier = zone === 'it-corridor' ? (city === 'chennai' ? 2.0 : 1.75) : 1.5;
  return multiplier * (roadWidth + frontSetback);
};

export const calculateAllowedFSI = (
  roadWidth: number,
  zone: ZoneType,
  city: CityType,
  usePremium: boolean = false
): number => {
  const regulations = getRegulations(city);
  const zoneRules = regulations.zones[zone];
  
  if (usePremium && roadWidth >= 18) {
    return zoneRules.premiumFSI;
  }
  
  // FSI varies by road width
  if (roadWidth >= 18) {
    return Math.min(zoneRules.baseFSI * 1.5, zoneRules.premiumFSI);
  } else if (roadWidth >= 12) {
    return zoneRules.baseFSI * 1.25;
  }
  
  return zoneRules.baseFSI;
};

// Chennai locality-wise pricing (₹ per sq ft)
export const CHENNAI_PRICING: { [locality: string]: number } = {
  'adyar': 12500,
  'velachery': 8500,
  'omr': 7500,
  'ecr': 9500,
  'anna-nagar': 14000,
  'nungambakkam': 18000,
  't-nagar': 16000,
  'porur': 6500,
  'tambaram': 5500,
  'perumbakkam': 5000,
  'sholinganallur': 7000,
  'medavakkam': 5500,
  'pallikaranai': 6000,
  'thoraipakkam': 8000,
  'default': 7000,
};

// Coimbatore locality-wise pricing (₹ per sq ft)
export const COIMBATORE_PRICING: { [locality: string]: number } = {
  'rs-puram': 8500,
  'race-course': 9000,
  'peelamedu': 6500,
  'saibaba-colony': 7500,
  'gandhipuram': 7000,
  'singanallur': 5500,
  'saravanampatti': 5000,
  'ganapathy': 6000,
  'kovaipudur': 4500,
  'vadavalli': 5500,
  'default': 5500,
};

// Construction cost estimates (₹ per sq ft)
export const CONSTRUCTION_COSTS = {
  basic: 1800,
  standard: 2200,
  premium: 2800,
  luxury: 3500,
};

// Tax rates for Tamil Nadu
export const TN_TAX_RATES = {
  stampDuty: 0.07, // 7%
  registrationCharges: 0.04, // 4%
  gstUnderConstruction: 0.05, // 5% (without ITC)
  gstAffordable: 0.01, // 1% for affordable housing
};

// Loading factors for area calculations
export const LOADING_FACTORS = {
  builtUpToCarpet: 1.15, // Built-up is ~15% more than carpet
  superBuiltUpToCarpet: 1.30, // Super built-up is ~30% more than carpet
};
