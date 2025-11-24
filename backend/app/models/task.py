# ============================================================================
# OPTION 1: Updated models/task.py with JSONB for destinations
# ============================================================================

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Enum, Text, JSON
from sqlalchemy.dialects.postgresql import JSONB  # ✅ Add this import
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TaskStatus(str, enum.Enum):
    # ✅ FIX: Change all values to UPPERCASE to match database
    PENDING = "PENDING"           # Was: "pending"
    IN_PROGRESS = "IN_PROGRESS"   # Was: "in_progress"
    COMPLETED = "COMPLETED"       # Was: "completed"
    CANCELLED = "CANCELLED"       # Was: "cancelled"
    QUEUED = "QUEUED"             # Was: "queued" - CHANGE THIS!
    DECLINED = "DECLINED"         # Was: "declined" - CHANGE THIS!

class TaskPriority(str, enum.Enum):
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
    
    # Multi-destination support
    is_multi_destination = Column(Boolean, default=False)
    destinations = Column(JSONB, nullable=True, default=[])  # ✅ CHANGED: Text -> JSONB
    
    # Location data
    location_name = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)
    address = Column(String, nullable=True)
    
    # Time tracking
    estimated_duration = Column(Integer)
    actual_duration = Column(Integer)
    due_date = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Completion Details
    completion_notes = Column(Text)
    quality_rating = Column(Integer) 
    signature_url = Column(String(500), nullable=True)
    photo_urls = Column(JSON, nullable=True)
    
    # Relationships
    assigned_user = relationship("User", foreign_keys=[assigned_to], backref="assigned_tasks")
    created_user = relationship("User", foreign_keys=[created_by], backref="created_tasks")

    # ML Fields
    city = Column(String(100), nullable=True)
    transport_method = Column(String(50), default="Drive")
    weather_conditions = Column(String(50), nullable=True)
    actual_start_lat = Column(Float, nullable=True) 
    actual_start_lng = Column(Float, nullable=True)

    def __repr__(self):
        return f"<Task(id={self.id}, title='{self.title}', status='{self.status.value}')>"