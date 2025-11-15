from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.models import user, task
from app.routers import auth, tasks, locations, analytics, users
from app.websocket_manager import manager

# Create database tables
user.Base.metadata.create_all(bind=engine)
task.Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="TaskRoute Tracker API",
    description="GPS-enabled task management with ML predictions",
    version="1.0.0"
)

# Configure CORS - IMPORTANT: Add WebSocket origin support
# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",  # Docker container name
        "https://taskroute-frontend.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(locations.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")

# ✅ WebSocket endpoint - Define AFTER routers
@app.websocket("/ws/location")
async def websocket_endpoint(websocket: WebSocket):
    print(f"🔌 WebSocket connection attempt from {websocket.client}")
    
    try:
        await manager.connect(websocket)
        print(f"✅ WebSocket connected successfully")
        
        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()
                print(f"📨 Received from client: {data}")
                
                # Optional: Send acknowledgment
                await websocket.send_json({
                    "type": "ack",
                    "message": "Server received your message"
                })
            except WebSocketDisconnect:
                print("🔌 Client disconnected normally")
                break
            except Exception as e:
                print(f"❌ Error receiving data: {e}")
                break
                
    except Exception as e:
        print(f"❌ WebSocket connection error: {e}")
    finally:
        manager.disconnect(websocket)
        print(f"🔌 WebSocket cleanup complete")

@app.get("/")
def read_root():
    return {
        "message": "TaskRoute Tracker API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Add this to help debug
@app.on_event("startup")
async def startup_event():
    print("🚀 FastAPI server starting...")
    print("📍 WebSocket endpoint available at: ws://localhost:8000/ws/location")

@app.on_event("shutdown")
async def shutdown_event():
    print("👋 FastAPI server shutting down...")