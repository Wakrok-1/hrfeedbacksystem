"""Seed a test vendor account."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.config import settings
from app.models.user import User, UserRole
from app.services.auth_service import hash_password

engine = create_async_engine(settings.DATABASE_URL)
Session = async_sessionmaker(engine, expire_on_commit=False)

async def seed():
    async with Session() as db:
        vendor = User(
            email=None,
            phone="+60123456789",
            password_hash=hash_password("Vendor@1234"),
            full_name="Canteen Vendor",
            role=UserRole.vendor,
            plant="P1",
            is_active=True,
        )
        db.add(vendor)
        await db.commit()
        print(f"Seeded vendor: phone=+60123456789 / Vendor@1234")

asyncio.run(seed())
