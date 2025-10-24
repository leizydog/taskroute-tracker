from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.models import user, task
from app.routers import auth, tasks, locations, analytics, users
from .websocket_manager import manager

# Create database tables
user.Base.metadata.create_all(bind=engine)
task.Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="TaskRoute Tracker API",
    description="GPS-enabled task management with ML predictions",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Include routers with /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")          # /api/v1/auth/*
app.include_router(tasks.router, prefix="/api/v1")         # /api/v1/tasks/*
app.include_router(users.router, prefix="/api/v1")         # /api/v1/users/*
app.include_router(locations.router, prefix="/api/v1")     # /api/v1/locations/*
app.include_router(analytics.router, prefix="/api/v1")     # /api/v1/analytics/*

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

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