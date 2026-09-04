import os
import json
import logging
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from app.ml.dataset import generate_synthetic_dataset, FEATURE_NAMES, RISK_CLASSES

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("chainstate.ml.train")

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")


def train_risk_model():
    """Trains the Random Forest risk classifier and exports serialized model artifacts."""
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    model_path = os.path.join(ARTIFACTS_DIR, "risk_model.joblib")
    metadata_path = os.path.join(ARTIFACTS_DIR, "model_metadata.json")

    logger.info("Generating synthetic feature dataset for prototype model training...")
    X, y = generate_synthetic_dataset(num_samples=2500, seed=42)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    logger.info(f"Training RandomForestClassifier on {len(X_train)} samples across 8 features...")
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        class_weight="balanced"
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    logger.info(f"Model validation accuracy: {acc * 100:.2f}%")
    report = classification_report(y_test, y_pred, target_names=RISK_CLASSES, output_dict=True)

    # Feature importances
    importances = clf.feature_importances_.tolist()
    feature_importance_dict = {
        name: round(imp, 4) for name, imp in zip(FEATURE_NAMES, importances)
    }
    logger.info(f"Feature Importances: {feature_importance_dict}")

    # Serialize trained model
    joblib.dump(clf, model_path)
    logger.info(f"Saved trained model artifact to {model_path}")

    # Save model metadata
    metadata = {
        "model_type": "RandomForestClassifier",
        "n_estimators": 100,
        "max_depth": 8,
        "features": FEATURE_NAMES,
        "classes": RISK_CLASSES,
        "validation_accuracy": round(acc, 4),
        "classification_report": report,
        "feature_importances": feature_importance_dict,
        "is_demo": True,
        "notice": (
            "PROTOTYPE MODEL DISCLAIMER: This risk scoring model is trained on a synthetic baseline "
            "dataset. It provides decision support and risk indicators. Final deployment authorization "
            "is enforced by human role-based approval policy gates."
        )
    }

    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Saved model metadata to {metadata_path}")

    return clf, metadata


if __name__ == "__main__":
    train_risk_model()
