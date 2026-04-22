from pydantic import BaseModel
from app.models.user import UserRole


class LoginRequest(BaseModel):
    identifier: str   # email for admin/superadmin, phone for vendor
    password: str
    role: str = "admin"  # "admin" | "superadmin" | "vendor"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str | None
    phone: str | None = None
    full_name: str
    role: UserRole
    plant: str | None
    category: str | None = None
    department_id: int | None
    is_active: bool

    model_config = {"from_attributes": True}
