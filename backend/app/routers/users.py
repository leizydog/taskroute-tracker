from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.core.auth import get_current_active_user, get_current_admin
from app.models.task import Task

router = APIRouter(tags=["Users"])

@router.get("/users/", response_model=List[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    users = db.query(User).all()
    return users


# -----------------------
# 🔥 Admin Wipe Endpoints
# -----------------------

@router.delete("/users/admin/wipe-users")
def wipe_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    db.query(User).delete()
    db.commit()
    return {"message": "All users deleted"}


@router.delete("/users/admin/wipe-tasks")
def wipe_all_tasks(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    db.query(Task).delete()
    db.commit()
    return {"message": "All tasks deleted"}
