#!/usr/bin/env python3
"""
Enhanced Seed Data Script - Creates employees with varied KPI performance
Usage: python seed_data.py [--base-url http://localhost:8000]

Performance Tiers:
- Top Performers (2 employees): 90%+ completion, high quality, reliable
- Mid Performers (3 employees): 70-80% completion, average quality, moderate reliability
- Poor Performers (2 employees): <60% completion, low quality, unreliable
"""

import requests
import json
import argparse
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from app.models.user import UserRole


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
        response = requests.post(
            f"{base_url}/api/v1/auth/login-json",
            json={"email": email, "password": password}
        )
        
        if response.status_code == 200:
            token_data = response.json()
            return token_data.get("access_token")
        
        print_status(f"Login failed for {email}: {response.status_code}", "DEBUG")
        return None
        
    except Exception as e:
        print_status(f"Login exception for {email}: {str(e)}", "DEBUG")
        return None

def create_admin_user(base_url: str) -> tuple:
    """Create admin user via the /admin/user endpoint and return (token, user_id)"""
    admin_data = {
        "email": "admin@company.com",
        "username": "admin_user",
        "full_name": "Maria Santos",
        "password": "Admin123!",
        "role": "admin"
    }

    try:
        # Use the admin-specific endpoint
        response = requests.post(f"{base_url}/api/v1/auth/admin/user", json=admin_data)
        print_status(f"Admin registration response: {response.status_code}", "DEBUG")

        # Log in to get token
        token = login_user(base_url, admin_data["email"], admin_data["password"])
        if not token:
            print_status("Failed to get admin token", "ERROR")
            return None, None

        # Fetch admin info
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
    """Create users with varied performance profiles"""
    users_data = [
        # ============================================================
        # TOP PERFORMERS - Excellent KPIs
        # ============================================================
        {
            "old_id": 101,
            "email": "star.employee1@company.com",
            "username": "maria_excellence",
            "full_name": "Maria Dela Cruz",
            "password": "User123!",
            "role": "user",
            "tier": "top"
        },
        {
            "old_id": 102,
            "email": "star.employee2@company.com",
            "username": "james_reliable",
            "full_name": "James Rodriguez",
            "password": "User123!",
            "role": "user",
            "tier": "top"
        },
        
        # ============================================================
        # MID PERFORMERS - Average KPIs
        # ============================================================
        {
            "old_id": 201,
            "email": "avg.employee1@company.com",
            "username": "carlo_average",
            "full_name": "Carlo Ramos",
            "password": "User123!",
            "role": "user",
            "tier": "mid"
        },
        {
            "old_id": 202,
            "email": "avg.employee2@company.com",
            "username": "lisa_decent",
            "full_name": "Lisa Mendoza",
            "password": "User123!",
            "role": "user",
            "tier": "mid"
        },
        {
            "old_id": 203,
            "email": "avg.employee3@company.com",
            "username": "pedro_moderate",
            "full_name": "Pedro Garcia",
            "password": "User123!",
            "role": "user",
            "tier": "mid"
        },
        
        # ============================================================
        # POOR PERFORMERS - Below Average KPIs
        # ============================================================
        {
            "old_id": 301,
            "email": "struggling.employee1@company.com",
            "username": "tony_struggling",
            "full_name": "Tony Santos",
            "password": "User123!",
            "role": "user",
            "tier": "poor"
        },
        {
            "old_id": 302,
            "email": "struggling.employee2@company.com",
            "username": "nina_unreliable",
            "full_name": "Nina Torres",
            "password": "User123!",
            "role": "user",
            "tier": "poor"
        }
    ]
    
    user_tokens = {}
    user_ids = {}
    user_tiers = {}
    
    for user in users_data:
        try:
            old_id = user.pop("old_id")
            tier = user.pop("tier")
            
            response = requests.post(f"{base_url}/api/v1/auth/register", json=user)
            print_status(f"Registration response for {user['username']}: {response.status_code}", "DEBUG")
            
            token = login_user(base_url, user["email"], user["password"])
            
            if token:
                headers = {"Authorization": f"Bearer {token}"}
                me_response = requests.get(f"{base_url}/api/v1/auth/me", headers=headers)
                
                if me_response.status_code == 200:
                    user_info = me_response.json()
                    actual_id = user_info.get("id")
                    user_tokens[old_id] = token
                    user_ids[old_id] = actual_id
                    user_tiers[old_id] = tier
                    
                    tier_emoji = {"top": "⭐", "mid": "📊", "poor": "⚠️"}
                    print_status(f"{tier_emoji[tier]} Created {tier.upper()} performer: {user['username']} (ID: {actual_id})", "SUCCESS")
                else:
                    print_status(f"Failed to get user info for {user['username']}", "ERROR")
            else:
                print_status(f"Failed to login {user['username']}", "ERROR")
                
        except Exception as e:
            print_status(f"Error creating user {user['username']}: {str(e)}", "ERROR")
    
    return user_tokens, user_ids, user_tiers

def generate_historical_tasks(user_ids: Dict[int, int], user_tiers: Dict[int, str]) -> List[Dict]:
    """
    Generate 30 days of historical tasks with performance patterns:
    - Top performers: 95% completion, 4.5+ stars, always on time
    - Mid performers: 75% completion, 3.5 stars, sometimes late
    - Poor performers: 50% completion, 2.5 stars, often late
    """
    now = datetime.now(timezone.utc)
    tasks = []
    task_id_counter = 1
    
    # Task templates
    task_templates = [
        {"title": "Electrical inspection", "location": "Makati Office", "lat": 14.5547, "lng": 121.0244, "duration": 120},
        {"title": "HVAC maintenance", "location": "Ortigas Center", "lat": 14.5866, "lng": 121.0582, "duration": 180},
        {"title": "Plumbing repair", "location": "Quezon City Office", "lat": 14.6507, "lng": 121.0494, "duration": 90},
        {"title": "Security camera installation", "location": "BGC Tower", "lat": 14.5518, "lng": 121.0475, "duration": 150},
        {"title": "Equipment delivery", "location": "Alabang Branch", "lat": 14.4198, "lng": 121.0395, "duration": 60},
        {"title": "Network cabling", "location": "Eastwood Office", "lat": 14.6091, "lng": 121.0780, "duration": 120},
        {"title": "Fire safety inspection", "location": "Mandaluyong Site", "lat": 14.5814, "lng": 121.0509, "duration": 75},
        {"title": "Painting work", "location": "Manila Head Office", "lat": 14.5995, "lng": 120.9842, "duration": 240},
    ]
    
    # Generate tasks for each user over the past 30 days
    for old_id, actual_id in user_ids.items():
        if old_id == 1:  # Skip admin
            continue
        
        tier = user_tiers.get(old_id, "mid")
        
        # Task count per tier (over 30 days)
        task_counts = {
            "top": 25,   # ~5 tasks per week
            "mid": 20,   # ~4 tasks per week
            "poor": 15   # ~3 tasks per week
        }
        
        num_tasks = task_counts[tier]
        
        for i in range(num_tasks):
            # Distribute tasks evenly over 30 days
            days_ago = 30 - (i * 30 // num_tasks)
            task_date = now - timedelta(days=days_ago)
            
            template = task_templates[i % len(task_templates)]
            
            # Determine if task should be completed based on tier
            completion_rates = {"top": 0.95, "mid": 0.75, "poor": 0.50}
            should_complete = (i / num_tasks) < completion_rates[tier]
            
            # Calculate due date and completion time
            due_date = task_date + timedelta(hours=4)
            
            if should_complete:
                # Completion time variance by tier
                if tier == "top":
                    # Top performers: complete early or on time, accurate estimates
                    time_variance = 0.95 + (i % 10) * 0.01  # 95-105% of estimate
                    delay_hours = -0.5 - (i % 3) * 0.25  # Complete 0.5-1.5 hours early
                elif tier == "mid":
                    # Mid performers: sometimes late, moderate variance
                    time_variance = 0.90 + (i % 20) * 0.01  # 90-110% of estimate
                    delay_hours = -0.5 + (i % 5) * 0.5  # -0.5 to +2 hours
                else:  # poor
                    # Poor performers: often late, high variance
                    time_variance = 0.80 + (i % 40) * 0.01  # 80-120% of estimate
                    delay_hours = 0 + (i % 8) * 0.5  # 0 to +4 hours late
                
                actual_duration = int(template["duration"] * time_variance)
                completed_at = due_date + timedelta(hours=delay_hours)
                
                # Quality ratings by tier
                if tier == "top":
                    quality = 5 if i % 2 == 0 else 4  # Mostly 5 stars, some 4
                elif tier == "mid":
                    quality = [3, 4, 4, 3, 4][i % 5]  # Mix of 3-4 stars
                else:  # poor
                    quality = [2, 3, 2, 3, 2][i % 5]  # Mostly 2-3 stars
                
                status = "completed"
            else:
                # Incomplete tasks
                actual_duration = None
                completed_at = None
                quality = None
                
                # Vary status for incomplete tasks
                if tier == "poor" and i % 3 == 0:
                    status = "in_progress"  # Poor performers have more stalled tasks
                else:
                    status = "pending"
            
            task = {
                "old_id": task_id_counter,
                "title": f"{template['title']} - Site {i+1}",
                "description": f"Task assigned to test employee performance tracking. Location: {template['location']}",
                "priority": ["high", "medium", "low"][i % 3],
                "location_name": template["location"],
                "latitude": template["lat"],
                "longitude": template["lng"],
                "estimated_duration": template["duration"],  # ✅ UPDATED: Now in minutes
                "actual_duration": actual_duration if actual_duration else None, # ✅ UPDATED: Now in minutes
                "due_date": due_date.isoformat(),
                "completed_at": completed_at.isoformat() if completed_at else None,
                "quality_rating": quality,
                "status": status,
                "assigned_to": old_id,
                "created_at": task_date.isoformat()
            }
            
            tasks.append(task)
            task_id_counter += 1
    
    return tasks

def create_historical_tasks(base_url: str, admin_token: str, tasks: List[Dict], user_ids: Dict[int, int]) -> Dict[int, int]:
    """Create historical tasks with completion data, using correct task endpoints"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    task_ids = {}

    completed_count = 0
    pending_count = 0
    in_progress_count = 0

    for task in tasks:
        try:
            old_id = task.pop("old_id")
            old_assigned_id = task["assigned_to"]

            if old_assigned_id in user_ids:
                task["assigned_to"] = user_ids[old_assigned_id]
            else:
                continue

            # Extract special fields
            status = task.pop("status")
            completed_at = task.pop("completed_at", None)
            quality_rating = task.pop("quality_rating", None)
            actual_duration = task.pop("actual_duration", None)

            # Step 1: Create the task
            response = requests.post(f"{base_url}/api/v1/tasks/", json=task, headers=headers)
            if response.status_code not in [200, 201]:
                print_status(f"Failed to create task: {response.status_code} - {response.text}", "ERROR")
                continue

            task_data = response.json()
            new_task_id = task_data.get("id")
            task_ids[old_id] = new_task_id

            # Step 2: Update task status using correct endpoints
            update_response = None
            if status == "completed":
                payload = {
                    "completed_at": completed_at,
                    "quality_rating": quality_rating,
                    "actual_duration": actual_duration
                }
                update_response = requests.post(
                    f"{base_url}/api/v1/tasks/{new_task_id}/complete",
                    json=payload,
                    headers=headers
                )
                completed_count += 1
                emoji = "✅"

            elif status == "in_progress":
                update_response = requests.post(
                    f"{base_url}/api/v1/tasks/{new_task_id}/start",
                    headers=headers
                )
                in_progress_count += 1
                emoji = "🔄"

            else:  # pending tasks require no update
                pending_count += 1
                emoji = "⏳"

            if update_response and update_response.status_code not in [200, 201]:
                print_status(f"Failed to update task status: {update_response.text}", "WARNING")
            else:
                print_status(f"{emoji} Created {status} task: {task['title'][:40]}...", "SUCCESS")

        except Exception as e:
            print_status(f"Error creating task: {str(e)}", "ERROR")

    print()
    print_status(
        f"Task Summary: {completed_count} completed, {in_progress_count} in progress, {pending_count} pending",
        "INFO"
    )
    return task_ids




def create_current_tasks(base_url: str, admin_token: str, user_ids: Dict[int, int]) -> Dict[int, int]:
    """Create current/future tasks for ongoing work"""
    current_tasks = [
        {
            "old_id": 9001,
            "title": "Emergency electrical repair - Makati",
            "description": "Urgent: Power outage in server room, immediate response required",
            "priority": "high",
            "location_name": "Ayala Tower, Makati",
            "latitude": 14.5547,
            "longitude": 121.0244,
            "estimated_duration": 90,
            "due_date": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
            "assigned_to": 101  # Top performer
        },
        {
            "old_id": 9002,
            "title": "Routine maintenance - BGC",
            "description": "Monthly equipment check and calibration",
            "priority": "medium",
            "location_name": "BGC Corporate Center",
            "latitude": 14.5518,
            "longitude": 121.0475,
            "estimated_duration": 120,
            "due_date": (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
            "assigned_to": 102  # Top performer
        },
        {
            "old_id": 9003,
            "title": "HVAC filter replacement - Ortigas",
            "description": "Replace air filters in all units, 5th floor",
            "priority": "medium",
            "location_name": "Ortigas Center",
            "latitude": 14.5866,
            "longitude": 121.0582,
            "estimated_duration": 150,
            "due_date": (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat(),
            "assigned_to": 201  # Mid performer
        },
        {
            "old_id": 9004,
            "title": "Equipment delivery - Alabang",
            "description": "Deliver and install new workstation equipment",
            "priority": "low",
            "location_name": "Alabang Office",
            "latitude": 14.4198,
            "longitude": 121.0395,
            "estimated_duration": 180,
            "due_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "assigned_to": 202  # Mid performer
        },
        {
            "old_id": 9005,
            "title": "Network troubleshooting - Eastwood",
            "description": "Investigate slow network speeds on 3rd floor",
            "priority": "high",
            "location_name": "Eastwood City",
            "latitude": 14.6091,
            "longitude": 121.0780,
            "estimated_duration": 120,
            "due_date": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat(),
            "assigned_to": 301  # Poor performer
        }
    ]
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    task_ids = {}
    
    for task in current_tasks:
        try:
            old_id = task.pop("old_id")
            old_assigned_id = task["assigned_to"]
            
            if old_assigned_id in user_ids:
                task["assigned_to"] = user_ids[old_assigned_id]
            else:
                continue
            
            response = requests.post(f"{base_url}/api/v1/tasks/", json=task, headers=headers)
            
            if response.status_code in [200, 201]:
                task_data = response.json()
                new_task_id = task_data.get("id")
                task_ids[old_id] = new_task_id
                print_status(f"📋 Created current task: {task['title']}", "SUCCESS")
            else:
                print_status(f"Failed to create task: {response.status_code}", "ERROR")
                
        except Exception as e:
            print_status(f"Error creating task: {str(e)}", "ERROR")
    
    return task_ids

def main():
    parser = argparse.ArgumentParser(description="Seed database with varied employee performance data")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Base URL for API")
    parser.add_argument("--debug", action="store_true", help="Enable debug output")
    args = parser.parse_args()
    
    base_url = args.base_url.rstrip("/")
    
    print("=" * 70)
    print("🎯 PERFORMANCE-BASED EMPLOYEE SEEDING")
    print("=" * 70)
    print()
    
    # Step 1: Create admin
    print_status("Setting up admin user...", "INFO")
    admin_token, admin_id = create_admin_user(base_url)
    
    if not admin_token:
        print_status("Failed to setup admin user. Cannot continue.", "ERROR")
        return
    
    user_tokens = {1: admin_token}
    user_ids = {1: admin_id}
    user_tiers = {1: "admin"}
    print()
    
    # Step 2: Create employees with different performance tiers
    print_status("Creating employees with varied performance profiles...", "INFO")
    other_tokens, other_ids, other_tiers = create_users(base_url, admin_token)
    user_tokens.update(other_tokens)
    user_ids.update(other_ids)
    user_tiers.update(other_tiers)
    print()
    
    # Step 3: Generate and create historical tasks (30 days of data)
    print_status("Generating 30 days of historical task data...", "INFO")
    historical_tasks = generate_historical_tasks(user_ids, user_tiers)
    print_status(f"Generated {len(historical_tasks)} historical tasks", "INFO")
    print()
    
    print_status("Creating historical tasks with completion data...", "INFO")
    historical_task_ids = create_historical_tasks(base_url, admin_token, historical_tasks, user_ids)
    print()
    
    # Step 4: Create current/future tasks
    print_status("Creating current tasks...", "INFO")
    current_task_ids = create_current_tasks(base_url, admin_token, user_ids)
    print()

    # =============================
# VERIFY KPI ENDPOINTS
# =============================
    print_status("Fetching KPI data for verification...", "INFO")

    headers = {"Authorization": f"Bearer {admin_token}"}

    # First verify admin user role
    me_response = requests.get(f"{base_url}/api/v1/auth/me", headers=headers)
    if me_response.status_code == 200:
        admin_info = me_response.json()
        print_status(f"Admin user info: ID={admin_info.get('id')}, Role={admin_info.get('role')}", "DEBUG")
    else:
        print_status(f"Failed to get admin info: {me_response.text}", "ERROR")

    for old_id, actual_id in user_ids.items():
        if old_id == 1:
            continue  # skip admin internally

        kpi_url = f"{base_url}/api/v1/analytics/employees/{actual_id}/kpis?days=30"
        resp = requests.get(kpi_url, headers=headers)

        if resp.status_code == 200:
            print_status(f"KPI OK for user {actual_id}", "SUCCESS")
        else:
            print_status(f"KPI ERROR for {actual_id}: {resp.text}", "ERROR")


    
    # Summary
    print("=" * 70)
    print_status("✅ SEEDING COMPLETED SUCCESSFULLY!", "SUCCESS")
    print("=" * 70)
    print()
    
    # Performance summary
    print_status("📊 EMPLOYEE PERFORMANCE TIERS:", "INFO")
    print()
    print("  ⭐ TOP PERFORMERS (2 employees):")
    print("     • Maria Dela Cruz (maria_excellence)")
    print("       - 95%+ task completion rate")
    print("       - Average quality: 4.5+ stars")
    print("       - Always completes on time or early")
    print("       - Accurate time estimates (±5%)")
    print()
    print("     • James Rodriguez (james_reliable)")
    print("       - 95%+ task completion rate")
    print("       - Average quality: 4.5+ stars")
    print("       - Consistently reliable")
    print("       - Efficient task execution")
    print()
    
    print("  📊 MID PERFORMERS (3 employees):")
    print("     • Carlo Ramos (carlo_average)")
    print("     • Lisa Mendoza (lisa_decent)")
    print("     • Pedro Garcia (pedro_moderate)")
    print("       - 75% task completion rate")
    print("       - Average quality: 3.5 stars")
    print("       - Occasionally late on deadlines")
    print("       - Moderate time estimate variance")
    print()
    
    print("  ⚠️  POOR PERFORMERS (2 employees):")
    print("     • Tony Santos (tony_struggling)")
    print("     • Nina Torres (nina_unreliable)")
    print("       - 50% task completion rate")
    print("       - Average quality: 2.5 stars")
    print("       - Frequently late or incomplete tasks")
    print("       - High time estimate variance (±20%)")
    print()
    
    print_status("🔑 LOGIN CREDENTIALS:", "INFO")
    print("  Password for all users: User123!")
    print()
    print("  Top Performers:")
    print("    • maria_excellence / User123!")
    print("    • james_reliable / User123!")
    print()
    print("  Mid Performers:")
    print("    • carlo_average / User123!")
    print("    • lisa_decent / User123!")
    print("    • pedro_moderate / User123!")
    print()
    print("  Poor Performers:")
    print("    • tony_struggling / User123!")
    print("    • nina_unreliable / User123!")
    print()
    
    print_status("📈 NEXT STEPS:", "INFO")
    print("  1. Login as admin: admin_user / Admin123!")
    print("  2. Navigate to Analytics/Team Overview")
    print("  3. View individual employee KPI dashboards")
    print("  4. Compare performance across all 3 tiers")
    print("  5. Test ML predictions with different employees")
    print()

if __name__ == "__main__":
    main()