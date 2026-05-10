# 🔬 Dr. MalariaAI

![MalariaAI Banner](https://img.shields.io/badge/MalariaAI-Clinical_Diagnostic_Suite-0ea5e9?style=for-the-badge&logo=health)

**Dr. MalariaAI** is a full-stack, AI-powered web application designed to assist medical professionals and healthcare workers in diagnosing malaria from blood smear microscopy images. Built as a comprehensive diagnostic workstation, it combines deep learning image analysis with an intelligent multilingual medical chatbot to provide rapid, accurate, and accessible clinical support.

## ✨ Key Features

*   **🧠 AI Image Analysis:** Utilizes a custom-trained Convolutional Neural Network (CNN) to instantly classify single-cell microscopy images as either *Parasitized* or *Uninfected*.
*   **🗺️ Grad-CAM Visual Explainability:** Generates heatmaps highlighting the exact regions of the cell that the AI used to make its decision, ensuring transparency for clinicians.
*   **🛡️ Image Quality Validation:** Analyzes uploaded images for brightness, contrast, and sharpness before running predictions to prevent false readings from poor-quality scans.
*   **💬 Multilingual Clinical AI Chatbot:** Features a Gemini-powered medical assistant capable of answering questions about malaria species, symptoms, and WHO treatment protocols natively in **11 languages**.
*   **📄 PDF Report Generation:** Automatically generates professional, downloadable clinical reports containing patient data, diagnostic results, and microscopy evidence.
*   **🏥 Hospital & Patient Archiving:** Includes a secure SQLite backend to log patient records. Users can search records, view patient history graphs over time, and group patients seamlessly by medical facility.
*   **📊 Analytics Dashboard:** Interactive charts built with Recharts to visualize infection trends and download clinic data as CSV files.
*   **🌓 Modern UI/UX:** A responsive, glassmorphism-inspired interface built with React, featuring both light and dark modes, drag-and-drop uploads, and dynamic emergency alerts for critical cases.

## 🛠️ Technology Stack

**Frontend:**
*   React.js (Vite)
*   Vanilla CSS (Custom variables, glassmorphism, responsive grid/flexbox)
*   Recharts (Data Visualization)
*   jsPDF (Report Generation)

**Backend:**
*   FastAPI (Python)
*   TensorFlow / Keras (CNN Model & Grad-CAM)
*   OpenCV (Image Processing & Quality Checks)
*   SQLAlchemy & SQLite (Database)
*   Google Gemini API (LLM Chatbot Integration)

## 🚀 Getting Started

### Prerequisites
*   Node.js & npm
*   Python 3.8+
*   A Google Gemini API Key

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser to the local address provided by Vite (usually `http://localhost:5173`).

## ⚠️ Disclaimer
*Dr. MalariaAI is developed for educational and research purposes. AI diagnostic results are for informational purposes only and must always be correlated with professional confirmatory thick/thin smear microscopy and clinical judgment.*
