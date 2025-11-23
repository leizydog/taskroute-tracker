# backend/app/services/retraining_service.py
import pandas as pd
import joblib
from pathlib import Path
from sqlalchemy.orm import Session
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error
from app.models.task import Task, TaskStatus

# Define paths relative to the backend container
MODEL_DIR = Path('./app/ml_models')
MODEL_DIR.mkdir(parents=True, exist_ok=True)

def fetch_training_data(db: Session):
    """Fetch completed tasks for training"""
    query = db.query(Task).filter(
        Task.status == TaskStatus.COMPLETED,
        Task.actual_duration.isnot(None)
    ).all()
    
    data = []
    for task in query:
        created_at = task.created_at
        hour = created_at.hour
        
        data.append({
            "ParticipantID": f"P{task.assigned_to:03d}",
            "ActualDuration": task.actual_duration,
            "Hour": hour,
            "DayOfWeek": created_at.weekday(),
            "IsWeekend": 1 if created_at.weekday() >= 5 else 0,
            "IsRushHour": 1 if (7 <= hour <= 9) or (17 <= hour <= 19) else 0,
            "QualityRating": task.quality_rating or 3.0, # Default to 3 if None
        })
        
    return pd.DataFrame(data)

def recalculate_employee_stats(df):
    """Calculate stats for features"""
    stats = df.groupby("ParticipantID").agg(
        Employee_AvgDuration=("ActualDuration", "mean"),
        Employee_StdDuration=("ActualDuration", "std"),
        Employee_AvgReliability=("QualityRating", "mean"),
    ).reset_index()
    
    # Fill NaN for single-record employees
    stats = stats.fillna({
        "Employee_StdDuration": 10.0,
        "Employee_AvgReliability": 3.0,
    })
    return stats

async def train_model_pipeline(db: Session):
    """
    Executes the full retraining pipeline.
    Returns a dictionary with the results of the operation.
    """
    logs = []
    try:
        logs.append("📥 Fetching data...")
        df = fetch_training_data(db)
        
        if len(df) < 10: # Lowered threshold for testing
            return {"success": False, "message": "Not enough data (min 10 tasks)", "logs": logs}

        logs.append(f"📊 Processing {len(df)} tasks...")
        
        # 1. Recalculate Stats
        employee_stats = recalculate_employee_stats(df)
        employee_stats.to_csv(MODEL_DIR / "employee_stats.csv", index=False)
        logs.append("✅ Employee stats updated")

        # 2. Prepare Training Data
        train_df = df.merge(employee_stats, on="ParticipantID", how="left")
        features = [
            "Hour", "DayOfWeek", "IsWeekend", "IsRushHour",
            "Employee_AvgDuration", "Employee_StdDuration",
            "Employee_AvgReliability",
        ]
        X = train_df[features].fillna(0)
        y = train_df["ActualDuration"]

        # 3. Train Model
        logs.append("🧠 Training XGBoost...")
        model = XGBRegressor(n_estimators=100, learning_rate=0.1, max_depth=5)
        model.fit(X, y)

        # 4. Evaluate
        preds = model.predict(X)
        mae = mean_absolute_error(y, preds)
        logs.append(f"📉 New MAE: {mae:.2f} minutes")

        # 5. Save
        joblib.dump(model, MODEL_DIR / "task_duration_model_with_location.joblib")
        
        import json
        with open(MODEL_DIR / "model_columns.json", "w") as f:
            json.dump(features, f)
            
        logs.append("💾 Model saved successfully")
        
        return {
            "success": True, 
            "message": "Retraining complete", 
            "metrics": {"mae": mae, "tasks_count": len(df)},
            "logs": logs
        }

    except Exception as e:
        return {"success": False, "message": str(e), "logs": logs}