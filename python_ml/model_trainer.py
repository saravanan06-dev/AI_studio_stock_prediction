import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, TimeSeriesSplit, GridSearchCV
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib

def train_models(X, y):
    # Time series split
    tscv = TimeSeriesSplit(n_splits=5)
    
    # Split data (70/15/15)
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, shuffle=False)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, shuffle=False)
    
    models = {
        "LogisticRegression": LogisticRegression(),
        "RandomForest": RandomForestClassifier(n_estimators=100),
        "XGBoost": XGBClassifier(use_label_encoder=False, eval_metric='logloss')
    }
    
    best_model = None
    best_acc = 0
    
    for name, model in models.items():
        model.fit(X_train, y_train)
        y_pred = model.predict(X_val)
        acc = accuracy_score(y_val, y_pred)
        print(f"{name} Validation Accuracy: {acc:.4f}")
        
        if acc > best_acc:
            best_acc = acc
            best_model = model
            
    # Final evaluation on test set
    y_test_pred = best_model.predict(X_test)
    print("\nBest Model Test Metrics:")
    print(classification_report(y_test, y_test_pred))
    
    # Save best model
    joblib.dump(best_model, 'best_stock_model.pkl')
    return best_model

if __name__ == "__main__":
    print("[TRAINER] Starting training process...")
    from data_processor import fetch_data, engineer_features, prepare_data
    print("[TRAINER] Fetching data for AAPL...")
    try:
        df = fetch_data("AAPL")
        print(f"[TRAINER] Data fetched: {len(df)} rows")
        df = engineer_features(df)
        print("[TRAINER] Features engineered")
        X, y, scaler = prepare_data(df)
        print(f"[TRAINER] Data prepared for training. X shape: {X.shape}")
        joblib.dump(scaler, 'scaler.pkl')
        print("[TRAINER] Scaler saved as scaler.pkl")
        train_models(X, y)
        print("[TRAINER] Model training complete and saved.")
    except Exception as e:
        print(f"[TRAINER] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
