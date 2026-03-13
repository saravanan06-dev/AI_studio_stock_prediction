from fastapi import FastAPI
import joblib
import pandas as pd
import numpy as np
import yfinance as yf
from data_processor import engineer_features

app = FastAPI()

# Load model and scaler
model = joblib.load('best_stock_model.pkl')
scaler = joblib.load('scaler.pkl')

@app.get("/predict")
def predict(symbol: str):
    # Fetch latest data
    df = yf.download(symbol, period="60d")
    df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
    
    # Engineer features
    df_feat = engineer_features(df)
    latest_data = df_feat.iloc[-1:]
    
    # Prepare features
    features = ['SMA_10', 'SMA_50', 'EMA_10', 'EMA_50', 'RSI_14', 'Daily_Return', 'Volatility', 'Volume_Change']
    X = latest_data[features]
    X_scaled = scaler.transform(X)
    
    # Predict
    prediction = model.predict(X_scaled)[0]
    prob = model.predict_proba(X_scaled)[0]
    
    return {
        "symbol": symbol,
        "prediction": "UP" if prediction == 1 else "DOWN",
        "confidence": float(np.max(prob)),
        "current_price": float(latest_data['Close'].values[0])
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
