"""FastAPI application entry point for Locksmith Marketplace."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api import admin_router, customer_router, webhooks_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print("🔐 Locksmith Marketplace API starting...")
    yield
    # Shutdown
    print("🔐 Locksmith Marketplace API shutting down...")


app = FastAPI(
    title="Locksmith Marketplace API",
    description="On-demand locksmith marketplace with admin-first operations",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(admin_router)
app.include_router(customer_router)
app.include_router(webhooks_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "locksmith-api"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Locksmith Marketplace API",
        "version": "1.0.0",
        "docs": "/docs",
    }
