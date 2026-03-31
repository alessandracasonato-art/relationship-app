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
# Nuove domande con risposte a scelta multipla (4 opzioni)
# Punteggio: opzione 1 = 4, opzione 2 = 3, opzione 3 = 2, opzione 4 = 1

PHASE1_QUESTIONS = [
    # 1️⃣ Energia relazionale
    {
        "id": "energia_1",
        "category": "energia_relazionale",
        "text": "Quando vivi un momento emotivamente positivo con qualcuno, dopo ti senti:",
        "options": [
            {"value": 4, "label": "Più energico/a"},
            {"value": 3, "label": "Sereno/a"},
            {"value": 2, "label": "Stabile"},
            {"value": 1, "label": "Scarico/a"}
        ]
    },
    {
        "id": "energia_2",
        "category": "energia_relazionale",
        "text": "Quando vivi un momento emotivamente faticoso con qualcuno, quanto tempo tende a influenzarti?",
        "options": [
            {"value": 4, "label": "Si riduce in poco tempo (entro poche ore)"},
            {"value": 3, "label": "Rimane per il resto della giornata"},
            {"value": 2, "label": "Dura anche nei giorni successivi"},
            {"value": 1, "label": "Mi porta a chiudermi o a prendere distanza"}
        ]
    },
    {
        "id": "energia_3",
        "category": "energia_relazionale",
        "text": "Quando stai bene con qualcuno, tendi a:",
        "options": [
            {"value": 4, "label": "Cercare ancora quel contatto"},
            {"value": 3, "label": "Goderti il momento"},
            {"value": 2, "label": "Tornare al tuo spazio"},
            {"value": 1, "label": "Non farci troppo caso"}
        ]
    },
    # 2️⃣ Gestione emotiva
    {
        "id": "gestione_1",
        "category": "gestione_emotiva",
        "text": "Quando qualcosa ti ferisce in una relazione, la tua prima reazione è:",
        "options": [
            {"value": 4, "label": "Ne parlo subito"},
            {"value": 3, "label": "Mi prendo tempo"},
            {"value": 2, "label": "Mi chiudo"},
            {"value": 1, "label": "Faccio finta di nulla"}
        ]
    },
    {
        "id": "gestione_2",
        "category": "gestione_emotiva",
        "text": "Quando provi un'emozione intensa, tendi a:",
        "options": [
            {"value": 4, "label": "Esprimerla chiaramente"},
            {"value": 3, "label": "Filtrarla"},
            {"value": 2, "label": "Trattenerla"},
            {"value": 1, "label": "Non comprenderla subito"}
        ]
    },
    {
        "id": "gestione_3",
        "category": "gestione_emotiva",
        "text": "Quando qualcosa non ti torna in una relazione:",
        "options": [
            {"value": 4, "label": "Lo affronti"},
            {"value": 3, "label": "Lo osservi"},
            {"value": 2, "label": "Lo ignori"},
            {"value": 1, "label": "Ti crea disagio ma non agisci"}
        ]
    },
    # 3️⃣ Bisogni relazionali
    {
        "id": "bisogni_1",
        "category": "bisogni_relazionali",
        "text": "In una relazione per te è più importante:",
        "options": [
            {"value": 4, "label": "Sentirti compreso/a"},
            {"value": 3, "label": "Sentirti libero/a"},
            {"value": 2, "label": "Sentirti supportato/a"},
            {"value": 1, "label": "Sentirti stabile"}
        ]
    },
    {
        "id": "bisogni_2",
        "category": "bisogni_relazionali",
        "text": "Quando una relazione non risponde ai tuoi bisogni, tendi a:",
        "options": [
            {"value": 4, "label": "Comunicarlo"},
            {"value": 3, "label": "Adattarti"},
            {"value": 2, "label": "Allontanarti"},
            {"value": 1, "label": "Confonderti"}
        ]
    },
    {
        "id": "bisogni_3",
        "category": "bisogni_relazionali",
        "text": "Ti accorgi facilmente di ciò di cui hai bisogno in una relazione?",
        "options": [
            {"value": 4, "label": "Sempre"},
            {"value": 3, "label": "Spesso"},
            {"value": 2, "label": "A volte"},
            {"value": 1, "label": "Raramente"}
        ]
    },
    # 4️⃣ Stile decisionale
    {
        "id": "decisionale_1",
        "category": "stile_decisionale",
        "text": "Nelle relazioni prendi decisioni principalmente:",
        "options": [
            {"value": 4, "label": "Dopo aver riflettuto"},
            {"value": 3, "label": "Di impulso"},
            {"value": 2, "label": "In base all'altro"},
            {"value": 1, "label": "Evitandole"}
        ]
    },
    {
        "id": "decisionale_2",
        "category": "stile_decisionale",
        "text": "Quando c'è qualcosa da chiarire, tendi a:",
        "options": [
            {"value": 4, "label": "Affrontarlo subito"},
            {"value": 3, "label": "Rimandare"},
            {"value": 2, "label": "Aspettare che lo faccia l'altro"},
            {"value": 1, "label": "Evitarlo"}
        ]
    },
    {
        "id": "decisionale_3",
        "category": "stile_decisionale",
        "text": "Quando una relazione non ti convince:",
        "options": [
            {"value": 4, "label": "Prendi posizione"},
            {"value": 3, "label": "Rifletti a lungo"},
            {"value": 2, "label": "Rimani nel dubbio"},
            {"value": 1, "label": "Eviti di decidere"}
        ]
    },
    # 5️⃣ Reazione al cambiamento
    {
        "id": "cambiamento_1",
        "category": "reazione_cambiamento",
        "text": "Quando una relazione cambia rispetto a prima (indipendentemente dal fatto che sia positivo o faticoso), io:",
        "options": [
            {"value": 4, "label": "Osservo"},
            {"value": 3, "label": "Mi attivo"},
            {"value": 2, "label": "Cerco di riorganizzare"},
            {"value": 1, "label": "Mi irrigidisco"}
        ]
    },
    {
        "id": "cambiamento_2",
        "category": "reazione_cambiamento",
        "text": "Quando percepisci distanza in una relazione, tendi a:",
        "options": [
            {"value": 4, "label": "Avvicinarti"},
            {"value": 3, "label": "Aspettare"},
            {"value": 2, "label": "Allontanarti"},
            {"value": 1, "label": "Non sapere cosa fare"}
        ]
    },
    {
        "id": "cambiamento_3",
        "category": "reazione_cambiamento",
        "text": "Quando qualcosa migliora in una relazione:",
        "options": [
            {"value": 4, "label": "Ti fidi subito"},
            {"value": 3, "label": "Osservi nel tempo"},
            {"value": 2, "label": "Resti cauto/a"},
            {"value": 1, "label": "Fatichi a crederci"}
        ]
    },
]

# Nomi delle categorie per la visualizzazione
PHASE1_CATEGORY_NAMES = {
    "energia_relazionale": "Energia Relazionale",
    "gestione_emotiva": "Gestione Emotiva",
    "bisogni_relazionali": "Bisogni Relazionali",
    "stile_decisionale": "Stile Decisionale",
    "reazione_cambiamento": "Reazione al Cambiamento",
}

# ==================== PHASE 2 QUESTIONS BY AREA ====================
# Nuove domande con risposte a scelta multipla (4 opzioni)

PHASE2_AREAS = {
    "comunicazione": {
        "name": "Comunicazione",
        "questions": [
            {
                "id": "p2_comm_1",
                "text": "Con questa persona la comunicazione è:",
                "options": [
                    {"value": 4, "label": "Fluida"},
                    {"value": 3, "label": "Alterna"},
                    {"value": 2, "label": "Difficile"},
                    {"value": 1, "label": "Evitata"}
                ]
            },
            {
                "id": "p2_comm_2",
                "text": "Quando parlate di cose importanti:",
                "options": [
                    {"value": 4, "label": "Vi capite"},
                    {"value": 3, "label": "A volte sì, a volte no"},
                    {"value": 2, "label": "Spesso no"},
                    {"value": 1, "label": "Evitate"}
                ]
            },
            {
                "id": "p2_comm_3",
                "text": "Ti senti libero/a di dire ciò che pensi?",
                "options": [
                    {"value": 4, "label": "Sempre"},
                    {"value": 3, "label": "Spesso"},
                    {"value": 2, "label": "Poco"},
                    {"value": 1, "label": "No"}
                ]
            },
            {
                "id": "p2_comm_4",
                "text": "Quando comunichi qualcosa di importante:",
                "options": [
                    {"value": 4, "label": "Ti senti accolto/a"},
                    {"value": 3, "label": "Dipende dal momento"},
                    {"value": 2, "label": "Spesso non ti senti capito/a"},
                    {"value": 1, "label": "Eviti"}
                ]
            }
        ]
    },
    "valori": {
        "name": "Valori",
        "questions": [
            {
                "id": "p2_val_1",
                "text": "Senti che avete una visione simile su ciò che è importante nella vita?",
                "options": [
                    {"value": 4, "label": "Molto"},
                    {"value": 3, "label": "Abbastanza"},
                    {"value": 2, "label": "Poco"},
                    {"value": 1, "label": "Per niente"}
                ]
            },
            {
                "id": "p2_val_2",
                "text": "Le vostre priorità sono:",
                "options": [
                    {"value": 4, "label": "Allineate"},
                    {"value": 3, "label": "Parzialmente diverse"},
                    {"value": 2, "label": "Molto diverse"},
                    {"value": 1, "label": "Non chiare"}
                ]
            },
            {
                "id": "p2_val_3",
                "text": "Ti capita di sentirti \"fuori posto\" rispetto al modo di vedere le cose dell'altro?",
                "options": [
                    {"value": 4, "label": "Mai"},
                    {"value": 3, "label": "A volte"},
                    {"value": 2, "label": "Spesso"},
                    {"value": 1, "label": "Quasi sempre"}
                ]
            },
            {
                "id": "p2_val_4",
                "text": "Senti che prendete decisioni importanti in modo simile?",
                "options": [
                    {"value": 4, "label": "Sì"},
                    {"value": 3, "label": "Abbastanza"},
                    {"value": 2, "label": "Poco"},
                    {"value": 1, "label": "No"}
                ]
            }
        ]
    },
    "bisogni_emotivi": {
        "name": "Bisogni Emotivi",
        "questions": [
            {
                "id": "p2_emo_1",
                "text": "Ti senti visto/a da questa persona?",
                "options": [
                    {"value": 4, "label": "Molto"},
                    {"value": 3, "label": "Abbastanza"},
                    {"value": 2, "label": "Poco"},
                    {"value": 1, "label": "Per niente"}
                ]
            },
            {
                "id": "p2_emo_2",
                "text": "Questa relazione ti fa sentire:",
                "options": [
                    {"value": 4, "label": "Nutrito/a"},
                    {"value": 3, "label": "Alterno/a"},
                    {"value": 2, "label": "Vuoto/a"},
                    {"value": 1, "label": "Confuso/a"}
                ]
            },
            {
                "id": "p2_emo_3",
                "text": "Quando hai bisogno di supporto, questa persona:",
                "options": [
                    {"value": 4, "label": "C'è"},
                    {"value": 3, "label": "A volte"},
                    {"value": 2, "label": "Raramente"},
                    {"value": 1, "label": "No"}
                ]
            },
            {
                "id": "p2_emo_4",
                "text": "Ti senti libero/a di essere te stesso/a in questa relazione?",
                "options": [
                    {"value": 4, "label": "Sempre"},
                    {"value": 3, "label": "Spesso"},
                    {"value": 2, "label": "Poco"},
                    {"value": 1, "label": "No"}
                ]
            }
        ]
    },
    "conflitto": {
        "name": "Gestione del Conflitto",
        "questions": [
            {
                "id": "p2_conf_1",
                "text": "Quando c'è tensione tra voi:",
                "options": [
                    {"value": 4, "label": "Viene affrontata"},
                    {"value": 3, "label": "A volte sì"},
                    {"value": 2, "label": "Viene evitata"},
                    {"value": 1, "label": "Esplode"}
                ]
            },
            {
                "id": "p2_conf_2",
                "text": "Dopo un conflitto:",
                "options": [
                    {"value": 4, "label": "Vi riavvicinate"},
                    {"value": 3, "label": "Serve tempo"},
                    {"value": 2, "label": "Restano strascichi"},
                    {"value": 1, "label": "Si crea distanza"}
                ]
            },
            {
                "id": "p2_conf_3",
                "text": "Durante un confronto ti senti:",
                "options": [
                    {"value": 4, "label": "Ascoltato/a"},
                    {"value": 3, "label": "Parzialmente"},
                    {"value": 2, "label": "Poco"},
                    {"value": 1, "label": "Non ascoltato/a"}
                ]
            },
            {
                "id": "p2_conf_4",
                "text": "I conflitti portano a maggiore chiarezza o distanza?",
                "options": [
                    {"value": 4, "label": "Chiarezza"},
                    {"value": 3, "label": "A volte"},
                    {"value": 2, "label": "Distanza"},
                    {"value": 1, "label": "Confusione"}
                ]
            }
        ]
    },
    "stabilita": {
        "name": "Stabilità e Coerenza",
        "questions": [
            {
                "id": "p2_stab_1",
                "text": "Questa relazione è:",
                "options": [
                    {"value": 4, "label": "Stabile"},
                    {"value": 3, "label": "Variabile"},
                    {"value": 2, "label": "Instabile"},
                    {"value": 1, "label": "Imprevedibile"}
                ]
            },
            {
                "id": "p2_stab_2",
                "text": "Il comportamento dell'altra persona è:",
                "options": [
                    {"value": 4, "label": "Coerente"},
                    {"value": 3, "label": "A tratti incoerente"},
                    {"value": 2, "label": "Spesso incoerente"},
                    {"value": 1, "label": "Difficile da leggere"}
                ]
            },
            {
                "id": "p2_stab_3",
                "text": "Ti senti al sicuro in questa relazione?",
                "options": [
                    {"value": 4, "label": "Sì"},
                    {"value": 3, "label": "Abbastanza"},
                    {"value": 2, "label": "Poco"},
                    {"value": 1, "label": "No"}
                ]
            },
            {
                "id": "p2_stab_4",
                "text": "Sai cosa aspettarti da questa persona nel tempo?",
                "options": [
                    {"value": 4, "label": "Sì"},
                    {"value": 3, "label": "Abbastanza"},
                    {"value": 2, "label": "Poco"},
                    {"value": 1, "label": "No"}
                ]
            }
        ]
    }
}

PHASE2_AREA_ORDER = ["comunicazione", "valori", "bisogni_emotivi", "conflitto", "stabilita"]

# Pesi per il calcolo della media pesata dell'indice di compatibilità
AREA_WEIGHTS = {
    "comunicazione": 0.25,
    "bisogni_emotivi": 0.25,
    "valori": 0.20,
    "conflitto": 0.15,
    "stabilita": 0.15,
}

# ==================== MONITORING QUESTIONS ====================

MONITORING_QUESTIONS = [
    {"id": "mon_1", "text": "È successo qualcosa di significativo nella relazione questa settimana?"},
    {"id": "mon_2", "text": "La tua percezione della relazione è cambiata?"},
    {"id": "mon_3", "text": "La comunicazione è stata più facile o più difficile?"},
    {"id": "mon_4", "text": "Ti sei sentito/a più o meno connesso/a?"},
]

# ==================== INTRO VIDEO ENDPOINT ====================

@api_router.get("/intro-video")
async def get_intro_video():
    """Get the intro video URL if uploaded"""
    video = await db.settings.find_one({"key": "intro_video"})
    if video and video.get("url"):
        return {"url": video["url"], "has_video": True}
    return {"url": None, "has_video": False}

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
            # Converti in percentuale (max 4 punti = 100%)
            profile_score[cat] = (sum(scores) / len(scores) / 4) * 100
    
    # Generate traits based on new categories
    traits = []
    
    # Energia relazionale
    energia = profile_score.get("energia_relazionale", 0)
    if energia >= 75:
        traits.append("Alta capacità di recupero emotivo")
    elif energia >= 50:
        traits.append("Energia relazionale equilibrata")
    else:
        traits.append("Sensibile agli eventi relazionali")
    
    # Gestione emotiva
    gestione = profile_score.get("gestione_emotiva", 0)
    if gestione >= 75:
        traits.append("Comunica le emozioni apertamente")
    elif gestione >= 50:
        traits.append("Gestione emotiva riflessiva")
    else:
        traits.append("Elaborazione emotiva interna")
    
    # Bisogni relazionali
    bisogni = profile_score.get("bisogni_relazionali", 0)
    if bisogni >= 75:
        traits.append("Esprime chiaramente i propri bisogni")
    elif bisogni >= 50:
        traits.append("Bisogni relazionali adattivi")
    else:
        traits.append("Tende ad adattarsi agli altri")
    
    # Stile decisionale
    decisionale = profile_score.get("stile_decisionale", 0)
    if decisionale >= 75:
        traits.append("Decisioni relazionali proattive")
    elif decisionale >= 50:
        traits.append("Stile decisionale ponderato")
    else:
        traits.append("Preferisce evitare le decisioni difficili")
    
    # Reazione al cambiamento
    cambiamento = profile_score.get("reazione_cambiamento", 0)
    if cambiamento >= 75:
        traits.append("Si attiva positivamente al cambiamento")
    elif cambiamento >= 50:
        traits.append("Osserva il cambiamento con cautela")
    else:
        traits.append("Il cambiamento genera incertezza")
    
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

class RelationshipUpdate(BaseModel):
    person_name: Optional[str] = None
    relationship_type: Optional[str] = None

@api_router.put("/relationships/{relationship_id}", response_model=RelationshipResponse)
async def update_relationship(relationship_id: str, data: RelationshipUpdate, current_user: dict = Depends(get_current_user)):
    rel = await db.relationships.find_one({"id": relationship_id, "user_id": current_user["id"]})
    if not rel:
        raise HTTPException(status_code=404, detail="Relazione non trovata")
    
    update_data = {}
    if data.person_name is not None:
        update_data["person_name"] = data.person_name
    if data.relationship_type is not None:
        update_data["relationship_type"] = data.relationship_type
    
    if update_data:
        await db.relationships.update_one(
            {"id": relationship_id},
            {"$set": update_data}
        )
    
    # Fetch updated relationship
    rel = await db.relationships.find_one({"id": relationship_id})
    
    # Get phase2 and monitoring status
    phase2 = await db.phase2_responses.find_one({"relationship_id": relationship_id})
    phase2_completed = phase2 is not None and phase2.get("initial_compatibility") is not None
    
    latest_monitoring = await db.monitoring.find_one(
        {"relationship_id": relationship_id},
        sort=[("created_at", -1)]
    )
    
    latest_compatibility = None
    if latest_monitoring:
        latest_compatibility = latest_monitoring.get("compatibility")
    elif phase2 and phase2.get("initial_compatibility"):
        latest_compatibility = phase2["initial_compatibility"]
    
    return RelationshipResponse(
        id=rel["id"],
        user_id=rel["user_id"],
        person_name=rel["person_name"],
        relationship_type=rel.get("relationship_type"),
        created_at=rel["created_at"],
        phase2_completed=phase2_completed,
        latest_compatibility=latest_compatibility,
        monitoring_active=rel.get("monitoring_active", False)
    )

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
    
    # Calculate area score (ora 1-4 invece di 1-5)
    scores = list(data.responses.values())
    if scores:
        area_scores[data.area_id] = (sum(scores) / len(scores) / 4) * 100  # Convert 1-4 to 0-100
    
    # Calculate compatibility if all areas completed
    initial_compatibility = None
    awareness_plan = None
    
    if set(completed_areas) == set(PHASE2_AREA_ORDER):
        # All areas completed - calculate weighted compatibility
        initial_compatibility = sum(
            area_scores[area] * AREA_WEIGHTS.get(area, 0.20)
            for area in area_scores
        )
        
        # Generate awareness plan with individual area scores
        harmony_areas = []
        observe_areas = []
        all_area_scores = []
        
        for area_id in PHASE2_AREA_ORDER:
            score = area_scores.get(area_id, 0)
            area_name = PHASE2_AREAS[area_id]["name"]
            weight = AREA_WEIGHTS.get(area_id, 0.20)
            area_entry = {
                "area": area_name,
                "area_id": area_id,
                "score": round(score, 1),
                "weight": round(weight * 100),
            }
            all_area_scores.append(area_entry)
            if score >= 70:
                harmony_areas.append(area_entry)
            else:
                observe_areas.append(area_entry)
        
        awareness_plan = {
            "harmony_areas": harmony_areas,
            "observe_areas": observe_areas,
            "all_area_scores": all_area_scores,
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

@api_router.delete("/phase2/{relationship_id}/reset")
async def reset_phase2(relationship_id: str, current_user: dict = Depends(get_current_user)):
    """Reset Phase 2 responses to allow user to redo the analysis"""
    # Verify relationship belongs to user
    rel = await db.relationships.find_one({"id": relationship_id, "user_id": current_user["id"]})
    if not rel:
        raise HTTPException(status_code=404, detail="Relazione non trovata")
    
    # Delete existing Phase 2 responses
    await db.phase2_responses.delete_many({"relationship_id": relationship_id})
    
    return {"message": "Analisi resettata. Puoi ricominciare la Fase 2."}

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
