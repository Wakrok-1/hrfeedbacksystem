"""
One-time script: set phone on existing vendor account.
Run once, then delete.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.config import settings
from app.models.user import User, UserRole

engine = create_async_engine(settings.DATABASE_URL)
Session = async_sessionmaker(engine, expire_on_commit=False)

async def patch():
    async with Session() as db:
        result = await db.execute(
            select(User).where(User.role == UserRole.vendor).limit(1)
        )
        vendor = result.scalar_one_or_none()
        if not vendor:
            print("No vendor found.")
            return

        vendor.phone = "+60123456789"
        vendor.email = None  # vendors don't need email anymore
        await db.commit()
        print(f"Updated vendor '{vendor.full_name}' → phone={vendor.phone}")

asyncio.run(patch())
