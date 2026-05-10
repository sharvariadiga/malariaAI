import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import io
import cv2
import numpy as np
import base64
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
try:
    import tensorflow as tf
    from keras.models import load_model
    TF_AVAILABLE = True
except ImportError as e:
    print(f"TensorFlow import error: {e}")
    TF_AVAILABLE = False
    
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import SessionLocal, PatientReport
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(override=True)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI(title="Malaria Detection API")

# Add CORS so our frontend can access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency for database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic schema for creating a report
class ReportCreate(BaseModel):
    patient_name: str
    patient_age: str
    patient_id: str
    doctor: str
    hospital: str
    prediction: str
    confidence: float
    original_image_b64: str
    heatmap_image_b64: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    lang: str = "en"

# Load the model at startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "malaria_model_final.keras")
model = None

try:
    if TF_AVAILABLE and os.path.exists(MODEL_PATH):
        import traceback
        try:
            model = load_model(MODEL_PATH)
            print(f"Model loaded successfully from {MODEL_PATH}")
        except Exception as e:
            print(f"Failed to load model from {MODEL_PATH}")
            traceback.print_exc()
    else:
        if not TF_AVAILABLE:
            print("WARNING: TensorFlow not available. CNN model will not be loaded.")
        else:
            print(f"WARNING: Model not found at {MODEL_PATH}. Make sure to run cnn_model.py first.")
except Exception as e:
    import traceback
    print(f"Error checking / loading model:")
    traceback.print_exc()

def validate_image_quality(img_bytes: bytes):
    """
    Analyzes an image for quality issues before running the AI model.
    Returns a dict with 'passed' bool and 'issues' list of human-readable problems.
    """
    issues = []

    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"passed": False, "issues": ["Cannot decode image. Please upload a valid JPG or PNG file."]}

    # ── File size check ──────────────────────────────────────
    if len(img_bytes) < 1000:
        issues.append("File is too small (< 1KB). Please upload a proper microscopy image.")

    # Work on a standardized size for metric calculations
    analysis_img = cv2.resize(img, (200, 200))
    gray = cv2.cvtColor(analysis_img, cv2.COLOR_BGR2GRAY)

    # ── Brightness check ────────────────────────────────────
    mean_brightness = float(np.mean(gray))
    if mean_brightness < 35:
        issues.append(f"Image is too dark (brightness: {mean_brightness:.0f}/255). Increase microscope illumination.")
    elif mean_brightness > 235:
        issues.append(f"Image is overexposed / too bright (brightness: {mean_brightness:.0f}/255). Reduce illumination.")

    # ── Blur / sharpness check (Laplacian variance) ──────────
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if laplacian_var < 40:
        issues.append(f"Image is too blurry (sharpness score: {laplacian_var:.1f}). Please refocus the microscope.")

    # ── Contrast / flat image check ─────────────────────────
    pixel_std = float(np.std(gray))
    if pixel_std < 15:
        issues.append(f"Image has very low contrast (std: {pixel_std:.1f}). It may be a blank or uniform slide.")

    # ── Color check (should have some chromatic information) ─
    b, g, r = cv2.split(analysis_img)
    channel_variance = float(np.var([np.mean(b), np.mean(g), np.mean(r)]))
    if channel_variance < 5:
        issues.append("Image appears grayscale or has no color information. Blood smear images should have color staining.")

    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "metrics": {
            "brightness": round(mean_brightness, 1),
            "sharpness": round(laplacian_var, 1),
            "contrast": round(pixel_std, 1)
        }
    }

def preprocess_image(image_bytes: bytes):
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        
        # Decode image using OpenCV
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Invalid image format.")
            
        # Convert to RGB (because OpenCV loads BGR)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Resize image → CNN needs fixed input size (50x50) as defined in cnn_model.py
        img_resized = cv2.resize(img_rgb, (50, 50))
        
        # Normalize pixel values (0–255 → 0–1)
        img_array = np.array(img_resized) / 255.0
        
        # Expand dimensions for the batch size (1, 50, 50, 3)
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array, img_rgb
    except Exception as e:
        raise ValueError(f"Error during preprocessing: {str(e)}")

def generate_gradcam(img_array, original_img, current_model):
    try:
        last_conv_layer_name = None
        for layer in reversed(current_model.layers):
            if 'conv2d' in layer.name.lower() or 'conv' in layer.name.lower():
                last_conv_layer_name = layer.name
                break
                
        if not last_conv_layer_name:
            return None
            
        grad_model = tf.keras.models.Model(
            inputs=current_model.inputs,
            outputs=[current_model.get_layer(last_conv_layer_name).output, current_model.outputs[0]]
        )

        with tf.GradientTape() as tape:
            last_conv_layer_output, preds = grad_model(img_array)
            class_channel = preds[:, 0]

        grads = tape.gradient(class_channel, last_conv_layer_output)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        
        last_conv_layer_output = last_conv_layer_output[0]
        heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        
        heatmap = tf.maximum(heatmap, 0)
        max_val = tf.math.reduce_max(heatmap)
        if max_val != 0:
            heatmap = heatmap / max_val
            
        heatmap_resized = cv2.resize(heatmap.numpy(), (original_img.shape[1], original_img.shape[0]))
        heatmap_uint8 = np.uint8(255 * heatmap_resized)
        
        # Convert original_img back to BGR for cv2 color map overlay
        original_bgr = cv2.cvtColor(original_img, cv2.COLOR_RGB2BGR)
        heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
        
        superimposed_img = heatmap_color * 0.4 + original_bgr
        superimposed_img = np.clip(superimposed_img, 0, 255).astype(np.uint8)
        
        _, buffer = cv2.imencode('.jpg', superimposed_img)
        return base64.b64encode(buffer).decode('utf-8')
    except Exception as e:
        import traceback
        print(f"Error generating Grad-CAM: {e}")
        traceback.print_exc()
        return None

@app.post("/predict")
async def predict_image(file: UploadFile = File(...)):
    if model is None:
        return JSONResponse(
            status_code=503, 
            content={"error": "Model has not been trained or loaded. Please train the model by running cnn_model.py first."}
        )
        
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    try:
        image_bytes = await file.read()

        # ── Cell Quality Validation ─────────────────────────
        quality = validate_image_quality(image_bytes)
        if not quality["passed"]:
            return JSONResponse(
                status_code=422,
                content={
                    "error": "quality_check_failed",
                    "issues": quality["issues"],
                    "metrics": quality["metrics"]
                }
            )

        processed_image, original_rgb = preprocess_image(image_bytes)
        
        # Make prediction
        # Output is a single probability value from Sigmoid
        prediction_prob = model.predict(processed_image)[0][0]
        
        # 0 → Parasitized (based on cnn_model.py categories list order)
        # 1 → Uninfected
        is_parasitized = float(prediction_prob) < 0.5
        
        result_class = "Parasitized" if is_parasitized else "Uninfected"
        
        # Calculate confidence percentage
        # If Parasitized (prob approaching 0), confidence is 1 - prob
        # If Uninfected (prob approaching 1), confidence is prob
        confidence = (1.0 - float(prediction_prob)) if is_parasitized else float(prediction_prob)
        confidence_percent = round(confidence * 100, 2)
        
        heatmap_b64 = generate_gradcam(processed_image, original_rgb, model)
        
        return {
            "prediction": result_class,
            "confidence": confidence_percent,
            "probability": float(prediction_prob),
            "heatmap": heatmap_b64
        }
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/reports")
def create_report(report: ReportCreate, db: Session = Depends(get_db)):
    try:
        db_report = PatientReport(**report.dict())
        db.add(db_report)
        db.commit()
        db.refresh(db_report)
        return {"message": "Report saved successfully", "id": db_report.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/reports/search")
def search_reports(q: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        if q:
            reports = db.query(PatientReport).filter(
                (PatientReport.patient_name.ilike(f"%{q}%")) |
                (PatientReport.patient_id.ilike(f"%{q}%")) |
                (PatientReport.hospital.ilike(f"%{q}%"))
            ).order_by(PatientReport.timestamp.desc()).all()
        else:
            reports = db.query(PatientReport).order_by(PatientReport.timestamp.desc()).all()
        return reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/")
def health_check():
    return {"status": "Backend is running!", "model_loaded": model is not None}
# ─── Chatbot Integration (Gemini) ──────────────────────────────────
@app.post("/chat")
async def chat_with_ai(request: ChatRequest):
    if not os.getenv("GEMINI_API_KEY"):
        return {"response": "⚠️ Gemini API Key not found. Please add GEMINI_API_KEY to your .env file."}
    
    try:
        model_llm = genai.GenerativeModel('gemini-2.5-flash')
        
        # System instructions to keep it professional and medical
        system_prompt = f"""
        You are 'Dr. MalariaAI', a specialized clinical assistant in a malaria diagnostic console.
        Your goal is to assist healthcare providers with:
        1. Explaining Plasmodium species (falciparum, vivax, etc.)
        2. Discussing WHO treatment protocols (ACT, Chloroquine, etc.)
        3. Explaining AI logic (CNNs, Grad-CAM heatmaps)
        4. Drafting clinical notes.
        
        Context:
        - Current language requested: {request.lang}
        - Always respond in {request.lang}.
        - Be professional, empathetic, and concise.
        - Use markdown for headers and lists.
        - If the user asks non-medical or irrelevant questions, gently bring them back to malaria diagnostics.
        - IMPORTANT: Always state that your advice is for informational purposes and should be correlated with microscopy.
        """
        
        chat = model_llm.start_chat(history=[])
        response = chat.send_message(f"{system_prompt}\n\nUser Question: {request.message}")
        
        return {"response": response.text}
    except Exception as e:
        print(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to connect to AI assistant.")
