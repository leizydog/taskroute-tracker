"""
TaskRoute: Multi-Destination Task Duration Predictor (FIXED FOR RUSH HOUR)
File: backend/app/services/multi_destination_predictor.py
"""

from typing import List, Dict
from datetime import datetime, timedelta
import traceback


class MultiDestinationPredictor:
    """Handles predictions for tasks with multiple destination stops"""
    
    def __init__(self, single_predictor):
        """
        Initialize with the existing TaskDurationPredictor
        
        Args:
            single_predictor: Instance of TaskDurationPredictor
        """
        self.predictor = single_predictor
    
    def predict_multi_destination(
        self,
        participant_id: str,
        destinations: List[Dict],
        employee_lat: float,
        employee_lng: float,
        city: str,
        conditions: str,
        method: str,
        start_hour: int,
        start_day_of_week: int,
        start_date: str
    ) -> Dict:
        """
        Predict TRAVEL duration for a multi-destination route
        ✅ Now handles impossible routes
        """
        
        try:
            if not destinations or len(destinations) < 2:
                raise ValueError("Multi-destination tasks require at least 2 destinations")
            
            # Validate inputs
            if not isinstance(employee_lat, (int, float)) or not isinstance(employee_lng, (int, float)):
                raise ValueError(f"Invalid employee coordinates: ({employee_lat}, {employee_lng})")
            
            # Sort destinations by sequence
            destinations = sorted(destinations, key=lambda x: x.get('sequence', 0))
            
            # Initialize tracking
            legs = []
            total_distance_km = 0
            total_travel_time_min = 0
            impossible_legs = []  # ✅ NEW: Track impossible legs
            
            current_lat = employee_lat
            current_lng = employee_lng
            
            # Parse start time
            try:
                current_time = datetime.strptime(start_date, '%Y-%m-%d')
                current_time = current_time.replace(hour=start_hour)
            except ValueError as e:
                print(f"⚠️ Invalid date format: {start_date}, using today")
                current_time = datetime.now().replace(hour=start_hour)
            
            print(f"\n🗺️  Calculating multi-destination route with {len(destinations)} stops...")
            print(f"   Start: ({current_lat:.4f}, {current_lng:.4f}) at {current_time.strftime('%Y-%m-%d %H:%M')}")
            print(f"   Conditions: {conditions}")
            
            # Calculate each leg of the journey
            for i, dest in enumerate(destinations):
                try:
                    dest_lat = float(dest['latitude'])
                    dest_lng = float(dest['longitude'])
                    dest_name = dest.get('location_name', f'Stop {i+1}')
                    
                    # Determine current hour (accounting for elapsed time)
                    current_hour = current_time.hour
                    current_day_of_week = current_time.weekday()
                    current_date_str = current_time.strftime('%Y-%m-%d')
                    
                    print(f"\n   Leg {i+1}: {dest_name}")
                    print(f"   From: ({current_lat:.4f}, {current_lng:.4f})")
                    print(f"   To: ({dest_lat:.4f}, {dest_lng:.4f})")
                    print(f"   Departure: {current_time.strftime('%H:%M')}")
                    
                    # Get route info
                    route_info = self.predictor.directions_service.get_route_with_conditions(
                        origin_lat=current_lat,
                        origin_lng=current_lng,
                        dest_lat=dest_lat,
                        dest_lng=dest_lng,
                        method=method,
                        conditions=conditions,
                        hour=current_hour,
                        day_of_week=current_day_of_week,
                        date_str=current_date_str
                    )
                    
                    # ✅ NEW: Check if this leg is impossible
                    if route_info.get('impossible_route'):
                        impossible_reason = route_info.get('impossible_reason')
                        print(f"   🚫 Impossible leg: {impossible_reason}")
                        
                        impossible_legs.append({
                            'leg_number': i + 1,
                            'from_location': 'Employee Start' if i == 0 else destinations[i-1].get('location_name', f'Stop {i}'),
                            'to_location': dest_name,
                            'impossible_reason': impossible_reason
                        })
                        
                        # If any leg is impossible, entire route is impossible
                        continue
                    
                    # Extract travel details and convert to Python float
                    leg_travel_time = float(route_info.get('duration_minutes', 15))
                    leg_distance = float(route_info.get('distance_km', 1))
                    has_traffic_data = route_info.get('has_traffic_data', False)
                    
                    # Accumulate totals
                    total_distance_km += leg_distance
                    total_travel_time_min += leg_travel_time
                    
                    # Calculate arrival time at this destination
                    arrival_time = current_time + timedelta(minutes=float(leg_travel_time))
                    
                    # Store leg information
                    legs.append({
                        'leg_number': i + 1,
                        'from_location': 'Employee Start' if i == 0 else destinations[i-1].get('location_name', f'Stop {i}'),
                        'to_location': dest_name,
                        'distance_km': round(leg_distance, 2),
                        'travel_time_minutes': round(leg_travel_time, 2),
                        'departure_time': current_time.strftime('%H:%M'),
                        'arrival_time': arrival_time.strftime('%H:%M'),
                        'has_traffic_data': has_traffic_data
                    })
                    
                    # Update current position and time for next leg
                    current_lat = dest_lat
                    current_lng = dest_lng
                    current_time = arrival_time
                    
                    print(f"   ✅ Distance: {leg_distance:.1f} km, Travel: {leg_travel_time:.1f} min, Arrival: {arrival_time.strftime('%H:%M')}")
                    
                except Exception as leg_error:
                    print(f"   ❌ Error calculating leg {i+1}: {leg_error}")
                    traceback.print_exc()
                    
                    # Mark as impossible if error
                    impossible_legs.append({
                        'leg_number': i + 1,
                        'from_location': 'Employee Start' if i == 0 else destinations[i-1].get('location_name', f'Stop {i}'),
                        'to_location': dest.get('location_name', f'Stop {i+1}'),
                        'impossible_reason': f"Error: {str(leg_error)}"
                    })
            
            # ✅ NEW: If any legs are impossible, return error
            if impossible_legs:
                print(f"\n🚫 Multi-destination route has {len(impossible_legs)} impossible leg(s)")
                
                return {
                    'error': True,
                    'impossible_route': True,
                    'impossible_reason': f"{len(impossible_legs)} of {len(destinations)} legs cannot be completed by car",
                    'impossible_legs': impossible_legs,
                    'total_destinations': len(destinations),
                    'impossible_count': len(impossible_legs),
                    'message': 'Multi-destination route includes unreachable locations',
                    'suggestion': 'Some destinations may require ferry, flight, or are in different countries'
                }
            
            # Calculate totals (only travel time, no work time)
            total_duration_min = total_travel_time_min
            
            # Get employee KPI for confidence interval
            try:
                emp_stats = self.predictor.employee_stats[
                    self.predictor.employee_stats['ParticipantID'] == participant_id
                ]
                
                if len(emp_stats) > 0:
                    emp_std = float(emp_stats['Employee_StdDuration'].values[0])
                    emp_reliability = float(emp_stats['Employee_AvgReliability'].values[0])
                    emp_success_rate = float(emp_stats['Employee_SuccessRate'].values[0])
                else:
                    # Use global averages
                    emp_std = float(self.predictor.employee_stats['Employee_StdDuration'].mean())
                    emp_reliability = float(self.predictor.employee_stats['Employee_AvgReliability'].mean())
                    emp_success_rate = float(self.predictor.employee_stats['Employee_SuccessRate'].mean())
            except Exception as kpi_error:
                print(f"⚠️ Could not load employee KPI: {kpi_error}")
                emp_std = 10.0
                emp_reliability = 0.85
                emp_success_rate = 0.90
            
            # Calculate confidence interval (wider for multi-destination due to uncertainty)
            confidence_margin = 1.96 * emp_std * len(destinations)
            confidence_lower = max(0, total_duration_min - confidence_margin)
            confidence_upper = total_duration_min + confidence_margin
            
            # Estimated completion time
            try:
                start_time = datetime.strptime(start_date, '%Y-%m-%d').replace(hour=start_hour)
            except:
                start_time = datetime.now().replace(hour=start_hour)
            end_time = start_time + timedelta(minutes=float(total_duration_min))
            
            print(f"\n✅ Multi-destination route calculated!")
            print(f"   Total Distance: {total_distance_km:.2f} km")
            print(f"   Total Travel Time: {total_travel_time_min:.1f} min ({total_travel_time_min/60:.1f} hours)")
            print(f"   Departure: {start_time.strftime('%H:%M')}")
            print(f"   Arrival at final stop: {end_time.strftime('%H:%M')}")
            
            return {
                # Overall summary
                'predicted_duration_minutes': round(total_duration_min, 2),
                'predicted_duration_hours': round(total_duration_min / 60, 2),
                'confidence_interval_lower': round(confidence_lower, 2),
                'confidence_interval_upper': round(confidence_upper, 2),
                
                # Travel breakdown (no work time)
                'total_travel_time_minutes': round(total_travel_time_min, 2),
                'total_work_time_minutes': 0,
                'travel_percentage': 100.0,
                
                # Route information
                'total_distance_km': round(total_distance_km, 2),
                'number_of_stops': len(destinations),
                'number_of_legs': len(legs),
                
                # Employee KPI
                'employee_reliability': round(emp_reliability, 2),
                'employee_success_rate': round(emp_success_rate * 100, 1),
                
                # Timing
                'estimated_start_time': start_time.strftime('%Y-%m-%d %H:%M'),
                'estimated_completion_time': end_time.strftime('%Y-%m-%d %H:%M'),
                
                # Detailed leg breakdown
                'legs': legs,
                
                # Context
                'condition_impact': conditions,
                'method': method,
                'city': city,
                
                # Metadata
                'is_multi_destination': True,
                'prediction_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ Fatal error in multi-destination prediction: {e}")
            traceback.print_exc()
            
            # Return error response
            return {
                'error': True,
                'impossible_route': False,
                'message': f'Prediction failed: {str(e)}',
                'fallback': True
            }

    def optimize_route_order(
        self,
        participant_id: str,
        destinations: List[Dict],
        employee_lat: float,
        employee_lng: float,
        city: str,
        conditions: str,
        method: str,
        start_hour: int,
        start_day_of_week: int,
        start_date: str
    ) -> Dict:
        """
        Find optimal order of destinations to minimize total TRAVEL time
        Uses greedy nearest-neighbor algorithm
        """
        
        try:
            if len(destinations) < 3:
                return {
                    'optimized': False,
                    'reason': 'Optimization not beneficial for less than 3 stops',
                    'original_order': destinations
                }
            
            print(f"\n🔄 Optimizing route order for {len(destinations)} destinations...")
            
            # Get prediction for original order
            original_prediction = self.predict_multi_destination(
                participant_id, destinations, employee_lat, employee_lng,
                city, conditions, method, start_hour, start_day_of_week, start_date
            )
            
            # Try greedy nearest-neighbor optimization
            unvisited = destinations.copy()
            optimized_order = []
            current_lat = employee_lat
            current_lng = employee_lng
            
            while unvisited:
                # Find nearest destination
                nearest = min(
                    unvisited,
                    key=lambda d: self.predictor.directions_service._fallback_calculation(
                        current_lat, current_lng,
                        float(d['latitude']), float(d['longitude']),
                        method
                    )['distance_km']
                )
                
                optimized_order.append(nearest)
                unvisited.remove(nearest)
                current_lat = float(nearest['latitude'])
                current_lng = float(nearest['longitude'])
            
            # Update sequences
            for i, dest in enumerate(optimized_order):
                dest['sequence'] = i + 1
            
            # Get prediction for optimized order
            optimized_prediction = self.predict_multi_destination(
                participant_id, optimized_order, employee_lat, employee_lng,
                city, conditions, method, start_hour, start_day_of_week, start_date
            )
            
            time_saved = original_prediction['predicted_duration_minutes'] - optimized_prediction['predicted_duration_minutes']
            
            print(f"\n{'✅' if time_saved > 0 else 'ℹ️'} Optimization result:")
            print(f"   Original travel time: {original_prediction['predicted_duration_minutes']:.1f} min")
            print(f"   Optimized travel time: {optimized_prediction['predicted_duration_minutes']:.1f} min")
            print(f"   Time saved: {time_saved:.1f} min ({time_saved/60:.1f} hours)")
            
            return {
                'optimized': True,
                'time_saved_minutes': round(time_saved, 2),
                'improvement_percentage': round((time_saved / original_prediction['predicted_duration_minutes'] * 100), 1) if original_prediction['predicted_duration_minutes'] > 0 else 0,
                'original_prediction': original_prediction,
                'optimized_prediction': optimized_prediction,
                'optimized_destinations': optimized_order,
                'should_use_optimized': time_saved > 5  # Only recommend if saves > 5 minutes
            }
            
        except Exception as e:
            print(f"❌ Error in route optimization: {e}")
            traceback.print_exc()
            return {
                'optimized': False,
                'error': str(e),
                'reason': 'Optimization failed',
                'original_order': destinations
            }