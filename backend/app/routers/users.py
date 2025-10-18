from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.core.auth import get_current_active_user

router = APIRouter()

@router.get("/users/", response_model=List[UserResponse], tags=["Users"])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user) # This protects the endpoint
):
    """
    Retrieve a list of all users.
    """
    users = db.query(User).all()
    return users