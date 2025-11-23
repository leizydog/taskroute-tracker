from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from pathlib import Path
import os

# Load config from env
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER"),
    MAIL_FROM_NAME=os.getenv("MAIL_FROM_NAME", "TaskRoute Tracker"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def send_reset_email(email_to: EmailStr, reset_link: str):
    """Sends a real password reset email."""
    
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px;">
                <h2 style="color: #333;">Password Reset Request</h2>
                <p>Hello,</p>
                <p>We received a request to reset your password for TaskRoute Tracker.</p>
                <p>Click the button below to reset it:</p>
                <a href="{reset_link}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Reset Password</a>
                <p>Or copy this link: {reset_link}</p>
                <p style="color: #777; font-size: 12px;">This link expires in 15 minutes.</p>
            </div>
        </body>
    </html>
    """

    message = MessageSchema(
        subject="Reset Your TaskRoute Password",
        recipients=[email_to],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)