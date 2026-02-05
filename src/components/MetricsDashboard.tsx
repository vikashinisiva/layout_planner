// Metrics Dashboard Component

import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { calculateMetrics, sqmToSqft } from '../utils/calculations';
import { getRegulations } from '../data/regulations';

export const MetricsDashboard: React.FC = () => {
  const {
    site,
    buildings,
    city,
    zone,
    roadWidth,
    usePremiumFSI,
    metrics,
    setMetrics,
  } = useAppStore();
  
  // Calculate metrics when dependencies change
  useEffect(() => {
    if (site && site.area > 0) {
      const calculatedMetrics = calculateMetrics(
        site,
        buildings,
        city,
        zone,
        roadWidth,
        usePremiumFSI
      );
      setMetrics(calculatedMetrics);
    }
  }, [site, buildings, city, zone, roadWidth, usePremiumFSI, setMetrics]);
  
  getRegulations(city); // Load regulations for city context
  
  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Project Metrics</h3>
        <p className="text-gray-500 text-sm">Define site boundary to see metrics</p>
      </div>
    );
  }
  
  const ComplianceBadge: React.FC<{ compliant: boolean }> = ({ compliant }) => (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
      compliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {compliant ? '✓ OK' : '✗ Exceeds'}
    </span>
  );
  
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h3 className="text-lg font-semibold">Project Metrics</h3>
      
      {/* Site Info */}
      <div className="border-b pb-3">
        <div className="text-sm text-gray-600 mb-1">Site Area</div>
        <div className="text-xl font-bold text-indigo-600">
          {metrics.totalPlotArea.toFixed(0)} m²
        </div>
        <div className="text-sm text-gray-500">
          {sqmToSqft(metrics.totalPlotArea).toFixed(0)} sq.ft
        </div>
      </div>
      
      {/* FSI */}
      <div className="border-b pb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">FSI (Floor Space Index)</span>
          <ComplianceBadge compliant={metrics.compliance.fsi} />
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold">{metrics.fsi.toFixed(2)}</span>
          <span className="text-gray-500 text-sm mb-1">/ {metrics.allowedFSI.toFixed(2)} allowed</span>
        </div>
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              metrics.compliance.fsi ? 'bg-green-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, (metrics.fsi / metrics.allowedFSI) * 100)}%` }}
          />
        </div>
      </div>
      
      {/* Ground Coverage */}
      <div className="border-b pb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">Ground Coverage</span>
          <ComplianceBadge compliant={metrics.compliance.coverage} />
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold">{(metrics.groundCoverage * 100).toFixed(1)}%</span>
          <span className="text-gray-500 text-sm mb-1">/ {(metrics.allowedCoverage * 100).toFixed(0)}% max</span>
        </div>
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              metrics.compliance.coverage ? 'bg-green-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, (metrics.groundCoverage / metrics.allowedCoverage) * 100)}%` }}
          />
        </div>
      </div>
      
      {/* Area Summary */}
      <div className="border-b pb-3">
        <div className="text-sm text-gray-600 mb-2">Area Summary</div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Built-up</span>
            <span className="font-medium">{sqmToSqft(metrics.totalBuiltUpArea).toFixed(0)} sq.ft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Carpet</span>
            <span className="font-medium">{sqmToSqft(metrics.totalCarpetArea).toFixed(0)} sq.ft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Super Built-up</span>
            <span className="font-medium">{sqmToSqft(metrics.totalSuperBuiltUpArea).toFixed(0)} sq.ft</span>
          </div>
        </div>
      </div>
      
      {/* Unit Count */}
      <div className="border-b pb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Total Units</span>
          <span className="text-2xl font-bold text-indigo-600">{metrics.totalUnits}</span>
        </div>
        
        {Object.keys(metrics.unitMix).length > 0 && (
          <div className="space-y-1">
            {Object.entries(metrics.unitMix).map(([bhk, count]) => (
              <div key={bhk} className="flex justify-between text-sm">
                <span className="text-gray-600">{bhk}</span>
                <span className="font-medium">{count} units</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Parking */}
      <div className="border-b pb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">Parking</span>
          <ComplianceBadge compliant={metrics.compliance.parking} />
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Car (Required)</span>
            <span className="font-medium">{metrics.parkingRequired} ECS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Car (Provided)</span>
            <span className="font-medium">{metrics.parkingProvided} ECS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Two-Wheeler</span>
            <span className="font-medium">{metrics.twoWheelerRequired} spaces</span>
          </div>
        </div>
      </div>
      
      {/* Compliance Summary */}
      <div>
        <div className="text-sm text-gray-600 mb-2">Compliance Status</div>
        <div className="grid grid-cols-2 gap-2">
          <div className={`p-2 rounded text-xs ${metrics.compliance.fsi ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="font-medium">FSI</div>
            <div className={metrics.compliance.fsi ? 'text-green-600' : 'text-red-600'}>
              {metrics.compliance.fsi ? 'Compliant' : 'Non-compliant'}
            </div>
          </div>
          <div className={`p-2 rounded text-xs ${metrics.compliance.coverage ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="font-medium">Coverage</div>
            <div className={metrics.compliance.coverage ? 'text-green-600' : 'text-red-600'}>
              {metrics.compliance.coverage ? 'Compliant' : 'Non-compliant'}
            </div>
          </div>
          <div className={`p-2 rounded text-xs ${metrics.compliance.parking ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="font-medium">Parking</div>
            <div className={metrics.compliance.parking ? 'text-green-600' : 'text-red-600'}>
              {metrics.compliance.parking ? 'Adequate' : 'Insufficient'}
            </div>
          </div>
          <div className={`p-2 rounded text-xs ${metrics.compliance.height ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="font-medium">Height</div>
            <div className={metrics.compliance.height ? 'text-green-600' : 'text-red-600'}>
              {metrics.compliance.height ? 'Within limit' : 'Exceeds limit'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Unit Mix Configuration
export const UnitMixPanel: React.FC = () => {
  const { city } = useAppStore();
  
  const defaultMix = city === 'chennai' 
    ? { '1BHK': 15, '2BHK': 45, '2.5BHK': 15, '3BHK': 20, '4BHK': 5 }
    : { '1BHK': 10, '2BHK': 40, '3BHK': 35, '4BHK': 15 };
  
  const [unitMix, setUnitMix] = useState(defaultMix);
  
  const total = Object.values(unitMix).reduce((a, b) => a + b, 0);
  
  const bhkColors: { [key: string]: string } = {
    '1RK': '#FFE082',
    '1BHK': '#4FC3F7',
    '1.5BHK': '#80CBC4',
    '2BHK': '#66BB6A',
    '2.5BHK': '#CE93D8',
    '3BHK': '#FF8A65',
    '4BHK': '#E57373',
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4">Unit Mix</h3>
      
      {/* Pie chart visualization */}
      <div className="flex justify-center mb-4">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 100 100" className="transform -rotate-90">
            {(() => {
              let offset = 0;
              return Object.entries(unitMix).map(([bhk, percentage]) => {
                const circumference = 2 * Math.PI * 40;
                const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -(offset / 100) * circumference;
                offset += percentage;
                
                return (
                  <circle
                    key={bhk}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={bhkColors[bhk]}
                    strokeWidth="20"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                  />
                );
              });
            })()}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold">{total}%</span>
          </div>
        </div>
      </div>
      
      {/* Sliders */}
      <div className="space-y-3">
        {Object.entries(unitMix).map(([bhk, percentage]) => (
          <div key={bhk}>
            <div className="flex justify-between text-sm mb-1">
              <span className="flex items-center gap-2">
                <span 
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: bhkColors[bhk] }}
                />
                {bhk}
              </span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={percentage}
              onChange={(e) => setUnitMix(prev => ({
                ...prev,
                [bhk]: parseInt(e.target.value)
              }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: bhkColors[bhk] }}
            />
          </div>
        ))}
      </div>
      
      {total !== 100 && (
        <div className={`mt-3 text-sm ${total > 100 ? 'text-red-600' : 'text-yellow-600'}`}>
          {total > 100 ? `Exceeds 100% by ${total - 100}%` : `${100 - total}% unallocated`}
        </div>
      )}
    </div>
  );
};
