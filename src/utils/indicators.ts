/**
 * Technical Indicators Utility
 */

export interface StockData {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

export interface IndicatorResult extends StockData {
  sma10?: number;
  sma50?: number;
  sma200?: number;
  ema9?: number;
  ema10?: number;
  ema21?: number;
  ema50?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  bbUpper?: number;
  bbLower?: number;
  bbMiddle?: number;
  bbRange?: [number, number];
  volatility?: number;
  atr?: number;
  dailyReturn?: number;
  volumeChange?: number;
  adLine?: number;
  adLineSMA?: number;
  support?: number;
  resistance?: number;
  isDoubleTop?: boolean;
  isDoubleBottom?: boolean;
  isHigherHigh?: boolean;
  isLowerLow?: boolean;
  trendSlope?: number;
  fib236?: number;
  fib382?: number;
  fib500?: number;
  fib618?: number;
  fib786?: number;
  fib0?: number;
  fib100?: number;
  candleRange?: [number, number];
  candleBody?: [number, number];
  volumeDelta?: number;
  volumeAvg?: number;
  stochasticK?: number;
  stochasticD?: number;
  adx?: number;
  plusDI?: number;
  minusDI?: number;
  mfi?: number;
  obv?: number;
  isAbsorption?: boolean;
  isHammer?: boolean;
  isShootingStar?: boolean;
  isBullishEngulfing?: boolean;
  isBearishEngulfing?: boolean;
  isDoji?: boolean;
  isMorningStar?: boolean;
  isEveningStar?: boolean;
  isPiercingLine?: boolean;
  isDarkCloudCover?: boolean;
  isTweezerTop?: boolean;
  isTweezerBottom?: boolean;
  predictedPrice?: number;
  predictionConfidence?: number;
}

export function calculateIndicators(data: StockData[]): IndicatorResult[] {
  if (!data || data.length === 0) return [];
  const results: IndicatorResult[] = data.map(d => ({ ...d }));

  // Need at least some data for indicators
  if (results.length < 2) return results;

  // SMA
  calculateSMA(results, 10, "sma10");
  calculateSMA(results, 50, "sma50");
  calculateSMA(results, 200, "sma200");

  // EMA
  calculateEMA(results, 9, "ema9");
  calculateEMA(results, 10, "ema10");
  calculateEMA(results, 21, "ema21");
  calculateEMA(results, 50, "ema50");

  // RSI
  calculateRSI(results, 14);

  // MACD
  calculateMACD(results, 12, 26, 9);

  // Bollinger Bands
  calculateBB(results, 20, 2);

  // ATR
  calculateATR(results, 14);

  // Stochastic Oscillator
  calculateStochastic(results, 14, 3);

  // ADX
  calculateADX(results, 14);

  // MFI
  calculateMFI(results, 14);

  // OBV
  calculateOBV(results);

  // Accumulation/Distribution Line
  calculateADLine(results);

  // Support & Resistance
  calculateSR(results, 20);

  // Fibonacci Retracement
  calculateFibonacci(results);

  // Double Top/Bottom Detection
  detectDoublePatterns(results, 20);

  // Price Structure (Higher High / Lower Low)
  detectPriceStructure(results, 10);

  // Trend Lines
  calculateTrendLines(results, 20);

  // Candlestick Patterns
  detectCandlestickPatterns(results);

  // AI Prediction
  calculateAIPrediction(results);

  // Volatility & Returns
  for (let i = 1; i < results.length; i++) {
    results[i].dailyReturn = (results[i].close - results[i-1].close) / results[i-1].close;
    results[i].volumeChange = (results[i].volume - results[i-1].volume) / results[i-1].volume;
  }

  // Rolling Volatility (20 days)
  for (let i = 20; i < results.length; i++) {
    const slice = results.slice(i - 20, i).map(r => r.dailyReturn || 0);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    results[i].volatility = Math.sqrt(variance);
  }

  // Calculate Volume Delta and Absorption
  const volPeriod = 20;
  for (let i = 0; i < results.length; i++) {
    const d = results[i];
    const range = d.high - d.low;
    const body = Math.abs(d.close - d.open);
    
    // Candle data for Recharts
    d.candleRange = [d.low, d.high];
    d.candleBody = [d.open, d.close];
    
    // Volume Delta Proxy: (Close - Open) / (High - Low) * Volume
    d.volumeDelta = range === 0 ? 0 : d.volume * ((d.close - d.open) / range);
    
    // Average Volume
    if (i >= volPeriod) {
      const slice = results.slice(i - volPeriod, i);
      d.volumeAvg = slice.reduce((a, b) => a + b.volume, 0) / volPeriod;
      
      // Absorption Pattern: High volume (1.8x avg) but small price movement (body < 25% of range)
      if (d.volume > d.volumeAvg * 1.8 && body < range * 0.25) {
        d.isAbsorption = true;
      }
    }
  }

  return results;
}

function calculateSMA(data: IndicatorResult[], period: number, key: keyof IndicatorResult) {
  if (data.length < period) return;
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0);
    (data[i] as any)[key] = sum / period;
  }
}

function calculateEMA(data: IndicatorResult[], period: number, key: keyof IndicatorResult) {
  const k = 2 / (period + 1);
  let ema = data[0].close;
  (data[0] as any)[key] = ema;

  for (let i = 1; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    (data[i] as any)[key] = ema;
  }
}

function calculateRSI(data: IndicatorResult[], period: number) {
  if (data.length <= period) return;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgGain / avgLoss;
    data[i].rsi = 100 - (100 / (1 + rs));
  }
}

function calculateMACD(data: IndicatorResult[], fast: number, slow: number, signal: number) {
  const fastEMA: number[] = [];
  const slowEMA: number[] = [];
  const macdLine: number[] = [];

  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);
  const kSignal = 2 / (signal + 1);

  let fEma = data[0].close;
  let sEma = data[0].close;

  for (let i = 0; i < data.length; i++) {
    fEma = data[i].close * kFast + fEma * (1 - kFast);
    sEma = data[i].close * kSlow + sEma * (1 - kSlow);
    fastEMA.push(fEma);
    slowEMA.push(sEma);
    macdLine.push(fEma - sEma);
    data[i].macd = fEma - sEma;
  }

  let signalEma = macdLine[0];
  for (let i = 0; i < data.length; i++) {
    signalEma = macdLine[i] * kSignal + signalEma * (1 - kSignal);
    data[i].macdSignal = signalEma;
    data[i].macdHist = (data[i].macd || 0) - signalEma;
  }
}

function calculateBB(data: IndicatorResult[], period: number, stdDev: number) {
  if (data.length < period) return;
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1).map(d => d.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);

    data[i].bbMiddle = mean;
    data[i].bbUpper = mean + stdDev * sd;
    data[i].bbLower = mean - stdDev * sd;
    data[i].bbRange = [data[i].bbLower!, data[i].bbUpper!];
  }
}

function calculateATR(data: IndicatorResult[], period: number) {
  if (data.length < period) return;
  
  const trs: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const prev = i > 0 ? data[i - 1] : null;
    
    if (!prev) {
      trs.push(d.high - d.low);
      continue;
    }
    
    const tr = Math.max(
      d.high - d.low,
      Math.abs(d.high - prev.close),
      Math.abs(d.low - prev.close)
    );
    trs.push(tr);
  }
  
  // Initial ATR
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  data[period - 1].atr = atr;
  
  // Subsequent ATR using Wilder's smoothing
  for (let i = period; i < data.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    data[i].atr = atr;
  }
}

function calculateStochastic(data: IndicatorResult[], period: number, smoothK: number) {
  if (data.length < period) return;
  
  const kValues: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(d => d.high));
    const low = Math.min(...slice.map(d => d.low));
    const currentClose = data[i].close;
    
    const k = high === low ? 50 : ((currentClose - low) / (high - low)) * 100;
    kValues.push(k);
    data[i].stochasticK = k;
  }
  
  // Smooth K to get D
  for (let i = period + smoothK - 2; i < data.length; i++) {
    const kSlice = data.slice(i - smoothK + 1, i + 1).map(d => d.stochasticK || 50);
    data[i].stochasticD = kSlice.reduce((a, b) => a + b, 0) / smoothK;
  }
}

function calculateADX(data: IndicatorResult[], period: number) {
  if (data.length < period * 2) return;
  
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trs: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const d = data[i];
    const prev = data[i - 1];
    
    const upMove = d.high - prev.high;
    const downMove = prev.low - d.low;
    
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    
    trs.push(Math.max(
      d.high - d.low,
      Math.abs(d.high - prev.close),
      Math.abs(d.low - prev.close)
    ));
  }
  
  // Smoothed DM and TR
  let smoothPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  
  const dxValues: number[] = [];
  
  for (let i = period; i < data.length; i++) {
    const idx = i - 1;
    smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDM[idx];
    smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDM[idx];
    smoothTR = smoothTR - (smoothTR / period) + trs[idx];
    
    const plusDI = (smoothPlusDM / smoothTR) * 100;
    const minusDI = (smoothMinusDM / smoothTR) * 100;
    
    data[i].plusDI = plusDI;
    data[i].minusDI = minusDI;
    
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    dxValues.push(dx);
  }
  
  // ADX is SMA of DX
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  data[period * 2 - 1].adx = adx;
  
  for (let i = period * 2; i < data.length; i++) {
    adx = (adx * (period - 1) + dxValues[i - period]) / period;
    data[i].adx = adx;
  }
}

function calculateMFI(data: IndicatorResult[], period: number) {
  if (data.length < period) return;
  
  for (let i = period; i < data.length; i++) {
    const slice = data.slice(i - period, i + 1);
    let posFlow = 0;
    let negFlow = 0;
    
    for (let j = 1; j < slice.length; j++) {
      const tp = (slice[j].high + slice[j].low + slice[j].close) / 3;
      const prevTp = (slice[j-1].high + slice[j-1].low + slice[j-1].close) / 3;
      const flow = tp * slice[j].volume;
      
      if (tp > prevTp) posFlow += flow;
      else if (tp < prevTp) negFlow += flow;
    }
    
    const mfr = negFlow === 0 ? 100 : posFlow / negFlow;
    data[i].mfi = 100 - (100 / (1 + mfr));
  }
}

function calculateOBV(data: IndicatorResult[]) {
  let obv = 0;
  data[0].obv = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) {
      obv += data[i].volume;
    } else if (data[i].close < data[i - 1].close) {
      obv -= data[i].volume;
    }
    data[i].obv = obv;
  }
}

function calculateADLine(data: IndicatorResult[]) {
  let adLine = 0;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const moneyFlowMultiplier = d.high !== d.low ? ((d.close - d.low) - (d.high - d.close)) / (d.high - d.low) : 0;
    const moneyFlowVolume = moneyFlowMultiplier * d.volume;
    adLine += moneyFlowVolume;
    d.adLine = adLine;
  }

  // Calculate SMA of A/D Line (20 periods)
  const period = 20;
  if (data.length < period) return;
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + (b.adLine || 0), 0);
    data[i].adLineSMA = sum / period;
  }
}

function calculateSR(data: IndicatorResult[], period: number) {
  if (data.length < period) return;
  for (let i = period; i < data.length; i++) {
    const slice = data.slice(i - period, i);
    const highs = slice.map(d => d.high);
    const lows = slice.map(d => d.low);
    data[i].resistance = Math.max(...highs);
    data[i].support = Math.min(...lows);
  }
}

function calculateFibonacci(data: IndicatorResult[]) {
  if (data.length < 2) return;
  const high = Math.max(...data.map(d => d.high));
  const low = Math.min(...data.map(d => d.low));
  const diff = high - low;

  for (let i = 0; i < data.length; i++) {
    data[i].fib0 = high;
    data[i].fib236 = high - (diff * 0.236);
    data[i].fib382 = high - (diff * 0.382);
    data[i].fib500 = high - (diff * 0.5);
    data[i].fib618 = high - (diff * 0.618);
    data[i].fib786 = high - (diff * 0.786);
    data[i].fib100 = low;
  }
}

function detectDoublePatterns(data: IndicatorResult[], period: number) {
  if (data.length < period * 2) return;
  for (let i = period * 2; i < data.length; i++) {
    const slice = data.slice(i - period * 2, i);
    
    // Simple Double Top detection
    // Look for two peaks with a trough in between
    const mid = Math.floor(slice.length / 2);
    const leftSide = slice.slice(0, mid);
    const rightSide = slice.slice(mid);
    
    const leftPeak = Math.max(...leftSide.map(d => d.high));
    const rightPeak = Math.max(...rightSide.map(d => d.high));
    const trough = Math.min(...slice.map(d => d.low));
    
    // Peaks should be close to each other
    const peakDiff = Math.abs(leftPeak - rightPeak) / leftPeak;
    if (peakDiff < 0.02 && leftPeak > trough * 1.05 && rightPeak > trough * 1.05) {
      data[i].isDoubleTop = true;
    }

    // Simple Double Bottom detection
    const leftTrough = Math.min(...leftSide.map(d => d.low));
    const rightTrough = Math.min(...rightSide.map(d => d.low));
    const peak = Math.max(...slice.map(d => d.high));
    
    const troughDiff = Math.abs(leftTrough - rightTrough) / leftTrough;
    if (troughDiff < 0.02 && leftTrough < peak * 0.95 && rightTrough < peak * 0.95) {
      data[i].isDoubleBottom = true;
    }
  }
}

function detectPriceStructure(data: IndicatorResult[], period: number) {
  if (data.length < period * 2) return;
  for (let i = period; i < data.length; i++) {
    const currentHigh = data[i].high;
    const currentLow = data[i].low;
    
    // Look back to find previous peaks/troughs
    const prevSlice = data.slice(i - period, i);
    const prevHigh = Math.max(...prevSlice.map(d => d.high));
    const prevLow = Math.min(...prevSlice.map(d => d.low));
    
    if (currentHigh > prevHigh) {
      data[i].isHigherHigh = true;
    }
    if (currentLow < prevLow) {
      data[i].isLowerLow = true;
    }
  }
}

function calculateTrendLines(data: IndicatorResult[], period: number) {
  if (data.length < period) return;
  for (let i = period; i < data.length; i++) {
    const slice = data.slice(i - period, i);
    const n = slice.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let j = 0; j < n; j++) {
      sumX += j;
      sumY += slice[j].close;
      sumXY += j * slice[j].close;
      sumXX += j * j;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    data[i].trendSlope = slope;
  }
}

function detectCandlestickPatterns(data: IndicatorResult[]) {
  for (let i = 1; i < data.length; i++) {
    const d = data[i];
    const prev = data[i - 1];
    
    const body = Math.abs(d.close - d.open);
    const range = d.high - d.low;
    const upperShadow = d.high - Math.max(d.open, d.close);
    const lowerShadow = Math.min(d.open, d.close) - d.low;
    
    // Doji: Body is very small compared to range
    if (range > 0 && body <= range * 0.1) {
      d.isDoji = true;
    }
    
    // Hammer: Small body, long lower shadow, little/no upper shadow
    // Usually occurs after a downtrend
    if (range > 0 && lowerShadow >= body * 2 && upperShadow <= body * 0.5) {
      d.isHammer = true;
    }
    
    // Shooting Star: Small body, long upper shadow, little/no lower shadow
    // Usually occurs after an uptrend
    if (range > 0 && upperShadow >= body * 2 && lowerShadow <= body * 0.5) {
      d.isShootingStar = true;
    }
    
    // Bullish Engulfing: Current green body completely engulfs previous red body
    if (d.close > d.open && prev.open > prev.close && 
        d.close > prev.open && d.open < prev.close) {
      d.isBullishEngulfing = true;
    }
    
    // Bearish Engulfing: Current red body completely engulfs previous green body
    if (d.open > d.close && prev.close > prev.open && 
        d.open > prev.close && d.close < prev.open) {
      d.isBearishEngulfing = true;
    }

    // Morning Star: 3-candle bullish reversal (Red, Small, Green)
    if (i >= 2) {
      const p2 = data[i - 2];
      const p1 = data[i - 1];
      const curr = data[i];
      const p2Body = Math.abs(p2.close - p2.open);
      const p1Body = Math.abs(p1.close - p1.open);
      const currBody = Math.abs(curr.close - curr.open);
      
      if (p2.close < p2.open && // P2 is red
          p1Body < p2Body * 0.3 && // P1 is small
          curr.close > curr.open && // Curr is green
          curr.close > p2.open + (p2.open - p2.close) / 2) { // Curr closes above midpoint of P2
        d.isMorningStar = true;
      }
      
      // Evening Star: 3-candle bearish reversal (Green, Small, Red)
      if (p2.close > p2.open && // P2 is green
          p1Body < p2Body * 0.3 && // P1 is small
          curr.close < curr.open && // Curr is red
          curr.close < p2.close - (p2.close - p2.open) / 2) { // Curr closes below midpoint of P2
        d.isEveningStar = true;
      }
    }

    // Piercing Line: 2-candle bullish reversal
    if (prev.close < prev.open && d.close > d.open &&
        d.open < prev.close && d.close > prev.close + (prev.open - prev.close) / 2) {
      d.isPiercingLine = true;
    }

    // Dark Cloud Cover: 2-candle bearish reversal
    if (prev.close > prev.open && d.close < d.open &&
        d.open > prev.close && d.close < prev.close - (prev.close - prev.open) / 2) {
      d.isDarkCloudCover = true;
    }

    // Tweezer Top: 2 candles with matching highs
    if (Math.abs(d.high - prev.high) / d.high < 0.001 && d.high > d.close * 1.01) {
      d.isTweezerTop = true;
    }

    // Tweezer Bottom: 2 candles with matching lows
    if (Math.abs(d.low - prev.low) / d.low < 0.001 && d.low < d.close * 0.99) {
      d.isTweezerBottom = true;
    }
  }
}

function calculateAIPrediction(data: IndicatorResult[]) {
  const period = 10;
  if (data.length < period) return;

  for (let i = period; i < data.length; i++) {
    const d = data[i];
    const prev = data[i - 1];
    
    // Simple prediction logic: 
    // 1. Use trend slope to project forward
    // 2. Adjust based on RSI (mean reversion)
    // 3. Adjust based on Volatility
    
    const slope = d.trendSlope || 0;
    const rsi = d.rsi || 50;
    const volatility = d.volatility || 0.01;
    
    // Base projection: current close + slope * 3 (predicting 3 periods ahead)
    let predicted = d.close + (slope * 3);
    
    // RSI Adjustment: if RSI > 70, expect downward pressure; if < 30, upward
    if (rsi > 70) predicted *= 0.98;
    else if (rsi < 30) predicted *= 1.02;
    
    // Add some "AI" randomness based on volatility
    const noise = (Math.random() - 0.5) * volatility * d.close;
    predicted += noise;
    
    data[i].predictedPrice = predicted;
    
    // Confidence: higher if volatility is low and trend is strong
    const confidence = Math.max(0, Math.min(100, 80 - (volatility * 1000) + (Math.abs(slope) / d.close * 1000)));
    data[i].predictionConfidence = confidence;
  }
}
