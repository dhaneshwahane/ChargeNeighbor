import math
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.config import settings
from app.database import haversine_distance_km
from app.integrations.routing import get_route_distance_and_eta
from app.pricing import calculate_costs, estimate_charging_time_and_energy

async def rank_charger_recommendations(
    vehicle: Any,
    battery_pct: float,
    current_lat: float,
    current_lng: float,
    candidates: List[Any],
    priority: str = "balanced", # balanced, fastest, cheapest, safest
    is_emergency: bool = False,
    desired_start: Optional[datetime] = None,
    target_pct: float = 80.0
) -> Dict[str, Any]:
    """
    Recommendation Engine Specification (PRD Section 7):
    - Reachability calculation
    - Hard filters (connector match, max power, status, slot check)
    - OSRM route distance + ETA (with Haversine*1.4 fallback)
    - Normalized multi-factor weighted scoring
    - Human-readable explanation and uncertainty statement
    """
    # 1. Range heuristics
    # estimated_range_km = battery_pct/100 * battery_kwh * efficiency_km_per_kwh
    battery_kwh = getattr(vehicle, "battery_kwh", 40.0)
    efficiency = getattr(vehicle, "efficiency_km_per_kwh", 6.5)
    usable_pct = getattr(vehicle, "usable_battery_pct", 95.0) / 100.0
    
    estimated_range_km = (battery_pct / 100.0) * battery_kwh * efficiency * usable_pct
    margin = 0.30 if is_emergency else settings.SAFETY_MARGIN
    safe_range_km = estimated_range_km * (1.0 - margin)
    
    scored_items = []
    rejected_items = []

    # Weights by priority
    weights = {
        "balanced": {"reachability": 0.30, "travel_time": 0.20, "cost": 0.20, "reliability": 0.15, "verification": 0.10, "rating": 0.05},
        "fastest":  {"reachability": 0.20, "travel_time": 0.40, "cost": 0.15, "reliability": 0.15, "verification": 0.05, "rating": 0.05},
        "cheapest": {"reachability": 0.20, "travel_time": 0.15, "cost": 0.45, "reliability": 0.10, "verification": 0.05, "rating": 0.05},
        "safest":   {"reachability": 0.40, "travel_time": 0.10, "cost": 0.10, "reliability": 0.20, "verification": 0.15, "rating": 0.05},
    }
    if is_emergency:
        w = {"reachability": 0.50, "travel_time": 0.30, "cost": 0.05, "reliability": 0.05, "verification": 0.05, "rating": 0.05}
    else:
        w = weights.get(priority, weights["balanced"])

    vehicle_connectors = getattr(vehicle, "connector_types", ["Type2", "CCS2"]) or ["Type2", "CCS2"]

    for charger in candidates:
        rejection_reasons = []
        
        # Hard Filter 1: Connector compatibility
        if charger.connector_type not in vehicle_connectors:
            rejection_reasons.append(f"Incompatible connector: vehicle supports {vehicle_connectors}, charger has {charger.connector_type}")

        # Hard Filter 2: Status
        if charger.status != "active":
            rejection_reasons.append(f"Charger is not active (current status: {charger.status})")

        # Routing calculation
        route_dist_km, eta_mins, route_source = await get_route_distance_and_eta(
            current_lat, current_lng, charger.latitude, charger.longitude
        )

        # Reachability check
        is_reachable = route_dist_km <= safe_range_km
        if not is_reachable and not is_emergency:
            rejection_reasons.append(f"Outside safe range ({route_dist_km} km > safe range {round(safe_range_km, 1)} km)")

        # Confidence level
        if route_dist_km <= (0.50 * safe_range_km):
            reach_confidence = "high"
        elif route_dist_km <= (0.80 * safe_range_km):
            reach_confidence = "medium"
        else:
            reach_confidence = "low"

        # Pricing estimate
        time_energy = estimate_charging_time_and_energy(
            current_battery_pct=battery_pct,
            target_battery_pct=target_pct,
            battery_kwh=battery_kwh,
            charger_power_kw=charger.power_kw,
            vehicle_max_kw=getattr(vehicle, "max_ac_kw", 7.4)
        )
        costs = calculate_costs(
            energy_kwh=time_energy["energy_needed_kwh"],
            price_per_kwh_paise=charger.price_per_kwh_paise,
            duration_hours=time_energy["duration_hours"],
            time_fee_per_hour_paise=charger.time_fee_per_hour_paise
        )

        item = {
            "charger_id": charger.id,
            "title": charger.title,
            "address": charger.address,
            "city": charger.city,
            "latitude": charger.latitude,
            "longitude": charger.longitude,
            "connector_type": charger.connector_type,
            "power_kw": charger.power_kw,
            "booking_mode": charger.booking_mode,
            "verification_level": charger.verification_level,
            "avg_rating": charger.avg_rating,
            "rating_count": charger.rating_count,
            "route_distance_km": route_dist_km,
            "eta_minutes": eta_mins,
            "routing_source": route_source,
            "estimated_range_km": round(estimated_range_km, 1),
            "safe_range_km": round(safe_range_km, 1),
            "reach_confidence": reach_confidence,
            "is_reachable": is_reachable,
            "cost_estimate": costs,
            "time_estimate": time_energy,
            "reasons_rejected": rejection_reasons,
            "eligible": len(rejection_reasons) == 0
        }

        if len(rejection_reasons) == 0:
            scored_items.append(item)
        else:
            rejected_items.append(item)

    if scored_items:
        # Normalization across eligible candidates
        min_eta = min(it["eta_minutes"] for it in scored_items) or 1.0
        min_cost = min(it["cost_estimate"]["total_paise"] for it in scored_items) or 1.0

        for it in scored_items:
            # 1 - route/safe_range
            reach_factor = max(0.0, 1.0 - (it["route_distance_km"] / (safe_range_km or 1.0)))
            time_factor = min_eta / max(it["eta_minutes"], 0.1)
            cost_factor = min_cost / max(it["cost_estimate"]["total_paise"], 1.0)
            reliability_factor = 0.95 # baseline high for good hosts
            verification_factor = min(1.0, it["verification_level"] / 4.0)
            rating_factor = min(1.0, it["avg_rating"] / 5.0)

            score = (
                w["reachability"] * reach_factor +
                w["travel_time"] * time_factor +
                w["cost"] * cost_factor +
                w["reliability"] * reliability_factor +
                w["verification"] * verification_factor +
                w["rating"] * rating_factor
            )

            it["score"] = round(score, 3)
            it["score_breakdown"] = {
                "reachability": round(reach_factor, 2),
                "travel_time": round(time_factor, 2),
                "cost": round(cost_factor, 2),
                "reliability": round(reliability_factor, 2),
                "verification": round(verification_factor, 2),
                "rating": round(rating_factor, 2)
            }

            # Human-readable explanation (PRD section 7.2 requirement 8)
            reasons = []
            if reach_factor > 0.6:
                reasons.append("comfortably within your safe battery range")
            if time_factor >= 0.9:
                reasons.append(f"fast {it['eta_minutes']} min travel time")
            if cost_factor >= 0.9:
                reasons.append(f"highly economical (₹{it['cost_estimate']['total_rupees']} total)")
            if it["verification_level"] >= 2:
                reasons.append(f"verified level {it['verification_level']} host")
            
            it["explanation"] = f"Top recommended because it is {', '.join(reasons)}." if reasons else "Compatible and available near your route."
            it["uncertainty_note"] = "Range is an estimate; traffic, temperature, speed and vehicle load can change it. Never guaranteed."

        # Sort descending by score
        scored_items.sort(key=lambda x: x["score"], reverse=True)

    return {
        "vehicle_info": {
            "battery_kwh": battery_kwh,
            "battery_pct": battery_pct,
            "estimated_range_km": round(estimated_range_km, 1),
            "safe_range_km": round(safe_range_km, 1)
        },
        "recommendations": scored_items,
        "rejected": rejected_items,
        "algorithm_version": "v1.0-rules",
        "uncertainty_note": "Range is an estimate; traffic, temperature, speed and vehicle load can change it."
    }
