"""Database connection and session management."""

from functools import lru_cache
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker, AsyncEngine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    """Get cached database engine."""
    settings = get_settings()
    return create_async_engine(
        settings.database_url,
        echo=settings.app_env == "development",
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )


@lru_cache
def get_session_maker() -> async_sessionmaker[AsyncSession]:
    """Get cached session maker."""
    return async_sessionmaker(
        get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with get_session_maker()() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables (for development only)."""
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
