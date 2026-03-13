# StockPredict AI - Python ML Engine

This directory contains the production-level machine learning pipeline for stock price prediction.

## Features
- **Data Collection**: Automated OHLCV fetching via `yfinance`.
- **Feature Engineering**: 10+ technical indicators (SMA, EMA, RSI, MACD, BB, Volatility).
- **Models**: Comparative training of Logistic Regression, Random Forest, and XGBoost.
- **API**: FastAPI backend for real-time predictions.

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Train the Model**:
   ```bash
   python model_trainer.py
   ```
   This will:
   - Fetch historical data for AAPL (default).
   - Engineer features.
   - Train multiple models and select the best one.
   - Save `best_stock_model.pkl` and `scaler.pkl`.

3. **Run the API**:
   ```bash
   python api_backend.py
   ```
   The API will be available at `http://localhost:8000`.

4. **Predict**:
   Send a GET request to `/predict?symbol=TSLA`.

## Deployment (AWS / Render / Railway)

### Docker Deployment
1. Create a `Dockerfile`:
   ```dockerfile
   FROM python:3.9-slim
   WORKDIR /app
   COPY . .
   RUN pip install -r requirements.txt
   CMD ["uvicorn", "api_backend:app", "--host", "0.0.0.0", "--port", "8000"]
   ```
2. Build and push to your container registry.
3. Deploy to AWS App Runner or Render.

## Risk Disclaimer
This software is for educational purposes only. Trading stocks involves significant risk.
