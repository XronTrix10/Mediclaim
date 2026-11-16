import uuid
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.database import init_db, close_pool
from app.exceptions import (
    APIProblemException,
    api_problem_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)
from app.routes.auth import router as auth_router
from app.routes.patients import router as patients_router
from app.routes.records import router as records_router
from app.routes.timeline import router as timeline_router
from app.routes.consent import router as consent_router
from app.routes.doctor import router as doctor_router
from app.routes.emergency import router as emergency_router
from app.routes.audit import router as audit_router
from app.routes.corrections import router as corrections_router
from app.routes.uploads import router as uploads_router
from app.routes.admin import router as admin_router






app = FastAPI(
    title="Mediclaim Healthcare API",
    description="Backend API conforming to HL7 FHIR R4 and the Mediclaim Specification.",
    version="2.0.0",
)

# Attach request ID to state for tracing
@app.middleware("http")
async def add_request_id_middleware(request: Request, call_next):
    request.state.request_id = f"req_{uuid.uuid4().hex[:12]}"
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers adhering to RFC 9457 / RFC 7807
app.add_exception_handler(APIProblemException, api_problem_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

@app.on_event("startup")
def startup():
    init_db()

@app.on_event("shutdown")
def shutdown():
    close_pool()

# Include routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(patients_router, prefix="/api/v1/patients", tags=["Patients"])
app.include_router(records_router, prefix="/api/v1/records", tags=["Clinical Records"])
app.include_router(timeline_router, prefix="/api/v1/timeline", tags=["Timeline & Graph"])
app.include_router(consent_router, prefix="/api/v1/consent", tags=["Doctor Consent & Caregivers"])
app.include_router(doctor_router, prefix="/api/v1/doctor", tags=["Doctor Portal Access"])
app.include_router(emergency_router, prefix="/api/v1/emergency", tags=["Emergency Break-Glass"])
app.include_router(audit_router, prefix="/api/v1/audit", tags=["Audit Logging"])
app.include_router(corrections_router, prefix="/api/v1/corrections", tags=["Clinical Corrections"])
app.include_router(uploads_router, prefix="/api/v1", tags=["Documents & Uploads"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["Administrator Portal"])






@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
