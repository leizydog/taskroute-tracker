"""
TaskRoute: Automated Model Retraining Script
File: backend/scripts/retrain_model.py

Run this script periodically (e.g., weekly) to:
1. Fetch all completed tasks from the database
2. Recalculate Employee, City, and Condition statistics
3. Retrain the XGBoost model with the new dataset
4. Save the new model and lookup tables
"""

import os
import sys
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error

# Add parent directory to path so we can import app modules
sys.path.append(str(Path(__file__).parent.parent))

from app.models.task import Task, TaskStatus
from app.models.user import User
from app.models.location import LocationLog
from app.core.config import settings

# Database Connection
DATABASE_URL = settings.DATABASE_URL
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

MODEL_DIR = Path('./app/ml_models')
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def fetch_completed_tasks(db):
    """Fetch all completed tasks with relevant details."""
    query = db.query(Task).filter(
        Task.status == TaskStatus.COMPLETED,
        Task.actual_duration.isnot(None)
    ).all()
    
    data = []
    for task in query:
        created_at = task.created_at
        hour = created_at.hour
        day_of_week = created_at.weekday()
        month = created_at.month
        is_weekend = 1 if day_of_week >= 5 else 0

        row = {
            "TaskID": task.id,
            "ParticipantID": f"P{task.assigned_to:03d}",
            "ActualDuration": task.actual_duration,  # Ensure units match model
            "City": "Manila",
            "Conditions": "Normal",
            "Method": "Drive",
            "Hour": hour,
            "DayOfWeek": day_of_week,
            "Month": month,
            "IsWeekend": is_weekend,
            "IsRushHour": 1 if (7 <= hour <= 9) or (17 <= hour <= 19) else 0,
            "QualityRating": task.quality_rating,
        }
        data.append(row)
        
    return pd.DataFrame(data)


def recalculate_employee_stats(df):
    """Recalculate employee KPIs based on historical data."""
    stats = df.groupby("ParticipantID").agg(
        Employee_AvgDuration=("ActualDuration", "mean"),
        Employee_StdDuration=("ActualDuration", "std"),
        Employee_MedianDuration=("ActualDuration", "median"),
        Employee_SuccessRate=("QualityRating", lambda x: (x >= 4).mean()),
        Employee_AvgReliability=("QualityRating", "mean"),
    ).reset_index()
    
    stats = stats.fillna({
        "Employee_StdDuration": 10.0,
        "Employee_SuccessRate": 0.9,
        "Employee_AvgReliability": 4.0,
    })
    
    return stats


def retrain():
    print("🚀 Starting Model Retraining Pipeline...")
    db = SessionLocal()
    
    try:
        print("📥 Fetching completed tasks from database...")
        df = fetch_completed_tasks(db)
        print(f"   Found {len(df)} completed tasks.")
        
        if len(df) < 50:
            print("⚠️ Not enough data to retrain (minimum 50 tasks). Aborting.")
            return

        print("📊 Recalculating Employee Statistics...")
        employee_stats = recalculate_employee_stats(df)
        employee_stats.to_csv(MODEL_DIR / "employee_stats.csv", index=False)
        print("   ✅ employee_stats.csv updated")

        train_df = df.merge(employee_stats, on="ParticipantID", how="left")

        features = [
            "Hour", "DayOfWeek", "IsWeekend", "IsRushHour",
            "Employee_AvgDuration", "Employee_StdDuration",
            "Employee_AvgReliability",
        ]
        target = "ActualDuration"
        
        X = train_df[features].fillna(0)
        y = train_df[target]

        print("🧠 Training XGBoost Model...")
        model = XGBRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5
        )
        model.fit(X, y)
        
        print("📉 Evaluating Performance...")
        preds = model.predict(X)
        mae = mean_absolute_error(y, preds)
        print(f"   MAE: {mae:.2f} minutes")

        print("💾 Saving new model...")
        joblib.dump(model, MODEL_DIR / "task_duration_model_with_location.joblib")

        import json
        with open(MODEL_DIR / "model_columns.json", "w") as f:
            json.dump(features, f)

        print("✅ Retraining Complete! New model is ready.")

    except Exception as e:
        print(f"❌ Error during retraining: {e}")

    finally:
        db.close()


if __name__ == "__main__":
    retrain()
