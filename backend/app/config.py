import os

# Helper to load .env when running locally outside docker-compose
for env_path in [
    os.path.join(os.path.dirname(__file__), "..", ".env"),
    os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
    ".env",
    "backend/.env",
]:
    if os.path.isfile(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip('"').strip("'")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview").strip()
PARSER_TIMEOUT_SECONDS = float(os.getenv("PARSER_TIMEOUT_SECONDS", "60.0"))

# Brevo Transactional Email Configuration
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "").strip()
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "").strip()
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "Mediclaim").strip()

