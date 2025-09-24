from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


# Base location schema
class LocationBase(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(None, ge=0)
    altitude: Optional[float] = None
    speed: Optional[float] = Field(None, ge=0)
    address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None


# Schema for creating location logs
class LocationLogCreate(LocationBase):
    task_id: Optional[int] = None
    location_type: str = Field("manual", max_length=50)
    recorded_at: Optional[datetime] = None


# Schema for location log response
class LocationLogResponse(LocationBase):
    id: int
    user_id: int
    task_id: Optional[int] = None
    location_type: str
    recorded_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# Schema for bulk location tracking (when user is actively working)
class BulkLocationUpdate(BaseModel):
    task_id: Optional[int] = None
    locations: List[LocationLogCreate]


# Schema for geofence alerts
class GeofenceAlertCreate(BaseModel):
    task_id: Optional[int] = None
    alert_type: str = Field(..., max_length=50)
    expected_latitude: float = Field(..., ge=-90, le=90)
    expected_longitude: float = Field(..., ge=-180, le=180)
    actual_latitude: float = Field(..., ge=-90, le=90)
    actual_longitude: float = Field(..., ge=-180, le=180)
    distance_from_expected: float = Field(..., ge=0)
    notes: Optional[str] = None


class GeofenceAlertResponse(GeofenceAlertCreate):
    id: int
    user_id: int
    is_resolved: str
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Schema for performance analytics
class LocationAnalytics(BaseModel):
    total_locations_logged: int
    unique_tasks_with_location: int
    average_gps_accuracy: Optional[float] = None
    location_tracking_days: int
    most_visited_locations: List[dict]
    distance_traveled_km: Optional[float] = None


# Schema for route analysis
class RouteAnalysis(BaseModel):
    task_id: int
    task_title: str
    start_location: Optional[dict] = None
    end_location: Optional[dict] = None
    waypoints: List[dict]
    total_distance_km: Optional[float] = None
    duration_minutes: Optional[int] = None
    efficiency_score: Optional[float] = None  # 0-100 score


# Schema for team location overview (for managers)
class TeamLocationOverview(BaseModel):
    user_id: int
    user_name: str
    current_task_id: Optional[int] = None
    current_task_title: Optional[str] = None
    last_location: Optional[LocationLogResponse] = None
    last_update: Optional[datetime] = None
    status: str  # 'active', 'idle', 'offline'


# Schema for location history request
class LocationHistoryRequest(BaseModel):
    user_id: Optional[int] = None
    task_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location_type: Optional[str] = None
    limit: Optional[int] = Field(100, ge=1, le=1000)