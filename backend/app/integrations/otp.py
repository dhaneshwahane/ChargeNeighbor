from typing import Dict, Any

class MockOTPService:
    @staticmethod
    def send_otp(phone: str) -> str:
        # Default prototype OTP is 123456
        return "123456"

    @staticmethod
    def verify_otp(phone: str, otp: str) -> bool:
        return otp.strip() in ["123456", "000000"]

otp_service = MockOTPService()
