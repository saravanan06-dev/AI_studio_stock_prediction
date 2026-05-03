from fastapi import FastAPI
import joblib
import pandas as pd
import numpy as np
import yfinance as yf
from data_processor import engineer_features

app = FastAPI()

import os

# Load model and scaler
model = None
scaler = None

def load_models():
    global model, scaler
    try:
        # Use absolute path relative to this file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, 'best_stock_model.pkl')
        scaler_path = os.path.join(base_dir, 'scaler.pkl')
        
        if not os.path.exists(model_path):
            print(f"[PYTHON] Model file not found at: {model_path}")
            return False
            
        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
        print("[PYTHON] Models loaded successfully from absolute paths")
        return True
    except Exception as e:
        print(f"[PYTHON] Failed to load models: {str(e)}")
        return False

# Initial attempt
load_models()

@app.get("/predict")
def predict(symbol: str):
    global model, scaler
    print(f"[PYTHON] Prediction request for {symbol}")
    
    if model is None or scaler is None:
        if not load_models():
            return {"error": "Models not loaded. Training might be in progress or failed."}

    try:
        # Fetch latest data
        # Using a session with a user-agent to avoid 401/403 from Yahoo Finance
        import requests
        df = yf.download(symbol, period="60d", progress=False)
        
        if df.empty:
            print(f"[PYTHON] No data found for {symbol}")
            return {"error": "No data found for symbol"}

        df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
        
        # Engineer features
        df_feat = engineer_features(df)
        if df_feat.empty:
            return {"error": "Insufficient data to engineer features"}
            
        latest_data = df_feat.iloc[-1:]
        
        # Prepare features
        features = ['SMA_10', 'SMA_50', 'EMA_10', 'EMA_50', 'RSI_14', 'Daily_Return', 'Volatility', 'Volume_Change']
        X = latest_data[features]
        X_scaled = scaler.transform(X)
        
        # Predict
        prediction = model.predict(X_scaled)[0]
        prob = model.predict_proba(X_scaled)[0]
        
        # Calculate reasoning insights based on latest features
        insights = []
        
        # RSI Logic
        rsi = float(latest_data['RSI_14'].values[0])
        if rsi < 30:
            insights.append({"indicator": "RSI", "value": f"{rsi:.1f}", "signal": "BULLISH", "reason": "Oversold conditions detected (RSI < 30)"})
        elif rsi > 70:
            insights.append({"indicator": "RSI", "value": f"{rsi:.1f}", "signal": "BEARISH", "reason": "Overbought conditions detected (RSI > 70)"})
        else:
            insights.append({"indicator": "RSI", "value": f"{rsi:.1f}", "signal": "NEUTRAL", "reason": "RSI is in neutral territory"})

        # Moving Average Logic
        sma_10 = float(latest_data['SMA_10'].values[0])
        sma_50 = float(latest_data['SMA_50'].values[0])
        if sma_10 > sma_50:
            insights.append({"indicator": "SMA Cross", "value": "Bullish", "signal": "BULLISH", "reason": "10-period SMA is above 50-period SMA (Golden Cross logic)"})
        else:
            insights.append({"indicator": "SMA Cross", "value": "Bearish", "signal": "BEARISH", "reason": "10-period SMA is below 50-period SMA (Death Cross logic)"})

        # Volatility
        vol = float(latest_data['Volatility'].values[0]) * 100
        if vol < 1.0:
            insights.append({"indicator": "Volatility", "value": f"{vol:.2f}%", "signal": "BULLISH", "reason": "Low volatility environment suggests stable growth"})
        else:
            insights.append({"indicator": "Volatility", "value": f"{vol:.2f}%", "signal": "BEARISH", "reason": "High volatility indicates increased market risk"})

        # Volume Change
        vol_change = float(latest_data['Volume_Change'].values[0]) * 100
        if vol_change > 20:
            insights.append({"indicator": "Volume", "value": f"+{vol_change:.1f}%", "signal": "BULLISH", "reason": "Significant volume surge confirms trend strength"})
        elif vol_change < -20:
            insights.append({"indicator": "Volume", "value": f"{vol_change:.1f}%", "signal": "BEARISH", "reason": "Sharp volume drop suggests weakening interest"})
        else:
            insights.append({"indicator": "Volume", "value": f"{vol_change:.1f}%", "signal": "NEUTRAL", "reason": "Volume is stable"})

        return {
            "symbol": symbol,
            "prediction": "UP" if prediction == 1 else "DOWN",
            "confidence": float(np.max(prob)),
            "current_price": float(latest_data['Close'].values[0]),
            "targetPrice": float(latest_data['Close'].values[0] * (1.02 if prediction == 1 else 0.98)),
            "insights": insights
        }
    except Exception as e:
        print(f"[PYTHON] Error during prediction: {str(e)}")
        # If it's a 401 from yfinance, fastapi doesn't return 401 unless we tell it to.
        # But maybe uvicorn/fastapi handles some exceptions by returning 401?
        # Unlikely. Let's return a 200 with error message.
        return {"error": str(e)}

@app.get("/")
async def root():
    return {"status": "ok", "message": "ML Stock Prediction API"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    print("[PYTHON] Starting Uvicorn on port 8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001)
