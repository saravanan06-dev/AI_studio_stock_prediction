import React, { useState, useEffect } from 'react';
import { Bot, Play, Square, Settings2, ShieldAlert, Target, ShieldCheck, Zap, Brain, Activity } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../utils/cn';
import { motion, AnimatePresence } from 'motion/react';

interface BotSettings {
  enabled: boolean;
  symbol: string;
  strategy: 'ai_signal' | 'rsi_oversold' | 'ma_cross';
  stopLoss: number;
  takeProfit: number;
  maxTradesPerDay: number;
  riskPerTrade: number;
}

interface TradeLog {
  id: string;
  date: number;
  type: 'BUY' | 'SELL';
  price: number;
  reason: string;
}

interface TradingBotProps {
  symbol: string;
  currentPrice: number;
  mlPrediction: any;
  technicalData: any[];
  onTrade: (type: 'BUY' | 'SELL', symbol: string, price: number, reason: string) => void;
  isRunning: boolean;
  onToggleStatus: (status: boolean) => void;
}

export const TradingBot: React.FC<TradingBotProps> = ({ 
  symbol, 
  currentPrice, 
  mlPrediction, 
  technicalData,
  onTrade,
  isRunning,
  onToggleStatus
}) => {
  const [settings, setSettings] = useState<BotSettings>({
    enabled: false,
    symbol: symbol,
    strategy: 'ai_signal',
    stopLoss: 2,
    takeProfit: 5,
    maxTradesPerDay: 5,
    riskPerTrade: 1000
  });

  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [lastSignalDate, setLastSignalDate] = useState<number>(0);
  const [activePosition, setActivePosition] = useState<{
    type: 'BUY' | 'SELL';
    entryPrice: number;
    stopLossPrice: number;
    takeProfitPrice: number;
  } | null>(null);

  // Bot Logic Execution
  useEffect(() => {
    if (!isRunning) return;

    const runStrategy = () => {
      if (!technicalData.length) return;
      const latest = technicalData[technicalData.length - 1];
      const prev = technicalData[technicalData.length - 2];
      
      // 1. Check for SL/TP on active position
      if (activePosition) {
        let exitReason = '';
        let shouldExit = false;

        if (activePosition.type === 'BUY') {
          if (currentPrice <= activePosition.stopLossPrice) {
            exitReason = `Stop Loss Hit @ ${currentPrice}`;
            shouldExit = true;
          } else if (currentPrice >= activePosition.takeProfitPrice) {
            exitReason = `Take Profit Hit @ ${currentPrice}`;
            shouldExit = true;
          }
        } else { // SELL position
          if (currentPrice >= activePosition.stopLossPrice) {
            exitReason = `Stop Loss Hit @ ${currentPrice}`;
            shouldExit = true;
          } else if (currentPrice <= activePosition.takeProfitPrice) {
            exitReason = `Take Profit Hit @ ${currentPrice}`;
            shouldExit = true;
          }
        }

        if (shouldExit) {
          const exitType = activePosition.type === 'BUY' ? 'SELL' : 'BUY';
          onTrade(exitType, symbol, currentPrice, exitReason);
          
          const newLog: TradeLog = {
            id: Math.random().toString(36).substr(2, 9),
            date: Date.now(),
            type: exitType,
            price: currentPrice,
            reason: exitReason
          };
          setLogs(prevLogs => [newLog, ...prevLogs].slice(0, 50));
          setActivePosition(null);
          return; // Skip new signals this tick if we just exited
        }
      }

      // 2. Strategy Logic
      let signal: 'BUY' | 'SELL' | null = null;
      let reason = '';

      if (settings.strategy === 'ai_signal' && mlPrediction) {
        if (mlPrediction.prediction === 'UP' && mlPrediction.confidence > 0.75) {
          signal = 'BUY';
          reason = `AI High Confidence Signal (${(mlPrediction.confidence * 100).toFixed(0)}%)`;
        } else if (mlPrediction.prediction === 'DOWN' && mlPrediction.confidence > 0.75) {
          signal = 'SELL';
          reason = `AI High Confidence Bearish Signal (${(mlPrediction.confidence * 100).toFixed(0)}%)`;
        }
      } else if (settings.strategy === 'rsi_oversold') {
        if (latest.rsi < 30) {
          signal = 'BUY';
          reason = `RSI Oversold (${latest.rsi.toFixed(1)})`;
        } else if (latest.rsi > 70) {
          signal = 'SELL';
          reason = `RSI Overbought (${latest.rsi.toFixed(1)})`;
        }
      } else if (settings.strategy === 'ma_cross' && prev) {
        if (latest.sma10 > latest.sma50 && prev.sma10 <= prev.sma50) {
          signal = 'BUY';
          reason = 'SMA Golden Cross (10/50)';
        } else if (latest.sma10 < latest.sma50 && prev.sma10 >= prev.sma50) {
          signal = 'SELL';
          reason = 'SMA Death Cross (10/50)';
        }
      }

      // 3. Execution Logic
      if (signal && latest.date !== lastSignalDate) {
        // If we have an active position of the SAME type, don't double up
        if (activePosition?.type === signal) return;

        // If we have an opposite position, close it first
        if (activePosition && activePosition.type !== signal) {
          onTrade(signal, symbol, currentPrice, `Switching position: ${reason}`);
        } else {
          onTrade(signal, symbol, currentPrice, reason);
        }

        setLastSignalDate(latest.date);
        
        // Update active position with SL/TP
        const slMult = settings.stopLoss / 100;
        const tpMult = settings.takeProfit / 100;
        
        setActivePosition({
          type: signal,
          entryPrice: currentPrice,
          stopLossPrice: signal === 'BUY' ? currentPrice * (1 - slMult) : currentPrice * (1 + slMult),
          takeProfitPrice: signal === 'BUY' ? currentPrice * (1 + tpMult) : currentPrice * (1 - tpMult),
        });

        const newLog: TradeLog = {
          id: Math.random().toString(36).substr(2, 9),
          date: Date.now(),
          type: signal,
          price: currentPrice,
          reason
        };
        setLogs(prevLogs => [newLog, ...prevLogs].slice(0, 50));
      }
    };

    const interval = setInterval(runStrategy, 2000); // Check every 2 seconds for faster response
    return () => clearInterval(interval);
  }, [isRunning, symbol, currentPrice, mlPrediction, technicalData, settings, lastSignalDate, onTrade, activePosition]);

  return (
    <div className="space-y-4">
      <Card className="bg-zinc-900/50 border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xl",
              isRunning ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500"
            )}>
              <Bot className={cn("w-6 h-6", isRunning && "animate-pulse")} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest">AI Trading Bot</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Automated Execution Engine</p>
            </div>
          </div>
          <button
            onClick={() => onToggleStatus(!isRunning)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              isRunning 
                ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20" 
                : "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95"
            )}
          >
            {isRunning ? (
              <><Square className="w-3 h-3 fill-current" /> Stop Bot</>
            ) : (
              <><Play className="w-3 h-3 fill-current" /> Start Bot</>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Strategy</label>
            <select 
              value={settings.strategy}
              onChange={(e) => setSettings({...settings, strategy: e.target.value as any})}
              disabled={isRunning}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
            >
              <option value="ai_signal">AI Logic (Recommended)</option>
              <option value="rsi_oversold">Relative Strength (RSI)</option>
              <option value="ma_cross">Moving Average Cross</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Symbol</label>
            <div className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold">
              {symbol}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-3 h-3 text-rose-500" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">Stop Loss</span>
            </div>
            <div className="flex items-center gap-1">
              <input 
                type="number" 
                value={settings.stopLoss}
                onChange={(e) => setSettings({...settings, stopLoss: Number(e.target.value)})}
                disabled={isRunning}
                className="w-full bg-transparent text-sm font-black text-white focus:outline-none"
              />
              <span className="text-[10px] text-zinc-600 font-bold">%</span>
            </div>
          </div>
          <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-3 h-3 text-emerald-500" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">Take Profit</span>
            </div>
            <div className="flex items-center gap-1">
              <input 
                type="number" 
                value={settings.takeProfit}
                onChange={(e) => setSettings({...settings, takeProfit: Number(e.target.value)})}
                disabled={isRunning}
                className="w-full bg-transparent text-sm font-black text-white focus:outline-none"
              />
              <span className="text-[10px] text-zinc-600 font-bold">%</span>
            </div>
          </div>
          <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">Risk/Trade</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-600 font-bold">₹</span>
              <input 
                type="number" 
                value={settings.riskPerTrade}
                onChange={(e) => setSettings({...settings, riskPerTrade: Number(e.target.value)})}
                disabled={isRunning}
                className="w-full bg-transparent text-sm font-black text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {activePosition && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-3 rounded-2xl border flex items-center justify-between mb-2",
                activePosition.type === 'BUY' 
                  ? "bg-emerald-500/5 border-emerald-500/20" 
                  : "bg-rose-500/5 border-rose-500/20"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest",
                  activePosition.type === 'BUY' ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"
                )}>
                  Active {activePosition.type}
                </div>
                <div>
                  <div className="text-[10px] font-black text-white uppercase tracking-tight">
                    Entry: ₹{activePosition.entryPrice.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-2 text-[8px] font-bold">
                    <span className="text-rose-500 uppercase">SL: ₹{activePosition.stopLossPrice.toFixed(2)}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-emerald-500 uppercase">TP: ₹{activePosition.takeProfitPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className={cn(
                "text-xs font-black",
                currentPrice >= activePosition.entryPrice 
                  ? (activePosition.type === 'BUY' ? "text-emerald-500" : "text-rose-500")
                  : (activePosition.type === 'BUY' ? "text-rose-500" : "text-emerald-500")
              )}>
                {activePosition.type === 'BUY' 
                  ? (currentPrice - activePosition.entryPrice >= 0 ? "+" : "") 
                  : (activePosition.entryPrice - currentPrice >= 0 ? "+" : "")}
                {(((activePosition.type === 'BUY' ? currentPrice : activePosition.entryPrice) / 
                   (activePosition.type === 'BUY' ? activePosition.entryPrice : currentPrice) - 1) * 100).toFixed(2)}%
              </div>
            </motion.div>
          )}

          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-3 h-3 text-zinc-600" />
              Execution Logs
            </h4>
            <span className="text-[8px] font-black text-zinc-600 uppercase border border-zinc-800 px-2 py-0.5 rounded-full">
              {logs.length} Operations
            </span>
          </div>
          <div className="bg-black/60 rounded-2xl border border-zinc-800/50 overflow-hidden h-40 overflow-y-auto custom-scrollbar">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                <Brain className="w-8 h-8 mb-2 opacity-10" />
                <span className="text-[10px] font-black uppercase tracking-tighter">No active signals found</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black",
                        log.type === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {log.type === 'BUY' ? 'B' : 'S'}
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-white uppercase tracking-tight">{log.reason}</div>
                        <div className="text-[8px] text-zinc-500 flex items-center gap-2">
                          <span>₹{log.price.toFixed(2)}</span>
                          <span>•</span>
                          <span>{new Date(log.date).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                    <ShieldCheck className="w-3 h-3 text-zinc-700" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
      
      {isRunning && (
        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-tight flex-1">
            Bot isActive and monitoring {symbol} using {settings.strategy.replace('_', ' ')} strategy. Orders will execute automatically.
          </p>
        </div>
      )}
    </div>
  );
};
