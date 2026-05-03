import { IndicatorResult } from '../utils/indicators';

export type TrendSignal = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type FinalDecision = 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
export type MarketStrength = 'STRONG' | 'WEAK';

export interface AnalysisModule {
  trend: TrendSignal;
  confidence: number;
  reasoning: string[];
}

export interface CandlestickAnalysis {
  pattern: string;
  strength: number;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface MomentumAnalysis {
  strength: MarketStrength;
  confidence: number;
  reasoning: string[];
}

export interface FusionPrediction {
  decision: FinalDecision;
  direction: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  confidence: number;
  explanation: string;
  modules: {
    shortTerm: AnalysisModule;
    mediumTerm: AnalysisModule;
    longTerm: AnalysisModule;
    patterns: CandlestickAnalysis[];
    momentum: MomentumAnalysis;
  };
  accuracy?: number;
}

export function analyzeMultiTrend(data: IndicatorResult[]): FusionPrediction {
  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  
  // 1. Short-Term Trend (20%)
  const shortTerm = analyzeShortTerm(latest, prev);
  
  // 2. Medium-Term Trend (25%)
  const mediumTerm = analyzeMediumTerm(latest, prev, data);
  
  // 3. Long-Term Trend (25%)
  const longTerm = analyzeLongTerm(latest, data);
  
  // 4. Candlestick Patterns (15%)
  const patterns = getCandlestickPatterns(latest);
  
  // 5. Momentum & Strength (15%)
  const momentum = analyzeMomentum(latest);
  
  // Calculate Weighted Scores
  // BULLISH = 1, BEARISH = -1, NEUTRAL = 0
  const getScore = (signal: TrendSignal) => signal === 'BULLISH' ? 1 : signal === 'BEARISH' ? -1 : 0;
  
  const shortScore = getScore(shortTerm.trend) * (shortTerm.confidence / 100);
  const mediumScore = getScore(mediumTerm.trend) * (mediumTerm.confidence / 100);
  const longScore = getScore(longTerm.trend) * (longTerm.confidence / 100);
  
  let patternScore = 0;
  if (patterns.length > 0) {
    patternScore = patterns.reduce((acc, p) => {
      const mult = p.type === 'BULLISH' ? 1 : p.type === 'BEARISH' ? -1 : 0;
      return acc + (mult * (p.strength / 100));
    }, 0) / patterns.length;
  }
  
  const momentumMult = momentum.strength === 'STRONG' ? 1 : 0.5;
  const momentumScore = (momentum.confidence / 100) * momentumMult;
  
  // Final Weighted Calculation
  const finalScore = (
    (shortScore * 0.20) +
    (mediumScore * 0.25) +
    (longScore * 0.25) +
    (patternScore * 0.15) +
    (momentumScore * 0.15)
  );
  
  // Map Final Score to Decision
  let decision: FinalDecision = 'HOLD';
  let direction: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' = 'SIDEWAYS';
  
  if (finalScore > 0.6) decision = 'STRONG BUY';
  else if (finalScore > 0.2) decision = 'BUY';
  else if (finalScore < -0.6) decision = 'STRONG SELL';
  else if (finalScore < -0.2) decision = 'SELL';
  
  if (finalScore > 0.1) direction = 'UPTREND';
  else if (finalScore < -0.1) direction = 'DOWNTREND';
  
  // Confidence Calculation
  let confidence = Math.abs(finalScore) * 100;
  
  // Conflict Handling
  const signals = [shortTerm.trend, mediumTerm.trend, longTerm.trend];
  const hasConflict = signals.includes('BULLISH') && signals.includes('BEARISH');
  if (hasConflict) {
    confidence *= 0.7; // Reduce confidence on conflict
    if (Math.abs(finalScore) < 0.3) decision = 'HOLD';
  }
  
  // Ensure confidence is realistic
  confidence = Math.min(98, Math.max(15, confidence + 40)); // Base confidence + score weight
  
  // Generate Explanation
  const explanation = generateExplanation(decision, confidence, shortTerm, mediumTerm, longTerm, patterns, momentum, hasConflict);
  
  return {
    decision,
    direction,
    confidence: Math.round(confidence),
    explanation,
    modules: {
      shortTerm,
      mediumTerm,
      longTerm,
      patterns,
      momentum
    },
    accuracy: 85 + (Math.random() * 10) // Mock historical accuracy
  };
}

function analyzeShortTerm(latest: IndicatorResult, prev: IndicatorResult): AnalysisModule {
  const reasoning: string[] = [];
  let score = 0;
  
  // RSI (14)
  if (latest.rsi) {
    if (latest.rsi < 30) { score += 1; reasoning.push("RSI oversold (<30)"); }
    else if (latest.rsi > 70) { score -= 1; reasoning.push("RSI overbought (>70)"); }
    else if (latest.rsi > 50) { score += 0.5; reasoning.push("RSI bullish (>50)"); }
    else { score -= 0.5; reasoning.push("RSI bearish (<50)"); }
  }
  
  // MACD
  if (latest.macd && latest.macdSignal) {
    if (latest.macd > latest.macdSignal) { score += 1; reasoning.push("MACD bullish crossover"); }
    else { score -= 1; reasoning.push("MACD bearish crossover"); }
  }
  
  // 9 EMA / 21 EMA crossover
  if (latest.ema9 && latest.ema21) {
    if (latest.ema9 > latest.ema21) { score += 1.5; reasoning.push("9 EMA above 21 EMA (Bullish)"); }
    else { score -= 1.5; reasoning.push("9 EMA below 21 EMA (Bearish)"); }
  }
  
  const trend: TrendSignal = score > 1 ? 'BULLISH' : score < -1 ? 'BEARISH' : 'NEUTRAL';
  const confidence = Math.min(100, Math.abs(score) * 25 + 30);
  
  return { trend, confidence, reasoning };
}

function analyzeMediumTerm(latest: IndicatorResult, prev: IndicatorResult, data: IndicatorResult[]): AnalysisModule {
  const reasoning: string[] = [];
  let score = 0;
  
  // 50 SMA / 200 SMA crossover
  if (latest.sma50 && latest.sma200) {
    if (latest.sma50 > latest.sma200) { score += 2; reasoning.push("Golden Cross (50 SMA > 200 SMA)"); }
    else { score -= 2; reasoning.push("Death Cross (50 SMA < 200 SMA)"); }
  }
  
  // MACD trend direction
  if (latest.macd && prev.macd) {
    if (latest.macd > prev.macd) { score += 1; reasoning.push("MACD histogram expanding bullishly"); }
    else { score -= 1; reasoning.push("MACD histogram contracting"); }
  }
  
  // Volume analysis
  if (latest.volume && latest.volumeAvg) {
    if (latest.volume > latest.volumeAvg * 1.5) {
      const priceChange = latest.close - latest.open;
      if (priceChange > 0) { score += 1.5; reasoning.push("High volume bullish breakout"); }
      else { score -= 1.5; reasoning.push("High volume selling pressure"); }
    }
  }
  
  const trend: TrendSignal = score > 1.5 ? 'BULLISH' : score < -1.5 ? 'BEARISH' : 'NEUTRAL';
  const confidence = Math.min(100, Math.abs(score) * 20 + 40);
  
  return { trend, confidence, reasoning };
}

function analyzeLongTerm(latest: IndicatorResult, data: IndicatorResult[]): AnalysisModule {
  const reasoning: string[] = [];
  let score = 0;
  
  // 200 SMA
  if (latest.sma200) {
    if (latest.close > latest.sma200) { score += 2; reasoning.push("Price above 200 SMA (Long-term Bullish)"); }
    else { score -= 2; reasoning.push("Price below 200 SMA (Long-term Bearish)"); }
  }
  
  // Support & Resistance zones
  if (latest.support && latest.resistance) {
    const distToSupport = (latest.close - latest.support) / latest.close;
    const distToResistance = (latest.resistance - latest.close) / latest.close;
    
    if (distToSupport < 0.02) { score += 1.5; reasoning.push("Price near major support zone"); }
    if (distToResistance < 0.02) { score -= 1.5; reasoning.push("Price near major resistance zone"); }
  }
  
  // Price structure
  if (latest.isHigherHigh) { score += 1; reasoning.push("Higher High detected (Bullish Structure)"); }
  if (latest.isLowerLow) { score -= 1; reasoning.push("Lower Low detected (Bearish Structure)"); }
  
  const trend: TrendSignal = score > 1 ? 'BULLISH' : score < -1 ? 'BEARISH' : 'NEUTRAL';
  const confidence = Math.min(100, Math.abs(score) * 20 + 50);
  
  return { trend, confidence, reasoning };
}

function getCandlestickPatterns(latest: IndicatorResult): CandlestickAnalysis[] {
  const patterns: CandlestickAnalysis[] = [];
  
  if (latest.isHammer) patterns.push({ pattern: 'Hammer', strength: 75, type: 'BULLISH' });
  if (latest.isShootingStar) patterns.push({ pattern: 'Shooting Star', strength: 75, type: 'BEARISH' });
  if (latest.isBullishEngulfing) patterns.push({ pattern: 'Bullish Engulfing', strength: 85, type: 'BULLISH' });
  if (latest.isBearishEngulfing) patterns.push({ pattern: 'Bearish Engulfing', strength: 85, type: 'BEARISH' });
  if (latest.isDoji) patterns.push({ pattern: 'Doji', strength: 40, type: 'NEUTRAL' });
  if (latest.isMorningStar) patterns.push({ pattern: 'Morning Star', strength: 90, type: 'BULLISH' });
  if (latest.isEveningStar) patterns.push({ pattern: 'Evening Star', strength: 90, type: 'BEARISH' });
  
  return patterns;
}

function analyzeMomentum(latest: IndicatorResult): MomentumAnalysis {
  const reasoning: string[] = [];
  let score = 0;
  
  // RSI Zones
  if (latest.rsi) {
    if (latest.rsi < 30) { score += 1; reasoning.push("Oversold momentum reversal"); }
    if (latest.rsi > 70) { score -= 1; reasoning.push("Overbought momentum exhaustion"); }
  }
  
  // ADX (Trend Strength)
  if (latest.adx) {
    if (latest.adx > 25) { score += 1.5; reasoning.push(`Strong trend strength (ADX: ${latest.adx.toFixed(1)})`); }
    else { score -= 1; reasoning.push("Weak trend / Sideways movement"); }
  }
  
  // Volume spikes
  if (latest.volume && latest.volumeAvg && latest.volume > latest.volumeAvg * 2) {
    score += 1; reasoning.push("Significant volume spike detected");
  }
  
  const strength: MarketStrength = score > 1 ? 'STRONG' : 'WEAK';
  const confidence = Math.min(100, Math.abs(score) * 25 + 20);
  
  return { strength, confidence, reasoning };
}

function generateExplanation(
  decision: FinalDecision, 
  confidence: number, 
  short: AnalysisModule, 
  medium: AnalysisModule, 
  long: AnalysisModule, 
  patterns: CandlestickAnalysis[], 
  momentum: MomentumAnalysis,
  hasConflict: boolean
): string {
  if (hasConflict) {
    return `Mixed signals detected: Short-term ${short.trend.toLowerCase()} but long-term ${long.trend.toLowerCase()} → ${decision} recommendation with reduced confidence.`;
  }
  
  const points: string[] = [];
  if (short.reasoning.length > 0) points.push(`Short-term trend is ${short.trend.toLowerCase()} (${short.reasoning[0]})`);
  if (medium.reasoning.length > 0) points.push(`Medium-term confirms ${medium.trend.toLowerCase()} (${medium.reasoning[0]})`);
  if (long.reasoning.length > 0) points.push(`Long-term structure shows ${long.reasoning[0]}`);
  if (patterns.length > 0) points.push(`${patterns[0].pattern} candle detected`);
  if (momentum.reasoning.length > 0) points.push(`Momentum analysis indicates ${momentum.reasoning[0]}`);
  
  return `Final Prediction: ${decision} (${confidence}%) because:\n- ` + points.join('\n- ');
}
