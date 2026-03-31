#!/usr/bin/env python3
"""
Backend API Testing Suite for Relational Awareness Tool
Tests the updated backend APIs with new question counts and intro-video endpoint
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://connection-tracker-8.preview.emergentagent.com/api"
TEST_EMAIL = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "SecurePass123!"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_token = None
        self.user_id = None
        self.relationship_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        try:
            if headers is None:
                headers = {}
            
            if self.user_token:
                headers["Authorization"] = f"Bearer {self.user_token}"
            
            response = self.session.request(method, url, json=data, headers=headers)
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None
    
    def test_user_registration(self):
        """Test user registration"""
        data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/register", data)
        
        if response and response.status_code == 200:
            result = response.json()
            self.user_token = result.get("access_token")
            self.user_id = result.get("user", {}).get("id")
            self.log_test("User Registration", True, f"User ID: {self.user_id}")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("User Registration", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False
    
    def test_phase1_questions(self):
        """Test Phase 1 questions - should return 15 questions (3 per category)"""
        response = self.make_request("GET", "/phase1/questions")
        
        if response and response.status_code == 200:
            result = response.json()
            questions = result.get("questions", [])
            
            # Check total count
            if len(questions) != 15:
                self.log_test("Phase 1 Questions Count", False, f"Expected 15, got {len(questions)}")
                return False
            
            # Check categories and their counts
            expected_categories = {
                "energia_relazionale": 3,
                "gestione_emotiva": 3,
                "bisogni_relazionali": 3,
                "stile_decisionale": 3,
                "reazione_cambiamento": 3
            }
            
            category_counts = {}
            for q in questions:
                category = q.get("category")
                category_counts[category] = category_counts.get(category, 0) + 1
                
                # Check each question has 4 options
                if len(q.get("options", [])) != 4:
                    self.log_test("Phase 1 Question Options", False, f"Question {q.get('id')} has {len(q.get('options', []))} options, expected 4")
                    return False
            
            # Verify category counts
            for category, expected_count in expected_categories.items():
                actual_count = category_counts.get(category, 0)
                if actual_count != expected_count:
                    self.log_test("Phase 1 Category Distribution", False, f"Category {category}: expected {expected_count}, got {actual_count}")
                    return False
            
            self.log_test("Phase 1 Questions", True, f"15 questions with correct distribution: {category_counts}")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Phase 1 Questions", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False
    
    def test_phase1_submit(self):
        """Test Phase 1 submission with 15 responses"""
        # First get the questions to know the IDs
        response = self.make_request("GET", "/phase1/questions")
        if not response or response.status_code != 200:
            self.log_test("Phase 1 Submit (Get Questions)", False, "Could not get questions")
            return False
        
        result = response.json()
        questions = result.get("questions", [])
        
        # Create responses for all 15 questions
        responses = {}
        for q in questions:
            responses[q["id"]] = 3  # Use middle value for all responses
        
        if len(responses) != 15:
            self.log_test("Phase 1 Submit (Response Count)", False, f"Expected 15 responses, created {len(responses)}")
            return False
        
        # Submit responses
        data = {"responses": responses}
        response = self.make_request("POST", "/phase1", data)
        
        if response and response.status_code == 200:
            result = response.json()
            
            # Check if profile_score and traits are generated
            if "profile_score" not in result or "traits" not in result:
                self.log_test("Phase 1 Submit", False, "Missing profile_score or traits in response")
                return False
            
            profile_score = result["profile_score"]
            traits = result["traits"]
            
            # Check if all 5 categories have scores
            expected_categories = ["energia_relazionale", "gestione_emotiva", "bisogni_relazionali", "stile_decisionale", "reazione_cambiamento"]
            for category in expected_categories:
                if category not in profile_score:
                    self.log_test("Phase 1 Submit", False, f"Missing score for category: {category}")
                    return False
            
            self.log_test("Phase 1 Submit", True, f"Profile scores: {profile_score}, Traits: {len(traits)} generated")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Phase 1 Submit", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False
    
    def test_create_relationship(self):
        """Test creating a relationship"""
        data = {
            "person_name": "Test Partner",
            "relationship_type": "romantic"
        }
        
        response = self.make_request("POST", "/relationships", data)
        
        if response and response.status_code == 200:
            result = response.json()
            self.relationship_id = result.get("id")
            self.log_test("Create Relationship", True, f"Relationship ID: {self.relationship_id}")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Create Relationship", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False
    
    def test_phase2_areas(self):
        """Test Phase 2 areas - should return 5 areas with 4 questions each"""
        response = self.make_request("GET", "/phase2/areas")
        
        if response and response.status_code == 200:
            result = response.json()
            areas_dict = result.get("areas", {})
            order = result.get("order", [])
            
            # Convert to list format for easier testing
            areas = []
            for area_id in order:
                if area_id in areas_dict:
                    area_data = areas_dict[area_id]
                    areas.append({
                        "id": area_id,
                        "name": area_data["name"],
                        "questions": area_data["questions"]
                    })
            
            # Check total areas count
            if len(areas) != 5:
                self.log_test("Phase 2 Areas Count", False, f"Expected 5 areas, got {len(areas)}")
                return False
            
            # Check expected areas
            expected_areas = ["comunicazione", "valori", "bisogni_emotivi", "conflitto", "stabilita"]
            area_names = [area["id"] for area in areas]
            
            for expected_area in expected_areas:
                if expected_area not in area_names:
                    self.log_test("Phase 2 Areas", False, f"Missing area: {expected_area}")
                    return False
            
            # Check each area has 4 questions
            for area in areas:
                questions = area.get("questions", [])
                if len(questions) != 4:
                    self.log_test("Phase 2 Area Questions", False, f"Area {area['id']} has {len(questions)} questions, expected 4")
                    return False
                
                # Check each question has 4 options
                for q in questions:
                    if len(q.get("options", [])) != 4:
                        self.log_test("Phase 2 Question Options", False, f"Question {q.get('id')} has {len(q.get('options', []))} options, expected 4")
                        return False
            
            # Verify specific question IDs
            expected_question_ids = {
                "comunicazione": ["p2_comm_1", "p2_comm_2", "p2_comm_3", "p2_comm_4"],
                "valori": ["p2_val_1", "p2_val_2", "p2_val_3", "p2_val_4"],
                "bisogni_emotivi": ["p2_emo_1", "p2_emo_2", "p2_emo_3", "p2_emo_4"],
                "conflitto": ["p2_conf_1", "p2_conf_2", "p2_conf_3", "p2_conf_4"],
                "stabilita": ["p2_stab_1", "p2_stab_2", "p2_stab_3", "p2_stab_4"]
            }
            
            for area in areas:
                area_id = area["id"]
                expected_ids = expected_question_ids[area_id]
                actual_ids = [q["id"] for q in area["questions"]]
                
                if actual_ids != expected_ids:
                    self.log_test("Phase 2 Question IDs", False, f"Area {area_id}: expected {expected_ids}, got {actual_ids}")
                    return False
            
            self.log_test("Phase 2 Areas", True, f"5 areas with 4 questions each, all question IDs correct")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Phase 2 Areas", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False
    
    def test_phase2_weighted_compatibility(self):
        """Test Phase 2 submission with weighted compatibility calculation"""
        if not self.relationship_id:
            self.log_test("Phase 2 Weighted Compatibility", False, "No relationship ID available")
            return False
        
        # Get areas first
        response = self.make_request("GET", "/phase2/areas")
        if not response or response.status_code != 200:
            self.log_test("Phase 2 Weighted Compatibility (Get Areas)", False, "Could not get areas")
            return False
        
        result = response.json()
        areas_dict = result.get("areas", {})
        order = result.get("order", [])
        
        # Convert to list format for easier testing
        areas = []
        for area_id in order:
            if area_id in areas_dict:
                area_data = areas_dict[area_id]
                areas.append({
                    "id": area_id,
                    "name": area_data["name"],
                    "questions": area_data["questions"]
                })
        
        # Submit responses for all 5 areas with specific values to test weighted calculation
        test_values = {
            "comunicazione": 4,  # 100% (4/4 * 100)
            "valori": 1,         # 25% (1/4 * 100)  
            "bisogni_emotivi": 4, # 100% (4/4 * 100)
            "conflitto": 2,      # 50% (2/4 * 100)
            "stabilita": 3       # 75% (3/4 * 100)
        }
        
        # Expected weighted average: 
        # comunicazione(100%) * 0.25 + bisogni_emotivi(100%) * 0.25 + valori(25%) * 0.20 + conflitto(50%) * 0.15 + stabilita(75%) * 0.15
        # = 25 + 25 + 5 + 7.5 + 11.25 = 73.75%
        expected_weighted_avg = 73.75
        
        for area in areas:
            area_id = area["id"]
            questions = area["questions"]
            
            # Create responses for this area
            responses = {}
            for q in questions:
                responses[q["id"]] = test_values[area_id]
            
            # Submit area
            data = {
                "area_id": area_id,
                "responses": responses
            }
            
            response = self.make_request("POST", f"/phase2/{self.relationship_id}/area", data)
            
            if not response or response.status_code != 200:
                error_msg = response.text if response else "No response"
                self.log_test("Phase 2 Area Submit", False, f"Area {area_id} failed: {error_msg}")
                return False
        
        # Get the final relationship to check compatibility
        response = self.make_request("GET", "/relationships")
        if not response or response.status_code != 200:
            self.log_test("Phase 2 Weighted Compatibility (Get Relationship)", False, "Could not get relationships")
            return False
        
        relationships = response.json()
        test_relationship = None
        for rel in relationships:
            if rel["id"] == self.relationship_id:
                test_relationship = rel
                break
        
        if not test_relationship:
            self.log_test("Phase 2 Weighted Compatibility", False, "Test relationship not found")
            return False
        
        # Check compatibility calculation
        actual_compatibility = test_relationship.get("latest_compatibility")
        if actual_compatibility is None:
            self.log_test("Phase 2 Weighted Compatibility", False, "No compatibility score found")
            return False
        
        # Allow small floating point differences
        if abs(actual_compatibility - expected_weighted_avg) > 0.1:
            self.log_test("Phase 2 Weighted Compatibility", False, f"Expected {expected_weighted_avg}%, got {actual_compatibility}%")
            return False
        
        # Check awareness plan for all_area_scores
        response = self.make_request("GET", f"/phase2/{self.relationship_id}")
        if response and response.status_code == 200:
            phase2_response = response.json()
            awareness_plan = phase2_response.get("awareness_plan", {})
            all_area_scores = awareness_plan.get("all_area_scores", [])
            
            if len(all_area_scores) != 5:
                self.log_test("Phase 2 All Area Scores", False, f"Expected 5 area scores, got {len(all_area_scores)}")
                return False
            
            # Check each area score has required fields
            for area_score in all_area_scores:
                required_fields = ["area", "area_id", "score", "weight"]
                for field in required_fields:
                    if field not in area_score:
                        self.log_test("Phase 2 All Area Scores", False, f"Missing field {field} in area score")
                        return False
            
            self.log_test("Phase 2 Weighted Compatibility", True, f"Weighted compatibility: {actual_compatibility}% (expected: {expected_weighted_avg}%), all_area_scores: {len(all_area_scores)} entries")
            return True
        else:
            self.log_test("Phase 2 Weighted Compatibility", False, "Could not get awareness plan")
            return False
    
    def test_intro_video(self):
        """Test intro video endpoint"""
        response = self.make_request("GET", "/intro-video")
        
        if response and response.status_code == 200:
            result = response.json()
            
            # Check expected structure
            if "url" not in result or "has_video" not in result:
                self.log_test("Intro Video", False, "Missing url or has_video fields")
                return False
            
            # Check expected values (no video uploaded)
            if result["url"] is not None or result["has_video"] is not False:
                self.log_test("Intro Video", False, f"Expected url=null, has_video=false, got url={result['url']}, has_video={result['has_video']}")
                return False
            
            self.log_test("Intro Video", True, f"Response: {result}")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Intro Video", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False
    
    def run_full_flow_test(self):
        """Run complete flow test as requested"""
        print("🚀 Starting Full Flow Test: Register → Phase1 (15 responses) → Create Relationship → Phase2 (5 areas x 4 questions) → Verify Results")
        print("=" * 80)
        
        # Step 1: Register
        if not self.test_user_registration():
            return False
        
        # Step 2: Phase 1 Questions (15 questions)
        if not self.test_phase1_questions():
            return False
        
        # Step 3: Phase 1 Submit (15 responses)
        if not self.test_phase1_submit():
            return False
        
        # Step 4: Create Relationship
        if not self.test_create_relationship():
            return False
        
        # Step 5: Phase 2 Areas (5 areas x 4 questions)
        if not self.test_phase2_areas():
            return False
        
        # Step 6: Phase 2 Weighted Compatibility
        if not self.test_phase2_weighted_compatibility():
            return False
        
        # Step 7: Intro Video
        if not self.test_intro_video():
            return False
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result["status"])
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result["status"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result["status"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if "✅ PASS" in result["status"]:
                print(f"  - {result['test']}")

def main():
    """Main test execution"""
    print("🧪 Backend API Testing Suite - Updated Questions & Intro Video")
    print(f"🌐 Testing against: {BASE_URL}")
    print(f"📧 Test user: {TEST_EMAIL}")
    
    tester = BackendTester()
    
    try:
        success = tester.run_full_flow_test()
        tester.print_summary()
        
        if success:
            print("\n🎉 ALL TESTS PASSED! Backend is ready.")
            return 0
        else:
            print("\n💥 SOME TESTS FAILED! Check the details above.")
            return 1
            
    except Exception as e:
        print(f"\n💥 Test execution failed: {e}")
        return 1

if __name__ == "__main__":
    exit(main())