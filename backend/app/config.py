import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://mediclaim:mediclaim_secret_password@localhost:5432/mediclaim"
)
JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_THIS_DEVELOPMENT_SECRET_BEFORE_DEPLOYMENT")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_SECONDS = 24 * 60 * 60
OTP_SECONDS = 300
OTP_DEBUG = os.getenv("OTP_DEBUG", "true").lower() == "true"
