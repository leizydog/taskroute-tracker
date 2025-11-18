"""
TaskRoute: Task Duration Predictor with Google Directions API Integration (FIXED)
File: backend/app/services/task_duration_predictor.py
"""

import requests
import pandas as pd
import numpy as np
import joblib
import json
import pickle
import os
from pathlib import Path
from datetime import datetime, timedelta
from geopy.distance import geodesic
from typing import Dict, Optional, List


# ============================================================================
# GOOGLE DIRECTIONS API SERVICE (FIXED FOR RUSH HOUR)
# ============================================================================

class GoogleDirectionsService:
    """Service for getting real-time route data from Google Directions API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://maps.googleapis.com/maps/api/directions/json"
    
    def get_route_info(
        self, 
        origin_lat: float, 
        origin_lng: float, 
        dest_lat: float, 
        dest_lng: float, 
        mode: str = 'driving', 
        departure_time: str = 'now', 
        traffic_model: str = 'best_guess'
    ) -> Dict:
        """
        Get route information from Google Directions API
        
        Parameters:
        -----------
        origin_lat : float - Starting latitude
        origin_lng : float - Starting longitude
        dest_lat : float - Destination latitude
        dest_lng : float - Destination longitude
        mode : str - Travel mode: 'driving', 'walking', 'bicycling', 'transit'
        departure_time : str - 'now' or Unix timestamp
        traffic_model : str - 'best_guess', 'pessimistic', or 'optimistic'
        
        Returns:
        --------
        dict : Route information including distance and duration
        """
        
        params = {
            'origin': f"{origin_lat},{origin_lng}",
            'destination': f"{dest_lat},{dest_lng}",
            'mode': mode,
            'key': self.api_key,
            'departure_time': departure_time,
            'traffic_model': traffic_model
        }
        
        try:
            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK':
                route = data['routes'][0]
                leg = route['legs'][0]
                
                distance_meters = leg['distance']['value']
                distance_km = distance_meters / 1000
                
                # Duration in traffic (if available) or regular duration
                if 'duration_in_traffic' in leg:
                    duration_seconds = leg['duration_in_traffic']['value']
                    duration_text = leg['duration_in_traffic']['text']
                else:
                    duration_seconds = leg['duration']['value']
                    duration_text = leg['duration']['text']
                
                duration_minutes = duration_seconds / 60
                
                return {
                    'success': True,
                    'distance_km': round(distance_km, 2),
                    'distance_meters': distance_meters,
                    'duration_minutes': round(duration_minutes, 2),
                    'duration_seconds': duration_seconds,
                    'duration_text': duration_text,
                    'start_address': leg['start_address'],
                    'end_address': leg['end_address'],
                    'polyline': route['overview_polyline']['points'],
                    'has_traffic_data': 'duration_in_traffic' in leg,
                    'steps_count': len(leg['steps'])
                }
            else:
                print(f"Google Directions API error: {data['status']}")
                return self._fallback_calculation(origin_lat, origin_lng, dest_lat, dest_lng, mode)
                
        except Exception as e:
            print(f"Error calling Google Directions API: {e}")
            return self._fallback_calculation(origin_lat, origin_lng, dest_lat, dest_lng, mode)
    
    def _fallback_calculation(
        self, 
        origin_lat: float, 
        origin_lng: float, 
        dest_lat: float, 
        dest_lng: float, 
        mode: str
    ) -> Dict:
        """Fallback calculation if API is unavailable"""
        distance = geodesic((origin_lat, origin_lng), (dest_lat, dest_lng)).km
        road_distance = distance * 1.3
        
        speeds = {
            'driving': 30,
            'walking': 5,
            'bicycling': 15,
            'transit': 20
        }
        
        speed = speeds.get(mode, 20)
        duration_minutes = (road_distance / speed) * 60
        
        return {
            'success': False,
            'distance_km': round(road_distance, 2),
            'duration_minutes': round(duration_minutes, 2),
            'fallback': True
        }
    
    def get_route_with_conditions(
        self, 
        origin_lat: float, 
        origin_lng: float, 
        dest_lat: float, 
        dest_lng: float, 
        method: str, 
        conditions: str, 
        hour: int, 
        day_of_week: int,
        date_str: str = None  # ✅ NEW: Accept date string
    ) -> Dict:
        """
        ✅ FIXED: Get route info with proper timing and traffic consideration
        """
        
        # Map method to Google Directions mode
        mode_mapping = {
            'Drive': 'driving',
            'Walk': 'walking',
            'Bike': 'bicycling',
            'Public Transport': 'transit'
        }
        
        mode = mode_mapping.get(method, 'driving')
        
        # ✅ FIX 1: Calculate Unix timestamp for the scheduled time
        if date_str:
            try:
                scheduled_datetime = datetime.strptime(date_str, '%Y-%m-%d').replace(hour=hour)
            except:
                scheduled_datetime = datetime.now().replace(hour=hour, minute=0, second=0)
        else:
            scheduled_datetime = datetime.now().replace(hour=hour, minute=0, second=0)
        
        # Convert to Unix timestamp (required by Google Directions API)
        departure_timestamp = int(scheduled_datetime.timestamp())
        
        print(f"   ⏰ Scheduled time: {scheduled_datetime.strftime('%Y-%m-%d %H:%M')}")
        print(f"   📍 Conditions: {conditions}")
        
        # ✅ FIX 2: Use pessimistic traffic model for rush hour/heavy traffic
        if conditions in ['Heavy Traffic', 'Rush Hour']:
            traffic_model = 'pessimistic'
        elif conditions == 'Holiday':
            traffic_model = 'optimistic'
        else:
            traffic_model = 'best_guess'
        
        # ✅ FIX 3: Call Google API with the scheduled timestamp
        route_info = self.get_route_info(
            origin_lat, origin_lng, dest_lat, dest_lng,
            mode=mode,
            departure_time=str(departure_timestamp),  # ✅ Use scheduled time!
            traffic_model=traffic_model
        )
        
        # ✅ FIX 4: Apply stronger multipliers for conditions WITHOUT traffic data
        if route_info['success'] and not route_info.get('has_traffic_data', False):
            condition_factors = {
                'Heavy Traffic': 2.0,   # ✅ Increased from 1.8
                'Rain': 1.4,           # ✅ Increased from 1.3
                'Road Work': 1.5,      # ✅ Increased from 1.4
                'Rush Hour': 1.8,      # ✅ Increased from 1.5
                'Normal': 1.0,
                'Holiday': 0.75        # ✅ Decreased from 0.8 (less traffic)
            }
            
            factor = condition_factors.get(conditions, 1.0)
            original_duration = route_info['duration_minutes']
            route_info['duration_minutes'] = original_duration * factor
            route_info['adjusted_for_conditions'] = True
            route_info['condition_multiplier'] = factor
            
            print(f"   ⚠️ No real-time traffic data, applying {factor}x multiplier")
            print(f"   ⏱️ Original: {original_duration:.1f} min → Adjusted: {route_info['duration_minutes']:.1f} min")
        elif route_info.get('has_traffic_data'):
            print(f"   ✅ Using Google's real-time traffic data")
        
        return route_info


# ============================================================================
# TASK DURATION PREDICTOR (UPDATED TO PASS DATE)
# ============================================================================

class TaskDurationPredictor:
    """Enhanced predictor using Google Directions API and ML model"""
    
    def __init__(self, google_api_key: str):
        self.directions_service = GoogleDirectionsService(google_api_key)
        
        # Model components
        self.xgb_model = None
        self.selected_features = None
        self.label_encoders = None
        self.employee_stats = None
        self.city_stats = None
        self.condition_stats = None
        self.method_stats = None
        
    def load_models(self, model_dir: str = './app/ml_models'):
        """Load trained models and lookup tables"""
        print("Loading models and lookup tables...")
        
        model_dir = Path(model_dir)
        
        try:
            # Load XGBoost model
            self.xgb_model = joblib.load(model_dir / 'task_duration_model_with_location.joblib')
            
            # Load feature columns
            with open(model_dir / 'model_columns.json', 'r') as f:
                self.selected_features = json.load(f)
            
            # Load label encoders
            with open(model_dir / 'label_encoders.json', 'r') as f:
                encoders_data = json.load(f)
                self.label_encoders = {
                    'city': encoders_data['city_classes'],
                    'conditions': encoders_data['conditions_classes'],
                    'method': encoders_data['method_classes'],
                    'distance': encoders_data['distance_classes']
                }
            
            # Load lookup tables
            self.employee_stats = pd.read_csv(model_dir / 'employee_stats.csv')
            self.city_stats = pd.read_csv(model_dir / 'city_stats.csv')
            self.condition_stats = pd.read_csv(model_dir / 'condition_stats.csv')
            self.method_stats = pd.read_csv(model_dir / 'method_stats.csv')
            
            print("✅ All models and data loaded successfully")
            return True
            
        except Exception as e:
            print(f"Error loading models: {e}")
            return False
    
    def predict(
        self, 
        participant_id: str, 
        city: str, 
        conditions: str, 
        method: str, 
        hour: int, 
        day_of_week: int, 
        date, 
        employee_lat: float, 
        employee_lng: float, 
        task_lat: float, 
        task_lng: float
    ) -> Dict:
        """
        Predict task duration using Google Directions API and ML model
        
        Returns complete prediction breakdown including travel time
        """
        
        if isinstance(date, str):
            date_obj = pd.to_datetime(date)
            date_str = date
        else:
            date_obj = date
            date_str = date.strftime('%Y-%m-%d')
        
        # ============================================================
        # STEP 1: Get real-time route info from Google Directions API
        # ============================================================
        print(f"\n🗺️  Fetching route from Google Directions API...")
        route_info = self.directions_service.get_route_with_conditions(
            employee_lat, employee_lng, task_lat, task_lng,
            method, conditions, hour, day_of_week,
            date_str=date_str  # ✅ Pass the date string!
        )
        
        distance_km = route_info['distance_km']
        travel_time_min = route_info['duration_minutes']
        
        print(f"   Distance: {distance_km} km")
        print(f"   Travel Time: {travel_time_min:.1f} minutes")
        if route_info.get('has_traffic_data'):
            print(f"   ✅ Using real-time traffic data")
        
        # ============================================================
        # STEP 2: Get employee historical performance
        # ============================================================
        emp_data = self.employee_stats[
            self.employee_stats['ParticipantID'] == participant_id
        ]
        
        if len(emp_data) == 0:
            # New employee - use averages
            emp_avg_duration = self.employee_stats['Employee_AvgDuration'].mean()
            emp_std_duration = self.employee_stats['Employee_StdDuration'].mean()
            emp_median_duration = self.employee_stats['Employee_MedianDuration'].mean()
            emp_success_rate = self.employee_stats['Employee_SuccessRate'].mean()
            emp_avg_errors = self.employee_stats['Employee_AvgErrors'].mean()
            emp_avg_reliability = self.employee_stats['Employee_AvgReliability'].mean()
            emp_avg_distance = self.employee_stats['Employee_AvgDistance'].mean()
            emp_avg_travel_time = self.employee_stats['Employee_AvgTravelTime'].mean()
        else:
            emp_avg_duration = emp_data['Employee_AvgDuration'].values[0]
            emp_std_duration = emp_data['Employee_StdDuration'].values[0]
            emp_median_duration = emp_data['Employee_MedianDuration'].values[0]
            emp_success_rate = emp_data['Employee_SuccessRate'].values[0]
            emp_avg_errors = emp_data['Employee_AvgErrors'].values[0]
            emp_avg_reliability = emp_data['Employee_AvgReliability'].values[0]
            emp_avg_distance = emp_data['Employee_AvgDistance'].values[0]
            emp_avg_travel_time = emp_data['Employee_AvgTravelTime'].values[0]
        
        # ============================================================
        # STEP 3: Get city, condition, and method statistics
        # ============================================================
        city_data = self.city_stats[self.city_stats['City'] == city]
        city_avg = city_data['City_AvgDuration'].values[0] if len(city_data) > 0 else emp_avg_duration
        city_std = city_data['City_StdDuration'].values[0] if len(city_data) > 0 else emp_std_duration
        city_avg_distance = city_data['City_AvgDistance'].values[0] if len(city_data) > 0 else distance_km
        
        cond_data = self.condition_stats[self.condition_stats['Conditions'] == conditions]
        cond_impact = cond_data['Condition_ImpactFactor'].values[0] if len(cond_data) > 0 else emp_avg_duration
        cond_avg_travel = cond_data['Condition_AvgTravelTime'].values[0] if len(cond_data) > 0 else travel_time_min
        
        method_data = self.method_stats[self.method_stats['Method'] == method]
        method_avg = method_data['Method_AvgDuration'].values[0] if len(method_data) > 0 else emp_avg_duration
        method_avg_travel = method_data['Method_AvgTravelTime'].values[0] if len(method_data) > 0 else travel_time_min
        
        # ============================================================
        # STEP 4: Build feature vector
        # ============================================================
        month = date_obj.month
        is_weekend = 1 if day_of_week >= 5 else 0
        is_rush_hour = 1 if (7 <= hour <= 9) or (17 <= hour <= 19) else 0
        
        # Encode categorical variables
        city_encoded = self.label_encoders['city'].index(city) if city in self.label_encoders['city'] else 0
        conditions_encoded = self.label_encoders['conditions'].index(conditions) if conditions in self.label_encoders['conditions'] else 0
        method_encoded = self.label_encoders['method'].index(method) if method in self.label_encoders['method'] else 0
        
        # Distance category
        if distance_km <= 1:
            distance_cat = 'VeryClose'
        elif distance_km <= 3:
            distance_cat = 'Close'
        elif distance_km <= 5:
            distance_cat = 'Medium'
        elif distance_km <= 10:
            distance_cat = 'Far'
        else:
            distance_cat = 'VeryFar'
        
        distance_cat_encoded = self.label_encoders['distance'].index(distance_cat) if distance_cat in self.label_encoders['distance'] else 2
        
        # Interaction features
        method_weights = {'Drive': 1, 'Walk': 4, 'Bike': 2, 'Public Transport': 3}
        distance_method_interaction = distance_km * method_weights.get(method, 2)
        
        # Build complete feature dictionary
        features = {
            'Hour': hour,
            'DayOfWeek': day_of_week,
            'Month': month,
            'IsWeekend': is_weekend,
            'IsRushHour': is_rush_hour,
            'Employee_AvgDuration': emp_avg_duration,
            'Employee_StdDuration': emp_std_duration,
            'Employee_MedianDuration': emp_median_duration,
            'Employee_SuccessRate': emp_success_rate,
            'Employee_AvgErrors': emp_avg_errors,
            'Employee_AvgReliability': emp_avg_reliability,
            'Employee_AvgDistance': emp_avg_distance,
            'Employee_AvgTravelTime': emp_avg_travel_time,
            'Reliability_pct': emp_avg_reliability,
            'Errors': emp_avg_errors,
            'Attempts': 1,
            'DistanceToTask_km': distance_km,
            'EstimatedTravelTime_min': travel_time_min,
            'DistanceCategory_encoded': distance_cat_encoded,
            'Distance_Method_Interaction': distance_method_interaction,
            'City_encoded': city_encoded,
            'City_AvgDuration': city_avg,
            'City_StdDuration': city_std,
            'City_AvgDistance': city_avg_distance,
            'Conditions_encoded': conditions_encoded,
            'Condition_ImpactFactor': cond_impact,
            'Condition_AvgTravelTime': cond_avg_travel,
            'Method_encoded': method_encoded,
            'Method_AvgDuration': method_avg,
            'Method_AvgTravelTime': method_avg_travel,
        }
        
        # ============================================================
        # STEP 5: Make prediction with ML model
        # ============================================================
        X_pred = pd.DataFrame([features])[self.selected_features].fillna(0)
        predicted_duration = self.xgb_model.predict(X_pred)[0]
        
        # Calculate confidence interval
        confidence_lower = predicted_duration - (1.96 * emp_std_duration)
        confidence_upper = predicted_duration + (1.96 * emp_std_duration)
        
        # Ensure non-negative values
        predicted_duration = max(0, predicted_duration)
        confidence_lower = max(0, confidence_lower)
        confidence_upper = max(0, confidence_upper)
        
        # Calculate work time (total - travel)
        work_time = max(0, predicted_duration - travel_time_min)
        travel_percentage = (travel_time_min / predicted_duration * 100) if predicted_duration > 0 else 0
        
        # ============================================================
        # STEP 6: Return comprehensive prediction
        # ============================================================
        return {
            # Overall prediction
            'predicted_duration_minutes': round(predicted_duration, 2),
            'predicted_duration_hours': round(predicted_duration / 60, 2),
            'confidence_interval_lower': round(confidence_lower, 2),
            'confidence_interval_upper': round(confidence_upper, 2),
            
            # Time breakdown
            'travel_time_minutes': round(travel_time_min, 2),
            'work_time_minutes': round(work_time, 2),
            'travel_percentage': round(travel_percentage, 1),
            
            # Route information
            'distance_km': distance_km,
            'distance_category': distance_cat,
            'route_has_traffic_data': route_info.get('has_traffic_data', False),
            'route_fallback': route_info.get('fallback', False),
            'condition_multiplier_applied': route_info.get('condition_multiplier', 1.0),
            
            # Employee KPI
            'employee_avg_duration': round(emp_avg_duration, 2),
            'employee_reliability': round(emp_avg_reliability, 2),
            'employee_success_rate': round(emp_success_rate * 100, 1),
            
            # Context
            'condition_impact': conditions,
            'method': method,
            'prophet_baseline': round(emp_avg_duration, 2),
            
            # Google Directions data (if successful)
            'google_route_details': {
                'start_address': route_info.get('start_address', 'N/A'),
                'end_address': route_info.get('end_address', 'N/A'),
                'duration_text': route_info.get('duration_text', f"{travel_time_min:.0f} mins"),
                'polyline': route_info.get('polyline', ''),
                'steps_count': route_info.get('steps_count', 0)
            } if route_info.get('success') else None
        }