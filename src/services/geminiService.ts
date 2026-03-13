import { GoogleGenAI } from "@google/genai";
import { IndicatorResult } from "../utils/indicators";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getStockPrediction(symbol: string, data: IndicatorResult[]) {
  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  
  const prompt = `
    Analyze the following technical indicators for stock ${symbol} and predict the next day's price direction (UP or DOWN).
    Note: All price values are in Indian Rupees (INR).
    
    Latest Data:
    - Close: ${latest.close}
    - SMA10: ${latest.sma10}
    - SMA50: ${latest.sma50}
    - RSI: ${latest.rsi}
    - MACD: ${latest.macd}
    - MACD Signal: ${latest.macdSignal}
    - BB Upper: ${latest.bbUpper}
    - BB Lower: ${latest.bbLower}
    - Volume Change: ${latest.volumeChange}%
    - Volatility: ${latest.volatility}
    
    Previous Close: ${previous.close}
    
    Provide your response in JSON format:
    {
      "prediction": "UP" | "DOWN",
      "confidence": number (0-100),
      "reasoning": "string explaining the technical analysis",
      "targetPrice": number (estimated next day target)
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Prediction Error:", error);
    return {
      prediction: "NEUTRAL",
      confidence: 0,
      reasoning: "Failed to generate prediction.",
      targetPrice: latest.close
    };
  }
}
