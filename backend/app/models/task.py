from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey, Boolean, Float, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class TaskStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriority(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    
    # Assignment
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # ✅ NEW: Multi-destination support
    is_multi_destination = Column(Boolean, default=False)
    destinations = Column(JSON)  # Array of {location_name, latitude, longitude, sequence}
    
    # Location data (for single destination tasks - backward compatible)
    location_name = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)
    
    # Time tracking
    estimated_duration = Column(Integer)  # minutes
    actual_duration = Column(Integer)  # minutes
    due_date = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Notes and completion details
    completion_notes = Column(Text)
    quality_rating = Column(Integer)  # 1-5 scale for ML analysis
    
    # Relationships
    assigned_user = relationship("User", foreign_keys=[assigned_to], backref="assigned_tasks")
    created_user = relationship("User", foreign_keys=[created_by], backref="created_tasks")

    def __repr__(self):
        return f"<Task(id={self.id}, title='{self.title}', status='{self.status.value}')>"