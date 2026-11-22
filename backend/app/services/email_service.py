import logging
from typing import Optional
import httpx
from app.config import BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME

logger = logging.getLogger("mediclaim.email")

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def send_registration_email(
    to_email: str,
    recipient_name: str,
    mediclaim_id: str
) -> bool:
    """
    Sends a transactional email containing the patient's generated Mediclaim ID via Brevo API.

    Requirements:
    - Contains patient's name
    - Contains Mediclaim ID
    - Contains message explaining that mobile verification and administrator approval are still pending
    - Never raises an unhandled exception: logs failure and returns False so registration is never rolled back or interrupted.
    """
    if not BREVO_API_KEY or not BREVO_SENDER_EMAIL:
        logger.warning(
            "Brevo credentials missing (BREVO_API_KEY or BREVO_SENDER_EMAIL not configured). "
            "Skipping registration email to %s.",
            to_email
        )
        return False

    sender_name = BREVO_SENDER_NAME or "Mediclaim"
    subject = "Your Mediclaim ID Registration Details"

    text_content = (
        f"Dear {recipient_name},\n\n"
        f"Thank you for registering with Mediclaim.\n\n"
        f"Your allocated Mediclaim ID is: {mediclaim_id}\n\n"
        f"Important Notice:\n"
        f"Your registration has been received, but your account is not yet active. "
        f"Mobile phone verification and administrator approval are currently pending.\n"
        f"Once your mobile number is verified with your OTP and an administrator reviews "
        f"and approves your account details, you will be able to log in using your Mediclaim ID.\n\n"
        f"Best regards,\n"
        f"The Mediclaim Team"
    )

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Mediclaim ID</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="margin-bottom: 24px; text-align: center;">
      <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 700;">Mediclaim</h2>
      <p style="color: #64748b; font-size: 14px; margin-top: 4px;">National Digital Health Records Platform</p>
    </div>
    
    <p style="font-size: 16px; line-height: 1.5; color: #334155;">Dear <strong>{recipient_name}</strong>,</p>
    
    <p style="font-size: 15px; line-height: 1.6; color: #334155;">
      Thank you for registering with Mediclaim. Your account has been initialized and your sovereign Mediclaim ID has been generated:
    </p>
    
    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1;">
      <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; display: block; margin-bottom: 6px;">Your Mediclaim ID</span>
      <span style="font-size: 26px; font-family: monospace; font-weight: 700; color: #0284c7; letter-spacing: 0.1em;">{mediclaim_id}</span>
    </div>
    
    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
      <h4 style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px; font-weight: 600;">Status: Mobile Verification & Admin Approval Pending</h4>
      <p style="margin: 0; font-size: 13.5px; line-height: 1.5; color: #1e3a8a;">
        Please note that <strong>mobile verification</strong> and <strong>administrator approval</strong> are still pending.
        Once you complete OTP verification and an administrator reviews and approves your registration, your account will be activated and you may sign in with your Mediclaim ID.
      </p>
    </div>
    
    <p style="font-size: 14px; line-height: 1.5; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
      If you did not request this registration, please disregard this email or contact support.
    </p>
    
    <p style="font-size: 13px; color: #94a3b8; margin-top: 8px; text-align: center;">
      &copy; Mediclaim. All rights reserved.
    </p>
  </div>
</body>
</html>"""

    payload = {
        "sender": {
            "name": sender_name,
            "email": BREVO_SENDER_EMAIL,
        },
        "to": [
            {
                "email": to_email,
                "name": recipient_name,
            }
        ],
        "subject": subject,
        "htmlContent": html_content,
        "textContent": text_content,
    }

    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(BREVO_API_URL, headers=headers, json=payload)
            resp.raise_for_status()
            logger.info("Sent registration email to %s (status %d)", to_email, resp.status_code)
            return True
    except httpx.HTTPStatusError as exc:
        err_msg = exc.response.text if exc.response else str(exc)
        logger.error(
            "Brevo API error while sending registration email to %s (HTTP %d): %s",
            to_email,
            exc.response.status_code if exc.response else 0,
            err_msg,
            exc_info=True
        )
        return False
    except Exception as exc:
        logger.error(
            "Unexpected error sending registration email to %s: %s",
            to_email,
            exc,
            exc_info=True
        )
        return False
