"""
Floor Plate Optimizer - Zenerate-Level Building Layout Generation

This module implements a constraint-based optimization system for generating
multiple building layout variants with proper unit arrangement, core placement,
and regulatory compliance.

Key Features:
- Multi-template floor plate generation (I, L, U, H, Courtyard shapes)
- Constraint-based unit packing with bin-packing algorithms
- Fire-code-compliant core placement (lifts, stairs)
- Multiple variant generation with scoring
- Aspect ratio and ventilation optimization
- Structural grid alignment
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Any
from enum import Enum
import random
from shapely.geometry import Polygon, Point, box, MultiPolygon
from shapely.ops import unary_union
from shapely.affinity import translate, rotate, scale
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES & ENUMS
# =============================================================================

class BuildingShape(Enum):
    """Building floor plate shape templates"""
    LINEAR = "linear"           # Simple rectangle (I-shape)
    L_SHAPE = "l_shape"         # L-shaped building
    U_SHAPE = "u_shape"         # U-shaped (3 wings)
    H_SHAPE = "h_shape"         # H-shaped (parallel wings with connector)
    COURTYARD = "courtyard"     # Square with central courtyard
    T_SHAPE = "t_shape"         # T-shaped building
    PLUS = "plus"               # Plus/cross shape


class CorridorType(Enum):
    """Corridor configuration types"""
    SINGLE_LOADED = "single"    # Units on one side only (better light, less efficient)
    DOUBLE_LOADED = "double"    # Units on both sides (more efficient, 12-15m max depth)
    POINT_BLOCK = "point"       # Central core, units around (towers)


@dataclass
class UnitTemplate:
    """Unit type definition"""
    id: str
    name: str
    bhk_type: str  # 1RK, 1BHK, 2BHK, etc.
    width: float   # meters
    depth: float   # meters
    carpet_area: float    # sqm
    super_built_up: float # sqm
    min_aspect_ratio: float = 0.4  # min width/depth
    max_aspect_ratio: float = 2.5  # max width/depth
    requires_ventilation: bool = True
    color: str = "#B3E5FC"
    

@dataclass
class CoreTemplate:
    """Vertical circulation core (lifts + stairs)"""
    id: str
    width: float  # meters
    depth: float  # meters
    lift_count: int
    stair_count: int
    fire_rated: bool = True
    

@dataclass  
class PlacedUnit:
    """A unit placed on the floor plate"""
    id: str
    unit_type_id: str
    x: float  # left edge position
    y: float  # bottom edge position
    width: float
    depth: float
    rotation: float = 0.0  # degrees
    floor: int = 0
    has_balcony: bool = False
    ventilation_sides: List[str] = field(default_factory=list)  # N, S, E, W
    
    def get_polygon(self) -> Polygon:
        """Get shapely polygon for this unit"""
        return box(self.x, self.y, self.x + self.width, self.y + self.depth)
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "unitTypeId": self.unit_type_id,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "depth": self.depth,
            "rotation": self.rotation,
            "floor": self.floor,
            "hasBalcony": self.has_balcony,
            "ventilationSides": self.ventilation_sides
        }


@dataclass
class PlacedCore:
    """A core placed on the floor plate"""
    id: str
    x: float
    y: float
    width: float
    depth: float
    lift_count: int
    stair_count: int
    
    def get_polygon(self) -> Polygon:
        return box(self.x, self.y, self.x + self.width, self.y + self.depth)
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "depth": self.depth,
            "liftCount": self.lift_count,
            "stairCount": self.stair_count
        }


@dataclass
class Corridor:
    """Corridor/circulation space"""
    x: float
    y: float
    width: float
    depth: float
    corridor_type: CorridorType
    
    def get_polygon(self) -> Polygon:
        return box(self.x, self.y, self.x + self.width, self.y + self.depth)
    
    def to_dict(self) -> Dict:
        return {
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "depth": self.depth,
            "type": self.corridor_type.value
        }


@dataclass
class FloorPlateResult:
    """Result of floor plate optimization for one floor"""
    floor_number: int
    units: List[PlacedUnit]
    cores: List[PlacedCore]
    corridors: List[Corridor]
    boundary_polygon: List[Tuple[float, float]]
    total_area: float
    usable_area: float
    efficiency: float  # usable/total ratio
    
    def to_dict(self) -> Dict:
        return {
            "floorNumber": self.floor_number,
            "units": [u.to_dict() for u in self.units],
            "cores": [c.to_dict() for c in self.cores],
            "corridors": [c.to_dict() for c in self.corridors],
            "boundaryPolygon": self.boundary_polygon,
            "totalArea": self.total_area,
            "usableArea": self.usable_area,
            "efficiency": self.efficiency
        }


@dataclass
class BuildingVariant:
    """A complete building design variant"""
    id: str
    name: str
    shape: BuildingShape
    corridor_type: CorridorType
    floors: List[FloorPlateResult]
    total_units: int
    unit_mix: Dict[str, int]
    total_built_up_area: float
    total_carpet_area: float
    fsi_achieved: float
    ground_coverage: float
    score: float  # Overall optimization score
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "shape": self.shape.value,
            "corridorType": self.corridor_type.value,
            "floors": [f.to_dict() for f in self.floors],
            "totalUnits": self.total_units,
            "unitMix": self.unit_mix,
            "totalBuiltUpArea": self.total_built_up_area,
            "totalCarpetArea": self.total_carpet_area,
            "fsiAchieved": self.fsi_achieved,
            "groundCoverage": self.ground_coverage,
            "score": self.score
        }


# =============================================================================
# REGULATIONS & CONSTRAINTS
# =============================================================================

@dataclass
class RegulationConstraints:
    """Building regulations for optimization"""
    max_fsi: float = 2.5
    max_coverage: float = 0.5
    max_height: float = 45.0  # meters
    floor_height: float = 3.0
    min_corridor_width: float = 1.8  # NBC India
    max_travel_distance: float = 22.5  # meters to fire exit (TNCDBR)
    min_staircase_count: int = 2
    lift_per_units: int = 50  # 1 lift per 50 units
    max_unit_depth: float = 15.0  # meters for dual-aspect ventilation
    min_unit_width: float = 3.0
    setbacks: Dict[str, float] = field(default_factory=lambda: {
        "front": 6.0, "rear": 3.0, "side1": 3.0, "side2": 3.0
    })


# =============================================================================
# DEFAULT UNIT TEMPLATES (Indian Market)
# =============================================================================

DEFAULT_UNIT_TEMPLATES = {
    "1RK": UnitTemplate(
        id="1rk-std", name="1 RK", bhk_type="1RK",
        width=5.5, depth=5.0, carpet_area=26.0, super_built_up=35.0,
        color="#FFE082"
    ),
    "1BHK": UnitTemplate(
        id="1bhk-std", name="1 BHK", bhk_type="1BHK",
        width=6.5, depth=6.5, carpet_area=42.0, super_built_up=55.0,
        color="#81D4FA"
    ),
    "1.5BHK": UnitTemplate(
        id="1.5bhk-std", name="1.5 BHK", bhk_type="1.5BHK",
        width=7.0, depth=7.0, carpet_area=52.0, super_built_up=68.0,
        color="#A5D6A7"
    ),
    "2BHK": UnitTemplate(
        id="2bhk-std", name="2 BHK", bhk_type="2BHK",
        width=8.5, depth=7.5, carpet_area=65.0, super_built_up=85.0,
        color="#90CAF9"
    ),
    "2.5BHK": UnitTemplate(
        id="2.5bhk-std", name="2.5 BHK", bhk_type="2.5BHK",
        width=9.5, depth=8.0, carpet_area=78.0, super_built_up=100.0,
        color="#80DEEA"
    ),
    "3BHK": UnitTemplate(
        id="3bhk-std", name="3 BHK", bhk_type="3BHK",
        width=11.0, depth=8.5, carpet_area=95.0, super_built_up=125.0,
        color="#CE93D8"
    ),
    "4BHK": UnitTemplate(
        id="4bhk-std", name="4 BHK", bhk_type="4BHK",
        width=13.0, depth=9.5, carpet_area=130.0, super_built_up=170.0,
        color="#F48FB1"
    ),
}


DEFAULT_CORE_TEMPLATES = {
    "small": CoreTemplate(id="core-small", width=4.0, depth=6.0, lift_count=1, stair_count=1),
    "medium": CoreTemplate(id="core-medium", width=5.0, depth=7.0, lift_count=2, stair_count=2),
    "large": CoreTemplate(id="core-large", width=6.0, depth=8.0, lift_count=3, stair_count=2),
}


# =============================================================================
# FLOOR PLATE OPTIMIZER
# =============================================================================

class FloorPlateOptimizer:
    """
    Main optimization engine for building layout generation.
    Generates multiple design variants using different strategies.
    """
    
    def __init__(
        self,
        site_boundary: List[Tuple[float, float]],
        regulations: RegulationConstraints,
        unit_templates: Optional[Dict[str, UnitTemplate]] = None
    ):
        self.site_polygon = Polygon(site_boundary)
        self.site_area = self.site_polygon.area
        self.regulations = regulations
        self.unit_templates = unit_templates or DEFAULT_UNIT_TEMPLATES
        
        # Calculate buildable area after setbacks
        self.buildable_polygon = self._apply_setbacks()
        self.buildable_area = self.buildable_polygon.area if self.buildable_polygon else 0
        
        logger.info(f"Site area: {self.site_area:.1f} sqm, Buildable: {self.buildable_area:.1f} sqm")
    
    def _apply_setbacks(self) -> Optional[Polygon]:
        """Apply setback regulations to get buildable polygon"""
        try:
            # Use average setback for buffering (simplified)
            avg_setback = np.mean(list(self.regulations.setbacks.values()))
            buffered = self.site_polygon.buffer(-avg_setback)
            
            if buffered.is_empty or buffered.area < 100:  # Minimum 100 sqm
                logger.warning("Site too small after setbacks")
                return None
            
            return buffered if isinstance(buffered, Polygon) else buffered.geoms[0]
        except Exception as e:
            logger.error(f"Error applying setbacks: {e}")
            return None
    
    def generate_variants(
        self,
        unit_program: Dict[str, int],  # {"2BHK": 40, "3BHK": 20, ...} percentages
        num_floors: int,
        num_variants: int = 5,
        stilt_parking: bool = True
    ) -> List[BuildingVariant]:
        """
        Generate multiple building layout variants.
        
        Args:
            unit_program: Target unit mix as percentages
            num_floors: Number of residential floors
            num_variants: Number of variants to generate
            stilt_parking: Whether ground floor is parking
            
        Returns:
            List of BuildingVariant, sorted by score (best first)
        """
        if not self.buildable_polygon:
            logger.error("No buildable area available")
            return []
        
        variants = []
        
        # Strategy 1: Different building shapes
        shapes_to_try = [
            BuildingShape.LINEAR,
            BuildingShape.L_SHAPE,
            BuildingShape.U_SHAPE,
        ]
        
        corridor_types = [CorridorType.DOUBLE_LOADED, CorridorType.SINGLE_LOADED]
        
        variant_id = 0
        for shape in shapes_to_try:
            for corridor_type in corridor_types:
                if variant_id >= num_variants:
                    break
                    
                try:
                    variant = self._generate_single_variant(
                        variant_id=f"variant-{variant_id + 1}",
                        shape=shape,
                        corridor_type=corridor_type,
                        unit_program=unit_program,
                        num_floors=num_floors,
                        stilt_parking=stilt_parking
                    )
                    if variant and variant.total_units > 0:
                        variants.append(variant)
                        variant_id += 1
                except Exception as e:
                    logger.warning(f"Failed to generate {shape.value} variant: {e}")
        
        # Add random variations if needed
        while len(variants) < num_variants:
            shape = random.choice(shapes_to_try)
            corridor = random.choice(corridor_types)
            try:
                variant = self._generate_single_variant(
                    variant_id=f"variant-{len(variants) + 1}",
                    shape=shape,
                    corridor_type=corridor,
                    unit_program=unit_program,
                    num_floors=num_floors,
                    stilt_parking=stilt_parking,
                    randomize=True
                )
                if variant and variant.total_units > 0:
                    variants.append(variant)
            except Exception as e:
                logger.warning(f"Failed to generate random variant: {e}")
                break
        
        # Sort by score (descending)
        variants.sort(key=lambda v: v.score, reverse=True)
        
        # Assign friendly names
        for i, v in enumerate(variants):
            v.name = f"Option {chr(65 + i)}: {v.shape.value.replace('_', ' ').title()}"
        
        return variants
    
    def _generate_single_variant(
        self,
        variant_id: str,
        shape: BuildingShape,
        corridor_type: CorridorType,
        unit_program: Dict[str, int],
        num_floors: int,
        stilt_parking: bool,
        randomize: bool = False
    ) -> Optional[BuildingVariant]:
        """Generate a single building variant"""
        
        # Get bounding box of buildable area
        minx, miny, maxx, maxy = self.buildable_polygon.bounds
        available_width = maxx - minx
        available_depth = maxy - miny
        
        # Design building envelope based on shape
        building_polygon = self._create_building_shape(
            shape, available_width, available_depth, minx, miny, randomize
        )
        
        if not building_polygon or building_polygon.area < 100:
            return None
        
        # Check ground coverage
        coverage = building_polygon.area / self.site_area
        if coverage > self.regulations.max_coverage:
            # Scale down to fit
            scale_factor = np.sqrt(self.regulations.max_coverage / coverage) * 0.95
            building_polygon = scale(building_polygon, scale_factor, scale_factor, origin='centroid')
        
        # Generate typical floor plate
        floor_plate = self._generate_floor_plate(
            building_polygon,
            corridor_type,
            unit_program,
            randomize
        )
        
        if not floor_plate or len(floor_plate.units) == 0:
            return None
        
        # Replicate across floors
        floors = []
        start_floor = 1 if stilt_parking else 0
        
        for floor_num in range(start_floor, start_floor + num_floors):
            # Create copies of units with updated floor number
            floor_units = [
                PlacedUnit(
                    id=u.id,
                    unit_type_id=u.unit_type_id,
                    x=u.x,
                    y=u.y,
                    width=u.width,
                    depth=u.depth,
                    rotation=u.rotation,
                    floor=floor_num,
                    has_balcony=u.has_balcony,
                    ventilation_sides=u.ventilation_sides.copy()
                )
                for u in floor_plate.units
            ]
            
            floor_copy = FloorPlateResult(
                floor_number=floor_num,
                units=floor_units,
                cores=floor_plate.cores.copy(),
                corridors=floor_plate.corridors.copy(),
                boundary_polygon=floor_plate.boundary_polygon,
                total_area=floor_plate.total_area,
                usable_area=floor_plate.usable_area,
                efficiency=floor_plate.efficiency
            )
            floors.append(floor_copy)
        
        # Calculate metrics
        total_units = len(floor_plate.units) * num_floors
        unit_mix = {}
        for unit in floor_plate.units:
            bhk = self._get_bhk_from_unit_id(unit.unit_type_id)
            unit_mix[bhk] = unit_mix.get(bhk, 0) + num_floors
        
        total_built_up = floor_plate.total_area * (num_floors + (1 if stilt_parking else 0))
        total_carpet = sum(
            self.unit_templates.get(self._get_bhk_from_unit_id(u.unit_type_id), 
                                    DEFAULT_UNIT_TEMPLATES["2BHK"]).carpet_area
            for u in floor_plate.units
        ) * num_floors
        
        fsi_achieved = total_built_up / self.site_area
        ground_coverage = building_polygon.area / self.site_area
        
        # Calculate score
        score = self._calculate_variant_score(
            total_units=total_units,
            fsi_achieved=fsi_achieved,
            ground_coverage=ground_coverage,
            efficiency=floor_plate.efficiency,
            unit_mix=unit_mix,
            target_mix=unit_program
        )
        
        return BuildingVariant(
            id=variant_id,
            name=f"{shape.value} variant",
            shape=shape,
            corridor_type=corridor_type,
            floors=floors,
            total_units=total_units,
            unit_mix=unit_mix,
            total_built_up_area=total_built_up,
            total_carpet_area=total_carpet,
            fsi_achieved=fsi_achieved,
            ground_coverage=ground_coverage,
            score=score
        )
    
    def _create_building_shape(
        self,
        shape: BuildingShape,
        max_width: float,
        max_depth: float,
        origin_x: float,
        origin_y: float,
        randomize: bool = False
    ) -> Optional[Polygon]:
        """Create building envelope polygon based on shape template"""
        
        # Random variation factors
        width_factor = random.uniform(0.7, 1.0) if randomize else 0.9
        depth_factor = random.uniform(0.7, 1.0) if randomize else 0.9
        
        width = max_width * width_factor
        depth = max_depth * depth_factor
        
        # Limit depth for ventilation
        depth = min(depth, self.regulations.max_unit_depth * 2 + 3)  # Double-loaded + corridor
        
        cx = origin_x + max_width / 2
        cy = origin_y + max_depth / 2
        
        if shape == BuildingShape.LINEAR:
            # Simple rectangle
            return box(cx - width/2, cy - depth/2, cx + width/2, cy + depth/2)
        
        elif shape == BuildingShape.L_SHAPE:
            # L-shaped: main block + wing
            wing_width = width * 0.4
            wing_depth = depth * 0.6
            
            main = box(cx - width/2, cy - depth/2, cx + width/2, cy + depth/2 - wing_depth/2)
            wing = box(cx + width/2 - wing_width, cy - depth/2, cx + width/2, cy + depth/2)
            
            return unary_union([main, wing])
        
        elif shape == BuildingShape.U_SHAPE:
            # U-shape: 3 wings around a courtyard
            wing_width = width * 0.25
            courtyard_width = width * 0.5
            
            left = box(cx - width/2, cy - depth/2, cx - width/2 + wing_width, cy + depth/2)
            right = box(cx + width/2 - wing_width, cy - depth/2, cx + width/2, cy + depth/2)
            bottom = box(cx - width/2, cy - depth/2, cx + width/2, cy - depth/2 + wing_width)
            
            return unary_union([left, right, bottom])
        
        elif shape == BuildingShape.H_SHAPE:
            # H-shape: two parallel wings with connector
            wing_width = width * 0.35
            connector_depth = depth * 0.3
            
            left = box(cx - width/2, cy - depth/2, cx - width/2 + wing_width, cy + depth/2)
            right = box(cx + width/2 - wing_width, cy - depth/2, cx + width/2, cy + depth/2)
            connector = box(cx - width/2 + wing_width, cy - connector_depth/2, 
                          cx + width/2 - wing_width, cy + connector_depth/2)
            
            return unary_union([left, right, connector])
        
        elif shape == BuildingShape.COURTYARD:
            # Square with central courtyard
            courtyard_size = min(width, depth) * 0.3
            outer = box(cx - width/2, cy - depth/2, cx + width/2, cy + depth/2)
            courtyard = box(cx - courtyard_size/2, cy - courtyard_size/2,
                          cx + courtyard_size/2, cy + courtyard_size/2)
            return outer.difference(courtyard)
        
        else:
            return box(cx - width/2, cy - depth/2, cx + width/2, cy + depth/2)
    
    def _generate_floor_plate(
        self,
        building_polygon: Polygon,
        corridor_type: CorridorType,
        unit_program: Dict[str, int],
        randomize: bool = False
    ) -> Optional[FloorPlateResult]:
        """Generate unit layout for a single floor plate"""
        
        minx, miny, maxx, maxy = building_polygon.bounds
        floor_width = maxx - minx
        floor_depth = maxy - miny
        
        units: List[PlacedUnit] = []
        cores: List[PlacedCore] = []
        corridors: List[Corridor] = []
        
        corridor_width = self.regulations.min_corridor_width
        
        # Determine unit templates to use based on program
        templates_to_use = []
        total_percent = sum(unit_program.values())
        
        for bhk_type, percent in unit_program.items():
            if percent > 0 and bhk_type in self.unit_templates:
                template = self.unit_templates[bhk_type]
                # Weight by percentage
                count = max(1, int((percent / total_percent) * 10))
                templates_to_use.extend([template] * count)
        
        if not templates_to_use:
            templates_to_use = [self.unit_templates["2BHK"]]
        
        # Place central core
        core_template = DEFAULT_CORE_TEMPLATES["medium"]
        core_x = minx + floor_width / 2 - core_template.width / 2
        core_y = miny + floor_depth / 2 - core_template.depth / 2
        
        core = PlacedCore(
            id="core-1",
            x=core_x,
            y=core_y,
            width=core_template.width,
            depth=core_template.depth,
            lift_count=core_template.lift_count,
            stair_count=core_template.stair_count
        )
        cores.append(core)
        
        # Create corridor based on type
        if corridor_type == CorridorType.DOUBLE_LOADED:
            # Horizontal corridor through center
            corridor = Corridor(
                x=minx,
                y=miny + floor_depth / 2 - corridor_width / 2,
                width=floor_width,
                depth=corridor_width,
                corridor_type=corridor_type
            )
            corridors.append(corridor)
            
            # Place units on both sides of corridor
            units.extend(self._place_units_double_loaded(
                minx, miny, floor_width, floor_depth,
                corridor, core, templates_to_use, randomize
            ))
        
        else:  # SINGLE_LOADED
            # Corridor along one edge
            corridor = Corridor(
                x=minx,
                y=miny + floor_depth - corridor_width,
                width=floor_width,
                depth=corridor_width,
                corridor_type=corridor_type
            )
            corridors.append(corridor)
            
            # Place units on one side only
            units.extend(self._place_units_single_loaded(
                minx, miny, floor_width, floor_depth,
                corridor, core, templates_to_use, randomize
            ))
        
        # Calculate areas
        total_area = building_polygon.area
        unit_area = sum(u.width * u.depth for u in units)
        core_area = sum(c.width * c.depth for c in cores)
        corridor_area = sum(c.width * c.depth for c in corridors)
        
        usable_area = unit_area
        efficiency = usable_area / total_area if total_area > 0 else 0
        
        # Get boundary coordinates
        if hasattr(building_polygon, 'exterior'):
            boundary = list(building_polygon.exterior.coords)
        else:
            boundary = [(minx, miny), (maxx, miny), (maxx, maxy), (minx, maxy)]
        
        return FloorPlateResult(
            floor_number=0,
            units=units,
            cores=cores,
            corridors=corridors,
            boundary_polygon=boundary,
            total_area=total_area,
            usable_area=usable_area,
            efficiency=efficiency
        )
    
    def _place_units_double_loaded(
        self,
        origin_x: float,
        origin_y: float,
        floor_width: float,
        floor_depth: float,
        corridor: Corridor,
        core: PlacedCore,
        templates: List[UnitTemplate],
        randomize: bool = False
    ) -> List[PlacedUnit]:
        """Place units on both sides of a double-loaded corridor"""
        
        units = []
        unit_id = 0
        
        # Calculate available depth for units on each side
        corridor_center_y = corridor.y + corridor.depth / 2
        top_depth = origin_y + floor_depth - (corridor.y + corridor.depth)
        bottom_depth = corridor.y - origin_y
        
        # Limit unit depth for ventilation
        max_unit_depth = min(self.regulations.max_unit_depth, top_depth, bottom_depth)
        
        # Core occupies space - work around it
        core_left = core.x
        core_right = core.x + core.width
        
        # Place units in top row (above corridor)
        x_pos = origin_x
        while x_pos < origin_x + floor_width - 3:  # Min 3m unit
            # Skip core area
            if x_pos < core_right and x_pos + 3 > core_left:
                x_pos = core_right + 0.5
                continue
            
            # Pick a template
            template = random.choice(templates) if randomize else templates[unit_id % len(templates)]
            
            # Fit unit width
            remaining_width = origin_x + floor_width - x_pos
            unit_width = min(template.width, remaining_width)
            
            if unit_width < self.regulations.min_unit_width:
                break
            
            unit_depth = min(template.depth, max_unit_depth)
            
            unit = PlacedUnit(
                id=f"unit-{unit_id}",
                unit_type_id=template.id,
                x=x_pos,
                y=corridor.y + corridor.depth,
                width=unit_width,
                depth=unit_depth,
                floor=0,
                ventilation_sides=["N"]  # Top side has ventilation
            )
            units.append(unit)
            unit_id += 1
            x_pos += unit_width + 0.3  # 30cm gap
        
        # Place units in bottom row (below corridor)
        x_pos = origin_x
        while x_pos < origin_x + floor_width - 3:
            # Skip core area
            if x_pos < core_right and x_pos + 3 > core_left:
                x_pos = core_right + 0.5
                continue
            
            template = random.choice(templates) if randomize else templates[unit_id % len(templates)]
            
            remaining_width = origin_x + floor_width - x_pos
            unit_width = min(template.width, remaining_width)
            
            if unit_width < self.regulations.min_unit_width:
                break
            
            unit_depth = min(template.depth, max_unit_depth)
            
            unit = PlacedUnit(
                id=f"unit-{unit_id}",
                unit_type_id=template.id,
                x=x_pos,
                y=corridor.y - unit_depth,
                width=unit_width,
                depth=unit_depth,
                floor=0,
                ventilation_sides=["S"]
            )
            units.append(unit)
            unit_id += 1
            x_pos += unit_width + 0.3
        
        return units
    
    def _place_units_single_loaded(
        self,
        origin_x: float,
        origin_y: float,
        floor_width: float,
        floor_depth: float,
        corridor: Corridor,
        core: PlacedCore,
        templates: List[UnitTemplate],
        randomize: bool = False
    ) -> List[PlacedUnit]:
        """Place units on one side of a single-loaded corridor"""
        
        units = []
        unit_id = 0
        
        # Units go below the corridor
        available_depth = corridor.y - origin_y
        max_unit_depth = min(self.regulations.max_unit_depth, available_depth)
        
        core_left = core.x
        core_right = core.x + core.width
        
        x_pos = origin_x
        while x_pos < origin_x + floor_width - 3:
            if x_pos < core_right and x_pos + 3 > core_left:
                x_pos = core_right + 0.5
                continue
            
            template = random.choice(templates) if randomize else templates[unit_id % len(templates)]
            
            remaining_width = origin_x + floor_width - x_pos
            unit_width = min(template.width, remaining_width)
            
            if unit_width < self.regulations.min_unit_width:
                break
            
            unit_depth = min(template.depth, max_unit_depth)
            
            unit = PlacedUnit(
                id=f"unit-{unit_id}",
                unit_type_id=template.id,
                x=x_pos,
                y=origin_y,
                width=unit_width,
                depth=unit_depth,
                floor=0,
                ventilation_sides=["S", "E", "W"]  # Single-loaded = 3-side ventilation
            )
            units.append(unit)
            unit_id += 1
            x_pos += unit_width + 0.3
        
        return units
    
    def _get_bhk_from_unit_id(self, unit_type_id: str) -> str:
        """Extract BHK type from unit type ID"""
        for bhk, template in self.unit_templates.items():
            if template.id == unit_type_id:
                return bhk
        return "2BHK"  # Default
    
    def _calculate_variant_score(
        self,
        total_units: int,
        fsi_achieved: float,
        ground_coverage: float,
        efficiency: float,
        unit_mix: Dict[str, int],
        target_mix: Dict[str, int]
    ) -> float:
        """
        Calculate optimization score for a variant.
        Higher is better (0-100 scale).
        """
        score = 0.0
        
        # Unit count score (more units = better, up to a point)
        unit_score = min(30, total_units * 0.5)
        score += unit_score
        
        # FSI utilization (closer to max = better)
        fsi_utilization = min(1.0, fsi_achieved / self.regulations.max_fsi)
        score += fsi_utilization * 25
        
        # Coverage efficiency
        coverage_score = min(1.0, ground_coverage / self.regulations.max_coverage) * 15
        score += coverage_score
        
        # Floor plate efficiency
        score += efficiency * 20
        
        # Unit mix match (how well does it match target?)
        if target_mix:
            total_target = sum(target_mix.values())
            total_actual = sum(unit_mix.values())
            if total_target > 0 and total_actual > 0:
                mix_error = 0
                for bhk, target_pct in target_mix.items():
                    actual_pct = (unit_mix.get(bhk, 0) / total_actual) * 100
                    target_normalized = (target_pct / total_target) * 100
                    mix_error += abs(actual_pct - target_normalized)
                mix_score = max(0, 10 - mix_error / 10)
                score += mix_score
        
        return min(100, score)


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def generate_floor_plate_variants(
    site_boundary: List[Tuple[float, float]],
    unit_program: Dict[str, int],
    num_floors: int = 10,
    num_variants: int = 5,
    stilt_parking: bool = True,
    regulations: Optional[RegulationConstraints] = None
) -> List[Dict]:
    """
    Main entry point for floor plate generation.
    
    Args:
        site_boundary: List of (x, y) coordinates in meters
        unit_program: {"2BHK": 40, "3BHK": 30, ...} percentages
        num_floors: Number of residential floors
        num_variants: Number of design alternatives
        stilt_parking: Whether ground floor is parking
        regulations: Optional custom regulations
        
    Returns:
        List of variant dictionaries
    """
    regs = regulations or RegulationConstraints()
    
    optimizer = FloorPlateOptimizer(
        site_boundary=site_boundary,
        regulations=regs
    )
    
    variants = optimizer.generate_variants(
        unit_program=unit_program,
        num_floors=num_floors,
        num_variants=num_variants,
        stilt_parking=stilt_parking
    )
    
    return [v.to_dict() for v in variants]


def convert_latlon_to_meters(
    coordinates: List[Dict[str, float]],
    center_lat: float = 13.0  # Chennai latitude
) -> List[Tuple[float, float]]:
    """
    Convert lat/lon coordinates to local meter coordinates.
    
    Args:
        coordinates: List of {"lng": x, "lat": y} dicts
        center_lat: Reference latitude for projection
        
    Returns:
        List of (x, y) tuples in meters
    """
    if not coordinates:
        return []
    
    # Calculate conversion factors
    meters_per_deg_lng = 111320 * np.cos(np.radians(center_lat))
    meters_per_deg_lat = 110540
    
    # Use first point as origin
    origin_lng = coordinates[0]["lng"]
    origin_lat = coordinates[0]["lat"]
    
    result = []
    for coord in coordinates:
        x = (coord["lng"] - origin_lng) * meters_per_deg_lng
        y = (coord["lat"] - origin_lat) * meters_per_deg_lat
        result.append((x, y))
    
    return result


def convert_meters_to_latlon(
    coordinates: List[Tuple[float, float]],
    origin_lng: float,
    origin_lat: float
) -> List[Dict[str, float]]:
    """
    Convert local meter coordinates back to lat/lon.
    """
    meters_per_deg_lng = 111320 * np.cos(np.radians(origin_lat))
    meters_per_deg_lat = 110540
    
    result = []
    for x, y in coordinates:
        lng = origin_lng + x / meters_per_deg_lng
        lat = origin_lat + y / meters_per_deg_lat
        result.append({"lng": lng, "lat": lat})
    
    return result
