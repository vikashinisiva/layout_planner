// Global State Management with Zustand

import { create } from 'zustand';
import type { 
  Project, 
  Building, 
  SiteBoundary, 
  CityType, 
  ZoneType, 
  PlacedUnit,
  Metrics,
  FinancialAnalysis,
  GeneratedFloorPlan
} from '../types';

interface AppState {
  // Project State
  currentProject: Project | null;
  
  // Site State
  site: SiteBoundary | null;
  
  // Building State
  buildings: Building[];
  selectedBuildingId: string | null;
  
  // UI State
  activeStep: number;
  viewMode: '2d' | '3d';
  selectedUnitTypeId: string | null;
  showVastu: boolean;
  
  // City/Zone
  city: CityType;
  zone: ZoneType;
  roadWidth: number;
  usePremiumFSI: boolean;
  
  // Metrics
  metrics: Metrics | null;
  financials: FinancialAnalysis | null;
  
  // AI-Generated Floor Plan
  generatedFloorPlan: GeneratedFloorPlan | null;
  
  // Actions
  setCity: (city: CityType) => void;
  setZone: (zone: ZoneType) => void;
  setRoadWidth: (width: number) => void;
  setUsePremiumFSI: (use: boolean) => void;
  
  setSite: (site: SiteBoundary | null) => void;
  
  addBuilding: (building: Building) => void;
  updateBuilding: (id: string, updates: Partial<Building>) => void;
  deleteBuilding: (id: string) => void;
  selectBuilding: (id: string | null) => void;
  clearBuildings: () => void;
  
  addUnitToBuilding: (buildingId: string, unit: PlacedUnit) => void;
  updateUnit: (buildingId: string, unitId: string, updates: Partial<PlacedUnit>) => void;
  removeUnit: (buildingId: string, unitId: string) => void;
  
  setActiveStep: (step: number) => void;
  setViewMode: (mode: '2d' | '3d') => void;
  setSelectedUnitType: (id: string | null) => void;
  setShowVastu: (show: boolean) => void;
  
  setMetrics: (metrics: Metrics) => void;
  setFinancials: (financials: FinancialAnalysis) => void;
  
  setGeneratedFloorPlan: (plan: GeneratedFloorPlan | null) => void;
  clearGeneratedFloorPlan: () => void;
  
  resetProject: () => void;
  loadProject: (project: Project) => void;
}

const initialState = {
  currentProject: null,
  site: null,
  buildings: [],
  selectedBuildingId: null,
  activeStep: 1,
  viewMode: '2d' as const,
  selectedUnitTypeId: null,
  showVastu: false,
  city: 'chennai' as CityType,
  zone: 'residential' as ZoneType,
  roadWidth: 12,
  usePremiumFSI: false,
  metrics: null,
  financials: null,
  generatedFloorPlan: null,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  
  setCity: (city) => set({ city }),
  setZone: (zone) => set({ zone }),
  setRoadWidth: (roadWidth) => set({ roadWidth }),
  setUsePremiumFSI: (usePremiumFSI) => set({ usePremiumFSI }),
  
  setSite: (site) => set({ site }),
  
  addBuilding: (building) => set((state) => ({
    buildings: [...state.buildings, building]
  })),
  
  updateBuilding: (id, updates) => set((state) => ({
    buildings: state.buildings.map(b => 
      b.id === id ? { ...b, ...updates } : b
    )
  })),
  
  deleteBuilding: (id) => set((state) => ({
    buildings: state.buildings.filter(b => b.id !== id),
    selectedBuildingId: state.selectedBuildingId === id ? null : state.selectedBuildingId
  })),
  
  selectBuilding: (id) => set({ selectedBuildingId: id }),
  
  clearBuildings: () => set({ buildings: [] }),
  
  addUnitToBuilding: (buildingId, unit) => set((state) => ({
    buildings: state.buildings.map(b => 
      b.id === buildingId 
        ? { ...b, units: [...b.units, unit] }
        : b
    )
  })),
  
  updateUnit: (buildingId, unitId, updates) => set((state) => ({
    buildings: state.buildings.map(b => 
      b.id === buildingId 
        ? { 
            ...b, 
            units: b.units.map(u => 
              u.id === unitId ? { ...u, ...updates } : u
            )
          }
        : b
    )
  })),
  
  removeUnit: (buildingId, unitId) => set((state) => ({
    buildings: state.buildings.map(b => 
      b.id === buildingId 
        ? { ...b, units: b.units.filter(u => u.id !== unitId) }
        : b
    )
  })),
  
  setActiveStep: (activeStep) => set({ activeStep }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedUnitType: (selectedUnitTypeId) => set({ selectedUnitTypeId }),
  setShowVastu: (showVastu) => set({ showVastu }),
  
  setMetrics: (metrics) => set({ metrics }),
  setFinancials: (financials) => set({ financials }),
  
  setGeneratedFloorPlan: (generatedFloorPlan) => set({ generatedFloorPlan }),
  clearGeneratedFloorPlan: () => set({ generatedFloorPlan: null }),
  
  resetProject: () => set(initialState),
  
  loadProject: (project) => set({
    currentProject: project,
    site: project.site,
    buildings: project.buildings,
    city: project.city,
  }),
}));
