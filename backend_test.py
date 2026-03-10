#!/usr/bin/env python3
"""
Comprehensive Backend API Test Script for Relational Awareness Tool
Tests all backend endpoints in the proper sequence.
"""

import requests
import json
import sys
from datetime import datetime

# Use the correct backend URL from frontend environment
BASE_URL = "https://connection-aware.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_data = {
            "email": "testuser@example.com",
            "password": "securepassword123"
        }
        self.relationship_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message="", response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} {test_name}: {message}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "response_data": response_data
        })
        
    def make_request(self, method, endpoint, data=None, auth_required=True):
        """Make HTTP request with proper headers"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if auth_required and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers, timeout=30)
            else:
                return None
                
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None

    def test_user_registration(self):
        """Test POST /auth/register"""
        print("\n=== Testing User Registration ===")
        
        response = self.make_request("POST", "/auth/register", self.user_data, auth_required=False)
        
        if response is None:
            self.log_result("User Registration", False, "No response received")
            return False
            
        if response.status_code == 201 or response.status_code == 200:
            try:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.token = data["access_token"]
                    self.log_result("User Registration", True, f"User registered successfully. Email: {data['user']['email']}")
                    return True
                else:
                    self.log_result("User Registration", False, "Missing access_token or user in response")
                    return False
            except json.JSONDecodeError:
                self.log_result("User Registration", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            try:
                error_data = response.json()
                # User might already exist, try login instead
                if "già registrata" in error_data.get("detail", ""):
                    print("User already exists, will try login instead")
                    return self.test_user_login()
                else:
                    self.log_result("User Registration", False, f"Status {response.status_code}: {error_data.get('detail', 'Unknown error')}")
                    return False
            except:
                self.log_result("User Registration", False, f"Status {response.status_code}: {response.text}")
                return False

    def test_user_login(self):
        """Test POST /auth/login"""
        print("\n=== Testing User Login ===")
        
        response = self.make_request("POST", "/auth/login", self.user_data, auth_required=False)
        
        if response is None:
            self.log_result("User Login", False, "No response received")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.token = data["access_token"]
                    self.log_result("User Login", True, f"Login successful. User ID: {data['user']['id']}")
                    return True
                else:
                    self.log_result("User Login", False, "Missing access_token or user in response")
                    return False
            except json.JSONDecodeError:
                self.log_result("User Login", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            try:
                error_data = response.json()
                self.log_result("User Login", False, f"Status {response.status_code}: {error_data.get('detail', 'Unknown error')}")
                return False
            except:
                self.log_result("User Login", False, f"Status {response.status_code}: {response.text}")
                return False

    def test_phase1_questions(self):
        """Test GET /phase1/questions"""
        print("\n=== Testing Phase 1 Questions ===")
        
        response = self.make_request("GET", "/phase1/questions", auth_required=False)
        
        if response is None:
            self.log_result("Phase 1 Questions", False, "No response received")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if "questions" in data and len(data["questions"]) > 0:
                    questions_count = len(data["questions"])
                    self.log_result("Phase 1 Questions", True, f"Retrieved {questions_count} questions")
                    return True
                else:
                    self.log_result("Phase 1 Questions", False, "No questions found in response")
                    return False
            except json.JSONDecodeError:
                self.log_result("Phase 1 Questions", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            self.log_result("Phase 1 Questions", False, f"Status {response.status_code}: {response.text}")
            return False

    def test_phase1_submit(self):
        """Test POST /phase1"""
        print("\n=== Testing Phase 1 Submit ===")
        
        # Sample responses based on the questions structure
        phase1_responses = {
            "responses": {
                "comm_1": 4, "comm_2": 3, "comm_3": 4,
                "emo_1": 3, "emo_2": 4, "emo_3": 3, "emo_4": 4,
                "exp_1": 4, "exp_2": 5, "exp_3": 4,
                "conf_1": 3, "conf_2": 4, "conf_3": 4, "conf_4": 3,
                "bound_1": 4, "bound_2": 4, "bound_3": 3
            }
        }
        
        response = self.make_request("POST", "/phase1", phase1_responses)
        
        if response is None:
            self.log_result("Phase 1 Submit", False, "No response received")
            return False
            
        if response.status_code == 200 or response.status_code == 201:
            try:
                data = response.json()
                if "id" in data and "profile_score" in data and "traits" in data:
                    traits_count = len(data["traits"])
                    self.log_result("Phase 1 Submit", True, f"Phase 1 submitted successfully. Generated {traits_count} traits")
                    return True
                else:
                    self.log_result("Phase 1 Submit", False, "Missing required fields in response")
                    return False
            except json.JSONDecodeError:
                self.log_result("Phase 1 Submit", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            try:
                error_data = response.json()
                self.log_result("Phase 1 Submit", False, f"Status {response.status_code}: {error_data.get('detail', 'Unknown error')}")
                return False
            except:
                self.log_result("Phase 1 Submit", False, f"Status {response.status_code}: {response.text}")
                return False

    def test_phase1_profile(self):
        """Test GET /phase1"""
        print("\n=== Testing Phase 1 Profile ===")
        
        response = self.make_request("GET", "/phase1")
        
        if response is None:
            self.log_result("Phase 1 Profile", False, "No response received")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if data is None:
                    self.log_result("Phase 1 Profile", True, "No Phase 1 data yet (expected for new user)")
                    return True
                elif "id" in data and "profile_score" in data:
                    self.log_result("Phase 1 Profile", True, f"Phase 1 profile retrieved successfully")
                    return True
                else:
                    self.log_result("Phase 1 Profile", False, "Invalid profile data structure")
                    return False
            except json.JSONDecodeError:
                self.log_result("Phase 1 Profile", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            self.log_result("Phase 1 Profile", False, f"Status {response.status_code}: {response.text}")
            return False

    def test_create_relationship(self):
        """Test POST /relationships"""
        print("\n=== Testing Create Relationship ===")
        
        relationship_data = {
            "person_name": "Marco", 
            "relationship_type": "Partner"
        }
        
        response = self.make_request("POST", "/relationships", relationship_data)
        
        if response is None:
            self.log_result("Create Relationship", False, "No response received")
            return False
            
        if response.status_code == 200 or response.status_code == 201:
            try:
                data = response.json()
                if "id" in data and "person_name" in data:
                    self.relationship_id = data["id"]
                    self.log_result("Create Relationship", True, f"Relationship created: {data['person_name']} ({data.get('relationship_type', 'N/A')})")
                    return True
                else:
                    self.log_result("Create Relationship", False, "Missing required fields in response")
                    return False
            except json.JSONDecodeError:
                self.log_result("Create Relationship", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            try:
                error_data = response.json()
                self.log_result("Create Relationship", False, f"Status {response.status_code}: {error_data.get('detail', 'Unknown error')}")
                return False
            except:
                self.log_result("Create Relationship", False, f"Status {response.status_code}: {response.text}")
                return False

    def test_get_relationships(self):
        """Test GET /relationships"""
        print("\n=== Testing Get Relationships ===")
        
        response = self.make_request("GET", "/relationships")
        
        if response is None:
            self.log_result("Get Relationships", False, "No response received")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get Relationships", True, f"Retrieved {len(data)} relationships")
                    return True
                else:
                    self.log_result("Get Relationships", False, "Response is not a list")
                    return False
            except json.JSONDecodeError:
                self.log_result("Get Relationships", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            self.log_result("Get Relationships", False, f"Status {response.status_code}: {response.text}")
            return False

    def test_phase2_areas(self):
        """Test GET /phase2/areas"""
        print("\n=== Testing Phase 2 Areas ===")
        
        response = self.make_request("GET", "/phase2/areas", auth_required=False)
        
        if response is None:
            self.log_result("Phase 2 Areas", False, "No response received")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if "areas" in data and "order" in data:
                    areas_count = len(data["areas"])
                    self.log_result("Phase 2 Areas", True, f"Retrieved {areas_count} areas with proper structure")
                    return True
                else:
                    self.log_result("Phase 2 Areas", False, "Missing areas or order in response")
                    return False
            except json.JSONDecodeError:
                self.log_result("Phase 2 Areas", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            self.log_result("Phase 2 Areas", False, f"Status {response.status_code}: {response.text}")
            return False

    def test_phase2_submit_areas(self):
        """Test POST /phase2/{relationship_id}/area for all areas sequentially"""
        print("\n=== Testing Phase 2 Area Submissions ===")
        
        if not self.relationship_id:
            self.log_result("Phase 2 Submit Areas", False, "No relationship ID available")
            return False
        
        # Area order from the backend code
        areas_order = ["comunicazione", "valori", "bisogni_emotivi", "conflitto", "visione"]
        all_successful = True
        
        for area in areas_order:
            print(f"\n--- Testing area: {area} ---")
            area_data = {
                "area_id": area,
                "responses": {
                    f"p2_{area[:3]}_1": 4,
                    f"p2_{area[:3]}_2": 3,
                    f"p2_{area[:3]}_3": 4,
                    f"p2_{area[:3]}_4": 3,
                    f"p2_{area[:3]}_5": 4
                }
            }
            
            response = self.make_request("POST", f"/phase2/{self.relationship_id}/area", area_data)
            
            if response is None:
                self.log_result(f"Phase 2 Submit - {area}", False, "No response received")
                all_successful = False
                continue
                
            if response.status_code == 200 or response.status_code == 201:
                try:
                    data = response.json()
                    if "id" in data and "area_responses" in data:
                        completed_areas = len(data.get("completed_areas", []))
                        self.log_result(f"Phase 2 Submit - {area}", True, f"Area submitted. Total completed: {completed_areas}")
                    else:
                        self.log_result(f"Phase 2 Submit - {area}", False, "Missing required fields in response")
                        all_successful = False
                except json.JSONDecodeError:
                    self.log_result(f"Phase 2 Submit - {area}", False, f"Invalid JSON response: {response.text}")
                    all_successful = False
            else:
                try:
                    error_data = response.json()
                    self.log_result(f"Phase 2 Submit - {area}", False, f"Status {response.status_code}: {error_data.get('detail', 'Unknown error')}")
                    all_successful = False
                except:
                    self.log_result(f"Phase 2 Submit - {area}", False, f"Status {response.status_code}: {response.text}")
                    all_successful = False
        
        return all_successful

    def test_monitoring_questions(self):
        """Test GET /monitoring/questions"""
        print("\n=== Testing Monitoring Questions ===")
        
        response = self.make_request("GET", "/monitoring/questions", auth_required=False)
        
        if response is None:
            self.log_result("Monitoring Questions", False, "No response received")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if "questions" in data and len(data["questions"]) > 0:
                    questions_count = len(data["questions"])
                    self.log_result("Monitoring Questions", True, f"Retrieved {questions_count} monitoring questions")
                    return True
                else:
                    self.log_result("Monitoring Questions", False, "No questions found in response")
                    return False
            except json.JSONDecodeError:
                self.log_result("Monitoring Questions", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            self.log_result("Monitoring Questions", False, f"Status {response.status_code}: {response.text}")
            return False

    def test_monitoring_submit(self):
        """Test POST /monitoring/{relationship_id}"""
        print("\n=== Testing Monitoring Submit ===")
        
        if not self.relationship_id:
            self.log_result("Monitoring Submit", False, "No relationship ID available")
            return False
        
        monitoring_data = {
            "responses": {
                "mon_1": 4,
                "mon_2": 3,
                "mon_3": 4,
                "mon_4": 3
            }
        }
        
        response = self.make_request("POST", f"/monitoring/{self.relationship_id}", monitoring_data)
        
        if response is None:
            self.log_result("Monitoring Submit", False, "No response received")
            return False
            
        if response.status_code == 200 or response.status_code == 201:
            try:
                data = response.json()
                if "id" in data and "compatibility" in data:
                    compatibility = data["compatibility"]
                    self.log_result("Monitoring Submit", True, f"Monitoring submitted. Compatibility: {compatibility:.1f}%")
                    return True
                else:
                    self.log_result("Monitoring Submit", False, "Missing required fields in response")
                    return False
            except json.JSONDecodeError:
                self.log_result("Monitoring Submit", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            try:
                error_data = response.json()
                self.log_result("Monitoring Submit", False, f"Status {response.status_code}: {error_data.get('detail', 'Unknown error')}")
                return False
            except:
                self.log_result("Monitoring Submit", False, f"Status {response.status_code}: {response.text}")
                return False

    def test_resources(self):
        """Test GET /resources"""
        print("\n=== Testing Resources ===")
        
        response = self.make_request("GET", "/resources", auth_required=False)
        
        if response is None:
            self.log_result("Resources", False, "No response received")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    resources_count = len(data)
                    premium_count = sum(1 for r in data if r.get("is_premium", False))
                    self.log_result("Resources", True, f"Retrieved {resources_count} resources ({premium_count} premium)")
                    return True
                else:
                    self.log_result("Resources", False, "No resources found in response")
                    return False
            except json.JSONDecodeError:
                self.log_result("Resources", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            self.log_result("Resources", False, f"Status {response.status_code}: {response.text}")
            return False

    def test_dashboard_stats(self):
        """Test GET /dashboard/stats"""
        print("\n=== Testing Dashboard Stats ===")
        
        response = self.make_request("GET", "/dashboard/stats")
        
        if response is None:
            self.log_result("Dashboard Stats", False, "No response received")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                required_fields = ["phase1_completed", "relationships_count", "max_relationships", "relationships"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    phase1_status = data["phase1_completed"]
                    rel_count = data["relationships_count"]
                    self.log_result("Dashboard Stats", True, f"Stats retrieved. Phase1: {phase1_status}, Relationships: {rel_count}")
                    return True
                else:
                    self.log_result("Dashboard Stats", False, f"Missing fields: {missing_fields}")
                    return False
            except json.JSONDecodeError:
                self.log_result("Dashboard Stats", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            self.log_result("Dashboard Stats", False, f"Status {response.status_code}: {response.text}")
            return False

    def test_notifications(self):
        """Test GET /notifications"""
        print("\n=== Testing Notifications ===")
        
        response = self.make_request("GET", "/notifications")
        
        if response is None:
            self.log_result("Notifications", False, "No response received")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    notifications_count = len(data)
                    unread_count = sum(1 for n in data if not n.get("read", True))
                    self.log_result("Notifications", True, f"Retrieved {notifications_count} notifications ({unread_count} unread)")
                    return True
                else:
                    self.log_result("Notifications", False, "Response is not a list")
                    return False
            except json.JSONDecodeError:
                self.log_result("Notifications", False, f"Invalid JSON response: {response.text}")
                return False
        else:
            self.log_result("Notifications", False, f"Status {response.status_code}: {response.text}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"🚀 Starting Relational Awareness Tool Backend API Tests")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"🕐 Started at: {datetime.now()}")
        
        # Test sequence as per requirements
        tests = [
            self.test_user_registration,
            self.test_user_login, 
            self.test_phase1_questions,
            self.test_phase1_submit,
            self.test_phase1_profile,
            self.test_create_relationship,
            self.test_get_relationships,
            self.test_phase2_areas,
            self.test_phase2_submit_areas,
            self.test_monitoring_questions,
            self.test_monitoring_submit,
            self.test_resources,
            self.test_dashboard_stats,
            self.test_notifications
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            success = test()
            if success:
                passed += 1
            else:
                failed += 1
        
        # Summary
        print(f"\n{'='*60}")
        print(f"🎯 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📊 Total: {passed + failed}")
        print(f"🕐 Completed at: {datetime.now()}")
        
        if failed > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['message']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)