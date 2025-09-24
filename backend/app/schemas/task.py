from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.task import TaskStatus, TaskPriority


# Base Task schema
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    location_name: Optional[str] = Field(None, max_length=200)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    estimated_duration: Optional[int] = Field(None, gt=0)  # minutes
    due_date: Optional[datetime] = None


# Schema for task creation
class TaskCreate(TaskBase):
    assigned_to: int  # User ID


# Schema for task update
class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    location_name: Optional[str] = Field(None, max_length=200)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    estimated_duration: Optional[int] = Field(None, gt=0)
    actual_duration: Optional[int] = Field(None, gt=0)
    due_date: Optional[datetime] = None
    completion_notes: Optional[str] = None
    quality_rating: Optional[int] = Field(None, ge=1, le=5)


# Schema for starting a task
class TaskStart(BaseModel):
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


# Schema for completing a task
class TaskComplete(BaseModel):
    completion_notes: Optional[str] = None
    quality_rating: Optional[int] = Field(None, ge=1, le=5)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


# Schema for task response (what we return to frontend)
class TaskResponse(TaskBase):
    id: int
    status: TaskStatus
    assigned_to: int
    created_by: int
    actual_duration: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    completion_notes: Optional[str] = None
    quality_rating: Optional[int] = None

    class Config:
        from_attributes = True


# Schema with user information included
class TaskWithUsers(TaskResponse):
    assigned_user_name: str
    created_user_name: str


# Schema for task statistics (for ML analysis)
class TaskStats(BaseModel):
    total_tasks: int
    completed_tasks: int
    completion_rate: float
    average_duration: Optional[float] = None
    average_quality_rating: Optional[float] = None
    tasks_by_status: dict
    tasks_by_priority: dict