# Floor Plan Generation Backend

Python FastAPI backend that serves the GAT-Net (Graph Attention Network) model for AI-powered floor plan generation.

## Overview

This backend integrates with the React frontend to provide AI-generated floor plans. It uses a pre-trained Graph Neural Network to predict optimal room dimensions and positions based on:
- Site boundary shape
- Front door location
- Room requirements (BHK configuration)

## Architecture

```
backend/
├── main.py              # FastAPI application & endpoints
├── gat_model.py         # GATNet model architecture
├── graph_utils.py       # Graph creation & floor plan generation
├── requirements.txt     # Python dependencies
└── start.ps1           # Windows startup script
```

## Quick Start

### Prerequisites
- Python 3.8 or higher
- CUDA (optional, for GPU acceleration)

### Installation

1. **Navigate to backend directory:**
   ```powershell
   cd backend
   ```

2. **Create virtual environment (recommended):**
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

3. **Install dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```
   
   **Note:** PyTorch Geometric requires special installation. If you encounter issues:
   ```powershell
   # Install PyTorch first
   pip install torch
   
   # Then install PyTorch Geometric
   pip install torch-geometric
   pip install torch-scatter torch-sparse -f https://data.pyg.org/whl/torch-2.0.0+cpu.html
   ```

4. **Start the server:**
   ```powershell
   .\start.ps1
   # Or manually:
   python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

5. **Verify it's running:**
   - API: http://localhost:8000/health
   - Docs: http://localhost:8000/docs

## API Endpoints

### Health Check
```
GET /health
```
Returns API status and whether the model is loaded.

### Generate Floor Plan
```
POST /api/generate-floor-plan
```
Generate a floor plan from detailed room specifications.

**Request Body:**
```json
{
  "boundary_wkt": "POLYGON((0 0, 100 0, 100 80, 0 80, 0 0))",
  "front_door_wkt": "POLYGON((48 0, 52 0, 52 2, 48 2, 48 0))",
  "rooms": [
    {"type": "bedroom", "centroid": {"x": 25, "y": 60}},
    {"type": "bedroom", "centroid": {"x": 75, "y": 60}},
    {"type": "bathroom", "centroid": {"x": 85, "y": 30}},
    {"type": "kitchen", "centroid": {"x": 15, "y": 30}}
  ],
  "bhk_config": "2BHK"
}
```

**Response:**
```json
{
  "success": true,
  "rooms": [
    {
      "type": "living",
      "category": 0,
      "coordinates": [[40, 30], [60, 30], [60, 50], [40, 50], [40, 30]],
      "centroid": [50, 40],
      "width": 20,
      "height": 20,
      "area": 400
    }
    // ... more rooms
  ],
  "boundary": [[0, 0], [100, 0], [100, 80], [0, 80], [0, 0]],
  "total_area": 1200,
  "message": "Generated floor plan with 5 rooms"
}
```

### Generate from BHK (Simplified)
```
POST /api/generate-from-bhk?boundary_wkt=...&front_door_wkt=...&bhk=2BHK
```
Simplified endpoint that auto-places room centroids based on the boundary shape.

### Get Room Types
```
GET /api/room-types
```
Returns available room types and BHK options.

## Model Details

The GAT-Net model uses:
- **Graph Attention Layers**: 4 layers with residual connections
- **Input Features**: Room type (one-hot, 7 classes) + normalized centroids
- **Output**: Predicted width and height for each room
- **Training Data**: RPLAN dataset with Indian residential layouts

## Coordinate System

The model uses a normalized coordinate system:
- Origin: (128, 128) as center
- Y-axis is flipped (architectural convention)
- Coordinates are scaled to fit model's training distribution

## Integration with React Frontend

The frontend communicates with this backend via REST API. Key integration points:

1. **API Service** (`src/services/floorPlanApi.ts`): API client functions
2. **Hook** (`src/hooks/useFloorPlanGenerator.ts`): React hook for generation
3. **Component** (`src/components/AIGenerationPanel.tsx`): UI panel

## Environment Variables

Create a `.env` file for configuration:
```
MODEL_CHECKPOINT_PATH=../Layout gnn/Floor_Plan_Generation_using_GNNs-with-boundary/GAT-Net_model/checkpoints/GAT-Net_v3_UnScalled.pt
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Troubleshooting

### Model not loading
- Check that the checkpoint file exists at the expected path
- Verify PyTorch is installed correctly
- Check server logs for detailed error messages

### CUDA errors
- If you don't have a GPU, the model will automatically use CPU
- For GPU: ensure CUDA toolkit is installed and compatible with PyTorch

### Import errors
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- For torch-geometric issues, follow the special installation instructions above

## Development

To run in development mode with auto-reload:
```powershell
python -m uvicorn main:app --reload --port 8000
```

## License

Part of the Trace Air Company Layout Planner project.
