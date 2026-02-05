// Financial Analysis Component

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { calculateFinancials, sqmToSqft } from '../utils/calculations';
import { CHENNAI_PRICING, COIMBATORE_PRICING, CONSTRUCTION_COSTS, TN_TAX_RATES } from '../data/regulations';

export const FinancialAnalysis: React.FC = () => {
  const { city, metrics, financials, setFinancials } = useAppStore();
  
  const [locality, setLocality] = useState('default');
  const [constructionType, setConstructionType] = useState<'basic' | 'standard' | 'premium' | 'luxury'>('standard');
  const [landCostPerSqft, setLandCostPerSqft] = useState(0);
  
  const pricing = city === 'chennai' ? CHENNAI_PRICING : COIMBATORE_PRICING;
  const localities = Object.keys(pricing).filter(k => k !== 'default');
  
  useEffect(() => {
    if (metrics) {
      const calculated = calculateFinancials(
        metrics,
        city,
        locality,
        constructionType,
        landCostPerSqft
      );
      setFinancials(calculated);
    }
  }, [metrics, city, locality, constructionType, landCostPerSqft, setFinancials]);
  
  const formatCurrency = (value: number): string => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${value.toFixed(0)}`;
  };
  
  if (!metrics || !financials) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Financial Analysis</h3>
        <p className="text-gray-500 text-sm">Define site and generate layout to see financial projections</p>
      </div>
    );
  }
  
  const profitColor = financials.profitMargin >= 20 
    ? 'text-green-600' 
    : financials.profitMargin >= 10 
      ? 'text-yellow-600' 
      : 'text-red-600';
  
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h3 className="text-lg font-semibold">Financial Analysis</h3>
      
      {/* Configuration */}
      <div className="grid grid-cols-2 gap-3 border-b pb-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Locality</label>
          <select
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            className="w-full px-2 py-1.5 border rounded text-sm"
          >
            <option value="default">Default</option>
            {localities.map(loc => (
              <option key={loc} value={loc}>
                {loc.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Construction Type</label>
          <select
            value={constructionType}
            onChange={(e) => setConstructionType(e.target.value as any)}
            className="w-full px-2 py-1.5 border rounded text-sm"
          >
            <option value="basic">Basic (₹{CONSTRUCTION_COSTS.basic}/sqft)</option>
            <option value="standard">Standard (₹{CONSTRUCTION_COSTS.standard}/sqft)</option>
            <option value="premium">Premium (₹{CONSTRUCTION_COSTS.premium}/sqft)</option>
            <option value="luxury">Luxury (₹{CONSTRUCTION_COSTS.luxury}/sqft)</option>
          </select>
        </div>
        
        <div className="col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Land Cost (₹/sqft) - Leave 0 for auto estimate</label>
          <input
            type="number"
            value={landCostPerSqft}
            onChange={(e) => setLandCostPerSqft(parseInt(e.target.value) || 0)}
            className="w-full px-2 py-1.5 border rounded text-sm"
            placeholder="0"
          />
        </div>
      </div>
      
      {/* Revenue Section */}
      <div className="border-b pb-3">
        <div className="text-sm font-medium text-gray-700 mb-2">Revenue</div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Saleable Area</span>
            <span className="font-medium">{financials.totalSaleableArea.toFixed(0)} sq.ft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Price per sq.ft</span>
            <span className="font-medium">₹{financials.pricePerSqft.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-base pt-1 border-t">
            <span className="font-medium">Gross Development Value</span>
            <span className="font-bold text-indigo-600">{formatCurrency(financials.grossDevelopmentValue)}</span>
          </div>
        </div>
      </div>
      
      {/* Cost Section */}
      <div className="border-b pb-3">
        <div className="text-sm font-medium text-gray-700 mb-2">Costs</div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Construction Cost</span>
            <span className="font-medium">{formatCurrency(financials.constructionCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Land Cost</span>
            <span className="font-medium">{formatCurrency(financials.landCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Stamp Duty (7%)</span>
            <span className="font-medium">{formatCurrency(financials.stampDuty)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Registration (4%)</span>
            <span className="font-medium">{formatCurrency(financials.registrationCharges)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">GST (5%)</span>
            <span className="font-medium">{formatCurrency(financials.gst)}</span>
          </div>
          <div className="flex justify-between text-base pt-1 border-t">
            <span className="font-medium">Total Cost</span>
            <span className="font-bold">{formatCurrency(financials.totalCost)}</span>
          </div>
        </div>
      </div>
      
      {/* Profit Section */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Estimated Profit</span>
          <span className={`text-xl font-bold ${profitColor}`}>
            {formatCurrency(financials.profit)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Profit Margin</span>
          <span className={`text-lg font-bold ${profitColor}`}>
            {financials.profitMargin.toFixed(1)}%
          </span>
        </div>
        
        {/* Profit indicator bar */}
        <div className="mt-3 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              financials.profitMargin >= 20 ? 'bg-green-500' 
              : financials.profitMargin >= 10 ? 'bg-yellow-500' 
              : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, financials.profitMargin * 2.5)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>20%</span>
          <span>40%+</span>
        </div>
      </div>
      
      {/* Per Unit Economics */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">Per Unit Economics</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-blue-50 rounded p-2">
            <div className="text-xs text-gray-600">Avg. Revenue/Unit</div>
            <div className="font-bold text-blue-600">
              {metrics.totalUnits > 0 
                ? formatCurrency(financials.grossDevelopmentValue / metrics.totalUnits)
                : '—'}
            </div>
          </div>
          <div className="bg-green-50 rounded p-2">
            <div className="text-xs text-gray-600">Avg. Profit/Unit</div>
            <div className="font-bold text-green-600">
              {metrics.totalUnits > 0 
                ? formatCurrency(financials.profit / metrics.totalUnits)
                : '—'}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tamil Nadu Tax Note */}
      <div className="text-xs text-gray-500 bg-yellow-50 rounded p-2">
        <strong>Tamil Nadu Taxes:</strong> Stamp Duty {(TN_TAX_RATES.stampDuty * 100).toFixed(0)}% + 
        Registration {(TN_TAX_RATES.registrationCharges * 100).toFixed(0)}% + 
        GST {(TN_TAX_RATES.gstUnderConstruction * 100).toFixed(0)}% (under construction)
      </div>
    </div>
  );
};

// TNRERA Area Statement Generator
export const AreaStatementPanel: React.FC = () => {
  const { buildings, metrics } = useAppStore();
  
  if (!metrics || buildings.length === 0) {
    return null;
  }
  
  const downloadStatement = () => {
    let statement = `TNRERA COMPLIANT AREA STATEMENT
=====================================
Generated: ${new Date().toLocaleDateString('en-IN')}

PROJECT SUMMARY
---------------
Total Plot Area: ${metrics.totalPlotArea.toFixed(2)} sq.m (${sqmToSqft(metrics.totalPlotArea).toFixed(0)} sq.ft)
Total Built-up Area: ${sqmToSqft(metrics.totalBuiltUpArea).toFixed(0)} sq.ft
Total Carpet Area: ${sqmToSqft(metrics.totalCarpetArea).toFixed(0)} sq.ft
Total Super Built-up Area: ${sqmToSqft(metrics.totalSuperBuiltUpArea).toFixed(0)} sq.ft
FSI Achieved: ${metrics.fsi.toFixed(2)}
Ground Coverage: ${(metrics.groundCoverage * 100).toFixed(1)}%
Total Units: ${metrics.totalUnits}

UNIT MIX BREAKDOWN
------------------
${Object.entries(metrics.unitMix).map(([bhk, count]) => `${bhk}: ${count} units`).join('\n')}

PARKING PROVISION
-----------------
Car Parking Required: ${metrics.parkingRequired} ECS
Car Parking Provided: ${metrics.parkingProvided} ECS
Two-Wheeler Parking: ${metrics.twoWheelerRequired} spaces

COMPLIANCE STATUS
-----------------
FSI: ${metrics.compliance.fsi ? 'COMPLIANT' : 'NON-COMPLIANT'}
Ground Coverage: ${metrics.compliance.coverage ? 'COMPLIANT' : 'NON-COMPLIANT'}
Parking: ${metrics.compliance.parking ? 'ADEQUATE' : 'INSUFFICIENT'}
Height: ${metrics.compliance.height ? 'WITHIN LIMIT' : 'EXCEEDS LIMIT'}

Note: This is a preliminary estimate. Final areas subject to 
detailed architectural drawings and TNRERA verification.
`;

    const blob = new Blob([statement], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TNRERA_Area_Statement.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-3">TNRERA Compliance</h3>
      
      <div className="text-sm text-gray-600 mb-3">
        Generate area statement as per Tamil Nadu RERA requirements
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <div className="bg-blue-50 rounded p-2">
          <div className="text-xs text-gray-600">Carpet</div>
          <div className="font-bold text-blue-600">{sqmToSqft(metrics.totalCarpetArea).toFixed(0)}</div>
          <div className="text-xs text-gray-500">sq.ft</div>
        </div>
        <div className="bg-green-50 rounded p-2">
          <div className="text-xs text-gray-600">Built-up</div>
          <div className="font-bold text-green-600">{sqmToSqft(metrics.totalBuiltUpArea).toFixed(0)}</div>
          <div className="text-xs text-gray-500">sq.ft</div>
        </div>
        <div className="bg-purple-50 rounded p-2">
          <div className="text-xs text-gray-600">Super B/U</div>
          <div className="font-bold text-purple-600">{sqmToSqft(metrics.totalSuperBuiltUpArea).toFixed(0)}</div>
          <div className="text-xs text-gray-500">sq.ft</div>
        </div>
      </div>
      
      <div className="text-xs text-gray-500 mb-3">
        Loading Factor: {metrics.totalCarpetArea > 0 
          ? ((metrics.totalSuperBuiltUpArea / metrics.totalCarpetArea - 1) * 100).toFixed(1)
          : 0}%
      </div>
      
      <button
        onClick={downloadStatement}
        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Download Area Statement
      </button>
    </div>
  );
};
