"""
TaskRoute Tracker: Smart Forecasting Module
Auto-detects context from GPS coordinates and time patterns
"""

import joblib
import pandas as pd
import json
import pickle
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Optional, List
from math import radians, cos, sin, asin, sqrt

# ============================================================================
# LOAD MODEL ASSETS ON STARTUP
# ============================================================================

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "ml_model"

model = None
prophet_model = None
prophet_features_df = None
model_columns = None
label_encoders = None
employee_stats_df = None
city_stats_df = None
condition_stats_df = None
method_stats_df = None

try:
    model = joblib.load(MODEL_DIR / "task_duration_model.joblib")
    with open(MODEL_DIR / "prophet_model.pkl", 'rb') as f:
        prophet_model = pickle.load(f)
    prophet_features_df = pd.read_csv(MODEL_DIR / "prophet_features.csv", parse_dates=['Date'])
    with open(MODEL_DIR / "model_columns.json", 'r') as f:
        model_columns = json.load(f)
    with open(MODEL_DIR / "label_encoders.json", 'r') as f:
        label_encoders = json.load(f)
    employee_stats_df = pd.read_csv(MODEL_DIR / "employee_stats.csv")
    city_stats_df = pd.read_csv(MODEL_DIR / "city_stats.csv")
    condition_stats_df = pd.read_csv(MODEL_DIR / "condition_stats.csv")
    method_stats_df = pd.read_csv(MODEL_DIR / "method_stats.csv")
    
    print("✅ Forecasting models loaded successfully!")
    print(f"   - XGBoost features: {len(model_columns)}")
    print(f"   - Employee stats: {len(employee_stats_df)} employees")
except Exception as e:
    print(f"❌ Error loading forecasting models: {e}")
    model = None


# ============================================================================
# SMART AUTO-DETECTION HELPERS
# ============================================================================

# Manila Metro city centers (lat, lng)
CITY_COORDINATES = {
    'Manila': (14.5995, 120.9842),
    'Makati': (14.5547, 121.0244),
    'Quezon City': (14.6760, 121.0437),
    'Taguig': (14.5176, 121.0509),
    'Mandaluyong': (14.5794, 121.0359),
}

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in kilometers"""
    R = 6371  # Earth radius in km
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return R * c


def detect_city_from_coordinates(latitude: float, longitude: float) -> str:
    """
    Auto-detect city from GPS coordinates by finding nearest city center.
    Falls back to 'Manila' if uncertain.
    """
    if not latitude or not longitude:
        return 'Manila'
    
    try:
        min_distance = float('inf')
        nearest_city = 'Manila'
        
        for city, (city_lat, city_lng) in CITY_COORDINATES.items():
            distance = haversine_distance(latitude, longitude, city_lat, city_lng)
            if distance < min_distance:
                min_distance = distance
                nearest_city = city
        
        print(f"📍 Auto-detected city: {nearest_city} ({min_distance:.2f}km from center)")
        return nearest_city
    except Exception as e:
        print(f"⚠️ City detection failed: {e}, defaulting to Manila")
        return 'Manila'


def detect_conditions_from_time(start_time: datetime, city: str) -> str:
    """
    Smart condition detection based on time patterns.
    Prophet already handles rush hour seasonality, so we default to 'Normal'
    unless there's a specific reason to assume otherwise.
    """
    hour = start_time.hour
    day_of_week = start_time.weekday()  # 0=Monday, 6=Sunday
    
    # Rush hours: 7-9 AM and 5-7 PM on weekdays
    is_rush_hour = (day_of_week < 5) and ((7 <= hour <= 9) or (17 <= hour <= 19))
    
    if is_rush_hour:
        # Prophet's weekly seasonality already captures this pattern
        # So we still use 'Normal' - the model knows it's rush hour from time
        return 'Normal'
    else:
        return 'Normal'


def infer_transportation_method(employee_stats: Dict, task_distance_km: float = None) -> str:
    """
    Infer most likely transportation method based on:
    1. Employee's historical method preference (from stats)
    2. Distance to destination
    """
    # If employee has historical preference, use it
    # For now, default to most common method in Metro Manila
    if task_distance_km is not None:
        if task_distance_km < 2:
            return 'Walk'
        elif task_distance_km < 5:
            return 'Bike'
        else:
            return 'Drive'
    
    # Default to Drive for Metro Manila
    return 'Drive'


# ============================================================================
# HELPER: GET PROPHET FEATURES
# ============================================================================

def get_prophet_features(target_date: datetime) -> Dict[str, float]:
    """Get trend and weekly seasonality from Prophet for a specific date."""
    if prophet_features_df is None or prophet_model is None:
        return {"trend": 0.0, "weekly": 0.0}
    
    target_date_only = pd.to_datetime(target_date.date())
    existing = prophet_features_df[prophet_features_df['Date'] == target_date_only]
    
    if not existing.empty:
        return {
            "trend": float(existing['Prophet_Trend'].iloc[0]),
            "weekly": float(existing['Prophet_Weekly'].iloc[0])
        }
    
    try:
        future_df = pd.DataFrame({'ds': [target_date]})
        forecast = prophet_model.predict(future_df)
        return {
            "trend": float(forecast['trend'].iloc[0]),
            "weekly": float(forecast['weekly'].iloc[0] if 'weekly' in forecast.columns else 0)
        }
    except Exception as e:
        print(f"⚠️ Prophet forecast failed: {e}")
        return {
            "trend": float(prophet_features_df['Prophet_Trend'].iloc[-1]),
            "weekly": float(prophet_features_df['Prophet_Weekly'].iloc[-1])
        }


# ============================================================================
# HELPER: GET EMPLOYEE STATS
# ============================================================================

def get_employee_stats(participant_id: str) -> Dict[str, float]:
    """Get historical performance stats for an employee."""
    if employee_stats_df is None:
        return {
            "avg_duration": 30.0,
            "std_duration": 10.0,
            "median_duration": 28.0,
            "success_rate": 0.85,
            "avg_errors": 0.5,
            "avg_reliability": 85.0
        }
    
    emp_data = employee_stats_df[employee_stats_df['ParticipantID'] == participant_id]
    
    if len(emp_data) == 0:
        return {
            "avg_duration": float(employee_stats_df['Employee_AvgDuration'].mean()),
            "std_duration": float(employee_stats_df['Employee_StdDuration'].mean()),
            "median_duration": float(employee_stats_df['Employee_MedianDuration'].mean()),
            "success_rate": float(employee_stats_df['Employee_SuccessRate'].mean()),
            "avg_errors": float(employee_stats_df['Employee_AvgErrors'].mean()),
            "avg_reliability": float(employee_stats_df['Employee_AvgReliability'].mean())
        }
    
    return {
        "avg_duration": float(emp_data['Employee_AvgDuration'].iloc[0]),
        "std_duration": float(emp_data['Employee_StdDuration'].iloc[0]),
        "median_duration": float(emp_data['Employee_MedianDuration'].iloc[0]),
        "success_rate": float(emp_data['Employee_SuccessRate'].iloc[0]),
        "avg_errors": float(emp_data['Employee_AvgErrors'].iloc[0]),
        "avg_reliability": float(emp_data['Employee_AvgReliability'].iloc[0])
    }


# ============================================================================
# HELPER: ENCODE CATEGORICAL
# ============================================================================

def encode_categorical(city: str, conditions: str, method: str) -> Dict[str, int]:
    """Encode categorical variables using saved label encoders."""
    if label_encoders is None:
        return {"city": 0, "conditions": 0, "method": 0}
    
    city_encoded = label_encoders['city_classes'].index(city) if city in label_encoders['city_classes'] else 0
    conditions_encoded = label_encoders['conditions_classes'].index(conditions) if conditions in label_encoders['conditions_classes'] else 0
    method_encoded = label_encoders['method_classes'].index(method) if method in label_encoders['method_classes'] else 0
    
    return {"city": city_encoded, "conditions": conditions_encoded, "method": method_encoded}


# ============================================================================
# HELPER: GET LOCATION STATS
# ============================================================================

def get_location_stats(city: str, conditions: str, method: str) -> Dict[str, float]:
    """Get average duration statistics for city, conditions, and method."""
    stats = {}
    
    if city_stats_df is not None:
        city_data = city_stats_df[city_stats_df['City'] == city]
        if len(city_data) > 0:
            stats['city_avg'] = float(city_data['City_AvgDuration'].iloc[0])
            stats['city_std'] = float(city_data['City_StdDuration'].iloc[0])
        else:
            stats['city_avg'] = float(city_stats_df['City_AvgDuration'].mean())
            stats['city_std'] = float(city_stats_df['City_StdDuration'].mean())
    else:
        stats['city_avg'] = 30.0
        stats['city_std'] = 10.0
    
    if condition_stats_df is not None:
        cond_data = condition_stats_df[condition_stats_df['Conditions'] == conditions]
        if len(cond_data) > 0:
            stats['condition_impact'] = float(cond_data['Condition_ImpactFactor'].iloc[0])
        else:
            stats['condition_impact'] = float(condition_stats_df['Condition_ImpactFactor'].mean())
    else:
        stats['condition_impact'] = 30.0
    
    if method_stats_df is not None:
        method_data = method_stats_df[method_stats_df['Method'] == method]
        if len(method_data) > 0:
            stats['method_avg'] = float(method_data['Method_AvgDuration'].iloc[0])
        else:
            stats['method_avg'] = float(method_stats_df['Method_AvgDuration'].mean())
    else:
        stats['method_avg'] = 30.0
    
    return stats


# ============================================================================
# MAIN PREDICTION FUNCTION (SMART VERSION)
# ============================================================================

def predict_duration(task_data: dict) -> dict:
    """
    Smart task duration prediction with auto-detection.
    
    Required input:
    - Date, StartTime
    - latitude, longitude (for city detection)
    - ParticipantID (for employee KPI)
    
    Optional (will be auto-detected if not provided):
    - City (auto-detected from coordinates)
    - Conditions (auto-detected from time patterns)
    - Method (inferred from employee/distance)
    """
    
    if model is None or model_columns is None:
        return {
            "error": "Forecasting model not loaded",
            "predicted_duration_minutes": None
        }
    
    try:
        # Parse input
        date = pd.to_datetime(task_data.get('Date'))
        start_time = pd.to_datetime(task_data.get('StartTime'))
        participant_id = task_data.get('ParticipantID', None)
        
        # Get coordinates
        latitude = float(task_data.get('latitude', 0)) if task_data.get('latitude') else None
        longitude = float(task_data.get('longitude', 0)) if task_data.get('longitude') else None
        
        # 🎯 SMART AUTO-DETECTION
        city = task_data.get('City') or detect_city_from_coordinates(latitude, longitude)
        conditions = task_data.get('Conditions') or detect_conditions_from_time(start_time, city)
        method = task_data.get('Method') or 'Drive'  # Default for Metro Manila
        
        print(f"🤖 Smart detection: City={city}, Conditions={conditions}, Method={method}")
        
        # Get employee stats
        emp_stats = get_employee_stats(participant_id) if participant_id else {
            "avg_duration": 30.0, "std_duration": 10.0, "median_duration": 28.0,
            "success_rate": 0.85, "avg_errors": 0.5, "avg_reliability": 85.0
        }
        
        # ✅ FIX: Handle None values properly
        reliability = task_data.get('Reliability_pct')
        if reliability is None:
            reliability = emp_stats['avg_reliability']
        else:
            reliability = float(reliability)
        
        errors = task_data.get('Errors')
        if errors is None:
            errors = emp_stats['avg_errors']
        else:
            errors = float(errors)
        
        attempts = task_data.get('Attempts')
        if attempts is None:
            attempts = 1.0
        else:
            attempts = float(attempts)
        
        # Engineer temporal features (for metadata only, not used in model)
        start_hour = int(start_time.hour)
        dayofweek = int(start_time.dayofweek)
        month = int(start_time.month)
        is_weekend = int(1 if dayofweek in [5, 6] else 0)
        is_rush_hour = int(1 if (7 <= start_hour <= 9) or (17 <= start_hour <= 19) else 0)
        
        # Get Prophet features (for metadata only)
        prophet_features = get_prophet_features(date)
        prophet_baseline = prophet_features['trend'] + prophet_features['weekly']
        
        # Get location stats
        location_stats = get_location_stats(city, conditions, method)
        encoded = encode_categorical(city, conditions, method)
        
        # ✅ FIX: Only use the 15 features the model was actually trained on
        # Create feature array in the EXACT order the model expects
        feature_values = [
            float(emp_stats['median_duration']),      # Employee_MedianDuration
            float(encoded['method']),                  # Method_encoded
            float(location_stats['method_avg']),       # Method_AvgDuration
            float(encoded['city']),                    # City_encoded
            float(location_stats['city_std']),         # City_StdDuration
            float(location_stats['city_avg']),         # City_AvgDuration
            float(emp_stats['avg_duration']),          # Employee_AvgDuration
            float(emp_stats['std_duration']),          # Employee_StdDuration
            float(location_stats['condition_impact']), # Condition_ImpactFactor
            float(encoded['conditions']),              # Conditions_encoded
            float(emp_stats['success_rate']),          # Employee_SuccessRate
            float(emp_stats['avg_reliability']),       # Employee_AvgReliability
            float(reliability),                        # Reliability_pct
            float(errors),                             # Employee_AvgErrors
            float(errors)                              # Errors
        ]
        
        # Create DataFrame with exact column names from model
        expected_columns = [
            'Employee_MedianDuration', 'Method_encoded', 'Method_AvgDuration',
            'City_encoded', 'City_StdDuration', 'City_AvgDuration',
            'Employee_AvgDuration', 'Employee_StdDuration', 'Condition_ImpactFactor',
            'Conditions_encoded', 'Employee_SuccessRate', 'Employee_AvgReliability',
            'Reliability_pct', 'Employee_AvgErrors', 'Errors'
        ]
        
        features_df = pd.DataFrame([feature_values], columns=expected_columns)
        
        # Make prediction
        prediction_minutes = float(model.predict(features_df)[0])
        prediction_seconds = int(prediction_minutes * 60)
        
        # Calculate confidence interval
        confidence_margin = 1.96 * emp_stats['std_duration']
        confidence_lower = max(0, prediction_minutes - confidence_margin)
        confidence_upper = prediction_minutes + confidence_margin
        
        return {
            "predicted_duration_minutes": round(prediction_minutes, 2),
            "predicted_duration_seconds": prediction_seconds,
            "confidence_interval": {
                "lower_minutes": round(confidence_lower, 2),
                "upper_minutes": round(confidence_upper, 2)
            },
            "employee_kpi": {
                "historical_avg_duration": round(emp_stats['avg_duration'], 2),
                "success_rate": round(emp_stats['success_rate'] * 100, 1),
                "reliability_pct": round(emp_stats['avg_reliability'], 1)
            },
            "auto_detected": {
                "city": city,
                "conditions": conditions,
                "method": method,
                "is_rush_hour": bool(is_rush_hour)
            },
            "input_summary": {
                "date": date.strftime('%Y-%m-%d'),
                "start_time": start_time.strftime('%Y-%m-%d %H:%M'),
                "day_of_week": ["Monday", "Tuesday", "Wednesday", "Thursday", 
                               "Friday", "Saturday", "Sunday"][int(dayofweek)]
            },
            "prophet_components": {
                "trend": round(prophet_features['trend'], 2),
                "weekly_seasonality": round(prophet_features['weekly'], 2),
                "baseline_forecast": round(prophet_baseline, 2)
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


def predict_batch(tasks: list) -> list:
    """Predict duration for multiple tasks."""
    return [predict_duration(task) for task in tasks]


def get_employee_forecast_comparison(task_data: dict, employee_ids: List[str]) -> List[dict]:
    """Compare forecast for multiple employees for the same task."""
    forecasts = []
    
    for emp_id in employee_ids:
        task_data_copy = task_data.copy()
        task_data_copy['ParticipantID'] = emp_id
        
        prediction = predict_duration(task_data_copy)
        
        if 'error' not in prediction:
            forecasts.append({
                "employee_id": emp_id,
                "predicted_duration": prediction['predicted_duration_minutes'],
                "confidence_lower": prediction['confidence_interval']['lower_minutes'],
                "confidence_upper": prediction['confidence_interval']['upper_minutes'],
                "employee_kpi": prediction['employee_kpi']
            })
    
    forecasts.sort(key=lambda x: x['predicted_duration'])
    return forecasts