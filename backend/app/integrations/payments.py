import uuid
from typing import Dict, Any

class MockPaymentProvider:
    @staticmethod
    def authorize(booking_id: str, amount_paise: int) -> Dict[str, Any]:
        return {
            "success": True,
            "provider": "mock",
            "provider_ref": f"mock_auth_{uuid.uuid4().hex[:12]}",
            "amount_paise": amount_paise,
            "status": "authorized",
            "simulated": True
        }

    @staticmethod
    def capture(booking_id: str, provider_ref: str, final_amount_paise: int) -> Dict[str, Any]:
        return {
            "success": True,
            "provider": "mock",
            "provider_ref": provider_ref,
            "amount_paise": final_amount_paise,
            "status": "captured",
            "simulated": True
        }

    @staticmethod
    def refund(booking_id: str, provider_ref: str, amount_paise: int) -> Dict[str, Any]:
        return {
            "success": True,
            "provider": "mock",
            "provider_ref": provider_ref,
            "amount_paise": amount_paise,
            "status": "refunded",
            "simulated": True
        }

payment_provider = MockPaymentProvider()
