"""
Seed additional vendor_pending complaints for canteen and transport vendors.
Safe to run multiple times — skips existing reference IDs.

Usage: python seed_vendor_complaints.py
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, func

from app.config import settings
from app.models.user import User, UserRole
from app.models.complaint import Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority

engine = create_async_engine(settings.DATABASE_URL)
Session = async_sessionmaker(engine, expire_on_commit=False)

UTC = timezone.utc


def ago(**kwargs) -> datetime:
    return datetime.now(UTC) - timedelta(**kwargs)


async def next_ref(db, category: ComplaintCategory, offset: int = 0) -> str:
    prefix = {"Canteen": "CN", "Transportation": "TR", "ESD": "ES", "Locker": "LK"}[category.value]
    result = await db.execute(
        select(func.count(Complaint.id)).where(Complaint.category == category)
    )
    count = result.scalar_one()
    return f"{prefix}-{str(count + 1 + offset).zfill(3)}"


NEW_COMPLAINTS = [
    # ── Canteen ──────────────────────────────────────────────────────────────
    {
        "category": ComplaintCategory.canteen,
        "priority": ComplaintPriority.urgent,
        "plant": "P1",
        "submitter_name": "Hafizuddin bin Razali",
        "submitter_employee_id": "J031001",
        "submitter_phone": "+60112345671",
        "description": "Ditemui lipas di kawasan kaunter makanan kantin P1 pagi tadi. Ini isu kebersihan kritikal yang perlu ditangani segera sebelum waktu makan tengahari.\n\nCockroach found near the food counter at P1 canteen this morning. Critical hygiene issue that must be resolved before the lunch period.",
        "created_at": ago(hours=1),
    },
    {
        "category": ComplaintCategory.canteen,
        "priority": ComplaintPriority.urgent,
        "plant": "BK",
        "submitter_name": "Rashidah binti Ahmad",
        "submitter_employee_id": "J031002",
        "submitter_phone": "+60112345672",
        "description": "Lebih 5 pekerja line 3 mengalami cirit-birit selepas makan nasi ayam kantin BK semalam dan tidak masuk kerja hari ini. Syak keracunan makanan.\n\nMore than 5 workers from line 3 reported diarrhea after eating the chicken rice at BK canteen yesterday and did not come to work today. Suspected food poisoning.",
        "created_at": ago(hours=2),
    },
    {
        "category": ComplaintCategory.canteen,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Norhayati binti Zainudin",
        "submitter_employee_id": "J031003",
        "submitter_phone": "+60112345673",
        "description": "Kaunter kantin P2 hanya ada satu pekerja semasa waktu puncak. Barisan panjang menyebabkan pekerja tidak sempat makan dalam masa rehat 30 minit.\n\nOnly one canteen staff working the P2 counter during peak hour. Long queues mean workers cannot finish eating within the 30-minute break.",
        "created_at": ago(hours=5),
    },
    {
        "category": ComplaintCategory.canteen,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Zulaikha binti Othman",
        "submitter_employee_id": "J031004",
        "submitter_phone": "+60112345674",
        "description": "Minuman tin dan botol yang dijual di kantin P1 sudah tamat tarikh luput. Saya perasan tarikh pada beberapa tin minuman menunjukkan Mac 2026.\n\nCanned and bottled drinks sold at the P1 canteen are past their expiry date. I noticed the date on several cans showing March 2026.",
        "created_at": ago(hours=8),
    },
    # ── Transportation ────────────────────────────────────────────────────────
    {
        "category": ComplaintCategory.transportation,
        "priority": ComplaintPriority.urgent,
        "plant": "P1",
        "submitter_name": "Farouk bin Jamaludin",
        "submitter_employee_id": "J031005",
        "submitter_phone": "+60112345675",
        "description": "Bas laluan P1-Butterworth tidak datang langsung pagi ini. Lebih 40 pekerja terlepas syif pagi. Ini kali ketiga minggu ini berlaku tanpa sebarang notis.\n\nThe P1-Butterworth bus did not arrive at all this morning. More than 40 workers missed the morning shift. This is the third time this week with no notice given.",
        "created_at": ago(minutes=45),
    },
    {
        "category": ComplaintCategory.transportation,
        "priority": ComplaintPriority.urgent,
        "plant": "P2",
        "submitter_name": "Sarina binti Hamid",
        "submitter_employee_id": "J031006",
        "submitter_phone": "+60112345676",
        "description": "Pemandu bas laluan P2-Perda (Badge: P2-DR-09) didapati memandu dalam keadaan mengantuk dan merbahaya semalam malam. Beberapa penumpang menjerit meminta pemandu berhenti rehat.\n\nThe driver on route P2-Perda (Badge: P2-DR-09) was observed driving drowsily and dangerously last night. Several passengers shouted asking the driver to stop and rest.",
        "created_at": ago(hours=10),
    },
    {
        "category": ComplaintCategory.transportation,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Azrul bin Nizam",
        "submitter_employee_id": "J031007",
        "submitter_phone": "+60112345677",
        "description": "Tempat duduk bas RT-5 banyak yang rosak — kerusi goyang dan beberapa tidak mempunyai tali pinggang keledar. Ini berbahaya kepada keselamatan penumpang.\n\nMany seats on bus RT-5 are damaged — chairs are wobbly and several do not have seatbelts. This is a passenger safety hazard.",
        "created_at": ago(hours=6),
    },
]


async def seed():
    async with Session() as db:
        # Find vendors
        canteen_vendor = (await db.execute(
            select(User).where(User.phone == "+60123456789")
        )).scalar_one_or_none()

        transport_vendor = (await db.execute(
            select(User).where(User.phone == "+60198887766")
        )).scalar_one_or_none()

        if not canteen_vendor or not transport_vendor:
            print("ERROR: Vendors not found. Run seed_demo.py first.")
            return

        # Get existing reference IDs to skip duplicates
        existing_refs = {r[0] for r in (await db.execute(select(Complaint.reference_id))).all()}

        # Count per category upfront for reference ID generation
        cat_counts: dict[ComplaintCategory, int] = {}
        for cat in ComplaintCategory:
            count = (await db.execute(
                select(func.count(Complaint.id)).where(Complaint.category == cat)
            )).scalar_one()
            cat_counts[cat] = count

        added = 0
        for data in NEW_COMPLAINTS:
            cat = data["category"]
            cat_counts[cat] += 1
            prefix = {"Canteen": "CN", "Transportation": "TR", "ESD": "ES", "Locker": "LK"}[cat.value]
            ref_id = f"{prefix}-{str(cat_counts[cat]).zfill(3)}"

            if ref_id in existing_refs:
                print(f"  Skipping {ref_id} (already exists)")
                continue

            vendor = canteen_vendor if cat == ComplaintCategory.canteen else transport_vendor

            complaint = Complaint(
                reference_id=ref_id,
                tracking_token=str(uuid.uuid4()),
                category=cat,
                status=ComplaintStatus.vendor_pending,
                priority=data["priority"],
                plant=data["plant"],
                submitter_name=data["submitter_name"],
                submitter_employee_id=data["submitter_employee_id"],
                submitter_phone=data.get("submitter_phone"),
                description=data["description"],
                assigned_vendor_id=vendor.id,
            )
            db.add(complaint)
            await db.flush()
            complaint.created_at = data["created_at"]
            complaint.updated_at = data["created_at"]

            existing_refs.add(ref_id)
            added += 1
            print(f"  Added {ref_id} ({cat.value}, {data['priority'].value}, {data['plant']})")

        await db.commit()
        print(f"\nDone — added {added} complaints.")


asyncio.run(seed())
