# Debris-Scan AI

AI-powered drone search & rescue mission control system with real ML models and event-driven pipeline.

## Architecture

```
Google Colab (Backend + ML)          Browser (Frontend)
┌──────────────────────────┐         ┌──────────────────────┐
│ FastAPI + Uvicorn         │  ngrok  │ Next.js 14           │
│ 8-Stage Pipeline          │◄──────►│ React Three Fiber    │
│ Mock/Live Adapters        │   WS   │ Zustand State        │
│ Depth Anything V2         │        │ MapLibre Routes      │
│ Thermal YOLO              │        │ Tailwind Dark UI     │
│ UWB Signal Processing     │        └──────────────────────┘
│ A* Route Planning         │
└──────────────────────────┘
```

## Pipeline Stages

| # | Stage | Description | Technology |
|---|-------|-------------|------------|
| 1 | Aerial Scan | Stream RGB + LiDAR data | Mock adapter (recorded footage) |
| 2 | 3D Reconstruction | Build point cloud from frames | Depth Anything V2 (or mock) |
| 3 | Survivor Detection | Thermal + UWB radar sweep | YOLO thermal + FFT signal processing |
| 4 | Multi-Modal Fusion | Weighted confidence scoring | Explainable weighted formula |
| 5 | Precision Revisit | Close-range per candidate | Confidence-ranked revisit loop |
| 6 | Hazard Mapping | Terrain difficulty classification | Point cloud density/slope analysis |
| 7 | Route Planning | Safest + fastest paths | A* over hazard cost grid |
| 8 | Mission Report | Exportable summary | JSON aggregation |

## Quick Start

### Backend (Google Colab)
1. Open `backend/debris_scan_backend.ipynb` in Google Colab
2. Click "Run All"
3. Copy the ngrok URL displayed in the output

### Frontend (Local)
```bash
cd frontend
npm install
npm run dev
```
4. Open `http://localhost:3000`
5. Paste the ngrok URL in the backend connector
6. Click "Create Mission" → "Start Pipeline"

## Key Design Decisions

- **Adapter Pattern**: `MockScanAdapter` / `MockDetectionAdapter` stream synthetic data now. `LiveScanAdapter` is a one-line swap when real drone hardware is connected.
- **Event-Driven**: Every UI state change is triggered by a WebSocket `StageEvent` from the backend. No `setTimeout` sequencing.
- **Explainable Fusion**: Clicking any confidence point shows thermal, radar, structural, and hazard contributions individually.
- **Honest Labeling**: "Simulated Mission — Recorded Flight Data" badge on all mock-sourced views.

## Tech Stack

**Backend**: Python 3.10+, FastAPI, Uvicorn, NumPy, SciPy, Pydantic  
**ML Models**: Depth Anything V2, thermal YOLOv8, A* pathfinding  
**Frontend**: Next.js 14, TypeScript, Tailwind CSS, Zustand, React Three Fiber, Recharts  
**Infrastructure**: Google Colab (free GPU), ngrok tunnel

## License

MIT
