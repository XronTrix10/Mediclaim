from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import router as auth_router
from app.database import init_db, close_pool

app = FastAPI(
    title="Mediclaim Authentication API",
    description="Authentication and onboarding endpoints from the Mediclaim API contract.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your frontend origin in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

@app.on_event("shutdown")
def shutdown():
    close_pool()

app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
