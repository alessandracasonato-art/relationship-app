from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'relational_awareness')]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Create the main app
app = FastAPI(title="Relational Awareness Tool API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    created_at: datetime
    has_completed_phase1: bool = False

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class RelationshipCreate(BaseModel):
    person_name: str
    relationship_type: Optional[str] = None

class RelationshipResponse(BaseModel):
    id: str
    user_id: str
    person_name: str
    relationship_type: Optional[str] = None
    created_at: datetime
    phase2_completed: bool = False
    latest_compatibility: Optional[float] = None
    monitoring_active: bool = False

class Phase1Submit(BaseModel):
    responses: Dict[str, int]  # question_id -> answer (1-5)

class Phase1Response(BaseModel):
    id: str
    user_id: str
    responses: Dict[str, int]
    profile_score: Dict[str, float]
    traits: List[str]
    created_at: datetime

class Phase2AreaSubmit(BaseModel):
    area_id: str
    responses: Dict[str, int]

class Phase2Submit(BaseModel):
    area_responses: Dict[str, Dict[str, int]]  # area_id -> {question_id -> answer}

class Phase2Response(BaseModel):
    id: str
    relationship_id: str
    area_responses: Dict[str, Dict[str, int]]
    completed_areas: List[str]
    initial_compatibility: Optional[float] = None
    area_scores: Dict[str, float] = {}
    awareness_plan: Optional[Dict[str, Any]] = None
    created_at: datetime

class MonitoringSubmit(BaseModel):
    responses: Dict[str, int]
    episode_title: Optional[str] = None  # Titolo opzionale dell'episodio

class MonitoringResponse(BaseModel):
    id: str
    relationship_id: str
    date: datetime
    responses: Dict[str, int]
    compatibility: float
    episode_title: Optional[str] = None
    created_at: datetime

class ContentResponse(BaseModel):
    id: str
    title: str
    content_type: str
    description: str
    link: Optional[str] = None
    is_premium: bool = False

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    notification_type: str
    message: str
    read: bool = False
    created_at: datetime

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token non valido")
        
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="Utente non trovato")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")

# ==================== PHASE 1 QUESTIONS ====================

PHASE1_QUESTIONS = [
    {"id": "comm_1", "category": "comunicazione", "text": "Preferisco esprimere i miei sentimenti in modo diretto piuttosto che attraverso gesti o azioni."},
    {"id": "comm_2", "category": "comunicazione", "text": "Mi sento a mio agio nel parlare di argomenti difficili o delicati."},
    {"id": "comm_3", "category": "comunicazione", "text": "Ascolto attentamente prima di rispondere durante una conversazione importante."},
    {"id": "emo_1", "category": "bisogni_emotivi", "text": "Ho bisogno di ricevere rassicurazioni frequenti nelle mie relazioni."},
    {"id": "emo_2", "category": "bisogni_emotivi", "text": "Mi sento più connesso quando condivido attività quotidiane con gli altri."},
    {"id": "emo_3", "category": "bisogni_emotivi", "text": "L'affetto fisico è importante per sentirmi amato/a."},
    {"id": "emo_4", "category": "bisogni_emotivi", "text": "Ho bisogno di spazio personale per ricaricarmi emotivamente."},
    {"id": "exp_1", "category": "aspettative", "text": "Mi aspetto che le persone importanti nella mia vita mi supportino nelle decisioni."},
    {"id": "exp_2", "category": "aspettative", "text": "Credo che le relazioni richiedano un impegno costante per funzionare."},
    {"id": "exp_3", "category": "aspettative", "text": "Mi aspetto reciprocità nelle mie relazioni."},
    {"id": "conf_1", "category": "conflitti", "text": "Affronto i conflitti direttamente piuttosto che evitarli."},
    {"id": "conf_2", "category": "conflitti", "text": "Durante un disaccordo, cerco di capire il punto di vista dell'altro."},
    {"id": "conf_3", "category": "conflitti", "text": "Sono disposto/a a scendere a compromessi per risolvere un conflitto."},
    {"id": "conf_4", "category": "conflitti", "text": "Riesco a gestire le mie emozioni durante una discussione."},
    {"id": "bound_1", "category": "confini", "text": "So riconoscere e comunicare i miei limiti personali."},
    {"id": "bound_2", "category": "confini", "text": "Rispetto i confini degli altri anche quando non li condivido."},
    {"id": "bound_3", "category": "confini", "text": "Mi sento in diritto di dire no senza sentirmi in colpa."},
]

# ==================== PHASE 2 QUESTIONS BY AREA ====================

PHASE2_AREAS = {
    "comunicazione": {
        "name": "Comunicazione",
        "questions": [
            {"id": "p2_comm_1", "text": "Ti senti ascoltato/a quando parli con questa persona?"},
            {"id": "p2_comm_2", "text": "Riesci ad esprimere liberamente i tuoi pensieri e sentimenti?"},
            {"id": "p2_comm_3", "text": "La comunicazione tra voi è chiara e comprensibile?"},
            {"id": "p2_comm_4", "text": "Vi confrontate regolarmente su questioni importanti?"},
            {"id": "p2_comm_5", "text": "Ti senti rispettato/a durante le conversazioni difficili?"},
        ]
    },
    "valori": {
        "name": "Valori",
        "questions": [
            {"id": "p2_val_1", "text": "Condividete valori fondamentali simili?"},
            {"id": "p2_val_2", "text": "Rispettate le differenze nei vostri valori?"},
            {"id": "p2_val_3", "text": "Le vostre priorità di vita sono allineate?"},
            {"id": "p2_val_4", "text": "Condividete una visione simile dell'importanza della famiglia?"},
            {"id": "p2_val_5", "text": "I vostri valori etici sono compatibili?"},
        ]
    },
    "bisogni_emotivi": {
        "name": "Bisogni Emotivi",
        "questions": [
            {"id": "p2_emo_1", "text": "Ti senti emotivamente supportato/a in questa relazione?"},
            {"id": "p2_emo_2", "text": "I tuoi bisogni emotivi vengono riconosciuti?"},
            {"id": "p2_emo_3", "text": "Riesci ad essere vulnerabile con questa persona?"},
            {"id": "p2_emo_4", "text": "Ti senti sicuro/a nel condividere le tue paure e insicurezze?"},
            {"id": "p2_emo_5", "text": "La relazione ti fa sentire valorizzato/a?"},
        ]
    },
    "conflitto": {
        "name": "Gestione del Conflitto",
        "questions": [
            {"id": "p2_conf_1", "text": "I conflitti vengono affrontati in modo costruttivo?"},
            {"id": "p2_conf_2", "text": "Riuscite a trovare compromessi durante i disaccordi?"},
            {"id": "p2_conf_3", "text": "Dopo un conflitto, riuscite a riconciliarvi?"},
            {"id": "p2_conf_4", "text": "Vi ascoltate reciprocamente durante le discussioni?"},
            {"id": "p2_conf_5", "text": "I conflitti vengono risolti senza rancore?"},
        ]
    },
    "visione": {
        "name": "Visione della Relazione",
        "questions": [
            {"id": "p2_vis_1", "text": "Avete aspettative simili sul futuro della relazione?"},
            {"id": "p2_vis_2", "text": "Vi vedete insieme nel lungo termine?"},
            {"id": "p2_vis_3", "text": "Condividete obiettivi comuni per la relazione?"},
            {"id": "p2_vis_4", "text": "La relazione sta crescendo nella direzione desiderata?"},
            {"id": "p2_vis_5", "text": "Vi impegnate entrambi per il benessere della relazione?"},
        ]
    }
}

PHASE2_AREA_ORDER = ["comunicazione", "valori", "bisogni_emotivi", "conflitto", "visione"]

# ==================== MONITORING QUESTIONS ====================

MONITORING_QUESTIONS = [
    {"id": "mon_1", "text": "È successo qualcosa di significativo nella relazione questa settimana?"},
    {"id": "mon_2", "text": "La tua percezione della relazione è cambiata?"},
    {"id": "mon_3", "text": "La comunicazione è stata più facile o più difficile?"},
    {"id": "mon_4", "text": "Ti sei sentito/a più o meno connesso/a?"},
]

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user)
    
    # Create welcome notification
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "notification_type": "welcome",
        "message": "Benvenuto! Inizia il tuo percorso di consapevolezza relazionale completando la Fase 1.",
        "read": False,
        "created_at": datetime.utcnow()
    }
    await db.notifications.insert_one(notification)
    
    token = create_access_token(user_id)
    
    # Check if phase1 completed
    phase1 = await db.phase1_responses.find_one({"user_id": user_id})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user["email"],
            created_at=user["created_at"],
            has_completed_phase1=phase1 is not None
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email.lower()})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    
    token = create_access_token(user["id"])
    
    # Check if phase1 completed
    phase1 = await db.phase1_responses.find_one({"user_id": user["id"]})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            created_at=user["created_at"],
            has_completed_phase1=phase1 is not None
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    phase1 = await db.phase1_responses.find_one({"user_id": current_user["id"]})
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        created_at=current_user["created_at"],
        has_completed_phase1=phase1 is not None
    )

# ==================== PHASE 1 ENDPOINTS ====================

@api_router.get("/phase1/questions")
async def get_phase1_questions():
    return {"questions": PHASE1_QUESTIONS}

@api_router.get("/phase1", response_model=Optional[Phase1Response])
async def get_phase1(current_user: dict = Depends(get_current_user)):
    response = await db.phase1_responses.find_one({"user_id": current_user["id"]})
    if not response:
        return None
    return Phase1Response(**response)

@api_router.post("/phase1", response_model=Phase1Response)
async def submit_phase1(data: Phase1Submit, current_user: dict = Depends(get_current_user)):
    # Calculate profile scores by category
    categories = {}
    for q in PHASE1_QUESTIONS:
        cat = q["category"]
        if cat not in categories:
            categories[cat] = []
        if q["id"] in data.responses:
            categories[cat].append(data.responses[q["id"]])
    
    profile_score = {}
    for cat, scores in categories.items():
        if scores:
            profile_score[cat] = sum(scores) / len(scores)
    
    # Generate traits based on scores
    traits = []
    if profile_score.get("comunicazione", 0) >= 4:
        traits.append("Comunicatore diretto e aperto")
    elif profile_score.get("comunicazione", 0) >= 3:
        traits.append("Comunicatore equilibrato")
    else:
        traits.append("Comunicatore riflessivo")
    
    if profile_score.get("bisogni_emotivi", 0) >= 4:
        traits.append("Alta necessità di connessione emotiva")
    elif profile_score.get("bisogni_emotivi", 0) >= 3:
        traits.append("Bisogni emotivi bilanciati")
    else:
        traits.append("Indipendente emotivamente")
    
    if profile_score.get("conflitti", 0) >= 4:
        traits.append("Affronta i conflitti con sicurezza")
    elif profile_score.get("conflitti", 0) >= 3:
        traits.append("Gestione equilibrata dei conflitti")
    else:
        traits.append("Preferisce evitare i conflitti")
    
    if profile_score.get("confini", 0) >= 4:
        traits.append("Confini personali chiari e definiti")
    elif profile_score.get("confini", 0) >= 3:
        traits.append("Confini personali flessibili")
    else:
        traits.append("Confini personali in sviluppo")
    
    response_id = str(uuid.uuid4())
    response_doc = {
        "id": response_id,
        "user_id": current_user["id"],
        "responses": data.responses,
        "profile_score": profile_score,
        "traits": traits,
        "created_at": datetime.utcnow()
    }
    
    # Upsert - update if exists, insert if not
    await db.phase1_responses.update_one(
        {"user_id": current_user["id"]},
        {"$set": response_doc},
        upsert=True
    )
    
    return Phase1Response(**response_doc)

# ==================== RELATIONSHIPS ENDPOINTS ====================

@api_router.get("/relationships", response_model=List[RelationshipResponse])
async def get_relationships(current_user: dict = Depends(get_current_user)):
    relationships = await db.relationships.find({"user_id": current_user["id"]}).to_list(100)
    result = []
    
    for rel in relationships:
        # Check phase2 status
        phase2 = await db.phase2_responses.find_one({"relationship_id": rel["id"]})
        phase2_completed = phase2 is not None and phase2.get("initial_compatibility") is not None
        
        # Get latest monitoring
        latest_monitoring = await db.monitoring.find_one(
            {"relationship_id": rel["id"]},
            sort=[("created_at", -1)]
        )
        
        latest_compatibility = None
        if latest_monitoring:
            latest_compatibility = latest_monitoring.get("compatibility")
        elif phase2 and phase2.get("initial_compatibility"):
            latest_compatibility = phase2["initial_compatibility"]
        
        result.append(RelationshipResponse(
            id=rel["id"],
            user_id=rel["user_id"],
            person_name=rel["person_name"],
            relationship_type=rel.get("relationship_type"),
            created_at=rel["created_at"],
            phase2_completed=phase2_completed,
            latest_compatibility=latest_compatibility,
            monitoring_active=rel.get("monitoring_active", False)
        ))
    
    return result

@api_router.post("/relationships", response_model=RelationshipResponse)
async def create_relationship(data: RelationshipCreate, current_user: dict = Depends(get_current_user)):
    # Check limit (max 3 for free users)
    count = await db.relationships.count_documents({"user_id": current_user["id"]})
    if count >= 3:
        raise HTTPException(status_code=400, detail="Limite di 3 relazioni raggiunto per la versione gratuita")
    
    rel_id = str(uuid.uuid4())
    relationship = {
        "id": rel_id,
        "user_id": current_user["id"],
        "person_name": data.person_name,
        "relationship_type": data.relationship_type,
        "created_at": datetime.utcnow(),
        "monitoring_active": False
    }
    
    await db.relationships.insert_one(relationship)
    
    return RelationshipResponse(
        id=rel_id,
        user_id=current_user["id"],
        person_name=data.person_name,
        relationship_type=data.relationship_type,
        created_at=relationship["created_at"],
        phase2_completed=False,
        latest_compatibility=None,
        monitoring_active=False
    )

@api_router.delete("/relationships/{relationship_id}")
async def delete_relationship(relationship_id: str, current_user: dict = Depends(get_current_user)):
    rel = await db.relationships.find_one({"id": relationship_id, "user_id": current_user["id"]})
    if not rel:
        raise HTTPException(status_code=404, detail="Relazione non trovata")
    
    await db.relationships.delete_one({"id": relationship_id})
    await db.phase2_responses.delete_many({"relationship_id": relationship_id})
    await db.monitoring.delete_many({"relationship_id": relationship_id})
    
    return {"message": "Relazione eliminata"}

# ==================== PHASE 2 ENDPOINTS ====================

@api_router.get("/phase2/areas")
async def get_phase2_areas():
    return {
        "areas": PHASE2_AREAS,
        "order": PHASE2_AREA_ORDER
    }

@api_router.get("/phase2/{relationship_id}", response_model=Optional[Phase2Response])
async def get_phase2(relationship_id: str, current_user: dict = Depends(get_current_user)):
    # Verify relationship belongs to user
    rel = await db.relationships.find_one({"id": relationship_id, "user_id": current_user["id"]})
    if not rel:
        raise HTTPException(status_code=404, detail="Relazione non trovata")
    
    response = await db.phase2_responses.find_one({"relationship_id": relationship_id})
    if not response:
        return None
    return Phase2Response(**response)

@api_router.post("/phase2/{relationship_id}/area", response_model=Phase2Response)
async def submit_phase2_area(relationship_id: str, data: Phase2AreaSubmit, current_user: dict = Depends(get_current_user)):
    # Verify relationship belongs to user
    rel = await db.relationships.find_one({"id": relationship_id, "user_id": current_user["id"]})
    if not rel:
        raise HTTPException(status_code=404, detail="Relazione non trovata")
    
    # Get existing response or create new
    existing = await db.phase2_responses.find_one({"relationship_id": relationship_id})
    
    if existing:
        area_responses = existing.get("area_responses", {})
        completed_areas = existing.get("completed_areas", [])
        area_scores = existing.get("area_scores", {})
    else:
        area_responses = {}
        completed_areas = []
        area_scores = {}
    
    # Check area order - can only complete next area
    area_index = PHASE2_AREA_ORDER.index(data.area_id) if data.area_id in PHASE2_AREA_ORDER else -1
    if area_index > 0:
        prev_area = PHASE2_AREA_ORDER[area_index - 1]
        if prev_area not in completed_areas:
            raise HTTPException(status_code=400, detail=f"Devi prima completare l'area: {PHASE2_AREAS[prev_area]['name']}")
    
    # Save area responses
    area_responses[data.area_id] = data.responses
    if data.area_id not in completed_areas:
        completed_areas.append(data.area_id)
    
    # Calculate area score
    scores = list(data.responses.values())
    if scores:
        area_scores[data.area_id] = (sum(scores) / len(scores)) * 20  # Convert 1-5 to 0-100
    
    # Calculate compatibility if all areas completed
    initial_compatibility = None
    awareness_plan = None
    
    if set(completed_areas) == set(PHASE2_AREA_ORDER):
        # All areas completed - calculate final compatibility
        initial_compatibility = sum(area_scores.values()) / len(area_scores)
        
        # Generate awareness plan
        harmony_areas = []
        observe_areas = []
        
        for area_id, score in area_scores.items():
            area_name = PHASE2_AREAS[area_id]["name"]
            if score >= 70:
                harmony_areas.append({"area": area_name, "score": round(score, 1)})
            else:
                observe_areas.append({"area": area_name, "score": round(score, 1)})
        
        awareness_plan = {
            "harmony_areas": harmony_areas,
            "observe_areas": observe_areas,
            "summary": "Questo piano di consapevolezza evidenzia le aree di forza della tua relazione e quelle che potrebbero beneficiare di maggiore attenzione nel tempo."
        }
    
    response_id = existing["id"] if existing else str(uuid.uuid4())
    response_doc = {
        "id": response_id,
        "relationship_id": relationship_id,
        "area_responses": area_responses,
        "completed_areas": completed_areas,
        "area_scores": area_scores,
        "initial_compatibility": initial_compatibility,
        "awareness_plan": awareness_plan,
        "created_at": existing["created_at"] if existing else datetime.utcnow()
    }
    
    await db.phase2_responses.update_one(
        {"relationship_id": relationship_id},
        {"$set": response_doc},
        upsert=True
    )
    
    return Phase2Response(**response_doc)

# ==================== MONITORING ENDPOINTS ====================

@api_router.get("/monitoring/questions")
async def get_monitoring_questions():
    return {"questions": MONITORING_QUESTIONS}

@api_router.get("/monitoring/{relationship_id}", response_model=List[MonitoringResponse])
async def get_monitoring_history(relationship_id: str, current_user: dict = Depends(get_current_user)):
    # Verify relationship belongs to user
    rel = await db.relationships.find_one({"id": relationship_id, "user_id": current_user["id"]})
    if not rel:
        raise HTTPException(status_code=404, detail="Relazione non trovata")
    
    entries = await db.monitoring.find(
        {"relationship_id": relationship_id}
    ).sort("created_at", -1).to_list(100)
    
    return [MonitoringResponse(**entry) for entry in entries]

@api_router.post("/monitoring/{relationship_id}", response_model=MonitoringResponse)
async def submit_monitoring(relationship_id: str, data: MonitoringSubmit, current_user: dict = Depends(get_current_user)):
    # Verify relationship belongs to user
    rel = await db.relationships.find_one({"id": relationship_id, "user_id": current_user["id"]})
    if not rel:
        raise HTTPException(status_code=404, detail="Relazione non trovata")
    
    # Get phase2 for base compatibility
    phase2 = await db.phase2_responses.find_one({"relationship_id": relationship_id})
    if not phase2 or not phase2.get("initial_compatibility"):
        raise HTTPException(status_code=400, detail="Devi prima completare la Fase 2")
    
    # Get last monitoring entry
    last_entry = await db.monitoring.find_one(
        {"relationship_id": relationship_id},
        sort=[("created_at", -1)]
    )
    
    base_compatibility = last_entry["compatibility"] if last_entry else phase2["initial_compatibility"]
    
    # Calculate new compatibility based on responses
    scores = list(data.responses.values())
    avg_score = sum(scores) / len(scores) if scores else 3
    
    # Adjust compatibility: neutral (3) keeps it same, higher increases, lower decreases
    adjustment = (avg_score - 3) * 5  # -10 to +10 adjustment
    new_compatibility = max(0, min(100, base_compatibility + adjustment))
    
    entry_id = str(uuid.uuid4())
    entry = {
        "id": entry_id,
        "relationship_id": relationship_id,
        "date": datetime.utcnow(),
        "responses": data.responses,
        "compatibility": new_compatibility,
        "episode_title": data.episode_title,  # Titolo opzionale dell'episodio
        "created_at": datetime.utcnow()
    }
    
    await db.monitoring.insert_one(entry)
    
    # Activate monitoring on relationship
    await db.relationships.update_one(
        {"id": relationship_id},
        {"$set": {"monitoring_active": True}}
    )
    
    return MonitoringResponse(**entry)

# ==================== RESOURCES ENDPOINTS ====================

@api_router.get("/resources", response_model=List[ContentResponse])
async def get_resources():
    resources = await db.resources.find().to_list(100)
    
    # If no resources, return default ones
    if not resources:
        default_resources = [
            {
                "id": str(uuid.uuid4()),
                "title": "Comunicazione Efficace nelle Relazioni",
                "content_type": "video",
                "description": "Impara le basi della comunicazione assertiva per migliorare le tue relazioni.",
                "link": None,
                "is_premium": False
            },
            {
                "id": str(uuid.uuid4()),
                "title": "I 5 Linguaggi dell'Amore",
                "content_type": "lettura",
                "description": "Scopri come esprimere e ricevere amore nel modo più efficace.",
                "link": None,
                "is_premium": False
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Gestire i Conflitti con Intelligenza Emotiva",
                "content_type": "video",
                "description": "Tecniche pratiche per affrontare i disaccordi in modo costruttivo.",
                "link": None,
                "is_premium": False
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Diario della Gratitudine Relazionale",
                "content_type": "strumento",
                "description": "Uno strumento per coltivare la gratitudine nelle tue relazioni quotidiane.",
                "link": None,
                "is_premium": False
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Confini Sani: Workshop Avanzato",
                "content_type": "video",
                "description": "Un workshop approfondito sulla creazione di confini sani nelle relazioni.",
                "link": None,
                "is_premium": True
            },
            {
                "id": str(uuid.uuid4()),
                "title": "La Scienza dell'Attaccamento",
                "content_type": "lettura",
                "description": "Comprendere gli stili di attaccamento per relazioni più consapevoli.",
                "link": None,
                "is_premium": True
            },
        ]
        return [ContentResponse(**r) for r in default_resources]
    
    return [ContentResponse(**r) for r in resources]

# ==================== NOTIFICATIONS ENDPOINTS ====================

@api_router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]}
    ).sort("created_at", -1).to_list(50)
    
    # Generate reminders if needed
    relationships = await db.relationships.find({"user_id": current_user["id"], "monitoring_active": True}).to_list(10)
    
    for rel in relationships:
        # Check if check-in reminder needed (weekly)
        last_monitoring = await db.monitoring.find_one(
            {"relationship_id": rel["id"]},
            sort=[("created_at", -1)]
        )
        
        if last_monitoring:
            days_since = (datetime.utcnow() - last_monitoring["created_at"]).days
            if days_since >= 7:
                # Check if reminder already exists
                existing_reminder = await db.notifications.find_one({
                    "user_id": current_user["id"],
                    "notification_type": "checkin_reminder",
                    "read": False,
                    "created_at": {"$gte": datetime.utcnow() - timedelta(days=1)}
                })
                
                if not existing_reminder:
                    reminder = {
                        "id": str(uuid.uuid4()),
                        "user_id": current_user["id"],
                        "notification_type": "checkin_reminder",
                        "message": f"È tempo del check-in settimanale per la relazione con {rel['person_name']}!",
                        "read": False,
                        "created_at": datetime.utcnow()
                    }
                    await db.notifications.insert_one(reminder)
                    notifications.insert(0, reminder)
    
    return [NotificationResponse(**n) for n in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    
    return {"message": "Notifica segnata come letta"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": current_user["id"], "read": False})
    return {"count": count}

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Get phase1 status
    phase1 = await db.phase1_responses.find_one({"user_id": current_user["id"]})
    
    # Get relationships count
    relationships_count = await db.relationships.count_documents({"user_id": current_user["id"]})
    
    # Get relationships with their status
    relationships = await db.relationships.find({"user_id": current_user["id"]}).to_list(10)
    relationships_data = []
    
    for rel in relationships:
        phase2 = await db.phase2_responses.find_one({"relationship_id": rel["id"]})
        latest_monitoring = await db.monitoring.find_one(
            {"relationship_id": rel["id"]},
            sort=[("created_at", -1)]
        )
        
        compatibility = None
        if latest_monitoring:
            compatibility = latest_monitoring["compatibility"]
        elif phase2 and phase2.get("initial_compatibility"):
            compatibility = phase2["initial_compatibility"]
        
        relationships_data.append({
            "id": rel["id"],
            "person_name": rel["person_name"],
            "relationship_type": rel.get("relationship_type"),
            "phase2_completed": phase2 is not None and phase2.get("initial_compatibility") is not None,
            "compatibility": compatibility,
            "monitoring_active": rel.get("monitoring_active", False)
        })
    
    return {
        "phase1_completed": phase1 is not None,
        "phase1_traits": phase1.get("traits", []) if phase1 else [],
        "relationships_count": relationships_count,
        "max_relationships": 3,
        "relationships": relationships_data
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
