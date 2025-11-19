from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.core.auth import get_current_active_user, get_current_admin
from app.models.task import Task
from fastapi import HTTPException, status

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


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int, 
    user_update: dict, # Or create a UserUpdate schema
    db: Session = Depends(get_db),
    # admin: User = Depends(get_current_admin) # Optional: Protect this route
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields (like is_active)
    for key, value in user_update.items():
        setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int, 
    db: Session = Depends(get_db),
    # admin: User = Depends(get_current_admin) # Optional: Protect this route
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}