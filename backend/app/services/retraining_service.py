# backend/app/services/retraining_service.py
import pandas as pd
import numpy as np
import joblib
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error
from geopy.distance import geodesic
from app.models.task import Task, TaskStatus

# Setup logging (Critical for debugging on Render)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CONFIGURATION
MODEL_DIR = Path('./app/ml_models')
MODEL_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODEL_DIR / "task_duration_model_with_location.joblib"
LOOKBACK_DAYS = 90  # Limit training to last 3 months to save RAM on Render

# ==============================================================================
# 1. HELPER: LOCATION CALCULATION (Ported from taskroute.py)
# ==============================================================================
def calculate_geodesic_distance(row):
    """
    Replicates the logic from taskroute.py to generate distance and travel time.
    """
    # Safety check for missing coordinates
    if (pd.isna(row.get('EmployeeStartLat')) or pd.isna(row.get('EmployeeStartLng')) or 
        pd.isna(row.get('TaskLat')) or pd.isna(row.get('TaskLng'))):
        return 0.0, 0.0
        
    employee_loc = (row['EmployeeStartLat'], row['EmployeeStartLng'])
    task_loc = (row['TaskLat'], row['TaskLng'])
    
    try:
        # Straight line distance
        distance = geodesic(employee_loc, task_loc).km
        
        # 1.3x multiplier for road distance (Logic from taskroute.py)
        road_distance = distance * 1.3 
        
        # Speed estimation based on method (Logic from taskroute.py)
        speeds = {'Drive': 30, 'Walk': 5, 'Bike': 15, 'Public Transport': 20}
        speed = speeds.get(row.get('Method'), 20)
        
        travel_time_min = (road_distance / speed) * 60
        return road_distance, travel_time_min
    except Exception:
        return 0.0, 0.0

# ==============================================================================
# 2. HELPER: DATA FETCHING (With Rolling Window)
# ==============================================================================
def fetch_training_data(db: Session):
    """
    Fetch completed tasks within the rolling window window.
    """
    # 1. Define Cutoff Date (Rolling Window)
    cutoff_date = datetime.utcnow() - timedelta(days=LOOKBACK_DAYS)
    
    query = db.query(Task).filter(
        Task.status == TaskStatus.COMPLETED,
        Task.actual_duration.isnot(None),
        Task.created_at >= cutoff_date # <--- PREVENTS MEMORY CRASH
    ).all()
    
    if not query:
        return pd.DataFrame()

    data = []
    for task in query:
        created_at = task.created_at
        hour = created_at.hour
        
        # Map DB model to DataFrame schema
        data.append({
            "ParticipantID": f"P{task.assigned_to:03d}",
            "ActualDuration": task.actual_duration,
            "Hour": hour,
            "DayOfWeek": created_at.weekday(),
            "Month": created_at.month,
            "IsWeekend": 1 if created_at.weekday() >= 5 else 0,
            "IsRushHour": 1 if (7 <= hour <= 9) or (17 <= hour <= 19) else 0,
            
            # Location Data (Use getattr for safety if columns vary)
            "EmployeeStartLat": getattr(task, 'start_lat', 0.0), 
            "EmployeeStartLng": getattr(task, 'start_lng', 0.0),
            "TaskLat": getattr(task, 'dest_lat', 0.0),
            "TaskLng": getattr(task, 'dest_lng', 0.0),
            
            # Context
            "Method": getattr(task, 'transport_method', 'Drive'), 
            "City": getattr(task, 'city', 'Unknown'),
            "Conditions": getattr(task, 'weather_condition', 'Normal'),
            
            # Metrics
            "Errors": getattr(task, 'errors_count', 0),
            "Reliability_pct": getattr(task, 'reliability_score', 100.0)
        })
        
    df = pd.DataFrame(data)
    
    # Apply distance calculations
    if not df.empty:
        df[['DistanceToTask_km', 'EstimatedTravelTime_min']] = df.apply(
            lambda row: pd.Series(calculate_geodesic_distance(row)), axis=1
        )
    
    return df

# ==============================================================================
# 3. HELPER: FEATURE ENGINEERING
# ==============================================================================
def engineer_features_for_training(df):
    """
    Replicates the feature engineering pipeline from taskroute.py
    """
    # A. Calculate Employee Stats
    emp_stats = df.groupby('ParticipantID').agg(
        Employee_AvgDuration=("ActualDuration", "mean"),
        Employee_StdDuration=("ActualDuration", "std"),
        Employee_MedianDuration=("ActualDuration", "median"),
        Employee_SuccessRate=("ActualDuration", "count"), 
        Employee_AvgErrors=("Errors", "mean"),
        Employee_AvgReliability=("Reliability_pct", "mean"),
        Employee_AvgDistance=("DistanceToTask_km", "mean"),
        Employee_AvgTravelTime=("EstimatedTravelTime_min", "mean")
    ).reset_index().fillna(0)
    
    df = df.merge(emp_stats, on='ParticipantID', how='left')
    
    # B. Calculate City Stats
    city_stats = df.groupby('City').agg(
        City_AvgDuration=("ActualDuration", "mean"),
        City_StdDuration=("ActualDuration", "std"),
        City_AvgDistance=("DistanceToTask_km", "mean")
    ).reset_index().fillna(0)
    
    df = df.merge(city_stats, on='City', how='left')
    
    # C. Calculate Condition/Method Stats
    cond_stats = df.groupby('Conditions').agg(
        Condition_ImpactFactor=("ActualDuration", "mean"),
        Condition_AvgTravelTime=("EstimatedTravelTime_min", "mean")
    ).reset_index().fillna(0)
    
    method_stats = df.groupby('Method').agg(
        Method_AvgDuration=("ActualDuration", "mean"),
        Method_AvgTravelTime=("EstimatedTravelTime_min", "mean")
    ).reset_index().fillna(0)
    
    df = df.merge(cond_stats, on='Conditions', how='left')
    df = df.merge(method_stats, on='Method', how='left')
    
    # D. Interaction Features
    method_map = {'Drive': 1, 'Walk': 4, 'Bike': 2, 'Public Transport': 3}
    df['Distance_Method_Interaction'] = df['DistanceToTask_km'] * df['Method'].map(method_map).fillna(2)
    
    # E. Encodings (Simple Factorization for stability)
    df['DistanceCategory_encoded'] = pd.cut(df['DistanceToTask_km'], bins=[0, 1, 3, 5, 10, 100], labels=False).fillna(2)
    df['City_encoded'] = pd.factorize(df['City'])[0]
    df['Conditions_encoded'] = pd.factorize(df['Conditions'])[0]
    df['Method_encoded'] = pd.factorize(df['Method'])[0]
    
    # F. Add Missing Columns (Prophet placeholders)
    for col in ['Prophet_Prediction', 'Prophet_Trend', 'Prophet_Yearly', 'Prophet_Weekly', 'Prophet_Daily', 'Attempts']:
        if col not in df.columns:
            df[col] = 0.0 if col != 'Attempts' else 1

    return df

# ==============================================================================
# 4. MAIN PIPELINE
# ==============================================================================
async def train_model_pipeline(db: Session):
    logs = []
    try:
        logs.append(f"📥 Fetching data (Last {LOOKBACK_DAYS} days)...")
        df = fetch_training_data(db)
        
        # SAFETY 1: Minimum Data Threshold
        if len(df) < 50:
            return {
                "success": False, 
                "message": f"Insufficient data. Found {len(df)} rows, need 50+.", 
                "logs": logs
            }

        logs.append(f"📊 Processing {len(df)} tasks...")
        
        # Feature Engineering
        train_df = engineer_features_for_training(df)
        
        # Select Features (Matches taskroute.py)
        selected_features = [
            'Hour', 'DayOfWeek', 'Month', 'IsWeekend', 'IsRushHour',
            'Employee_AvgDuration', 'Employee_StdDuration', 'Employee_MedianDuration',
            'Employee_SuccessRate', 'Employee_AvgErrors', 'Employee_AvgReliability',
            'Employee_AvgDistance', 'Employee_AvgTravelTime',
            'Reliability_pct', 'Errors', 'Attempts',
            'DistanceToTask_km', 'EstimatedTravelTime_min',
            'DistanceCategory_encoded', 'Distance_Method_Interaction',
            'City_encoded', 'City_AvgDuration', 'City_StdDuration', 'City_AvgDistance',
            'Conditions_encoded', 'Condition_ImpactFactor', 'Condition_AvgTravelTime',
            'Method_encoded', 'Method_AvgDuration', 'Method_AvgTravelTime',
            'Prophet_Prediction', 'Prophet_Trend', 'Prophet_Yearly',
            'Prophet_Weekly', 'Prophet_Daily'
        ]
        
        # Ensure all columns exist
        for c in selected_features:
            if c not in train_df.columns:
                train_df[c] = 0.0
        
        X = train_df[selected_features].fillna(0)
        y = train_df['ActualDuration']

        # Train "Challenger" Model
        logs.append("🧠 Training Challenger Model...")
        challenger_model = XGBRegressor(
            n_estimators=100, # Reduced from 300 to save RAM/Time
            max_depth=5,      # Reduced from 7 to save RAM/Time
            learning_rate=0.05,
            n_jobs=-1
        )
        challenger_model.fit(X, y)
        
        challenger_mae = mean_absolute_error(y, challenger_model.predict(X))
        logs.append(f"📉 Challenger MAE: {challenger_mae:.2f} min")

        # SAFETY 2: Champion vs Challenger
        if MODEL_PATH.exists():
            try:
                champion_model = joblib.load(MODEL_PATH)
                champion_mae = mean_absolute_error(y, champion_model.predict(X))
                logs.append(f"🏆 Champion MAE: {champion_mae:.2f} min")
                
                if challenger_mae <= champion_mae:
                    logs.append("✅ New model promoted! Saving...")
                    joblib.dump(challenger_model, MODEL_PATH)
                    # Note: On Render, this file is ephemeral. 
                    # Ideally, upload to S3/Cloud Storage here.
                else:
                    logs.append("❌ New model worse. Discarding.")
            except Exception:
                logs.append("⚠️ Old model corrupt. Overwriting.")
                joblib.dump(challenger_model, MODEL_PATH)
        else:
            logs.append("💾 First model created.")
            joblib.dump(challenger_model, MODEL_PATH)
            
        # Always update feature columns for safety
        with open(MODEL_DIR / "model_columns.json", "w") as f:
            json.dump(selected_features, f)

        return {
            "success": True, 
            "message": "Retraining logic completed.", 
            "logs": logs
        }

    except Exception as e:
        logger.error(f"Retraining Error: {e}")
        logs.append(f"❌ Error: {str(e)}")
        return {"success": False, "message": str(e), "logs": logs}