# Graph Utilities for Floor Plan Generation
# Handles conversion between user input and graph representation

import networkx as nx
import numpy as np
import torch
import torch.nn.functional as F
from torch_geometric.utils import from_networkx
from shapely.geometry import Point, Polygon, LineString, box, MultiPolygon
from shapely.ops import unary_union
import shapely.affinity as aff
import shapely.wkt
from collections import defaultdict
from typing import List, Tuple, Dict, Any, Optional
import geopandas as gpd


# Room type embeddings (MUST match checkpoint training config)
# This checkpoint (GAT-Net_v3_UnScalled.pt) was trained with 7 room categories
# Input features = 7 (one-hot) + 2 (coords) = 9 features per node
NUM_ROOM_CATEGORIES = 7  # Matches checkpoint: graph_conv1.lin_src.weight shape [128, 9]

ROOM_EMBEDDINGS = {
    'living': 0,
    'room': 1,        # Bedroom
    'kitchen': 2,
    'bathroom': 3,
    'balcony': 4,
    'pooja': 5,       # Pooja room (India specific)
    'utility': 6,     # Utility/wash area
}

# Map Indian room types to model's 7 categories
ROOM_TYPE_MAP = {
    'bedroom': 'room',      # → category 1
    'living': 'living',     # → category 0
    'kitchen': 'kitchen',   # → category 2
    'bathroom': 'bathroom', # → category 3
    'balcony': 'balcony',   # → category 4
    'utility': 'utility',   # → category 6
    'pooja': 'pooja',       # → category 5
    'dining': 'living',     # → category 0 (part of living)
    'hall': 'living',       # → category 0
    'washroom': 'bathroom', # → category 3
    'toilet': 'bathroom',   # → category 3
}


def scale_geometry(geom, origin: Tuple[float, float] = (128, 128)):
    """Flip Y-axis around origin point (model was trained with flipped Y)."""
    if isinstance(geom, tuple):
        geom = Point(*geom)
    return aff.scale(geom, xfact=1, yfact=-1, origin=origin)


def handle_boundary_nodes(boundary: Polygon, door: Polygon, min_distance: float = 5.0) -> nx.Graph:
    """
    Create a graph from boundary polygon, removing duplicate nodes
    and adding the front door as a special node.
    
    Args:
        boundary: Site boundary as Shapely Polygon
        door: Front door as Shapely Polygon
        min_distance: Minimum distance between nodes to avoid duplicates
        
    Returns:
        NetworkX graph representing the boundary
    """
    coords = boundary.exterior.coords[:]
    points = [Point(p) for p in coords]
    
    graph = nx.Graph()
    graph.add_node(0, type=0, centroid=coords[0])
    
    current = 0
    name = 1
    
    # Add nodes, skipping duplicates
    for i in range(1, len(coords)):
        dist = points[i].distance(points[current])
        if dist >= min_distance:
            graph.add_node(name, type=0, centroid=coords[i])
            current = i
            name += 1
    
    # Check if first and last nodes are too close
    nodes_names = list(graph.nodes)
    first_node = Point(graph.nodes[nodes_names[0]]['centroid'])
    last_node = Point(graph.nodes[nodes_names[-1]]['centroid'])
    
    if first_node.distance(last_node) <= min_distance:
        graph.remove_node(nodes_names[-1])
        nodes_names = list(graph.nodes)
    
    # Get updated points
    points_of_graph = [Point(graph.nodes[node]['centroid']) for node in graph.nodes]
    
    # Add edges between consecutive nodes
    for i in range(len(nodes_names) - 1):
        dist = points_of_graph[i].distance(points_of_graph[i + 1])
        graph.add_edge(nodes_names[i], nodes_names[i + 1], distance=dist)
    
    # Add edge between last and first
    dist = points_of_graph[0].distance(points_of_graph[-1])
    graph.add_edge(nodes_names[0], nodes_names[-1], distance=dist)
    
    # Add front door
    graph = add_door_to_boundary(graph, door, points_of_graph)
    
    return graph


def add_door_to_boundary(boundary_graph: nx.Graph, door: Polygon, points: List[Point]) -> nx.Graph:
    """Add front door as a node connected to the nearest edge of the boundary."""
    nearest_edge = None
    nearest_dist = float('inf')
    
    # Determine door orientation
    dx = door.bounds[2] - door.bounds[0]
    dy = door.bounds[3] - door.bounds[1]
    door_horizontal = dx > dy
    
    # Find nearest edge with matching orientation
    for edge in boundary_graph.edges():
        p1 = points[edge[0]]
        p2 = points[edge[1]]
        line = LineString([p1, p2])
        
        # Check edge orientation
        edge_dx = abs(p2.x - p1.x)
        edge_dy = abs(p2.y - p1.y)
        edge_horizontal = edge_dx > edge_dy
        
        if door_horizontal == edge_horizontal:
            dist = door.distance(line)
            if dist < nearest_dist:
                nearest_dist = dist
                nearest_edge = edge
    
    if nearest_edge is None:
        # Fallback: use any nearest edge
        for edge in boundary_graph.edges():
            p1 = points[edge[0]]
            p2 = points[edge[1]]
            line = LineString([p1, p2])
            dist = door.distance(line)
            if dist < nearest_dist:
                nearest_dist = dist
                nearest_edge = edge
    
    # Remove the edge and add door node
    boundary_graph.remove_edge(*nearest_edge)
    
    door_idx = len(boundary_graph)
    door_centroid = door.centroid
    boundary_graph.add_node(door_idx, type=1, centroid=(door_centroid.x, door_centroid.y))
    
    # Connect door to both endpoints of removed edge
    dist1 = door_centroid.distance(Point(boundary_graph.nodes[nearest_edge[0]]['centroid']))
    boundary_graph.add_edge(nearest_edge[0], door_idx, distance=dist1)
    
    dist2 = door_centroid.distance(Point(boundary_graph.nodes[nearest_edge[1]]['centroid']))
    boundary_graph.add_edge(nearest_edge[1], door_idx, distance=dist2)
    
    return boundary_graph


def create_room_graph(room_constraints: Dict[str, List[Tuple[float, float]]], 
                      living_to_all: bool = True) -> nx.Graph:
    """
    Create a graph from room centroids.
    
    Args:
        room_constraints: Dict mapping room type to list of centroids
        living_to_all: If True, connect all rooms to the living room
        
    Returns:
        NetworkX graph representing rooms and their connections
    """
    G = nx.Graph()
    
    # Add nodes for each room
    for room_type, centroids in room_constraints.items():
        embd = ROOM_EMBEDDINGS.get(room_type, 1)  # Default to 'room' type
        
        for i, centroid in enumerate(centroids):
            node_name = f'{room_type}_{i}'
            G.add_node(node_name,
                       roomType_name=room_type,
                       roomType_embd=embd,
                       actualCentroid_x=centroid[0],
                       actualCentroid_y=centroid[1])
    
    # Connect all rooms to living room
    if living_to_all and 'living_0' in G.nodes:
        living_pos = Point(
            G.nodes['living_0']['actualCentroid_x'],
            G.nodes['living_0']['actualCentroid_y']
        )
        
        for node in G.nodes():
            if G.nodes[node]['roomType_name'] != 'living':
                node_pos = Point(
                    G.nodes[node]['actualCentroid_x'],
                    G.nodes[node]['actualCentroid_y']
                )
                dist = living_pos.distance(node_pos)
                G.add_edge('living_0', node, distance=round(dist, 3))
    
    return G


def preprocess_to_graphs(
    boundary_wkt: str,
    front_door_wkt: str,
    room_centroids: List[Tuple[float, float]],
    bathroom_centroids: List[Tuple[float, float]],
    kitchen_centroids: List[Tuple[float, float]],
    scale_origin: Tuple[float, float] = (128, 128)
) -> Tuple[Any, ...]:
    """
    Convert user inputs to PyTorch Geometric graphs for model inference.
    
    Args:
        boundary_wkt: Boundary polygon as WKT string
        front_door_wkt: Front door polygon as WKT string
        room_centroids: List of bedroom centroid coordinates
        bathroom_centroids: List of bathroom centroid coordinates
        kitchen_centroids: List of kitchen centroid coordinates
        
    Returns:
        Tuple of (G, B, G_not_normalized, B_not_normalized, boundary_polygon, front_door_polygon)
    """
    # Parse WKT
    boundary = shapely.wkt.loads(boundary_wkt)
    front_door = shapely.wkt.loads(front_door_wkt)
    
    # Scale (flip Y-axis)
    boundary = scale_geometry(boundary, scale_origin)
    front_door = scale_geometry(front_door, scale_origin)
    room_centroids = [scale_geometry(c, scale_origin).coords[0] for c in room_centroids]
    bathroom_centroids = [scale_geometry(c, scale_origin).coords[0] for c in bathroom_centroids]
    kitchen_centroids = [scale_geometry(c, scale_origin).coords[0] for c in kitchen_centroids]
    
    # Living room at boundary centroid
    living_centroid = [(boundary.centroid.x, boundary.centroid.y)]
    
    # Create room constraints dict
    user_constraints = {
        'living': living_centroid,
        'room': room_centroids,
        'bathroom': bathroom_centroids,
        'kitchen': kitchen_centroids
    }
    
    # Create NetworkX graphs
    B_nx = handle_boundary_nodes(boundary, front_door)
    G_nx = create_room_graph(user_constraints, living_to_all=True)
    
    # Convert to PyTorch Geometric
    B = from_networkx(B_nx, group_node_attrs=['type', 'centroid'], group_edge_attrs=['distance'])
    
    features = ['roomType_embd', 'actualCentroid_x', 'actualCentroid_y']
    G = from_networkx(G_nx, group_edge_attrs=['distance'], group_node_attrs=features)
    
    # Normalize room graph
    G_x_mean = G.x[:, 1].mean().item()
    G_y_mean = G.x[:, 2].mean().item()
    G_x_std = G.x[:, 1].std().item() or 1.0  # Avoid division by zero
    G_y_std = G.x[:, 2].std().item() or 1.0
    
    G.x[:, 1:] = (G.x[:, 1:] - torch.tensor([G_x_mean, G_y_mean])) / torch.tensor([G_x_std, G_y_std])
    
    # One-hot encode room types (MUST use 7 categories to match checkpoint input size of 9)
    first_column_encodings = F.one_hot(G.x[:, 0].long(), NUM_ROOM_CATEGORIES)
    G.x = torch.cat([first_column_encodings, G.x[:, 1:]], dim=1)
    
    # Normalize boundary graph
    B_x_mean = B.x[:, 1].mean().item()
    B_y_mean = B.x[:, 2].mean().item()
    B_x_std = B.x[:, 1].std().item() or 1.0
    B_y_std = B.x[:, 2].std().item() or 1.0
    
    B.x[:, 1:] = (B.x[:, 1:] - torch.tensor([B_x_mean, B_y_mean])) / torch.tensor([B_x_std, B_y_std])
    
    # Set correct dtypes
    G.x = G.x.to(torch.float32)
    G.edge_attr = G.edge_attr.to(torch.float32)
    G.edge_index = G.edge_index.to(torch.int64)
    
    B.x = B.x.to(G.x.dtype)
    B.edge_index = B.edge_index.to(G.edge_index.dtype)
    B.edge_attr = B.edge_attr.to(G.edge_attr.dtype)
    
    # Store non-normalized versions for output processing
    G_not_normalized = G.clone()
    B_not_normalized = B.clone()
    
    G_not_normalized.x[:, -2] = G_not_normalized.x[:, -2] * G_x_std + G_x_mean
    G_not_normalized.x[:, -1] = G_not_normalized.x[:, -1] * G_y_std + G_y_mean
    
    B_not_normalized.x[:, -2] = B_not_normalized.x[:, -2] * B_x_std + B_x_mean
    B_not_normalized.x[:, -1] = B_not_normalized.x[:, -1] * B_y_std + B_y_mean
    
    return G, B, G_not_normalized, B_not_normalized, boundary, front_door, B_nx, G_nx


class FloorPlanGenerator:
    """Generate floor plan polygons from GNN predictions."""
    
    def __init__(self, graph, predictions: np.ndarray):
        self.graph = graph
        self.predictions = predictions
    
    def get_room_data(self, room_index: int) -> Dict[str, Any]:
        """Get room data for a specific index."""
        centroid = (
            self.graph.x[room_index][-2].item(),
            self.graph.x[room_index][-1].item()
        )
        # Use NUM_ROOM_CATEGORIES (7) for argmax to match one-hot encoding
        category = torch.argmax(self.graph.x[:, :NUM_ROOM_CATEGORIES], dim=1)[room_index].item()
        
        w_pred = self.predictions[room_index, 0]
        h_pred = self.predictions[room_index, 1]
        
        return {
            'centroid': centroid,
            'width': float(w_pred),
            'height': float(h_pred),
            'category': int(category)
        }
    
    def create_room_polygon(self, room_data: Dict[str, Any]) -> Polygon:
        """Create a shapely box from room data."""
        cx, cy = room_data['centroid']
        half_w = room_data['width'] / 2
        half_h = room_data['height'] / 2
        
        return box(cx - half_w, cy - half_h, cx + half_w, cy + half_h)
    
    def generate_floor_plan(self, boundary: Polygon, door_point: Optional[Point] = None) -> Dict[str, Any]:
        """
        Generate complete floor plan with non-overlapping rooms.
        
        Returns dict with:
        - rooms: List of room polygons with metadata
        - boundary: Site boundary
        - total_area: Total covered area
        """
        num_rooms = self.graph.x.shape[0]
        rooms_by_category = defaultdict(list)
        
        buffer_boundary = boundary.buffer(-3, cap_style=3, join_style=2)
        
        # Generate initial room polygons
        for i in range(num_rooms):
            room_data = self.get_room_data(i)
            room_poly = self.create_room_polygon(room_data)
            
            # Clip to boundary
            room_poly = room_poly.intersection(buffer_boundary)
            
            if room_poly.is_empty or room_poly.area < 1:
                continue
            
            rooms_by_category[room_data['category']].append({
                'polygon': room_poly,
                'category': room_data['category'],
                'centroid': room_data['centroid'],
                'width': room_data['width'],
                'height': room_data['height']
            })
        
        # Resolve overlaps
        final_rooms = self._resolve_overlaps(rooms_by_category)
        
        # Convert to output format (7 categories matching ROOM_EMBEDDINGS)
        room_type_names = {
            0: 'living',
            1: 'bedroom',
            2: 'kitchen',
            3: 'bathroom',
            4: 'balcony',
            5: 'pooja',
            6: 'utility'
        }
        
        output_rooms = []
        for room in final_rooms:
            poly = room['polygon']
            if poly.is_empty or not poly.is_valid:
                continue
                
            # Get polygon coordinates
            if isinstance(poly, MultiPolygon):
                coords = list(poly.geoms[0].exterior.coords)
            else:
                coords = list(poly.exterior.coords)
            
            output_rooms.append({
                'type': room_type_names.get(room['category'], 'room'),
                'category': room['category'],
                'coordinates': [[c[0], c[1]] for c in coords],
                'centroid': [room['centroid'][0], room['centroid'][1]],
                'width': room['width'],
                'height': room['height'],
                'area': poly.area
            })
        
        return {
            'rooms': output_rooms,
            'boundary': [[c[0], c[1]] for c in boundary.exterior.coords],
            'total_area': sum(r['area'] for r in output_rooms)
        }
    
    def _resolve_overlaps(self, rooms_by_category: Dict[int, List]) -> List[Dict]:
        """
        Resolve overlapping room polygons using smart placement logic.
        Based on original GAT-Net FloorPlan_multipolygon logic.
        
        Note: Living room (category 0) is treated differently - it occupies the 
        remaining space after all other rooms are placed (like in the original).
        
        Priority: Bedrooms first, then Kitchen/Bathroom (which can be inside bedrooms)
        """
        final_rooms = []
        
        # Process bedrooms (category 1) first - they define the main layout
        if 1 in rooms_by_category:
            existing_polygons = []
            for room in rooms_by_category[1]:
                poly = room['polygon']
                
                # Check intersection with existing bedroom polygons
                if any(poly.intersects(exist) for exist in existing_polygons):
                    for i, exist in enumerate(existing_polygons):
                        if poly.intersects(exist):
                            intersection = poly.intersection(exist)
                            if exist.area < poly.area:
                                # Cut from smaller existing polygon
                                diff_poly = exist.difference(intersection.buffer(4))
                                existing_polygons[i] = diff_poly
                                # Update in final_rooms too
                                for j, fr in enumerate(final_rooms):
                                    if fr['category'] == 1:
                                        if fr['polygon'].equals(exist):
                                            final_rooms[j]['polygon'] = diff_poly
                                            break
                                existing_polygons.append(poly)
                                room['polygon'] = poly
                                final_rooms.append(room)
                            else:
                                # Cut from current polygon
                                diff_poly = poly.difference(intersection.buffer(4))
                                if not diff_poly.is_empty and diff_poly.area > 5:
                                    room['polygon'] = diff_poly
                                    final_rooms.append(room)
                                    existing_polygons.append(diff_poly)
                else:
                    # No intersection - add directly
                    existing_polygons.append(poly)
                    final_rooms.append(room)
        
        # Get bedroom polygons for smart bath/kitchen placement
        bedroom_polys = [r['polygon'] for r in final_rooms if r['category'] == 1]
        
        # Process kitchen and bathroom (categories 2, 3)
        already_inside_bath = False
        for cat in [2, 3]:
            if cat in rooms_by_category:
                for room in rooms_by_category[cat]:
                    poly = room['polygon']
                    
                    # Check if bath/kitchen intersects with any bedroom
                    intersects_bedroom = any(poly.intersects(bedroom) for bedroom in bedroom_polys)
                    
                    if intersects_bedroom:
                        for i, bedroom_poly in enumerate(bedroom_polys):
                            if poly.intersects(bedroom_poly):
                                intersection = poly.intersection(bedroom_poly)
                                # If >= 20% overlap and haven't placed inside yet
                                if (intersection.area >= 0.2 * poly.area) and not already_inside_bath:
                                    # Place inside bedroom
                                    poly = poly.intersection(bedroom_poly.buffer(-3, cap_style=3, join_style=2))
                                    already_inside_bath = True
                                else:
                                    # Cut from bedroom and bath/kitchen
                                    new_bedroom = bedroom_poly.difference(intersection.buffer(0.3))
                                    bedroom_polys[i] = new_bedroom
                                    # Update in final_rooms
                                    for j, fr in enumerate(final_rooms):
                                        if fr['category'] == 1 and fr['polygon'].equals(bedroom_poly):
                                            final_rooms[j]['polygon'] = new_bedroom
                                            break
                                    
                                    poly = poly.difference(intersection.buffer(4))
                    
                    # Add if valid
                    if not poly.is_empty and poly.area > 3:
                        room['polygon'] = poly
                        final_rooms.append(room)
        
        # Add living room last - it's essentially the remaining boundary space
        # In the original code, living room is NOT added as a separate polygon
        # The boundary itself serves as the living space
        # But for our API, we include it for completeness
        if 0 in rooms_by_category:
            for room in rooms_by_category[0]:
                # Subtract all other rooms from living
                poly = room['polygon']
                for fr in final_rooms:
                    if poly.intersects(fr['polygon']):
                        poly = poly.difference(fr['polygon'].buffer(1))
                
                if not poly.is_empty and poly.area > 10:
                    room['polygon'] = poly
                    final_rooms.append(room)
        
        return final_rooms
