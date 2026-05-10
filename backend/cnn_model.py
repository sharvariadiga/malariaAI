# ============================================================
# MALARIA CNN  
# ============================================================

import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import numpy as np
import tensorflow as tf
import cv2
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report, accuracy_score, roc_curve, auc

from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras import layers, models

plt.style.use('ggplot')

print("TensorFlow Version:", tf.__version__)

# ============================================================
# 1. LOAD DATA
# ============================================================

base_path = r"D:\mini project\data\archive\cell_images"
categories = ["Parasitized", "Uninfected"]

data = []
labels = []

#  LOOP THROUGH IMAGES
for label, category in enumerate(categories):
    folder = os.path.join(base_path, category)

    for img_name in os.listdir(folder):
        path = os.path.join(folder, img_name)

        img = cv2.imread(path)

        if img is None:
            continue

        # Convert to RGB (because OpenCV loads BGR)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Resize image → CNN needs fixed input size
        img = cv2.resize(img, (50, 50))

        data.append(img)
        labels.append(label)

# Normalize pixel values (0–255 → 0–1)
# Helps model train faster and more stable
cells = np.array(data, dtype=np.float32) / 255.0
labels = np.array(labels)

print("Dataset shape:", cells.shape)

# ============================================================
# 2. SPLIT DATA
# ============================================================

# 🔹 Train = learn patterns
# 🔹 Test = evaluate performance
train_x, test_x, train_y, test_y = train_test_split(
    cells, labels, test_size=0.2, stratify=labels, random_state=42)

# ============================================================
# 3. DATA AUGMENTATION
# ============================================================

# WHY?
# Prevent overfitting (model memorizing instead of learning)

# It creates slightly modified versions of images:
# like rotate, zoom, flip → makes model robust
datagen = ImageDataGenerator(
    rotation_range=15,
    width_shift_range=0.05,
    height_shift_range=0.05,
    zoom_range=0.1,
    horizontal_flip=True
)

datagen.fit(train_x)

# ============================================================
# 4. CNN MODEL 
# ============================================================

model = models.Sequential([

    # Input: image of size 50x50 with 3 channels (RGB)
    layers.Input(shape=(50,50,3)),

    # ====================================================
    #  WHAT IS CONVOLUTION?
    # ====================================================
    # A convolution layer applies small filters (kernels)
    # that scan the image and detect patterns like:
    # edges, textures, shapes

    #  WHAT IS A FILTER?
    # A filter is a small matrix (like 3x3) that slides over image
    # and multiplies values → extracts features

    # Example:
    # Filter detects edges:
    # [ -1  0  1 ]
    # [ -1  0  1 ]
    # [ -1  0  1 ]

    # ====================================================
    # FIRST CONV BLOCK
    # ====================================================
    layers.Conv2D(32, (3,3), activation='relu'),
    # 32 filters → model learns 32 different features
    # (3x3) = filter size

    #  ReLU: removes negative values → keeps useful info
    # ReLU = max(0, x)

    layers.MaxPooling2D(2,2),
    # WHAT IS POOLING?
    # Reduces image size (downsampling)
    # Keeps important features, removes noise
    #
    # Example:
    # [2 5]
    # [7 1] → max = 7

    # ====================================================
    # SECOND CONV BLOCK
    # ====================================================
    layers.Conv2D(64,(3,3),activation='relu'),
    # More filters = detect more complex patterns

    layers.MaxPooling2D(2,2),

    # ====================================================
    # THIRD CONV BLOCK
    # ====================================================
    layers.Conv2D(128,(3,3),activation='relu'),
    #  Now model detects HIGH-LEVEL features:
    # like infected cell structures

    layers.MaxPooling2D(2,2),

    # ====================================================
    # FLATTENING
    # ====================================================
    layers.Flatten(),
    #  Converts 2D feature maps → 1D vector
    # So it can go into Dense layer

    # ====================================================
    # FULLY CONNECTED LAYER
    # ====================================================
    layers.Dense(128,activation='relu'),
    #  Combines all extracted features
    # Learns final decision patterns

    layers.Dropout(0.3),
    #  Prevents overfitting
    # Randomly turns off 30% neurons

    # ====================================================
    # OUTPUT LAYER
    # ====================================================
    layers.Dense(1,activation='sigmoid')
    #  Sigmoid outputs probability (0 to 1)
    # 0 → Uninfected
    # 1 → Parasitized
])

model.compile(
    optimizer='adam',  # smart optimizer
    loss='binary_crossentropy',  # for 2 classes
    metrics=['accuracy']
)

model.summary()

# ============================================================
# 5. TRAINING
# ============================================================

history = model.fit(
    datagen.flow(train_x, train_y, batch_size=32),
    epochs=10,
    validation_data=(test_x, test_y)
)

# ============================================================
# 6. EVALUATION
# ============================================================

loss, acc = model.evaluate(test_x, test_y)
print("Test Accuracy:", acc)

# ============================================================
# 7. PREDICTIONS
# ============================================================

#  Model outputs probability
pred_probs = model.predict(test_x)

#  Convert probability → class
pred_classes = (pred_probs > 0.5).astype(int).flatten()

# ============================================================
# 8. CONFUSION MATRIX
# ============================================================

#  Shows correct vs wrong predictions
cm = confusion_matrix(test_y, pred_classes)

sns.heatmap(cm, annot=True, fmt='d')
plt.title("Confusion Matrix")
plt.show()

# ============================================================
# 9. CLASSIFICATION REPORT
# ============================================================

#  Precision, Recall, F1-score
print(classification_report(test_y, pred_classes))

# ============================================================
# 10. ROC CURVE
# ============================================================

#  Measures model performance at different thresholds
fpr, tpr, thresholds = roc_curve(test_y, pred_probs)
roc_auc = auc(fpr, tpr)

plt.plot(fpr, tpr, label=f"AUC = {roc_auc:.3f}")
plt.plot([0,1],[0,1],'--')
plt.legend()
plt.show()

# ============================================================
# 11. SAVE MODEL
# ============================================================

model.save(r"backend\models\malaria_model_final.keras")
print("Model saved successfully!")