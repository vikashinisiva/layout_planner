// Building Layout Generator - Zenerate-Level Multi-Variant Generation
// Generates multiple building layout variants with unit arrangement, scoring, and comparison

import React, { useState, useEffect, useCallback } from 'react';
import { useFloorPlateOptimizer } from '../hooks/useFloorPlanGenerator';
import type { BuildingVariant } from '../services/floorPlanApi';
import type { Coordinate, CityType, ZoneType } from '../types';
import { getRegulations, calculateAllowedFSI, getSetbackCategory } from '../data/regulations';

interface BuildingLayoutGeneratorProps {
  siteBoundary: Coordinate[];
  siteArea: number;
  city: CityType;
  zone: ZoneType;
  roadWidth: number;
  onVariantSelected?: (variant: BuildingVariant) => void;
  onGenerationComplete?: (variants: BuildingVariant[]) => void;
}

export const BuildingLayoutGenerator: React.FC<BuildingLayoutGeneratorProps> = ({
  siteBoundary,
  siteArea,
  city,
  zone,
  roadWidth,
  onVariantSelected,
  onGenerationComplete,
}) => {
  // Unit mix configuration
  const [unitMix, setUnitMix] = useState<{ [key: string]: number }>({
    '1BHK': 20,
    '2BHK': 40,
    '3BHK': 30,
    '4BHK': 10,
  });
  
  // Building configuration
  const [numFloors, setNumFloors] = useState(10);
  const [stiltParking, setStiltParking] = useState(true);
  const [numVariants, setNumVariants] = useState(5);
  
  // Hook for floor plate optimization
  const {
    isGenerating,
    error,
    variants,
    selectedVariant,
    siteArea: calculatedSiteArea,
    buildableArea,
    unitTemplates,
    buildingShapes,
    generateVariants,
    selectVariant,
    loadTemplates,
    clearError,
  } = useFloorPlateOptimizer();

  // Get regulations for the city/zone
  const regulations = getRegulations(city);
  const zoneRules = regulations.zones[zone];
  const allowedFSI = calculateAllowedFSI(roadWidth, zone, city, false);
  const setbackCategory = getSetbackCategory(siteArea);
  const setbacks = zoneRules.setbacks[setbackCategory];

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Handle unit mix change
  const handleUnitMixChange = (bhk: string, value: number) => {
    setUnitMix(prev => ({
      ...prev,
      [bhk]: Math.max(0, Math.min(100, value)),
    }));
  };

  // Normalize unit mix to 100%
  const normalizedMix = useCallback(() => {
    const total = Object.values(unitMix).reduce((a, b) => a + b, 0);
    if (total === 0) return unitMix;
    const normalized: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(unitMix)) {
      normalized[key] = Math.round((value / total) * 100);
    }
    return normalized;
  }, [unitMix]);

  // Generate building layouts
  const handleGenerate = async () => {
    if (siteBoundary.length < 3) {
      alert('Please draw a site boundary first');
      return;
    }

    clearError();
    
    const variants = await generateVariants({
      siteCoordinates: siteBoundary.map(c => ({ lng: c.lng, lat: c.lat })),
      unitProgram: normalizedMix(),
      numFloors,
      stiltParking,
      maxFsi: allowedFSI,
      maxCoverage: zoneRules.maxGroundCoverage,
      setbacks: {
        front: setbacks.front,
        rear: setbacks.rear,
        side1: setbacks.side1,
        side2: setbacks.side2,
      },
    }, numVariants);

    if (variants.length > 0 && onGenerationComplete) {
      onGenerationComplete(variants);
    }
  };

  // Handle variant selection
  const handleSelectVariant = (variantId: string) => {
    selectVariant(variantId);
    const variant = variants.find(v => v.id === variantId);
    if (variant && onVariantSelected) {
      onVariantSelected(variant);
    }
  };

  // Get shape icon
  const getShapeIcon = (shape: string) => {
    switch (shape) {
      case 'linear': return '▬';
      case 'l_shape': return '⌐';
      case 'u_shape': return '⊔';
      case 'h_shape': return '☰';
      case 'courtyard': return '□';
      default: return '◼';
    }
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏗️</span>
          <div>
            <h2 className="text-xl font-bold text-white">AI Building Layout Generator</h2>
            <p className="text-indigo-200 text-sm">Generate optimized multi-unit floor plates</p>
          </div>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="p-6 space-y-6 border-b">
        {/* Site Info */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <div className="text-sm text-gray-500">Site Area</div>
            <div className="text-lg font-semibold">{(siteArea || calculatedSiteArea).toFixed(0)} sqm</div>
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-500">Allowed FSI</div>
            <div className="text-lg font-semibold text-indigo-600">{allowedFSI.toFixed(2)}</div>
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-500">Max Coverage</div>
            <div className="text-lg font-semibold text-purple-600">{(zoneRules.maxGroundCoverage * 100).toFixed(0)}%</div>
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-500">Buildable Area</div>
            <div className="text-lg font-semibold text-green-600">{buildableArea.toFixed(0)} sqm</div>
          </div>
        </div>

        {/* Unit Mix Configuration */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Unit Mix (%)</h3>
          <div className="grid grid-cols-4 gap-4">
            {['1BHK', '2BHK', '3BHK', '4BHK'].map((bhk) => (
              <div key={bhk} className="relative">
                <label className="block text-xs font-medium text-gray-500 mb-1">{bhk}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={unitMix[bhk] || 0}
                  onChange={(e) => handleUnitMixChange(bhk, parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="absolute right-3 top-8 text-gray-400 text-sm">%</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Total: {Object.values(unitMix).reduce((a, b) => a + b, 0)}%
            {Object.values(unitMix).reduce((a, b) => a + b, 0) !== 100 && (
              <span className="text-amber-600 ml-2">(Will be normalized to 100%)</span>
            )}
          </div>
        </div>

        {/* Building Configuration */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Floors</label>
            <input
              type="number"
              min="2"
              max="30"
              value={numFloors}
              onChange={(e) => setNumFloors(parseInt(e.target.value) || 10)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Variants</label>
            <select
              value={numVariants}
              onChange={(e) => setNumVariants(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value={3}>3 variants</option>
              <option value={5}>5 variants</option>
              <option value={7}>7 variants</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parking</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStiltParking(true)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  stiltParking
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Stilt
              </button>
              <button
                onClick={() => setStiltParking(false)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  !stiltParking
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Basement
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-red-800 text-sm">{error}</span>
              <button onClick={clearError} className="text-red-600 hover:text-red-800">✕</button>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || siteBoundary.length < 3}
          className={`w-full py-4 rounded-xl font-bold text-lg transition shadow-lg ${
            isGenerating || siteBoundary.length < 3
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white hover:shadow-xl'
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating {numVariants} Layout Variants...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              ✨ Generate AI Building Layouts
            </span>
          )}
        </button>
      </div>

      {/* Variants Comparison Grid */}
      {variants.length > 0 && (
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Design Options ({variants.length} variants)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {variants.map((variant, index) => (
              <div
                key={variant.id}
                onClick={() => handleSelectVariant(variant.id)}
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${
                  selectedVariant?.id === variant.id
                    ? 'border-indigo-500 bg-indigo-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                }`}
              >
                {/* Best Badge */}
                {index === 0 && (
                  <div className="absolute -top-2 -right-2 px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full shadow">
                    ⭐ Best
                  </div>
                )}

                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{getShapeIcon(variant.shape)}</span>
                  <div>
                    <div className="font-semibold text-gray-800">{variant.name}</div>
                    <div className="text-xs text-gray-500 capitalize">
                      {variant.corridorType.replace('_', ' ')} corridor
                    </div>
                  </div>
                  <div className={`ml-auto px-2 py-1 rounded-full text-sm font-bold ${getScoreColor(variant.score)}`}>
                    {variant.score.toFixed(0)}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Units:</span>
                    <span className="font-medium">{variant.totalUnits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">FSI:</span>
                    <span className={`font-medium ${variant.fsiAchieved <= allowedFSI ? 'text-green-600' : 'text-red-600'}`}>
                      {variant.fsiAchieved.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Built-up:</span>
                    <span className="font-medium">{variant.totalBuiltUpArea.toFixed(0)} sqm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Coverage:</span>
                    <span className="font-medium">{(variant.groundCoverage * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Unit Mix */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex gap-1">
                    {Object.entries(variant.unitMix).map(([bhk, count]) => (
                      <span
                        key={bhk}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {count}x {bhk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Selected Variant Details */}
          {selectedVariant && (
            <div className="mt-6 p-4 bg-indigo-50 rounded-xl">
              <h4 className="font-semibold text-indigo-800 mb-2">
                Selected: {selectedVariant.name}
              </h4>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-indigo-600">Total Units</div>
                  <div className="text-2xl font-bold text-indigo-800">{selectedVariant.totalUnits}</div>
                </div>
                <div>
                  <div className="text-indigo-600">Total Built-up</div>
                  <div className="text-2xl font-bold text-indigo-800">{selectedVariant.totalBuiltUpArea.toFixed(0)}</div>
                  <div className="text-xs text-indigo-500">sqm</div>
                </div>
                <div>
                  <div className="text-indigo-600">Carpet Area</div>
                  <div className="text-2xl font-bold text-indigo-800">{selectedVariant.totalCarpetArea.toFixed(0)}</div>
                  <div className="text-xs text-indigo-500">sqm</div>
                </div>
                <div>
                  <div className="text-indigo-600">Efficiency</div>
                  <div className="text-2xl font-bold text-indigo-800">
                    {selectedVariant.floors[0]?.efficiency
                      ? (selectedVariant.floors[0].efficiency * 100).toFixed(0)
                      : 'N/A'}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BuildingLayoutGenerator;
