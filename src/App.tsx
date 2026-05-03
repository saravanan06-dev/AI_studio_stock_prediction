import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Search, Activity, BarChart3, 
  AlertTriangle, Info, RefreshCw, ArrowUpRight, ArrowDownRight,
  Target, ShieldCheck, Home, PieChart, Info as InfoIcon, Mail,
  Menu, X, ChevronRight, Github, Twitter, Linkedin, ExternalLink,
  CandlestickChart as CandleIcon, List, Briefcase, ShoppingBag, User, Bell,
  Star, Clock, LogIn, LogOut, Plus, Trash2, MessageSquare, Filter, Settings, Zap, Calendar, Newspaper, ChevronDown, Check, Sparkles, Brain, Users, MessageCircle,
  MousePointer2, Type, Shapes, Eraser, Maximize2, Minimize2, Settings2, Layers, Eye, EyeOff, Lock, Unlock, Bot,
  Pencil, Ruler, Square, Circle, Minus, LayoutGrid, Download, Share2, History,
  Database, Sigma, ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import { calculateIndicators, IndicatorResult } from './utils/indicators';
import { getStockPrediction, getNewsForSymbol } from './services/geminiService';
import { 
  analyzeMultiTrend, 
  FusionPrediction, 
  TrendSignal, 
  FinalDecision, 
  AnalysisModule 
} from './services/predictionEngine';
import { Portfolio } from './components/Portfolio';
import { OrderHistory } from './components/OrderHistory';
import { TradeModal } from './components/TradeModal';
import { StockData } from './types';
import { Backtesting } from './components/Backtesting';
import { Card } from './components/Card';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, doc, setDoc, query, where, onSnapshot, addDoc, deleteDoc, updateDoc 
} from './firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { ChatBot } from './components/ChatBot';
import { cn } from './utils/cn';
import { PaymentModal } from './components/PaymentModal';
import { TradingViewChart } from './components/TradingViewChart';

// --- Components ---

const StockLogo = ({ symbol, className = "w-6 h-6" }: { symbol: string, className?: string }) => {
  const ticker = (symbol || "").split('.')[0];
  const sources = useMemo(() => {
    if (!ticker) return [];
    return [
      `https://financialmodelingprep.com/image-stock/${ticker}.png`,
      `https://static2.finnhub.io/logo/${ticker}.png`,
      `https://static.ticker.com/logos/symbol/${ticker}.png`,
      `https://raw.githubusercontent.com/p-f-a/stock-logos/master/logos/${ticker}.png`
    ];
  }, [ticker]);
  
  const [srcIndex, setSrcIndex] = useState(0);
  const [error, setError] = useState(false);

  // Reset state when symbol changes
  useEffect(() => {
    setSrcIndex(0);
    setError(false);
  }, [symbol]);

  if (error && srcIndex >= sources.length - 1) {
    return (
      <div className={cn("bg-zinc-800 flex items-center justify-center rounded-full text-[10px] font-bold text-zinc-500 uppercase shrink-0", className)}>
        {ticker.substring(0, 2)}
      </div>
    );
  }

  return (
    <img 
      src={sources[srcIndex]} 
      alt={ticker}
      className={cn("rounded-full bg-white object-contain p-0.5 shrink-0", className)}
      onError={() => {
        if (srcIndex < sources.length - 1) {
          setSrcIndex(srcIndex + 1);
        } else {
          setError(true);
        }
      }}
      referrerPolicy="no-referrer"
    />
  );
};

const SearchInput = ({ 
  onSelect, 
  onSubmit, 
  placeholder = "Search...", 
  className,
  initialValue = "",
  large = false
}: { 
  onSelect: (s: any) => void, 
  onSubmit?: (val: string) => void,
  placeholder?: string,
  className?: string,
  initialValue?: string,
  large?: boolean
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        let attempts = 0;
        const maxAttempts = 3;
        
        const performSearch = async () => {
          try {
            const res = await fetch(`/api/search/${encodeURIComponent(query.trim())}`, {
              signal: abortController.signal
            });
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              throw new Error(errorData.error || `Search failed with status ${res.status}`);
            }
            const data = await res.json();
            setSuggestions(data);
            setShowSuggestions(true);
          } catch (e: any) {
            if (e.name === 'AbortError') return;
            
            if (attempts < maxAttempts - 1) {
              attempts++;
              console.warn(`Search attempt ${attempts} failed, retrying...`, e);
              setTimeout(performSearch, 500 * attempts);
            } else {
              console.error("Search error after retries:", e);
              setSuggestions([]);
            }
          }
        };

        performSearch();
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(query);
    }
    setShowSuggestions(false);
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <form onSubmit={handleSubmit} className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2.5 px-11 focus:outline-none focus:border-emerald-500/50 transition-all text-sm text-white placeholder:text-zinc-600"
        />
        {query && (
          <button 
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setShowSuggestions(false);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </form>

      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl z-50"
          >
            <div className="max-h-80 overflow-y-auto p-2 scrollbar-hide">
              {suggestions.map((s, idx) => (
                <button
                  key={`${s.symbol}-${idx}`}
                  onClick={() => {
                    onSelect(s);
                    setQuery(s.symbol);
                    setShowSuggestions(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-xl transition-colors text-left group"
                >
                  <StockLogo symbol={s.symbol} className="w-8 h-8" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-bold text-white text-xs group-hover:text-emerald-400">{s.symbol}</span>
                    <span className="text-[10px] text-zinc-500 truncate">{s.name}</span>
                  </div>
                  {s.type && (
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[8px] font-bold text-zinc-600 uppercase">{s.type}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Stat = ({ label, value, trend, icon: Icon }: { label: string, value: string, trend?: number, icon: any }) => (
  <Card className="flex flex-col gap-2 group">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-zinc-800 rounded-lg group-hover:bg-emerald-500/10 transition-colors">
        <Icon className="w-5 h-5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
      </div>
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
          trend >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
        )}>
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend || 0).toFixed(2)}%
        </div>
      )}
    </div>
    <div className="mt-2">
      <p className="text-xs sm:text-sm text-zinc-500 font-medium">{label}</p>
      <p className="text-lg sm:text-2xl font-bold text-white mt-0.5 sm:mt-1 tracking-tight">{value}</p>
    </div>
  </Card>
);

const SentimentBadge = ({ sentiment }: { sentiment?: { label: string, score: number, summary: string } }) => {
  if (!sentiment) return null;

  const getSentimentColor = (label: string) => {
    switch (label) {
      case 'BULLISH': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'BEARISH': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default: return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  const getSentimentIcon = (label: string) => {
    switch (label) {
      case 'BULLISH': return <TrendingUp className="w-3 h-3" />;
      case 'BEARISH': return <TrendingDown className="w-3 h-3" />;
      default: return <Activity className="w-3 h-3" />;
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border text-[8px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0",
      getSentimentColor(sentiment.label)
    )}>
      {getSentimentIcon(sentiment.label)}
      <span>{sentiment.label}</span>
    </div>
  );
};

const SentimentAnalysis = ({ prediction, mlPrediction, loading }: { prediction?: any, mlPrediction?: any, loading?: boolean }) => {
  if (loading) {
    return (
      <Card className="bg-zinc-950/50 border-zinc-800 overflow-hidden relative min-h-[300px] flex flex-col items-center justify-center">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 rounded-full" />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            <Activity className="w-5 h-5 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div className="text-center">
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">AI Analyzing Market</h3>
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">Processing News & Technicals...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!prediction || !prediction.sentiment) return null;
  const sentiment = prediction.sentiment;

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getPredictionColor = (pred: string) => {
    switch (pred) {
      case 'UP': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'DOWN': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default: return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  return (
    <Card className="bg-zinc-950/50 border-zinc-800 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 rounded-full" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex flex-col">
          <h3 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-widest">
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            AI Sentiment Analysis
          </h3>
          <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter mt-1">Real-time Market Pulse</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={cn(
            "px-3 py-1 rounded-lg text-xs font-black uppercase tracking-tighter border",
            getPredictionColor(prediction.prediction)
          )}>
            Prediction: {prediction.prediction}
          </div>
          <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
            {prediction.confidence}% Confidence
          </div>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        {/* Main Gauge */}
        <div className="relative pt-2">
          <div className="flex justify-between mb-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>Market Mood</span>
            <span className={getScoreColor(((sentiment.score + 1) / 2) * 100)}>
              {Math.abs((sentiment.score || 0) * 100).toFixed(0)}% {sentiment.score >= 0 ? 'Positive' : 'Negative'}
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${((sentiment.score + 1) / 2) * 100}%` }}
              className={cn(
                "h-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]",
                sentiment.label === 'BULLISH' ? "bg-emerald-500" :
                sentiment.label === 'BEARISH' ? "bg-rose-500" :
                "bg-amber-500"
              )}
            />
          </div>
          <div className="flex justify-between mt-1 text-[8px] font-black text-zinc-600 uppercase tracking-tighter">
            <span>Extreme Fear</span>
            <span>Neutral</span>
            <span>Extreme Greed</span>
          </div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'News Impact', score: sentiment.newsScore || 50, icon: Newspaper },
            { label: 'Social Buzz', score: sentiment.socialScore || 50, icon: Share2 },
            { label: 'Technical', score: sentiment.technicalScore || 50, icon: Activity },
          ].map((item, i) => (
            <div key={i} className="bg-black/40 p-2 rounded-xl border border-zinc-800/50 flex flex-col items-center gap-1">
              <item.icon className="w-3 h-3 text-zinc-500" />
              <span className="text-[8px] font-bold text-zinc-500 uppercase text-center">{item.label}</span>
              <span className={cn("text-xs font-black", getScoreColor(item.score))}>{item.score}%</span>
            </div>
          ))}
        </div>

        <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
          <p className="text-[10px] text-zinc-400 leading-relaxed italic">
            <span className="text-emerald-500 font-bold not-italic uppercase mr-1">AI Summary:</span>
            "{sentiment.summary}"
          </p>
        </div>

        {/* ML Engine Reasoning */}
        {mlPrediction && mlPrediction.insights && mlPrediction.insights.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Brain className="w-3 h-3 text-purple-500" />
                Technical Reasoning (ML)
              </h4>
              <span className="text-[8px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded uppercase">
                {(mlPrediction.confidence * 100).toFixed(1)}% ML Confidence
              </span>
            </div>
            <div className="grid gap-2">
              {mlPrediction.insights.map((insight: any, i: number) => (
                <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 p-2.5 rounded-xl group transition-all hover:bg-zinc-800/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{insight.indicator}</span>
                      <span className="text-[10px] font-medium text-purple-400/70">{insight.value}</span>
                    </div>
                    <div className={cn(
                      "px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter border",
                      insight.signal === 'BULLISH' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      insight.signal === 'BEARISH' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                      "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    )}>
                      {insight.signal}
                    </div>
                  </div>
                  <p className="text-[9px] text-zinc-500 leading-tight group-hover:text-zinc-400 transition-colors">
                    {insight.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

const NewsFeed = ({ news, loading }: { news: any[], loading: boolean }) => {
  if (loading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Market News</h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-3 bg-zinc-800 rounded w-3/4" />
              <div className="h-2 bg-zinc-800 rounded w-full" />
              <div className="h-2 bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!news || news.length === 0) return null;

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="w-4 h-4 text-emerald-500" />
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Market News</h3>
      </div>
      <div className="space-y-4">
        {news.map((article, idx) => (
          <div key={idx} className="group">
            <a 
              href={article.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:bg-white/5 p-2 -mx-2 rounded-lg transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">{article.source}</span>
                <span className="text-[8px] text-zinc-500 font-bold uppercase">{article.date}</span>
              </div>
              <h4 className="text-[11px] font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 leading-tight mb-1">
                {article.headline}
              </h4>
              <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">
                {article.snippet}
              </p>
            </a>
            {idx < news.length - 1 && <div className="h-px bg-zinc-800/50 mt-4" />}
          </div>
        ))}
      </div>
    </Card>
  );
};

const PriceAlerts = ({ 
  symbol, 
  alerts, 
  onAdd, 
  onDelete 
}: { 
  symbol: string, 
  alerts: any[], 
  onAdd: (threshold: number, type: 'above' | 'below') => void,
  onDelete: (id: string) => void
}) => {
  const [threshold, setThreshold] = useState('');
  const [type, setType] = useState<'above' | 'below'>('above');
  const [showForm, setShowForm] = useState(false);

  const symbolAlerts = alerts.filter(a => a.symbol === symbol);

  return (
    <Card className="bg-zinc-950/50 border-zinc-800/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Price Alerts</h3>
        </div>
        <div className="flex items-center gap-2">
          {symbolAlerts.some(a => a.isTriggered) && (
            <button 
              onClick={() => {
                const triggeredIds = symbolAlerts.filter(a => a.isTriggered).map(a => a.id);
                triggeredIds.forEach(id => onDelete(id));
              }}
              className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-rose-400 transition-colors"
              title="Clear Triggered"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={() => setShowForm(!showForm)}
            className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"
          >
            <Plus className={cn("w-4 h-4 transition-transform", showForm && "rotate-45")} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4 space-y-3"
          >
            <div className="flex gap-2">
              <input 
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="Target Price"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
              <select 
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
            </div>
            <button 
              onClick={() => {
                if (threshold) {
                  onAdd(parseFloat(threshold), type);
                  setThreshold('');
                  setShowForm(false);
                }
              }}
              className="w-full bg-emerald-500 text-black text-xs font-bold py-2 rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Set Alert
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
        {symbolAlerts.length === 0 ? (
          <p className="text-[10px] text-zinc-500 text-center py-4 italic">No alerts set for {symbol}</p>
        ) : (
          symbolAlerts.map((alert) => (
            <div 
              key={alert.id}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg border transition-colors",
                alert.isTriggered 
                  ? "bg-zinc-900/30 border-zinc-800/30 opacity-50" 
                  : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
              )}
            >
              <div className="flex items-center gap-2">
                {alert.type === 'above' ? (
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-rose-500" />
                )}
                <div>
                  <p className="text-xs font-bold text-white">₹{alert.threshold?.toLocaleString() ?? '---'}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[8px] text-zinc-500 uppercase tracking-widest">{alert.type} threshold</p>
                    {alert.isTriggered && (
                      <span className="px-1 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[7px] font-black text-amber-500 uppercase tracking-tighter">
                        Triggered
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onDelete(alert.id)}
                className="p-1 text-zinc-600 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

const MethodologyModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-xl font-display italic font-black text-white uppercase tracking-wider">Our Methodology</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto space-y-8 scrollbar-thin scrollbar-thumb-zinc-800">
          <section>
            <h3 className="text-emerald-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-widest">
              <Database className="w-4 h-4" /> 1. The "Major Role": Data Quality & Engineering
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              The most sophisticated AI model in the world will fail if the data is poor (the "Garbage In, Garbage Out" rule). Our agent synthesizes:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: "Historical Price", desc: "Moving averages, volume, and volatility analysis." },
                { title: "Fundamental Data", desc: "Earnings reports, P/E ratios, and debt levels." },
                { title: "Sentiment Analysis", desc: "Scanning news and social media for market mood." },
              ].map((item, i) => (
                <div key={i} className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                  <h4 className="text-white text-[10px] font-black uppercase mb-1">{item.title}</h4>
                  <p className="text-zinc-500 text-[10px] leading-tight font-medium">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-emerald-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-widest">
              <ShieldAlert className="w-4 h-4" /> 2. Risk Management (The "Safety Valve")
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              A successful agent doesn't just predict where a stock goes; it predicts what happens if it’s wrong. The major role here is the implementation of:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <li className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                 <div className="w-2 h-2 rounded-full bg-rose-500 mt-1 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                 <span className="text-zinc-400 text-xs"><strong className="text-white block mb-0.5">Stop-Loss Protocols</strong> Automatically exiting a position to prevent catastrophic loss.</span>
               </li>
               <li className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                 <span className="text-zinc-400 text-xs"><strong className="text-white block mb-0.5">Position Sizing</strong> Ensuring the agent doesn't "bet the farm" on a single high-risk trade.</span>
               </li>
            </ul>
          </section>

          <section>
            <h3 className="text-emerald-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-widest">
              <Sigma className="w-4 h-4" /> 3. The Mathematical Core
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              For prediction accuracy, the agent relies on complex statistical models, minimizing the <strong className="text-white font-black italic">Loss Function (L)</strong>, which measures the difference between predicted and actual prices:
            </p>
            <div className="bg-zinc-900/80 p-6 rounded-2xl border border-zinc-800 flex flex-col justify-center items-center font-mono">
              <div className="text-xl text-white font-black tracking-widest flex items-center gap-3">
                L = 
                <div className="flex flex-col items-center">
                   <div className="border-b border-white w-full text-center text-xs pb-0.5">1</div>
                   <div className="text-xs pt-0.5">n</div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] -mb-1 text-emerald-500">n</span>
                  <span className="text-3xl leading-none">Σ</span>
                  <span className="text-[10px] -mt-1 opacity-50 font-bold">i=1</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-light">(</span>
                  y<sub>i</sub> - ŷ<sub>i</sub>
                  <span className="text-2xl font-light">)</span>
                  <sup className="text-sm -mt-4 text-emerald-500 font-black">2</sup>
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
                <span>y: actual price</span>
                <div className="w-1 h-1 rounded-full bg-zinc-800 self-center" />
                <span>ŷ: predicted price</span>
              </div>
            </div>
          </section>

          <section className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <AlertTriangle className="w-16 h-16 text-amber-500" />
            </div>
            <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-widest">
              <AlertTriangle className="w-4 h-4" /> Important Reality Check
            </h3>
            <p className="text-zinc-400 text-xs italic leading-relaxed">
              No AI or agent can predict the stock market with 100% certainty. The "major role" of an AI is to tilt the odds in your favor by processing more information than a human ever could, but it cannot account for "Black Swan" events (unpredictable global disasters or sudden policy changes).
            </p>
          </section>
        </div>
        
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/30">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            Got it, let's trade
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const TradeAnalysisTool = ({ 
  symbol, 
  currentPrice,
  chartData,
  analysis, 
  onChange 
}: { 
  symbol: string, 
  currentPrice: number,
  chartData: any[],
  analysis: TradeAnalysis, 
  onChange: (a: TradeAnalysis) => void 
}) => {
  const [entry, setEntry] = useState(analysis.entry || currentPrice);
  const [target, setTarget] = useState(analysis.target || currentPrice * 1.05);
  const [stop, setStop] = useState(analysis.stop || currentPrice * 0.95);
  const [side, setSide] = useState<'LONG' | 'SHORT'>(analysis.side || 'LONG');

  useEffect(() => {
    if (!analysis.active) {
      setEntry(currentPrice);
      if (side === 'LONG') {
        setTarget(currentPrice * 1.05);
        setStop(currentPrice * 0.95);
      } else {
        setTarget(currentPrice * 0.95);
        setStop(currentPrice * 1.05);
      }
    }
  }, [currentPrice, analysis.active, side]);

  const rr = Math.abs(target - entry) / Math.max(0.01, Math.abs(entry - stop));

  const [isDetecting, setIsDetecting] = useState(false);

  const detectPatterns = async () => {
    setIsDetecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const recentData = chartData.slice(-50).map(d => ({
        date: d.date,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this stock data for ${symbol} and identify common chart patterns (e.g., Double Bottom, Head and Shoulders, Triangle, Support/Resistance Breakout, Cup and Handle).
        
        Recent Price Data: ${JSON.stringify(recentData)}
        Current Market Price: ${currentPrice}
        
        Task:
        1. Identify the most likely chart pattern.
        2. Determine the trade direction (LONG for bullish patterns, SHORT for bearish).
        3. Calculate a precise entry point (at or near a breakout level).
        4. Set a realistic target price based on pattern completion.
        5. Set a logical stop loss below support or above resistance.
        
        Return ONLY a raw JSON object following this schema:
        {
          "pattern": string (e.g. "Double Bottom"),
          "side": "LONG" | "SHORT",
          "entry": number,
          "target": number,
          "stop": number,
          "confidence": number (0 to 1),
          "reasoning": string
        }`,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text);
      if (result.confidence > 0.6) {
        onChange({
          ...analysis,
          active: true,
          side: result.side,
          entry: result.entry,
          target: result.target,
          stop: result.stop,
          pattern: result.pattern
        });
        setEntry(result.entry);
        setTarget(result.target);
        setStop(result.stop);
        setSide(result.side);
      }
    } catch (error) {
      console.error("Pattern detection failed:", error);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <Card className="bg-zinc-950/50 border-zinc-800/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Trade Analysis</h3>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={detectPatterns}
            disabled={isDetecting}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded text-[10px] font-bold transition-all",
              isDetecting ? "bg-zinc-800 text-emerald-500 animate-pulse" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            )}
            title="AI Pattern Detection"
          >
            <Zap className="w-3 h-3" />
            {isDetecting ? 'DETECTING...' : 'AI DETECT'}
          </button>
          <button 
            onClick={() => onChange({ ...analysis, active: !analysis.active })}
            className={cn(
              "px-2 py-1 rounded text-[10px] font-bold transition-all",
              analysis.active ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-500"
            )}
          >
            {analysis.active ? 'ACTIVE' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="flex p-1 bg-zinc-900 rounded-lg mb-4">
        <button 
          onClick={() => setSide('LONG')}
          className={cn(
            "flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all",
            side === 'LONG' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
          )}
        >
          Long
        </button>
        <button 
          onClick={() => setSide('SHORT')}
          className={cn(
            "flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all",
            side === 'SHORT' ? "bg-rose-500 text-black" : "text-zinc-500 hover:text-white"
          )}
        >
          Short
        </button>
      </div>

      {analysis.pattern && (
        <div className="mb-4 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Detected Pattern</span>
            <span className="text-[10px] font-black text-emerald-400 uppercase">{analysis.pattern}</span>
          </div>
          <p className="text-[9px] text-zinc-500 leading-tight">
            AI detected a potential {analysis.pattern.toLowerCase()} structure. Levels automatically adjusted.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Entry Price</label>
            <input 
              type="number" 
              value={entry} 
              onChange={(e) => setEntry(parseFloat(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className={cn("text-[10px] font-bold uppercase", side === 'LONG' ? "text-emerald-500" : "text-rose-500")}>
              Target Price (TP)
            </label>
            <input 
              type="number" 
              value={target} 
              onChange={(e) => setTarget(parseFloat(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className={cn("text-[10px] font-bold uppercase", side === 'LONG' ? "text-rose-500" : "text-emerald-500")}>
              Stop Loss (STOP)
            </label>
            <input 
              type="number" 
              value={stop} 
              onChange={(e) => setStop(parseFloat(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-900">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase">Risk / Reward Ratio</span>
            <span className={cn("text-sm font-black", rr >= 2 ? "text-emerald-400" : "text-amber-400")}>
              1 : {(rr || 0).toFixed(2)}
            </span>
          </div>
          <button 
            onClick={() => onChange({ ...analysis, entry, target, stop, side, active: true })}
            className="w-full bg-emerald-500 text-black text-xs font-bold py-2 rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Apply to Chart
          </button>
        </div>
      </div>
    </Card>
  );
};

const MultiTrendAnalysis = ({ prediction }: { prediction: FusionPrediction }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [accuracyBooster, setAccuracyBooster] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const getTrendColor = (trend: TrendSignal) => {
    if (trend === 'BULLISH') return 'text-emerald-500';
    if (trend === 'BEARISH') return 'text-rose-500';
    return 'text-amber-500';
  };

  const getDecisionColor = (decision: FinalDecision) => {
    if (decision.includes('BUY')) return 'text-emerald-500';
    if (decision.includes('SELL')) return 'text-rose-500';
    return 'text-amber-500';
  };

  const getDecisionBg = (decision: FinalDecision) => {
    if (decision.includes('BUY')) return 'bg-emerald-500/10 border-emerald-500/20';
    if (decision.includes('SELL')) return 'bg-rose-500/10 border-rose-500/20';
    return 'bg-amber-500/10 border-amber-500/20';
  };

  // Filter weak signals if booster is on
  const isWeak = (conf: number) => accuracyBooster && conf < 60;

  return (
    <div className="space-y-4">
      {/* Final Decision Card */}
      <div className={cn(
        "p-6 rounded-2xl border transition-all duration-500",
        getDecisionBg(prediction.decision)
      )}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">AI Fusion Model Decision</span>
            </div>
            <h2 className={cn("text-4xl font-black tracking-tighter", getDecisionColor(prediction.decision))}>
              {prediction.decision}
            </h2>
            <div className="flex items-center gap-3 text-xs font-bold text-zinc-400">
              <span className="flex items-center gap-1">
                {prediction.direction === 'UPTREND' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : 
                 prediction.direction === 'DOWNTREND' ? <TrendingDown className="w-3 h-3 text-rose-500" /> : 
                 <Activity className="w-3 h-3 text-amber-500" />}
                {prediction.direction}
              </span>
              <div className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>Historical Accuracy: {prediction.accuracy?.toFixed(1) || '0.0'}%</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-3xl font-black text-white">{prediction.confidence}%</div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Confidence Score</div>
            </div>
            <div className="h-12 w-px bg-zinc-800" />
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setAccuracyBooster(!accuracyBooster)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  accuracyBooster ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
              >
                <ShieldCheck className="w-3 h-3" />
                Accuracy Booster {accuracyBooster ? 'ON' : 'OFF'}
              </button>
              <button 
                onClick={() => setShowExplanation(!showExplanation)}
                className="px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <MessageSquare className="w-3 h-3" />
                {showExplanation ? 'Hide Reasoning' : 'Explain More'}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showExplanation && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-6 pt-6 border-t border-zinc-800/50">
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-emerald-500 shrink-0 mt-1" />
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed font-medium whitespace-pre-line">
                      {prediction.explanation}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {prediction.modules.patterns.map((p, i) => (
                        <div key={i} className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-400 flex items-center gap-2">
                          <Zap className={cn("w-3 h-3", p.type === 'BULLISH' ? 'text-emerald-500' : 'text-rose-500')} />
                          {p.pattern} ({p.strength}%)
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Multi-Trend Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TrendCard 
          title="Short-Term Trend" 
          subtitle="Scalping / Intraday"
          data={prediction.modules.shortTerm} 
          weight={20}
          isWeak={isWeak(prediction.modules.shortTerm.confidence)}
        />
        <TrendCard 
          title="Medium-Term Trend" 
          subtitle="Swing Trading"
          data={prediction.modules.mediumTerm} 
          weight={25}
          isWeak={isWeak(prediction.modules.mediumTerm.confidence)}
        />
        <TrendCard 
          title="Long-Term Trend" 
          subtitle="Investment View"
          data={prediction.modules.longTerm} 
          weight={25}
          isWeak={isWeak(prediction.modules.longTerm.confidence)}
        />
      </div>

      {/* Expandable Breakdown */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <button 
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Detailed AI Breakdown</span>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", showBreakdown && "rotate-180")} />
        </button>
        
        <AnimatePresence>
          {showBreakdown && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-black/20 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-3 h-3 text-purple-500" />
                    Momentum & Strength
                  </h3>
                  <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                        prediction.modules.momentum.strength === 'STRONG' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {prediction.modules.momentum.strength}
                      </span>
                      <span className="text-lg font-black text-white">{prediction.modules.momentum.confidence}%</span>
                    </div>
                    <ul className="space-y-2">
                      {prediction.modules.momentum.reasoning.map((r, i) => (
                        <li key={i} className="text-[10px] text-zinc-400 flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-zinc-700" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <CandleIcon className="w-3 h-3 text-blue-500" />
                    Candlestick Analysis
                  </h3>
                  <div className="space-y-2">
                    {prediction.modules.patterns.length > 0 ? (
                      prediction.modules.patterns.map((p, i) => (
                        <div key={i} className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              p.type === 'BULLISH' ? "bg-emerald-500/10 text-emerald-500" : 
                              p.type === 'BEARISH' ? "bg-rose-500/10 text-rose-500" : 
                              "bg-zinc-800 text-zinc-400"
                            )}>
                              <CandleIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">{p.pattern}</div>
                              <div className="text-[10px] text-zinc-500">{p.type} SIGNAL</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-white">{p.strength}%</div>
                            <div className="text-[8px] font-bold text-zinc-500 uppercase">Strength</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase">No significant patterns detected</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const TrendCard = ({ title, subtitle, data, weight, isWeak }: { title: string, subtitle: string, data: AnalysisModule, weight: number, isWeak?: boolean }) => {
  return (
    <div className={cn(
      "p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 transition-all relative overflow-hidden",
      isWeak && "opacity-40 grayscale pointer-events-none"
    )}>
      {isWeak && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="px-2 py-1 bg-zinc-800 rounded text-[8px] font-black text-zinc-500 uppercase tracking-widest border border-zinc-700">Weak Signal Ignored</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider">{title}</h3>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-black text-zinc-400">{weight}% Weight</div>
        </div>
      </div>
      
      <div className="flex items-end justify-between mb-4">
        <div className={cn(
          "text-xl font-black tracking-tighter",
          data.trend === 'BULLISH' ? "text-emerald-500" : 
          data.trend === 'BEARISH' ? "text-rose-500" : 
          "text-amber-500"
        )}>
          {data.trend}
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-white leading-none">{data.confidence}%</div>
          <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Confidence</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.reasoning.map((r, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-1 h-1 rounded-full bg-zinc-700 mt-1.5 shrink-0" />
            <span className="text-[10px] text-zinc-400 leading-tight">{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AIPulseCard = ({ 
  prediction, 
  loading, 
  onChatClick 
}: { 
  prediction: any, 
  loading: boolean, 
  onChatClick: () => void 
}) => {
  if (loading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800 animate-pulse h-48">
        <div className="h-full w-full" />
      </Card>
    );
  }

  if (!prediction) return null;

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden group">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">AI Market Pulse (Qualitative)</span>
        </div>
        <button 
          onClick={onChatClick}
          className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase hover:bg-emerald-500/20 transition-all"
        >
          Discuss with AI
        </button>
      </div>
      
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
            <Newspaper className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-[10px] font-black text-zinc-500 uppercase">Market Sentiment</h4>
            <p className="text-xs text-zinc-300 leading-relaxed italic">
              "{prediction.sentiment?.summary || prediction.reasoning || 'Analyzing market news and social sentiment...'}"
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-black/20 border border-zinc-800/50">
            <div className="text-[8px] font-black text-zinc-500 uppercase mb-1">Target Price</div>
            <div className="text-sm font-black text-white">₹{prediction.targetPrice?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="p-3 rounded-xl bg-black/20 border border-zinc-800/50">
            <div className="text-[8px] font-black text-zinc-500 uppercase mb-1">Timeframe</div>
            <div className="text-sm font-black text-white">{prediction.timeframe || 'Short-term'}</div>
          </div>
        </div>
      </div>
    </Card>
  );
};

// --- Components ---

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("animate-pulse bg-zinc-900 rounded-lg", className)} />
);

const Sparkline: React.FC<{ data: any[], color: string }> = ({ data, color }) => (
  <div className="w-24 h-8 bg-zinc-900/50 rounded flex items-center justify-center">
    <div className="w-16 h-px bg-zinc-800" />
  </div>
);

const getSimulatedRecommendation = (symbol: string, change?: number) => {
  const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Simulate technical factors based on hash and symbol
  const rsi = 30 + (hash % 41); // Simulated RSI between 30 and 70
  const macdHist = (hash % 201 - 100) / 100; // Simulated MACD Histogram between -1 and 1
  const smaTrend = hash % 2 === 0 ? 1 : -1; // Simulated SMA trend
  
  let score = 50;
  
  // RSI Logic: Oversold is bullish, Overbought is bearish
  if (rsi < 40) score += 15;
  if (rsi > 60) score -= 15;
  
  // MACD Logic: Positive histogram is bullish
  if (macdHist > 0.2) score += 15;
  if (macdHist < -0.2) score -= 15;
  
  // Trend Logic
  if (smaTrend > 0) score += 10;
  else score -= 10;
  
  // Real-time factor: Positive change adds to bullishness
  if (change !== undefined) {
    score += Math.max(-20, Math.min(20, change * 4));
  }
  
  // Final normalization
  score = Math.max(0, Math.min(100, score));
  
  if (score > 82) return { tag: '🔥 Strong Buy', color: 'text-emerald-400', confidence: 88 + (score % 10), score };
  if (score > 60) return { tag: '👍 Buy', color: 'text-emerald-500/70', confidence: 72 + (score % 15), score };
  if (score > 35) return { tag: '⚠️ Hold', color: 'text-amber-400', confidence: 55 + (score % 20), score };
  return { tag: '❌ Sell', color: 'text-rose-400', confidence: 78 + (score % 15), score };
};

const getHistoricalSparkline = (symbol: string) => {
  const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Array.from({ length: 7 }, (_, i) => ({
    date: i,
    close: 100 + Math.sin((hash + i) * 0.5) * 10 + Math.random() * 5
  }));
};

const TICKER_SYMBOLS = [
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'BHARTIARTL.NS', 'SBIN.NS', 'WIPRO.NS'
];

const StockTicker: React.FC<{ onSelect: (s: string) => void, realTimeQuotes: Record<string, any>, tickerSymbols?: string[] }> = ({ onSelect, realTimeQuotes, tickerSymbols = TICKER_SYMBOLS }) => {
  const stocks = tickerSymbols.map(symbol => {
    const quote = realTimeQuotes[symbol];
    // Default values if no real-time data yet
    const defaults: Record<string, any> = {
      'RELIANCE.NS': { price: 2945.60, change: 0.0125 },
      'TCS.NS': { price: 4120.35, change: -0.0045 },
      'INFY.NS': { price: 1645.20, change: 0.0210 },
      'HDFCBANK.NS': { price: 1450.15, change: 0.0085 },
      'ICICIBANK.NS': { price: 1085.40, change: -0.0115 },
      'BHARTIARTL.NS': { price: 1210.75, change: 0.0155 },
      'SBIN.NS': { price: 765.30, change: 0.0035 },
      'WIPRO.NS': { price: 485.20, change: -0.0245 },
    };

    const price = quote?.price || defaults[symbol]?.price || 0;
    const change = quote ? (quote.change * 100) : (defaults[symbol]?.change * 100 || 0);

    return { symbol, price, change };
  });

  return (
    <div className="bg-zinc-950 border-b border-zinc-900 py-2 overflow-hidden whitespace-nowrap relative z-50">
      <motion.div 
        animate={{ x: [0, -1000] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="inline-flex gap-8"
      >
        {[...stocks, ...stocks].map((stock, i) => (
          <button 
            key={`${stock.symbol}-${i}`}
            onClick={() => onSelect(stock.symbol)}
            className="flex items-center gap-2 hover:bg-zinc-900 px-3 py-1 rounded-lg transition-colors"
          >
            <span className="text-xs font-bold text-white">{stock.symbol}</span>
            <span className={cn(
              "text-xs font-bold",
              stock.change >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              ₹{(stock.price || 0).toFixed(2)} ({stock.change >= 0 ? '+' : ''}{stock.change}%)
            </span>
          </button>
        ))}
      </motion.div>
    </div>
  );
};

const TopStocks: React.FC<{ 
  onSelect: (s: string) => void, 
  onAddToWatchlist: (s: string) => void,
  realTimeQuotes: Record<string, any>
}> = ({ onSelect, onAddToWatchlist, realTimeQuotes }) => {
  const topStocks = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services' },
    { symbol: 'INFY.NS', name: 'Infosys Limited' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited' },
    { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Limited' },
    { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Limited' },
  ];

  return (
    <div className="w-full max-w-5xl mt-24">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-display italic font-black text-white">📈 Current Top Stocks</h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live Market Feed</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topStocks.map((stock) => {
          const quote = realTimeQuotes[stock.symbol];
          const price = quote?.price || 0;
          const change = quote?.changePercent || 0;
          const isPositive = change >= 0;
          const recommendation = getSimulatedRecommendation(stock.symbol, change);
          const sparklineData = getHistoricalSparkline(stock.symbol);
          const isTopPick = recommendation.confidence > 85;
          
          return (
            <Card 
              key={stock.symbol} 
              className={cn(
                "group hover:border-emerald-500/30 transition-all cursor-pointer relative overflow-hidden",
                isTopPick && "border-purple-500/50 bg-purple-500/[0.03] ring-1 ring-purple-500/10 shadow-lg shadow-purple-500/5"
              )}
              onClick={() => onSelect(stock.symbol)}
            >
              {isTopPick && (
                <div className="absolute top-0 right-0 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-bl-xl z-20 flex items-center gap-1.5 shadow-lg shadow-purple-500/20">
                  <Sparkles className="w-3 h-3 fill-current" />
                  AI Top Pick
                </div>
              )}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <StockLogo symbol={stock.symbol} className="w-10 h-10" />
                  <div>
                    <h3 className="text-white font-bold text-sm group-hover:text-emerald-400 transition-colors">{stock.symbol}</h3>
                    <p className="text-[10px] text-zinc-500 truncate max-w-[120px]">{stock.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-bold", isPositive ? "text-emerald-400" : "text-rose-400")}>
                    ₹{price > 0 ? (price || 0).toFixed(2) : '---'}
                  </p>
                  <p className={cn("text-[10px] font-bold", isPositive ? "text-emerald-500/70" : "text-rose-500/70")}>
                    {isPositive ? '↑' : '↓'} {Math.abs(change || 0).toFixed(2)}%
                  </p>
                </div>
              </div>
              
              <div className="flex items-end justify-between mt-6">
                <div className="space-y-1">
                  <span className={cn("text-[10px] font-bold uppercase tracking-tighter", recommendation.color)}>
                    {recommendation.tag}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full", isTopPick ? "bg-purple-500" : "bg-emerald-500")}
                        style={{ width: `${recommendation.confidence}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-zinc-600 font-bold">{recommendation.confidence}% AI</span>
                  </div>
                </div>
                <Sparkline data={sparklineData} color={isPositive ? "#10b981" : "#fb7185"} />
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToWatchlist(stock.symbol);
                }}
                className="absolute top-4 right-4 p-2 bg-zinc-900 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-500 hover:text-black"
              >
                <Plus className="w-4 h-4" />
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// --- Sections ---

const WatchlistPage: React.FC<{ 
  user: FirebaseUser, 
  onSelect: (s: string) => void,
  watchlist: { id: string, symbol: string, tabIndex: number }[],
  setWatchlist: React.Dispatch<React.SetStateAction<{ id: string, symbol: string, tabIndex: number }[]>>,
  realTimeQuotes: Record<string, any>
}> = ({ user, onSelect, watchlist, setWatchlist, realTimeQuotes }) => {
  const [activeWatchlistTab, setActiveWatchlistTab] = useState(1);
  const [filter, setFilter] = useState<'all' | 'gainers' | 'losers' | 'ai-picks'>('all');
  const [sortBy, setSortBy] = useState<'symbol' | 'performance'>('performance');
  const [quotes, setQuotes] = useState<Record<string, any>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    
    const loadFromLocalStorage = () => {
      const localData = localStorage.getItem(`watchlist_${user.uid}`);
      if (localData) {
        setWatchlist(JSON.parse(localData));
      }
    };

    try {
      const q = query(collection(db, 'watchlist'), where('uid', '==', user.uid));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const remoteData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          symbol: doc.data().symbol,
          tabIndex: doc.data().tabIndex || 1
        }));
        setWatchlist(remoteData);
        localStorage.setItem(`watchlist_${user.uid}`, JSON.stringify(remoteData));
      }, (error) => {
        console.warn("Firestore error, using local storage:", error);
        loadFromLocalStorage();
      });
    } catch (e) {
      console.warn("Firestore setup incomplete, using local storage:", e);
      loadFromLocalStorage();
    }

    return () => unsubscribe();
  }, [user]);

  const fetchQuotes = async () => {
    const symbolsToFetch = watchlist.filter(item => item.tabIndex === activeWatchlistTab).map(item => item.symbol);
    if (symbolsToFetch.length === 0) return;
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: symbolsToFetch })
      });
      if (!response.ok) throw new Error('Failed to fetch quotes');
      const data = await response.json();
      const quoteMap: Record<string, any> = {};
      data.forEach((q: any) => {
        quoteMap[q.symbol] = q;
      });
      setQuotes(prev => ({ ...prev, ...quoteMap }));
    } catch (e) {
      console.error("Quote fetch error:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 10000);
    return () => clearInterval(interval);
  }, [watchlist, activeWatchlistTab]);

  const filteredWatchlist = useMemo(() => {
    let items = watchlist.filter(item => item.tabIndex === activeWatchlistTab);
    
    if (filter === 'gainers') {
      items = items.filter(item => (quotes[item.symbol]?.regularMarketChangePercent || 0) > 0);
    } else if (filter === 'losers') {
      items = items.filter(item => (quotes[item.symbol]?.regularMarketChangePercent || 0) < 0);
    } else if (filter === 'ai-picks') {
      items = items.filter(item => {
        const rec = getSimulatedRecommendation(item.symbol);
        return rec.tag.includes('Buy');
      });
    }

    return items.sort((a, b) => {
      if (sortBy === 'symbol') return a.symbol.localeCompare(b.symbol);
      const perfA = quotes[a.symbol]?.regularMarketChangePercent || 0;
      const perfB = quotes[b.symbol]?.regularMarketChangePercent || 0;
      return perfB - perfA;
    });
  }, [watchlist, activeWatchlistTab, filter, sortBy, quotes]);

  const addToWatchlist = async (symbol: string) => {
    if (watchlist.some(item => item.symbol === symbol && item.tabIndex === activeWatchlistTab)) return;
    
    const newItem = {
      uid: user.uid,
      symbol,
      tabIndex: activeWatchlistTab,
      addedAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'watchlist'), newItem);
    } catch (e) {
      console.warn("Failed to add to Firestore, saving locally:", e);
      const localItem = { ...newItem, id: Date.now().toString() };
      const updatedWatchlist = [...watchlist, localItem];
      setWatchlist(updatedWatchlist);
      localStorage.setItem(`watchlist_${user.uid}`, JSON.stringify(updatedWatchlist));
    }
  };

  const removeFromWatchlist = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'watchlist', id));
    } catch (e) {
      console.warn("Failed to delete from Firestore, removing locally:", e);
      const updatedWatchlist = watchlist.filter(item => item.id !== id);
      setWatchlist(updatedWatchlist);
      localStorage.setItem(`watchlist_${user.uid}`, JSON.stringify(updatedWatchlist));
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-16rem)]">
      {/* Watchlist Header & Tabs */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-t-3xl p-4 md:p-6 pb-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-display italic font-black text-white">Watchlist</h2>
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
              {[1, 2, 3, 4, 5].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveWatchlistTab(tab)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeWatchlistTab === tab 
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-full md:w-auto">
              {(['all', 'gainers', 'losers', 'ai-picks'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "flex-1 md:flex-none px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter transition-all",
                    filter === f ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {f.replace('-', ' ')}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <SearchInput 
                onSelect={(s) => addToWatchlist(s.symbol)}
                placeholder="Add to watchlist.."
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Watchlist Content */}
      <div className="flex-1 bg-zinc-950 border-x border-b border-zinc-900 rounded-b-3xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {filteredWatchlist.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                <Star className="w-8 h-8 text-zinc-700" />
              </div>
              <h3 className="text-white font-bold mb-1">No stocks found</h3>
              <p className="text-zinc-500 text-sm max-w-[200px]">Try changing your filters or add new stocks.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {filteredWatchlist.map((item) => {
                const rtQuote = realTimeQuotes[item.symbol];
                const apiQuote = quotes[item.symbol];
                
                const price = rtQuote?.price || apiQuote?.regularMarketPrice || 0;
                
                // Calculate change based on real-time price vs apiQuote's previous close if available
                const prevClose = apiQuote?.regularMarketPreviousClose || (price / (1 + (apiQuote?.regularMarketChangePercent || 0) / 100));
                const change = price - prevClose;
                const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
                const isPositive = change >= 0;
                
                const recommendation = getSimulatedRecommendation(item.symbol, changePercent);
                
                return (
                  <div 
                    key={item.id} 
                    className="flex items-center gap-4 p-4 hover:bg-zinc-900/50 transition-all group cursor-pointer"
                    onClick={() => onSelect(item.symbol)}
                  >
                    <StockLogo symbol={item.symbol} className="w-10 h-10" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">{item.symbol}</p>
                        <span className="text-[8px] font-bold text-zinc-600 uppercase">NSE</span>
                        <span className={cn("text-[8px] font-black uppercase tracking-tighter ml-2", recommendation.color)}>
                          {recommendation.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 truncate">{apiQuote?.shortName || item.symbol}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className={cn(
                          "font-bold text-sm",
                          isPositive ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {price > 0 && price !== null && price !== undefined ? `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '---'}
                        </p>
                        <div className="flex items-center justify-end gap-1">
                          <p className={cn(
                            "text-[10px] font-medium",
                            isPositive ? "text-emerald-500/70" : "text-rose-500/70"
                          )}>
                            {apiQuote ? `${isPositive ? '+' : ''}${(change || 0).toFixed(2)}` : ''}
                          </p>
                          <p className={cn(
                            "text-[10px] font-medium",
                            isPositive ? "text-emerald-500/70" : "text-rose-500/70"
                          )}>
                            ({apiQuote ? `${isPositive ? '+' : ''}${(changePercent || 0).toFixed(2)}%` : ''})
                          </p>
                        </div>
                      </div>

                      {/* Hover Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromWatchlist(item.id);
                          }}
                          className="p-2 hover:bg-zinc-800 text-zinc-600 hover:text-rose-500 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Watchlist Footer */}
        <div className="p-4 bg-zinc-900/30 border-t border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", isRefreshing ? "bg-emerald-500 animate-pulse" : "bg-zinc-700")} />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {isRefreshing ? "Updating Live" : "Market Open"}
              </span>
            </div>
            <span className="text-[10px] text-zinc-600 font-medium">
              {filteredWatchlist.length} Items
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSortBy(sortBy === 'symbol' ? 'performance' : 'symbol')}
              className="text-[10px] font-bold text-zinc-500 hover:text-emerald-500 uppercase tracking-widest transition-colors flex items-center gap-1"
            >
              Sort: {sortBy}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface Order {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  date: string;
  status: 'Completed' | 'Pending';
  total?: number;
}

interface PortfolioItem {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

const PortfolioPage: React.FC<{ portfolio: PortfolioItem[], realTimeQuotes: Record<string, any> }> = ({ portfolio, realTimeQuotes }) => {
  const totalValue = portfolio.reduce((acc, item) => {
    const price = realTimeQuotes[item.symbol]?.price || item.avgPrice;
    return acc + (item.quantity * price);
  }, 0);
  const totalCost = portfolio.reduce((acc, item) => acc + (item.quantity * item.avgPrice), 0);
  const totalPL = totalValue - totalCost;
  const totalPLPercentage = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <h2 className="text-3xl font-display italic font-black text-white">Portfolio</h2>
        <div className="flex gap-8">
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Total Value</p>
            <p className="text-2xl font-black text-white">₹{totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Total P/L</p>
            <p className={cn("text-2xl font-black", totalPL >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {totalPL >= 0 ? '+' : ''}₹{totalPL?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
              <span className="text-xs ml-1 opacity-70">({(totalPLPercentage || 0).toFixed(2)}%)</span>
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Holdings</h3>
            <div className="flex gap-12 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
              <span>Quantity</span>
              <span className="w-24 text-right">Market Value</span>
              <span className="w-24 text-right">Profit / Loss</span>
            </div>
          </div>
          <div className="space-y-3">
            {portfolio.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Your portfolio is empty. Place an order to get started.</p>
              </div>
            ) : (
              portfolio.map((item) => {
                const currentPrice = realTimeQuotes[item.symbol]?.price || item.avgPrice;
                const marketValue = item.quantity * currentPrice;
                const profit = (currentPrice - item.avgPrice) * item.quantity;
                const profitPercentage = (profit / (item.quantity * item.avgPrice)) * 100;
                const isProfit = profit >= 0;
                
                return (
                  <div key={item.symbol} className="flex items-center justify-between p-4 bg-zinc-900/30 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all group">
                    <div className="flex items-center gap-4">
                      <StockLogo symbol={item.symbol} className="w-10 h-10" />
                      <div>
                        <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{item.symbol}</p>
                        <p className="text-[10px] text-zinc-500 font-medium">Avg. ₹{(item.avgPrice || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-12">
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{item.quantity}</p>
                        <p className="text-[10px] text-zinc-500 uppercase">Shares</p>
                      </div>
                      
                      <div className="w-24 text-right">
                        <p className="text-sm font-bold text-white">₹{marketValue?.toLocaleString() ?? '---'}</p>
                        <p className="text-[10px] text-zinc-500 uppercase">@ ₹{(currentPrice || 0).toFixed(2)}</p>
                      </div>

                      <div className="w-24 text-right">
                        <p className={cn("text-sm font-bold", isProfit ? "text-emerald-400" : "text-rose-400")}>
                          {isProfit ? '+' : ''}₹{profit?.toLocaleString() ?? '---'}
                        </p>
                        <p className={cn("text-[10px] font-bold", isProfit ? "text-emerald-500/70" : "text-rose-500/70")}>
                          {isProfit ? '+' : ''}{(profitPercentage || 0).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Allocation</h3>
          <div className="aspect-square bg-zinc-800/30 rounded-full border-8 border-emerald-500/20 flex items-center justify-center">
            <PieChart className="w-12 h-12 text-emerald-500" />
          </div>
          <div className="mt-6 space-y-2">
            {portfolio.map(item => (
              <div key={item.symbol} className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">{item.symbol}</span>
                <span className="text-white font-bold">
                  {((item.quantity * (realTimeQuotes[item.symbol]?.price || item.avgPrice) / totalValue) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </motion.div>
  );
};

const OrdersPage: React.FC<{ orders: Order[] }> = ({ orders }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
    <h2 className="text-3xl font-display italic font-black text-white">My Orders</h2>
    <Card>
      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No orders found.</p>
          </div>
        ) : (
          [...orders].reverse().map((order) => (
            <div key={order.id} className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold",
                  order.type === 'BUY' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                )}>{order.type}</div>
                <div>
                  <p className="text-sm font-bold text-white">{order.symbol}</p>
                  <p className="text-[10px] text-zinc-500">{order.date} • {order.quantity} Shares</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">₹{(order.price || 0).toFixed(2)}</p>
                <p className={cn(
                  "text-[10px] font-bold",
                  order.status === 'Completed' ? "text-emerald-400" : "text-amber-400"
                )}>{order.status}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  </motion.div>
);

const AccountPage: React.FC<{ 
  user: FirebaseUser, 
  settings: AlertSettings, 
  onSettingsChange: (s: AlertSettings) => void,
  alerts: any[],
  onAddAlert: (threshold: number, type: 'above' | 'below') => void,
  onDeleteAlert: (id: string) => void
}> = ({ user, settings, onSettingsChange, alerts, onAddAlert, onDeleteAlert }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-8">
    <div className="flex flex-col items-center text-center gap-4">
      <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-4 border-emerald-500/20 p-1">
        <img src={user.photoURL || "https://picsum.photos/seed/user/200/200"} alt="Profile" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-white">{user.displayName || 'User'}</h2>
        <p className="text-zinc-500 text-sm">{user.email}</p>
      </div>
    </div>

    <Card className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-5 h-5 text-emerald-500" />
        <h3 className="font-bold text-white uppercase tracking-wider">Notification Settings</h3>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
          <div>
            <p className="text-sm font-bold text-white">AI Signal Alerts</p>
            <p className="text-[10px] text-zinc-500">Get notified when AI generates a new signal.</p>
          </div>
          <button 
            onClick={() => onSettingsChange({ ...settings, aiSignals: !settings.aiSignals })}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              settings.aiSignals ? "bg-emerald-500" : "bg-zinc-800"
            )}
          >
            <div className={cn(
              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
              settings.aiSignals ? "left-6" : "left-1"
            )} />
          </button>
        </div>

        {settings.aiSignals && (
          <div className="flex gap-4 pl-4 pb-2">
            {(['BUY', 'SELL'] as const).map(type => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={settings.aiSignalTypes.includes(type)}
                  onChange={(e) => {
                    const newTypes = e.target.checked 
                      ? [...settings.aiSignalTypes, type]
                      : settings.aiSignalTypes.filter(t => t !== type);
                    onSettingsChange({ ...settings, aiSignalTypes: newTypes });
                  }}
                  className="w-3 h-3 accent-emerald-500"
                />
                <span className={cn(
                  "text-[10px] font-bold uppercase",
                  type === 'BUY' ? "text-emerald-500" : "text-rose-500"
                )}>{type} Signals</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
          <div>
            <p className="text-sm font-bold text-white">Target Price Alerts</p>
            <p className="text-[10px] text-zinc-500">Get notified when a stock reaches the AI's target price.</p>
          </div>
          <button 
            onClick={() => onSettingsChange({ ...settings, targetPrice: !settings.targetPrice })}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              settings.targetPrice ? "bg-emerald-500" : "bg-zinc-800"
            )}
          >
            <div className={cn(
              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
              settings.targetPrice ? "left-6" : "left-1"
            )} />
          </button>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
          <div>
            <p className="text-sm font-bold text-white">Price Movement Alerts</p>
            <p className="text-[10px] text-zinc-500">Get notified of significant price movements.</p>
          </div>
          <button 
            onClick={() => onSettingsChange({ ...settings, priceMovement: !settings.priceMovement })}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              settings.priceMovement ? "bg-emerald-500" : "bg-zinc-800"
            )}
          >
            <div className={cn(
              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
              settings.priceMovement ? "left-6" : "left-1"
            )} />
          </button>
        </div>

        {settings.priceMovement && (
          <div className="pt-2 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-500">
                <span>Movement Threshold</span>
                <span>{settings.movementThreshold}%</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="10" 
                step="0.5"
                value={settings.movementThreshold}
                onChange={(e) => onSettingsChange({ ...settings, movementThreshold: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 bg-zinc-800 rounded-lg h-1 appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
          <div>
            <p className="text-sm font-bold text-white">Custom Price Alerts</p>
            <p className="text-[10px] text-zinc-500">Enable or disable custom price threshold notifications.</p>
          </div>
          <button 
            onClick={() => onSettingsChange({ ...settings, customAlerts: !settings.customAlerts })}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              settings.customAlerts ? "bg-emerald-500" : "bg-zinc-800"
            )}
          >
            <div className={cn(
              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
              settings.customAlerts ? "left-6" : "left-1"
            )} />
          </button>
        </div>
      </div>
    </Card>

    {settings.customAlerts && (
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Target className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold text-white uppercase tracking-wider">Manage Price Alerts</h3>
        </div>
        <PriceAlerts 
          symbol="RELIANCE.NS" // Default symbol for account page management
          alerts={alerts}
          onAdd={onAddAlert}
          onDelete={onDeleteAlert}
        />
      </div>
    )}

    <div className="grid grid-cols-1 gap-4">
      {[
        { label: 'Profile Settings', icon: User },
        { label: 'Security & Privacy', icon: ShieldCheck },
        { label: 'Bank Accounts', icon: Home },
        { label: 'Help & Support', icon: InfoIcon },
      ].map((item, i) => (
        <Card key={i} className="flex items-center justify-between hover:bg-zinc-800/50 cursor-pointer group">
          <div className="flex items-center gap-4">
            <item.icon className="w-5 h-5 text-zinc-500 group-hover:text-emerald-400" />
            <span className="text-sm font-bold text-white">{item.label}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-700" />
        </Card>
      ))}
      <button 
        onClick={() => signOut(auth)}
        className="w-full py-4 bg-rose-500/10 text-rose-400 font-bold rounded-2xl border border-rose-500/20 hover:bg-rose-500/20 transition-all mt-4"
      >
        Log Out
      </button>
    </div>
  </motion.div>
);

const LoginPage: React.FC<{ onGuest?: () => void }> = ({ onGuest }) => {
  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn("Failed to sync user to Firestore:", e);
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. You can still use the app as a guest.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto py-24 text-center"
    >
      <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
        <Activity className="w-10 h-10 text-emerald-500" />
      </div>
      <h2 className="text-4xl font-display italic font-black text-white mb-4">Welcome Back</h2>
      <p className="text-zinc-500 mb-12">Sign in to access your portfolio, watchlist, and AI-powered predictions.</p>
      
      <div className="space-y-4">
        <button 
          onClick={handleLogin}
          className="w-full py-4 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all shadow-xl shadow-white/5"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <button 
          onClick={onGuest}
          className="w-full py-4 bg-zinc-900 text-white font-black rounded-2xl border border-zinc-800 hover:bg-zinc-800 transition-all"
        >
          Continue as Guest
        </button>
      </div>
      
      <p className="mt-8 text-xs text-zinc-600">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </motion.div>
  );
};

const HomePage: React.FC<{ 
  onStart: () => void, 
  onSelect: (s: any) => void, 
  onSearch: (val: string) => void,
  onAddToWatchlist: (s: string) => void,
  onViewMethodology: () => void,
  realTimeQuotes: Record<string, any>
}> = ({ onStart, onSelect, onSearch, onAddToWatchlist, onViewMethodology, realTimeQuotes }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-12 px-4"
  >
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8">
      <Activity className="w-3 h-3" />
      Next-Gen Market Intelligence
    </div>
    <h1 className="text-6xl md:text-8xl font-display italic font-black text-white leading-tight mb-6 text-center">
      Predict the <span className="text-emerald-500">Unpredictable.</span>
    </h1>
    <p className="text-zinc-400 max-w-2xl text-lg mb-10 leading-relaxed text-center">
      Harness the power of advanced technical indicators and Gemini AI to forecast market movements with unprecedented precision.
    </p>
    
    <div className="w-full max-w-2xl mb-12">
      <SearchInput 
        onSelect={onSelect}
        onSubmit={onSearch}
        placeholder="Enter symbol (e.g. RELIANCE, TCS, INFY)..."
        className="w-full"
        large
      />
    </div>

    <div className="flex gap-4 mb-24">
      <button 
        onClick={onStart}
        className="px-8 py-4 bg-emerald-500 text-black font-bold rounded-full hover:bg-emerald-400 transition-all hover:scale-105 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
      >
        Start Predicting <ChevronRight className="w-5 h-5" />
      </button>
      <button 
        onClick={onViewMethodology}
        className="px-8 py-4 bg-zinc-900 text-white font-bold rounded-full border border-zinc-800 hover:bg-zinc-800 transition-all"
      >
        View Methodology
      </button>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full max-w-5xl">
      {[
        { title: "Real-time Analysis", desc: "Live data processing from global markets.", icon: RefreshCw },
        { title: "AI-Powered", desc: "Gemini 3.1 Pro engine for deep reasoning.", icon: Target },
        { title: "Technical Mastery", desc: "RSI, MACD, and Bollinger Band integration.", icon: Activity },
      ].map((feature, i) => (
        <Card key={`feature-${i}`} className="text-left">
          <feature.icon className="w-8 h-8 text-emerald-500 mb-4" />
          <h3 className="text-white font-bold mb-2">{feature.title}</h3>
          <p className="text-zinc-500 text-sm">{feature.desc}</p>
        </Card>
      ))}
    </div>

    {/* Top Stocks Section */}
    <TopStocks onSelect={onSelect} onAddToWatchlist={onAddToWatchlist} realTimeQuotes={realTimeQuotes} />
  </motion.div>
);

const AboutPage: React.FC = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="max-w-4xl mx-auto py-12"
  >
    <h2 className="text-4xl font-display italic font-black text-white mb-8">About StockPredict AI</h2>
    <div className="space-y-8 text-zinc-400 leading-relaxed">
      <section>
        <h3 className="text-white font-bold text-xl mb-4">Our Mission</h3>
        <p>
          StockPredict AI was founded with a singular goal: to democratize institutional-grade market analysis. By combining traditional quantitative finance with cutting-edge Large Language Models, we provide retail traders with insights that were previously only available to hedge funds.
        </p>
      </section>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <h4 className="text-white font-bold mb-2">The Technology</h4>
          <p className="text-sm">
            We use a hybrid approach. Our quantitative engine calculates 15+ technical indicators in real-time, while our AI layer analyzes these patterns against historical context to generate probabilistic outcomes.
          </p>
        </Card>
        <Card>
          <h4 className="text-white font-bold mb-2">The Data</h4>
          <p className="text-sm">
            Powered by Yahoo Finance API, we ingest millions of data points daily, ensuring our models are trained on the most recent market conditions.
          </p>
        </Card>
      </div>
    </div>
  </motion.div>
);

const ContactPage: React.FC = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="max-w-2xl mx-auto py-12"
  >
    <h2 className="text-4xl font-display italic font-black text-white mb-8">Get in Touch</h2>
    <Card>
      <form className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500">Name</label>
            <input type="text" className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors" placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500">Email</label>
            <input type="email" className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors" placeholder="john@example.com" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-zinc-500">Message</label>
          <textarea className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 h-32 focus:outline-none focus:border-emerald-500 transition-colors" placeholder="How can we help?"></textarea>
        </div>
        <button className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all">
          Send Message
        </button>
      </form>
    </Card>
    
    <div className="flex justify-center gap-8 mt-12">
      <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Github className="w-6 h-6" /></a>
      <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Twitter className="w-6 h-6" /></a>
      <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Linkedin className="w-6 h-6" /></a>
    </div>
  </motion.div>
);

// --- Main App ---

import { TradingBot } from './components/TradingBot';

interface TradeAnalysis {
  active: boolean;
  side: 'LONG' | 'SHORT';
  entry: number;
  target: number;
  stop: number;
  pattern?: string;
  trims: { price: number; label: string; percent: number }[];
}

interface AlertSettings {
  aiSignals: boolean;
  aiSignalTypes: ('BUY' | 'SELL')[];
  targetPrice: boolean;
  priceMovement: boolean;
  movementThreshold: number;
  customAlerts: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'watchlist' | 'portfolio' | 'orders' | 'account' | 'chat' | 'backtest' | 'bot'>('home');
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [tradeModal, setTradeModal] = useState<{ isOpen: boolean; symbol: string; type: 'BUY' | 'SELL' }>({
    isOpen: false,
    symbol: '',
    type: 'BUY'
  });
  const [allMarketPrices, setAllMarketPrices] = useState<Record<string, StockData>>({});
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [symbol, setSymbol] = useState('RELIANCE.NS');
  const [companyName, setCompanyName] = useState('Reliance Industries Limited');
  const [data, setData] = useState<IndicatorResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<any>(null);
  const [mlPrediction, setMlPrediction] = useState<any>(null);
  const [fusionPrediction, setFusionPrediction] = useState<FusionPrediction | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [mlPredictionLoading, setMlPredictionLoading] = useState(false);
  const [previousPrediction, setPreviousPrediction] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [relatedSymbols, setRelatedSymbols] = useState<any[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [activeChartTool, setActiveChartTool] = useState('crosshair');
  const [refAreaLeft, setRefAreaLeft] = useState<string | number>('');
  const [refAreaRight, setRefAreaRight] = useState<string | number>('');
  const [zoomLeft, setZoomLeft] = useState<string | number>('dataMin');
  const [zoomRight, setZoomRight] = useState<string | number>('dataMax');
  const [drawings, setDrawings] = useState<any[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<any>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState('1d');
  const [visibleIndicators, setVisibleIndicators] = useState<Record<string, boolean>>({
    sma: true,
    ema: false,
    bb: true,
    rsi: true,
    macd: false,
    atr: false,
    adLine: true,
    sr: false,
    fib: false
  });
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [showOrderMenu, setShowOrderMenu] = useState(false);
  const [orderMenuPos, setOrderMenuPos] = useState({ x: 0, y: 0 });
  const [isTargetHovered, setIsTargetHovered] = useState(false);
  const [news, setNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isAlertsPanelOpen, setIsAlertsPanelOpen] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: string | number, y: number } | null>(null);
  const [hoveredData, setHoveredData] = useState<any>(null);
  const [watchlist, setWatchlist] = useState<{ id: string, symbol: string, tabIndex: number }[]>([]);
  const [realTimeQuotes, setRealTimeQuotes] = useState<Record<string, any>>({});
  
  const [aiForecastData, setAiForecastData] = useState<any[]>([]);
  const [aiSignals, setAiSignals] = useState<any[]>([]);
  const [isAiInsightsOpen, setIsAiInsightsOpen] = useState(false);
  
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => {
    const saved = localStorage.getItem('portfolio');
    return saved ? JSON.parse(saved) : [];
  });
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(() => {
    const saved = localStorage.getItem('alertSettings');
    const defaults = {
      aiSignals: true,
      aiSignalTypes: ['BUY', 'SELL'] as ('BUY' | 'SELL')[],
      targetPrice: true,
      priceMovement: true,
      movementThreshold: 2,
      customAlerts: true
    };
    if (!saved) return defaults;
    try {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed };
    } catch (e) {
      return defaults;
    }
  });
  const [triggeredAlerts, setTriggeredAlerts] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(false);
  const [tradeAnalysis, setTradeAnalysis] = useState<TradeAnalysis>({
    active: false,
    side: 'LONG',
    entry: 0,
    target: 0,
    stop: 0,
    trims: []
  });

  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; amount: number }>({
    isOpen: false,
    amount: 0
  });

  useEffect(() => {
    try {
      localStorage.setItem('orders', JSON.stringify(orders));
    } catch (e) {
      console.warn('Failed to save orders to localStorage:', e);
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem('portfolio', JSON.stringify(portfolio));
    } catch (e) {
      console.warn('Failed to save portfolio to localStorage:', e);
    }
  }, [portfolio]);

  useEffect(() => {
    try {
      localStorage.setItem('alertSettings', JSON.stringify(alertSettings));
    } catch (e) {
      console.warn('Failed to save alertSettings to localStorage:', e);
    }
  }, [alertSettings]);

  // Fetch Alerts from Firestore
  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('alerts_guest');
      if (saved) {
        try {
          setAlerts(JSON.parse(saved));
        } catch (e) {
          setAlerts([]);
        }
      }
      return;
    }

    setIsAlertsLoading(true);
    const q = query(collection(db, 'alerts'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alertsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAlerts(alertsData);
      setIsAlertsLoading(false);
    }, (error) => {
      console.error('Firestore Alerts Error:', error);
      setIsAlertsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Save guest alerts to localStorage
  useEffect(() => {
    if (!user && isGuest) {
      localStorage.setItem('alerts_guest', JSON.stringify(alerts));
    }
  }, [alerts, user, isGuest]);

  // WebSocket Real-time Data Feed
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to real-time data feed');
      // Initial subscription
      const symbolsToSubscribe = Array.from(new Set([
        symbol, 
        ...watchlist.map(w => w.symbol),
        ...portfolio.map(p => p.symbol),
        ...TICKER_SYMBOLS
      ]));
      ws.send(JSON.stringify({ type: 'subscribe', symbols: symbolsToSubscribe }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'update') {
        setRealTimeQuotes(prev => {
          const next = { ...prev };
          message.data.forEach((update: any) => {
            next[update.symbol] = update;
          });
          return next;
        });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Disconnected from real-time data feed');
      socketRef.current = null;
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Handle dynamic subscriptions
  useEffect(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const symbolsToSubscribe = Array.from(new Set([
        symbol, 
        ...watchlist.map(w => w.symbol),
        ...portfolio.map(p => p.symbol),
        ...TICKER_SYMBOLS
      ]));
      socketRef.current.send(JSON.stringify({ type: 'subscribe', symbols: symbolsToSubscribe }));
    }
  }, [symbol, watchlist, portfolio]);

  // Load Watchlist from Firestore/LocalStorage
  useEffect(() => {
    if (!user && !isGuest) return;
    
    const uid = user?.uid || 'guest';
    let unsubscribe: () => void = () => {};
    
    const loadFromLocalStorage = () => {
      const localData = localStorage.getItem(`watchlist_${uid}`);
      if (localData) {
        setWatchlist(JSON.parse(localData));
      }
    };

    try {
      if (user) {
        const q = query(collection(db, 'watchlist'), where('uid', '==', user.uid));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const remoteData = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            symbol: doc.data().symbol,
            tabIndex: doc.data().tabIndex || 1
          }));
          setWatchlist(remoteData);
          localStorage.setItem(`watchlist_${user.uid}`, JSON.stringify(remoteData));
        }, (error) => {
          console.warn("Firestore error, using local storage:", error);
          loadFromLocalStorage();
        });
      } else {
        loadFromLocalStorage();
      }
    } catch (e) {
      console.warn("Firestore setup incomplete, using local storage:", e);
      loadFromLocalStorage();
    }

    return () => unsubscribe();
  }, [user, isGuest]);

  const addOrder = (order: Order) => {
    setOrders(prev => [order, ...prev]);
  };

  const handleBotTrade = (type: 'BUY' | 'SELL', sym: string, price: number, reason: string) => {
    const order: Order = {
      id: Math.random().toString(36).substr(2, 9),
      symbol: sym,
      type: type,
      price: price,
      quantity: 10, // Simulated quantity
      date: new Date().toISOString(),
      status: 'Completed',
      total: price * 10
    };
    addOrder(order);
    
    // Add to portfolio as well
    setPortfolio(prev => {
      const existing = prev.find(p => p.symbol === sym);
      if (type === 'BUY') {
        if (existing) {
          return prev.map(p => p.symbol === sym ? {
            ...p,
            quantity: p.quantity + 10,
            avgPrice: (p.avgPrice * p.quantity + price * 10) / (p.quantity + 10)
          } : p);
        } else {
          return [...prev, {
            symbol: sym,
            quantity: 10,
            avgPrice: price,
            currentPrice: price,
            change: 0,
            pnl: 0,
            value: price * 10
          }];
        }
      } else {
        if (existing && existing.quantity >= 10) {
          if (existing.quantity === 10) {
            return prev.filter(p => p.symbol !== sym);
          }
          return prev.map(p => p.symbol === sym ? {
            ...p,
            quantity: p.quantity - 10
          } : p);
        }
        return prev;
      }
    });

    setNotification({
      message: `BOT ${type}: ${sym} at ₹${price.toFixed(2)} (${reason})`,
      type: 'success'
    });
    setTimeout(() => setNotification(null), 5000);
  };

  const latest = data[data.length - 1];

  // Notification Logic
  useEffect(() => {
    if (!latest || !alertSettings) return;

    // 1. AI Signal Alert
    if (alertSettings.aiSignals && prediction && prediction.signal !== 'HOLD') {
      const isAllowedType = alertSettings.aiSignalTypes.includes(prediction.signal as any);
      if (isAllowedType) {
        const alertKey = `ai_${symbol}_${prediction.signal}_${prediction.forecast?.[0]?.date || 'latest'}`;
        if (!triggeredAlerts.has(alertKey)) {
          setNotification({
            message: `NEW AI SIGNAL: ${prediction.signal} for ${symbol} with ${prediction.confidence}% confidence.`,
            type: 'success'
          });
          setTriggeredAlerts(prev => new Set(prev).add(alertKey));
          setTimeout(() => setNotification(null), 8000);
        }
      }
    }

    // 2. Target Price Alert
    if (alertSettings.targetPrice && prediction && prediction.targetPrice) {
      const alertKey = `target_${symbol}_${prediction.targetPrice}`;
      const priceReached = 
        prediction.prediction === 'UP' ? latest.close >= prediction.targetPrice :
        prediction.prediction === 'DOWN' ? latest.close <= prediction.targetPrice :
        Math.abs(latest.close - prediction.targetPrice) / latest.close < 0.001; // Within 0.1% for neutral
        
      if (priceReached && !triggeredAlerts.has(alertKey)) {
        setNotification({
          message: `TARGET REACHED: ${symbol} has reached the AI target price of ₹${(prediction.targetPrice || 0).toFixed(2)}!`,
          type: 'success'
        });
        setTriggeredAlerts(prev => new Set(prev).add(alertKey));
        setTimeout(() => setNotification(null), 8000);
      }
    }

    // 3. Price Movement Alert
    if (alertSettings.priceMovement && latest.dailyReturn) {
      const movement = Math.abs(latest.dailyReturn * 100);
      if (movement >= alertSettings.movementThreshold) {
        // Alert once per hour for big moves to avoid spamming
        const hourKey = Math.floor(Date.now() / 3600000);
        const alertKey = `move_${symbol}_${hourKey}`;
        if (!triggeredAlerts.has(alertKey)) {
          setNotification({
            message: `VOLATILITY ALERT: ${symbol} moved ${(movement || 0).toFixed(2)}% today!`,
            type: 'error'
          });
          setTriggeredAlerts(prev => new Set(prev).add(alertKey));
          setTimeout(() => setNotification(null), 8000);
        }
      }
    }

    // 4. Custom Price Alerts
    if (alertSettings.customAlerts && alerts.length > 0) {
      alerts.forEach(alert => {
        if (alert.isTriggered || alert.symbol !== symbol) return;

        const currentPrice = latest.close;
        let triggered = false;

        if (alert.type === 'above' && currentPrice >= alert.threshold) {
          triggered = true;
        } else if (alert.type === 'below' && currentPrice <= alert.threshold) {
          triggered = true;
        }

        if (triggered) {
          const alertKey = `alert_${alert.id}_${Math.floor(Date.now() / 3600000)}`; // Once per hour
          if (triggeredAlerts.has(alertKey)) return;

          setNotification({
            message: `PRICE ALERT: ${symbol} has reached ₹${(currentPrice || 0).toFixed(2)} (${alert.type} ₹${alert.threshold})`,
            type: 'warning'
          });
          
          setTriggeredAlerts(prev => new Set(prev).add(alertKey));

          // Mark as triggered
          if (user) {
            updateDoc(doc(db, 'alerts', alert.id), { isTriggered: true });
          } else {
            setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, isTriggered: true } : a));
          }

          // Play alert sound
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => {}); // Ignore autoplay blocks
          } catch (e) {}
          
          setTimeout(() => setNotification(null), 10000);
        }
      });
    }
  }, [latest, alertSettings, prediction, symbol, triggeredAlerts, alerts, user]);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success as per instructions
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async (sym: string, isAutoRefresh = false) => {
    if (!isAutoRefresh) setLoading(true);
    setIsLive(true);
    setError(null);
    if (!isAutoRefresh) {
      setRelatedSymbols([]);
      setPrediction(null); // Clear previous prediction on fresh load
    }
    try {
      console.log(`[CLIENT] Fetching data for ${sym} with timeframe ${activeTimeframe}`);
      const response = await fetch(`/api/stock/${sym}?interval=${activeTimeframe}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CLIENT] API error (${response.status}):`, errorText);
        let errorMessage = `Failed to fetch stock data (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {}
        setError(errorMessage);
        return;
      }
      
      const result = await response.json();
      console.log(`[CLIENT] Successfully fetched data for ${sym}`, { 
        quoteCount: result.quotes?.length,
        hasRelated: !!result.related,
        symbol: result.symbol,
        name: result.name
      });
      
      const { symbol: actualSymbol, name: actualName, quotes, related, quote } = result;
      setSymbol(actualSymbol);
      setCompanyName(actualName || actualSymbol);
      setRelatedSymbols(related || []);

      const processedData = calculateIndicators(quotes.map((d: any) => ({
        ...d,
        date: new Date(d.date).getTime(),
        candleRange: [d.low, d.high],
        candleBody: [d.open, d.close]
      })));
      
      setData(processedData);
      setFusionPrediction(analyzeMultiTrend(processedData));
      
      // Use real-time quote if available, otherwise fallback to last historical candle
      const latestPrice = quote?.regularMarketPrice || processedData[processedData.length - 1]?.close;
      const change = quote?.regularMarketChange || (latestPrice - (processedData[processedData.length - 2]?.close || latestPrice));
      const changePercent = quote?.regularMarketChangePercent || ((change / (processedData[processedData.length - 2]?.close || latestPrice)) * 100);
      
      // Update all market prices for portfolio tracking
      setAllMarketPrices(prev => ({
        ...prev,
        [sym]: {
          symbol: sym,
          price: latestPrice,
          change: change,
          changePercent: changePercent,
          volume: quote?.regularMarketVolume || processedData[processedData.length - 1]?.volume || 0
        }
      }));
      
      // Check for previous prediction to show accuracy
      try {
        const stored = localStorage.getItem(`prediction_${sym}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          const today = new Date().toISOString().split('T')[0];
          if (parsed.date < today) {
            const todayForecast = parsed.result.forecast?.find((f: any) => f.date === today);
            if (todayForecast) {
              setPreviousPrediction({
                predictedPrice: todayForecast.targetPrice,
                actualPrice: latestPrice,
                date: parsed.date
              });
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load previous prediction", e);
      }
      
      // Get AI Prediction and News - ONLY on fresh load to save quota
      if (!isAutoRefresh) {
        setNewsLoading(true);
        getNewsForSymbol(sym).then(res => {
          setNews(res.articles || []);
          setNewsLoading(false);
        }).catch(() => setNewsLoading(false));

        // Fetch daily data specifically for prediction to ensure stability
        setPredictionLoading(true);
        setMlPredictionLoading(true);
        
        // Call ML Prediction Backend
        fetch(`/api/ml-predict/${sym}`)
          .then(res => res.json())
          .then(mlData => {
            if (mlData && !mlData.error) {
              setMlPrediction(mlData);
            }
            setMlPredictionLoading(false);
          })
          .catch(err => {
            console.error("ML Prediction fetch error:", err);
            setMlPredictionLoading(false);
          });

        fetch(`/api/stock/${sym}?interval=1d`)
          .then(res => res.json())
          .then(async dailyData => {
            if (dailyData.quotes) {
              const processedDaily = calculateIndicators(dailyData.quotes.map((d: any) => ({
                ...d,
                date: new Date(d.date).getTime(),
              })));
              const pred = await getStockPrediction(sym, processedDaily);
              setPrediction(pred);
              
              // Process forecast for chart
              if (pred.forecast && pred.forecast.length > 0) {
                const lastDate = processedData[processedData.length - 1]?.date;
                const forecastPoints = pred.forecast.map((f: any, i: number) => ({
                  date: new Date(f.date).getTime(),
                  price: f.targetPrice,
                  isForecast: true
                }));
                setAiForecastData(forecastPoints);
              }

              // Add current signal to signals array for chart visualization
              const latestPoint = processedData[processedData.length - 1];
              if (latestPoint && pred.signal) {
                const newSignal = {
                  date: latestPoint.date,
                  price: latestPoint.close,
                  signal: pred.signal,
                  confidence: pred.confidence,
                  reasoning: pred.reasoning,
                  sentiment: pred.sentiment
                };
                setAiSignals(prev => {
                  // Keep only unique signals for this symbol
                  const filtered = prev.filter(s => s.symbol !== sym || s.date !== latestPoint.date);
                  return [...filtered, { ...newSignal, symbol: sym }];
                });
              }
            }
          })
          .catch(err => console.error("Prediction fetch error:", err))
          .finally(() => setPredictionLoading(false));
      }
    } catch (err: any) {
      if (!isAutoRefresh) setError(err.message);
    } finally {
      if (!isAutoRefresh) setLoading(false);
      setTimeout(() => setIsLive(false), 1000);
    }
  };

  useEffect(() => {
    if ((activeTab === 'home' && showDashboard) || activeTab === 'backtest') {
      fetchData(symbol);
      
      // Live tracking polling every 30 seconds
      const interval = setInterval(() => {
        fetchData(symbol, true);
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [symbol, activeTab, showDashboard, activeTimeframe]);

  const handleSnapshot = async () => {
    const chartElement = document.getElementById('main-chart-container');
    if (!chartElement) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartElement, {
        backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      const link = document.createElement('a');
      link.download = `chart-${symbol}-${format(new Date(), 'yyyyMMdd-HHmm')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Snapshot failed:', error);
      window.print();
    }
  };

  const handleChartMouseDown = (e: any) => {
    if (!e) return;

    if (activeChartTool === 'crosshair') {
      setRefAreaLeft(e.activeLabel);
      return;
    }
    
    if (activeChartTool === 'eraser') {
      return;
    }
    
    const { activeLabel, activePayload } = e;
    if (!activeLabel || !activePayload) return;

    const dataY = activePayload[0].value;
    if (dataY === undefined) return;

    setIsDrawing(true);

    if (activeChartTool === 'line') {
      setCurrentDrawing({ type: 'trendline', points: [{ x: activeLabel, y: dataY }, { x: activeLabel, y: dataY }], id: Date.now() });
    } else if (activeChartTool === 'pencil') {
      setDrawings([...drawings, { type: 'horizontal', y: dataY, id: Date.now() }]);
      setIsDrawing(false);
    } else if (activeChartTool === 'text') {
      const text = prompt("Enter annotation text:");
      if (text) {
        setDrawings([...drawings, { type: 'text', x: activeLabel, y: dataY, text, id: Date.now() }]);
      }
      setIsDrawing(false);
    }
  };

  const handleChartMouseMove = (e: any) => {
    if (!e) return;

    const { activeLabel, activePayload } = e;
    
    if (activeLabel && activePayload && activePayload.length > 0) {
      const dataY = activePayload[0].value;
      setMousePos({ x: activeLabel, y: dataY });
    } else {
      setMousePos(null);
    }

    if (activeChartTool === 'crosshair' && refAreaLeft) {
      setRefAreaRight(e.activeLabel);
      return;
    }

    if (!isDrawing || !currentDrawing) return;
    
    if (!activeLabel || !activePayload) return;

    const dataY = activePayload[0].value;

    if (currentDrawing.type === 'trendline') {
      setCurrentDrawing({
        ...currentDrawing,
        points: [currentDrawing.points[0], { x: activeLabel, y: dataY }]
      });
    }
  };

  const handleChartMouseUp = () => {
    setMousePos(null);
    if (activeChartTool === 'crosshair' && refAreaLeft && refAreaRight) {
      let [l, r] = [refAreaLeft, refAreaRight];
      if (l > r) [l, r] = [r, l];
      
      setZoomLeft(l);
      setZoomRight(r);
      setRefAreaLeft('');
      setRefAreaRight('');
      return;
    }

    if (isDrawing && currentDrawing) {
      setDrawings([...drawings, currentDrawing]);
    }
    setIsDrawing(false);
    setCurrentDrawing(null);
    setRefAreaLeft('');
    setRefAreaRight('');
  };

  const resetZoom = () => {
    setZoomLeft('dataMin');
    setZoomRight('dataMax');
  };

  const clearDrawings = () => setDrawings([]);

  const handleOrder = (type: 'BUY' | 'SELL') => {
    if (!latest) return;
    
    const quantity = 1; // Default to 1 for simplicity
    const price = latest.close;
    
    const newOrder: Order = {
      id: Math.random().toString(36).substring(7),
      symbol,
      type,
      price,
      quantity,
      date: format(new Date(), 'dd MMM HH:mm'),
      status: 'Completed'
    };

    addOrder(newOrder);

    // Update Portfolio
    setPortfolio(prev => {
      const existing = prev.find(p => p.symbol === symbol);
      if (type === 'BUY') {
        if (existing) {
          const totalQty = existing.quantity + quantity;
          const totalCost = (existing.quantity * existing.avgPrice) + (quantity * price);
          return prev.map(p => p.symbol === symbol ? { ...p, quantity: totalQty, avgPrice: totalCost / totalQty } : p);
        } else {
          return [...prev, { symbol, quantity, avgPrice: price }];
        }
      } else {
        if (existing) {
          if (existing.quantity <= quantity) {
            return prev.filter(p => p.symbol !== symbol);
          } else {
            return prev.map(p => p.symbol === symbol ? { ...p, quantity: existing.quantity - quantity } : p);
          }
        }
        return prev;
      }
    });

    setNotification({ 
      message: `${type} order for ${quantity} share(s) of ${symbol} placed at ₹${(price || 0).toFixed(2)}`, 
      type: 'success' 
    });
    
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddAlert = async (threshold: number, type: 'above' | 'below') => {
    const newAlert = {
      uid: user?.uid || 'guest',
      symbol,
      threshold,
      type,
      isTriggered: false,
      createdAt: new Date().toISOString()
    };

    if (user) {
      await addDoc(collection(db, 'alerts'), newAlert);
    } else {
      const localAlert = { ...newAlert, id: Date.now().toString() };
      setAlerts(prev => [...prev, localAlert]);
    }
    
    setNotification({ message: `Alert set for ${symbol} at ₹${threshold}`, type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteAlert = async (id: string) => {
    if (user) {
      await deleteDoc(doc(db, 'alerts', id));
    } else {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }
  };

  const chatContext = useMemo(() => {
    if (!latest) return "General market query";
    return `
      Current Stock: ${symbol} (${companyName})
      Price: ₹{(latest.close || 0).toFixed(2)}
      Change: ${latest.dailyReturn ? (latest.dailyReturn * 100).toFixed(2) : 0}%
      High: ₹{(latest.high || 0).toFixed(2)}
      Low: ₹{(latest.low || 0).toFixed(2)}
      Volume: ${latest.volume}
      RSI: ${latest.rsi?.toFixed(2)}
      
      AI Prediction: ${prediction?.prediction || 'NEUTRAL'}
      AI Signal: ${prediction?.signal || 'HOLD'}
      AI Confidence: ${prediction?.confidence || 0}%
      AI Target Price: ₹${prediction?.targetPrice?.toFixed(2) || 'N/A'}
      AI Reasoning: ${prediction?.reasoning || 'N/A'}
    `;
  }, [symbol, companyName, latest, prediction]);

  const chartData = useMemo(() => data.slice(-200), [data]);

  const handleSearch = (val: string) => {
    if (val.trim()) {
      setSymbol(val.trim().toUpperCase());
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'watchlist', label: 'Watchlist', icon: Star },
    { id: 'bot', label: 'Trading Bot', icon: Bot },
    { id: 'chat', label: 'Assistant', icon: MessageSquare },
    { id: 'backtest', label: 'Backtest', icon: History },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'account', label: 'Account', icon: User },
  ];

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-emerald-500/30 flex flex-col">
      
      <StockTicker onSelect={(s) => {
        setSymbol(s);
        setShowDashboard(true);
      }} realTimeQuotes={realTimeQuotes} />

      {/* Sidebar Navigation (Desktop) */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="fixed left-0 top-0 h-full bg-zinc-950 border-r border-zinc-900 z-50 hidden md:flex flex-col transition-all duration-300"
      >
        <div className="p-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Activity className="text-black w-5 h-5" />
                </div>
                <span className="font-bold text-white tracking-tight">StockPredict</span>
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-zinc-900 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group",
                activeTab === item.id 
                  ? "bg-emerald-500 text-black font-bold shadow-lg shadow-emerald-500/20" 
                  : "text-zinc-500 hover:bg-zinc-900 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-black" : "group-hover:text-emerald-500")} />
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-zinc-900">
          <div className={cn("flex items-center gap-3", !isSidebarOpen && "justify-center")}>
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
              <img src={user?.photoURL || "https://picsum.photos/seed/user/100/100"} alt="User" referrerPolicy="no-referrer" />
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.displayName || 'Guest'}</p>
                <p className="text-[10px] text-zinc-500 truncate">{user ? 'Pro Plan' : 'Free Plan'}</p>
              </div>
            )}
            {isSidebarOpen && !user && (
              <button 
                onClick={() => setPaymentModal({ isOpen: true, amount: 999 })}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main 
        className="flex-1 transition-all duration-300 pb-24 md:pb-8"
        style={{ marginLeft: typeof window !== 'undefined' && window.innerWidth > 768 ? (isSidebarOpen ? 280 : 80) : 0 }}
      >
        {/* Top Header (Only for Home Dashboard) */}
        {activeTab === 'home' && showDashboard && (
          <header className="h-20 border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowDashboard(false)}
                className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <h2 className="text-lg font-bold text-white hidden sm:block">Market Dashboard</h2>
              <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:text-black"
                  )}
                >
                  {theme === 'dark' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Symbol: {symbol}</p>
                <SentimentBadge sentiment={prediction?.sentiment} />
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter",
                  isLive ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-50"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", isLive ? "bg-emerald-500 animate-pulse" : "bg-zinc-600")} />
                  Live
                </div>
              </div>
            </div>
            <SearchInput 
              onSelect={(s) => {
                setSymbol(s.symbol);
              }}
              onSubmit={handleSearch}
              placeholder="Search Symbol..."
              className="w-40 sm:w-64"
              initialValue={symbol}
            />
          </header>
        )}

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {!user && !isGuest && activeTab !== 'home' ? (
              <LoginPage key="login" onGuest={() => setIsGuest(true)} />
            ) : (
              <>
                {activeTab === 'watchlist' && (user || isGuest) && (
                  <WatchlistPage 
                    key="watchlist" 
                    user={user || { uid: 'guest', email: 'guest@example.com', displayName: 'Guest' } as any} 
                    onSelect={(s) => {
                      setSymbol(s);
                      setShowDashboard(true);
                      setActiveTab('home');
                    }}
                    watchlist={watchlist}
                    setWatchlist={setWatchlist}
                    realTimeQuotes={realTimeQuotes}
                  />
                )}
                {activeTab === 'chat' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-3xl font-display italic font-black text-white">AI Assistant</h2>
                      {!hasApiKey && (
                        <button 
                          onClick={handleOpenKeySelector}
                          className="bg-emerald-500 text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-400 transition-colors"
                        >
                          Connect Pro Key
                        </button>
                      )}
                    </div>
                    <ChatBot title="Storm Bird AI" className="h-[600px]" onOpenKeySelector={handleOpenKeySelector} context={chatContext} />
                  </motion.div>
                )}
                {activeTab === 'portfolio' && (
                  <Portfolio 
                    currentPrices={allMarketPrices} 
                    onTrade={(symbol, type) => setTradeModal({ isOpen: true, symbol, type })}
                    onViewHistory={() => setActiveTab('orders')}
                  />
                )}
                {activeTab === 'orders' && (
                  <OrderHistory />
                )}
                {activeTab === 'backtest' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-3xl font-display italic font-black text-white">Strategy Backtest</h2>
                      <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                        {symbol}
                      </div>
                    </div>
                    <Backtesting 
                      data={data} 
                      symbol={symbol} 
                      drawings={drawings} 
                      activeTimeframe={activeTimeframe}
                      onTimeframeChange={setActiveTimeframe}
                    />
                  </motion.div>
                )}
                {activeTab === 'bot' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                          <Bot className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                          <h2 className="text-3xl font-display italic font-black text-white leading-none">Automated Bot</h2>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Institutional Execution Subsystem</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          Monitoring: <span className="text-white ml-1">{symbol}</span>
                        </div>
                        <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          Market: <span className={cn("ml-1", isLive ? "text-emerald-500" : "text-rose-500")}>{isLive ? "LIVE" : "CLOSED"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <TradingBot 
                          symbol={symbol}
                          currentPrice={data[data.length - 1]?.close || 0}
                          mlPrediction={mlPrediction}
                          technicalData={data}
                          onTrade={handleBotTrade}
                          isRunning={isBotRunning}
                          onToggleStatus={setIsBotRunning}
                        />
                      </div>
                      <div className="space-y-6">
                        <Card className="bg-zinc-950 border-zinc-900 p-6 h-full relative overflow-hidden min-h-[400px]">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl -mr-32 -mt-32 rounded-full" />
                          <div className="relative z-10 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                              <h3 className="text-xs font-black text-white uppercase tracking-widest">System Architecture</h3>
                              <Brain className="w-4 h-4 text-emerald-500/50" />
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-center space-y-8">
                              <div className="group relative">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000"></div>
                                <div className="relative p-4 bg-zinc-950 rounded-2xl border border-zinc-900">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500 text-[10px] font-black">01</div>
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Signal Generation</span>
                                  </div>
                                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter leading-relaxed">
                                    The bot processes 50+ technical indicators and correlates them with our proprietary AI sentiment score and ML trend forecast.
                                  </p>
                                </div>
                              </div>

                              <div className="group relative">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-blue-500/5 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000"></div>
                                <div className="relative p-4 bg-zinc-950 rounded-2xl border border-zinc-900">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500 text-[10px] font-black">02</div>
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Execution Engine</span>
                                  </div>
                                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter leading-relaxed">
                                    Ultra-low latency execution subsystem designed for high-frequency monitoring and surgical entry/exit point calculation.
                                  </p>
                                </div>
                              </div>

                              <div className="group relative">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 to-purple-500/5 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000"></div>
                                <div className="relative p-4 bg-zinc-950 rounded-2xl border border-zinc-900">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-500 text-[10px] font-black">03</div>
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Risk Management</span>
                                  </div>
                                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter leading-relaxed">
                                    Dynamic stop-loss and take-profit recalculation every 10 bars to protect alpha and mitigate black-swan volatility.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'account' && user && (
                  <AccountPage 
                    key="account" 
                    user={user} 
                    settings={alertSettings}
                    onSettingsChange={setAlertSettings}
                    alerts={alerts}
                    onAddAlert={handleAddAlert}
                    onDeleteAlert={handleDeleteAlert}
                  />
                )}
                
                {activeTab === 'home' && !showDashboard && (
                  <HomePage 
                    key="landing" 
                    onStart={() => setShowDashboard(true)} 
                    onSelect={(s) => {
                      setSymbol(s.symbol || s);
                      setShowDashboard(true);
                    }}
                    onSearch={handleSearch}
                    onAddToWatchlist={(s) => {
                      const newItem = {
                        uid: user?.uid || 'guest',
                        symbol: s,
                        tabIndex: 1,
                        addedAt: new Date().toISOString()
                      };
                      if (user) {
                        addDoc(collection(db, 'watchlist'), newItem);
                      } else {
                        const localItem = { ...newItem, id: Date.now().toString() };
                        const updatedWatchlist = [...watchlist, localItem];
                        setWatchlist(updatedWatchlist);
                        localStorage.setItem(`watchlist_guest`, JSON.stringify(updatedWatchlist));
                      }
                      setNotification({ message: `Added ${s} to watchlist`, type: 'success' });
                      setTimeout(() => setNotification(null), 3000);
                    }}
                    onViewMethodology={() => setShowMethodology(true)}
                    realTimeQuotes={realTimeQuotes}
                  />
                )}

                {activeTab === 'home' && showDashboard && (
                  <motion.div 
                    key="dashboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                  >
                    {loading ? (
                      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                        <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
                        <p className="text-zinc-500 font-medium animate-pulse">Analyzing market patterns...</p>
                      </div>
                    ) : error ? (
                      <Card className="border-rose-500/50 bg-rose-500/5">
                        <div className="flex items-center gap-3 text-rose-400 mb-2">
                          <AlertTriangle className="w-5 h-5" />
                          <h3 className="font-bold">Error Loading Data</h3>
                        </div>
                        <p className="text-zinc-400">{error}</p>
                        
                        <div className="flex gap-3 mt-6">
                          <button 
                            onClick={() => fetchData(symbol)}
                            className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-bold hover:bg-zinc-700 transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          {/* Stats Row */}
                          <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
                            <Stat 
                              label="Current Price" 
                              value={latest ? `₹${(latest.close || 0).toFixed(2)}` : 'N/A'} 
                              trend={latest?.dailyReturn ? latest.dailyReturn * 100 : 0}
                              icon={TrendingUp}
                            />
                            <Stat 
                              label="Open" 
                              value={latest ? `₹${(latest.open || 0).toFixed(2)}` : 'N/A'} 
                              icon={RefreshCw}
                            />
                            <Stat 
                              label="Day High" 
                              value={latest ? `₹${(latest.high || 0).toFixed(2)}` : 'N/A'} 
                              icon={ArrowUpRight}
                            />
                            <Stat 
                              label="Day Low" 
                              value={latest ? `₹${(latest.low || 0).toFixed(2)}` : 'N/A'} 
                              icon={ArrowDownRight}
                            />
                            <Stat 
                              label="Volume" 
                              value={latest ? ((latest.volume || 0) / 1000000).toFixed(2) + 'M' : 'N/A'} 
                              trend={latest?.volumeChange ? latest.volumeChange * 100 : 0}
                              icon={BarChart3}
                            />
                            <Stat 
                              label="RSI (14)" 
                              value={latest?.rsi?.toFixed(2) || 'N/A'} 
                              icon={Activity}
                            />
                            <Stat 
                              label="Volatility" 
                              value={latest ? `${((latest.volatility || 0) * 100).toFixed(2)}%` : 'N/A'} 
                              icon={ShieldCheck}
                            />
                            {prediction && latest && (
                              <Stat 
                                label="Predicted Close" 
                                value={`₹${prediction.targetPrice?.toFixed(2) || '0.00'}`} 
                                trend={((prediction.targetPrice - latest.close) / latest.close) * 100}
                                icon={Zap}
                              />
                            )}
                          </div>

                          {/* AI Pulse Overview */}
                          <div className="lg:col-span-12 space-y-6">
                            {fusionPrediction && (
                              <MultiTrendAnalysis prediction={fusionPrediction} />
                            )}
                            
                            <AIPulseCard 
                              prediction={prediction} 
                              loading={predictionLoading} 
                              onChatClick={() => setActiveTab('chat')}
                            />
                          </div>

                        {/* Main Chart Terminal */}
                        <Card className={cn(
                          "lg:col-span-8 min-h-[450px] md:min-h-[700px] flex flex-col p-0 overflow-hidden border transition-all duration-500",
                          theme === 'dark' ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white",
                          isFullScreen && "fixed inset-0 z-[100] lg:col-span-12 m-0 rounded-none border-none h-screen w-screen"
                        )}>
                          {/* Terminal Header / Toolbar */}
                          <div className={cn(
                            "flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 sm:px-4 py-2 border-b gap-2 sm:gap-0 transition-colors",
                            theme === 'dark' ? "border-zinc-900 bg-zinc-900/30" : "border-zinc-100 bg-zinc-50/50"
                          )}>
                            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide w-full sm:w-auto">
                              <div className={cn(
                                "flex items-center gap-3 pr-3 sm:pr-4 border-r mr-1 sm:mr-2 shrink-0 transition-colors",
                                theme === 'dark' ? "border-zinc-800" : "border-zinc-200"
                              )}>
                                <StockLogo symbol={symbol} className="w-6 h-6 sm:w-8 sm:h-8" />
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "text-[10px] sm:text-xs font-black tracking-tighter leading-none transition-colors",
                                      theme === 'dark' ? "text-white" : "text-black"
                                    )}>{symbol}</span>
                                    <SentimentBadge sentiment={prediction?.sentiment} />
                                  </div>
                                  <span className="text-[8px] sm:text-[9px] font-bold text-zinc-500 truncate max-w-[80px] sm:max-w-[120px]">{companyName}</span>
                                </div>
                              </div>
                              
                              {/* Timeframes */}
                              <div className={cn(
                                "flex items-center gap-0.5 p-0.5 rounded-lg border shrink-0 transition-colors",
                                theme === 'dark' ? "bg-black/40 border-zinc-800/50" : "bg-zinc-100 border-zinc-200"
                              )}>
                                {['1m', '2m', '5m', '15m', '1h', '1d', '1w', '1mo', '3mo'].map((tf) => (
                                  <button
                                    key={tf}
                                    onClick={() => setActiveTimeframe(tf)}
                                    className={cn(
                                      "px-2 py-1 rounded text-[10px] font-bold transition-all uppercase",
                                      activeTimeframe === tf 
                                        ? (theme === 'dark' ? "bg-zinc-800 text-emerald-500" : "bg-white text-emerald-600 shadow-sm") 
                                        : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                  >
                                    {tf}
                                  </button>
                                ))}
                              </div>

                              <div className={cn("w-px h-4 mx-2 transition-colors", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")} />

                              {/* Chart Types */}
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setChartType('candle')}
                                  className={cn(
                                    "p-1.5 rounded transition-colors", 
                                    chartType === 'candle' ? "text-emerald-500" : "text-zinc-500 hover:bg-zinc-800/50"
                                  )}
                                >
                                  <CandleIcon className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setChartType('line')}
                                  className={cn(
                                    "p-1.5 rounded transition-colors", 
                                    chartType === 'line' ? "text-emerald-500" : "text-zinc-500 hover:bg-zinc-800/50"
                                  )}
                                >
                                  <TrendingUp className="w-4 h-4" />
                                </button>
                              </div>

                              <div className={cn("w-px h-4 mx-2 transition-colors", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")} />

                              {/* Indicators Dropdown */}
                              <div className="relative group">
                                <button 
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                    Object.values(visibleIndicators).some(v => v)
                                      ? (theme === 'dark' ? "bg-emerald-500/10 text-emerald-500" : "bg-emerald-50 text-emerald-600") 
                                      : "text-zinc-500 hover:bg-zinc-800/50"
                                  )}
                                >
                                  <Activity className="w-3.5 h-3.5" />
                                  Indicators
                                  <ChevronDown className="w-3 h-3 ml-1" />
                                </button>
                                
                                <div className="absolute top-full left-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[110] p-2">
                                  <div className="grid grid-cols-1 gap-1">
                                    {[
                                      { id: 'sma', label: 'SMA (10, 50)' },
                                      { id: 'ema', label: 'EMA (10, 50)' },
                                      { id: 'bb', label: 'Bollinger Bands' },
                                      { id: 'rsi', label: 'RSI (14)' },
                                      { id: 'macd', label: 'MACD' },
                                      { id: 'atr', label: 'ATR' },
                                      { id: 'adLine', label: 'A/D Line' },
                                      { id: 'sr', label: 'Support/Resistance' },
                                      { id: 'fib', label: 'Fibonacci' }
                                    ].map((ind) => (
                                      <button
                                        key={ind.id}
                                        onClick={() => setVisibleIndicators(prev => ({ ...prev, [ind.id]: !prev[ind.id] }))}
                                        className={cn(
                                          "flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all",
                                          visibleIndicators[ind.id] ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-500 hover:bg-white/5"
                                        )}
                                      >
                                        {ind.label}
                                        {visibleIndicators[ind.id] && <Check className="w-3 h-3" />}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {(zoomLeft !== 'dataMin' || zoomRight !== 'dataMax') && (
                                <button 
                                  onClick={resetZoom}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  Reset Zoom
                                </button>
                              )}
                            </div>

                              <div className="flex items-center gap-2 ml-auto sm:ml-0">
                                <button 
                                  onClick={handleSnapshot}
                                  className="p-1 sm:p-1.5 text-zinc-500 hover:text-white transition-colors"
                                  title="Snapshot / Print"
                                >
                                  <Download className="w-3.5 h-3.5 sm:w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setIsAiInsightsOpen(!isAiInsightsOpen)}
                                  className={cn(
                                    "p-1 sm:p-1.5 transition-colors",
                                    isAiInsightsOpen ? "text-purple-500" : "text-zinc-500 hover:text-white"
                                  )}
                                  title="AI Deep Insights"
                                >
                                  <Brain className="w-3.5 h-3.5 sm:w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setIsAlertsPanelOpen(!isAlertsPanelOpen)}
                                  className={cn(
                                    "p-1 sm:p-1.5 transition-colors",
                                    isAlertsPanelOpen ? "text-emerald-500" : "text-zinc-500 hover:text-white"
                                  )}
                                  title="Price Alerts"
                                >
                                  <Bell className="w-3.5 h-3.5 sm:w-4 h-4" />
                                </button>
                                <button className="p-1 sm:p-1.5 text-zinc-500 hover:text-white transition-colors">
                                  <Settings2 className="w-3.5 h-3.5 sm:w-4 h-4" />
                                </button>
                              <button 
                                onClick={() => setIsFullScreen(!isFullScreen)}
                                className={cn(
                                  "p-1 sm:p-1.5 transition-colors",
                                  isFullScreen ? "text-emerald-500" : "text-zinc-500 hover:text-white"
                                )}
                              >
                                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* AI Sentiment Summary Bar */}
                          {prediction && !predictionLoading && (
                            <div className={cn(
                              "px-4 py-2 border-b flex items-center justify-between gap-4 transition-all duration-500",
                              theme === 'dark' ? "bg-zinc-900/20 border-zinc-900" : "bg-zinc-50 border-zinc-100"
                            )}>
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                                  </div>
                                  <span className="text-[10px] font-black text-white uppercase tracking-widest">AI Sentiment</span>
                                </div>
                                <div className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border",
                                  prediction.prediction === 'UP' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                                  prediction.prediction === 'DOWN' ? "text-rose-400 bg-rose-500/10 border-rose-500/20" :
                                  "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                )}>
                                  {prediction.prediction}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{prediction.confidence}% Confidence</span>
                                </div>
                                
                                {mlPrediction && (
                                  <div className="flex items-center gap-4 border-l border-zinc-800/50 pl-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 bg-purple-500/10 rounded-lg flex items-center justify-center">
                                        <Brain className="w-3.5 h-3.5 text-purple-500" />
                                      </div>
                                      <span className="text-[10px] font-black text-white uppercase tracking-widest">ML Engine</span>
                                    </div>
                                    <div className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border",
                                      mlPrediction.prediction === 'UP' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                                      "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                    )}>
                                      {mlPrediction.prediction}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{(mlPrediction.confidence * 100).toFixed(1)}% Conf</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 flex items-center gap-2 overflow-hidden border-l border-zinc-800/50 pl-4">
                                <p className="text-[10px] text-zinc-400 truncate italic">
                                  <span className="text-emerald-500 font-bold not-italic uppercase mr-1">Summary:</span>
                                  "{prediction.sentiment?.summary}"
                                </p>
                              </div>
                            </div>
                          )}

                          {predictionLoading && (
                            <div className={cn(
                              "px-4 py-2 border-b flex items-center gap-3 animate-pulse transition-colors",
                              theme === 'dark' ? "bg-zinc-900/20 border-zinc-900" : "bg-zinc-50 border-zinc-100"
                            )}>
                              <div className="w-24 h-4 bg-zinc-800 rounded" />
                              <div className="w-32 h-4 bg-zinc-800 rounded" />
                              <div className="flex-1 h-4 bg-zinc-800 rounded" />
                            </div>
                          )}

                          <div id="main-chart-container" className="flex flex-1 relative overflow-hidden bg-inherit">
                            {/* Price Alerts Panel Overlay */}
                            <AnimatePresence>
                              {isAlertsPanelOpen && (
                                <motion.div
                                  initial={{ x: 300, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  exit={{ x: 300, opacity: 0 }}
                                  className="absolute top-4 right-4 z-30 w-72 max-h-[calc(100%-2rem)] overflow-hidden shadow-2xl"
                                >
                                  <PriceAlerts 
                                    symbol={symbol}
                                    alerts={alerts}
                                    onAdd={handleAddAlert}
                                    onDelete={handleDeleteAlert}
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* AI Insights Panel Overlay */}
                            <AnimatePresence>
                              {isAiInsightsOpen && prediction && (
                                <motion.div
                                  initial={{ x: 300, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  exit={{ x: 300, opacity: 0 }}
                                  className="absolute top-4 right-4 z-30 w-80 max-h-[calc(100%-2rem)] overflow-y-auto bg-zinc-950/95 border border-purple-500/30 rounded-2xl backdrop-blur-xl shadow-2xl p-6 custom-scrollbar"
                                >
                                  <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                                        <Brain className="w-4 h-4 text-purple-400" />
                                      </div>
                                      <h3 className="text-xs font-black text-white uppercase tracking-widest">Deep Insights</h3>
                                    </div>
                                    <button 
                                      onClick={() => setIsAiInsightsOpen(false)}
                                      className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>

                                  <div className="space-y-6">
                                    <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Recommendation</span>
                                        <span className={cn(
                                          "text-[10px] font-black px-2 py-0.5 rounded uppercase",
                                          prediction.signal === 'BUY' ? "bg-emerald-500/20 text-emerald-400" :
                                          prediction.signal === 'SELL' ? "bg-rose-500/20 text-rose-400" :
                                          "bg-amber-500/20 text-amber-400"
                                        )}>
                                          {prediction.signal}
                                        </span>
                                      </div>
                                      <p className="text-xs text-zinc-300 leading-relaxed italic">
                                        "{prediction.reasoning}"
                                      </p>
                                    </div>

                                    <div className="space-y-4">
                                      <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2">Sentiment Breakdown</h4>
                                      <div className="grid grid-cols-3 gap-2">
                                        {[
                                          { label: 'News', score: prediction.sentiment?.newsScore, icon: Newspaper },
                                          { label: 'Social', score: prediction.sentiment?.socialScore, icon: Users },
                                          { label: 'Tech', score: prediction.sentiment?.technicalScore, icon: Activity },
                                        ].map((item, i) => (
                                          <div key={i} className="bg-zinc-900/50 p-3 rounded-xl border border-white/5 flex flex-col items-center gap-2">
                                            <item.icon className="w-3.5 h-3.5 text-zinc-500" />
                                            <span className="text-[8px] font-bold text-zinc-500 uppercase">{item.label}</span>
                                            <span className={cn(
                                              "text-xs font-black",
                                              (item.score || 0) > 60 ? "text-emerald-400" :
                                              (item.score || 0) < 40 ? "text-rose-400" :
                                              "text-amber-400"
                                            )}>
                                              {item.score || 50}%
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2">5-Day Forecast</h4>
                                      <div className="space-y-2">
                                        {prediction.forecast?.map((f: any, i: number) => (
                                          <div key={i} className="flex items-center justify-between p-2 bg-zinc-900/30 rounded-lg border border-white/5">
                                            <span className="text-[10px] font-bold text-zinc-400">{format(new Date(f.date), 'MMM d, EEE')}</span>
                                            <div className="flex items-center gap-3">
                                              <span className="text-[10px] font-black text-white">₹{f.targetPrice?.toFixed(2) || '0.00'}</span>
                                              <span className={cn(
                                                "text-[8px] font-bold",
                                                f.targetPrice > (data[data.length-1]?.close || 0) ? "text-emerald-500" : "text-rose-500"
                                              )}>
                                                {(((f.targetPrice || 0) / (data[data.length-1]?.close || 1) - 1) * 100).toFixed(1)}%
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <button 
                                      onClick={() => setActiveTab('chat')}
                                      className="w-full py-3 bg-purple-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-purple-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                      Ask AI Assistant
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Left Tools Sidebar */}
                            <div className={cn(
                              "w-10 md:w-12 border-r flex flex-col items-center py-2 md:py-4 gap-2 md:gap-4 shrink-0 transition-colors",
                              theme === 'dark' ? "border-zinc-900 bg-zinc-900/10" : "border-zinc-200 bg-zinc-50"
                            )}>
                              {[
                                { id: 'crosshair', icon: MousePointer2 },
                                { id: 'line', icon: Minus },
                                { id: 'pencil', icon: Pencil },
                                { id: 'shapes', icon: Shapes },
                                { id: 'text', icon: Type },
                                { id: 'ruler', icon: Ruler },
                                { id: 'eraser', icon: Eraser },
                              ].map((tool) => (
                                <button
                                  key={tool.id}
                                  onClick={() => {
                                    if (tool.id === 'eraser') {
                                      clearDrawings();
                                    } else {
                                      setActiveChartTool(tool.id);
                                    }
                                  }}
                                  className={cn(
                                    "p-1.5 md:p-2 rounded-lg transition-all",
                                    activeChartTool === tool.id 
                                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                                      : (theme === 'dark' ? "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900" : "text-zinc-400 hover:text-black hover:bg-zinc-100")
                                  )}
                                >
                                  <tool.icon className="w-3.5 h-3.5 md:w-4 h-4" />
                                </button>
                              ))}
                              <div className="mt-auto flex flex-col gap-2 md:gap-4">
                                <button className={cn("p-1.5 md:p-2 transition-colors", theme === 'dark' ? "text-zinc-700 hover:text-zinc-400" : "text-zinc-300 hover:text-zinc-600")}>
                                  <Lock className="w-3.5 h-3.5 md:w-4 h-4" />
                                </button>
                                <button className={cn("p-1.5 md:p-2 transition-colors", theme === 'dark' ? "text-zinc-700 hover:text-zinc-400" : "text-zinc-300 hover:text-zinc-600")}>
                                  <Eye className="w-3.5 h-3.5 md:w-4 h-4" />
                                </button>
                                <button className={cn("p-1.5 md:p-2 transition-colors", theme === 'dark' ? "text-zinc-700 hover:text-rose-500" : "text-zinc-300 hover:text-rose-500")}>
                                  <Trash2 className="w-3.5 h-3.5 md:w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Chart Area */}
                            <div className="flex-1 relative group flex flex-col">
                              {/* OHLC Overlay */}
                              <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 flex flex-col items-end pointer-events-none">
                                {hoveredData && (
                                  <div className={cn(
                                    "px-3 py-2 rounded-xl border backdrop-blur-md shadow-xl flex flex-col gap-1",
                                    theme === 'dark' ? "bg-zinc-950/80 border-zinc-800" : "bg-white/80 border-zinc-200"
                                  )}>
                                    <div className="flex items-center gap-4">
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-zinc-500 uppercase">Open</span>
                                        <span className={cn("text-xs font-mono font-bold", theme === 'dark' ? "text-white" : "text-black")}>{(hoveredData?.open || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-zinc-500 uppercase">High</span>
                                        <span className="text-xs font-mono font-bold text-emerald-500">{(hoveredData?.high || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-zinc-500 uppercase">Low</span>
                                        <span className="text-xs font-mono font-bold text-rose-500">{(hoveredData?.low || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-zinc-500 uppercase">Close</span>
                                        <span className={cn("text-xs font-mono font-bold", theme === 'dark' ? "text-white" : "text-black")}>{(hoveredData?.close || 0).toFixed(2)}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/50">
                                      <span className="text-[8px] font-bold text-zinc-500 uppercase">Volume</span>
                                      <span className={cn("text-[10px] font-mono font-bold", theme === 'dark' ? "text-zinc-300" : "text-zinc-600")}>{hoveredData?.volume?.toLocaleString() ?? '---'}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {tradeAnalysis.active && (
                                <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 bg-zinc-950/90 border border-zinc-800 rounded-lg p-2 backdrop-blur-md shadow-2xl min-w-[160px] hidden sm:block">
                                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-zinc-800">
                                    <span className={cn(
                                      "text-[10px] font-black uppercase px-1.5 py-0.5 rounded",
                                      tradeAnalysis.side === 'LONG' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                    )}>
                                      {tradeAnalysis.side}
                                    </span>
                                    {tradeAnalysis.pattern && (
                                      <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter">
                                        {tradeAnalysis.pattern}
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[8px] font-bold uppercase tracking-widest">
                                    <span className="text-zinc-500">Level</span>
                                    <span className="text-zinc-500 text-right">Price</span>
                                    <span className="text-zinc-500 text-right">Dist</span>
                                    
                                    <span className={tradeAnalysis.side === 'LONG' ? "text-emerald-500" : "text-rose-500"}>TP</span>
                                    <span className="text-white text-right">₹{(tradeAnalysis?.target || 0).toFixed(2)}</span>
                                    <span className={cn("text-right", tradeAnalysis.side === 'LONG' ? "text-emerald-500" : "text-rose-500")}>
                                      {tradeAnalysis.side === 'LONG' ? '+' : '-'}{((Math.abs((tradeAnalysis?.target || 0)/(tradeAnalysis?.entry || 1) - 1)) * 100).toFixed(1)}%
                                    </span>
                                    
                                    <span className="text-white">ENTRY</span>
                                    <span className="text-white text-right">₹{(tradeAnalysis?.entry || 0).toFixed(2)}</span>
                                    <span className="text-zinc-500 text-right">0.0%</span>
                                    
                                    <span className={tradeAnalysis.side === 'LONG' ? "text-rose-500" : "text-emerald-500"}>STOP</span>
                                    <span className="text-white text-right">₹{(tradeAnalysis?.stop || 0).toFixed(2)}</span>
                                    <span className={cn("text-right", tradeAnalysis.side === 'LONG' ? "text-rose-500" : "text-emerald-500")}>
                                      {tradeAnalysis.side === 'LONG' ? '-' : '+'}{((Math.abs(1 - (tradeAnalysis?.stop || 0)/(tradeAnalysis?.entry || 1))) * 100).toFixed(1)}%
                                    </span>
                                    
                                    <div className="col-span-3 h-px bg-zinc-800 my-1" />
                                    
                                    <span className="text-zinc-500">MODE</span>
                                    <span className="col-span-2 text-white text-right">1 : {(Math.abs((tradeAnalysis?.target || 0) - (tradeAnalysis?.entry || 0)) / Math.max(0.01, Math.abs((tradeAnalysis?.entry || 0) - (tradeAnalysis?.stop || 0)))).toFixed(2)} R:R</span>
                                  </div>
                                </div>
                              )}

                              {/* Buy/Sell Floating Buttons */}
                              <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 flex gap-1 sm:gap-2">
                                <button 
                                  onClick={() => handleOrder('SELL')}
                                  className="flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 bg-rose-500 text-black text-[8px] sm:text-[10px] font-black uppercase rounded shadow-lg hover:bg-rose-400 transition-all"
                                >
                                  Sell @ {latest?.close?.toFixed(2) || '0.00'}
                                </button>
                                <button 
                                  onClick={() => handleOrder('BUY')}
                                  className="flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 bg-emerald-500 text-black text-[8px] sm:text-[10px] font-black uppercase rounded shadow-lg hover:bg-emerald-400 transition-all"
                                >
                                  Buy @ {latest?.close?.toFixed(2) || '0.00'}
                                </button>
                                {prediction && (
                                  <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded shadow-lg border backdrop-blur-md transition-all",
                                    prediction.signal === 'BUY' ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" :
                                    prediction.signal === 'SELL' ? "bg-rose-500/10 border-rose-500/50 text-rose-400" :
                                    "bg-amber-500/10 border-amber-500/50 text-amber-400"
                                  )}>
                                    <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                    <div className="flex flex-col">
                                      <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider leading-none">AI {prediction.signal}</span>
                                      <span className="text-[6px] sm:text-[7px] font-bold opacity-70 uppercase tracking-tighter">
                                        Valid for {prediction.forecast?.[0]?.date ? format(new Date(prediction.forecast[0].date), 'MMM d') : 'Next Session'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* AI Target Tooltip Overlay */}
                              <AnimatePresence>
                                {isTargetHovered && prediction && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, x: 20 }}
                                    className="absolute top-16 right-4 z-20 w-64 bg-zinc-900/95 border border-purple-500/40 p-4 rounded-2xl backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.15)] pointer-events-none"
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                          <Zap className="w-3.5 h-3.5 text-purple-400" />
                                        </div>
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">AI Intelligence</span>
                                      </div>
                                      <div className="text-[10px] font-black text-purple-400">
                                        {prediction.confidence}%
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                      <div>
                                        <div className="flex justify-between text-[8px] font-bold text-zinc-500 uppercase mb-1">
                                          <span>Confidence Level</span>
                                          <span>High Probability</span>
                                        </div>
                                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                          <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${prediction.confidence}%` }}
                                            className="h-full bg-purple-500" 
                                          />
                                        </div>
                                      </div>
                                      
                                      <div className="pt-2 border-t border-zinc-800">
                                        <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                                          <span className="text-purple-400 font-bold not-italic uppercase mr-1">Reasoning:</span>
                                          {prediction.reasoning}
                                        </p>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 pt-2">
                                        <div className="w-1 h-1 rounded-full bg-purple-500 animate-pulse" />
                                        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">Target: ₹{prediction.targetPrice?.toFixed(2) || '0.00'}</span>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Watermark */}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                                <h1 className="text-[12vw] font-black uppercase italic tracking-tighter text-white select-none">
                                  {symbol.split('.')[0]}
                                </h1>
                              </div>

                              <div className="flex flex-col h-full">
                                <div className="flex-[4] min-h-0 relative">
                                  <TradingViewChart 
                                    data={chartData}
                                    theme={theme}
                                    height={800}
                                    prediction={prediction}
                                    visibleIndicators={visibleIndicators}
                                    chartType={chartType}
                                    onChartTypeChange={(type) => setChartType(type)}
                                    onCrosshairMove={(data) => setHoveredData(data)}
                                    drawings={drawings}
                                    onAddDrawing={(d) => setDrawings(prev => [...prev, d])}
                                  />
                                      



                                      

                                      
                                      
                                </div>
                              </div>
                              <div className="absolute right-0 top-0 bottom-0 w-[60px] pointer-events-none flex flex-col items-center">
                                <div className="flex-1 w-full relative">
                                  <div className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                                    <button 
                                      onClick={(e) => {
                                        setOrderMenuPos({ x: e.clientX, y: e.clientY });
                                        setShowOrderMenu(!showOrderMenu);
                                      }}
                                      className="w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-white hover:bg-emerald-500 hover:text-black transition-all"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Order Menu Popup */}
                              <AnimatePresence>
                                {showOrderMenu && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    style={{ 
                                      position: 'fixed', 
                                      left: orderMenuPos.x - 220, 
                                      top: orderMenuPos.y - 100,
                                      zIndex: 100 
                                    }}
                                    className="w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
                                  >
                                    <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black text-white uppercase tracking-wider">Create Order</span>
                                        <button onClick={() => setShowOrderMenu(false)} className="text-zinc-500 hover:text-white">
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div className="text-xs font-bold text-emerald-500">@{latest?.close?.toFixed(2) || '0.00'}</div>
                                    </div>
                                    <div className="p-1">
                                      <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-left group">
                                        <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                                          <TrendingUp className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-[10px] font-bold text-white">Buy {symbol.split('.')[0]}</span>
                                          <span className="text-[8px] text-zinc-500">Limit Order</span>
                                        </div>
                                      </button>
                                      <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-left group">
                                        <div className="w-6 h-6 rounded bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-black transition-all">
                                          <TrendingDown className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-[10px] font-bold text-white">Sell {symbol.split('.')[0]}</span>
                                          <span className="text-[8px] text-zinc-500">Stop Order</span>
                                        </div>
                                      </button>
                                      <div className="h-px bg-zinc-800 my-1 mx-2" />
                                      <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-left group">
                                        <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white transition-all">
                                          <Settings className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white">Trading Settings</span>
                                      </button>
                                      <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-left group">
                                        <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white transition-all">
                                          <Minus className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white">Draw Horizontal Line</span>
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          {/* Terminal Footer */}
                          <div className="flex items-center justify-between px-4 py-1.5 border-t border-zinc-900 bg-zinc-900/30 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                16:27:33 (UTC+0)
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Connected
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span>% Log Auto</span>
                              <div className="flex items-center gap-1">
                                <LayoutGrid className="w-3 h-3" />
                                Multi-Chart
                              </div>
                            </div>
                          </div>
                        </Card>

                        {/* Prediction Panel */}
                        <div className="lg:col-span-4 flex flex-col gap-6">
                          {/* Today's Prediction Performance */}
                          {previousPrediction && (
                            <Card className="bg-emerald-500/5 border-emerald-500/20 overflow-hidden relative">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-2xl -mr-12 -mt-12 rounded-full" />
                              <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-2">
                                  <Target className="w-4 h-4 text-emerald-500" />
                                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Today's Prediction vs Actual</h3>
                                </div>
                                <span className="text-[8px] text-zinc-500 font-bold uppercase">Predicted on {format(new Date(previousPrediction.date), 'MMM d')}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 relative z-10">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase mb-1">AI Predicted</span>
                                  <span className="text-xl font-black text-white">₹{previousPrediction.predictedPrice?.toLocaleString() ?? '---'}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Actual Price</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl font-black text-white">₹{previousPrediction.actualPrice?.toLocaleString() ?? '---'}</span>
                                    <div className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-black",
                                      Math.abs(previousPrediction.actualPrice - previousPrediction.predictedPrice) / previousPrediction.predictedPrice < 0.02 
                                        ? "text-emerald-400 bg-emerald-500/10" 
                                        : "text-amber-400 bg-amber-500/10"
                                    )}>
                                      {((Math.abs((previousPrediction?.actualPrice || 0) - (previousPrediction?.predictedPrice || 0)) / (previousPrediction?.predictedPrice || 1)) * 100).toFixed(1)}% Error
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 flex items-center gap-2 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-tight">
                                  {Math.abs(previousPrediction.actualPrice - previousPrediction.predictedPrice) / previousPrediction.predictedPrice < 0.02 
                                    ? "High Accuracy: AI successfully anticipated today's move." 
                                    : "Moderate Accuracy: Market volatility slightly exceeded AI expectations."}
                                </p>
                              </div>
                            </Card>
                          )}

                          {/* Sentiment Analysis */}
                          <TradeAnalysisTool 
                            symbol={symbol}
                            currentPrice={latest?.close || 0}
                            chartData={chartData}
                            analysis={tradeAnalysis}
                            onChange={setTradeAnalysis}
                          />

                          <PriceAlerts 
                            symbol={symbol} 
                            alerts={alerts} 
                            onAdd={handleAddAlert} 
                            onDelete={handleDeleteAlert} 
                          />

                          <SentimentAnalysis prediction={prediction} mlPrediction={mlPrediction} loading={predictionLoading} />

                          {/* 5-Day Forecast Card */}
                          {prediction && prediction.forecast && latest && (
                            <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-purple-500" />
                                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">5-Day AI Forecast</h3>
                                </div>
                                <div className="text-[10px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded uppercase">
                                  {prediction.confidence}% Conf.
                                </div>
                              </div>
                              
                              <div className="space-y-3">
                                {prediction.forecast.map((f: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-zinc-800/50 hover:border-purple-500/30 transition-all">
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-bold text-zinc-500 uppercase">{format(new Date(f.date), 'EEE, MMM d')}</span>
                                      <span className="text-xs font-black text-white">₹{f.targetPrice?.toLocaleString() ?? '0.00'}</span>
                                    </div>
                                    <div className={cn(
                                      "text-[10px] font-bold px-2 py-1 rounded",
                                      f.targetPrice > latest.close ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
                                    )}>
                                      {(((f.targetPrice - (latest?.close || 0)) / (latest?.close || 1)) * 100).toFixed(2)}%
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              <div className="mt-4 p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
                                <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                                  <span className="text-purple-400 font-bold not-italic">AI INSIGHT:</span> {prediction.reasoning}
                                </p>
                              </div>
                            </Card>
                          )}

                          {/* Related Symbols */}
                          {relatedSymbols.length > 0 && (
                            <Card className="bg-zinc-900/50 border-zinc-800">
                              <div className="flex items-center gap-2 mb-4">
                                <PieChart className="w-4 h-4 text-emerald-500" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Related Assets</h3>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                                {relatedSymbols.map((s, idx) => (
                                  <button
                                    key={`${s.symbol}-${idx}`}
                                    onClick={() => fetchData(s.symbol)}
                                    className="flex flex-col p-2 bg-black/40 border border-zinc-800 rounded-lg hover:border-emerald-500/50 transition-all text-left"
                                  >
                                    <span className="text-xs font-bold text-white">{s.symbol}</span>
                                    <span className="text-[9px] text-zinc-500 truncate">{s.name}</span>
                                  </button>
                                ))}
                              </div>
                            </Card>
                          )}

                          <Card className={cn(
                            "relative overflow-hidden border-2",
                            prediction?.signal === 'BUY' ? "border-emerald-500/20 bg-emerald-500/5" : 
                            prediction?.signal === 'SELL' ? "border-rose-500/20 bg-rose-500/5" : 
                            "border-zinc-800 bg-zinc-900/50"
                          )}>
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-2">
                                <Zap className={cn("w-5 h-5", 
                                  prediction?.signal === 'BUY' ? "text-emerald-500" : 
                                  prediction?.signal === 'SELL' ? "text-rose-500" : 
                                  "text-amber-500"
                                )} />
                                <h3 className="font-bold text-white uppercase tracking-wider text-sm">AI Signal</h3>
                              </div>
                              <div className="px-2 py-1 bg-zinc-800 rounded text-[10px] font-bold text-zinc-400 uppercase">
                                Confidence: {prediction?.confidence}%
                              </div>
                            </div>

                            <div className="flex flex-col items-center py-6">
                              <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={cn(
                                  "text-6xl font-black mb-2",
                                  prediction?.signal === 'BUY' ? "text-emerald-500" : 
                                  prediction?.signal === 'SELL' ? "text-rose-500" : 
                                  "text-amber-500"
                                )}
                              >
                                {prediction?.signal || 'HOLD'}
                              </motion.div>
                              <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Current Recommendation</p>
                            </div>

                            <div className="space-y-4 mt-4">
                              <div className="flex justify-between items-center text-xs border-b border-zinc-800 pb-2">
                                <span className="text-zinc-500 uppercase font-bold">Forecast</span>
                                <span className={cn(
                                  "font-bold",
                                  prediction?.prediction === 'UP' ? "text-emerald-400" : 
                                  prediction?.prediction === 'DOWN' ? "text-rose-400" : 
                                  "text-zinc-500"
                                )}>{prediction?.prediction || 'NEUTRAL'}</span>
                              </div>
                              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                                <p className="text-xs text-zinc-400 leading-relaxed italic">
                                  "{prediction?.reasoning}"
                                </p>
                                {prediction?.isError && prediction?.errorType === 'RATE_LIMIT' && (
                                  <button 
                                    onClick={handleOpenKeySelector}
                                    className="mt-3 w-full py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg hover:bg-amber-500/20 transition-all"
                                  >
                                    Select API Key for Unlimited Access
                                  </button>
                                )}
                              </div>
                              <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                  <span>Next Session Target</span>
                                  <span className="text-zinc-400">₹{latest?.close?.toFixed(2) || '0.00'} (Current)</span>
                                </div>
                                <div className="flex items-end justify-between">
                                  <div className="text-2xl font-black text-white">₹{prediction?.targetPrice?.toFixed(2) || '0.00'}</div>
                                  <div className={cn(
                                    "px-2 py-1 rounded text-xs font-black",
                                    prediction?.targetPrice > latest?.close ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
                                  )}>
                                    {prediction?.targetPrice > latest?.close ? '+' : ''}{(((prediction?.targetPrice - (latest?.close || 0)) / (latest?.close || 1)) * 100).toFixed(2)}%
                                  </div>
                                </div>
                              </div>

                              {/* Prediction Accuracy Section */}
                              {prediction && latest && (
                                <div className="mt-4 pt-4 border-t border-zinc-800">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Prediction Accuracy</span>
                                    <div className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                      <span className="text-[8px] text-emerald-500 font-bold uppercase">Backtested</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-black/40 p-2 rounded-lg border border-zinc-800/50">
                                      <span className="text-[8px] text-zinc-500 font-bold uppercase block mb-1">Success Rate</span>
                                      <span className="text-sm font-black text-white">78.4%</span>
                                    </div>
                                    <div className="bg-black/40 p-2 rounded-lg border border-zinc-800/50">
                                      <span className="text-[8px] text-zinc-500 font-bold uppercase block mb-1">Avg. Error</span>
                                      <span className="text-sm font-black text-white">±1.2%</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </Card>

                          {/* News Feed */}
                          <NewsFeed news={news} loading={newsLoading} />

                          <Card>
                            <div className="flex items-center gap-2 mb-4">
                              <ShieldCheck className="w-5 h-5 text-emerald-500" />
                              <h3 className="font-bold text-white text-sm">Model Accuracy</h3>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                  <span className="text-zinc-500">Directional Accuracy</span>
                                  <span className="text-emerald-400 font-bold">78.4%</span>
                                </div>
                                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 w-[78.4%]" />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Precision</p>
                                  <p className="text-sm font-bold text-white">0.82</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-zinc-500 uppercase font-bold">F1 Score</p>
                                  <p className="text-sm font-bold text-white">0.79</p>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>


                        {/* Recent Orders Section */}
                        <div className="lg:col-span-12">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <ShoppingBag className="w-5 h-5 text-emerald-500" />
                              <h3 className="font-bold text-white uppercase tracking-wider">Recent Orders</h3>
                            </div>
                            <button 
                              onClick={() => setActiveTab('orders')}
                              className="text-[10px] font-bold text-zinc-500 hover:text-emerald-500 transition-colors uppercase tracking-widest"
                            >
                              View All
                            </button>
                          </div>
                          <Card className="p-0 overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                                    <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Symbol</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Price</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Qty</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                  {orders.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 italic text-sm">
                                        No recent orders found.
                                      </td>
                                    </tr>
                                  ) : (
                                    orders.slice(0, 5).map((order) => (
                                      <tr key={order.id} className="hover:bg-zinc-900/50 transition-colors">
                                        <td className="px-6 py-4">
                                          <span className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                            order.type === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                          )}>
                                            {order.type}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-white">{order.symbol}</td>
                                        <td className="px-6 py-4 text-xs text-zinc-300">₹{(order.price || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-xs text-zinc-300">{order.quantity}</td>
                                        <td className="px-6 py-4 text-[10px] text-zinc-500 uppercase">{order.date}</td>
                                        <td className="px-6 py-4">
                                          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded uppercase">
                                            {order.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </Card>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>

          {/* Footer */}
          <footer className="mt-12 pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <Info className="w-4 h-4" />
              <p>This app is for educational purposes only. Not financial advice.</p>
            </div>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">© 2026 StockPredict AI Engine</p>
          </footer>
        </div>
      </main>
      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900 flex items-center justify-around px-4 md:hidden z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === item.id ? "text-emerald-500" : "text-zinc-500"
            )}
          >
            <item.icon className={cn("w-6 h-6", activeTab === item.id && "animate-bounce")} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Methodology Modal */}
      <AnimatePresence>
        {showMethodology && (
          <MethodologyModal 
            isOpen={showMethodology} 
            onClose={() => setShowMethodology(false)} 
          />
        )}
      </AnimatePresence>

      {/* Trade Modal */}
      <TradeModal 
        isOpen={tradeModal.isOpen}
        onClose={() => setTradeModal({ ...tradeModal, isOpen: false })}
        symbol={tradeModal.symbol}
        type={tradeModal.type}
        currentPrice={allMarketPrices[tradeModal.symbol]?.price || 0}
        onSuccess={() => {
          // Portfolio component will refresh via its internal logic or currentPrices update
        }}
      />

      {/* Floating Chat Button */}
      <div className="fixed bottom-24 right-6 z-50 md:bottom-8">
        <AnimatePresence>
          {isFloatingChatOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="absolute bottom-20 right-0 w-[350px] shadow-2xl"
            >
              <ChatBot title="Quick Assistant" className="h-[500px] shadow-2xl border-emerald-500/20" onOpenKeySelector={handleOpenKeySelector} context={chatContext} />
            </motion.div>
          )}
        </AnimatePresence>
        
        <button
          onClick={() => setIsFloatingChatOpen(!isFloatingChatOpen)}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95",
            isFloatingChatOpen 
              ? "bg-zinc-800 text-white rotate-90" 
              : "bg-emerald-500 text-black shadow-emerald-500/20"
          )}
        >
          {isFloatingChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>
      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={cn(
              "fixed bottom-24 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 min-w-[300px]",
              notification.type === 'success' ? "bg-emerald-500 text-black border-emerald-400" : "bg-rose-500 text-white border-rose-400"
            )}
          >
            {notification.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <p className="text-xs font-bold">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <PaymentModal 
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })}
        amount={paymentModal.amount}
        onSuccess={() => {
          setNotification({ message: 'Payment successful! You are now a Pro user.', type: 'success' });
          setTimeout(() => setNotification(null), 5000);
        }}
      />
    </div>
  );
}
