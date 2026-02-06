// 2D Floor Plan Editor - Professional Architectural Floor Plan Visualization

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { UNIT_TEMPLATES, UNIT_COLORS, getUnitById } from '../data/unitTemplates';
import type { Building } from '../types';

interface FloorPlanProps {
  buildingId: string;
  floor: number;
}

// Calculate floor plate dimensions from building footprint
const getFloorPlateDimensions = (building: Building) => {
  if (!building.footprint || building.footprint.length < 3) {
    return { width: 35, depth: 18 }; // Default professional floor plate
  }
  
  // Calculate bounding box from footprint
  const lngs = building.footprint.map(c => c.lng);
  const lats = building.footprint.map(c => c.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  
  // Convert to meters (approximate at Chennai latitude ~13°)
  const centerLat = (minLat + maxLat) / 2;
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
  const metersPerDegreeLat = 110540;
  
  const width = (maxLng - minLng) * metersPerDegreeLng;
  const depth = (maxLat - minLat) * metersPerDegreeLat;
  
  return { 
    width: Math.max(25, Math.min(width, 60)), 
    depth: Math.max(14, Math.min(depth, 25)) 
  };
};

export const FloorPlanEditor: React.FC<FloorPlanProps> = ({ buildingId, floor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  
  const { buildings, removeUnit } = useAppStore();
  
  const building = buildings.find(b => b.id === buildingId);
  const floorUnits = useMemo(() => 
    building?.units.filter(u => u.floor === floor) || [],
    [building?.units, floor]
  );
  
  // Get floor plate dimensions
  const dimensions = useMemo(() => 
    building ? getFloorPlateDimensions(building) : { width: 35, depth: 18 },
    [building]
  );
  
  // Canvas dimensions
  const CANVAS_WIDTH = 900;
  const CANVAS_HEIGHT = 500;
  const PADDING = 50;
  
  // Calculate scale to fit
  const SCALE = useMemo(() => {
    const scaleX = (CANVAS_WIDTH - 2 * PADDING) / dimensions.width;
    const scaleY = (CANVAS_HEIGHT - 2 * PADDING) / dimensions.depth;
    return Math.min(scaleX, scaleY, 22);
  }, [dimensions]);
  
  // Core architectural dimensions (meters)
  const CORRIDOR_WIDTH = 2.0;
  const LIFT_SIZE = 2.4;
  const STAIR_WIDTH = 3.0;
  const STAIR_DEPTH = 5.0;
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !building) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Enable better rendering
    ctx.imageSmoothingEnabled = true;
    
    // Clear canvas with off-white background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Calculate drawing origin (centered)
    const originX = (CANVAS_WIDTH - dimensions.width * SCALE) / 2;
    const originY = (CANVAS_HEIGHT - dimensions.depth * SCALE) / 2;
    
    // Helper function to convert building coords to canvas coords
    const toCanvasX = (x: number) => originX + x * SCALE;
    const toCanvasY = (y: number) => originY + y * SCALE;
    
    // Draw dimension grid (light, every 5 meters)
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= dimensions.width; x += 5) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(x), originY - 10);
      ctx.lineTo(toCanvasX(x), originY + dimensions.depth * SCALE + 10);
      ctx.stroke();
    }
    for (let y = 0; y <= dimensions.depth; y += 5) {
      ctx.beginPath();
      ctx.moveTo(originX - 10, toCanvasY(y));
      ctx.lineTo(originX + dimensions.width * SCALE + 10, toCanvasY(y));
      ctx.stroke();
    }
    
    // Draw outer building walls (thick)
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 4;
    ctx.strokeRect(
      toCanvasX(0), toCanvasY(0),
      dimensions.width * SCALE, dimensions.depth * SCALE
    );
    
    // Fill building floor
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      toCanvasX(0), toCanvasY(0),
      dimensions.width * SCALE, dimensions.depth * SCALE
    );
    
    // Calculate core zone (center of building)
    const coreWidth = STAIR_WIDTH * 2 + LIFT_SIZE * (building.liftCores || 1) + 4;
    const corridorY = (dimensions.depth - CORRIDOR_WIDTH) / 2;
    
    // Log core width for debugging
    console.debug('Core width:', coreWidth);
    
    // Draw central corridor (full width of building)
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(
      toCanvasX(0), toCanvasY(corridorY),
      dimensions.width * SCALE, CORRIDOR_WIDTH * SCALE
    );
    
    // Corridor walls
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(toCanvasX(0), toCanvasY(corridorY));
    ctx.lineTo(toCanvasX(dimensions.width), toCanvasY(corridorY));
    ctx.moveTo(toCanvasX(0), toCanvasY(corridorY + CORRIDOR_WIDTH));
    ctx.lineTo(toCanvasX(dimensions.width), toCanvasY(corridorY + CORRIDOR_WIDTH));
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw lift cores
    const liftCount = building.liftCores || 1;
    const liftAreaWidth = liftCount * LIFT_SIZE + (liftCount - 1) * 0.5;
    const liftStartX = (dimensions.width - liftAreaWidth) / 2;
    const liftY = (dimensions.depth - LIFT_SIZE) / 2;
    
    for (let i = 0; i < liftCount; i++) {
      const liftX = liftStartX + i * (LIFT_SIZE + 0.5);
      
      // Lift shaft background
      ctx.fillStyle = '#d4d4d4';
      ctx.fillRect(
        toCanvasX(liftX), toCanvasY(liftY),
        LIFT_SIZE * SCALE, LIFT_SIZE * SCALE
      );
      
      // Lift shaft outline
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        toCanvasX(liftX), toCanvasY(liftY),
        LIFT_SIZE * SCALE, LIFT_SIZE * SCALE
      );
      
      // Lift car symbol (smaller rectangle inside)
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      const carPadding = 0.2;
      ctx.strokeRect(
        toCanvasX(liftX + carPadding), toCanvasY(liftY + carPadding),
        (LIFT_SIZE - carPadding * 2) * SCALE, (LIFT_SIZE - carPadding * 2) * SCALE
      );
      
      // Lift door indicator
      ctx.fillStyle = '#999';
      ctx.fillRect(
        toCanvasX(liftX + LIFT_SIZE / 2 - 0.4), toCanvasY(liftY - 0.1),
        0.8 * SCALE, 0.1 * SCALE
      );
      
      // "LIFT" label
      ctx.fillStyle = '#555';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LIFT', toCanvasX(liftX + LIFT_SIZE / 2), toCanvasY(liftY + LIFT_SIZE / 2));
    }
    
    // Draw staircases function
    const drawStaircase = (x: number, y: number, label: string) => {
      // Staircase background
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(
        toCanvasX(x), toCanvasY(y),
        STAIR_WIDTH * SCALE, STAIR_DEPTH * SCALE
      );
      
      // Staircase outline
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        toCanvasX(x), toCanvasY(y),
        STAIR_WIDTH * SCALE, STAIR_DEPTH * SCALE
      );
      
      // Draw stair treads
      const treadCount = 10;
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 0.5;
      for (let t = 1; t < treadCount; t++) {
        const treadY = y + (t / treadCount) * STAIR_DEPTH;
        ctx.beginPath();
        ctx.moveTo(toCanvasX(x), toCanvasY(treadY));
        ctx.lineTo(toCanvasX(x + STAIR_WIDTH), toCanvasY(treadY));
        ctx.stroke();
      }
      
      // Handrail
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(x + STAIR_WIDTH / 2), toCanvasY(y));
      ctx.lineTo(toCanvasX(x + STAIR_WIDTH / 2), toCanvasY(y + STAIR_DEPTH));
      ctx.stroke();
      
      // UP arrow
      ctx.fillStyle = '#555';
      ctx.font = 'bold 8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('▲ UP', toCanvasX(x + STAIR_WIDTH / 2), toCanvasY(y + 0.5));
      ctx.fillText(label, toCanvasX(x + STAIR_WIDTH / 2), toCanvasY(y + STAIR_DEPTH - 0.5));
    };
    
    // Left staircase
    drawStaircase(1.5, (dimensions.depth - STAIR_DEPTH) / 2, 'STAIR-1');
    // Right staircase
    drawStaircase(dimensions.width - STAIR_WIDTH - 1.5, (dimensions.depth - STAIR_DEPTH) / 2, 'STAIR-2');
    
    // Draw units on this floor
    floorUnits.forEach(unit => {
      const unitType = getUnitById(unit.unitTypeId);
      if (!unitType) return;
      
      const isSelected = selectedUnit === unit.id;
      const ux = unit.x;
      const uy = unit.y;
      const uw = unitType.width;
      const ud = unitType.depth;
      
      // Unit background with color
      ctx.fillStyle = unitType.color + (isSelected ? 'ee' : 'aa');
      ctx.fillRect(
        toCanvasX(ux), toCanvasY(uy),
        uw * SCALE, ud * SCALE
      );
      
      // Unit outline
      ctx.strokeStyle = isSelected ? '#4f46e5' : '#444';
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.strokeRect(
        toCanvasX(ux), toCanvasY(uy),
        uw * SCALE, ud * SCALE
      );
      
      // Draw room divisions (simplified)
      if (unitType.rooms && unitType.rooms.length > 0) {
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 2]);
        
        unitType.rooms.forEach(room => {
          ctx.strokeRect(
            toCanvasX(ux + room.x), toCanvasY(uy + room.y),
            room.width * SCALE, room.height * SCALE
          );
        });
        ctx.setLineDash([]);
      }
      
      // Unit label
      ctx.fillStyle = '#222';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        unitType.bhkType,
        toCanvasX(ux + uw / 2),
        toCanvasY(uy + ud / 2 - 0.4)
      );
      
      // Area label
      ctx.font = '9px Arial';
      ctx.fillStyle = '#444';
      ctx.fillText(
        `${unitType.carpetArea} sqft`,
        toCanvasX(ux + uw / 2),
        toCanvasY(uy + ud / 2 + 0.6)
      );
      
      // Unit number (small)
      ctx.font = '8px Arial';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'left';
      ctx.fillText(
        unit.id.replace('unit-', 'U'),
        toCanvasX(ux + 0.2),
        toCanvasY(uy + 0.5)
      );
    });
    
    // Draw dimension annotations
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    // Width dimension
    ctx.fillText(
      `${dimensions.width.toFixed(1)}m`,
      toCanvasX(dimensions.width / 2),
      originY - 20
    );
    
    // Depth dimension  
    ctx.save();
    ctx.translate(originX - 25, toCanvasY(dimensions.depth / 2));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${dimensions.depth.toFixed(1)}m`, 0, 0);
    ctx.restore();
    
    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${building.name} - Floor ${floor}${floor === 0 ? ' (Ground)' : building.stiltParking && floor === 0 ? ' (Stilt)' : ''}`,
      20, 25
    );
    
    // Legend
    ctx.font = '10px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText(`Lifts: ${building.liftCores || 1} | Staircases: ${building.staircases || 2}`, 20, 45);
    
    // Building outline (outer walls)
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 4;
    ctx.strokeRect(
      toCanvasX(0), toCanvasY(0),
      dimensions.width * SCALE, dimensions.depth * SCALE
    );
    
  }, [floorUnits, selectedUnit, building, floor, dimensions, SCALE]);
  
  // Handle click to select unit
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !building) return;
    
    const rect = canvas.getBoundingClientRect();
    const originX = (CANVAS_WIDTH - dimensions.width * SCALE) / 2;
    const originY = (CANVAS_HEIGHT - dimensions.depth * SCALE) / 2;
    
    // Convert click position to building coordinates
    const buildingX = (e.clientX - rect.left - originX) / SCALE;
    const buildingY = (e.clientY - rect.top - originY) / SCALE;
    
    // Find clicked unit
    const clickedUnit = floorUnits.find(unit => {
      const unitType = getUnitById(unit.unitTypeId);
      if (!unitType) return false;
      return (
        buildingX >= unit.x && 
        buildingX <= unit.x + unitType.width &&
        buildingY >= unit.y && 
        buildingY <= unit.y + unitType.depth
      );
    });
    
    setSelectedUnit(clickedUnit?.id || null);
  };
  
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">
          Floor Plan View - Level {floor}
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {floorUnits.length} units on this floor
          </span>
          {selectedUnit && (
            <button
              onClick={() => {
                removeUnit(buildingId, selectedUnit);
                setSelectedUnit(null);
              }}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition"
            >
              Delete Selected
            </button>
          )}
        </div>
      </div>
      
      <div className="flex gap-4">
        {/* Canvas */}
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            className="cursor-pointer"
          />
        </div>
        
        {/* Unit Details Panel */}
        {selectedUnit && (
          <div className="w-72 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h4 className="font-semibold text-gray-800 mb-3 pb-2 border-b">
              Unit Details
            </h4>
            {(() => {
              const unit = floorUnits.find(u => u.id === selectedUnit);
              const unitType = unit ? getUnitById(unit.unitTypeId) : null;
              if (!unit || !unitType) return null;
              
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: unitType.color }}
                    />
                    <span className="font-semibold text-lg">{unitType.bhkType}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-gray-500 text-xs">Carpet Area</div>
                      <div className="font-medium">{unitType.carpetArea} sqft</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-gray-500 text-xs">Built-up</div>
                      <div className="font-medium">{unitType.builtUpArea} sqft</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-gray-500 text-xs">Super Built-up</div>
                      <div className="font-medium">{unitType.superBuiltUpArea} sqft</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-gray-500 text-xs">Dimensions</div>
                      <div className="font-medium">{unitType.width}m × {unitType.depth}m</div>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <div className="text-xs text-gray-500 mb-1">Rooms</div>
                    <div className="flex flex-wrap gap-1">
                      {unitType.rooms.map((room, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {room.type}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {unitType.vastuCompliant && (
                    <div className="flex items-center gap-1 text-green-600 text-sm">
                      <span>✓</span> Vastu Compliant
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#d4d4d4] border border-gray-400"></div>
          <span>Lift Core</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#e8e8e8] border border-gray-400"></div>
          <span>Staircase</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#f0f0f0] border border-gray-400"></div>
          <span>Corridor</span>
        </div>
        {Object.entries(UNIT_COLORS).slice(0, 4).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded-sm border"
              style={{ backgroundColor: color + 'aa' }}
            />
            <span className="text-xs">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Unit Library Panel
export const UnitLibrary: React.FC = () => {
  const { selectedUnitTypeId, setSelectedUnitType } = useAppStore();
  
  const bhkTypes = ['1RK', '1BHK', '1.5BHK', '2BHK', '2.5BHK', '3BHK', '4BHK'];
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4">Unit Library</h3>
      
      <div className="space-y-4">
        {bhkTypes.map(bhk => {
          const units = UNIT_TEMPLATES.filter(u => u.bhkType === bhk);
          if (units.length === 0) return null;
          
          return (
            <div key={bhk}>
              <div 
                className="flex items-center gap-2 mb-2"
                style={{ borderLeft: `4px solid ${UNIT_COLORS[bhk]}`, paddingLeft: '8px' }}
              >
                <span className="font-medium">{bhk}</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {units.map(unit => (
                  <button
                    key={unit.id}
                    onClick={() => setSelectedUnitType(
                      selectedUnitTypeId === unit.id ? null : unit.id
                    )}
                    className={`p-2 text-left rounded border transition ${
                      selectedUnitTypeId === unit.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{unit.name}</span>
                      <span 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: unit.color }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {unit.carpetArea} sqft | {unit.width}m × {unit.depth}m
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {selectedUnitTypeId && (
        <div className="mt-4 p-2 bg-indigo-50 rounded text-sm text-indigo-700">
          Click on floor plan to place unit
        </div>
      )}
    </div>
  );
};
