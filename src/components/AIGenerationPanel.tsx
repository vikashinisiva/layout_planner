// AI Floor Plan Generation Panel
// Allows users to generate floor plans using the GAT-Net AI model

import React, { useState, useEffect } from 'react';
import { useFloorPlanGenerator, useBHKParser } from '../hooks/useFloorPlanGenerator';
import type { RoomOutput } from '../services/floorPlanApi';
import type { Coordinate } from '../types';

interface AIGenerationPanelProps {
  siteBoundary: Coordinate[];  // Site boundary from MapView store
  siteCenter?: Coordinate;     // Center point for coordinate transformation
  onGenerationComplete?: (rooms: RoomOutput[]) => void;
}

export const AIGenerationPanel: React.FC<AIGenerationPanelProps> = ({
  siteBoundary,
  siteCenter,
  onGenerationComplete,
}) => {
  const [bhk, setBhk] = useState('2BHK');
  const [doorSide, setDoorSide] = useState<'north' | 'south' | 'east' | 'west'>('south');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    isGenerating,
    error,
    generatedPlan,
    apiHealth,
    generateSimple,
    checkApiHealth,
    clearError,
  } = useFloorPlanGenerator();
  
  const bhkDetails = useBHKParser(bhk);

  // Check API health on mount
  useEffect(() => {
    checkApiHealth();
  }, [checkApiHealth]);

  // Convert Coordinate[] to [number, number][] for processing
  const boundaryAsArray = siteBoundary.map(c => [c.lng, c.lat] as [number, number]);
  
  // Get center point for coordinate transformation
  const centerPoint: [number, number] | undefined = siteCenter 
    ? [siteCenter.lat, siteCenter.lng]
    : siteBoundary.length > 0 
      ? [
          siteBoundary.reduce((sum, c) => sum + c.lat, 0) / siteBoundary.length,
          siteBoundary.reduce((sum, c) => sum + c.lng, 0) / siteBoundary.length
        ]
      : undefined;

  // Calculate door position based on boundary and side
  const getDoorPosition = (): [number, number] => {
    if (!boundaryAsArray.length) return [128, 100];
    
    // Get bounding box (using lng as x, lat as y)
    const xs = boundaryAsArray.map(c => c[0]);
    const ys = boundaryAsArray.map(c => c[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Door position in lat/lng coordinates
    switch (doorSide) {
      case 'north': return [centerX, maxY];
      case 'south': return [centerX, minY];
      case 'east': return [maxX, centerY];
      case 'west': return [minX, centerY];
      default: return [centerX, minY];
    }
  };

  const handleGenerate = async () => {
    if (!siteBoundary.length) {
      alert('Please draw a site boundary first');
      return;
    }

    clearError();
    const doorPos = getDoorPosition();
    
    // Pass boundary as [lat, lng] pairs and center for coordinate transformation
    const result = await generateSimple(
      boundaryAsArray.map(([lng, lat]) => [lat, lng] as [number, number]),
      [doorPos[1], doorPos[0]], // Convert [lng, lat] to [lat, lng]
      bhk,
      centerPoint
    );
    
    if (result && onGenerationComplete) {
      onGenerationComplete(result.rooms);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <span className="font-semibold text-gray-800">AI Floor Plan Generator</span>
          {apiHealth?.model_loaded && (
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
              Ready
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-gray-100">
          {/* API Status */}
          {!apiHealth && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-yellow-800">
                <span>⚠️</span>
                <span>Checking API status...</span>
              </div>
            </div>
          )}
          
          {apiHealth && !apiHealth.model_loaded && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-red-800">
                <span>❌</span>
                <span>AI model not loaded. Check backend server.</span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <div className="flex items-center justify-between">
                <span className="text-red-800">{error}</span>
                <button
                  onClick={clearError}
                  className="text-red-600 hover:text-red-800"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* BHK Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Configuration
            </label>
            <div className="flex gap-2">
              {['1BHK', '2BHK', '3BHK', '4BHK'].map((option) => (
                <button
                  key={option}
                  onClick={() => setBhk(option)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                    bhk === option
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Door Position */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Main Entrance Side
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'north', label: 'North', icon: '↑' },
                { id: 'south', label: 'South', icon: '↓' },
                { id: 'east', label: 'East', icon: '→' },
                { id: 'west', label: 'West', icon: '←' },
              ].map((side) => (
                <button
                  key={side.id}
                  onClick={() => setDoorSide(side.id as any)}
                  className={`px-3 py-2 rounded-lg border text-sm transition ${
                    doorSide === side.id
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-400'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {side.icon} {side.label}
                </button>
              ))}
            </div>
          </div>

          {/* Room Preview */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Layout will include:</div>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                {bhkDetails.bedrooms} Bedroom{bhkDetails.bedrooms > 1 ? 's' : ''}
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                {bhkDetails.bathrooms} Bathroom{bhkDetails.bathrooms > 1 ? 's' : ''}
              </span>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                1 Kitchen
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                1 Living/Hall
              </span>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !apiHealth?.model_loaded}
            className={`w-full py-3 rounded-lg font-semibold text-white transition ${
              isGenerating || !apiHealth?.model_loaded
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg'
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating...
              </span>
            ) : (
              '✨ Generate AI Floor Plan'
            )}
          </button>

          {/* Generated Plan Info */}
          {generatedPlan && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                <div className="font-semibold mb-1">✓ Plan Generated!</div>
                <div>Rooms: {generatedPlan.rooms.length}</div>
                <div>Total Area: {generatedPlan.total_area.toFixed(1)} sq units</div>
              </div>
            </div>
          )}

          {/* Help Text */}
          <p className="text-xs text-gray-500 text-center">
            AI uses Graph Attention Networks to optimize room placement
          </p>
        </div>
      )}
    </div>
  );
};

export default AIGenerationPanel;
