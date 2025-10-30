#!/usr/bin/env python3
"""
Seed data script for task management system
Usage: python seed_data.py [--base-url http://localhost:8000]
"""

import requests
import json
import argparse
from typing import Dict, Any

# Base URL for API
DEFAULT_BASE_URL = "http://localhost:8000"

def print_status(message: str, status: str = "INFO"):
    """Print colored status messages"""
    colors = {
        "INFO": "\033[94m",
        "SUCCESS": "\033[92m",
        "ERROR": "\033[91m",
        "WARNING": "\033[93m",
        "DEBUG": "\033[95m"
    }
    print(f"{colors.get(status, '')}{status}: {message}\033[0m")

def login_user(base_url: str, email: str, password: str) -> str:
    """Login and return access token"""
    try:
        # Try JSON login with email
        response = requests.post(
            f"{base_url}/api/v1/auth/login-json",
            json={
                "email": email,
                "password": password
            }
        )
        
        if response.status_code == 200:
            token_data = response.json()
            return token_data.get("access_token")
        
        print_status(f"Login failed for {email}: {response.status_code} - {response.text}", "DEBUG")
        return None
        
    except Exception as e:
        print_status(f"Login exception for {email}: {str(e)}", "DEBUG")
        return None

def create_admin_user(base_url: str) -> tuple:
    """Create admin user and return (token, user_id)"""
    admin_data = {
        "email": "admin@company.com",
        "username": "admin_user",
        "full_name": "Maria Santos",
        "password": "Admin123!",
        "role": "admin"
    }
    
    try:
        # Try to register admin
        response = requests.post(
            f"{base_url}/api/v1/auth/register",
            json=admin_data
        )
        
        print_status(f"Admin registration response: {response.status_code}", "DEBUG")
        
        if response.status_code not in [200, 201]:
            # Maybe admin already exists, try to login
            print_status(f"Admin registration failed, trying to login...", "DEBUG")
        
        # Login to get token
        token = login_user(base_url, admin_data["email"], admin_data["password"])
        
        if not token:
            print_status("Failed to get admin token", "ERROR")
            return None, None
        
        # Get user info
        headers = {"Authorization": f"Bearer {token}"}
        me_response = requests.get(f"{base_url}/api/v1/auth/me", headers=headers)
        
        if me_response.status_code == 200:
            user_info = me_response.json()
            user_id = user_info.get("id")
            print_status(f"Admin user ready: {admin_data['username']} (ID: {user_id})", "SUCCESS")
            return token, user_id
        else:
            print_status(f"Failed to get admin info: {me_response.text}", "ERROR")
            return None, None
            
    except Exception as e:
        print_status(f"Error with admin user: {str(e)}", "ERROR")
        return None, None

def create_users(base_url: str, admin_token: str) -> tuple:
    """Create users and return mapping of old_id -> (new_id, token)"""
    users_data = [
        # Skip supervisors for now - just create regular users
        # {
        #     "old_id": 2,
        #     "email": "supervisor1@company.com",
        #     "username": "supervisor_juan",
        #     "full_name": "Juan Dela Cruz",
        #     "password": "Super123!",
        #     "role": "supervisor"
        # },
        # {
        #     "old_id": 3,
        #     "email": "supervisor2@company.com",
        #     "username": "supervisor_ana",
        #     "full_name": "Ana Reyes",
        #     "password": "Super123!",
        #     "role": "supervisor"
        # },
        {
            "old_id": 4,
            "email": "user1@company.com",
            "username": "field_worker_pedro",
            "full_name": "Pedro Garcia",
            "password": "User123!",
            "role": "user"
        },
        {
            "old_id": 5,
            "email": "user2@company.com",
            "username": "field_worker_lisa",
            "full_name": "Lisa Mendoza",
            "password": "User123!",
            "role": "user"
        },
        {
            "old_id": 6,
            "email": "user3@company.com",
            "username": "field_worker_carlo",
            "full_name": "Carlo Ramos",
            "password": "User123!",
            "role": "user"
        },
        {
            "old_id": 7,
            "email": "user4@company.com",
            "username": "field_worker_nina",
            "full_name": "Nina Torres",
            "password": "User123!",
            "role": "user"
        }
    ]
    
    user_tokens = {}
    user_ids = {}
    
    for user in users_data:
        try:
            old_id = user.pop("old_id")
            
            # All users register as regular users
            response = requests.post(
                f"{base_url}/api/v1/auth/register",
                json=user
            )
            
            print_status(f"Registration response for {user['username']}: {response.status_code}", "DEBUG")
            
            # Login to get token
            token = login_user(base_url, user["email"], user["password"])
            
            if token:
                # Get user info to get actual ID
                headers = {"Authorization": f"Bearer {token}"}
                me_response = requests.get(f"{base_url}/api/v1/auth/me", headers=headers)
                
                if me_response.status_code == 200:
                    user_info = me_response.json()
                    actual_id = user_info.get("id")
                    user_tokens[old_id] = token
                    user_ids[old_id] = actual_id
                    print_status(f"Created {user['role']}: {user['username']} (ID: {actual_id})", "SUCCESS")
                else:
                    print_status(f"Failed to get user info for {user['username']}", "ERROR")
            else:
                print_status(f"Failed to login {user['username']}", "ERROR")
                
        except Exception as e:
            print_status(f"Error creating user {user['username']}: {str(e)}", "ERROR")
    
    return user_tokens, user_ids

def create_tasks(base_url: str, admin_token: str, user_ids: Dict[int, int]) -> Dict[int, int]:
    """Create tasks and return mapping of old_id -> new_id"""
    tasks_data = [
        {
            "old_id": 1,
            "title": "Inspect electrical panel at Makati Office",
            "description": "Perform quarterly inspection of main electrical panel. Check for loose connections, signs of overheating, and verify proper labeling.",
            "priority": "high",
            "location_name": "Ayala Tower, Makati City",
            "latitude": 14.5547,
            "longitude": 121.0244,
            "estimated_duration": 120,
            "due_date": "2025-10-25T14:00:00.000Z",
            "assigned_to": 4
        },
        {
            "old_id": 2,
            "title": "Delivery to BGC warehouse",
            "description": "Deliver 15 boxes of office supplies to warehouse facility. Obtain signature from receiving clerk.",
            "priority": "medium",
            "location_name": "BGC Corporate Center, Taguig",
            "latitude": 14.5518,
            "longitude": 121.0475,
            "estimated_duration": 90,
            "due_date": "2025-10-24T16:00:00.000Z",
            "assigned_to": 5
        },
        {
            "old_id": 3,
            "title": "HVAC maintenance - Ortigas branch",
            "description": "Replace air filters and clean condenser coils for all units on 3rd floor.",
            "priority": "medium",
            "location_name": "Ortigas Center, Pasig City",
            "latitude": 14.5866,
            "longitude": 121.0582,
            "estimated_duration": 180,
            "due_date": "2025-10-26T10:00:00.000Z",
            "assigned_to": 6
        },
        {
            "old_id": 4,
            "title": "Emergency plumbing repair",
            "description": "Fix leaking pipe in 2nd floor restroom. Water damage reported, urgent response needed.",
            "priority": "high",
            "location_name": "Quezon City Office Building",
            "latitude": 14.6507,
            "longitude": 121.0494,
            "estimated_duration": 60,
            "due_date": "2025-10-24T12:00:00.000Z",
            "assigned_to": 4
        },
        {
            "old_id": 5,
            "title": "Install new security cameras",
            "description": "Install 4 new security cameras in parking area. Configure network connection and test recording.",
            "priority": "low",
            "location_name": "Alabang Town Center Area",
            "latitude": 14.4198,
            "longitude": 121.0395,
            "estimated_duration": 240,
            "due_date": "2025-10-28T13:00:00.000Z",
            "assigned_to": 5
        },
        {
            "old_id": 6,
            "title": "Routine equipment check - Mandaluyong",
            "description": "Monthly inspection of all fire extinguishers and emergency exits.",
            "priority": "medium",
            "location_name": "Shaw Boulevard, Mandaluyong",
            "latitude": 14.5814,
            "longitude": 121.0509,
            "estimated_duration": 90,
            "due_date": "2025-10-27T09:00:00.000Z",
            "assigned_to": 7
        },
        {
            "old_id": 7,
            "title": "Paint office reception area",
            "description": "Repaint reception area walls. Two coats required. Must be completed outside business hours.",
            "priority": "low",
            "location_name": "Manila Head Office",
            "latitude": 14.5995,
            "longitude": 120.9842,
            "estimated_duration": 300,
            "due_date": "2025-10-29T20:00:00.000Z",
            "assigned_to": 4
        },
        {
            "old_id": 8,
            "title": "Network cabling for new workstations",
            "description": "Install ethernet cabling for 8 new workstations on 5th floor.",
            "priority": "high",
            "location_name": "Eastwood City, Quezon City",
            "latitude": 14.6091,
            "longitude": 121.0780,
            "estimated_duration": 150,
            "due_date": "2025-10-25T15:00:00.000Z",
            "assigned_to": 5
        }
    ]
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    task_ids = {}
    
    for task in tasks_data:
        try:
            old_id = task.pop("old_id")
            
            # Map old assigned_to ID to new ID
            old_assigned_id = task["assigned_to"]
            if old_assigned_id in user_ids:
                task["assigned_to"] = user_ids[old_assigned_id]
            else:
                print_status(f"Warning: User ID {old_assigned_id} not found, skipping task", "WARNING")
                continue
            
            response = requests.post(
                f"{base_url}/api/v1/tasks/",
                json=task,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                task_data = response.json()
                new_task_id = task_data.get("id")
                task_ids[old_id] = new_task_id
                print_status(f"Created task: {task['title']} (ID: {new_task_id})", "SUCCESS")
            else:
                print_status(f"Failed to create task {task['title']}: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            print_status(f"Error creating task {task['title']}: {str(e)}", "ERROR")
    
    return task_ids

def start_ongoing_tasks(base_url: str, user_tokens: Dict[int, str], task_ids: Dict[int, int]):
    """
    Start some tasks to create ongoing tasks.
    Each user starts ONE task from their current location (not the task destination).
    The /start endpoint automatically creates the initial location log.
    """
    tasks_to_start = [
        # Pedro (user 4) - Electrical inspection at Makati
        # Task destination: Ayala Tower (14.5547, 121.0244)
        # Starting from San Juan area, about 4km away
        {
            "old_task_id": 1,
            "user_id": 4,
            "latitude": 14.5900,
            "longitude": 121.0380
        },
        # Lisa (user 5) - Network cabling at Eastwood
        # Task destination: Eastwood City (14.6091, 121.0780)
        # Starting from Quezon City Hall area, about 4.5km away
        {
            "old_task_id": 8,
            "user_id": 5,
            "latitude": 14.6350,
            "longitude": 121.0350
        },
        # Carlo (user 6) - HVAC maintenance at Ortigas
        # Task destination: Ortigas Center (14.5866, 121.0582)
        # Starting from Kapitolyo/Pasig area, about 3km away
        {
            "old_task_id": 3,
            "user_id": 6,
            "latitude": 14.5650,
            "longitude": 121.0650
        },
        # Nina (user 7) - Equipment check at Mandaluyong
        # Task destination: Shaw Boulevard (14.5814, 121.0509)
        # Starting from Boni Avenue area, about 2km away
        {
            "old_task_id": 6,
            "user_id": 7,
            "latitude": 14.5650,
            "longitude": 121.0350
        }
    ]
    
    for task_start in tasks_to_start:
        try:
            old_task_id = task_start["old_task_id"]
            new_task_id = task_ids.get(old_task_id)
            user_id = task_start["user_id"]
            token = user_tokens.get(user_id)
            
            if not new_task_id:
                print_status(f"Task ID {old_task_id} not found, skipping start", "WARNING")
                continue
                
            if not token:
                print_status(f"Token for user {user_id} not found, skipping start", "WARNING")
                continue
            
            headers = {"Authorization": f"Bearer {token}"}
            
            # Start task
            start_response = requests.post(
                f"{base_url}/api/v1/tasks/{new_task_id}/start",
                json={
                    "latitude": task_start["latitude"],
                    "longitude": task_start["longitude"]
                },
                headers=headers
            )
            
            if start_response.status_code in [200, 201]:
                print_status(f"Started task ID {new_task_id} for user {user_id}", "SUCCESS")
            else:
                print_status(f"Failed to start task {new_task_id}: {start_response.status_code} - {start_response.text}", "ERROR")
        except Exception as e:
            print_status(f"Error starting task: {str(e)}", "ERROR")

def create_locations(base_url: str, user_tokens: Dict[int, str], task_ids: Dict[int, int]):
    """
    Create additional location logs (simulating GPS tracking updates as users move).
    These represent the user's position updates as they work on tasks.
    IMPORTANT: Timestamps must be AFTER the task start time so they appear as the latest location.
    """
    from datetime import datetime, timedelta, timezone
    
    # Generate timestamps that are recent (current time + offsets)
    now = datetime.now(timezone.utc)
    
    locations_data = [
        # Pedro - Task 1 (Electrical inspection) - Moving from San Juan to Makati
        {
            "old_task_id": 1,
            "user_id": 4,
            "latitude": 14.5750,
            "longitude": 14.5750,
            "accuracy": 5.2,
            "altitude": 42.0,
            "speed": 8.5,
            "address": "N. Domingo Street, San Juan City",
            "notes": "En route to Makati, passing through EDSA",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=30)).isoformat()
        },
        {
            "old_task_id": 1,
            "user_id": 4,
            "latitude": 14.5600,
            "longitude": 121.0280,
            "accuracy": 4.0,
            "altitude": 44.5,
            "speed": 3.5,
            "address": "Approaching Makati via Guadalupe",
            "notes": "Almost at destination, 10 minutes away",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=10)).isoformat()
        },
        {
            "old_task_id": 1,
            "user_id": 4,
            "latitude": 14.5545,
            "longitude": 121.0243,
            "accuracy": 3.2,
            "altitude": 45.8,
            "speed": 0.5,
            "address": "Ayala Tower entrance, Makati City",
            "notes": "Arrived at building, checking in with security",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=2)).isoformat()
        },
        # Lisa - Task 8 (Network cabling) - Moving from QC to Eastwood
        {
            "old_task_id": 8,
            "user_id": 5,
            "latitude": 14.6280,
            "longitude": 121.0420,
            "accuracy": 6.0,
            "altitude": 18.0,
            "speed": 12.0,
            "address": "Quezon Avenue, Quezon City",
            "notes": "Heading to Eastwood via Commonwealth",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=28)).isoformat()
        },
        {
            "old_task_id": 8,
            "user_id": 5,
            "latitude": 14.6180,
            "longitude": 121.0650,
            "accuracy": 5.5,
            "altitude": 20.0,
            "speed": 8.0,
            "address": "Near Eastwood City, Libis",
            "notes": "Almost there, 5 minutes out",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=12)).isoformat()
        },
        {
            "old_task_id": 8,
            "user_id": 5,
            "latitude": 14.6091,
            "longitude": 121.0780,
            "accuracy": 4.2,
            "altitude": 22.3,
            "speed": 0.0,
            "address": "Eastwood City Corporate Center, 5th Floor",
            "notes": "Arrived, setting up equipment for cabling",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=3)).isoformat()
        },
        # Carlo - Task 3 (HVAC maintenance) - Moving from Kapitolyo to Ortigas
        {
            "old_task_id": 3,
            "user_id": 6,
            "latitude": 14.5680,
            "longitude": 121.0620,
            "accuracy": 6.8,
            "altitude": 15.0,
            "speed": 5.5,
            "address": "Kapitolyo, Pasig City",
            "notes": "Left warehouse, heading to Ortigas site",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=25)).isoformat()
        },
        {
            "old_task_id": 3,
            "user_id": 6,
            "latitude": 14.5780,
            "longitude": 121.0600,
            "accuracy": 5.5,
            "altitude": 16.5,
            "speed": 2.5,
            "address": "Near Ortigas Center, looking for parking",
            "notes": "Arrived at area, finding parking spot",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=8)).isoformat()
        },
        {
            "old_task_id": 3,
            "user_id": 6,
            "latitude": 14.5866,
            "longitude": 121.0582,
            "accuracy": 5.8,
            "altitude": 18.2,
            "speed": 0.0,
            "address": "Ortigas Center Building, 3rd Floor",
            "notes": "Starting HVAC inspection, first unit",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=2)).isoformat()
        },
        # Nina - Task 6 (Equipment check) - Moving through Mandaluyong
        {
            "old_task_id": 6,
            "user_id": 7,
            "latitude": 14.5680,
            "longitude": 121.0380,
            "accuracy": 5.8,
            "altitude": 12.0,
            "speed": 4.0,
            "address": "Boni Avenue, Mandaluyong",
            "notes": "En route from previous site",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=18)).isoformat()
        },
        {
            "old_task_id": 6,
            "user_id": 7,
            "latitude": 14.5750,
            "longitude": 121.0450,
            "accuracy": 5.0,
            "altitude": 14.0,
            "speed": 1.5,
            "address": "Shaw Boulevard, approaching building",
            "notes": "Almost at inspection site",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=8)).isoformat()
        },
        {
            "old_task_id": 6,
            "user_id": 7,
            "latitude": 14.5814,
            "longitude": 121.0509,
            "accuracy": 4.5,
            "altitude": 15.8,
            "speed": 0.0,
            "address": "Shaw Boulevard Building, 3rd Floor",
            "notes": "Conducting equipment inspection, 2nd floor complete",
            "location_type": "auto",
            "recorded_at": (now - timedelta(minutes=1)).isoformat()
        }
    ]
    
    for location in locations_data:
        try:
            old_task_id = location.pop("old_task_id")
            user_id = location.pop("user_id")
            new_task_id = task_ids.get(old_task_id)
            token = user_tokens.get(user_id)
            
            if not new_task_id:
                print_status(f"Task ID {old_task_id} not found, skipping location", "WARNING")
                continue
                
            if not token:
                print_status(f"Token for user {user_id} not found, skipping location", "WARNING")
                continue
            
            location["task_id"] = new_task_id
            headers = {"Authorization": f"Bearer {token}"}
            
            response = requests.post(
                f"{base_url}/api/v1/locations/",
                json=location,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                print_status(f"Created location log for task {new_task_id}", "SUCCESS")
            else:
                print_status(f"Failed to create location: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            print_status(f"Error creating location: {str(e)}", "ERROR")

def main():
    parser = argparse.ArgumentParser(description="Seed database with initial data")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Base URL for API")
    parser.add_argument("--debug", action="store_true", help="Enable debug output")
    args = parser.parse_args()
    
    base_url = args.base_url.rstrip("/")
    
    print_status(f"Starting seed process for {base_url}...", "INFO")
    print()
    
    # Step 1: Create/Login admin user
    print_status("Setting up admin user...", "INFO")
    admin_token, admin_id = create_admin_user(base_url)
    
    if not admin_token:
        print_status("Failed to setup admin user. Cannot continue.", "ERROR")
        return
    
    # Store admin in the mappings
    user_tokens = {1: admin_token}
    user_ids = {1: admin_id}
    print()
    
    # Step 2: Create other users
    print_status("Creating other users...", "INFO")
    other_tokens, other_ids = create_users(base_url, admin_token)
    user_tokens.update(other_tokens)
    user_ids.update(other_ids)
    print()
    
    # Step 3: Create tasks
    print_status("Creating tasks...", "INFO")
    task_ids = create_tasks(base_url, admin_token, user_ids)
    print()
    
    # Step 4: Start some tasks (creates initial location logs automatically)
    print_status("Starting ongoing tasks...", "INFO")
    start_ongoing_tasks(base_url, user_tokens, task_ids)
    print()
    
    # Step 5: Create additional location logs (GPS tracking updates)
    print_status("Creating location tracking updates...", "INFO")
    create_locations(base_url, user_tokens, task_ids)
    print()
    
    print_status("Seed process completed!", "SUCCESS")
    print()
    print_status("Summary:", "INFO")
    print("  - 4 ongoing tasks with live GPS tracking:")
    print("    • Pedro: Electrical inspection at Makati (almost at destination)")
    print("    • Lisa: Network cabling at Eastwood (actively working)")
    print("    • Carlo: HVAC maintenance at Ortigas (in progress)")
    print("    • Nina: Equipment check at Mandaluyong (final inspection)")
    print("  - 4 pending tasks (not yet started)")
    print()
    print_status("Login credentials:", "INFO")
    print("  Admin: admin_user / Admin123!")
    print("  Supervisor 1: supervisor_juan / Super123!")
    print("  Supervisor 2: supervisor_ana / Super123!")
    print("  User 1 (Pedro): field_worker_pedro / User123!")
    print("  User 2 (Lisa): field_worker_lisa / User123!")
    print("  User 3 (Carlo): field_worker_carlo / User123!")
    print("  User 4 (Nina): field_worker_nina / User123!")
    print()
    print_status("Test the live tracking:", "INFO")
    print(f"  - Visit the Supervisor Dashboard")
    print(f"  - Check 'Live Employee Tracking' section")
    print(f"  - You should see 4 employees with different locations on the map")

if __name__ == "__main__":
    main()