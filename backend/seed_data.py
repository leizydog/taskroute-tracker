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
        {
            "old_id": 2,
            "email": "supervisor1@company.com",
            "username": "supervisor_juan",
            "full_name": "Juan Dela Cruz",
            "password": "Super123!",
            "role": "supervisor"
        },
        {
            "old_id": 3,
            "email": "supervisor2@company.com",
            "username": "supervisor_ana",
            "full_name": "Ana Reyes",
            "password": "Super123!",
            "role": "supervisor"
        },
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
            
            # Register user based on role
            if user["role"] == "supervisor":
                headers = {"Authorization": f"Bearer {admin_token}"}
                response = requests.post(
                    f"{base_url}/api/v1/auth/supervisor",
                    json=user,
                    headers=headers
                )
            else:
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
            "assigned_to": 6
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

def complete_tasks(base_url: str, user_tokens: Dict[int, str], task_ids: Dict[int, int]):
    """Complete specific tasks"""
    completions = [
        {
            "old_task_id": 2,
            "user_id": 5,
            "completion_notes": "All 15 boxes delivered successfully. Warehouse clerk Maria confirmed receipt. No damage to items.",
            "quality_rating": 5,
            "latitude": 14.5520,
            "longitude": 121.0476
        },
        {
            "old_task_id": 4,
            "user_id": 4,
            "completion_notes": "Pipe leak fixed. Replaced corroded section with new PVC pipe. Water flow tested and verified. Area cleaned up.",
            "quality_rating": 4,
            "latitude": 14.6509,
            "longitude": 121.0495
        }
    ]
    
    for completion in completions:
        try:
            old_task_id = completion["old_task_id"]
            new_task_id = task_ids.get(old_task_id)
            user_id = completion["user_id"]
            token = user_tokens.get(user_id)
            
            if not new_task_id:
                print_status(f"Task ID {old_task_id} not found, skipping completion", "WARNING")
                continue
                
            if not token:
                print_status(f"Token for user {user_id} not found, skipping completion", "WARNING")
                continue
            
            headers = {"Authorization": f"Bearer {token}"}
            
            # Start task first (send empty JSON body)
            start_response = requests.post(
                f"{base_url}/api/v1/tasks/{new_task_id}/start",
                json={},
                headers=headers
            )
            
            if start_response.status_code in [200, 201]:
                # Complete task
                complete_response = requests.post(
                    f"{base_url}/api/v1/tasks/{new_task_id}/complete",
                    json={
                        "completion_notes": completion["completion_notes"],
                        "quality_rating": completion["quality_rating"],
                        "latitude": completion["latitude"],
                        "longitude": completion["longitude"]
                    },
                    headers=headers
                )
                
                if complete_response.status_code in [200, 201]:
                    print_status(f"Completed task ID {new_task_id}", "SUCCESS")
                else:
                    print_status(f"Failed to complete task {new_task_id}: {complete_response.status_code} - {complete_response.text}", "ERROR")
            else:
                print_status(f"Failed to start task {new_task_id}: {start_response.status_code} - {start_response.text}", "ERROR")
        except Exception as e:
            print_status(f"Error completing task: {str(e)}", "ERROR")

def create_locations(base_url: str, user_tokens: Dict[int, str], task_ids: Dict[int, int]):
    """Create location logs"""
    locations_data = [
        {
            "old_task_id": 1,
            "user_id": 4,
            "latitude": 14.5547,
            "longitude": 121.0244,
            "accuracy": 5.2,
            "altitude": 45.0,
            "speed": 0.0,
            "address": "Ayala Tower, Ayala Avenue, Makati City, Metro Manila",
            "notes": "Arrived at site, beginning inspection",
            "location_type": "auto",
            "recorded_at": "2025-10-24T10:15:00.000Z"
        },
        {
            "old_task_id": 2,
            "user_id": 5,
            "latitude": 14.5518,
            "longitude": 121.0475,
            "accuracy": 8.1,
            "altitude": 12.5,
            "speed": 0.0,
            "address": "BGC Corporate Center, 26th Street, Bonifacio Global City, Taguig",
            "notes": "Arrived at warehouse",
            "location_type": "auto",
            "recorded_at": "2025-10-24T14:45:00.000Z"
        },
        {
            "old_task_id": 2,
            "user_id": 5,
            "latitude": 14.5520,
            "longitude": 121.0476,
            "accuracy": 6.5,
            "altitude": 12.8,
            "speed": 0.0,
            "address": "BGC Corporate Center, 26th Street, Bonifacio Global City, Taguig",
            "notes": "Delivery completed, obtaining signature",
            "location_type": "manual",
            "recorded_at": "2025-10-24T15:30:00.000Z"
        },
        {
            "old_task_id": 4,
            "user_id": 4,
            "latitude": 14.6507,
            "longitude": 121.0494,
            "accuracy": 10.3,
            "altitude": 78.0,
            "speed": 0.0,
            "address": "Commonwealth Avenue, Quezon City, Metro Manila",
            "notes": "On-site for emergency repair",
            "location_type": "auto",
            "recorded_at": "2025-10-24T10:30:00.000Z"
        },
        {
            "old_task_id": 4,
            "user_id": 4,
            "latitude": 14.6509,
            "longitude": 121.0495,
            "accuracy": 7.8,
            "altitude": 78.5,
            "speed": 0.0,
            "address": "Commonwealth Avenue, Quezon City, Metro Manila",
            "notes": "Repair completed, testing water flow",
            "location_type": "manual",
            "recorded_at": "2025-10-24T11:45:00.000Z"
        },
        {
            "old_task_id": 8,
            "user_id": 5,
            "latitude": 14.6091,
            "longitude": 121.0780,
            "accuracy": 4.5,
            "altitude": 22.0,
            "speed": 0.0,
            "address": "Eastwood Avenue, Eastwood City, Quezon City",
            "notes": "Started network cabling installation",
            "location_type": "auto",
            "recorded_at": "2025-10-24T13:00:00.000Z"
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
    
    # Step 4: Create location logs
    print_status("Creating location logs...", "INFO")
    create_locations(base_url, user_tokens, task_ids)
    print()
    
    # Step 5: Complete some tasks
    print_status("Completing tasks...", "INFO")
    complete_tasks(base_url, user_tokens, task_ids)
    print()
    
    print_status("Seed process completed!", "SUCCESS")
    print()
    print_status("Login credentials:", "INFO")
    print("  Admin: admin_user / Admin123!")
    print("  Supervisor 1: supervisor_juan / Super123!")
    print("  Supervisor 2: supervisor_ana / Super123!")
    print("  User 1: field_worker_pedro / User123!")
    print("  User 2: field_worker_lisa / User123!")
    print("  User 3: field_worker_carlo / User123!")
    print("  User 4: field_worker_nina / User123!")

if __name__ == "__main__":
    main()