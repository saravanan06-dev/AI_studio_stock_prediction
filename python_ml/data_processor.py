import yfinance as yf
import pandas as pd
import pandas_ta as ta
from sklearn.preprocessing import StandardScaler

def fetch_data(symbol, period="2y"):
    df = yf.download(symbol, period=period)
    df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
    return df

def engineer_features(df):
    # SMA & EMA
    df['SMA_10'] = ta.sma(df['Close'], length=10)
    df['SMA_50'] = ta.sma(df['Close'], length=50)
    df['EMA_10'] = ta.ema(df['Close'], length=10)
    df['EMA_50'] = ta.ema(df['Close'], length=50)
    
    # RSI
    df['RSI_14'] = ta.rsi(df['Close'], length=14)
    
    # MACD
    macd = ta.macd(df['Close'])
    df = pd.concat([df, macd], axis=1)
    
    # Bollinger Bands
    bbands = ta.bbands(df['Close'], length=20, std=2)
    df = pd.concat([df, bbands], axis=1)
    
    # Returns & Volatility
    df['Daily_Return'] = df['Close'].pct_change()
    df['Volatility'] = df['Daily_Return'].rolling(window=20).std()
    df['Volume_Change'] = df['Volume'].pct_change()
    
    # Target: 1 if next day close > today close
    df['Target'] = (df['Close'].shift(-1) > df['Close']).astype(int)
    
    # Drop rows with NaN
    df.dropna(inplace=True)
    return df

def prepare_data(df):
    features = ['SMA_10', 'SMA_50', 'EMA_10', 'EMA_50', 'RSI_14', 'Daily_Return', 'Volatility', 'Volume_Change']
    X = df[features]
    y = df['Target']
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    return X_scaled, y, scaler
