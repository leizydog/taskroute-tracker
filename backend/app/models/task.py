from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

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
    destinations = Column(Text) # JSON string or specialized JSON type depending on DB
    
    # Location data
    location_name = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)
    address = Column(String, nullable=True) # Added for address string
    
    # Time tracking & Forecasts
    estimated_duration = Column(Integer)  # AI Predicted duration (minutes)
    actual_duration = Column(Integer)     # Real duration (minutes)
    due_date = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Completion Details
    completion_notes = Column(Text)
    quality_rating = Column(Integer) # 1-5
    # ✅ NEW: Signature Image Path
    signature_url = Column(String(500), nullable=True)
    
    # Relationships
    assigned_user = relationship("User", foreign_keys=[assigned_to], backref="assigned_tasks")
    created_user = relationship("User", foreign_keys=[created_by], backref="created_tasks")

    def __repr__(self):
        return f"<Task(id={self.id}, title='{self.title}', status='{self.status.value}')>"