"""
Comprehensive demo seed — run ONCE after your initial seed.
Creates: 2 admin users, 1 extra vendor, 25 realistic complaints
across all categories, statuses, plants, with audit logs,
vendor assignments, and approval records.

Usage:
    cd backend
    python seed_demo.py
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, func

from app.config import settings
from app.models.user import User, UserRole, Department
from app.models.complaint import Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority
from app.models.tracking import Approval, ApprovalStatus, AuditLog
from app.services.auth_service import hash_password

engine = create_async_engine(settings.DATABASE_URL)
Session = async_sessionmaker(engine, expire_on_commit=False)

UTC = timezone.utc


def ago(days=0, hours=0) -> datetime:
    return datetime.now(UTC) - timedelta(days=days, hours=hours)


def ref(n: int) -> str:
    return f"CN-{n:03d}"


def tok() -> str:
    return str(uuid.uuid4())


COMPLAINTS_DATA = [
    # ── Canteen ─────────────────────────────────────────────────────────────────
    {
        "reference_id": ref(1),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Ahmad Faizal bin Razak",
        "submitter_employee_id": "J001234",
        "submitter_email": "ahmad.faizal@jabil-worker.com",
        "description": "The canteen rice station frequently runs out of food by 12:15 PM even though lunch break starts at 12:00 PM. Workers on the second shift are consistently left without rice. This has been happening every Tuesday and Thursday for the past 3 weeks.",
        "ai_classification": "Food Supply Management",
        "ai_priority": "normal",
        "ai_sentiment": 0.35,
        "created_at": ago(days=2),
    },
    {
        "reference_id": ref(2),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.urgent,
        "plant": "P1",
        "submitter_name": "Nurul Ain binti Hamzah",
        "submitter_employee_id": "J002891",
        "submitter_email": "nurul.ain@jabil-worker.com",
        "description": "There are cockroach sightings near the food counter area at canteen Block B. I personally witnessed two cockroaches on 18 March near the drinks station. This is a serious hygiene concern and could affect worker health. Please escalate to health & safety.",
        "ai_classification": "Food Safety & Hygiene",
        "ai_priority": "urgent",
        "ai_sentiment": 0.10,
        "created_at": ago(days=5),
    },
    {
        "reference_id": ref(3),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.vendor_pending,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Tan Wei Ming",
        "submitter_employee_id": "J004512",
        "description": "The canteen queue management is very poor during peak hours. There is only one cashier active even when there are 100+ workers waiting. Queue takes 25-30 minutes on average. Suggest adding a second POS terminal or a self-checkout option.",
        "ai_classification": "Queue & Service Management",
        "ai_priority": "normal",
        "ai_sentiment": 0.28,
        "created_at": ago(days=8),
    },
    {
        "reference_id": ref(4),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.awaiting_approval,
        "priority": ComplaintPriority.urgent,
        "plant": "P1",
        "submitter_name": "Siti Hajar binti Mohd Noor",
        "submitter_employee_id": "J007831",
        "submitter_email": "siti.hajar@jabil-worker.com",
        "description": "Multiple workers reported food poisoning symptoms after consuming the chicken curry served on 22 March 2025. At least 8 colleagues went to the clinic. The canteen vendor must review their food preparation and storage practices immediately. I have the names of affected workers if needed.",
        "ai_classification": "Food Safety — Critical",
        "ai_priority": "urgent",
        "ai_sentiment": 0.05,
        "created_at": ago(days=10),
    },
    {
        "reference_id": ref(5),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.resolved,
        "priority": ComplaintPriority.normal,
        "plant": "BK",
        "submitter_name": "Rajendran s/o Murugesan",
        "submitter_employee_id": "J003322",
        "description": "The price of nasi lemak bungkus was increased from RM3.50 to RM5.00 without any prior notice. Workers on minimum wage are finding this difficult. Request that the canteen vendor be asked to provide at least one meal option below RM4.00.",
        "ai_classification": "Pricing Dispute",
        "ai_priority": "normal",
        "ai_sentiment": 0.42,
        "created_at": ago(days=20),
    },
    # ── Locker ───────────────────────────────────────────────────────────────────
    {
        "reference_id": ref(6),
        "category": ComplaintCategory.locker,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Koh Li Shan",
        "submitter_employee_id": "J005671",
        "description": "My locker No. L-247 in Block C has a broken lock mechanism since February. I have reported this to the floor supervisor twice but nothing has been done. My personal items are at risk. The lock handle is completely detached.",
        "ai_classification": "Maintenance — Broken Lock",
        "ai_priority": "normal",
        "ai_sentiment": 0.30,
        "created_at": ago(days=3),
    },
    {
        "reference_id": ref(7),
        "category": ComplaintCategory.locker,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.urgent,
        "plant": "P1",
        "submitter_name": "Mohamad Hafiz bin Zulkifli",
        "submitter_employee_id": "J008123",
        "submitter_email": "hafiz.zulkifli@jabil-worker.com",
        "description": "I found that someone has been accessing my locker No. L-389. Two times this week I came back to find my locker slightly open despite locking it properly. My phone charger and personal cash (RM50) went missing. This is a serious security issue. Request CCTV review and locker replacement.",
        "ai_classification": "Security — Unauthorized Access",
        "ai_priority": "urgent",
        "ai_sentiment": 0.08,
        "created_at": ago(days=4),
    },
    {
        "reference_id": ref(8),
        "category": ComplaintCategory.locker,
        "status": ComplaintStatus.vendor_pending,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Norziana binti Abdullah",
        "submitter_employee_id": "J009045",
        "description": "The locker area in Block D (female section) is severely overcrowded. There are 45 workers sharing 30 lockers. Many of us have to use the floor to store our bags. This is a daily struggle. We request that 15 additional locker units be installed before April.",
        "ai_classification": "Capacity Issue",
        "ai_priority": "normal",
        "ai_sentiment": 0.25,
        "created_at": ago(days=12),
    },
    {
        "reference_id": ref(9),
        "category": ComplaintCategory.locker,
        "status": ComplaintStatus.resolved,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Lee Chong Huat",
        "submitter_employee_id": "J002100",
        "description": "The locker area lighting in Block A is extremely dim. During night shift, it is almost impossible to see the locker numbers. Two colleagues have reported tripping in the dark area. Request proper LED lighting installation in all locker corridors.",
        "ai_classification": "Facility — Lighting",
        "ai_priority": "normal",
        "ai_sentiment": 0.40,
        "created_at": ago(days=25),
    },
    {
        "reference_id": ref(10),
        "category": ComplaintCategory.locker,
        "status": ComplaintStatus.closed,
        "priority": ComplaintPriority.normal,
        "plant": "BK",
        "submitter_name": "Priya d/o Selvam",
        "submitter_employee_id": "J006789",
        "description": "Locker No. L-112 door hinge is broken and the door does not close properly. Already reported on 5 March. Still not fixed after 2 weeks.",
        "ai_classification": "Maintenance — Broken Hinge",
        "ai_priority": "normal",
        "ai_sentiment": 0.45,
        "created_at": ago(days=30),
    },
    # ── ESD ──────────────────────────────────────────────────────────────────────
    {
        "reference_id": ref(11),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.urgent,
        "plant": "P1",
        "submitter_name": "Wong Chee Keong",
        "submitter_employee_id": "J003456",
        "description": "The ESD wrist strap tester at Station 7A has been showing false 'PASS' readings. I verified this by testing with a known-faulty strap and it still passed. This is a critical safety concern as workers may be damaging sensitive components without knowing. The station checker ID is ESD-7A-T03.",
        "ai_classification": "ESD Equipment — Calibration Failure",
        "ai_priority": "urgent",
        "ai_sentiment": 0.12,
        "created_at": ago(days=1),
    },
    {
        "reference_id": ref(12),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Azman bin Ibrahim",
        "submitter_employee_id": "J007234",
        "submitter_email": "azman.ibrahim@jabil-worker.com",
        "description": "There is a shortage of ESD heel grounders in the P2 production floor. Workers on Line 4 and Line 5 are sharing heel grounders which creates delays during shift changeover and also reduces their effectiveness due to wear. Request restocking of at least 40 units.",
        "ai_classification": "ESD Consumables — Shortage",
        "ai_priority": "normal",
        "ai_sentiment": 0.35,
        "created_at": ago(days=6),
    },
    {
        "reference_id": ref(13),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.vendor_pending,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Faridah binti Ismail",
        "submitter_employee_id": "J004899",
        "description": "The ESD floor mat in the assembly area (Row C, stations 12-15) has visible cracks and peeling sections. The continuity of grounding is questionable. This was flagged during last month's internal audit but no action taken. Vendor should come to inspect and replace.",
        "ai_classification": "ESD Infrastructure — Floor Mat",
        "ai_priority": "normal",
        "ai_sentiment": 0.30,
        "created_at": ago(days=14),
    },
    {
        "reference_id": ref(14),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.awaiting_approval,
        "priority": ComplaintPriority.urgent,
        "plant": "P2",
        "submitter_name": "Hairul Nizam bin Osman",
        "submitter_employee_id": "J005500",
        "submitter_email": "hairul.nizam@jabil-worker.com",
        "description": "At least 15 ESD wrist straps on Line 3 are overdue for replacement (past 6-month lifecycle). The straps are visibly worn and some have frayed connections. Using them is a compliance risk. I am raising this formally because my verbal requests to the line leader have been ignored for 3 weeks.",
        "ai_classification": "ESD Compliance — Overdue Replacement",
        "ai_priority": "urgent",
        "ai_sentiment": 0.15,
        "created_at": ago(days=9),
    },
    {
        "reference_id": ref(15),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.resolved,
        "priority": ComplaintPriority.normal,
        "plant": "BK",
        "submitter_name": "Cheah Boon Leong",
        "submitter_employee_id": "J001567",
        "description": "The ESD training material is outdated — still showing 2019 SOP version. New operators are being trained with incorrect procedures. The current SOP has been updated in 2023 but training slides were never updated. Please update training materials.",
        "ai_classification": "ESD Training — Outdated Materials",
        "ai_priority": "normal",
        "ai_sentiment": 0.50,
        "created_at": ago(days=18),
    },
    # ── Transportation ───────────────────────────────────────────────────────────
    {
        "reference_id": ref(16),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Suhaila binti Kamarudin",
        "submitter_employee_id": "J008900",
        "description": "Bus Route 3 (Butterworth → Jabil P1) is consistently 20-30 minutes late every morning. I have recorded the delay times for the past 2 weeks: average delay is 24 minutes. Many of us are being marked late for no fault of our own. The bus driver (Badge: BUS-RT3-22) often stops for extended periods at Sunway Carnival.",
        "ai_classification": "Bus Punctuality — Route 3",
        "ai_priority": "normal",
        "ai_sentiment": 0.22,
        "created_at": ago(days=2),
    },
    {
        "reference_id": ref(17),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.urgent,
        "plant": "P1",
        "submitter_name": "Ramesh s/o Krishnamurthy",
        "submitter_employee_id": "J003780",
        "submitter_email": "ramesh.k@jabil-worker.com",
        "description": "Bus No. RT-7 that serves the Permatang Pauh route is severely overcrowded. On multiple occasions, workers have been standing for the full 45-minute journey. The bus is a 40-seater but is regularly carrying 55-60 passengers. This is a road safety violation. I request an additional bus be deployed for this route immediately.",
        "ai_classification": "Bus Overcrowding — Safety Violation",
        "ai_priority": "urgent",
        "ai_sentiment": 0.08,
        "created_at": ago(days=7),
    },
    {
        "reference_id": ref(18),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.vendor_pending,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Lim Beng Huat",
        "submitter_employee_id": "J006344",
        "description": "The air conditioning on Bus RT-12 (Bayan Lepas route) has been broken for 3 weeks. Temperature inside the bus during afternoon peak is unbearable — estimated 38°C. Multiple workers have complained of headaches after the journey. The vendor Mutiara Transport has been notified twice but no repair has been done.",
        "ai_classification": "Bus Maintenance — AC Failure",
        "ai_priority": "normal",
        "ai_sentiment": 0.20,
        "created_at": ago(days=16),
    },
    {
        "reference_id": ref(19),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.awaiting_approval,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Norhaslinda binti Rashid",
        "submitter_employee_id": "J009122",
        "submitter_email": "norhaslinda@jabil-worker.com",
        "description": "The drop-off point for buses at P1 is too far from the main entrance — approximately 400 meters. Pregnant workers and those with medical conditions struggle to walk this distance especially in rain. We request the drop-off point be moved closer to the main gate or a covered walkway be provided.",
        "ai_classification": "Accessibility — Drop-off Location",
        "ai_priority": "normal",
        "ai_sentiment": 0.38,
        "created_at": ago(days=11),
    },
    {
        "reference_id": ref(20),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.resolved,
        "priority": ComplaintPriority.normal,
        "plant": "BK",
        "submitter_name": "Gan Teck Soon",
        "submitter_employee_id": "J002234",
        "description": "There is no bus service for the BK plant late shift (ending 3:00 AM). Workers finishing the late shift have to arrange personal transport or wait until 5 AM for public buses. This is a safety concern especially for female workers. Request at least one dedicated late-shift bus for the BK-Prai route.",
        "ai_classification": "Service Gap — Late Shift Coverage",
        "ai_priority": "normal",
        "ai_sentiment": 0.32,
        "created_at": ago(days=22),
    },
    {
        "reference_id": ref(21),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.closed,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Amirul Hakim bin Zainuddin",
        "submitter_employee_id": "J007899",
        "description": "Bus schedule for December holiday period was not communicated to workers. Many people missed their rides on 24 December because the schedule was changed without announcement.",
        "ai_classification": "Communication — Schedule Change",
        "ai_priority": "normal",
        "ai_sentiment": 0.45,
        "created_at": ago(days=40),
    },
    # ── Mixed urgent/multi-plant ─────────────────────────────────────────────────
    {
        "reference_id": ref(22),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Yong Mei Ling",
        "submitter_employee_id": "J004233",
        "submitter_email": "yong.meiling@jabil-worker.com",
        "description": "The halal certification of the canteen vendor (P2) has expired as of January 2025. I noticed the certification poster on the wall shows expiry date 31/01/2025. Muslim workers are concerned about the halal status of the food. Please verify and renew immediately.",
        "ai_classification": "Halal Compliance — Certification Expired",
        "ai_priority": "urgent",
        "ai_sentiment": 0.18,
        "created_at": ago(days=6),
    },
    {
        "reference_id": ref(23),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Zainal Abidin bin Mohd Said",
        "submitter_employee_id": "J005112",
        "description": "New operators joining Line 6 in the past month have not received ESD awareness training. The supervisor said training will be arranged 'later' but it has been 6 weeks. These workers handle sensitive PCB components daily without proper ESD knowledge.",
        "ai_classification": "ESD Training — New Operators",
        "ai_priority": "normal",
        "ai_sentiment": 0.35,
        "created_at": ago(days=3),
    },
    {
        "reference_id": ref(24),
        "category": ComplaintCategory.locker,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.urgent,
        "plant": "P1",
        "submitter_name": "Hasnah binti Abdul Latif",
        "submitter_employee_id": "J008341",
        "description": "Water leakage from the ceiling near Locker Block B (Lockers L-200 to L-225) has been ongoing for 10 days. Several workers found their belongings wet and damaged. The maintenance team put a bucket but no actual repair was done. Personal items including medicine and electronics have been damaged.",
        "ai_classification": "Facility — Water Damage",
        "ai_priority": "urgent",
        "ai_sentiment": 0.12,
        "created_at": ago(days=4),
    },
    {
        "reference_id": ref(25),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.closed,
        "priority": ComplaintPriority.normal,
        "plant": "BK",
        "submitter_name": "Ng Chee Wah",
        "submitter_employee_id": "J001890",
        "description": "Bus driver for Route BK-5 was observed using a mobile phone while driving on 15 February. This is a road safety violation. Several passengers witnessed this. The driver's badge visible from the front was BK5-DR-07.",
        "ai_classification": "Driver Misconduct — Mobile Phone Usage",
        "ai_priority": "urgent",
        "ai_sentiment": 0.08,
        "created_at": ago(days=35),
    },
    # ── Additional bilingual complaints ─────────────────────────────────────────
    {
        "reference_id": ref(26),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Zulaikha binti Othman",
        "submitter_employee_id": "J010112",
        "submitter_email": "zulaikha.othman@jabil-worker.com",
        "description": "Saya ingin melaporkan bahawa makanan yang disajikan di kantin P2 sering kali tidak panas dan kelihatan basi sebelum waktu makan tengah hari tamat. Terutamanya nasi dan lauk-pauk yang dibiarkan terlalu lama tanpa penutup.\n\nI would like to report that food served at the P2 canteen is frequently lukewarm and appears to have been sitting out for too long before the lunch period ends. Rice and side dishes are left uncovered for extended periods.",
        "ai_classification": "Food Quality — Temperature Control",
        "ai_priority": "normal",
        "ai_sentiment": 0.30,
        "created_at": ago(days=1),
    },
    {
        "reference_id": ref(27),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.urgent,
        "plant": "BK",
        "submitter_name": "Mohd Firdaus bin Hassan",
        "submitter_employee_id": "J011034",
        "description": "Terdapat ulat ditemui dalam sayur-sayuran yang dihidangkan di kantin BK pada 5 April 2026. Saya telah mengambil gambar sebagai bukti. Ini adalah isu kebersihan yang sangat serius dan boleh mendatangkan bahaya kepada kesihatan pekerja.\n\nWorms were found in the vegetables served at the BK canteen on 5 April 2026. I have photographic evidence. This is a critical hygiene violation that poses a direct health risk to all workers.",
        "ai_classification": "Food Safety — Foreign Matter",
        "ai_priority": "urgent",
        "ai_sentiment": 0.05,
        "created_at": ago(days=6),
    },
    {
        "reference_id": ref(28),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.vendor_pending,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Lim Hui Ying",
        "submitter_employee_id": "J012345",
        "description": "The canteen P1 does not provide sufficient vegetarian options for non-Muslim workers. Currently only one dish is suitable for vegetarians daily. Bagi pekerja vegetarian, pilihan makanan sangat terhad dan ini menyukarkan kami untuk mendapatkan makanan yang mencukupi semasa waktu rehat.",
        "ai_classification": "Menu Diversity — Vegetarian Options",
        "ai_priority": "normal",
        "ai_sentiment": 0.40,
        "created_at": ago(days=9),
    },
    {
        "reference_id": ref(29),
        "category": ComplaintCategory.locker,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Norashikin binti Kamaruddin",
        "submitter_employee_id": "J013210",
        "description": "Loker nombor L-445 di Blok E tidak dapat dibuka menggunakan kunci asal saya sejak 3 hari lepas. Saya telah cuba melaporkan kepada pengawal tetapi tiada tindakan diambil. Barang peribadi saya terkurung di dalam loker tersebut termasuk ubat-ubatan penting.\n\nLocker L-445 in Block E has been jammed shut for 3 days. I reported to the guard but no action was taken. My personal belongings including important medication are trapped inside.",
        "ai_classification": "Maintenance — Jammed Locker",
        "ai_priority": "urgent",
        "ai_sentiment": 0.15,
        "created_at": ago(days=2),
    },
    {
        "reference_id": ref(30),
        "category": ComplaintCategory.locker,
        "status": ComplaintStatus.awaiting_approval,
        "priority": ComplaintPriority.normal,
        "plant": "BK",
        "submitter_name": "Selvakumar s/o Arumugam",
        "submitter_employee_id": "J014567",
        "submitter_email": "selva.arumugam@jabil-worker.com",
        "description": "Kawasan loker di BK tidak mempunyai pengudaraan yang mencukupi. Bau busuk yang kuat terhasil terutama selepas syif malam. Keadaan ini telah dilaporkan sejak bulan Februari tetapi tiada penambahbaikan dibuat.\n\nThe locker area at BK plant has severely inadequate ventilation. A strong unpleasant odour builds up especially after the night shift. This has been reported since February with no improvement made.",
        "ai_classification": "Facility — Ventilation",
        "ai_priority": "normal",
        "ai_sentiment": 0.28,
        "created_at": ago(days=11),
    },
    {
        "reference_id": ref(31),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.urgent,
        "plant": "P1",
        "submitter_name": "Wan Nur Atikah binti Wan Azmi",
        "submitter_employee_id": "J015678",
        "description": "Peralatan penguji ESD di Stesen 12B, Talian 2 mengeluarkan bacaan tidak konsisten. Kadang-kadang ia menunjukkan GAGAL walaupun tali pergelangan tangan baharu digunakan, dan kadang-kadang menunjukkan LULUS untuk tali yang jelas rosak. Ini membahayakan komponen sensitif pada papan litar yang kami kendalikan.\n\nThe ESD tester at Station 12B, Line 2 gives inconsistent readings — sometimes FAIL for new straps and PASS for visibly damaged ones. This is compromising sensitive PCB components we handle daily.",
        "ai_classification": "ESD Equipment — Faulty Tester",
        "ai_priority": "urgent",
        "ai_sentiment": 0.12,
        "created_at": ago(days=1, hours=3),
    },
    {
        "reference_id": ref(32),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.normal,
        "plant": "BK",
        "submitter_name": "Kogilam d/o Krishnan",
        "submitter_employee_id": "J016234",
        "description": "ESD wrist straps at the BK assembly floor have not been replaced for over 8 months. Standard replacement cycle is every 6 months. Tali pergelangan tangan ESD di lantai pemasangan BK telah melebihi tempoh penggunaan yang disyorkan. Ini adalah risiko pematuhan yang perlu ditangani segera sebelum audit suku tahunan yang akan datang.",
        "ai_classification": "ESD Compliance — Overdue Lifecycle",
        "ai_priority": "normal",
        "ai_sentiment": 0.35,
        "created_at": ago(days=7),
    },
    {
        "reference_id": ref(33),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.resolved,
        "priority": ComplaintPriority.normal,
        "plant": "P2",
        "submitter_name": "Ahmad Syazwan bin Rosli",
        "submitter_employee_id": "J017890",
        "submitter_email": "syazwan.rosli@jabil-worker.com",
        "description": "Tikar ESD di Baris D, Stesen 8-10 mempunyai keretakan yang ketara dan tidak lagi berfungsi sebagai pembumian yang berkesan. Saya telah menguji kerintangan dan ia melebihi had yang dibenarkan.\n\nESD floor mat in Row D, Stations 8-10 has visible cracking and no longer provides effective grounding. I tested the resistance and it exceeds the permissible limit.",
        "ai_classification": "ESD Infrastructure — Degraded Mat",
        "ai_priority": "normal",
        "ai_sentiment": 0.38,
        "created_at": ago(days=19),
    },
    {
        "reference_id": ref(34),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Nurul Hidayah binti Zulkepli",
        "submitter_employee_id": "J018456",
        "description": "Jadual bas untuk laluan P1-Butterworth telah berubah tanpa sebarang notis awal. Ramai pekerja terlepas bas pagi pada 7 April 2026 kerana perubahan waktu dari 6:45 pagi kepada 6:30 pagi tidak dimaklumkan.\n\nThe bus schedule for the P1-Butterworth route was changed without prior notice. Many workers missed the morning bus on 7 April 2026 because the time change from 6:45am to 6:30am was not communicated.",
        "ai_classification": "Bus Schedule — No Prior Notice",
        "ai_priority": "normal",
        "ai_sentiment": 0.22,
        "created_at": ago(hours=12),
    },
    {
        "reference_id": ref(35),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.urgent,
        "plant": "P2",
        "submitter_name": "Fadzillah bin Ghazali",
        "submitter_employee_id": "J019012",
        "submitter_email": "fadzillah.g@jabil-worker.com",
        "description": "Pemandu bas laluan P2-Bukit Mertajam (Badge: P2-DR-14) telah menekan brek secara mengejut sebanyak dua kali minggu lalu menyebabkan beberapa penumpang jatuh dan cedera ringan. Seorang rakan sekerja saya, Puan Rohani, mengalami lebam di bahunya.\n\nThe bus driver on route P2-Bukit Mertajam (Badge: P2-DR-14) performed two sudden emergency brakes last week causing passengers to fall and sustain minor injuries. My colleague Puan Rohani suffered a bruised shoulder.",
        "ai_classification": "Driver Safety — Reckless Driving",
        "ai_priority": "urgent",
        "ai_sentiment": 0.08,
        "created_at": ago(days=5),
    },
    {
        "reference_id": ref(36),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.vendor_pending,
        "priority": ComplaintPriority.normal,
        "plant": "BK",
        "submitter_name": "Tan Chee Boon",
        "submitter_employee_id": "J020134",
        "description": "Bas laluan BK-Perda tidak mempunyai lampu dalaman yang berfungsi. Pada waktu malam, keadaan di dalam bas sangat gelap dan tidak selamat terutama bagi pekerja wanita. Masalah ini berlaku selama lebih 2 minggu.\n\nThe bus on route BK-Perda has non-functional interior lights. At night the interior is completely dark which is unsafe especially for female workers. This has been the situation for over 2 weeks.",
        "ai_classification": "Bus Maintenance — Interior Lighting",
        "ai_priority": "normal",
        "ai_sentiment": 0.20,
        "created_at": ago(days=13),
    },
    {
        "reference_id": ref(37),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.resolved,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Suriani binti Idris",
        "submitter_employee_id": "J021567",
        "description": "Meja dan kerusi di bahagian luar kantin P1 tidak pernah dibersihkan secara berkala. Sisa makanan dan cecair tumpah dibiarkan sehingga esok harinya. Ini menarik serangga dan menciptakan persekitaran yang tidak sihat.\n\nThe outdoor seating area of the P1 canteen is never cleaned regularly. Food scraps and spilled liquid are left overnight. This attracts insects and creates an unhygienic environment for workers.",
        "ai_classification": "Hygiene — Outdoor Seating",
        "ai_priority": "normal",
        "ai_sentiment": 0.35,
        "created_at": ago(days=21),
    },
    {
        "reference_id": ref(38),
        "category": ComplaintCategory.locker,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Rusdi bin Mustapha",
        "submitter_employee_id": "J022890",
        "description": "Sistem kunci kombinasi baru yang dipasang di loker Blok F tidak berfungsi dengan betul. Nombor pad tertentu (butang 3 dan 7) tidak bertindak balas dengan konsisten. Lima pekerja sudah terkunci keluar dari loker mereka akibat masalah ini.\n\nThe new combination lock system installed in Block F lockers is malfunctioning. Specific keypad buttons (3 and 7) do not respond consistently. Five workers have already been locked out of their lockers due to this issue.",
        "ai_classification": "Maintenance — Faulty Combination Lock",
        "ai_priority": "normal",
        "ai_sentiment": 0.25,
        "created_at": ago(days=4),
    },
    {
        "reference_id": ref(39),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.normal,
        "plant": "BK",
        "submitter_name": "Mariappan s/o Govindasamy",
        "submitter_employee_id": "J023456",
        "description": "Bekalan kasut ESD untuk pekerja baharu di BK telah kehabisan. Pekerja yang baru menyertai barisan pengeluaran terpaksa meminjam kasut ESD daripada pekerja lain, yang mana ini tidak mengikut prosedur standard dan boleh menjejaskan keselamatan.\n\nESD footwear supply for new workers at BK plant has run out. New production line joiners are being made to borrow ESD shoes from existing workers, which is against standard procedure and compromises safety compliance.",
        "ai_classification": "ESD Consumables — Footwear Shortage",
        "ai_priority": "normal",
        "ai_sentiment": 0.32,
        "created_at": ago(days=2, hours=5),
    },
    {
        "reference_id": ref(40),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.closed,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Norazlina binti Ramli",
        "submitter_employee_id": "J024678",
        "description": "Bas laluan P1-Kepala Batas tidak berhenti di perhentian rasmi di Taman Pekaka. Pemandu selalu melangkau perhentian ini tanpa sebab jelas, menyebabkan pekerja dari kawasan tersebut terpaksa berjalan jauh.\n\nThe bus on route P1-Kepala Batas regularly skips the official stop at Taman Pekaka without reason, forcing workers from that area to walk a long distance.",
        "ai_classification": "Bus Route — Skipping Stops",
        "ai_priority": "normal",
        "ai_sentiment": 0.30,
        "created_at": ago(days=38),
    },
    {
        "reference_id": ref(41),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.normal,
        "plant": "BK",
        "submitter_name": "Nur Fathiah binti Saharudin",
        "submitter_employee_id": "J025890",
        "description": "Masa menunggu di kaunter kantin BK terlalu lama — purata 20 minit dalam barisan. Ini mengurangkan masa rehat sebenar pekerja secara ketara kerana waktu rehat hanya 30 minit. Dicadangkan supaya sistem giliran atau kaunter tambahan disediakan.\n\nWaiting time at the BK canteen counter is excessively long — averaging 20 minutes in queue. This significantly reduces actual break time for workers since the break is only 30 minutes. A queue management system or additional counter is recommended.",
        "ai_classification": "Queue Management",
        "ai_priority": "normal",
        "ai_sentiment": 0.30,
        "created_at": ago(hours=8),
    },
    {
        "reference_id": ref(42),
        "category": ComplaintCategory.locker,
        "status": ComplaintStatus.new,
        "priority": ComplaintPriority.urgent,
        "plant": "P2",
        "submitter_name": "Kevin Lim Jian Wei",
        "submitter_employee_id": "J026234",
        "submitter_email": "kevin.lim@jabil-worker.com",
        "description": "Kunci loker saya (L-512, Blok G) telah dipecahkan masuk. Wang tunai sebanyak RM120 dan telefon bimbit saya hilang. Ini adalah kali kedua dalam masa sebulan berlaku kecurian di kawasan loker Blok G. CCTV di kawasan itu pula tidak berfungsi.\n\nMy locker L-512 in Block G was broken into. RM120 cash and my mobile phone are missing. This is the second theft incident in Block G within a month. The CCTV camera in that area is also non-functional.",
        "ai_classification": "Security — Theft / Break-in",
        "ai_priority": "urgent",
        "ai_sentiment": 0.05,
        "created_at": ago(days=1, hours=6),
    },
    {
        "reference_id": ref(43),
        "category": ComplaintCategory.esd,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Sazali bin Abdul Wahab",
        "submitter_employee_id": "J027567",
        "description": "Manual latihan ESD yang digunakan dalam sesi orientasi tidak merangkumi prosedur terkini untuk pengendalian komponen BGA dan flip-chip yang mula kami gunakan pada Q1 2026. Pekerja baharu tidak dilatih dengan betul untuk mengendalikan komponen sensitif ini.\n\nThe ESD training manual used in orientation does not cover the latest procedures for BGA and flip-chip component handling that we started using in Q1 2026. New workers are not being properly trained for these sensitive components.",
        "ai_classification": "ESD Training — Outdated Procedures",
        "ai_priority": "normal",
        "ai_sentiment": 0.38,
        "created_at": ago(days=8),
    },
    {
        "reference_id": ref(44),
        "category": ComplaintCategory.transportation,
        "status": ComplaintStatus.awaiting_approval,
        "priority": ComplaintPriority.urgent,
        "plant": "P2",
        "submitter_name": "Asmah binti Zainal",
        "submitter_employee_id": "J028901",
        "submitter_email": "asmah.zainal@jabil-worker.com",
        "description": "Bas syif malam untuk laluan P2-Seberang Jaya telah dibatalkan tanpa notis sejak 1 April 2026. Lebih 30 pekerja syif malam terpaksa mencari pengangkutan alternatif sendiri pada waktu dinihari. Ini adalah isu keselamatan yang kritikal terutama bagi pekerja wanita.\n\nThe night shift bus for route P2-Seberang Jaya has been cancelled without notice since 1 April 2026. More than 30 night shift workers are forced to arrange their own transport in the early hours of the morning. This is a critical safety issue especially for female workers.",
        "ai_classification": "Service Cancellation — Night Shift",
        "ai_priority": "urgent",
        "ai_sentiment": 0.06,
        "created_at": ago(days=10),
    },
    {
        "reference_id": ref(45),
        "category": ComplaintCategory.canteen,
        "status": ComplaintStatus.in_progress,
        "priority": ComplaintPriority.normal,
        "plant": "P1",
        "submitter_name": "Hazwani binti Mohd Zin",
        "submitter_employee_id": "J029234",
        "description": "Petugas kantin P1 tidak memakai sarung tangan dan penutup rambut semasa menyediakan dan menghidangkan makanan. Ini melanggar peraturan kebersihan makanan yang ditetapkan oleh Kementerian Kesihatan Malaysia.\n\nCanteen P1 staff are not wearing gloves and hairnets while preparing and serving food. This violates food hygiene regulations as set by the Malaysian Ministry of Health. I observed this on multiple occasions during the week of 7 April 2026.",
        "ai_classification": "Food Hygiene — Staff PPE",
        "ai_priority": "normal",
        "ai_sentiment": 0.25,
        "created_at": ago(days=3),
    },
]


async def seed():
    async with Session() as db:

        # ── Look up existing users ───────────────────────────────────────────────
        result = await db.execute(select(User).where(User.role == UserRole.superadmin))
        superadmin = result.scalar_one_or_none()
        if not superadmin:
            print("ERROR: Run seed.py first to create the superadmin account.")
            return

        # ── Admin for P1 ────────────────────────────────────────────────────────
        p1_admin_q = await db.execute(
            select(User).where(User.email == "admin.p1@jabil.com")
        )
        p1_admin = p1_admin_q.scalar_one_or_none()
        if not p1_admin:
            p1_admin = User(
                email="admin.p1@jabil.com",
                password_hash=hash_password("Admin@1234"),
                full_name="Nurhashimah Binti Yusof",
                role=UserRole.admin,
                plant="P1",
                is_active=True,
            )
            db.add(p1_admin)
            await db.flush()
            print(f"Created P1 admin: admin.p1@jabil.com / Admin@1234")

        # ── Admin for P2 ────────────────────────────────────────────────────────
        p2_admin_q = await db.execute(
            select(User).where(User.email == "admin.p2@jabil.com")
        )
        p2_admin = p2_admin_q.scalar_one_or_none()
        if not p2_admin:
            p2_admin = User(
                email="admin.p2@jabil.com",
                password_hash=hash_password("Admin@1234"),
                full_name="Chong Wei Liang",
                role=UserRole.admin,
                plant="P2",
                is_active=True,
            )
            db.add(p2_admin)
            await db.flush()
            print(f"Created P2 admin: admin.p2@jabil.com / Admin@1234")

        # ── Category-specific admins ─────────────────────────────────────────────
        CATEGORY_ADMINS = [
            # P1
            ("admin.canteen.p1@jabil.com", "Rashidah binti Ahmad", "P1", "Canteen"),
            ("admin.locker.p1@jabil.com", "Hafizuddin bin Razali", "P1", "Locker"),
            ("admin.esd.p1@jabil.com", "Chew Soo Fen", "P1", "ESD"),
            ("admin.transport.p1@jabil.com", "Farouk bin Jamaludin", "P1", "Transportation"),
            # P2
            ("admin.canteen.p2@jabil.com", "Norhayati binti Zainudin", "P2", "Canteen"),
            ("admin.locker.p2@jabil.com", "Tan Kah Wai", "P2", "Locker"),
            ("admin.esd.p2@jabil.com", "Subramaniam s/o Pillai", "P2", "ESD"),
            ("admin.transport.p2@jabil.com", "Sarina binti Hamid", "P2", "Transportation"),
            # BK
            ("admin.canteen.bk@jabil.com", "Mohd Ridhuan bin Zulkifli", "BK", "Canteen"),
            ("admin.locker.bk@jabil.com", "Lee Mei Yun", "BK", "Locker"),
            ("admin.esd.bk@jabil.com", "Kavitha d/o Rajan", "BK", "ESD"),
            ("admin.transport.bk@jabil.com", "Azrul bin Nizam", "BK", "Transportation"),
        ]
        for email, full_name, plant, category in CATEGORY_ADMINS:
            existing_q = await db.execute(select(User).where(User.email == email))
            if not existing_q.scalar_one_or_none():
                db.add(User(
                    email=email,
                    password_hash=hash_password("Admin@1234"),
                    full_name=full_name,
                    role=UserRole.admin,
                    plant=plant,
                    category=category,
                    is_active=True,
                ))
                print(f"Created {category} admin ({plant}): {email}")
        await db.flush()

        # ── Canteen vendor (existing) ────────────────────────────────────────────
        vendor1_q = await db.execute(select(User).where(User.phone == "+60123456789"))
        vendor1 = vendor1_q.scalar_one_or_none()
        if not vendor1:
            vendor1 = User(
                phone="+60123456789",
                password_hash=hash_password("Vendor@1234"),
                full_name="Canteen Vendor",
                role=UserRole.vendor,
                plant="P1",
                is_active=True,
            )
            db.add(vendor1)
            await db.flush()
            print("Created canteen vendor: +60123456789 / Vendor@1234")

        # ── Transport vendor (new) ───────────────────────────────────────────────
        vendor2_q = await db.execute(select(User).where(User.phone == "+60198887766"))
        vendor2 = vendor2_q.scalar_one_or_none()
        if not vendor2:
            vendor2 = User(
                phone="+60198887766",
                password_hash=hash_password("Vendor@1234"),
                full_name="Mutiara Transport Sdn Bhd",
                role=UserRole.vendor,
                plant="P1",
                is_active=True,
            )
            db.add(vendor2)
            await db.flush()
            print("Created transport vendor: +60198887766 / Vendor@1234")

        await db.flush()

        # ── Get set of already-existing reference IDs ───────────────────────────
        existing_refs_q = await db.execute(select(Complaint.reference_id))
        existing_refs = {row[0] for row in existing_refs_q.all()}

        # ── Seed complaints ──────────────────────────────────────────────────────
        seeded = 0
        for i, data in enumerate(COMPLAINTS_DATA):
            if data["reference_id"] in existing_refs:
                print(f"  Skipping {data['reference_id']} (already exists)")
                continue
            complaint = Complaint(
                reference_id=data["reference_id"],
                tracking_token=tok(),
                category=data["category"],
                status=data["status"],
                priority=data["priority"],
                plant=data["plant"],
                submitter_name=data["submitter_name"],
                submitter_employee_id=data["submitter_employee_id"],
                submitter_email=data.get("submitter_email"),
                description=data["description"],
                ai_classification=data.get("ai_classification"),
                ai_priority=data.get("ai_priority"),
                ai_sentiment=data.get("ai_sentiment"),
            )
            # Override created_at after flush
            db.add(complaint)
            await db.flush()

            # Manually set timestamps via UPDATE workaround (flush then update)
            complaint.created_at = data["created_at"]
            complaint.updated_at = data["created_at"]

            # ── Audit: submitted ─────────────────────────────────────────────
            db.add(AuditLog(
                complaint_id=complaint.id,
                action="complaint_submitted",
                details={"channel": "web_portal"},
                created_at=data["created_at"],
            ))

            status = data["status"]
            created = data["created_at"]

            # ── Status-specific enrichment ───────────────────────────────────

            if status == ComplaintStatus.in_progress:
                t = created + timedelta(hours=4)
                complaint.updated_at = t
                admin = p1_admin if data["plant"] == "P1" else p2_admin
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="status_changed",
                    details={"from": "pending", "to": "in_progress"},
                    created_at=t,
                ))

            elif status == ComplaintStatus.vendor_pending:
                t1 = created + timedelta(hours=3)
                t2 = created + timedelta(hours=5)
                admin = p1_admin if data["plant"] == "P1" else p2_admin
                # Pick vendor based on category
                vendor = vendor2 if data["category"] == ComplaintCategory.transportation else vendor1
                complaint.assigned_vendor_id = vendor.id
                complaint.updated_at = t2
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="status_changed",
                    details={"from": "pending", "to": "in_progress"},
                    created_at=t1,
                ))
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="vendor_assigned",
                    details={"vendor_id": vendor.id, "vendor_name": vendor.full_name},
                    created_at=t2,
                ))

            elif status == ComplaintStatus.awaiting_approval:
                t1 = created + timedelta(hours=3)
                t2 = created + timedelta(hours=8)
                t3 = created + timedelta(hours=12)
                admin = p1_admin if data["plant"] == "P1" else p2_admin
                complaint.updated_at = t3
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="status_changed",
                    details={"from": "pending", "to": "in_progress"},
                    created_at=t1,
                ))
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="note_added",
                    details={"note": "Reviewed and verified complaint. Escalating for superadmin approval.", "by": admin.full_name},
                    created_at=t2,
                ))
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="submitted_for_approval",
                    details={"notes": "Verified — requires management sign-off due to severity.", "by": admin.full_name},
                    created_at=t3,
                ))
                # Approval record
                approval = Approval(
                    complaint_id=complaint.id,
                    admin_id=admin.id,
                    admin_approved_at=t3,
                    admin_notes="Verified — requires management sign-off due to severity.",
                    status=ApprovalStatus.pending_superadmin,
                )
                db.add(approval)

            elif status == ComplaintStatus.resolved:
                t1 = created + timedelta(hours=2)
                t2 = created + timedelta(days=1)
                t3 = created + timedelta(days=2)
                admin = p1_admin if data["plant"] == "P1" else p2_admin
                complaint.closed_at = t3
                complaint.updated_at = t3
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="status_changed",
                    details={"from": "pending", "to": "in_progress"},
                    created_at=t1,
                ))
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="note_added",
                    details={"note": "Issue has been addressed by the relevant department. Worker notified via email.", "by": admin.full_name},
                    created_at=t2,
                ))
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="status_changed",
                    details={"from": "in_progress", "to": "resolved"},
                    created_at=t3,
                ))

            elif status == ComplaintStatus.closed:
                t1 = created + timedelta(hours=6)
                t2 = created + timedelta(days=3)
                t3 = created + timedelta(days=5)
                admin = p1_admin if data["plant"] == "P1" else p2_admin
                complaint.closed_at = t3
                complaint.updated_at = t3
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="status_changed",
                    details={"from": "pending", "to": "in_progress"},
                    created_at=t1,
                ))
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="status_changed",
                    details={"from": "in_progress", "to": "resolved"},
                    created_at=t2,
                ))
                db.add(AuditLog(
                    complaint_id=complaint.id,
                    user_id=admin.id,
                    action="status_changed",
                    details={"from": "resolved", "to": "closed"},
                    created_at=t3,
                ))

            await db.flush()
            seeded += 1

        await db.commit()
        print(f"\nSeeded {seeded} new complaints (skipped {len(COMPLAINTS_DATA) - seeded} duplicates)")
        print("\nAdmin accounts:")
        print("  P1 Admin:  admin.p1@jabil.com  / Admin@1234")
        print("  P2 Admin:  admin.p2@jabil.com  / Admin@1234")
        print("  Superadmin: superadmin@jabil.com / Admin@1234")
        print("\nCategory-specific admin accounts (password: Admin@1234):")
        for email, full_name, plant, category in CATEGORY_ADMINS:
            print(f"  [{plant}] {category:15s}  {email}")
        print("\nVendor accounts:")
        print("  Canteen:   +60123456789 / Vendor@1234")
        print("  Transport: +60198887766 / Vendor@1234")
        print("\nNote: Dev quick-fill on login page uses superadmin@jabil.com")


asyncio.run(seed())
