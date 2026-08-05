from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ['JWT_ALGORITHM']
ACCESS_TOKEN_DAYS = int(os.environ['ACCESS_TOKEN_DAYS'])

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# ----------------------- Helpers -----------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token non valido o scaduto",
    )
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        raise unauthorized
    if not user_id:
        raise unauthorized
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise unauthorized
    return user


def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ----------------------- Models -----------------------
class SignupInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str


class AuthOut(BaseModel):
    access_token: str
    user: UserOut


class Profile(BaseModel):
    lab_name: str = ""
    responsible_person: str = ""
    address: str = ""
    city: str = ""
    vat: str = ""
    registration_number: str = ""
    phone: str = ""
    email: str = ""
    logo_base64: str = ""


class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    clinic: str = ""
    address: str = ""
    vat: str = ""
    email: str = ""
    phone: str = ""


class ClientInput(BaseModel):
    name: str
    clinic: str = ""
    address: str = ""
    vat: str = ""
    email: str = ""
    phone: str = ""


class Material(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    manufacturer: str = ""
    ce_number: str = ""
    lot_default: str = ""
    category: str = ""


class MaterialInput(BaseModel):
    name: str
    manufacturer: str = ""
    ce_number: str = ""
    lot_default: str = ""
    category: str = ""


class DeclarationMaterial(BaseModel):
    name: str
    manufacturer: str = ""
    ce_number: str = ""
    lot: str = ""
    category: str = ""


class Conformity(BaseModel):
    mdr_2017_745: bool = True
    biocompatible: bool = True
    single_patient: bool = True
    made_to_prescription: bool = True
    notes: str = ""


class DeclarationInput(BaseModel):
    client_id: Optional[str] = None
    client_snapshot: dict
    patient_ref: str = ""
    device_type: str = ""
    device_description: str = ""
    materials: List[DeclarationMaterial] = []
    conformity: Conformity = Conformity()
    norm_reference: str = "Regolamento (UE) 2017/745 (MDR) - Allegato XIII"
    technician_name: str = ""
    signature_base64: str = ""
    issue_date: Optional[str] = None


# ----------------------- Auth routes -----------------------
@api_router.post("/auth/signup", response_model=AuthOut, status_code=201)
async def signup(data: SignupInput):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email già registrata")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    # empty profile
    await db.profiles.insert_one({"user_id": user["id"], **Profile().dict()})
    token = create_access_token(user["id"])
    return AuthOut(access_token=token, user=UserOut(id=user["id"], email=user["email"], name=user["name"]))


@api_router.post("/auth/login", response_model=AuthOut)
async def login(data: LoginInput):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o password non corretti")
    token = create_access_token(user["id"])
    return AuthOut(access_token=token, user=UserOut(id=user["id"], email=user["email"], name=user["name"]))


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], email=user["email"], name=user["name"])


# ----------------------- Profile routes -----------------------
@api_router.get("/profile", response_model=Profile)
async def get_profile(user: dict = Depends(get_current_user)):
    doc = await db.profiles.find_one({"user_id": user["id"]})
    if not doc:
        return Profile()
    return Profile(**{k: doc.get(k, "") for k in Profile().dict().keys()})


@api_router.put("/profile", response_model=Profile)
async def update_profile(data: Profile, user: dict = Depends(get_current_user)):
    await db.profiles.update_one(
        {"user_id": user["id"]},
        {"$set": {**data.dict(), "user_id": user["id"]}},
        upsert=True,
    )
    return data


# ----------------------- Clients routes -----------------------
@api_router.get("/clients", response_model=List[Client])
async def list_clients(user: dict = Depends(get_current_user)):
    docs = await db.clients.find({"user_id": user["id"]}).sort("name", 1).to_list(1000)
    return [Client(**{k: d.get(k) for k in Client.model_fields.keys()}) for d in docs]


@api_router.post("/clients", response_model=Client, status_code=201)
async def create_client(data: ClientInput, user: dict = Depends(get_current_user)):
    obj = Client(**data.dict())
    await db.clients.insert_one({**obj.dict(), "user_id": user["id"], "created_at": now_iso()})
    return obj


@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, data: ClientInput, user: dict = Depends(get_current_user)):
    doc = await db.clients.find_one({"id": client_id, "user_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    await db.clients.update_one({"id": client_id, "user_id": user["id"]}, {"$set": data.dict()})
    return Client(id=client_id, **data.dict())


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(get_current_user)):
    await db.clients.delete_one({"id": client_id, "user_id": user["id"]})
    return {"ok": True}


# ----------------------- Materials routes -----------------------
@api_router.get("/materials", response_model=List[Material])
async def list_materials(user: dict = Depends(get_current_user)):
    docs = await db.materials.find({"user_id": user["id"]}).sort("name", 1).to_list(1000)
    return [Material(**{k: d.get(k) for k in Material.model_fields.keys()}) for d in docs]


@api_router.post("/materials", response_model=Material, status_code=201)
async def create_material(data: MaterialInput, user: dict = Depends(get_current_user)):
    obj = Material(**data.dict())
    await db.materials.insert_one({**obj.dict(), "user_id": user["id"], "created_at": now_iso()})
    return obj


@api_router.put("/materials/{material_id}", response_model=Material)
async def update_material(material_id: str, data: MaterialInput, user: dict = Depends(get_current_user)):
    doc = await db.materials.find_one({"id": material_id, "user_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Materiale non trovato")
    await db.materials.update_one({"id": material_id, "user_id": user["id"]}, {"$set": data.dict()})
    return Material(id=material_id, **data.dict())


@api_router.delete("/materials/{material_id}")
async def delete_material(material_id: str, user: dict = Depends(get_current_user)):
    await db.materials.delete_one({"id": material_id, "user_id": user["id"]})
    return {"ok": True}


# ----------------------- Declarations routes -----------------------
async def next_declaration_number(user_id: str) -> str:
    year = datetime.now(timezone.utc).year
    count = await db.declarations.count_documents({"user_id": user_id, "year": year})
    return f"DC-{year}-{count + 1:04d}"


@api_router.get("/declarations")
async def list_declarations(user: dict = Depends(get_current_user)):
    docs = await db.declarations.find({"user_id": user["id"]}).sort("created_at", -1).to_list(1000)
    result = []
    for d in docs:
        d = clean(d)
        d.pop("user_id", None)
        d.pop("year", None)
        result.append(d)
    return result


@api_router.get("/declarations/{declaration_id}")
async def get_declaration(declaration_id: str, user: dict = Depends(get_current_user)):
    doc = await db.declarations.find_one({"id": declaration_id, "user_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Dichiarazione non trovata")
    doc = clean(doc)
    doc.pop("user_id", None)
    doc.pop("year", None)
    return doc


@api_router.post("/declarations", status_code=201)
async def create_declaration(data: DeclarationInput, user: dict = Depends(get_current_user)):
    year = datetime.now(timezone.utc).year
    number = await next_declaration_number(user["id"])
    doc = {
        "id": str(uuid.uuid4()),
        "number": number,
        "year": year,
        "user_id": user["id"],
        **data.dict(),
        "status": "issued" if data.signature_base64 else "draft",
        "created_at": now_iso(),
        "issue_date": data.issue_date or now_iso(),
    }
    await db.declarations.insert_one(dict(doc))
    out = clean(doc)
    out.pop("user_id", None)
    out.pop("year", None)
    return out


@api_router.delete("/declarations/{declaration_id}")
async def delete_declaration(declaration_id: str, user: dict = Depends(get_current_user)):
    await db.declarations.delete_one({"id": declaration_id, "user_id": user["id"]})
    return {"ok": True}


# ----------------------- Dashboard -----------------------
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    year = datetime.now(timezone.utc).year
    month_prefix = datetime.now(timezone.utc).strftime("%Y-%m")
    total = await db.declarations.count_documents({"user_id": user["id"]})
    this_year = await db.declarations.count_documents({"user_id": user["id"], "year": year})
    docs = await db.declarations.find({"user_id": user["id"]}).to_list(2000)
    this_month = sum(1 for d in docs if str(d.get("issue_date", "")).startswith(month_prefix))
    clients = await db.clients.count_documents({"user_id": user["id"]})
    return {
        "total": total,
        "this_year": this_year,
        "this_month": this_month,
        "clients": clients,
    }


@api_router.get("/")
async def root():
    return {"message": "OdontoCert API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
