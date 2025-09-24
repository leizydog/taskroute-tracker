from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class LocationLog(Base):
    __tablename__ = "location_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)  # Optional - can track location without task
    
    # GPS coordinates
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float)  # GPS accuracy in meters
    altitude = Column(Float)
    speed = Column(Float)  # Speed in m/s
    
    # Location context
    address = Column(String(500))  # Reverse geocoded address
    location_type = Column(String(50))  # 'task_start', 'task_progress', 'task_complete', 'manual', 'auto'
    notes = Column(Text)
    
    # Timestamps
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", backref="location_logs")
    task = relationship("Task", backref="location_logs")

    def __repr__(self):
        return f"<LocationLog(id={self.id}, user_id={self.user_id}, lat={self.latitude}, lng={self.longitude})>"


class GeofenceAlert(Base):
    __tablename__ = "geofence_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    
    # Alert details
    alert_type = Column(String(50))  # 'entered', 'exited', 'outside_radius'
    expected_latitude = Column(Float)
    expected_longitude = Column(Float)
    actual_latitude = Column(Float)
    actual_longitude = Column(Float)
    distance_from_expected = Column(Float)  # Distance in meters
    
    # Alert metadata
    is_resolved = Column(String(10), default='false')
    resolved_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", backref="geofence_alerts")
    task = relationship("Task", backref="geofence_alerts")

    def __repr__(self):
        return f"<GeofenceAlert(id={self.id}, type='{self.alert_type}', distance={self.distance_from_expected}m)>"