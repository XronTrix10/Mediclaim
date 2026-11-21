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
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@mediclaim.gov.in")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@123")

# Document storage & mandatory Gemini parsing settings
STORAGE_DIR = os.getenv("STORAGE_DIR", "/data/uploads")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
PARSER_TIMEOUT_SECONDS = float(os.getenv("PARSER_TIMEOUT_SECONDS", "60.0"))
