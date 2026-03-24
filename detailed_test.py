#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BACKEND_URL = "https://connection-tracker-8.preview.emergentagent.com/api"

def test_detailed_response_structure():
    """
    Test the detailed structure of the Phase 2 response to verify all fields
    """
    print("🔍 Testing Detailed Phase 2 Response Structure")
    print("=" * 60)
    
    # Test data for registration
    test_email = f"detailtest_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
    test_password = "TestPassword123!"
    
    session = requests.Session()
    
    try:
        # Quick setup: Register, Phase 1, Create relationship
        register_data = {"email": test_email, "password": test_password}
        response = session.post(f"{BACKEND_URL}/auth/register", json=register_data)
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        phase1_responses = {f"{cat}_{i}": 3 for cat in ["energia", "gestione", "bisogni", "decisionale", "cambiamento"] for i in [1, 2]}
        session.post(f"{BACKEND_URL}/phase1", json={"responses": phase1_responses})
        
        relationship_data = {"person_name": "Detail Test Partner", "relationship_type": "romantic"}
        relationship = session.post(f"{BACKEND_URL}/relationships", json=relationship_data).json()
        relationship_id = relationship["id"]
        
        # Complete all Phase 2 areas
        area_responses = {
            "comunicazione": {"p2_comm_1": 4, "p2_comm_2": 4, "p2_comm_3": 4},
            "valori": {"p2_val_1": 1, "p2_val_2": 1, "p2_val_3": 1},
            "bisogni_emotivi": {"p2_emo_1": 4, "p2_emo_2": 4, "p2_emo_3": 4},
            "conflitto": {"p2_conf_1": 2, "p2_conf_2": 2, "p2_conf_3": 2},
            "stabilita": {"p2_stab_1": 3, "p2_stab_2": 3, "p2_stab_3": 3}
        }
        
        area_order = ["comunicazione", "valori", "bisogni_emotivi", "conflitto", "stabilita"]
        final_response = None
        
        for area_id in area_order:
            area_data = {"area_id": area_id, "responses": area_responses[area_id]}
            response = session.post(f"{BACKEND_URL}/phase2/{relationship_id}/area", json=area_data)
            final_response = response.json()
        
        print("📋 Final Response Structure:")
        print(json.dumps(final_response, indent=2, default=str))
        
        # Verify specific structure requirements
        print("\n🔍 Detailed Verification:")
        
        # Check all_area_scores structure
        all_area_scores = final_response["awareness_plan"]["all_area_scores"]
        print(f"\n📊 all_area_scores ({len(all_area_scores)} entries):")
        
        expected_weights = {
            "comunicazione": 25,
            "bisogni_emotivi": 25,
            "valori": 20,
            "conflitto": 15,
            "stabilita": 15
        }
        
        for area_entry in all_area_scores:
            area_id = area_entry["area_id"]
            area_name = area_entry["area"]
            score = area_entry["score"]
            weight = area_entry["weight"]
            
            print(f"   {area_id}: {area_name} - Score: {score}%, Weight: {weight}%")
            
            # Verify weight is correct
            expected_weight = expected_weights.get(area_id, 0)
            if weight != expected_weight:
                print(f"   ❌ Weight mismatch for {area_id}: got {weight}%, expected {expected_weight}%")
                return False
        
        print("\n✅ All weights are correct!")
        
        # Verify harmony and observe areas have weight field
        harmony_areas = final_response["awareness_plan"]["harmony_areas"]
        observe_areas = final_response["awareness_plan"]["observe_areas"]
        
        print(f"\n🎵 Harmony Areas ({len(harmony_areas)} entries):")
        for area in harmony_areas:
            print(f"   {area['area_id']}: {area['area']} - Score: {area['score']}%, Weight: {area['weight']}%")
            
        print(f"\n👁️ Observe Areas ({len(observe_areas)} entries):")
        for area in observe_areas:
            print(f"   {area['area_id']}: {area['area']} - Score: {area['score']}%, Weight: {area['weight']}%")
        
        print("\n🎉 Detailed structure verification PASSED!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = test_detailed_response_structure()
    sys.exit(0 if success else 1)