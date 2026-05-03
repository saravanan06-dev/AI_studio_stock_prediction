import { GoogleGenAI } from "@google/genai";
import { IndicatorResult } from "../utils/indicators";

const getAI = () => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

// Cache for predictions to keep them stable for the day
const predictionCache: Record<string, { date: string, result: any }> = {};

async function callWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      let errorStr = "";
      try {
        errorStr = JSON.stringify(error);
      } catch (e) {
        errorStr = String(error);
      }
      const isRateLimit = error?.message?.includes('429') || 
                         error?.status === 'RESOURCE_EXHAUSTED' ||
                         errorStr.includes('429') ||
                         errorStr.includes('RESOURCE_EXHAUSTED') ||
                         error?.code === 429;
      
      if (isRateLimit && i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.warn(`Rate limit hit, retrying in ${waitTime.toFixed(0)}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function parseAIJSON(text: string) {
  try {
    // Try direct parse first after trimming
    const trimmed = text.trim();
    return JSON.parse(trimmed);
  } catch (e) {
    // If it fails, try to extract JSON block using regex
    // This regex looks for the outermost {} or []
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');

    let jsonStr = '';
    if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      jsonStr = text.substring(firstBrace, lastBrace + 1);
    } else if (firstBracket !== -1 && lastBracket !== -1) {
      jsonStr = text.substring(firstBracket, lastBracket + 1);
    }

    if (jsonStr) {
      try {
        // Remove common markdown artifacts within the block (unlikely but safe)
        const cleaned = jsonStr.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(cleaned);
      } catch (innerError) {
        console.error("Failed to parse extracted JSON block:", innerError);
      }
    }
    
    console.error("Original text that failed parsing:", text);
    throw e;
  }
}

export async function getStockPrediction(symbol: string, data: IndicatorResult[]) {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `${symbol}_${today}`;
  
  // Check memory cache first
  if (predictionCache[cacheKey]) {
    return predictionCache[cacheKey].result;
  }

  // Check localStorage for persistence across refreshes
  try {
    const stored = localStorage.getItem(`prediction_${symbol}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) {
        predictionCache[cacheKey] = parsed;
        return parsed.result;
      }
    }
  } catch (e) {
    console.warn("LocalStorage access failed", e);
  }

  const ai = getAI();
  if (!data || data.length < 2) {
    return {
      prediction: "NEUTRAL",
      signal: "HOLD",
      confidence: 0,
      reasoning: "Insufficient data for AI analysis.",
      targetPrice: data?.[0]?.close || 0
    };
  }
  const latest = data[data.length - 1];
  const history = data.slice(-30); // Increased to 30 days for better trend context
  
  const historyString = history.map(d => 
    `Date: ${new Date(d.date).toLocaleDateString()}, Close: ₹${d.close?.toFixed(2) || '0.00'}, RSI: ${d.rsi?.toFixed(2)}, MACD: ${d.macd?.toFixed(2)}, SMA10/50: ${d.sma10?.toFixed(2)}/${d.sma50?.toFixed(2)}, ADX: ${d.adx?.toFixed(2)}, StochK: ${d.stochasticK?.toFixed(2)}, MFI: ${d.mfi?.toFixed(2)}, OBV: ${d.obv?.toLocaleString()}, Volatility: ${((d.volatility || 0) * 100).toFixed(2)}%, Volume: ${d.volume?.toLocaleString()}, AvgVol: ${d.volumeAvg?.toLocaleString()}`
  ).join('\n');

  const prompt = `
    You are an expert financial analyst and technical trader. Your task is to provide a highly accurate 5-day price prediction for ${symbol}.
    
    CRITICAL: Avoid "bullish bias". Markets can and do go down. Analyze both bullish and bearish signals with equal weight.
    
    MARKET CONTEXT:
    - Currency: Indian Rupees (INR)
    - Current Date: ${today}
    
    TECHNICAL DATA (Last 30 Days):
    ${historyString}
    
    LATEST TECHNICAL INDICATORS:
    - Current Price: ₹${latest.close}
    - SMA10 vs SMA50: ${latest.sma10?.toFixed(2)} / ${latest.sma50?.toFixed(2)} (${(latest.sma10 || 0) > (latest.sma50 || 0) ? 'Bullish Cross' : 'Bearish Cross'})
    - RSI (14): ${latest.rsi?.toFixed(2)} (${(latest.rsi || 50) > 70 ? 'Overbought (Bearish Signal)' : (latest.rsi || 50) < 30 ? 'Oversold (Bullish Signal)' : 'Neutral'})
    - MACD: ${latest.macd?.toFixed(2)} (Signal: ${latest.macdSignal?.toFixed(2)}, Hist: ${latest.macdHist?.toFixed(2)})
    - ADX (Trend Strength): ${latest.adx?.toFixed(2)} (${(latest.adx || 0) > 25 ? 'Strong Trend' : 'Weak Trend'})
    - Stochastic Oscillator: K=${latest.stochasticK?.toFixed(2)}, D=${latest.stochasticD?.toFixed(2)}
    - Money Flow Index (MFI): ${latest.mfi?.toFixed(2)}
    - On-Balance Volume (OBV): ${latest.obv?.toLocaleString()}
    - Bollinger Bands: Upper ₹${latest.bbUpper?.toFixed(2)}, Middle ₹${latest.bbMiddle?.toFixed(2)}, Lower ₹${latest.bbLower?.toFixed(2)}
    - Support/Resistance: Support ₹${latest.support?.toFixed(2)}, Resistance ₹${latest.resistance?.toFixed(2)}
    - Candlestick Patterns: ${latest.isHammer ? 'Hammer (Bullish Reversal)' : latest.isShootingStar ? 'Shooting Star (Bearish Reversal)' : latest.isBullishEngulfing ? 'Bullish Engulfing (Strong Bullish)' : latest.isBearishEngulfing ? 'Bearish Engulfing (Strong Bearish)' : latest.isDoji ? 'Doji (Indecision)' : 'None detected'}
    - Chart Patterns: ${latest.isDoubleTop ? 'Double Top (Bearish)' : latest.isDoubleBottom ? 'Double Bottom (Bullish)' : 'None detected'}
    - Volume Change: ${latest.volumeChange?.toFixed(2)}%
    - Current Volume: ${latest.volume?.toLocaleString()} (Avg 20d: ${latest.volumeAvg?.toLocaleString()})
    - Volume Ratio: ${(latest.volume / (latest.volumeAvg || 1)).toFixed(2)}x
    - Absorption Pattern: ${latest.isAbsorption ? 'Detected (High volume, small price move - potential reversal/exhaustion)' : 'None'}
    
    ANALYSIS CHECKLIST & WEIGHTING:
    1. VOLUME ANALYSIS (20%): Analyze volume spikes, breakouts, and spikes at support/resistance. High volume breakouts confirm trends; volume spikes at support/resistance often signal reversals.
    2. CANDLESTICK PATTERNS (25%): Analyze Hammer, Shooting Star, Engulfing, etc.
    3. RSI (20%): Analyze oversold (<30) or overbought (>70) conditions.
    4. MACD (20%): Analyze crossovers and histogram momentum.
    5. MOVING AVERAGES (15%): Analyze price relative to SMA10/SMA50.
    
    COMBINED REASONING FORMAT:
    Your "reasoning" field MUST start with a concise summary in this format: "Indicator A + Indicator B + Volume Signal = Prediction Outcome".
    Example: "Bullish Engulfing + RSI Oversold + High Volume Breakout = High Confidence Uptrend"
    Follow this with a brief balanced justification including both a Bullish and Bearish case. Ensure you explicitly mention the volume analysis in your reasoning.
    
    Provide your response in JSON format:
    {
      "prediction": "UP" | "DOWN" | "NEUTRAL",
      "signal": "BUY" | "SELL" | "HOLD",
      "confidence": number (0-100),
      "reasoning": "The combined reasoning summary followed by a balanced technical justification (max 4 sentences total).",
      "patterns": ["Hammer", "Bullish Engulfing", etc. (list detected patterns)],
      "detailedReasoning": [
        { "indicator": "Volume", "observation": "string", "impact": "BULLISH" | "BEARISH" | "NEUTRAL", "weight": 20 },
        { "indicator": "Candlestick", "observation": "string", "impact": "BULLISH" | "BEARISH" | "NEUTRAL", "weight": 25 },
        { "indicator": "RSI", "observation": "string", "impact": "BULLISH" | "BEARISH" | "NEUTRAL", "weight": 20 },
        { "indicator": "MACD", "observation": "string", "impact": "BULLISH" | "BEARISH" | "NEUTRAL", "weight": 20 },
        { "indicator": "Moving Average", "observation": "string", "impact": "BULLISH" | "BEARISH" | "NEUTRAL", "weight": 15 }
      ],
      "targetPrice": number (expected price for the next trading session),
      "sentiment": {
        "score": number (-1 to 1),
        "label": "BULLISH" | "BEARISH" | "NEUTRAL",
        "summary": "Brief summary of news and social sentiment",
        "newsScore": number (0-100),
        "socialScore": number (0-100),
        "technicalScore": number (0-100)
      },
      "forecast": [
        { "date": "YYYY-MM-DD", "targetPrice": number },
        ... (total 5 days including tomorrow)
      ]
    }
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview", // Upgraded to Pro for better reasoning
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }] as any
      }
    }));

    const result = parseAIJSON(response.text || "{}");
    
    // Fallback logic for signal if model doesn't provide it
    if (!result.signal) {
      if (result.confidence > 70) {
        if (result.prediction === 'UP') result.signal = 'BUY';
        else if (result.prediction === 'DOWN') result.signal = 'SELL';
        else result.signal = 'HOLD';
      } else {
        result.signal = 'HOLD';
      }
    }
    
    // Save to cache
    const today = new Date().toISOString().split('T')[0];
    const cacheEntry = { date: today, result };
    predictionCache[`${symbol}_${today}`] = cacheEntry;
    try {
      localStorage.setItem(`prediction_${symbol}`, JSON.stringify(cacheEntry));
    } catch (e) {
      console.warn("LocalStorage save failed", e);
    }
    
    return result;
  } catch (error: any) {
    console.error("Gemini Prediction Error:", error);
    
    // Check for rate limit error
    let errorStr = "";
    try {
      errorStr = JSON.stringify(error);
    } catch (e) {
      errorStr = String(error);
    }
    const isRateLimit = error?.message?.includes('429') || 
                       error?.status === 'RESOURCE_EXHAUSTED' ||
                       errorStr.includes('429') ||
                       errorStr.includes('RESOURCE_EXHAUSTED') ||
                       error?.code === 429;

    return {
      prediction: "NEUTRAL",
      signal: "HOLD",
      confidence: 0,
      reasoning: isRateLimit 
        ? "AI Rate limit reached. Please wait a moment or try again later." 
        : "Failed to generate prediction.",
      targetPrice: latest.close,
      isError: true,
      errorType: isRateLimit ? 'RATE_LIMIT' : 'GENERAL'
    };
  }
}

export async function chatWithAI(message: string, context?: string) {
  const ai = getAI();
  const systemInstruction = `
    You are a professional stock market assistant. 
    
    TASK:
    When a user asks about a company, provide a comprehensive analysis.
    If the user asks for a "prediction value" or "market ending" value, refer to the "AI Target Price" in the provided context.
    1. LATEST NEWS: Fetch and summarize the most recent daily news.
    2. GROWTH ANALYSIS: Analyze the company's recent growth and financial health.
    3. SENTIMENT ANALYSIS: Gauge the current market sentiment (Bullish/Bearish/Neutral).
    4. CHART ANALYSIS: Describe the current technical chart patterns.
    5. RECOMMENDATION: Give a clear "BUY", "SELL", or "HOLD" recommendation.
    6. REASONING: Explain clearly WHY you made that recommendation.
    
    RULES:
    1. DO NOT use long paragraphs. Keep explanations short and punchy.
    2. USE bullet points, bold text, and clear headings.
    3. Be accurate and helpful.
    4. Use Google Search to get real-time information.
    
    Context: ${context || "General market query"}
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: message,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      }
    }));

    let text = response.text || "I've processed your request.";
    let sources: { title: string; uri: string }[] = [];

    // Extract grounding sources
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      sources = chunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title,
          uri: chunk.web.uri
        }));
    }

    // Append sources to text if available
    if (sources.length > 0) {
      const uniqueSources = Array.from(new Set(sources.map(s => s.uri)))
        .map(uri => sources.find(s => s.uri === uri)!);
      
      text += "\n\n**Sources:**\n" + uniqueSources.map(s => `- [${s.title}](${s.uri})`).join("\n");
    }

    return { text, imageUrl: "" };
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    let errorStr = "";
    try {
      errorStr = JSON.stringify(error);
    } catch (e) {
      errorStr = String(error);
    }
    const isRateLimit = error?.message?.includes('429') || 
                       error?.status === 'RESOURCE_EXHAUSTED' ||
                       errorStr.includes('429') ||
                       errorStr.includes('RESOURCE_EXHAUSTED') ||
                       error?.code === 429;

    if (isRateLimit) {
      return { 
        text: "I've reached my daily limit for real-time analysis. Please try again in a few minutes or ask a general question.", 
        imageUrl: "",
        isRateLimit: true
      };
    }
    return { text: "I'm having trouble fetching real-time data right now. Please try again later.", imageUrl: "", isRateLimit: false };
  }
}

export async function getNewsForSymbol(symbol: string) {
  const ai = getAI();
  const prompt = `
    Find the 5 most recent and relevant news articles for the stock symbol ${symbol}.
    For each article, provide:
    1. Headline
    2. A brief snippet or summary (1-2 sentences)
    3. The source name
    4. The publication date (relative or absolute)
    5. A direct URL to the article
    
    Return the data in JSON format:
    {
      "articles": [
        {
          "headline": "string",
          "snippet": "string",
          "source": "string",
          "date": "string",
          "url": "string"
        }
      ]
    }
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }] as any
      }
    }));

    return parseAIJSON(response.text || "{\"articles\": []}");
  } catch (error) {
    console.error("News Fetch Error:", error);
    return { articles: [] };
  }
}
