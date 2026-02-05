// 2D Floor Plan Editor Component

import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { UNIT_TEMPLATES, UNIT_COLORS, getUnitById } from '../data/unitTemplates';
import type { PlacedUnit } from '../types';

interface FloorPlanProps {
  buildingId: string;
  floor: number;
}

export const FloorPlanEditor: React.FC<FloorPlanProps> = ({ buildingId, floor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragUnit, setDragUnit] = useState<PlacedUnit | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  
  const {
    buildings,
    selectedUnitTypeId,
    addUnitToBuilding,
    updateUnit,
    removeUnit,
  } = useAppStore();
  
  const building = buildings.find(b => b.id === buildingId);
  const floorUnits = building?.units.filter(u => u.floor === floor) || [];
  
  const SCALE = 20; // pixels per meter
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x += SCALE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += SCALE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
    
    // Draw units
    floorUnits.forEach(unit => {
      const unitType = getUnitById(unit.unitTypeId);
      if (!unitType) return;
      
      const x = unit.x * SCALE;
      const y = unit.y * SCALE;
      const width = unitType.width * SCALE;
      const height = unitType.depth * SCALE;
      
      // Draw unit background
      ctx.fillStyle = unitType.color + (selectedUnit === unit.id ? 'ff' : 'cc');
      ctx.fillRect(x, y, width, height);
      
      // Draw unit border
      ctx.strokeStyle = selectedUnit === unit.id ? '#4f46e5' : '#666';
      ctx.lineWidth = selectedUnit === unit.id ? 3 : 1;
      ctx.strokeRect(x, y, width, height);
      
      // Draw room divisions
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 0.5;
      unitType.rooms.forEach(room => {
        const rx = x + room.x * SCALE;
        const ry = y + room.y * SCALE;
        const rw = room.width * SCALE;
        const rh = room.height * SCALE;
        ctx.strokeRect(rx, ry, rw, rh);
        
        // Draw room label
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = room.type.charAt(0).toUpperCase();
        ctx.fillText(label, rx + rw / 2, ry + rh / 2);
      });
      
      // Draw unit label
      ctx.fillStyle = '#333';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(unitType.bhkType, x + width / 2, y + 2);
      
      // Draw area
      ctx.font = '10px Arial';
      ctx.fillText(`${unitType.carpetArea} sqft`, x + width / 2, y + 16);
    });
    
    // Draw building outline if available
    if (building && building.footprint.length > 0) {
      // For now, just show a simple rectangular outline
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(10, 10, CANVAS_WIDTH - 20, CANVAS_HEIGHT - 20);
      ctx.setLineDash([]);
    }
    
  }, [floorUnits, selectedUnit, building]);
  
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / SCALE;
    const y = (e.clientY - rect.top) / SCALE;
    
    // Check if clicking on existing unit
    const clickedUnit = floorUnits.find(unit => {
      const unitType = getUnitById(unit.unitTypeId);
      if (!unitType) return false;
      return (
        x >= unit.x && x <= unit.x + unitType.width &&
        y >= unit.y && y <= unit.y + unitType.depth
      );
    });
    
    if (clickedUnit) {
      setSelectedUnit(clickedUnit.id);
    } else if (selectedUnitTypeId) {
      // Add new unit
      const newUnit: PlacedUnit = {
        id: `unit-${Date.now()}`,
        unitTypeId: selectedUnitTypeId,
        x: Math.floor(x),
        y: Math.floor(y),
        rotation: 0,
        floor,
      };
      addUnitToBuilding(buildingId, newUnit);
    } else {
      setSelectedUnit(null);
    }
  };
  
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / SCALE;
    const y = (e.clientY - rect.top) / SCALE;
    
    const clickedUnit = floorUnits.find(unit => {
      const unitType = getUnitById(unit.unitTypeId);
      if (!unitType) return false;
      return (
        x >= unit.x && x <= unit.x + unitType.width &&
        y >= unit.y && y <= unit.y + unitType.depth
      );
    });
    
    if (clickedUnit) {
      setIsDragging(true);
      setDragUnit(clickedUnit);
      setSelectedUnit(clickedUnit.id);
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragUnit) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / SCALE);
    const y = Math.floor((e.clientY - rect.top) / SCALE);
    
    updateUnit(buildingId, dragUnit.id, { x, y });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    setDragUnit(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' && selectedUnit) {
      removeUnit(buildingId, selectedUnit);
      setSelectedUnit(null);
    }
  };
  
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Floor {floor} Layout</h3>
        <div className="text-sm text-gray-600">
          {floorUnits.length} units on this floor
        </div>
      </div>
      
      <div className="flex gap-4">
        {/* Canvas */}
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            className="cursor-crosshair"
          />
        </div>
        
        {/* Unit Details */}
        {selectedUnit && (
          <div className="w-64 bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Selected Unit</h4>
            {(() => {
              const unit = floorUnits.find(u => u.id === selectedUnit);
              const unitType = unit ? getUnitById(unit.unitTypeId) : null;
              if (!unit || !unitType) return null;
              
              return (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <span className="ml-2 font-medium">{unitType.bhkType}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Carpet Area:</span>
                    <span className="ml-2 font-medium">{unitType.carpetArea} sqft</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Built-up Area:</span>
                    <span className="ml-2 font-medium">{unitType.builtUpArea} sqft</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Super Built-up:</span>
                    <span className="ml-2 font-medium">{unitType.superBuiltUpArea} sqft</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Position:</span>
                    <span className="ml-2 font-medium">({unit.x.toFixed(1)}, {unit.y.toFixed(1)})</span>
                  </div>
                  <button
                    onClick={() => {
                      removeUnit(buildingId, selectedUnit);
                      setSelectedUnit(null);
                    }}
                    className="mt-4 w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                  >
                    Delete Unit
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      
      <div className="text-sm text-gray-500">
        <p>• Click on canvas to place selected unit type</p>
        <p>• Drag units to reposition • Press Delete to remove selected unit</p>
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
