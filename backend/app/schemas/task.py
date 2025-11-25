# backend/app/schemas/task.py

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List, Any
from app.models.task import TaskStatus, TaskPriority
import json

# ✅ NEW: Schema for task destinations
class TaskDestination(BaseModel):
    sequence: int = Field(..., ge=1)
    location_name: str = Field(..., max_length=200)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    
    class Config:
        from_attributes = True

# ✅ NEW: Schema for per-stop proofs
class StopProof(BaseModel):
    sequence: int
    location_name: str
    photo_url: Optional[str] = None
    signature_url: Optional[str] = None

# Base Task schema
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    
    # ✅ NEW: Multi-destination fields
    is_multi_destination: bool = False
    destinations: Optional[List[TaskDestination]] = None
    
    # Single destination (backward compatible)
    location_name: Optional[str] = Field(None, max_length=200)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = None
    
    estimated_duration: Optional[int] = Field(None, gt=0)
    due_date: Optional[datetime] = None
    
    # ✅ FIX: This PRE-validator fixes the crash you saw.
    # It handles cases where DB returns a String instead of a List.
    @validator('destinations', pre=True)
    def parse_destinations_from_db(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except ValueError:
                return []
        return v

    @validator('destinations')
    def validate_destinations(cls, v, values):
        """Ensure destinations are provided if is_multi_destination is True"""
        if values.get('is_multi_destination') and (not v or len(v) < 2):
            raise ValueError('Multi-destination tasks must have at least 2 destinations')
        return v


# Schema for task creation
class TaskCreate(TaskBase):
    assigned_to: int


class TaskCancel(BaseModel):
    cancellation_reason: str = Field(..., min_length=1, description="Reason for cancelling the task")


# Schema for task update
class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    
    # Multi-destination fields
    is_multi_destination: Optional[bool] = None
    destinations: Optional[List[TaskDestination]] = None
    
    # Single destination
    location_name: Optional[str] = Field(None, max_length=200)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = None
    
    estimated_duration: Optional[int] = Field(None, gt=0)
    actual_duration: Optional[int] = Field(None, gt=0)
    due_date: Optional[datetime] = None
    completion_notes: Optional[str] = None
    quality_rating: Optional[int] = Field(None, ge=1, le=5)


# Schema for starting a task
class TaskStart(BaseModel):
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


# ✅ UPDATED: Complete Task Schema
class TaskComplete(BaseModel):
    completion_notes: Optional[str] = None
    # quality_rating is now OPTIONAL because backend calculates it
    quality_rating: Optional[int] = Field(None, ge=1, le=5) 
    
    signature_url: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    
    # ✅ NEW: Proofs for multi-stop tasks (The list of evidence per stop)
    stop_proofs: Optional[List[StopProof]] = None
    
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


# Schema for task response
class TaskResponse(TaskBase):
    id: int
    status: TaskStatus
    assigned_to: int
    created_by: int
    
    # Metrics
    actual_duration: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Completion Details
    completion_notes: Optional[str] = None
    quality_rating: Optional[int] = None
    signature_url: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    
    # ✅ NEW: Return the stop proofs to the frontend
    stop_proofs: Optional[List[StopProof]] = None

    class Config:
        from_attributes = True


# Schema with user information
class TaskWithUsers(TaskResponse):
    assigned_user_name: Optional[str] = None
    created_user_name: Optional[str] = None

    class Config:
        from_attributes = True


# Schema for task statistics
class TaskStats(BaseModel):
    total_tasks: int
    completed_tasks: int
    completion_rate: float
    average_duration: Optional[float] = None
    average_quality_rating: Optional[float] = None
    tasks_by_status: dict
    tasks_by_priority: dict


class UserWithOngoingTask(BaseModel):
    user_id: int
    user_name: str
    user_email: str
    user_role: str
    ongoing_task_count: int
    current_task: Optional[TaskWithUsers] = None
    current_location: Optional[Any] = None 
    
    class Config:
        from_attributes = True


class OngoingTasksByUser(BaseModel):
    total_users_with_tasks: int
    total_ongoing_tasks: int
    users: List[UserWithOngoingTask]
    
    class Config:
        from_attributes = True