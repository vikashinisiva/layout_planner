// Project Settings Panel

import React from 'react';
import { useAppStore } from '../store/appStore';
import { getRegulations, getSetbackCategory } from '../data/regulations';
import type { ZoneType } from '../types';

export const ProjectSettings: React.FC = () => {
  const {
    city,
    zone,
    roadWidth,
    usePremiumFSI,
    site,
    setCity,
    setZone,
    setRoadWidth,
    setUsePremiumFSI,
  } = useAppStore();
  
  const regulations = getRegulations(city);
  const zoneRules = regulations.zones[zone];
  const setbackCategory = site ? getSetbackCategory(site.area) : 'upto300';
  const setbacks = zoneRules.setbacks[setbackCategory];
  
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h3 className="text-lg font-semibold">Project Settings</h3>
      
      {/* City Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setCity('chennai')}
            className={`px-4 py-3 rounded-lg border-2 transition ${
              city === 'chennai'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">Chennai</div>
            <div className="text-xs text-gray-500">CMDA/GCC</div>
          </button>
          <button
            onClick={() => setCity('coimbatore')}
            className={`px-4 py-3 rounded-lg border-2 transition ${
              city === 'coimbatore'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">Coimbatore</div>
            <div className="text-xs text-gray-500">CCMC/LPA</div>
          </button>
        </div>
      </div>
      
      {/* Zone Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Zone Type</label>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value as ZoneType)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
          <option value="mixed">Mixed Use</option>
          <option value="it-corridor">IT Corridor</option>
        </select>
      </div>
      
      {/* Road Width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Road Width: {roadWidth}m
        </label>
        <input
          type="range"
          min="6"
          max="40"
          step="2"
          value={roadWidth}
          onChange={(e) => setRoadWidth(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>6m</span>
          <span>18m (Premium eligible)</span>
          <span>40m</span>
        </div>
      </div>
      
      {/* Premium FSI Toggle */}
      {roadWidth >= 18 && (
        <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
          <div>
            <div className="font-medium text-indigo-700">Premium FSI</div>
            <div className="text-xs text-indigo-600">
              Eligible for roads ≥18m (with premium payment)
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={usePremiumFSI}
              onChange={(e) => setUsePremiumFSI(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      )}
      
      {/* Regulations Summary */}
      <div className="border-t pt-4">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Applicable Rules ({city === 'chennai' ? 'Chennai' : 'Coimbatore'})
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500">Base FSI</div>
            <div className="font-bold">{zoneRules.baseFSI}</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500">Premium FSI</div>
            <div className="font-bold">{zoneRules.premiumFSI}</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500">Max Coverage</div>
            <div className="font-bold">{(zoneRules.maxGroundCoverage * 100).toFixed(0)}%</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500">Parking Ratio</div>
            <div className="font-bold">1/{zoneRules.parking.carSpacesPerSqm} sqm</div>
          </div>
        </div>
        
        {/* Setbacks */}
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1">
            Setbacks (for plot {setbackCategory.replace(/(\d+)to(\d+)/, '$1-$2').replace('upto', '≤').replace('above', '>')})
          </div>
          <div className="grid grid-cols-4 gap-1 text-center text-xs">
            <div className="bg-blue-50 rounded p-1">
              <div className="text-gray-500">Front</div>
              <div className="font-bold">{setbacks.front}m</div>
            </div>
            <div className="bg-blue-50 rounded p-1">
              <div className="text-gray-500">Rear</div>
              <div className="font-bold">{setbacks.rear}m</div>
            </div>
            <div className="bg-blue-50 rounded p-1">
              <div className="text-gray-500">Side 1</div>
              <div className="font-bold">{setbacks.side1}m</div>
            </div>
            <div className="bg-blue-50 rounded p-1">
              <div className="text-gray-500">Side 2</div>
              <div className="font-bold">{setbacks.side2}m</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* TNCDBR Note */}
      <div className="text-xs text-gray-500 bg-yellow-50 rounded p-2">
        Based on <strong>TNCDBR 2019</strong> (Tamil Nadu Combined Development and Building Rules)
      </div>
    </div>
  );
};
