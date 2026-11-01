from typing import Dict
from app.config import settings

def calculate_costs(
    energy_kwh: float,
    price_per_kwh_paise: int,
    duration_hours: float = 1.0,
    time_fee_per_hour_paise: int = 0,
    idle_hours: float = 0.0,
    idle_fee_per_hour_paise: int = 0
) -> Dict[str, int]:
    """
    Computes pricing according to Section 9 of PRD:
    energy_charge = energy_kwh * price_per_kwh
    time_fee = billable_hours * time_fee_per_hour (optional)
    idle_fee = overstay_hours * idle_fee_per_hour (optional)
    platform_fee = max(min_fee, platform_pct * energy_charge)
    tax = GST % on platform_fee and energy_charge
    """
    energy_charge = int(round(energy_kwh * price_per_kwh_paise))
    time_fee = int(round(duration_hours * time_fee_per_hour_paise))
    idle_fee = int(round(idle_hours * idle_fee_per_hour_paise))
    
    # Platform fee
    raw_platform_fee = int(round(settings.PLATFORM_FEE_PCT * energy_charge))
    platform_fee = max(settings.PLATFORM_MIN_FEE_PAISE, raw_platform_fee)
    
    # Tax (18% GST)
    tax = int(round(settings.TAX_PCT * (energy_charge + time_fee + idle_fee + platform_fee)))
    
    total = energy_charge + time_fee + idle_fee + platform_fee + tax
    
    return {
        "energy_cost_paise": energy_charge,
        "time_fee_paise": time_fee,
        "idle_fee_paise": idle_fee,
        "platform_fee_paise": platform_fee,
        "tax_paise": tax,
        "total_paise": total,
        # Rupee representation for convenience
        "energy_cost_rupees": round(energy_charge / 100.0, 2),
        "total_rupees": round(total / 100.0, 2)
    }

def estimate_charging_time_and_energy(
    current_battery_pct: float,
    target_battery_pct: float,
    battery_kwh: float,
    charger_power_kw: float,
    vehicle_max_kw: float
) -> Dict[str, float]:
    """
    Energy and duration formulas per PRD section 9.2:
    energy_needed_kwh = (target_pct - current_pct)/100 * battery_kwh / charging_efficiency (0.90)
    effective_power_kw = min(charger.power_kw, vehicle.max_ac_kw)
    duration_hours = energy_needed_kwh / effective_power_kw (+ taper if >80%)
    """
    delta_pct = max(0.0, target_battery_pct - current_battery_pct)
    charging_efficiency = 0.90
    energy_needed_kwh = (delta_pct / 100.0) * battery_kwh / charging_efficiency
    
    effective_power_kw = min(charger_power_kw, vehicle_max_kw)
    if effective_power_kw <= 0:
        effective_power_kw = 3.3
        
    duration_hours = energy_needed_kwh / effective_power_kw
    if target_battery_pct > 80.0:
        # 15% taper factor for battery protection zone
        duration_hours *= 1.15
        
    return {
        "energy_needed_kwh": round(energy_needed_kwh, 2),
        "effective_power_kw": round(effective_power_kw, 2),
        "duration_hours": round(duration_hours, 2),
        "duration_minutes": round(duration_hours * 60, 1)
    }
