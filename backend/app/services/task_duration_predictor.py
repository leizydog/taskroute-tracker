"""
TaskRoute: Task Duration Predictor with Google Directions API Integration (FIXED FOR SHORT DISTANCES)
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
from typing import Dict, Optional, List, Tuple


# ============================================================================
# GOOGLE DIRECTIONS API SERVICE (FIXED FOR RUSH HOUR & IMPOSSIBLE ROUTES)
# ============================================================================

class GoogleDirectionsService:
    """Service for getting real-time route data from Google Directions API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://maps.googleapis.com/maps/api/directions/json"

    def _is_route_impossible(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        status: str,
        error_message: str = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Detect if a route is impossible (different countries, islands, etc.)
        
        Returns:
            (is_impossible, reason)
        """
        
        # Check 1: Google API explicitly says no route
        if status == 'ZERO_RESULTS':
            return True, "No driving route available between these locations"
        
        # Check 2: Different countries (simple lat/lng bounds check)
        # Philippines bounds: roughly 4.5°N to 21°N, 116°E to 127°E
        philippines_bounds = {
            'lat_min': 4.5,
            'lat_max': 21.0,
            'lng_min': 116.0,
            'lng_max': 127.0
        }
        
        origin_in_ph = (
            philippines_bounds['lat_min'] <= origin_lat <= philippines_bounds['lat_max'] and
            philippines_bounds['lng_min'] <= origin_lng <= philippines_bounds['lng_max']
        )
        
        dest_in_ph = (
            philippines_bounds['lat_min'] <= dest_lat <= philippines_bounds['lat_max'] and
            philippines_bounds['lng_min'] <= dest_lng <= philippines_bounds['lng_max']
        )
        
        if origin_in_ph and not dest_in_ph:
            return True, "Destination is outside the Philippines - no driving route available"
        
        if not origin_in_ph and dest_in_ph:
            return True, "Starting location is outside the Philippines - no driving route available"
        
        if not origin_in_ph and not dest_in_ph:
            return True, "Both locations are outside the Philippines"
        
        # Check 3: Extreme distance (>500km in a straight line likely means different islands)
        straight_distance = geodesic((origin_lat, origin_lng), (dest_lat, dest_lng)).km
        if straight_distance > 500:
            return True, f"Locations are {straight_distance:.0f}km apart (likely different islands) - no driving route available"
        
        # Check 4: Specific Google API error messages
        if error_message:
            impossible_keywords = [
                'cannot be reached',
                'not accessible by',
                'no route',
                'different countries',
                'ferry',
                'body of water'
            ]
            
            error_lower = error_message.lower()
            for keyword in impossible_keywords:
                if keyword in error_lower:
                    return True, f"Route impossible: {error_message}"
        
        return False, None
    
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
        """
        
        # Validate coordinates
        if not (-90 <= origin_lat <= 90) or not (-180 <= origin_lng <= 180):
            print(f"❌ Invalid origin coordinates: ({origin_lat}, {origin_lng})")
            return self._fallback_calculation(origin_lat, origin_lng, dest_lat, dest_lng, mode)
        
        if not (-90 <= dest_lat <= 90) or not (-180 <= dest_lng <= 180):
            print(f"❌ Invalid destination coordinates: ({dest_lat}, {dest_lng})")
            return self._fallback_calculation(origin_lat, origin_lng, dest_lat, dest_lng, mode)
        
        params = {
            'origin': f"{origin_lat},{origin_lng}",
            'destination': f"{dest_lat},{dest_lng}",
            'mode': mode,
            'key': self.api_key,
        }
        
        # Only add departure_time and traffic_model for driving mode
        if mode == 'driving':
            if departure_time != 'now':
                try:
                    timestamp = int(departure_time)
                    current_timestamp = int(datetime.now().timestamp())
                    
                    # Google API only accepts timestamps within reasonable range
                    if timestamp < current_timestamp:
                        print(f"⚠️ Past timestamp detected, using 'now' instead")
                        params['departure_time'] = 'now'
                    elif timestamp > current_timestamp + (30 * 24 * 60 * 60):
                        print(f"⚠️ Timestamp too far in future, using 'now' instead")
                        params['departure_time'] = 'now'
                    else:
                        params['departure_time'] = departure_time
                except (ValueError, TypeError):
                    print(f"⚠️ Invalid timestamp format, using 'now'")
                    params['departure_time'] = 'now'
            else:
                params['departure_time'] = departure_time
            
            params['traffic_model'] = traffic_model
        
        try:
            print(f"   📡 Calling Google Directions API...")
            print(f"      Origin: ({origin_lat:.6f}, {origin_lng:.6f})")
            print(f"      Destination: ({dest_lat:.6f}, {dest_lng:.6f})")
            print(f"      Mode: {mode}")
            
            response = requests.get(self.base_url, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            # ✅ Check for impossible routes FIRST
            is_impossible, impossible_reason = self._is_route_impossible(
                origin_lat, origin_lng, dest_lat, dest_lng,
                data['status'],
                data.get('error_message')
            )
            
            if is_impossible:
                print(f"   🚫 Route Impossible: {impossible_reason}")
                return {
                    'success': False,
                    'impossible_route': True,
                    'impossible_reason': impossible_reason,
                    'distance_km': None,
                    'duration_minutes': None,
                    'fallback': False
                }
            
            if data['status'] == 'OK':
                route = data['routes'][0]
                leg = route['legs'][0]
                
                distance_meters = leg['distance']['value']
                distance_km = distance_meters / 1000
                
                # Duration in traffic (if available) or regular duration
                if 'duration_in_traffic' in leg:
                    duration_seconds = leg['duration_in_traffic']['value']
                    duration_text = leg['duration_in_traffic']['text']
                    has_traffic = True
                else:
                    duration_seconds = leg['duration']['value']
                    duration_text = leg['duration']['text']
                    has_traffic = False
                
                duration_minutes = duration_seconds / 60
                
                # ✅ Check for ferry/water crossing (informational warning)
                involves_ferry = False
                ferry_steps = []
                
                for step in leg['steps']:
                    travel_mode = step.get('travel_mode', '')
                    instructions = step.get('html_instructions', '').lower()
                    
                    if travel_mode == 'FERRY' or 'ferry' in instructions:
                        involves_ferry = True
                        ferry_steps.append({
                            'instructions': step.get('html_instructions', 'Ferry crossing'),
                            'distance': step['distance']['text'],
                            'duration': step['duration']['text']
                        })
            
                print(f"   ✅ Google API Success:")
                print(f"      Distance: {distance_km:.1f} km")
                print(f"      Duration: {duration_minutes:.1f} min")
                print(f"      Traffic data: {has_traffic}")
                
                if involves_ferry:
                    print(f"      ⛴️  Route includes ferry crossing(s): {len(ferry_steps)}")
                    for i, ferry in enumerate(ferry_steps, 1):
                        print(f"          Ferry {i}: {ferry['distance']} ({ferry['duration']})")
            
                # Check if this is a very long route
                if distance_km > 300:
                    print(f"      ⚠️  Long-distance route: Consider overnight travel or multiple days")
                
                return {
                    'success': True,
                    'impossible_route': False,
                    'distance_km': round(distance_km, 2),
                    'distance_meters': distance_meters,
                    'duration_minutes': round(duration_minutes, 2),
                    'duration_seconds': duration_seconds,
                    'duration_text': duration_text,
                    'start_address': leg['start_address'],
                    'end_address': leg['end_address'],
                    'polyline': route['overview_polyline']['points'],
                    'has_traffic_data': has_traffic,
                    'steps_count': len(leg['steps']),
                    'involves_ferry': involves_ferry,  # ✅ NEW
                    'ferry_crossings': ferry_steps,    # ✅ NEW
                    'is_long_distance': distance_km > 300  # ✅ NEW
                }
            else:
                print(f"   ❌ Google Directions API error: {data['status']}")
                if 'error_message' in data:
                    print(f"      Details: {data['error_message']}")
                return self._fallback_calculation(origin_lat, origin_lng, dest_lat, dest_lng, mode)
                
        except requests.exceptions.Timeout:
            print(f"   ⏱️ Google API timeout - using fallback calculation")
            return self._fallback_calculation(origin_lat, origin_lng, dest_lat, dest_lng, mode)
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Google API request error: {e}")
            return self._fallback_calculation(origin_lat, origin_lng, dest_lat, dest_lng, mode)
        except Exception as e:
            print(f"   ❌ Unexpected error calling Google Directions API: {e}")
            import traceback
            traceback.print_exc()
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
        date_str: str = None
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
        print(f"   🌐 Conditions: {conditions}")
        
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
            departure_time=str(departure_timestamp),
            traffic_model=traffic_model
        )
        
        # ✅ FIX 4: Apply stronger multipliers for conditions WITHOUT traffic data
        if route_info['success'] and not route_info.get('has_traffic_data', False):
            condition_factors = {
                'Heavy Traffic': 2.0,
                'Rain': 1.4,
                'Road Work': 1.5,
                'Rush Hour': 1.8,
                'Normal': 1.0,
                'Holiday': 0.75
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
# TASK DURATION PREDICTOR (UPDATED TO PASS DATE AND RESPECT CITY)
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
            
    def _should_trust_travel_time(self, distance_km: float, travel_time_min: float, predicted_duration: float) -> bool:
        """
        Determine if we should trust Google Maps/Physics over the ML model
        
        Returns True if:
        - Distance is very short (< 0.3 km)
        - Distance is extreme (> 100 km)
        - ML Prediction is significantly higher than Travel Time (Hallucination)
        - Travel time is significantly higher than prediction
        """
        
        # ✅ FIX 1: "At Location" Override
        # If distance is less than 300 meters (0.3km), the ML model is useless.
        # Trust the physical proximity.
        if distance_km < 0.3:
            print(f"   ⚠️ User is effectively at location ({distance_km*1000:.0f}m) - Ignoring ML model")
            return True

        # Case 1: Extreme distance (inter-city or inter-province travel)
        if distance_km > 100:
            print(f"   ⚠️ Extreme distance detected ({distance_km:.1f} km) - prioritizing travel time")
            return True
        
        # ✅ FIX 2: "Hallucination Check"
        # If the ML model predicts 36 mins, but Google says 1 min, the model is wrong.
        # Logic: If Prediction is > 5x the Travel Time (and travel time is significant)
        if travel_time_min > 1 and predicted_duration > (travel_time_min * 5):
            print(f"   ⚠️ ML Prediction ({predicted_duration:.1f}m) is suspiciously high vs Travel ({travel_time_min:.1f}m) - Trusting Travel")
            return True
            
        # Case 3: Travel time is more than 3x the predicted duration
        if travel_time_min > predicted_duration * 3:
            print(f"   ⚠️ Travel time ({travel_time_min:.1f} min) >> Predicted duration ({predicted_duration:.1f} min)")
            return True
        
        # Case 4: Prediction is less than 80% of travel time (physically impossible)
        if predicted_duration < travel_time_min * 0.8:
            print(f"   ⚠️ Predicted duration ({predicted_duration:.1f} min) < 80% of travel time ({travel_time_min:.1f} min)")
            return True
        
        return False
    
    def predict(
        self, 
        participant_id: str, 
        city: str,  # This should be the TASK location city
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
        """
        
        if isinstance(date, str):
            date_obj = pd.to_datetime(date)
            date_str = date
        else:
            date_obj = date
            date_str = date.strftime('%Y-%m-%d')
        
        # Log the inputs for debugging
        print(f"\n🎯 Task Duration Prediction Request:")
        print(f"   Participant: {participant_id}")
        print(f"   Employee Location: ({employee_lat:.4f}, {employee_lng:.4f})")
        print(f"   Task Location: ({task_lat:.4f}, {task_lng:.4f})")
        print(f"   Task City: {city}")  # Should reflect the TASK location
        print(f"   Conditions: {conditions}")
        print(f"   Method: {method}")
        print(f"   Scheduled: {date_str} at {hour}:00")
        
        # ============================================================
        # STEP 1: Get real-time route info from Google Directions API
        # ============================================================
        print(f"\n🗺️  Fetching route from Google Directions API...")
        route_info = self.directions_service.get_route_with_conditions(
            employee_lat, employee_lng, task_lat, task_lng,
            method, conditions, hour, day_of_week,
            date_str=date_str
        )
        
        # Check if route is impossible
        if route_info.get('impossible_route'):
            print(f"   🚫 Cannot calculate: {route_info.get('impossible_reason')}")
            
            # Return error response
            return {
                'error': True,
                'impossible_route': True,
                'impossible_reason': route_info.get('impossible_reason'),
                'message': 'Cannot calculate duration - route is not possible by car',
                'employee_location': {
                    'lat': employee_lat,
                    'lng': employee_lng
                },
                'task_location': {
                    'lat': task_lat,
                    'lng': task_lng
                },
                'suggestion': 'Please verify the task location or consider alternative transportation methods'
            }
        
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
            print(f"   ⚠️ New employee, using average statistics")
            emp_avg_duration = self.employee_stats['Employee_AvgDuration'].mean()
            emp_std_duration = self.employee_stats['Employee_StdDuration'].mean()
            emp_median_duration = self.employee_stats['Employee_MedianDuration'].mean()
            emp_success_rate = self.employee_stats['Employee_SuccessRate'].mean()
            emp_avg_errors = self.employee_stats['Employee_AvgErrors'].mean()
            emp_avg_reliability = self.employee_stats['Employee_AvgReliability'].mean()
            emp_avg_distance = self.employee_stats['Employee_AvgDistance'].mean()
            emp_avg_travel_time = self.employee_stats['Employee_AvgTravelTime'].mean()
        else:
            print(f"   ✅ Using historical data for {participant_id}")
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
        if len(city_data) > 0:
            city_avg = city_data['City_AvgDuration'].values[0]
            city_std = city_data['City_StdDuration'].values[0]
            city_avg_distance = city_data['City_AvgDistance'].values[0]
            print(f"   ✅ Using city statistics for {city}")
        else:
            # City not in training data - use employee averages
            city_avg = emp_avg_duration
            city_std = emp_std_duration
            city_avg_distance = distance_km
            print(f"   ⚠️ City '{city}' not in training data, using fallback")
        
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
        predicted_duration_raw = self.xgb_model.predict(X_pred)[0]
        
        # Apply the Logic Fix
        should_trust_physics = self._should_trust_travel_time(distance_km, travel_time_min, predicted_duration_raw)
        
        if should_trust_physics:
            # If they are basically at the location (<300m), prediction is effectively 0-2 mins
            if distance_km < 0.3:
                # Allow 2 minutes for "parking/finding door", but essentially it's just travel
                predicted_duration = travel_time_min + 2 
                used_travel_based_prediction = True
                print(f"   🎯 Short distance override applied: {predicted_duration:.1f} min")
            else:
                # Trust Google Maps Travel Time directly
                predicted_duration = travel_time_min
                used_travel_based_prediction = True
                print(f"   🔄 Trusting Google Maps duration: {predicted_duration:.1f} min")
        else:
            # Use ML prediction
            predicted_duration = predicted_duration_raw
            used_travel_based_prediction = False

        # Ensure we don't return negative numbers
        predicted_duration = max(1.0, predicted_duration) # Minimum 1 minute
        
        # Since "Duration = Travel", Work Time should ideally be 0
        # But for the breakdown, we can show the difference as "Buffer/Parking"
        work_time = max(0, predicted_duration - travel_time_min)
        
        # Calculate confidence interval
        confidence_lower = predicted_duration - (1.96 * emp_std_duration)
        confidence_upper = predicted_duration + (1.96 * emp_std_duration)
        
        # Ensure non-negative values
        predicted_duration = max(0, predicted_duration)
        confidence_lower = max(0, confidence_lower)
        confidence_upper = max(0, confidence_upper)
        
        # Recalculate travel percentage
        travel_percentage = (travel_time_min / predicted_duration * 100) if predicted_duration > 0 else 0
        
        print(f"\n✅ Prediction Complete:")
        print(f"   Total Duration: {predicted_duration:.1f} minutes ({predicted_duration/60:.1f} hours)")
        print(f"   Travel Time: {travel_time_min:.1f} minutes ({travel_time_min/60:.1f} hours)")
        print(f"   Work Time: {work_time:.1f} minutes")
        print(f"   Method: {'Travel-based' if used_travel_based_prediction else 'ML model'}")
        
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
            'used_travel_based_prediction': used_travel_based_prediction,  # ✅ NEW
            
            # Employee KPI
            'employee_avg_duration': round(emp_avg_duration, 2),
            'employee_reliability': round(emp_avg_reliability, 2),
            'employee_success_rate': round(emp_success_rate * 100, 1),
            
            # Context - ✅ Include the city in response (task location city)
            'city': city,
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