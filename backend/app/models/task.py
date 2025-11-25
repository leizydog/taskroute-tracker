# backend/app/models/task.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Enum, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    QUEUED = "QUEUED"
    DECLINED = "DECLINED"

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
    # Using Text for destinations is safer if JSONB isn't fully set up in DB migration
    destinations = Column(Text) 
    
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
    
    # ✅ NEW: Store proofs for specific stops (JSON)
    # Structure: [{"sequence": 1, "location": "A", "photo_url": "...", "signature_url": "..."}]
    stop_proofs = Column(JSON, nullable=True)
    
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