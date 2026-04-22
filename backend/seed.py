"""
Run once to seed a superadmin account.
Usage: python seed.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.config import settings
from app.database import Base
from app.models.user import User, UserRole
from app.services.auth_service import hash_password

engine = create_async_engine(settings.DATABASE_URL)
Session = async_sessionmaker(engine, expire_on_commit=False)


async def seed():
    async with Session() as db:
        superadmin = User(
            email="superadmin@jabil.com",
            password_hash=hash_password("Admin@1234"),
            full_name="Super Admin",
            role=UserRole.superadmin,
            plant="P1",
            is_active=True,
        )
        db.add(superadmin)
        await db.commit()
        print(f"Seeded superadmin: {superadmin.email} / Admin@1234")


asyncio.run(seed())
