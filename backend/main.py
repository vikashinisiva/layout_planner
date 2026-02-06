# Floor Plan Generation API
# FastAPI backend for GAT-Net based floor plan generation

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Tuple, Optional, Dict, Any
import torch
import numpy as np
from pathlib import Path
import logging

# Local imports
from gat_model import GATNet, load_model
from graph_utils import (
    preprocess_to_graphs,
    FloorPlanGenerator,
    scale_geometry,
    ROOM_EMBEDDINGS
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Floor Plan Generation API",
    description="AI-powered floor plan generation using Graph Attention Networks",
    version="1.0.0"
)

# Add CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
model = None
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')


# Pydantic models for request/response
class Coordinate(BaseModel):
    x: float
    y: float


class RoomRequest(BaseModel):
    type: str  # bedroom, bathroom, kitchen, living
    centroid: Coordinate
    min_area: Optional[float] = None


class GenerateFloorPlanRequest(BaseModel):
    """Request body for floor plan generation."""
    boundary_wkt: str = Field(..., description="Site boundary as WKT POLYGON string")
    front_door_wkt: str = Field(..., description="Front door as WKT POLYGON string")
    rooms: List[RoomRequest] = Field(..., description="Room constraints with types and centroids")
    bhk_config: Optional[str] = Field(None, description="BHK configuration like '2BHK', '3BHK'")
    scale_origin: Tuple[float, float] = Field((128, 128), description="Scale origin for coordinate transformation")


class RoomOutput(BaseModel):
    type: str
    category: int
    coordinates: List[List[float]]
    centroid: List[float]
    width: float
    height: float
    area: float


class GenerateFloorPlanResponse(BaseModel):
    """Response body for floor plan generation."""
    success: bool
    rooms: List[RoomOutput]
    boundary: List[List[float]]
    total_area: float
    message: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str


# Startup event to load model
@app.on_event("startup")
async def startup_event():
    """Load the GAT-Net model on startup."""
    global model
    
    # Find model checkpoint
    checkpoint_paths = [
        Path(__file__).parent.parent / "Layout gnn" / "Floor_Plan_Generation_using_GNNs-with-boundary" / "GAT-Net_model" / "checkpoints" / "GAT-Net_v3_UnScalled.pt",
        Path(__file__).parent / "checkpoints" / "GAT-Net_v3_UnScalled.pt",
        Path("checkpoints/GAT-Net_v3_UnScalled.pt"),
    ]
    
    checkpoint_path = None
    for path in checkpoint_paths:
        if path.exists():
            checkpoint_path = path
            break
    
    if checkpoint_path is None:
        logger.warning("Model checkpoint not found. API will run but generation will fail.")
        return
    
    try:
        model = load_model(str(checkpoint_path), device)
        logger.info(f"Model loaded successfully from {checkpoint_path}")
        logger.info(f"Using device: {device}")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check API health and model status."""
    return HealthResponse(
        status="healthy",
        model_loaded=model is not None,
        device=str(device)
    )


@app.post("/api/generate-floor-plan", response_model=GenerateFloorPlanResponse)
async def generate_floor_plan(request: GenerateFloorPlanRequest):
    """
    Generate a floor plan using GAT-Net model.
    
    Takes site boundary, front door position, and room constraints.
    Returns room polygons with positions and dimensions.
    """
    global model
    
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Check server logs.")
    
    try:
        # Parse room constraints from request
        room_centroids = []
        bathroom_centroids = []
        kitchen_centroids = []
        
        for room in request.rooms:
            centroid = (room.centroid.x, room.centroid.y)
            
            if room.type in ['bedroom', 'room']:
                room_centroids.append(centroid)
            elif room.type == 'bathroom':
                bathroom_centroids.append(centroid)
            elif room.type == 'kitchen':
                kitchen_centroids.append(centroid)
            # Living room is auto-placed at boundary centroid
        
        # Ensure at least one bedroom
        if not room_centroids:
            raise HTTPException(status_code=400, detail="At least one bedroom is required")
        
        # Preprocess inputs to graph format
        G, B, G_not_normalized, B_not_normalized, boundary, front_door, B_nx, G_nx = preprocess_to_graphs(
            boundary_wkt=request.boundary_wkt,
            front_door_wkt=request.front_door_wkt,
            room_centroids=room_centroids,
            bathroom_centroids=bathroom_centroids,
            kitchen_centroids=kitchen_centroids,
            scale_origin=request.scale_origin
        )
        
        # Debug: log graph info
        logger.info(f"Room graph has {G.x.shape[0]} nodes")
        logger.info(f"Room centroids: {room_centroids}")
        logger.info(f"Bathroom centroids: {bathroom_centroids}")
        logger.info(f"Kitchen centroids: {kitchen_centroids}")
        
        # Move to device
        G = G.to(device)
        B = B.to(device)
        
        # Run inference
        with torch.no_grad():
            width_pred, height_pred = model(G, B)
            width_pred = width_pred.cpu().numpy()
            height_pred = height_pred.cpu().numpy()
        
        # Combine predictions into [width, height] format per node
        # Note: GAT-Net_v3_UnScalled.pt outputs are already unscaled (no additional scaling needed)
        predictions = np.column_stack([width_pred, height_pred])
        
        # Debug: log predictions
        logger.info(f"Predictions shape: {predictions.shape}")
        logger.info(f"Width predictions: {width_pred}")
        logger.info(f"Height predictions: {height_pred}")
        
        # Generate floor plan polygons
        generator = FloorPlanGenerator(G_not_normalized, predictions)
        
        # Debug: log room data before floor plan generation
        for i in range(G_not_normalized.x.shape[0]):
            room_data = generator.get_room_data(i)
            logger.info(f"Room {i}: category={room_data['category']}, centroid={room_data['centroid']}, w={room_data['width']:.1f}, h={room_data['height']:.1f}")
        
        floor_plan = generator.generate_floor_plan(boundary, front_door.centroid)
        
        # Convert to response format
        rooms_output = [
            RoomOutput(
                type=room['type'],
                category=room['category'],
                coordinates=room['coordinates'],
                centroid=room['centroid'],
                width=room['width'],
                height=room['height'],
                area=room['area']
            )
            for room in floor_plan['rooms']
        ]
        
        return GenerateFloorPlanResponse(
            success=True,
            rooms=rooms_output,
            boundary=floor_plan['boundary'],
            total_area=floor_plan['total_area'],
            message=f"Generated floor plan with {len(rooms_output)} rooms"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error generating floor plan")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.post("/api/generate-from-bhk")
async def generate_from_bhk(
    boundary_wkt: str,
    front_door_wkt: str,
    bhk: str = "2BHK",
    scale_origin: Tuple[float, float] = (128, 128)
):
    """
    Simplified endpoint: Generate floor plan from just boundary, door, and BHK config.
    Auto-places room centroids based on boundary shape.
    """
    from shapely import wkt
    
    boundary = wkt.loads(boundary_wkt)
    front_door = wkt.loads(front_door_wkt)
    
    # Parse BHK config
    bhk = bhk.upper()
    num_bedrooms = int(bhk[0]) if bhk[0].isdigit() else 2
    
    # Auto-generate room centroids based on boundary
    minx, miny, maxx, maxy = boundary.bounds
    cx, cy = boundary.centroid.x, boundary.centroid.y
    width = maxx - minx
    height = maxy - miny
    
    rooms = []
    
    # Living room (center)
    rooms.append(RoomRequest(
        type="living",
        centroid=Coordinate(x=cx, y=cy)
    ))
    
    # Kitchen (near door)
    door_cx = front_door.centroid.x
    door_cy = front_door.centroid.y
    rooms.append(RoomRequest(
        type="kitchen",
        centroid=Coordinate(x=door_cx + width * 0.2, y=door_cy + height * 0.2)
    ))
    
    # Bedrooms (spread around)
    bedroom_positions = [
        (minx + width * 0.25, miny + height * 0.75),
        (minx + width * 0.75, miny + height * 0.75),
        (minx + width * 0.25, miny + height * 0.25),
    ]
    
    for i in range(num_bedrooms):
        pos = bedroom_positions[i % len(bedroom_positions)]
        rooms.append(RoomRequest(
            type="bedroom",
            centroid=Coordinate(x=pos[0], y=pos[1])
        ))
    
    # Bathrooms (one per bedroom, max 2)
    bathroom_positions = [
        (minx + width * 0.85, miny + height * 0.3),
        (minx + width * 0.15, miny + height * 0.3),
    ]
    
    num_bathrooms = min(num_bedrooms, 2)
    for i in range(num_bathrooms):
        pos = bathroom_positions[i]
        rooms.append(RoomRequest(
            type="bathroom",
            centroid=Coordinate(x=pos[0], y=pos[1])
        ))
    
    # Create request and forward to main endpoint
    request = GenerateFloorPlanRequest(
        boundary_wkt=boundary_wkt,
        front_door_wkt=front_door_wkt,
        rooms=rooms,
        bhk_config=bhk,
        scale_origin=scale_origin
    )
    
    return await generate_floor_plan(request)


@app.get("/api/room-types")
async def get_room_types():
    """Get available room types and their embeddings."""
    return {
        "room_types": ROOM_EMBEDDINGS,
        "bhk_options": ["1BHK", "2BHK", "3BHK", "4BHK"]
    }


# =============================================================================
# FLOOR PLATE OPTIMIZER ENDPOINTS (Building-Level Generation)
# =============================================================================

from floor_plate_optimizer import (
    generate_floor_plate_variants,
    convert_latlon_to_meters,
    convert_meters_to_latlon,
    RegulationConstraints,
    DEFAULT_UNIT_TEMPLATES
)


class FloorPlateRequest(BaseModel):
    """Request body for floor plate generation."""
    site_coordinates: List[Dict[str, float]] = Field(
        ..., 
        description="Site boundary as list of {lng, lat} coordinates"
    )
    unit_program: Dict[str, int] = Field(
        default={"2BHK": 40, "3BHK": 40, "1BHK": 20},
        description="Unit mix as percentages"
    )
    num_floors: int = Field(default=10, description="Number of residential floors")
    num_variants: int = Field(default=5, description="Number of design variants to generate")
    stilt_parking: bool = Field(default=True, description="Whether ground floor is parking")
    max_fsi: float = Field(default=2.5, description="Maximum allowed FSI")
    max_coverage: float = Field(default=0.5, description="Maximum ground coverage")
    setbacks: Optional[Dict[str, float]] = Field(
        default=None,
        description="Setback distances in meters"
    )


class FloorPlateResponse(BaseModel):
    """Response body for floor plate generation."""
    success: bool
    variants: List[Dict[str, Any]]
    site_area: float
    buildable_area: float
    message: str


@app.post("/api/generate-floor-plate", response_model=FloorPlateResponse)
async def generate_floor_plate(request: FloorPlateRequest):
    """
    Generate multiple building layout variants for a site.
    
    This is the Zenerate-level building layout generation endpoint.
    It generates multiple floor plate configurations with different:
    - Building shapes (Linear, L, U, H)
    - Corridor types (Single/Double loaded)
    - Unit arrangements
    
    Returns scored variants for comparison.
    """
    try:
        logger.info(f"Generating floor plate variants for site with {len(request.site_coordinates)} vertices")
        
        # Validate input
        if len(request.site_coordinates) < 3:
            raise HTTPException(status_code=400, detail="Site must have at least 3 coordinates")
        
        # Convert lat/lon to meters
        center_lat = request.site_coordinates[0].get("lat", 13.0)
        site_meters = convert_latlon_to_meters(request.site_coordinates, center_lat)
        
        # Calculate site area (approximate)
        from shapely.geometry import Polygon
        site_poly = Polygon(site_meters)
        site_area = site_poly.area
        
        logger.info(f"Site area: {site_area:.1f} sqm")
        
        # Create regulations
        regs = RegulationConstraints(
            max_fsi=request.max_fsi,
            max_coverage=request.max_coverage,
            setbacks=request.setbacks or {"front": 6.0, "rear": 3.0, "side1": 3.0, "side2": 3.0}
        )
        
        # Generate variants
        variants = generate_floor_plate_variants(
            site_boundary=site_meters,
            unit_program=request.unit_program,
            num_floors=request.num_floors,
            num_variants=request.num_variants,
            stilt_parking=request.stilt_parking,
            regulations=regs
        )
        
        if not variants:
            return FloorPlateResponse(
                success=False,
                variants=[],
                site_area=site_area,
                buildable_area=0,
                message="Could not generate variants. Site may be too small after setbacks."
            )
        
        # Convert meter coordinates back to lat/lon for each variant
        origin_lng = request.site_coordinates[0]["lng"]
        origin_lat = request.site_coordinates[0]["lat"]
        
        for variant in variants:
            for floor in variant.get("floors", []):
                # Convert unit positions
                for unit in floor.get("units", []):
                    unit_coords = [(unit["x"], unit["y"])]
                    latlon = convert_meters_to_latlon(unit_coords, origin_lng, origin_lat)
                    if latlon:
                        unit["lng"] = latlon[0]["lng"]
                        unit["lat"] = latlon[0]["lat"]
                
                # Convert boundary polygon
                if floor.get("boundaryPolygon"):
                    floor["boundaryPolygonLatLon"] = convert_meters_to_latlon(
                        floor["boundaryPolygon"],
                        origin_lng,
                        origin_lat
                    )
        
        # Calculate buildable area from first variant
        buildable_area = variants[0]["floors"][0]["totalArea"] if variants else 0
        
        return FloorPlateResponse(
            success=True,
            variants=variants,
            site_area=site_area,
            buildable_area=buildable_area,
            message=f"Generated {len(variants)} design variants"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error generating floor plate variants")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.get("/api/unit-templates")
async def get_unit_templates():
    """Get available unit type templates with dimensions."""
    templates = []
    for bhk_type, template in DEFAULT_UNIT_TEMPLATES.items():
        templates.append({
            "id": template.id,
            "name": template.name,
            "bhkType": bhk_type,
            "width": template.width,
            "depth": template.depth,
            "carpetArea": template.carpet_area,
            "superBuiltUp": template.super_built_up,
            "color": template.color
        })
    return {"templates": templates}


@app.get("/api/building-shapes")
async def get_building_shapes():
    """Get available building shape templates."""
    return {
        "shapes": [
            {"id": "linear", "name": "Linear (I-Shape)", "description": "Simple rectangular building"},
            {"id": "l_shape", "name": "L-Shape", "description": "L-shaped with corner units"},
            {"id": "u_shape", "name": "U-Shape", "description": "Three wings around courtyard"},
            {"id": "h_shape", "name": "H-Shape", "description": "Two parallel wings with connector"},
            {"id": "courtyard", "name": "Courtyard", "description": "Square with central open space"},
        ],
        "corridorTypes": [
            {"id": "double", "name": "Double Loaded", "description": "Units on both sides, efficient"},
            {"id": "single", "name": "Single Loaded", "description": "Units on one side, better light"},
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
