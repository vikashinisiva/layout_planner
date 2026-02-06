# GAT-Net Model Definition for Floor Plan Generation
# Adapted from: mo7amed7assan1911/Floor_Plan_Generation_using_GNNs

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GATConv


class GATNet(torch.nn.Module):
    """
    Graph Attention Network for Floor Plan Room Size Estimation.
    
    Takes two graphs as input:
    1. Room graph: nodes represent rooms with features (type, centroid_x, centroid_y)
    2. Boundary graph: nodes represent boundary vertices with front door marker
    
    Outputs predicted width and height for each room.
    
    Note: The checkpoint was trained with an older GATConv format (separate lin_src/lin_dst).
    We handle the key mapping in load_model() via convert_state_dict_keys().
    """
    
    def __init__(self, num_graph_node_features: int, num_boundary_node_features: int):
        super(GATNet, self).__init__()
        
        # Graph convolution layers with residual connections
        self.graph_conv1 = GATConv(num_graph_node_features, 32, heads=4)
        
        input_of_conv2 = num_graph_node_features + 32 * 4
        self.graph_conv2 = GATConv(input_of_conv2, 32, heads=8)
        
        input_of_conv3 = num_graph_node_features + 32 * 8
        self.graph_conv3 = GATConv(input_of_conv3, 64, heads=8)
        
        input_of_conv4 = num_graph_node_features + 64 * 8
        self.graph_conv4 = GATConv(input_of_conv4, 128, heads=8)

        shape_of_graphs_before_concat = num_graph_node_features + 128 * 8
        
        # Boundary convolution layers
        self.boundary_conv1 = GATConv(num_boundary_node_features, 32, heads=4)
        input_of_boundary_conv2 = 32 * 4 + num_boundary_node_features
        self.boundary_conv2 = GATConv(input_of_boundary_conv2, 32, heads=8)

        shape_of_boundary_before_concat = num_boundary_node_features + 32 * 8
        
        # Concatenation layer
        inputs_concat = shape_of_graphs_before_concat + shape_of_boundary_before_concat
        self.Concatination1 = GATConv(inputs_concat, 128, heads=8)

        # Output layers for width and height prediction
        self.width_layer1 = nn.Linear(128 * 8, 128)
        self.height_layer1 = nn.Linear(128 * 8, 128)
        
        self.width_output = nn.Linear(128, 1)
        self.height_output = nn.Linear(128, 1)
        
        self.dropout = torch.nn.Dropout(0.2)
        
    def forward(self, graph, boundary):
        x_graph = graph.x.to(torch.float32)
        g_edge_index = graph.edge_index
        g_edge_attr = graph.edge_attr
        g_batch = graph.batch
        
        x_boundary = boundary.x.to(torch.float32)
        b_edge_index = boundary.edge_index
        b_edge_attr = boundary.edge_attr
        b_batch = boundary.batch
        
        NUM_OF_NODES = x_graph.shape[0]
        
        # Handle single graph inference (no batching)
        if g_batch is None:
            g_batch = torch.zeros(x_graph.shape[0], dtype=torch.long, device=x_graph.device)
        if b_batch is None:
            b_batch = torch.zeros(x_boundary.shape[0], dtype=torch.long, device=x_boundary.device)
        
        # Store residuals
        x_graph_res = x_graph
        x_boundary_res = x_boundary
        
        # Graph convolutions with residual connections
        x_graph = F.leaky_relu(self.graph_conv1(x_graph, g_edge_index, g_edge_attr))
        x_graph = self.dropout(x_graph)
        x_graph = torch.cat([x_graph, x_graph_res], dim=1)
        
        x_graph = F.leaky_relu(self.graph_conv2(x_graph, g_edge_index, g_edge_attr))
        x_graph = self.dropout(x_graph)
        x_graph = torch.cat([x_graph, x_graph_res], dim=1)
        
        x_graph = F.leaky_relu(self.graph_conv3(x_graph, g_edge_index))
        x_graph = self.dropout(x_graph)
        x_graph = torch.cat([x_graph, x_graph_res], dim=1)
        
        x_graph = F.leaky_relu(self.graph_conv4(x_graph, g_edge_index))
        x_graph = self.dropout(x_graph)
        x_graph = torch.cat([x_graph, x_graph_res], dim=1)
        
        # Boundary convolutions with residual connections
        x_boundary = F.leaky_relu(self.boundary_conv1(x_boundary, b_edge_index, b_edge_attr))
        x_boundary = self.dropout(x_boundary)
        x_boundary = torch.cat([x_boundary, x_boundary_res], dim=1)
        
        x_boundary = F.leaky_relu(self.boundary_conv2(x_boundary, b_edge_index, b_edge_attr))
        x_boundary = self.dropout(x_boundary)
        x_boundary = torch.cat([x_boundary, x_boundary_res], dim=1)

        # Pool boundary to 1D vector
        x_boundary_pooled = F.max_pool1d(
            x_boundary.transpose(0, 1), 
            kernel_size=x_boundary.shape[0]
        ).view(1, -1)
        
        # Concatenate graph and boundary features
        x = torch.cat([x_graph, x_boundary_pooled.repeat(NUM_OF_NODES, 1)], dim=1)
        x = F.leaky_relu(self.Concatination1(x, g_edge_index))
        x = self.dropout(x)
        
        # Predict width and height
        width = F.leaky_relu(self.width_layer1(x))
        width = self.dropout(width)
        width = self.width_output(width)
        
        height = F.leaky_relu(self.height_layer1(x))
        height = self.dropout(height)
        height = self.height_output(height)
        
        return width.squeeze(), height.squeeze()


def convert_state_dict_keys(state_dict: dict) -> dict:
    """
    Convert state dict keys from old GATConv format (lin_src/lin_dst) 
    to new format (lin).
    
    The checkpoint was created with an older version of PyTorch Geometric
    that used separate lin_src and lin_dst weights. Newer versions use
    a single lin weight. We average the source/destination weights.
    """
    new_state_dict = {}
    
    # Track which keys need conversion
    converted = set()
    
    for key, value in state_dict.items():
        if '.lin_src.weight' in key:
            # Find the corresponding lin_dst weight
            dst_key = key.replace('.lin_src.weight', '.lin_dst.weight')
            new_key = key.replace('.lin_src.weight', '.lin.weight')
            
            if dst_key in state_dict:
                # Average the source and destination weights
                # This is a reasonable approximation for inference
                dst_value = state_dict[dst_key]
                new_state_dict[new_key] = (value + dst_value) / 2
                converted.add(key)
                converted.add(dst_key)
            else:
                # Just use source weight if dst not found
                new_state_dict[new_key] = value
                converted.add(key)
        elif '.lin_dst.weight' in key:
            # Already handled with lin_src
            if key not in converted:
                new_key = key.replace('.lin_dst.weight', '.lin.weight')
                new_state_dict[new_key] = value
        else:
            # Keep other keys as-is
            new_state_dict[key] = value
    
    return new_state_dict


def load_model(model_path: str, device: torch.device) -> GATNet:
    """Load a pre-trained GAT-Net model from checkpoint."""
    checkpoint = torch.load(model_path, map_location=device, weights_only=False)
    
    # Feature sizes from checkpoint inspection:
    # graph_conv1.lin_src.weight shape = [128, 9] → 9 input features
    # This means: 7 room categories (one-hot) + 2 (centroid x, y) = 9
    num_graph_node_features = 9
    num_boundary_node_features = 3  # type + centroid x, y
    
    model = GATNet(num_graph_node_features, num_boundary_node_features)
    
    # Convert old checkpoint format to new format
    state_dict = checkpoint['model_state_dict']
    if 'graph_conv1.lin_src.weight' in state_dict:
        state_dict = convert_state_dict_keys(state_dict)
    
    model.load_state_dict(state_dict)
    model = model.to(device)
    model.eval()
    
    return model
