// Mapbox Map Component with Improved Site Drawing

import { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAppStore } from '../store/appStore';
import { calculatePolygonArea } from '../utils/calculations';
import type { Coordinate } from '../types';

mapboxgl.accessToken = 'pk.eyJ1IjoidmlzaGFsNzkiLCJhIjoiY21rNzhqcGs1MHpnNzNwcjV3ZnRhNHlmdiJ9.bl0s0KyFeXKnDda28QXaTg';

// City centers with popular areas
const CITY_CENTERS = {
  chennai: { lng: 80.2707, lat: 13.0827, zoom: 12 },
  coimbatore: { lng: 76.9558, lat: 11.0168, zoom: 12 },
};

type DrawingMode = 'idle' | 'drawing' | 'editing';

export const MapView: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('idle');
  const [tempPoints, setTempPoints] = useState<Coordinate[]>([]);
  const [tempArea, setTempArea] = useState<number>(0);
  const [cursorPosition, setCursorPosition] = useState<Coordinate | null>(null);
  
  const {
    city,
    site,
    buildings,
    roadWidth,
    zone,
    setSite,
  } = useAppStore();
  
  // Calculate area as user draws
  useEffect(() => {
    if (tempPoints.length >= 3) {
      const area = calculatePolygonArea(tempPoints);
      setTempArea(area);
    } else {
      setTempArea(0);
    }
  }, [tempPoints]);
  
  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    
    const center = CITY_CENTERS[city];
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [center.lng, center.lat],
      zoom: center.zoom,
    });
    
    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.current.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    
    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Site boundary source and layers
      map.current!.addSource('site-boundary', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      
      map.current!.addLayer({
        id: 'site-boundary-fill',
        type: 'fill',
        source: 'site-boundary',
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.25,
        },
      });
      
      map.current!.addLayer({
        id: 'site-boundary-line',
        type: 'line',
        source: 'site-boundary',
        paint: {
          'line-color': '#059669',
          'line-width': 3,
        },
      });
      
      // Drawing polygon source and layers
      map.current!.addSource('drawing-polygon', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      
      map.current!.addLayer({
        id: 'drawing-polygon-fill',
        type: 'fill',
        source: 'drawing-polygon',
        paint: {
          'fill-color': '#6366f1',
          'fill-opacity': 0.3,
        },
      });
      
      map.current!.addLayer({
        id: 'drawing-polygon-line',
        type: 'line',
        source: 'drawing-polygon',
        paint: {
          'line-color': '#4f46e5',
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });
      
      // Drawing points source and layer
      map.current!.addSource('drawing-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      
      map.current!.addLayer({
        id: 'drawing-points-layer',
        type: 'circle',
        source: 'drawing-points',
        paint: {
          'circle-radius': 8,
          'circle-color': '#4f46e5',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
      
      // First point indicator (larger)
      map.current!.addSource('first-point', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      
      map.current!.addLayer({
        id: 'first-point-layer',
        type: 'circle',
        source: 'first-point',
        paint: {
          'circle-radius': 12,
          'circle-color': '#22c55e',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
      
      // Cursor line (from last point to cursor)
      map.current!.addSource('cursor-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      
      map.current!.addLayer({
        id: 'cursor-line-layer',
        type: 'line',
        source: 'cursor-line',
        paint: {
          'line-color': '#4f46e5',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
      
      // Buildings source and layer
      map.current!.addSource('buildings', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      
      map.current!.addLayer({
        id: 'buildings-layer',
        type: 'fill-extrusion',
        source: 'buildings',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.85,
        },
      });
    });
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Update map center when city changes
  useEffect(() => {
    if (!map.current) return;
    const center = CITY_CENTERS[city];
    map.current.flyTo({ center: [center.lng, center.lat], zoom: center.zoom });
  }, [city]);
  
  // Drawing control functions - defined before use in effects
  const finishDrawing = useCallback(() => {
    if (tempPoints.length >= 3) {
      const area = calculatePolygonArea(tempPoints);
      setSite({
        coordinates: tempPoints,
        area,
        roadWidth,
        zone,
      });
    }
    setDrawingMode('idle');
    setTempPoints([]);
    setCursorPosition(null);
  }, [tempPoints, roadWidth, zone, setSite]);
  
  const cancelDrawing = useCallback(() => {
    setDrawingMode('idle');
    setTempPoints([]);
    setCursorPosition(null);
    setTempArea(0);
  }, []);
  
  // Handle map interactions for drawing
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (drawingMode !== 'drawing') return;
      
      const newPoint = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      
      // Check if clicking near the first point to close polygon
      if (tempPoints.length >= 3) {
        const firstPoint = tempPoints[0];
        const distance = Math.sqrt(
          Math.pow(e.lngLat.lng - firstPoint.lng, 2) + 
          Math.pow(e.lngLat.lat - firstPoint.lat, 2)
        );
        
        // If clicking near first point (within ~20 meters at this zoom), close the polygon
        if (distance < 0.0002) {
          finishDrawing();
          return;
        }
      }
      
      setTempPoints(prev => [...prev, newPoint]);
    };
    
    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (drawingMode === 'drawing') {
        setCursorPosition({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      }
    };
    
    const handleDblClick = (e: mapboxgl.MapMouseEvent) => {
      if (drawingMode === 'drawing' && tempPoints.length >= 3) {
        e.preventDefault();
        finishDrawing();
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawingMode === 'drawing') {
        cancelDrawing();
      }
      if (e.key === 'Enter' && drawingMode === 'drawing' && tempPoints.length >= 3) {
        finishDrawing();
      }
      if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && drawingMode === 'drawing' && tempPoints.length > 0) {
        setTempPoints(prev => prev.slice(0, -1));
      }
    };
    
    map.current.on('click', handleClick);
    map.current.on('mousemove', handleMouseMove);
    map.current.on('dblclick', handleDblClick);
    window.addEventListener('keydown', handleKeyDown);
    
    // Change cursor based on mode
    if (map.current.getCanvas()) {
      map.current.getCanvas().style.cursor = drawingMode === 'drawing' ? 'crosshair' : '';
    }
    
    return () => {
      if (map.current) {
        map.current.off('click', handleClick);
        map.current.off('mousemove', handleMouseMove);
        map.current.off('dblclick', handleDblClick);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawingMode, tempPoints, mapLoaded, finishDrawing, cancelDrawing]);
  
  // Update drawing visualization
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    const pointsSource = map.current.getSource('drawing-points') as mapboxgl.GeoJSONSource;
    const polygonSource = map.current.getSource('drawing-polygon') as mapboxgl.GeoJSONSource;
    const firstPointSource = map.current.getSource('first-point') as mapboxgl.GeoJSONSource;
    const cursorLineSource = map.current.getSource('cursor-line') as mapboxgl.GeoJSONSource;
    
    if (pointsSource) {
      pointsSource.setData({
        type: 'FeatureCollection',
        features: tempPoints.slice(1).map(point => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
          properties: {},
        })),
      });
    }
    
    if (firstPointSource && tempPoints.length > 0) {
      firstPointSource.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [tempPoints[0].lng, tempPoints[0].lat] },
          properties: {},
        }],
      });
    } else if (firstPointSource) {
      firstPointSource.setData({ type: 'FeatureCollection', features: [] });
    }
    
    if (polygonSource && tempPoints.length >= 3) {
      polygonSource.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              ...tempPoints.map(p => [p.lng, p.lat]),
              [tempPoints[0].lng, tempPoints[0].lat],
            ]],
          },
          properties: {},
        }],
      });
    } else if (polygonSource) {
      polygonSource.setData({ type: 'FeatureCollection', features: [] });
    }
    
    // Cursor line from last point to cursor
    if (cursorLineSource && tempPoints.length > 0 && cursorPosition && drawingMode === 'drawing') {
      const lastPoint = tempPoints[tempPoints.length - 1];
      cursorLineSource.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [lastPoint.lng, lastPoint.lat],
              [cursorPosition.lng, cursorPosition.lat],
            ],
          },
          properties: {},
        }],
      });
    } else if (cursorLineSource) {
      cursorLineSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [tempPoints, cursorPosition, drawingMode, mapLoaded]);
  
  // Update saved site boundary visualization
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    const source = map.current.getSource('site-boundary') as mapboxgl.GeoJSONSource;
    
    if (source && site && site.coordinates.length >= 3) {
      source.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              ...site.coordinates.map(c => [c.lng, c.lat]),
              [site.coordinates[0].lng, site.coordinates[0].lat],
            ]],
          },
          properties: {},
        }],
      });
    } else if (source) {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [site, mapLoaded]);
  
  // Update buildings visualization
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    const source = map.current.getSource('buildings') as mapboxgl.GeoJSONSource;
    
    if (source) {
      const features = buildings.map((building, index) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            ...building.footprint.map(c => [c.lng, c.lat]),
            [building.footprint[0].lng, building.footprint[0].lat],
          ]],
        },
        properties: {
          color: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'][index % 4],
          height: building.floors * building.floorHeight,
          base: building.stiltParking ? 3 : 0,
        },
      }));
      
      source.setData({ type: 'FeatureCollection', features });
    }
  }, [buildings, mapLoaded]);
  
  // More drawing control functions
  const startDrawing = useCallback(() => {
    setDrawingMode('drawing');
    setTempPoints([]);
    setTempArea(0);
    // Clear existing site when starting new drawing
    setSite(null);
  }, [setSite]);
  
  const clearSite = useCallback(() => {
    setSite(null);
  }, [setSite]);
  
  const undoLastPoint = useCallback(() => {
    setTempPoints(prev => prev.slice(0, -1));
  }, []);
  
  const formatArea = (sqm: number) => {
    const sqft = sqm * 10.764;
    if (sqm >= 10000) {
      return `${(sqm / 10000).toFixed(2)} hectares (${(sqft / 43560).toFixed(2)} acres)`;
    }
    return `${sqm.toFixed(0)} m² (${sqft.toFixed(0)} sq.ft)`;
  };
  
  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Drawing Controls Panel */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {drawingMode === 'idle' && !site && (
          <button
            onClick={startDrawing}
            className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center gap-2 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Draw Site Boundary
          </button>
        )}
        
        {drawingMode === 'idle' && site && (
          <div className="flex flex-col gap-2">
            <button
              onClick={startDrawing}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg shadow-lg hover:bg-amber-600 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Redraw Site
            </button>
            <button
              onClick={clearSite}
              className="px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Site
            </button>
          </div>
        )}
        
        {drawingMode === 'drawing' && (
          <div className="flex flex-col gap-2">
            <button
              onClick={finishDrawing}
              disabled={tempPoints.length < 3}
              className="px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Complete ({tempPoints.length} points)
            </button>
            <button
              onClick={undoLastPoint}
              disabled={tempPoints.length === 0}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg shadow-lg hover:bg-gray-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo (Ctrl+Z)
            </button>
            <button
              onClick={cancelDrawing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel (Esc)
            </button>
          </div>
        )}
      </div>
      
      {/* Drawing Instructions Panel */}
      {drawingMode === 'drawing' && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></span>
            Drawing Mode Active
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Click on map to add corner points</li>
            <li>• Click near <span className="text-green-600 font-medium">green start point</span> to close</li>
            <li>• Or double-click / press Enter to finish</li>
            <li>• Press Esc to cancel</li>
            <li>• Ctrl+Z to undo last point</li>
          </ul>
          
          {tempArea > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs text-gray-500">Preview Area</div>
              <div className="text-lg font-bold text-indigo-600">{formatArea(tempArea)}</div>
            </div>
          )}
        </div>
      )}
      
      {/* Saved Site Info Panel */}
      {site && site.area > 0 && drawingMode === 'idle' && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h3 className="font-bold text-gray-800">Site Defined</h3>
          </div>
          <div className="space-y-1">
            <div>
              <div className="text-xs text-gray-500">Total Area</div>
              <div className="text-xl font-bold text-green-600">{formatArea(site.area)}</div>
            </div>
            <div className="text-xs text-gray-500">
              {site.coordinates.length} boundary points
            </div>
          </div>
        </div>
      )}
      
      {/* Status Bar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${drawingMode === 'drawing' ? 'bg-yellow-400 animate-pulse' : site ? 'bg-green-400' : 'bg-gray-400'}`}></span>
          {drawingMode === 'drawing' 
            ? `Drawing... ${tempPoints.length} points`
            : site 
              ? `Site: ${formatArea(site.area)}`
              : 'No site defined'
          }
        </span>
        {drawingMode === 'drawing' && tempPoints.length >= 3 && (
          <span className="text-green-400">Ready to complete</span>
        )}
      </div>
    </div>
  );
};
