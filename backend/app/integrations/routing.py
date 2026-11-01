import httpx
from typing import Tuple
from app.config import settings
from app.database import haversine_distance_km

async def get_route_distance_and_eta(
    from_lat: float, from_lng: float,
    to_lat: float, to_lng: float
) -> Tuple[float, float, str]:
    """
    Returns (distance_km, eta_minutes, routing_source).
    Queries OSRM if available, otherwise falls back to Haversine * 1.4 road winding factor.
    """
    url = f"{settings.OSRM_BASE_URL}/route/v1/driving/{from_lng},{from_lat};{to_lng},{to_lat}?overview=false"
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if "routes" in data and len(data["routes"]) > 0:
                    distance_m = data["routes"][0]["distance"]
                    duration_s = data["routes"][0]["duration"]
                    return round(distance_m / 1000.0, 2), round(duration_s / 60.0, 1), "osrm"
    except Exception:
        pass
    
    # Fallback to haversine * 1.4 (typical urban road network winding factor)
    straight_km = haversine_distance_km(from_lat, from_lng, to_lat, to_lng)
    road_km = round(straight_km * 1.4, 2)
    # Estimate 30 km/h average city speed => road_km / 30 * 60 minutes
    eta_mins = round((road_km / 30.0) * 60.0, 1)
    return road_km, eta_mins, "haversine_fallback"
