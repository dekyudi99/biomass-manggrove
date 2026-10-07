import logging
import smtplib
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

from app.config import settings


logger = logging.getLogger(__name__)
EMAIL_SUBJECTS = {
    "email_verification": "Your Grovia email verification code",
    "password_reset": "Your Grovia password reset code",
}


class EmailConfigurationError(RuntimeError):
    """Raised when transactional email credentials are not configured."""


def _validate_email_configuration() -> None:
    if not all((settings.SMTP_HOST, settings.SMTP_USERNAME, settings.SMTP_PASSWORD, settings.SMTP_FROM_EMAIL)):
        raise EmailConfigurationError("Transactional email is not configured.")
    if settings.SMTP_PORT not in (25, 465, 587):
        raise EmailConfigurationError("SMTP_PORT must be one of 25, 465, or 587.")
    if settings.SMTP_PORT == 465 and settings.SMTP_USE_TLS:
        raise EmailConfigurationError("Use SMTP_USE_TLS=false with implicit TLS on port 465.")


def send_verification_email(
    to_email: str,
    code: str,
    expires_minutes: int = 10,
    purpose: str = "email_verification",
) -> None:
    _validate_email_configuration()
    if purpose not in EMAIL_SUBJECTS:
        raise ValueError("Unsupported email OTP purpose.")

    is_password_reset = purpose == "password_reset"
    title = "Reset your password" if is_password_reset else "Verify your email"
    instruction = "Use this code to reset the password for your Grovia account:" if is_password_reset else "Use this code to finish creating your Grovia account:"

    message = EmailMessage()
    message["Subject"] = EMAIL_SUBJECTS[purpose]
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    message["Date"] = formatdate(localtime=False, usegmt=True)
    message["Message-ID"] = make_msgid(domain=settings.SMTP_FROM_EMAIL.rsplit("@", 1)[-1])
    message["Reply-To"] = settings.SMTP_REPLY_TO or settings.SMTP_FROM_EMAIL
    message.set_content(
        f"Your Grovia {'password reset' if is_password_reset else 'email verification'} code is {code}.\n\n"
        f"This code expires in {expires_minutes} minutes and can only be used once.\n"
        "If you did not request this code, you can ignore this message.\n"
        "For your security, never share this code with anyone.\n"
    )
    message.add_alternative(
        """<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="max-width:480px;background:#fff;border-radius:16px;padding:32px">
          <tr><td>
            <h1 style="margin:0 0 16px;color:#047857;font-size:24px">""" + title + """</h1>
            <p style="line-height:1.6">""" + instruction + """</p>
            <p style="margin:24px 0;padding:16px;text-align:center;background:#ecfdf5;
              border-radius:12px;color:#065f46;font-size:32px;font-weight:bold;
              letter-spacing:8px">""" + code + """</p>
            <p style="line-height:1.6">The code expires in """ + str(expires_minutes) + """ minutes and can only be used once.</p>
            <p style="color:#475569;font-size:14px;line-height:1.6">
              If you did not request this code, you can ignore this message.
              Never share your code with anyone.
            </p>
            <hr style="margin:24px 0;border:0;border-top:1px solid #e2e8f0">
            <p style="color:#64748b;font-size:12px">Grovia · Mangrove geospatial workspace</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>""",
        subtype="html",
    )

    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
                server.ehlo()
                if settings.SMTP_USE_TLS:
                    server.starttls()
                    server.ehlo()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)
    except (OSError, smtplib.SMTPException):
        logger.exception("Failed to send verification email to configured SMTP recipient.")
        raise