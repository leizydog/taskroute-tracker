# backend/app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.core.auth import get_current_active_user
from app.services.retraining_service import train_model_pipeline
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

# --- Schemas ---
class AuditLogOut(BaseModel):
    id: int
    action: str
    target_resource: str | None
    details: str | None
    timestamp: datetime
    user_email: str | None

    class Config:
        orm_mode = True

class RetrainResponse(BaseModel):
    success: bool
    message: str
    logs: List[str]

# --- Dependencies ---
def verify_admin(current_user: User = Depends(get_current_active_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user

# --- Endpoints ---

@router.get("/audit-logs", response_model=List[AuditLogOut])
def get_audit_logs(
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin)
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    
    # Map result to include user email dynamically
    results = []
    for log in logs:
        results.append({
            "id": log.id,
            "action": log.action,
            "target_resource": log.target_resource,
            "details": log.details,
            "timestamp": log.timestamp,
            "user_email": log.user.email if log.user else "System"
        })
    return results

@router.post("/retrain-model")
async def trigger_retrain(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin)
):
    # We run this immediately but you could use background_tasks.add_task() if it takes too long.
    # For feedback purposes, we'll await it here so the UI gets the result.
    
    # 1. Log the attempt
    log = AuditLog(
        user_id=admin.id,
        action="SYSTEM_RETRAIN",
        details="Admin triggered manual model retraining",
        target_resource="XGBoost Model"
    )
    db.add(log)
    db.commit()
    
    # 2. Run Pipeline
    result = await train_model_pipeline(db)
    
    # 3. Log Result
    status = "Success" if result["success"] else "Failed"
    db.add(AuditLog(
        user_id=admin.id,
        action="RETRAIN_COMPLETE", 
        details=f"Result: {status}. MAE: {result.get('metrics', {}).get('mae', 'N/A')}",
        target_resource="XGBoost Model"
    ))
    db.commit()

    return result