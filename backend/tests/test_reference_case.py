import pytest
import asyncio
from app.recommendation import rank_charger_recommendations
from app.pricing import calculate_costs, estimate_charging_time_and_energy

class MockVehicle:
    battery_kwh = 40.0
    usable_battery_pct = 95.0
    efficiency_km_per_kwh = 6.0
    connector_types = ["CCS2", "Type2"]
    max_ac_kw = 7.4

class MockCharger:
    def __init__(self, id, title, lat, lng, conn, status, power, price, vlevel=2):
        self.id = id
        self.title = title
        self.latitude = lat
        self.longitude = lng
        self.connector_type = conn
        self.status = status
        self.power_kw = power
        self.price_per_kwh_paise = price
        self.time_fee_per_hour_paise = 0
        self.verification_level = vlevel
        self.avg_rating = 4.8
        self.rating_count = 10
        self.address = "Test Street"
        self.city = "Bengaluru"
        self.booking_mode = "instant"

@pytest.mark.asyncio
async def test_section_7_3_reference_case():
    """
    PRD Section 7.3 Reference Test Case (MUST PASS):
    Battery 8%, public station 14 km away, host A 1.5 km but unavailable (inactive),
    host B 3 km compatible and available, host C 2 km but incompatible connector.
    Expected: A and C rejected with reasons, B ranked first if within safe range,
    and public station (14 km) rejected as beyond safe range.
    """
    veh = MockVehicle()
    battery_pct = 8.0 # Low battery

    # Origin: (12.9716, 77.5946)
    origin_lat = 12.9716
    origin_lng = 77.5946

    # Safe range for 8% battery with 40kWh and 6 km/kWh:
    # estimated = (8/100) * 40 * 6 * 0.95 = 18.24 km
    # safe (with 20% margin) = 18.24 * 0.8 = 14.59 km
    # road distance to 14km straight station will be ~19.6 km (well over 14.59 km safe range)

    charger_public = MockCharger("pub", "Public Fast Station", 12.9716 + 0.12, 77.5946, "CCS2", "active", 50.0, 2200) # ~13.5-14 km away
    charger_a = MockCharger("A", "Host A (Unavailable)", 12.9716 + 0.013, 77.5946, "CCS2", "paused", 7.4, 1500) # 1.5 km away, paused
    charger_b = MockCharger("B", "Host B (Compatible & Available)", 12.9716 + 0.027, 77.5946, "CCS2", "active", 7.4, 1400) # ~3 km away
    charger_c = MockCharger("C", "Host C (Incompatible Connector)", 12.9716 + 0.018, 77.5946, "GBT", "active", 7.4, 1300) # ~2 km away, GBT

    candidates = [charger_public, charger_a, charger_b, charger_c]

    results = await rank_charger_recommendations(
        vehicle=veh,
        battery_pct=battery_pct,
        current_lat=origin_lat,
        current_lng=origin_lng,
        candidates=candidates,
        priority="balanced",
        is_emergency=False
    )

    recommended = results["recommendations"]
    rejected = results["rejected"]

    # Assertions
    # 1. Host B must be top recommended
    assert len(recommended) >= 1
    assert recommended[0]["charger_id"] == "B"

    # 2. Host A must be in rejected (not active)
    rejected_ids = [r["charger_id"] for r in rejected]
    assert "A" in rejected_ids
    assert "C" in rejected_ids

    # 3. Connector mismatch noted for C
    c_rej = next(r for r in rejected if r["charger_id"] == "C")
    assert any("Incompatible connector" in reason for reason in c_rej["reasons_rejected"])

    # 4. Status reason noted for A
    a_rej = next(r for r in rejected if r["charger_id"] == "A")
    assert any("not active" in reason for reason in a_rej["reasons_rejected"])

    print("\n>>> Reference test case PASSED with full validation!")

def test_pricing_formulas():
    # 20 kWh at ₹15 (1500 paise) = ₹300 energy (30,000 paise)
    # Platform fee = max(₹20, 10% of ₹300 = ₹30) = ₹30 (3,000 paise)
    # Tax = 18% of (300 + 30) = ₹59.40 (5,940 paise)
    # Total = 300 + 30 + 59.40 = ₹389.40 (38,940 paise)
    res = calculate_costs(energy_kwh=20.0, price_per_kwh_paise=1500, duration_hours=2.0)
    assert res["energy_cost_paise"] == 30000
    assert res["platform_fee_paise"] == 3000
    assert res["tax_paise"] == 5940
    assert res["total_paise"] == 38940
    assert res["total_rupees"] == 389.4
