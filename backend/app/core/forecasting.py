"""
TaskRoute Tracker: Forecasting Module
Hybrid Prophet + XGBoost Model for Task Duration Prediction
"""

import joblib
import pandas as pd
import json
import pickle
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Optional

# ============================================================================
# LOAD MODEL ASSETS ON STARTUP
# ============================================================================

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "ml_model"

# Global variables to hold loaded models
model = None
prophet_model = None
prophet_features_df = None
model_columns = None

try:
    # Load XGBoost model
    model = joblib.load(MODEL_DIR / "task_duration_model.joblib")
    
    # Load Prophet model
    with open(MODEL_DIR / "prophet_model.pkl", 'rb') as f:
        prophet_model = pickle.load(f)
    
    # Load Prophet features CSV (for trend/seasonality lookup)
    prophet_features_df = pd.read_csv(
        MODEL_DIR / "prophet_features.csv",
        parse_dates=['Date']
    )
    
    # Load feature column names
    with open(MODEL_DIR / "model_columns.json", 'r') as f:
        model_columns = json.load(f)
    
    print("✅ Forecasting models loaded successfully!")
    print(f"   - XGBoost features: {len(model_columns)}")
    print(f"   - Prophet date range: {prophet_features_df['Date'].min()} to {prophet_features_df['Date'].max()}")
    
except Exception as e:
    print(f"❌ Error loading forecasting models: {e}")
    print("   Prediction endpoint will return errors until models are loaded.")
    model = None


# ============================================================================
# HELPER: GET PROPHET FEATURES FOR A DATE
# ============================================================================

def get_prophet_features(target_date: datetime) -> Dict[str, float]:
    """
    Get trend and weekly seasonality from Prophet for a specific date.
    If date is not in the CSV, extrapolate using Prophet model.
    """
    if prophet_features_df is None or prophet_model is None:
        return {"trend": 0.0, "weekly": 0.0}
    
    # Normalize to date only (remove time component)
    target_date_only = pd.to_datetime(target_date.date())
    
    # Try to find existing features first
    existing = prophet_features_df[prophet_features_df['Date'] == target_date_only]
    
    if not existing.empty:
        return {
            "trend": float(existing['trend'].iloc[0]),
            "weekly": float(existing['weekly'].iloc[0])
        }
    
    # If date not found, generate forecast using Prophet
    try:
        future_df = pd.DataFrame({'ds': [target_date]})
        
        # Add dummy regressors (Prophet requires them during prediction)
        future_df['is_heavy_traffic'] = 0
        future_df['is_rain'] = 0
        future_df['is_road_works'] = 0
        
        forecast = prophet_model.predict(future_df)
        
        return {
            "trend": float(forecast['trend'].iloc[0]),
            "weekly": float(forecast['weekly'].iloc[0])
        }
    except Exception as e:
        print(f"⚠️ Warning: Could not generate Prophet features for {target_date}: {e}")
        # Fallback to last known values
        return {
            "trend": float(prophet_features_df['trend'].iloc[-1]),
            "weekly": float(prophet_features_df['weekly'].iloc[-1])
        }


# ============================================================================
# MAIN PREDICTION FUNCTION
# ============================================================================

def predict_duration(task_data: dict) -> dict:
    """
    Predicts task duration using hybrid Prophet + XGBoost model.
    
    Expected input format:
    {
        "Date": "2025-10-09",  # or datetime object
        "StartTime": "2025-10-09 08:30:00",  # or datetime object
        "City": "Manila",  # One of: Makati, Mandaluyong, Manila, Quezon City, Taguig
        "Conditions": "Normal",  # One of: Heavy Traffic, Normal, Rain, Road Works
        "Method": "Drive",  # One of: Bike, Drive, Public Transport, Rideshare, Walk
        "Reliability_pct": 90.0,  # Optional, defaults to 90.0
        "Errors": 0,  # Optional, defaults to 0
        "Attempts": 1  # Optional, defaults to 1
    }
    
    Returns:
    {
        "predicted_duration_minutes": 25.3,
        "predicted_duration_seconds": 1518,
        "confidence_interval": {"lower": 20.5, "upper": 30.1},  # Optional
        "features_used": {...}
    }
    """
    
    # Check if models are loaded
    if model is None or model_columns is None:
        return {
            "error": "Forecasting model not loaded. Please contact administrator.",
            "predicted_duration_minutes": None
        }
    
    try:
        # ====================================================================
        # 1. PARSE INPUT DATA
        # ====================================================================
        
        # Convert date/time strings to datetime objects
        date = pd.to_datetime(task_data.get('Date'))
        start_time = pd.to_datetime(task_data.get('StartTime'))
        
        # Extract categorical features
        city = task_data.get('City', 'Manila')
        conditions = task_data.get('Conditions', 'Normal')
        method = task_data.get('Method', 'Drive')
        
        # Extract numerical features with defaults
        reliability = task_data.get('Reliability_pct', 90.0)
        errors = task_data.get('Errors', 0)
        attempts = task_data.get('Attempts', 1)
        
        # ====================================================================
        # 2. ENGINEER TEMPORAL FEATURES
        # ====================================================================
        
        start_hour = start_time.hour
        dayofweek = start_time.dayofweek  # 0=Monday, 6=Sunday
        month = start_time.month
        is_weekend = 1 if dayofweek in [5, 6] else 0
        
        # ====================================================================
        # 3. GET PROPHET FEATURES (TREND + SEASONALITY)
        # ====================================================================
        
        prophet_features = get_prophet_features(date)
        
        # Calculate baseline forecast (trend + weekly)
        prophet_baseline = prophet_features['trend'] + prophet_features['weekly']
        
        # ====================================================================
        # 4. CREATE FEATURE DATAFRAME
        # ====================================================================
        
        # Initialize with all model columns set to 0
        features_df = pd.DataFrame(0, index=[0], columns=model_columns)
        
        # Set core features
        features_df['prophet_trend'] = prophet_features['trend']
        features_df['prophet_weekly'] = prophet_features['weekly']
        features_df['prophet_baseline'] = prophet_baseline
        
        features_df['start_hour'] = start_hour
        features_df['dayofweek'] = dayofweek
        features_df['month'] = month
        features_df['is_weekend'] = is_weekend
        
        features_df['Errors'] = errors
        features_df['Attempts'] = attempts
        features_df['Reliability_pct'] = reliability
        features_df['Success_binary'] = 1  # Assume success for prediction
        
        # Calculate derived features
        features_df['error_rate'] = errors / max(attempts, 1)
        features_df['daily_workload'] = 5  # Default workload estimate
        
        # ====================================================================
        # 5. SET ONE-HOT ENCODED FEATURES
        # ====================================================================
        
        # City encoding (replace spaces with underscores to match training)
        city_col = f"City_{city.replace(' ', '_')}"
        if city_col in features_df.columns:
            features_df[city_col] = 1
        
        # Conditions encoding
        conditions_col = f"Conditions_{conditions.replace(' ', '_')}"
        if conditions_col in features_df.columns:
            features_df[conditions_col] = 1
        
        # Method encoding
        method_col = f"Method_{method.replace(' ', '_')}"
        if method_col in features_df.columns:
            features_df[method_col] = 1
        
        # ====================================================================
        # 6. MAKE PREDICTION
        # ====================================================================
        
        prediction_minutes = model.predict(features_df)[0]
        prediction_seconds = int(prediction_minutes * 60)
        
        # ====================================================================
        # 7. CALCULATE CONFIDENCE INTERVAL (OPTIONAL)
        # ====================================================================
        
        # Simple confidence interval based on cross-validation MAE (±6 minutes)
        mae_estimate = 6.0  # From your CV results
        confidence_lower = max(0, prediction_minutes - mae_estimate)
        confidence_upper = prediction_minutes + mae_estimate
        
        # ====================================================================
        # 8. RETURN PREDICTION (Convert all numpy types to Python natives)
        # ====================================================================
        
        return {
            "predicted_duration_minutes": float(round(prediction_minutes, 2)),
            "predicted_duration_seconds": int(prediction_seconds),
            "confidence_interval": {
                "lower_minutes": float(round(confidence_lower, 2)),
                "upper_minutes": float(round(confidence_upper, 2))
            },
            "input_summary": {
                "date": date.strftime('%Y-%m-%d'),
                "start_time": start_time.strftime('%Y-%m-%d %H:%M'),
                "city": str(city),
                "conditions": str(conditions),
                "method": str(method),
                "day_of_week": ["Monday", "Tuesday", "Wednesday", "Thursday", 
                               "Friday", "Saturday", "Sunday"][int(dayofweek)]
            },
            "prophet_components": {
                "trend": float(round(prophet_features['trend'], 2)),
                "weekly_seasonality": float(round(prophet_features['weekly'], 2)),
                "baseline_forecast": float(round(prophet_baseline, 2))
            }
        }
        
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "error": f"Prediction failed: {str(e)}",
            "predicted_duration_minutes": None
        }


# ============================================================================
# BATCH PREDICTION (FOR MULTIPLE TASKS)
# ============================================================================

def predict_batch(tasks: list) -> list:
    """
    Predict duration for multiple tasks at once.
    More efficient than calling predict_duration() individually.
    """
    return [predict_duration(task) for task in tasks]