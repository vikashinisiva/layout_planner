// Main Application Component

import React, { useState } from 'react';
import { MapView } from './components/MapView';
import { FloorPlanEditor, UnitLibrary } from './components/FloorPlanEditor';
import { ThreeView } from './components/ThreeView';
import { MetricsDashboard, UnitMixPanel } from './components/MetricsDashboard';
import { FinancialAnalysis, AreaStatementPanel } from './components/FinancialAnalysis';
import { ProjectSettings } from './components/ProjectSettings';
import { BuildingLayoutGenerator } from './components/BuildingLayoutGenerator';
import { useAppStore } from './store/appStore';
import { generateLayout, getDefaultUnitMix } from './utils/layoutGenerator';
import type { BuildingVariant } from './services/floorPlanApi';
import './index.css';

const STEPS = [
  { id: 1, name: 'Project Setup', description: 'Define site & constraints' },
  { id: 2, name: 'AI Generate', description: 'Auto-generate layout' },
  { id: 3, name: 'Floor Plan Editing', description: 'Refine unit placement' },
  { id: 4, name: 'Financial Analysis', description: 'Cost & revenue projection' },
  { id: 5, name: 'Export', description: 'Download reports' },
];

function App() {
  const {
    activeStep,
    setActiveStep,
    viewMode,
    setViewMode,
    site,
    buildings,
    city,
    zone,
    roadWidth,
    addBuilding,
    metrics,
  } = useAppStore();
  
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVariants, setGeneratedVariants] = useState<BuildingVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<BuildingVariant | null>(null);
  
  // Handle variant selection from the BuildingLayoutGenerator
  const handleVariantSelected = (variant: BuildingVariant) => {
    setSelectedVariant(variant);
    
    // Convert variant to building format and add to store
    if (variant.floors.length > 0) {
      const floor = variant.floors[0];
      const newBuilding = {
        id: variant.id,
        name: variant.name,
        footprint: floor.boundaryPolygonLatLon?.map(c => ({ lng: c.lng, lat: c.lat })) || [],
        floors: variant.floors.length,
        floorHeight: 3.0,
        units: floor.units.map(u => ({
          id: u.id,
          unitTypeId: u.unitTypeId,
          x: u.x,
          y: u.y,
          rotation: u.rotation,
          floor: u.floor,
        })),
        stiltParking: true,
        liftCores: floor.cores.length,
        staircases: floor.cores.reduce((sum, c) => sum + c.stairCount, 0),
      };
      
      // Clear existing buildings and add the new one
      useAppStore.getState().clearBuildings();
      addBuilding(newBuilding);
    }
  };
  
  // Handle generation complete
  const handleGenerationComplete = (variants: BuildingVariant[]) => {
    setGeneratedVariants(variants);
    if (variants.length > 0) {
      handleVariantSelected(variants[0]);
    }
  };
  
  const handleGenerateLayout = async () => {
    if (!site || site.area === 0) {
      alert('Please define a site boundary first');
      return;
    }
    
    setIsGenerating(true);
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const unitMix = getDefaultUnitMix(city, zone);
    const generatedBuildings = generateLayout(site, city, zone, roadWidth, {
      targetUnitMix: unitMix,
      maxFloors: 12,
      stiltParking: true,
      optimizeFor: 'profit',
      vastuCompliant: true,
    });
    
    generatedBuildings.forEach(building => addBuilding(building));
    
    setIsGenerating(false);
    setActiveStep(3);
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Layout Planner</h1>
              <p className="text-xs text-gray-500">AI-Powered Building Layout Generator for Tamil Nadu</p>
            </div>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('2d')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  viewMode === '2d'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                2D View
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  viewMode === '3d'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                3D View
              </button>
            </div>
            
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
              Export
            </button>
          </div>
        </div>
        
        {/* Step Navigator */}
        <div className="px-4 py-2 border-t bg-gray-50">
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setActiveStep(step.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                    activeStep === step.id
                      ? 'bg-indigo-100 text-indigo-700'
                      : activeStep > step.id
                        ? 'bg-green-50 text-green-700'
                        : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    activeStep === step.id
                      ? 'bg-indigo-600 text-white'
                      : activeStep > step.id
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                  }`}>
                    {activeStep > step.id ? '✓' : step.id}
                  </span>
                  <div className="text-left hidden md:block">
                    <div className="text-sm font-medium">{step.name}</div>
                    <div className="text-xs opacity-70">{step.description}</div>
                  </div>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${activeStep > step.id ? 'bg-green-400' : 'bg-gray-300'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-80 bg-white border-r overflow-y-auto p-4 space-y-4">
          {activeStep === 1 && <ProjectSettings />}
          
          {activeStep === 2 && (
            <div className="space-y-4">
              {site && site.area > 0 ? (
                <BuildingLayoutGenerator
                  siteBoundary={site.coordinates}
                  siteArea={site.area}
                  city={city}
                  zone={zone}
                  roadWidth={roadWidth}
                  onVariantSelected={handleVariantSelected}
                  onGenerationComplete={handleGenerationComplete}
                />
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <div className="font-semibold">No Site Defined</div>
                      <div className="text-sm">Please go to Step 1 and draw a site boundary first</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Quick Generate Button (fallback) */}
              {site && (
                <div className="border-t pt-4">
                  <button
                    onClick={handleGenerateLayout}
                    disabled={!site || isGenerating}
                    className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        Quick Generate (Rule-Based)
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Use rule-based algorithm for faster results
                  </p>
                </div>
              )}
            </div>
          )}
          
          {activeStep === 3 && (
            <>
              <UnitLibrary />
              
              {buildings.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold mb-2">Select Floor</h3>
                  <select
                    value={selectedFloor}
                    onChange={(e) => setSelectedFloor(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border rounded"
                  >
                    {Array.from({ length: buildings[0]?.floors || 1 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 && buildings[0]?.stiltParking ? 'Stilt (Parking)' : `Floor ${i}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          
          {activeStep === 4 && <FinancialAnalysis />}
          
          {activeStep === 5 && (
            <div className="space-y-4">
              <AreaStatementPanel />
              
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <h3 className="font-semibold">Export Options</h3>
                
                <button className="w-full px-4 py-3 border-2 border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-medium">PDF Report</div>
                    <div className="text-xs text-gray-500">Complete project summary</div>
                  </div>
                </button>
                
                <button className="w-full px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-medium">AutoCAD DXF</div>
                    <div className="text-xs text-gray-500">Floor plan drawings</div>
                  </div>
                </button>
                
                <button className="w-full px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-medium">Excel Sheet</div>
                    <div className="text-xs text-gray-500">Financial projections</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </aside>
        
        {/* Center - Main View */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            {viewMode === '2d' ? (
              activeStep === 3 && buildings.length > 0 ? (
                <div className="p-4 h-full overflow-auto bg-gray-50">
                  <FloorPlanEditor buildingId={buildings[0].id} floor={selectedFloor} />
                </div>
              ) : (
                <MapView />
              )
            ) : (
              <ThreeView />
            )}
          </div>
          
          {/* Bottom Actions */}
          <div className="p-4 bg-white border-t flex justify-between items-center">
            <button
              onClick={() => setActiveStep(Math.max(1, activeStep - 1))}
              disabled={activeStep === 1}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              ← Previous
            </button>
            
            <div className="text-sm text-gray-500">
              {site && `Site: ${site.area.toFixed(0)} m² | `}
              {buildings.length > 0 && `${buildings.length} building(s) | `}
              {metrics && `${metrics.totalUnits} units`}
            </div>
            
            <button
              onClick={() => setActiveStep(Math.min(5, activeStep + 1))}
              disabled={activeStep === 5}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>
        
        {/* Right Sidebar - Metrics */}
        <aside className="w-72 bg-white border-l overflow-y-auto p-4 space-y-4">
          <MetricsDashboard />
        </aside>
      </main>
    </div>
  );
}

export default App;
