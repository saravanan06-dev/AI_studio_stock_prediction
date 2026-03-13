/**
 * Technical Indicators Utility
 */

export interface StockData {
  date: Date;
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
  ema10?: number;
  ema50?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  bbUpper?: number;
  bbLower?: number;
  bbMiddle?: number;
  volatility?: number;
  dailyReturn?: number;
  volumeChange?: number;
}

export function calculateIndicators(data: StockData[]): IndicatorResult[] {
  const results: IndicatorResult[] = data.map(d => ({ ...d }));

  // SMA
  calculateSMA(results, 10, "sma10");
  calculateSMA(results, 50, "sma50");

  // EMA
  calculateEMA(results, 10, "ema10");
  calculateEMA(results, 50, "ema50");

  // RSI
  calculateRSI(results, 14);

  // MACD
  calculateMACD(results, 12, 26, 9);

  // Bollinger Bands
  calculateBB(results, 20, 2);

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

  return results;
}

function calculateSMA(data: IndicatorResult[], period: number, key: keyof IndicatorResult) {
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
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1).map(d => d.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);

    data[i].bbMiddle = mean;
    data[i].bbUpper = mean + stdDev * sd;
    data[i].bbLower = mean - stdDev * sd;
  }
}
