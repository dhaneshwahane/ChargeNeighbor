from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import SessionLocal
from app.models import Booking, AlternativeOffer, Notification, Charger

scheduler = BackgroundScheduler()

def expire_pending_bookings():
    """Expires unaccepted pending requests after their timeout window."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        expired = db.query(Booking).filter(
            Booking.status == "pending",
            Booking.expires_at != None,
            Booking.expires_at < now
        ).all()
        for b in expired:
            b.status = "expired"
            # Trigger notification
            db.add(Notification(
                user_id=b.driver_id,
                type="BOOKING_EXPIRED",
                title="Booking Request Expired",
                body=f"Host did not accept booking #{b.id[:8]} in time. We are finding alternatives."
            ))
        db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()

def expire_stale_offers():
    """Expires alternative offers older than window."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        db.query(AlternativeOffer).filter(
            AlternativeOffer.status == "offered",
            AlternativeOffer.expires_at < now
        ).update({"status": "expired"})
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

def start_scheduler():
    scheduler.add_job(expire_pending_bookings, "interval", minutes=1, id="expire_pending")
    scheduler.add_job(expire_stale_offers, "interval", minutes=1, id="expire_offers")
    scheduler.start()

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
