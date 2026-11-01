from app.database import Base, engine, SessionLocal
from app.models import User, Vehicle, Charger
from app.security import get_password_hash

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if already seeded
    if db.query(User).filter(User.email == "driver@chargeneighbor.com").first():
        print("Database already seeded.")
        db.close()
        return

    print("Seeding initial ChargeNeighbor pilot dataset...")

    # 1. Driver Asha
    driver = User(
        name="Asha Sharma",
        email="driver@chargeneighbor.com",
        phone="+919876543210",
        password_hash=get_password_hash("password123"),
        roles=["driver"],
        phone_verified=True,
        verification_level=1,
        status="active"
    )
    db.add(driver)
    db.flush()

    # Driver vehicle
    nexon = Vehicle(
        owner_id=driver.id,
        make="Tata",
        model="Nexon EV Long Range",
        year=2024,
        battery_kwh=40.5,
        usable_battery_pct=95.0,
        efficiency_km_per_kwh=7.0, # 7 km per kWh
        connector_types=["CCS2", "Type2"],
        max_ac_kw=7.2,
        max_dc_kw=50.0,
        is_default=True
    )
    db.add(nexon)

    # 2. Host Ravi
    host = User(
        name="Ravi Kumar",
        email="host@chargeneighbor.com",
        phone="+919811223344",
        password_hash=get_password_hash("password123"),
        roles=["host", "driver"],
        phone_verified=True,
        verification_level=3,
        status="active"
    )
    db.add(host)
    db.flush()

    # Host 2
    host2 = User(
        name="Priya Patel",
        email="priya@chargeneighbor.com",
        phone="+919899887766",
        password_hash=get_password_hash("password123"),
        roles=["host"],
        phone_verified=True,
        verification_level=4,
        status="active"
    )
    db.add(host2)
    db.flush()

    # 3. Admin Meera
    admin = User(
        name="Meera Rao",
        email="admin@chargeneighbor.com",
        phone="+919800112233",
        password_hash=get_password_hash("admin123"),
        roles=["admin", "driver", "host"],
        phone_verified=True,
        verification_level=4,
        status="active"
    )
    db.add(admin)

    # Seed Chargers (Bengaluru Pilot Hub: Indiranagar, Koramangala, Whitefield)
    chargers_data = [
        {
            "host_id": host.id,
            "title": "Ravi's Solar Green 7.4kW Fast AC",
            "description": "Dedicated driveway parking slot under solar shade. Safe residential colony with CCTV.",
            "address": "14, 12th Main Rd, HAL 2nd Stage, Indiranagar",
            "city": "Bengaluru",
            "latitude": 12.9719,
            "longitude": 77.6412,
            "connector_type": "CCS2",
            "current_type": "AC",
            "power_kw": 7.4,
            "price_per_kwh_paise": 1500, # ₹15.00/kWh
            "booking_mode": "instant",
            "access_instructions": "Gate code #4490. Charger is on the left pillar beside the portico.",
            "verification_level": 3,
            "avg_rating": 4.9,
            "rating_count": 28,
            "status": "active"
        },
        {
            "host_id": host.id,
            "title": "Indiranagar 100ft Rd Type-2 Charger",
            "description": "Convenient EV spot close to cafes and restaurants. High speed reliable 11kW setup.",
            "address": "88, 100 Feet Rd, Indiranagar",
            "city": "Bengaluru",
            "latitude": 12.9750,
            "longitude": 77.6450,
            "connector_type": "Type2",
            "current_type": "AC",
            "power_kw": 11.0,
            "price_per_kwh_paise": 1800, # ₹18.00/kWh
            "booking_mode": "instant",
            "access_instructions": "Ring flat 302 bell or call Ravi. Bay 2 reserved.",
            "verification_level": 2,
            "avg_rating": 4.7,
            "rating_count": 14,
            "status": "active"
        },
        {
            "host_id": host2.id,
            "title": "Priya's Koramangala Verified CCS2 Station",
            "description": "Level 4 certified residential charger with automatic OCPP status tracking.",
            "address": "5th Block, Koramangala near Sony World Signal",
            "city": "Bengaluru",
            "latitude": 12.9352,
            "longitude": 77.6245,
            "connector_type": "CCS2",
            "current_type": "AC",
            "power_kw": 7.4,
            "price_per_kwh_paise": 1400, # ₹14.00/kWh
            "booking_mode": "approval",
            "access_instructions": "Security will direct to slot E-4. RFID card available in lockbox 1234.",
            "verification_level": 4,
            "avg_rating": 5.0,
            "rating_count": 42,
            "status": "active"
        },
        {
            "host_id": host2.id,
            "title": "Whitefield Tech Park EV Haven",
            "description": "Safe, shaded garage charging spot. 22kW heavy duty connector for rapid top-ups.",
            "address": "ITPL Main Rd, Whitefield",
            "city": "Bengaluru",
            "latitude": 12.9833,
            "longitude": 77.7499,
            "connector_type": "CCS2",
            "current_type": "AC",
            "power_kw": 22.0,
            "price_per_kwh_paise": 2000, # ₹20.00/kWh
            "booking_mode": "instant",
            "access_instructions": "Driveway open 24/7. Turn on main switch on the red wall unit.",
            "verification_level": 3,
            "avg_rating": 4.8,
            "rating_count": 19,
            "status": "active"
        }
    ]

    for c in chargers_data:
        db.add(Charger(**c))

    db.commit()
    print("Seed complete! Accounts created:")
    print("Driver: driver@chargeneighbor.com / password123")
    print("Host:   host@chargeneighbor.com / password123")
    print("Admin:  admin@chargeneighbor.com / admin123")
    db.close()

if __name__ == "__main__":
    seed()
