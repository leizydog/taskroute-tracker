from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.location import LocationLog
from app.models.task import Task
from app.models.user import User
from app.schemas.location import LocationLogCreate, LocationLogResponse
from app.core.auth import get_current_active_user
from app.websocket_manager import manager

router = APIRouter(
    prefix="/locations",
    tags=["Locations"]
)

@router.post("/", response_model=LocationLogResponse, status_code=status.HTTP_201_CREATED)
async def create_location_log(
    location_data: LocationLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).filter(Task.id == location_data.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to log location for this task")

    db_location_log = LocationLog(**location_data.model_dump(), user_id=current_user.id)
    db.add(db_location_log)
    db.commit()
    db.refresh(db_location_log)

    await manager.broadcast_json({
        "event": "location_update",
        "task_id": location_data.task_id,
        "latitude": location_data.latitude,
        "longitude": location_data.longitude,
        "user_id": current_user.id,
        "user_name": current_user.full_name,
    })

    return db_location_log

@router.get("/{task_id}", response_model=List[LocationLogResponse])
def get_location_logs_for_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    logs = db.query(LocationLog).filter(LocationLog.task_id == task_id).order_by(LocationLog.timestamp.asc()).all()
    return logs

@router.get("/{task_id}/latest", response_model=Optional[LocationLogResponse])
def get_latest_location_for_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    latest_log = db.query(LocationLog).filter(LocationLog.task_id == task_id).order_by(LocationLog.timestamp.desc()).first()
    
    return latest_log