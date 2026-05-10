from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime

DATABASE_URL = "sqlite:///./malaria.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class PatientReport(Base):
    __tablename__ = "patient_reports"

    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String, index=True)
    patient_age = Column(String)
    patient_id = Column(String, index=True)
    doctor = Column(String)
    hospital = Column(String)
    prediction = Column(String)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    original_image_b64 = Column(Text) # Storing base64 strings directly for simplicity in this mini-project
    heatmap_image_b64 = Column(Text)

Base.metadata.create_all(bind=engine)
