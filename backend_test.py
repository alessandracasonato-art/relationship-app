#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BACKEND_URL = "https://connection-tracker-8.preview.emergentagent.com/api"

def test_weighted_compatibility_calculation():
    """
    Test Phase 2 weighted compatibility calculation with specific values
    to verify weighted vs simple average calculation.
    """
    print("🧪 Testing Phase 2 Weighted Compatibility Calculation")
    print("=" * 60)
    
    # Test data for registration
    test_email = f"testuser_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
    test_password = "TestPassword123!"
    
    session = requests.Session()
    
    try:
        # Step 1: Register a new user
        print("1️⃣ Registering new user...")
        register_data = {
            "email": test_email,
            "password": test_password
        }
        
        response = session.post(f"{BACKEND_URL}/auth/register", json=register_data)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ Registration failed: {response.text}")
            return False
            
        auth_data = response.json()
        token = auth_data["access_token"]
        user_id = auth_data["user"]["id"]
        
        # Set authorization header for subsequent requests
        session.headers.update({"Authorization": f"Bearer {token}"})
        print(f"   ✅ User registered successfully: {user_id}")
        
        # Step 2: Complete Phase 1 (10 questions with specific IDs)
        print("\n2️⃣ Completing Phase 1...")
        phase1_responses = {
            "energia_1": 3,
            "energia_2": 3,
            "gestione_1": 3,
            "gestione_2": 3,
            "bisogni_1": 3,
            "bisogni_2": 3,
            "decisionale_1": 3,
            "decisionale_2": 3,
            "cambiamento_1": 3,
            "cambiamento_2": 3
        }
        
        phase1_data = {"responses": phase1_responses}
        response = session.post(f"{BACKEND_URL}/phase1", json=phase1_data)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ Phase 1 submission failed: {response.text}")
            return False
            
        print("   ✅ Phase 1 completed successfully")
        
        # Step 3: Create a relationship
        print("\n3️⃣ Creating relationship...")
        relationship_data = {
            "person_name": "Test Partner",
            "relationship_type": "romantic"
        }
        
        response = session.post(f"{BACKEND_URL}/relationships", json=relationship_data)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ Relationship creation failed: {response.text}")
            return False
            
        relationship = response.json()
        relationship_id = relationship["id"]
        print(f"   ✅ Relationship created: {relationship_id}")
        
        # Step 4: Complete all 5 Phase 2 areas with specific scores
        print("\n4️⃣ Completing Phase 2 areas...")
        
        # Area responses with specific scores to test weighted calculation
        area_responses = {
            "comunicazione": {"p2_comm_1": 4, "p2_comm_2": 4, "p2_comm_3": 4},  # 100% score
            "valori": {"p2_val_1": 1, "p2_val_2": 1, "p2_val_3": 1},           # 25% score  
            "bisogni_emotivi": {"p2_emo_1": 4, "p2_emo_2": 4, "p2_emo_3": 4},  # 100% score
            "conflitto": {"p2_conf_1": 2, "p2_conf_2": 2, "p2_conf_3": 2},     # 50% score
            "stabilita": {"p2_stab_1": 3, "p2_stab_2": 3, "p2_stab_3": 3}      # 75% score
        }
        
        # Expected scores for each area
        expected_scores = {
            "comunicazione": 100.0,  # (4+4+4)/3/4*100 = 100
            "valori": 25.0,          # (1+1+1)/3/4*100 = 25
            "bisogni_emotivi": 100.0, # (4+4+4)/3/4*100 = 100
            "conflitto": 50.0,       # (2+2+2)/3/4*100 = 50
            "stabilita": 75.0        # (3+3+3)/3/4*100 = 75
        }
        
        # Expected weighted compatibility: (100*0.25) + (25*0.20) + (100*0.25) + (50*0.15) + (75*0.15)
        # = 25 + 5 + 25 + 7.5 + 11.25 = 73.75
        expected_weighted_compatibility = 73.75
        
        # Simple average would be: (100+25+100+50+75)/5 = 70.0
        simple_average = 70.0
        
        print(f"   Expected weighted compatibility: {expected_weighted_compatibility}")
        print(f"   Simple average would be: {simple_average}")
        
        # Submit areas in order
        area_order = ["comunicazione", "valori", "bisogni_emotivi", "conflitto", "stabilita"]
        final_response = None
        
        for i, area_id in enumerate(area_order):
            print(f"   Submitting area {i+1}/5: {area_id}")
            
            area_data = {
                "area_id": area_id,
                "responses": area_responses[area_id]
            }
            
            response = session.post(f"{BACKEND_URL}/phase2/{relationship_id}/area", json=area_data)
            print(f"     Status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"     ❌ Area {area_id} submission failed: {response.text}")
                return False
                
            area_result = response.json()
            
            # Check individual area score
            if "area_scores" in area_result and area_id in area_result["area_scores"]:
                actual_score = area_result["area_scores"][area_id]
                expected_score = expected_scores[area_id]
                print(f"     Area score: {actual_score} (expected: {expected_score})")
                
                if abs(actual_score - expected_score) > 0.1:
                    print(f"     ❌ Area score mismatch for {area_id}")
                    return False
            
            # Store final response for compatibility check
            if i == len(area_order) - 1:  # Last area
                final_response = area_result
                
            print(f"     ✅ Area {area_id} completed")
        
        # Step 5: Verify final compatibility calculation
        print("\n5️⃣ Verifying weighted compatibility calculation...")
        
        if not final_response:
            print("   ❌ No final response received")
            return False
            
        # Check initial_compatibility
        if "initial_compatibility" not in final_response:
            print("   ❌ initial_compatibility not found in response")
            return False
            
        actual_compatibility = final_response["initial_compatibility"]
        print(f"   Actual compatibility: {actual_compatibility}")
        print(f"   Expected weighted: {expected_weighted_compatibility}")
        print(f"   Simple average: {simple_average}")
        
        # Verify it's the weighted average, not simple average
        if abs(actual_compatibility - expected_weighted_compatibility) < 0.1:
            print("   ✅ Weighted compatibility calculation is CORRECT")
        elif abs(actual_compatibility - simple_average) < 0.1:
            print("   ❌ Using simple average instead of weighted average")
            return False
        else:
            print(f"   ❌ Compatibility calculation is incorrect: {actual_compatibility}")
            return False
        
        # Step 6: Verify awareness_plan structure
        print("\n6️⃣ Verifying awareness_plan structure...")
        
        if "awareness_plan" not in final_response:
            print("   ❌ awareness_plan not found in response")
            return False
            
        awareness_plan = final_response["awareness_plan"]
        
        # Check all_area_scores array
        if "all_area_scores" not in awareness_plan:
            print("   ❌ all_area_scores not found in awareness_plan")
            return False
            
        all_area_scores = awareness_plan["all_area_scores"]
        
        if len(all_area_scores) != 5:
            print(f"   ❌ Expected 5 areas in all_area_scores, got {len(all_area_scores)}")
            return False
            
        print("   ✅ all_area_scores array has 5 entries")
        
        # Verify each area entry has required fields
        required_fields = ["area", "area_id", "score", "weight"]
        for area_entry in all_area_scores:
            for field in required_fields:
                if field not in area_entry:
                    print(f"   ❌ Missing field '{field}' in area entry")
                    return False
                    
        print("   ✅ All area entries have required fields (area, area_id, score, weight)")
        
        # Check harmony_areas and observe_areas
        if "harmony_areas" not in awareness_plan:
            print("   ❌ harmony_areas not found in awareness_plan")
            return False
            
        if "observe_areas" not in awareness_plan:
            print("   ❌ observe_areas not found in awareness_plan")
            return False
            
        harmony_areas = awareness_plan["harmony_areas"]
        observe_areas = awareness_plan["observe_areas"]
        
        # Expected: harmony (score >= 70): comunicazione, bisogni_emotivi, stabilita
        # Expected: observe (score < 70): valori, conflitto
        expected_harmony = {"comunicazione", "bisogni_emotivi", "stabilita"}
        expected_observe = {"valori", "conflitto"}
        
        actual_harmony = {area["area_id"] for area in harmony_areas}
        actual_observe = {area["area_id"] for area in observe_areas}
        
        print(f"   Harmony areas: {actual_harmony} (expected: {expected_harmony})")
        print(f"   Observe areas: {actual_observe} (expected: {expected_observe})")
        
        if actual_harmony == expected_harmony and actual_observe == expected_observe:
            print("   ✅ Areas correctly classified into harmony and observe")
        else:
            print("   ❌ Areas incorrectly classified")
            return False
            
        # Verify weight fields in harmony and observe areas
        for area in harmony_areas + observe_areas:
            if "weight" not in area:
                print(f"   ❌ Missing weight field in area: {area.get('area_id', 'unknown')}")
                return False
                
        print("   ✅ All areas have weight field")
        
        print("\n" + "=" * 60)
        print("🎉 ALL TESTS PASSED!")
        print("✅ Weighted compatibility calculation is working correctly")
        print("✅ Awareness plan structure is correct")
        print("✅ Areas are properly classified")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    success = test_weighted_compatibility_calculation()
    sys.exit(0 if success else 1)