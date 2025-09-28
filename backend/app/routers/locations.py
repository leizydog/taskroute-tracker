from fastapi import APIRouter, Depends
from app.core.auth import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/locations", tags=["Location Tracking"])

@router.get("/analytics")
def get_location_analytics(
    days: int = 30,
    current_user: User = Depends(get_current_active_user)
):
    """Get basic location analytics."""
    
    # For now, return placeholder data
    return {
        "total_locations_logged": 0,
        "unique_tasks_with_location": 0,
        "average_gps_accuracy": None,
        "location_tracking_days": 0,
        "most_visited_locations": [],
        "distance_traveled_km": 0.0
    }