import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Scatter, ReferenceLine, ReferenceDot, ReferenceArea,
  ComposedChart, Bar, Cell
} from 'recharts';
import { 
  Play, RotateCcw, TrendingUp, TrendingDown, Activity, 
  Target, AlertCircle, BarChart3, Calendar, Wallet, Clock,
  ArrowUpRight, ArrowDownRight, Info, List, Plus, Trash2, ShieldCheck,
  Pencil, Ruler, Type, Eraser, MousePointer2, Download, Maximize2, Minimize2,
  Zap, Minus, Square, Layers, ChevronDown, Check, Brain
} from 'lucide-react';
import { IndicatorResult } from '../utils/indicators';
import { cn } from '../utils/cn';
import { motion, AnimatePresence } from 'motion/react';

import { getStockPrediction } from '../services/geminiService';
import { TradingViewChart } from './TradingViewChart';

interface AISignal {
  date: number;
  price: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  patterns?: string[];
  detailedReasoning?: {
    indicator: string;
    observation: string;
    impact: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    weight: number;
  }[];
  targetPrice: number;
  sentiment?: {
    score: number;
    label: string;
    newsScore: number;
    socialScore: number;
    technicalScore: number;
    summary?: string;
  };
}

interface BacktestingProps {
  data: IndicatorResult[];
  symbol: string;
  drawings?: any[];
  activeTimeframe?: string;
  onTimeframeChange?: (timeframe: string) => void;
}

interface Trade {
  type: 'BUY' | 'SELL';
  date: number;
  price: number;
  amount: number;
  capital: number;
  pnl?: number;
  pnlPercent?: number;
  exitReason?: 'SIGNAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'PARTIAL_TP' | 'TIME_EXIT' | 'MAX_DAILY_LOSS';
}

interface BacktestResult {
  trades: Trade[];
  equityCurve: { date: number, capital: number }[];
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  netProfit: number;
  finalCapital: number;
}

interface Condition {
  id: string;
  indicator: keyof IndicatorResult;
  operator: '>' | '<' | '>=' | '<=' | 'crosses_above' | 'crosses_below';
  value: number | keyof IndicatorResult;
  isConstant: boolean;
  lookback: number;
  logic: 'AND' | 'OR';
}

interface ManualTrendLine {
  id: string;
  startDate: number;
  startPrice: number;
  endDate: number;
  endPrice: number;
  slope: number;
  label: string;
}

export const Backtesting: React.FC<BacktestingProps> = ({ 
  data: rawData, 
  symbol, 
  drawings = [], 
  activeTimeframe = '1d', 
  onTimeframeChange 
}) => {
  const data = useMemo(() => {
    return rawData.map((d, i) => {
      const prev = i > 0 ? rawData[i - 1] : null;
      
      // Volume Change (%)
      const volumeChange = prev && prev.volume !== 0 
        ? ((d.volume - prev.volume) / prev.volume) * 100 
        : 0;
      
      // Volume Delta (Proxy for buying/selling pressure)
      // CLV = (2*Close - High - Low) / (High - Low)
      const range = d.high - d.low;
      const volumeDelta = range !== 0 
        ? d.volume * ((2 * d.close - d.high - d.low) / range)
        : 0;
      
      return {
        ...d,
        volumeChange,
        volumeDelta
      };
    });
  }, [rawData]);

  const [initialCapital, setInitialCapital] = useState(100000);
  const [strategy, setStrategy] = useState<'rsi' | 'sma_cross' | 'macd' | 'custom' | 'support_resistance' | 'trend_line' | 'fibonacci' | 'acc_dist' | 'double_patterns' | 'order_flow'>('rsi');
  const [rsiLower, setRsiLower] = useState(30);
  const [rsiUpper, setRsiUpper] = useState(70);
  const [smaFast, setSmaFast] = useState(10);
  const [smaSlow, setSmaSlow] = useState(50);
  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);
  const [orderFlowThreshold, setOrderFlowThreshold] = useState(0.5); // Imbalance threshold
  const [orderFlowPeriod, setOrderFlowPeriod] = useState(20);
  const [orderFlowMinVolume, setOrderFlowMinVolume] = useState(1.0); // Min volume threshold
  const [orderFlowMinPriceMove, setOrderFlowMinPriceMove] = useState(0.2); // Min price move relative to ATR
  const [manualTrendLines, setManualTrendLines] = useState<ManualTrendLine[]>([]);
  const [stopLoss, setStopLoss] = useState<number>(0); // 0 means disabled
  const [slType, setSlType] = useState<'PERCENT' | 'ATR' | 'TRAILING_ATR'>('PERCENT');
  const [takeProfit, setTakeProfit] = useState<number>(0); // 0 means disabled
  const [tpType, setTpType] = useState<'PERCENT' | 'ATR' | 'RR'>('PERCENT');
  const [trailingStopLoss, setTrailingStopLoss] = useState<number>(0); // 0 means disabled
  const [slAtrMultiplier, setSlAtrMultiplier] = useState(2);
  const [tpAtrMultiplier, setTpAtrMultiplier] = useState(4);
  const [riskRewardRatio, setRiskRewardRatio] = useState(3);
  const [breakevenTrigger, setBreakevenTrigger] = useState(0); // 0 means disabled
  const [breakevenOffset, setBreakevenOffset] = useState(0); // Offset from entry for breakeven
  const [riskPerTrade, setRiskPerTrade] = useState(100); // Default to 100% of capital
  const [partialTakeProfit, setPartialTakeProfit] = useState(0); // 0 means disabled
  const [partialTakeProfitPercent, setPartialTakeProfitPercent] = useState(50); // Sell 50%
  const [maxHoldingBars, setMaxHoldingBars] = useState(0); // 0 means disabled
  const [maxDailyLoss, setMaxDailyLoss] = useState(0); // 0 means disabled
  
  const [entryConditions, setEntryConditions] = useState<Condition[]>([
    { id: '1', indicator: 'rsi', operator: '<', value: 30, isConstant: true, lookback: 0, logic: 'AND' }
  ]);
  const [exitConditions, setExitConditions] = useState<Condition[]>([
    { id: '1', indicator: 'rsi', operator: '>', value: 70, isConstant: true, lookback: 0, logic: 'AND' }
  ]);

  const [results, setResults] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [aiSignals, setAiSignals] = useState<AISignal[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');

  const chartData = useMemo(() => {
    if (!results && aiSignals.length === 0) return data;
    
    return data.map(d => {
      const trade = results?.trades.find(t => t.date === d.date);
      const aiSignal = aiSignals.find(s => s.date === d.date);
      return {
        ...d,
        trade: trade || null,
        aiSignal: aiSignal || null
      };
    });
  }, [data, results, aiSignals]);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: string | number, y: number } | null>(null);

  // Chart Interactivity State
  const [activeChartTool, setActiveChartTool] = useState<'crosshair' | 'trendline' | 'horizontal' | 'text' | 'eraser' | 'rectangle' | 'fib'>('crosshair');
  const [chartDrawings, setChartDrawings] = useState<any[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<any>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<string | number>('');
  const [refAreaRight, setRefAreaRight] = useState<string | number>('');
  const [zoomLeft, setZoomLeft] = useState<string | number>('dataMin');
  const [zoomRight, setZoomRight] = useState<string | number>('dataMax');
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState<number | string | null>(null);
  const [hoveredTrade, setHoveredTrade] = useState<Trade | null>(null);
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

  const handleChartMouseDown = (e: any) => {
    if (!e) return;
    
    const { activeLabel, activePayload } = e;
    if (!activeLabel || !activePayload) return;

    const dataY = activePayload[0].value;
    if (dataY === undefined) return;

    if (activeChartTool === 'crosshair') {
      // Selection logic
      const allDrawings = [...(drawings || []), ...chartDrawings];
      const closest = allDrawings.reverse().find(d => {
        const threshold = dataY * 0.005; // 0.5% sensitivity
        if (d.type === 'horizontal') return Math.abs(d.y - dataY) < threshold;
        if (d.type === 'text') return Math.abs(d.y - dataY) < (dataY * 0.02) && d.x === activeLabel;
        if (d.type === 'trendline') {
          const [p1, p2] = d.points;
          const minX = Math.min(new Date(p1.x).getTime(), new Date(p2.x).getTime());
          const maxX = Math.max(new Date(p1.x).getTime(), new Date(p2.x).getTime());
          const currentX = new Date(activeLabel).getTime();
          
          if (currentX >= minX && currentX <= maxX) {
            const m = (p2.y - p1.y) / (maxX - minX);
            const expectedY = p1.y + m * (currentX - minX);
            return Math.abs(expectedY - dataY) < threshold;
          }
        }
        if (d.type === 'rectangle') {
          const minX = Math.min(new Date(d.x1).getTime(), new Date(d.x2).getTime());
          const maxX = Math.max(new Date(d.x1).getTime(), new Date(d.x2).getTime());
          const minY = Math.min(d.y1, d.y2);
          const maxY = Math.max(d.y1, d.y2);
          const currentX = new Date(activeLabel).getTime();
          return currentX >= minX && currentX <= maxX && dataY >= minY && dataY <= maxY;
        }
        if (d.type === 'fib') {
          const minX = Math.min(new Date(d.x1).getTime(), new Date(d.x2).getTime());
          const maxX = Math.max(new Date(d.x1).getTime(), new Date(d.x2).getTime());
          const currentX = new Date(activeLabel).getTime();
          if (currentX >= minX && currentX <= maxX) {
            return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].some(level => {
              const y = d.y1 + (d.y2 - d.y1) * level;
              return Math.abs(y - dataY) < threshold;
            });
          }
        }
        return false;
      });

      if (closest) {
        setSelectedDrawingId(closest.id);
      } else {
        setSelectedDrawingId(null);
        setRefAreaLeft(e.activeLabel);
      }
      return;
    }
    
    setIsDrawing(true);

    if (activeChartTool === 'trendline') {
      setCurrentDrawing({ type: 'trendline', points: [{ x: activeLabel, y: dataY }, { x: activeLabel, y: dataY }], id: Date.now() });
    } else if (activeChartTool === 'rectangle') {
      setCurrentDrawing({ type: 'rectangle', x1: activeLabel, y1: dataY, x2: activeLabel, y2: dataY, id: Date.now() });
    } else if (activeChartTool === 'fib') {
      setCurrentDrawing({ type: 'fib', x1: activeLabel, y1: dataY, x2: activeLabel, y2: dataY, id: Date.now() });
    } else if (activeChartTool === 'horizontal') {
      setChartDrawings([...chartDrawings, { type: 'horizontal', y: dataY, id: Date.now() }]);
      setIsDrawing(false);
    } else if (activeChartTool === 'text') {
      const text = prompt("Enter annotation text:");
      if (text) {
        setChartDrawings([...chartDrawings, { type: 'text', x: activeLabel, y: dataY, text, id: Date.now() }]);
      }
      setIsDrawing(false);
    } else if (activeChartTool === 'eraser') {
      setChartDrawings(prev => prev.filter(d => {
        const threshold = dataY * 0.005;
        if (d.type === 'horizontal') return Math.abs(d.y - dataY) > threshold;
        if (d.type === 'text') return Math.abs(d.y - dataY) > (dataY * 0.02) || d.x !== activeLabel;
        if (d.type === 'trendline') {
          const [p1, p2] = d.points;
          const minX = Math.min(new Date(p1.x).getTime(), new Date(p2.x).getTime());
          const maxX = Math.max(new Date(p1.x).getTime(), new Date(p2.x).getTime());
          const currentX = new Date(activeLabel).getTime();
          
          if (currentX >= minX && currentX <= maxX) {
            const m = (p2.y - p1.y) / (maxX - minX);
            const expectedY = p1.y + m * (currentX - minX);
            return Math.abs(expectedY - dataY) > threshold;
          }
        }
        if (d.type === 'rectangle') {
          const minX = Math.min(new Date(d.x1).getTime(), new Date(d.x2).getTime());
          const maxX = Math.max(new Date(d.x1).getTime(), new Date(d.x2).getTime());
          const minY = Math.min(d.y1, d.y2);
          const maxY = Math.max(d.y1, d.y2);
          const currentX = new Date(activeLabel).getTime();
          return !(currentX >= minX && currentX <= maxX && dataY >= minY && dataY <= maxY);
        }
        if (d.type === 'fib') {
          const minX = Math.min(new Date(d.x1).getTime(), new Date(d.x2).getTime());
          const maxX = Math.max(new Date(d.x1).getTime(), new Date(d.x2).getTime());
          const currentX = new Date(activeLabel).getTime();
          if (currentX >= minX && currentX <= maxX) {
            const isNear = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].some(level => {
              const y = d.y1 + (d.y2 - d.y1) * level;
              return Math.abs(y - dataY) < threshold;
            });
            return !isNear;
          }
        }
        return true;
      }));
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
    } else if (currentDrawing.type === 'rectangle' || currentDrawing.type === 'fib') {
      setCurrentDrawing({
        ...currentDrawing,
        x2: activeLabel,
        y2: dataY
      });
    }
  };

  const handleSnapshot = async () => {
    const chartElement = document.getElementById('backtest-chart-container');
    if (!chartElement) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#09090b',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      const link = document.createElement('a');
      link.download = `backtest-chart-${format(new Date(), 'yyyyMMdd-HHmm')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Snapshot failed:', error);
      window.print();
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
      setChartDrawings([...chartDrawings, currentDrawing]);
    }
    setIsDrawing(false);
    setCurrentDrawing(null);
    setRefAreaLeft('');
    setRefAreaRight('');
  };

  const handleEquitySnapshot = async () => {
    const chartElement = document.getElementById('equity-chart-container');
    if (!chartElement) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#09090b',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      const link = document.createElement('a');
      link.download = `equity-curve-${format(new Date(), 'yyyyMMdd-HHmm')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Equity snapshot failed:', error);
      window.print();
    }
  };

  const resetZoom = () => {
    setZoomLeft('dataMin');
    setZoomRight('dataMax');
  };

  const clearDrawings = () => setChartDrawings([]);

  const deleteSelectedDrawing = () => {
    if (selectedDrawingId) {
      setChartDrawings(prev => prev.filter(d => d.id !== selectedDrawingId));
      setSelectedDrawingId(null);
    }
  };

  const editSelectedDrawing = () => {
    if (selectedDrawingId) {
      const drawing = chartDrawings.find(d => d.id === selectedDrawingId);
      if (!drawing) return; // Only allow editing local drawings
      
      if (drawing.type === 'text') {
        const newText = prompt("Edit annotation text:", drawing.text);
        if (newText !== null) {
          setChartDrawings(prev => prev.map(d => d.id === selectedDrawingId ? { ...d, text: newText } : d));
        }
      } else if (drawing.type === 'horizontal') {
        const newY = prompt("Edit horizontal price level:", drawing.y);
        if (newY !== null && !isNaN(Number(newY))) {
          setChartDrawings(prev => prev.map(d => d.id === selectedDrawingId ? { ...d, y: Number(newY) } : d));
        }
      }
    }
  };

  const availableIndicators: { label: string, value: keyof IndicatorResult }[] = [
    { label: 'Price (Close)', value: 'close' },
    { label: 'RSI', value: 'rsi' },
    { label: 'SMA 10', value: 'sma10' },
    { label: 'SMA 50', value: 'sma50' },
    { label: 'EMA 10', value: 'ema10' },
    { label: 'EMA 50', value: 'ema50' },
    { label: 'MACD', value: 'macd' },
    { label: 'MACD Signal', value: 'macdSignal' },
    { label: 'MACD Hist', value: 'macdHist' },
    { label: 'BB Upper', value: 'bbUpper' },
    { label: 'BB Lower', value: 'bbLower' },
    { label: 'Support', value: 'support' },
    { label: 'Resistance', value: 'resistance' },
    { label: 'A/D Line', value: 'adLine' },
    { label: 'A/D SMA (20)', value: 'adLineSMA' as any },
    { label: 'Trend Slope', value: 'trendSlope' },
    { label: 'Fib 23.6%', value: 'fib236' },
    { label: 'Fib 38.2%', value: 'fib382' },
    { label: 'Fib 50.0%', value: 'fib500' },
    { label: 'Fib 61.8%', value: 'fib618' },
    { label: 'Fib 78.6%', value: 'fib786' },
    { label: 'Volume Delta', value: 'volumeDelta' as any },
    { label: 'Volume Change (%)', value: 'volumeChange' as any },
    { label: 'Hammer Pattern', value: 'isHammer' as any },
    { label: 'Shooting Star', value: 'isShootingStar' as any },
    { label: 'Bullish Engulfing', value: 'isBullishEngulfing' as any },
    { label: 'Bearish Engulfing', value: 'isBearishEngulfing' as any },
    { label: 'Doji Pattern', value: 'isDoji' as any },
    { label: 'Morning Star', value: 'isMorningStar' as any },
    { label: 'Evening Star', value: 'isEveningStar' as any },
    { label: 'Piercing Line', value: 'isPiercingLine' as any },
    { label: 'Dark Cloud Cover', value: 'isDarkCloudCover' as any },
    { label: 'Tweezer Top', value: 'isTweezerTop' as any },
    { label: 'Tweezer Bottom', value: 'isTweezerBottom' as any },
    { label: 'Double Top', value: 'isDoubleTop' as any },
    { label: 'Double Bottom', value: 'isDoubleBottom' as any },
  ];

  const addCondition = (type: 'entry' | 'exit') => {
    const newCond: Condition = {
      id: Math.random().toString(36).substr(2, 9),
      indicator: 'rsi',
      operator: '>',
      value: 50,
      isConstant: true,
      lookback: 0,
      logic: 'AND'
    };
    if (type === 'entry') setEntryConditions([...entryConditions, newCond]);
    else setExitConditions([...exitConditions, newCond]);
  };

  const removeCondition = (type: 'entry' | 'exit', id: string) => {
    if (type === 'entry') setEntryConditions(entryConditions.filter(c => c.id !== id));
    else setExitConditions(exitConditions.filter(c => c.id !== id));
  };

  const evaluateCondition = (cond: Condition, data: IndicatorResult[], index: number): boolean => {
    const start = Math.max(0, index - cond.lookback);
    
    for (let i = index; i >= start; i--) {
      const current = data[i];
      const prev = i > 0 ? data[i - 1] : undefined;
      
      const val1Raw = current[cond.indicator];
      const val1 = typeof val1Raw === 'boolean' ? (val1Raw ? 1 : 0) : (val1Raw as number);
      
      const val2Raw = cond.isConstant ? cond.value : current[cond.value as keyof IndicatorResult];
      const val2 = typeof val2Raw === 'boolean' ? (val2Raw ? 1 : 0) : (val2Raw as number);
      
      if (val1 === undefined || val2 === undefined) continue;

      let match = false;
      switch (cond.operator) {
        case '>': match = val1 > val2; break;
        case '<': match = val1 < val2; break;
        case '>=': match = val1 >= val2; break;
        case '<=': match = val1 <= val2; break;
        case 'crosses_above':
          if (!prev) break;
          const prevVal1 = prev[cond.indicator] as number;
          const prevVal2 = cond.isConstant ? (cond.value as number) : (prev[cond.value as keyof IndicatorResult] as number);
          match = prevVal1 <= prevVal2 && val1 > val2;
          break;
        case 'crosses_below':
          if (!prev) break;
          const pVal1 = prev[cond.indicator] as number;
          const pVal2 = cond.isConstant ? (cond.value as number) : (prev[cond.value as keyof IndicatorResult] as number);
          match = pVal1 >= pVal2 && val1 < val2;
          break;
      }
      if (match) return true;
    }
    return false;
  };

  const evaluateGroup = (conditions: Condition[], data: IndicatorResult[], index: number): boolean => {
    if (conditions.length === 0) return false;
    let result = evaluateCondition(conditions[0], data, index);
    for (let i = 1; i < conditions.length; i++) {
      const condResult = evaluateCondition(conditions[i], data, index);
      if (conditions[i].logic === 'AND') {
        result = result && condResult;
      } else {
        result = result || condResult;
      }
    }
    return result;
  };

  const generateAISignals = async () => {
    if (!data || data.length < 50) return;
    
    setIsGeneratingAI(true);
    try {
      const signals: AISignal[] = [];
      
      // Get prediction for the latest data
      const latestPrediction = await getStockPrediction(symbol, data);
      if (latestPrediction) {
        signals.push({
          date: data[data.length - 1].date,
          price: data[data.length - 1].close,
          signal: latestPrediction.signal as any,
          confidence: latestPrediction.confidence,
          reasoning: latestPrediction.reasoning,
          patterns: latestPrediction.patterns,
          detailedReasoning: latestPrediction.detailedReasoning,
          targetPrice: latestPrediction.targetPrice,
          sentiment: latestPrediction.sentiment
        });
      }

      // For backtesting visualization, we'll simulate a few more signals 
      // based on more sophisticated technical analysis
      const step = Math.floor(data.length / 8); // More signals for diversity
      for (let i = step; i < data.length - 1; i += step) {
        const historicalData = data.slice(0, i + 1);
        
        // To avoid too many API calls, we'll only do 1 more real one and simulate others
        if (i === step * 3) {
          try {
            const histPred = await getStockPrediction(symbol, historicalData);
            signals.push({
              date: data[i].date,
              price: data[i].close,
              signal: histPred.signal as any,
              confidence: histPred.confidence,
              reasoning: histPred.reasoning,
              patterns: histPred.patterns,
              detailedReasoning: histPred.detailedReasoning,
              targetPrice: histPred.targetPrice,
              sentiment: histPred.sentiment
            });
            continue;
          } catch (e) {
            console.warn("AI Signal generation failed for point", i, e);
          }
        }

        // Sophisticated simulated signal for visualization
        const d = data[i];
        const prev = i > 0 ? data[i - 1] : d;
        
        const rsi = d.rsi || 50;
        const macd = d.macd || 0;
        const macdSignal = d.macdSignal || 0;
        const sma10 = d.sma10 || d.close;
        const sma50 = d.sma50 || d.close;
        const bbUpper = d.bbUpper || d.close * 1.05;
        const bbLower = d.bbLower || d.close * 0.95;
        const volume = d.volume || 0;
        const volumeAvg = d.volumeAvg || volume;
        const support = d.support || d.close * 0.9;
        const resistance = d.resistance || d.close * 1.1;
        const adx = d.adx || 20;
        const plusDI = d.plusDI || 20;
        const minusDI = d.minusDI || 20;
        const stochasticK = d.stochasticK || 50;
        const stochasticD = d.stochasticD || 50;
        const mfi = d.mfi || 50;
        const obv = d.obv || 0;
        const prevObv = prev.obv || 0;
        
        let buyScore = 0;
        let sellScore = 0;
        let reasons: string[] = [];

        // 1. RSI Analysis
        if (rsi < 30) { buyScore += 2; reasons.push("RSI oversold (<30)"); }
        else if (rsi < 40) { buyScore += 1; reasons.push("RSI low momentum"); }
        if (rsi > 70) { sellScore += 2; reasons.push("RSI overbought (>70)"); }
        else if (rsi > 60) { sellScore += 1; reasons.push("RSI high momentum"); }

        // 2. MACD Analysis
        if (macd > macdSignal && prev.macd! <= prev.macdSignal!) { buyScore += 2; reasons.push("MACD bullish crossover"); }
        else if (macd < macdSignal && prev.macd! >= prev.macdSignal!) { sellScore += 2; reasons.push("MACD bearish crossover"); }

        // 3. Moving Average Analysis
        if (sma10 > sma50 && prev.sma10! <= prev.sma50!) { buyScore += 2; reasons.push("Golden Cross (SMA10/50)"); }
        else if (sma10 < sma50 && prev.sma10! >= prev.sma50!) { sellScore += 2; reasons.push("Death Cross (SMA10/50)"); }
        
        // 4. Bollinger Bands Analysis
        if (d.close <= bbLower) { buyScore += 2; reasons.push("Price at lower Bollinger Band"); }
        else if (d.close >= bbUpper) { sellScore += 2; reasons.push("Price at upper Bollinger Band"); }

        // 5. Volume Analysis (OBV & MFI)
        if (obv > prevObv) { buyScore += 1; reasons.push("Positive OBV trend"); }
        else if (obv < prevObv) { sellScore += 1; reasons.push("Negative OBV trend"); }
        
        if (mfi < 20) { buyScore += 2; reasons.push("MFI oversold (<20)"); }
        else if (mfi > 80) { sellScore += 2; reasons.push("MFI overbought (>80)"); }

        // 6. Trend Strength (ADX)
        if (adx > 25) {
          if (plusDI > minusDI) { buyScore += 2; reasons.push("Strong bullish trend (ADX > 25)"); }
          else { sellScore += 2; reasons.push("Strong bearish trend (ADX > 25)"); }
        }

        // 7. Stochastic Oscillator
        if (stochasticK < 20 && stochasticK > stochasticD) { buyScore += 1; reasons.push("Stochastic bullish crossover in oversold"); }
        else if (stochasticK > 80 && stochasticK < stochasticD) { sellScore += 1; reasons.push("Stochastic bearish crossover in overbought"); }

        // 8. Support/Resistance Analysis
        if (Math.abs(d.close - support) / support < 0.01) { buyScore += 1; reasons.push("Bouncing off support"); }
        if (Math.abs(d.close - resistance) / resistance < 0.01) { sellScore += 1; reasons.push("Rejecting resistance"); }

        // 9. Pattern Analysis
        if (d.isDoubleBottom) { buyScore += 3; reasons.push("Double Bottom pattern detected"); }
        if (d.isDoubleTop) { sellScore += 3; reasons.push("Double Top pattern detected"); }

        let aiSignal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 50;
        let targetPrice = d.close;
        
        // Multi-factor Sentiment Simulation
        const newsSentiment = (buyScore - sellScore) / 10 + (Math.random() * 0.4 - 0.2);
        const socialSentiment = (buyScore - sellScore) / 12 + (Math.random() * 0.6 - 0.3);
        const technicalScore = Math.min(100, Math.max(0, 50 + (buyScore - sellScore) * 5));
        const overallSentiment = (newsSentiment + socialSentiment + (technicalScore / 50 - 1)) / 3;
        
        if (overallSentiment > 0.2) buyScore += 2;
        else if (overallSentiment < -0.2) sellScore += 2;

        if (buyScore > sellScore && buyScore >= 2) {
          aiSignal = 'BUY';
          confidence = Math.min(95, 60 + (buyScore * 5));
          targetPrice = d.close * (1 + (confidence / 2000));
        } else if (sellScore > buyScore && sellScore >= 2) {
          aiSignal = 'SELL';
          confidence = Math.min(95, 60 + (sellScore * 5));
          targetPrice = d.close * (1 - (confidence / 2000));
        } else {
          aiSignal = 'HOLD';
          confidence = 40 + Math.random() * 20;
          targetPrice = d.close * (1 + (Math.random() * 0.02 - 0.01));
          reasons = ["Market in consolidation phase", "Conflicting technical signals"];
        }

        // Format reasoning with multi-factor context
        let reasoning = reasons.length > 0 
          ? `${reasons.slice(0, 3).join(". ")} at ₹${(d.close || 0).toFixed(2)}.`
          : `Neutral technical outlook at ₹${(d.close || 0).toFixed(2)}.`;
        
        if (Math.abs(overallSentiment) > 0.3) {
          reasoning += ` ${overallSentiment > 0 ? 'Positive' : 'Negative'} multi-factor sentiment detected.`;
        }

        // Simulate patterns and detailed reasoning for visualization
        const simulatedPatterns: string[] = [];
        if (d.isHammer) simulatedPatterns.push("Hammer");
        if (d.isShootingStar) simulatedPatterns.push("Shooting Star");
        if (d.isBullishEngulfing) simulatedPatterns.push("Bullish Engulfing");
        if (d.isBearishEngulfing) simulatedPatterns.push("Bearish Engulfing");
        if (d.isDoji) simulatedPatterns.push("Doji");
        if (d.isMorningStar) simulatedPatterns.push("Morning Star");
        if (d.isEveningStar) simulatedPatterns.push("Evening Star");
        if (d.isDoubleBottom) simulatedPatterns.push("Double Bottom");
        if (d.isDoubleTop) simulatedPatterns.push("Double Top");

        const simulatedDetailedReasoning: any[] = [
          { 
            indicator: "RSI", 
            observation: rsi < 30 ? "Oversold conditions detected" : rsi > 70 ? "Overbought conditions detected" : "Neutral momentum",
            impact: rsi < 40 ? "BULLISH" : rsi > 60 ? "BEARISH" : "NEUTRAL",
            weight: 25
          },
          {
            indicator: "MACD",
            observation: macd > macdSignal ? "Bullish momentum increasing" : "Bearish momentum increasing",
            impact: macd > macdSignal ? "BULLISH" : "BEARISH",
            weight: 25
          },
          {
            indicator: "Moving Average",
            observation: sma10 > sma50 ? "Short-term trend is positive" : "Short-term trend is negative",
            impact: sma10 > sma50 ? "BULLISH" : "BEARISH",
            weight: 20
          }
        ];

        if (simulatedPatterns.length > 0) {
          simulatedDetailedReasoning.push({
            indicator: "Candlestick",
            observation: `${simulatedPatterns[0]} pattern detected`,
            impact: aiSignal === 'BUY' ? "BULLISH" : aiSignal === 'SELL' ? "BEARISH" : "NEUTRAL",
            weight: 30
          });
        }

        signals.push({
          date: d.date,
          price: d.close,
          signal: aiSignal,
          confidence,
          reasoning,
          patterns: simulatedPatterns,
          detailedReasoning: simulatedDetailedReasoning,
          targetPrice,
          sentiment: {
            score: overallSentiment,
            label: overallSentiment > 0.2 ? 'BULLISH' : overallSentiment < -0.2 ? 'BEARISH' : 'NEUTRAL',
            newsScore: Math.min(100, Math.max(0, 50 + newsSentiment * 50)),
            socialScore: Math.min(100, Math.max(0, 50 + socialSentiment * 50)),
            technicalScore
          }
        });
      }

      setAiSignals(signals);
    } catch (error) {
      console.error("Failed to generate AI signals:", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const runBacktest = () => {
    setIsRunning(true);
    setResults(null);
    setAiSignals([]); // Clear old signals
    
    // Simulate a delay for effect
    setTimeout(() => {
      let capital = initialCapital;
      let position = 0;
      let entryPrice = 0;
      let highestPrice = 0;
      let currentStopLossPrice = 0;
      let entryAtr = 0;
      let isBreakevenTriggered = false;
      let isPartialTPTriggered = false;
      let barsHeld = 0;
      let lastTradeDate: string | null = null;
      let dailyLoss = 0;
      
      const trades: Trade[] = [];
      const equityCurve: { date: number, capital: number }[] = [];

      // Start from the first point where indicators are available
      const startIndex = data.findIndex(d => d.rsi !== undefined || d.sma50 !== undefined);
      if (startIndex === -1) {
        setIsRunning(false);
        return;
      }

      for (let i = startIndex; i < data.length; i++) {
        const current = { ...data[i] } as any;
        const prev = data[i - 1] as any;
        const currentDateStr = format(new Date(current.date), 'yyyy-MM-dd');

        // Reset daily loss if a new day starts
        if (lastTradeDate !== currentDateStr) {
          dailyLoss = 0;
          lastTradeDate = currentDateStr;
        }

        // Check for Max Daily Loss
        if (maxDailyLoss > 0 && dailyLoss >= (capital * (maxDailyLoss / 100))) {
          if (position > 0) {
            const pnl = (current.close - entryPrice) * position;
            capital += pnl;
            dailyLoss += Math.max(0, -pnl);
            trades.push({
              type: 'SELL',
              date: current.date,
              price: current.close,
              amount: position,
              capital: capital,
              pnl: pnl,
              pnlPercent: (current.close - entryPrice) / entryPrice * 100,
              exitReason: 'MAX_DAILY_LOSS'
            });
            position = 0;
          }
          equityCurve.push({ date: current.date, capital: capital });
          continue;
        }

        // Check for SL/TP first if in position
        if (position > 0) {
          barsHeld++;
          
          // Update highest price for trailing stop loss
          if (current.close > highestPrice) {
            highestPrice = current.close;
          }

          const currentPnLPercent = (current.close - entryPrice) / entryPrice * 100;
          const trailingPnLPercent = ((current.close - highestPrice) / highestPrice) * 100;
          
          // Calculate SL/TP prices based on entry price and settings
          let slPrice = currentStopLossPrice;
          let tpPrice = 0;

          // Check for breakeven trigger
          if (breakevenTrigger > 0 && !isBreakevenTriggered && currentPnLPercent >= breakevenTrigger) {
            isBreakevenTriggered = true;
            const newSl = entryPrice * (1 + breakevenOffset / 100);
            currentStopLossPrice = newSl;
            slPrice = newSl;
          }

          if (tpType === 'PERCENT' && takeProfit > 0) {
            tpPrice = entryPrice * (1 + takeProfit / 100);
          } else if (tpType === 'ATR' && tpAtrMultiplier > 0) {
            tpPrice = entryPrice + (entryAtr * tpAtrMultiplier);
          } else if (tpType === 'RR' && slPrice > 0) {
            const risk = entryPrice - slPrice;
            tpPrice = entryPrice + (risk * riskRewardRatio);
          }

          // Partial Take Profit
          if (partialTakeProfit > 0 && !isPartialTPTriggered && currentPnLPercent >= partialTakeProfit) {
            isPartialTPTriggered = true;
            const sellAmount = position * (partialTakeProfitPercent / 100);
            const pnl = (current.close - entryPrice) * sellAmount;
            capital += pnl;
            trades.push({
              type: 'SELL',
              date: current.date,
              price: current.close,
              amount: sellAmount,
              capital: capital,
              pnl: pnl,
              pnlPercent: currentPnLPercent,
              exitReason: 'PARTIAL_TP'
            });
            position -= sellAmount;
          }

          // Max Holding Bars
          if (maxHoldingBars > 0 && barsHeld >= maxHoldingBars) {
            const pnl = (current.close - entryPrice) * position;
            capital += pnl;
            dailyLoss += Math.max(0, -pnl);
            trades.push({
              type: 'SELL',
              date: current.date,
              price: current.close,
              amount: position,
              capital: capital,
              pnl: pnl,
              pnlPercent: currentPnLPercent,
              exitReason: 'TIME_EXIT'
            });
            position = 0;
            highestPrice = 0;
            barsHeld = 0;
            equityCurve.push({ date: current.date, capital: capital });
            continue;
          }

          // Update Trailing ATR Stop Loss if applicable
          if (slType === 'TRAILING_ATR' && slAtrMultiplier > 0 && current.atr) {
            const newSlPrice = current.close - (current.atr * slAtrMultiplier);
            if (newSlPrice > currentStopLossPrice) {
              currentStopLossPrice = newSlPrice;
              slPrice = newSlPrice;
            }
          }
          
          // 1. Trailing Stop Loss
          if (trailingStopLoss > 0 && trailingPnLPercent <= -trailingStopLoss) {
            const pnl = (current.close - entryPrice) * position;
            capital += pnl;
            dailyLoss += Math.max(0, -pnl);
            trades.push({
              type: 'SELL',
              date: current.date,
              price: current.close,
              amount: position,
              capital: capital,
              pnl: pnl,
              pnlPercent: currentPnLPercent,
              exitReason: 'TRAILING_STOP'
            });
            position = 0;
            highestPrice = 0;
            barsHeld = 0;
            equityCurve.push({ date: current.date, capital: capital });
            continue;
          }

          // 2. Standard Stop Loss
          if (slPrice > 0 && current.low <= slPrice) {
            const exitPrice = Math.min(current.open, slPrice); // Handle gap down
            const pnl = (exitPrice - entryPrice) * position;
            capital += pnl;
            dailyLoss += Math.max(0, -pnl);
            trades.push({
              type: 'SELL',
              date: current.date,
              price: exitPrice,
              amount: position,
              capital: capital,
              pnl: pnl,
              pnlPercent: ((exitPrice - entryPrice) / entryPrice) * 100,
              exitReason: 'STOP_LOSS'
            });
            position = 0;
            highestPrice = 0;
            barsHeld = 0;
            equityCurve.push({ date: current.date, capital: capital });
            continue;
          }

          // 3. Take Profit
          if (tpPrice > 0 && current.high >= tpPrice) {
            const exitPrice = Math.max(current.open, tpPrice); // Handle gap up
            const pnl = (exitPrice - entryPrice) * position;
            capital += pnl;
            trades.push({
              type: 'SELL',
              date: current.date,
              price: exitPrice,
              amount: position,
              capital: capital,
              pnl: pnl,
              pnlPercent: ((exitPrice - entryPrice) / entryPrice) * 100,
              exitReason: 'TAKE_PROFIT'
            });
            position = 0;
            highestPrice = 0;
            barsHeld = 0;
            equityCurve.push({ date: current.date, capital: capital });
            continue;
          }
        }

        // Strategy Logic
        let signal: 'BUY' | 'SELL' | null = null;

        if (strategy === 'custom') {
          if (position === 0 && entryConditions.length > 0 && evaluateGroup(entryConditions, data, i)) {
            signal = 'BUY';
          } else if (position > 0 && exitConditions.length > 0 && evaluateGroup(exitConditions, data, i)) {
            signal = 'SELL';
          }
        } else if (strategy === 'rsi') {
          if (position === 0 && current.rsi! < rsiLower) {
            signal = 'BUY';
          } else if (position > 0 && current.rsi! > rsiUpper) {
            signal = 'SELL';
          }
        } else if (strategy === 'sma_cross') {
          const fastSma = data.slice(Math.max(0, i - smaFast), i + 1).reduce((a, b) => a + b.close, 0) / Math.min(i + 1, smaFast);
          const slowSma = data.slice(Math.max(0, i - smaSlow), i + 1).reduce((a, b) => a + b.close, 0) / Math.min(i + 1, smaSlow);
          const prevFastSma = i > 0 ? data.slice(Math.max(0, i - 1 - smaFast), i).reduce((a, b) => a + b.close, 0) / Math.min(i, smaFast) : fastSma;
          const prevSlowSma = i > 0 ? data.slice(Math.max(0, i - 1 - smaSlow), i).reduce((a, b) => a + b.close, 0) / Math.min(i, smaSlow) : slowSma;

          if (position === 0 && prevFastSma <= prevSlowSma && fastSma > slowSma) {
            signal = 'BUY';
          } else if (position > 0 && prevFastSma >= prevSlowSma && fastSma < slowSma) {
            signal = 'SELL';
          }
        } else if (strategy === 'macd') {
          // MACD calculation is complex, assuming indicators are pre-calculated or we use a simplified version for backtest
          // For now, we'll use the pre-calculated macd and macdSignal if they exist, or fallback to default if periods match
          if (position === 0 && prev && prev.macd! <= prev.macdSignal! && current.macd! > current.macdSignal!) {
            signal = 'BUY';
          } else if (position > 0 && prev && prev.macd! >= prev.macdSignal! && current.macd! < current.macdSignal!) {
            signal = 'SELL';
          }
        } else if (strategy === 'support_resistance') {
          if (position === 0 && current.support && current.close <= current.support * 1.01) {
            signal = 'BUY';
          } else if (position > 0 && current.resistance && current.close >= current.resistance * 0.99) {
            signal = 'SELL';
          }
        } else if (strategy === 'trend_line') {
          // Trend Line Strategy Logic (Drawings + Manual)
          const trendLines = [
            ...drawings.filter(d => d.type === 'trendline' && d.points && d.points.length === 2).map(tl => {
              const [p1, p2] = tl.points;
              const x1 = p1.x;
              const y1 = p1.y;
              const x2 = p2.x;
              const y2 = p2.y;
              if (x2 === x1) return null;
              const m = (y2 - y1) / (x2 - x1);
              const c = y1 - m * x1;
              return { m, c, startDate: Math.min(x1, x2), endDate: Math.max(x1, x2) };
            }),
            ...manualTrendLines.map(mtl => {
              return { m: mtl.slope, c: mtl.startPrice - mtl.slope * mtl.startDate, startDate: mtl.startDate, endDate: mtl.endDate };
            })
          ].filter(Boolean);
          
          trendLines.forEach(tl => {
            if (!tl) return;
            const { m, c, startDate, endDate } = tl;
            if (current.date < startDate || (endDate && current.date > endDate)) return;

            // Price on the line at current date
            const linePrice = m * current.date + c;
            const prevLinePrice = prev ? (m * prev.date + c) : linePrice;
            
            const isUpward = m > 0;
            const isDownward = m < 0;
            
            // BUY: Price crosses above an upward trend line
            if (position === 0 && isUpward && prev && prev.close <= prevLinePrice && current.close > linePrice) {
              signal = 'BUY';
            }
            // SELL: Price crosses below a downward trend line
            else if (position > 0 && isDownward && prev && prev.close >= prevLinePrice && current.close < linePrice) {
              signal = 'SELL';
            }
          });
        } else if (strategy === 'fibonacci') {
          if (position === 0 && current.fib618 && current.close <= current.fib618 * 1.01) {
            signal = 'BUY';
          } else if (position > 0 && current.fib236 && current.close >= current.fib236 * 0.99) {
            signal = 'SELL';
          }
        } else if (strategy === 'acc_dist') {
          // BUY: A/D Line crosses above its SMA
          if (position === 0 && prev && prev.adLine && prev.adLineSMA && current.adLine && current.adLineSMA && prev.adLine <= prev.adLineSMA && current.adLine > current.adLineSMA) {
            signal = 'BUY';
          } 
          // SELL: A/D Line crosses below its SMA
          else if (position > 0 && prev && prev.adLine && prev.adLineSMA && current.adLine && current.adLineSMA && prev.adLine >= prev.adLineSMA && current.adLine < current.adLineSMA) {
            signal = 'SELL';
          }
        } else if (strategy === 'double_patterns') {
          if (position === 0 && current.isDoubleBottom) {
            signal = 'BUY';
          } else if (position > 0 && current.isDoubleTop) {
            signal = 'SELL';
          }
        } else if (strategy === 'order_flow') {
          // Order Flow Strategy: Buy when positive delta imbalance, Sell when negative
          const avgVolume = data.slice(Math.max(0, i - orderFlowPeriod), i).reduce((a, b) => a + b.volume, 0) / orderFlowPeriod;
          const deltaImbalance = current.volumeDelta / avgVolume;
          const volumeRatio = current.volume / avgVolume;
          const priceMove = (current.close - current.open) / (current.atr || (current.high - current.low));
          
          if (position === 0 && deltaImbalance > orderFlowThreshold && volumeRatio > orderFlowMinVolume && priceMove > orderFlowMinPriceMove) {
            signal = 'BUY';
          } else if (position > 0 && deltaImbalance < -orderFlowThreshold && volumeRatio > orderFlowMinVolume && priceMove < -orderFlowMinPriceMove) {
            signal = 'SELL';
          }
        }

        // Execute Trades
        if (signal === 'BUY' && position === 0) {
          // Calculate initial stop loss price for position sizing
          let initialSlPrice = 0;
          if (slType === 'PERCENT' && stopLoss > 0) {
            initialSlPrice = current.close * (1 - stopLoss / 100);
          } else if ((slType === 'ATR' || slType === 'TRAILING_ATR') && slAtrMultiplier > 0 && current.atr) {
            initialSlPrice = current.close - (current.atr * slAtrMultiplier);
          }

          // Position Sizing based on risk per trade
          if (riskPerTrade < 100 && initialSlPrice > 0) {
            const riskAmount = capital * (riskPerTrade / 100);
            const riskPerShare = current.close - initialSlPrice;
            position = riskAmount / riskPerShare;
            // Ensure we don't exceed capital
            if (position * current.close > capital) {
              position = capital / current.close;
            }
          } else {
            position = capital / current.close;
          }

          entryPrice = current.close;
          entryAtr = current.atr || 0;
          highestPrice = current.close;
          currentStopLossPrice = initialSlPrice;
          isBreakevenTriggered = false;
          isPartialTPTriggered = false;
          barsHeld = 0;
          
          trades.push({
            type: 'BUY',
            date: current.date,
            price: current.close,
            amount: position,
            capital: capital
          });
        } else if (signal === 'SELL' && position > 0) {
          const pnl = (current.close - entryPrice) * position;
          capital += pnl;
          dailyLoss += Math.max(0, -pnl);
          trades.push({
            type: 'SELL',
            date: current.date,
            price: current.close,
            amount: position,
            capital: capital,
            pnl: pnl,
            pnlPercent: (current.close - entryPrice) / entryPrice * 100,
            exitReason: 'SIGNAL'
          });
          position = 0;
          barsHeld = 0;
        }

        // Update Equity Curve
        const currentEquity = position > 0 ? position * current.close : capital;
        equityCurve.push({ date: current.date, capital: currentEquity });
      }

      // Final Metrics
      const finalCapital = position > 0 ? position * data[data.length - 1].close : capital;
      const totalReturn = (finalCapital - initialCapital) / initialCapital * 100;
      
      // Win Rate
      const completedTrades = trades.filter(t => t.type === 'SELL');
      const winningTrades = completedTrades.filter(t => (t.pnl || 0) > 0);
      const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;

      // Max Drawdown
      let maxCapital = initialCapital;
      let maxDD = 0;
      equityCurve.forEach(p => {
        if (p.capital > maxCapital) maxCapital = p.capital;
        const dd = (maxCapital - p.capital) / maxCapital;
        if (dd > maxDD) maxDD = dd;
      });

      // Sharpe Ratio (Simplified)
      const dailyReturns = [];
      for (let i = 1; i < equityCurve.length; i++) {
        dailyReturns.push((equityCurve[i].capital - equityCurve[i-1].capital) / equityCurve[i-1].capital);
      }
      const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const stdDev = Math.sqrt(dailyReturns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / dailyReturns.length);
      const sharpeRatio = stdDev !== 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

      setResults({
        trades,
        equityCurve,
        totalReturn,
        sharpeRatio,
        maxDrawdown: maxDD * 100,
        winRate,
        totalTrades: completedTrades.length,
        winningTrades: winningTrades.length,
        netProfit: finalCapital - initialCapital,
        finalCapital
      });
      setIsRunning(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-3xl space-y-4 hover:border-zinc-700/50 transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400">
              <Wallet className="w-4 h-4 text-emerald-500/70" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Initial Capital</span>
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">₹</span>
            <input 
              type="number" 
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl pl-8 pr-4 py-3 text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
            />
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-3xl space-y-4 hover:border-zinc-700/50 transition-all duration-300 group">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="w-4 h-4 text-blue-500/70" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Timeframe</span>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-zinc-950/50 p-1.5 rounded-2xl border border-zinc-800/50">
            {['1m', '5m', '1h', '1d', '1w'].map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange?.(tf)}
                className={cn(
                  "flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300",
                  activeTimeframe === tf 
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                    : "text-zinc-500 hover:text-white hover:bg-white/5"
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-3xl space-y-4 hover:border-zinc-700/50 transition-all duration-300 group">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="w-4 h-4 text-purple-500/70" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Strategy</span>
          </div>
          <div className="relative group/select">
            <select 
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as any)}
              className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-4 py-3 text-white text-sm font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-all cursor-pointer"
            >
              <option value="rsi">RSI Mean Reversion</option>
              <option value="sma_cross">SMA Golden/Death Cross</option>
              <option value="macd">MACD Momentum</option>
              <option value="support_resistance">Support & Resistance</option>
              <option value="trend_line">Trend Line Analysis</option>
              <option value="fibonacci">Fibonacci Retracement</option>
              <option value="acc_dist">Accumulation/Distribution</option>
              <option value="double_patterns">Double Top/Bottom</option>
              <option value="order_flow">Order Flow Imbalance</option>
              <option value="custom">Advanced Strategy Builder</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover/select:text-purple-500 transition-colors">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-3xl flex flex-col gap-3 justify-center">
          <button 
            onClick={runBacktest}
            disabled={isRunning}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-3 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
          >
            {isRunning ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            <span className="uppercase tracking-widest text-xs">{isRunning ? 'Running Simulation...' : 'Run Backtest'}</span>
          </button>
          <button 
            onClick={generateAISignals}
            disabled={isGeneratingAI || !data || data.length === 0}
            className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 border border-zinc-700/50 active:scale-[0.98]"
          >
            {isGeneratingAI ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4 text-indigo-400" />}
            <span className="uppercase tracking-widest text-[10px]">{isGeneratingAI ? 'Analyzing...' : 'Generate AI Signals'}</span>
          </button>
        </div>
      </div>

      {/* Strategy Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {strategy === 'rsi' && (
          <div className="bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-3xl space-y-6 hover:border-purple-500/30 transition-all duration-300 group/rsi">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                  <Activity className="w-4 h-4 text-purple-500" />
                </div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest">RSI Parameters</h4>
              </div>
              <span className="text-[9px] text-zinc-600 font-mono">Mean Reversion</span>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between text-[10px] text-zinc-400 uppercase font-black tracking-tighter">
                  <span className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Oversold: <span className="text-emerald-500 font-mono">{rsiLower}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    Overbought: <span className="text-rose-500 font-mono">{rsiUpper}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex-1 space-y-2">
                    <input 
                      type="range" min="10" max="50" value={rsiLower} 
                      onChange={(e) => setRsiLower(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <input 
                      type="range" min="50" max="90" value={rsiUpper} 
                      onChange={(e) => setRsiUpper(Number(e.target.value))}
                      className="w-full accent-rose-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-zinc-500 italic leading-relaxed">
                Buy when RSI drops below <span className="text-emerald-500 font-bold">{rsiLower}</span> and sell when it exceeds <span className="text-rose-500 font-bold">{rsiUpper}</span>.
              </p>
            </div>
          </div>
        )}

        {strategy === 'sma_cross' && (
          <div className="bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-3xl space-y-6 hover:border-emerald-500/30 transition-all duration-300 group/sma">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest">SMA Crossover</h4>
              </div>
              <span className="text-[9px] text-zinc-600 font-mono">Trend Following</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Fast SMA</label>
                <div className="relative">
                  <input 
                    type="number" value={smaFast} 
                    onChange={(e) => setSmaFast(Number(e.target.value))}
                    className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-4 py-3 text-sm text-emerald-400 font-mono focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-700 font-bold">P</span>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Slow SMA</label>
                <div className="relative">
                  <input 
                    type="number" value={smaSlow} 
                    onChange={(e) => setSmaSlow(Number(e.target.value))}
                    className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-4 py-3 text-sm text-rose-400 font-mono focus:outline-none focus:border-rose-500/50 transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-700 font-bold">P</span>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-zinc-500 italic leading-relaxed">
              Golden Cross (Buy) when <span className="text-emerald-500 font-bold">{smaFast} SMA</span> crosses above <span className="text-rose-500 font-bold">{smaSlow} SMA</span>.
            </p>
          </div>
        )}

        {strategy === 'macd' && (
          <div className="bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-3xl space-y-6 hover:border-blue-500/30 transition-all duration-300 group/macd">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Activity className="w-4 h-4 text-blue-500" />
                </div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest">MACD Momentum</h4>
              </div>
              <span className="text-[9px] text-zinc-600 font-mono">Momentum</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Fast</label>
                <input 
                  type="number" value={macdFast} 
                  onChange={(e) => setMacdFast(Number(e.target.value))}
                  className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Slow</label>
                <input 
                  type="number" value={macdSlow} 
                  onChange={(e) => setMacdSlow(Number(e.target.value))}
                  className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Signal</label>
                <input 
                  type="number" value={macdSignal} 
                  onChange={(e) => setMacdSignal(Number(e.target.value))}
                  className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
            <p className="text-[9px] text-zinc-500 italic leading-relaxed">
              Standard MACD settings: <span className="text-blue-400 font-bold">{macdFast}/{macdSlow}/{macdSignal}</span>.
            </p>
          </div>
        )}

        {strategy === 'order_flow' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/40 p-8 rounded-[2.5rem] border border-zinc-800/50 space-y-8 col-span-full relative overflow-hidden group/orderflow"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/orderflow:bg-emerald-500/10 transition-all duration-700" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Order Flow Parameters</h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">Volume Delta & Absorption Analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-zinc-950/50 px-3 py-1.5 rounded-xl border border-zinc-800/50 text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Uses Volume Delta Proxy</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Imbalance Threshold</span>
                  <span className="text-emerald-500 font-mono">{(orderFlowThreshold || 0).toFixed(2)}x</span>
                </div>
                <input 
                  type="range" min="0.1" max="5" step="0.1" value={orderFlowThreshold} 
                  onChange={(e) => setOrderFlowThreshold(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-[9px] text-zinc-600 italic leading-relaxed">Delta imbalance relative to average volume.</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Calculation Period</span>
                  <span className="text-blue-500 font-mono">{orderFlowPeriod} Bars</span>
                </div>
                <input 
                  type="range" min="5" max="100" step="1" value={orderFlowPeriod} 
                  onChange={(e) => setOrderFlowPeriod(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-[9px] text-zinc-600 italic leading-relaxed">Lookback window for average volume calculation.</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Min Volume Threshold</span>
                  <span className="text-purple-500 font-mono">{(orderFlowMinVolume || 0).toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0.1" max="5" step="0.1" value={orderFlowMinVolume} 
                  onChange={(e) => setOrderFlowMinVolume(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <p className="text-[9px] text-zinc-600 italic leading-relaxed">Minimum candle volume relative to average.</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Min Price Move (ATR)</span>
                  <span className="text-amber-500 font-mono">{(orderFlowMinPriceMove || 0).toFixed(2)}x</span>
                </div>
                <input 
                  type="range" min="0" max="2" step="0.05" value={orderFlowMinPriceMove} 
                  onChange={(e) => setOrderFlowMinPriceMove(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <p className="text-[9px] text-zinc-600 italic leading-relaxed">Minimum candle body size relative to ATR.</p>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span>Buy Imbalance</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                  <span>Sell Imbalance</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                  <span>Absorption</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <span>High Volume</span>
                </div>
              </div>

              <div className="h-[300px] w-full bg-zinc-950/50 rounded-3xl border border-zinc-800/50 p-6 shadow-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                    
                    {/* Support & Resistance Levels */}
                    {data[data.length - 1]?.resistance && (
                      <ReferenceLine 
                        y={data[data.length - 1].resistance} 
                        stroke="#f43f5e" 
                        strokeDasharray="2 2" 
                        strokeOpacity={0.4}
                        label={{ 
                          position: 'insideLeft', 
                          value: `RES: ₹${(data[data.length - 1]?.resistance || 0).toFixed(2)}`, 
                          fill: '#f43f5e', 
                          fontSize: 8,
                          opacity: 0.5
                        }} 
                      />
                    )}
                    {data[data.length - 1]?.support && (
                      <ReferenceLine 
                        y={data[data.length - 1].support} 
                        stroke="#10b981" 
                        strokeDasharray="2 2" 
                        strokeOpacity={0.4}
                        label={{ 
                          position: 'insideLeft', 
                          value: `SUP: ₹${(data[data.length - 1]?.support || 0).toFixed(2)}`, 
                          fill: '#10b981', 
                          fontSize: 8,
                          opacity: 0.5
                        }} 
                      />
                    )}
                    <XAxis dataKey="date" hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                      labelStyle={{ display: 'none' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          const avgVol = d.volumeAvg || 0;
                          const deltaImbalance = (d.volumeDelta || 0) / (avgVol || 1);
                          return (
                            <div className="bg-zinc-950/95 border border-zinc-800 p-4 rounded-2xl shadow-2xl space-y-3 backdrop-blur-md min-w-[180px]">
                              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{format(new Date(d.date), 'HH:mm:ss')}</p>
                                <span className="text-[9px] text-zinc-600 font-mono">#{d.date}</span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-zinc-500 font-bold uppercase">Price</span>
                                  <span className="text-[11px] font-black text-white font-mono">₹{d.close?.toFixed(2) || '0.00'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-zinc-500 font-bold uppercase">Volume</span>
                                  <span className="text-[11px] font-black text-white font-mono">{d.volume.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-zinc-500 font-bold uppercase">Delta</span>
                                  <span className={cn("text-[11px] font-black font-mono", (d.volumeDelta || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                    {(d.volumeDelta || 0) >= 0 ? '+' : ''}{(d.volumeDelta || 0).toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-zinc-500 font-bold uppercase">Imbalance</span>
                                  <span className="text-[11px] font-black text-white font-mono">{deltaImbalance?.toFixed(2) || '0.00'}x</span>
                                </div>
                              </div>
                              {d.isAbsorption && (
                                <div className="pt-2 border-t border-zinc-800 flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">Absorption Pattern</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="close" 
                      stroke="#3f3f46" 
                      strokeWidth={1.5} 
                      dot={false} 
                      isAnimationActive={false}
                      opacity={0.4}
                    />
                    <Scatter
                      data={data.filter(d => {
                        const avgVol = d.volumeAvg || 0;
                        const deltaImbalance = (d.volumeDelta || 0) / (avgVol || 1);
                        const volRatio = d.volume / (avgVol || 1);
                        return (Math.abs(deltaImbalance) > orderFlowThreshold && volRatio > orderFlowMinVolume) || d.isAbsorption || d.volume > avgVol * 2.5;
                      })}
                      x="date"
                      y="close"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (!cx || !cy) return null;
                        
                        const avgVol = payload.volumeAvg || 0;
                        const deltaImbalance = (payload.volumeDelta || 0) / (avgVol || 1);
                        const volRatio = payload.volume / (avgVol || 1);
                        
                        let color = "#3f3f46";
                        let size = 5;
                        let glow = "none";
                        
                        if (payload.isAbsorption) {
                          color = "#f59e0b";
                          size = 7;
                          glow = "0 0 12px rgba(245,158,11,0.6)";
                        } else if (deltaImbalance > orderFlowThreshold && volRatio > orderFlowMinVolume) {
                          color = "#10b981";
                          size = 6;
                          glow = "0 0 10px rgba(16,185,129,0.5)";
                        } else if (deltaImbalance < -orderFlowThreshold && volRatio > orderFlowMinVolume) {
                          color = "#f43f5e";
                          size = 6;
                          glow = "0 0 10px rgba(244,63,94,0.5)";
                        } else if (payload.volume > avgVol * 2.5) {
                          color = "#3b82f6";
                          size = 6;
                          glow = "0 0 10px rgba(59,130,246,0.5)";
                        }
                        
                        return (
                          <circle 
                            cx={cx} cy={cy} r={size} 
                            fill={color} 
                            stroke="#000" 
                            strokeWidth={1.5}
                            style={{ filter: `drop-shadow(${glow})` }}
                            className="cursor-help transition-all duration-300 hover:scale-125"
                          />
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 font-medium uppercase tracking-widest">
                <MousePointer2 className="w-3 h-3" />
                <span>Hover over markers to inspect order flow dynamics</span>
              </div>
            </div>
          </motion.div>
        )}

      {strategy === 'support_resistance' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/40 p-8 rounded-[2.5rem] border border-zinc-800/50 space-y-8 col-span-full relative overflow-hidden group/sr"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/sr:bg-blue-500/10 transition-all duration-700" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Layers className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Support & Resistance</h3>
                <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">Dynamic Level Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-zinc-600">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span>Support</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                <span>Resistance</span>
              </div>
            </div>
          </div>

          <div className="h-[350px] w-full bg-zinc-950/50 rounded-3xl border border-zinc-800/50 p-6 relative z-10 shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                
                {/* Support & Resistance Levels */}
                {data[data.length - 1]?.resistance && (
                  <ReferenceLine 
                    y={data[data.length - 1].resistance} 
                    stroke="#f43f5e" 
                    strokeDasharray="2 2" 
                    strokeOpacity={0.4}
                    label={{ 
                      position: 'insideLeft', 
                      value: `RES: ₹${(data[data.length - 1]?.resistance || 0).toFixed(2)}`, 
                      fill: '#f43f5e', 
                      fontSize: 8,
                      opacity: 0.5
                    }} 
                  />
                )}
                {data[data.length - 1]?.support && (
                  <ReferenceLine 
                    y={data[data.length - 1].support} 
                    stroke="#10b981" 
                    strokeDasharray="2 2" 
                    strokeOpacity={0.4}
                    label={{ 
                      position: 'insideLeft', 
                      value: `SUP: ₹${(data[data.length - 1]?.support || 0).toFixed(2)}`, 
                      fill: '#10b981', 
                      fontSize: 8,
                      opacity: 0.5
                    }} 
                  />
                )}
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                  labelStyle={{ display: 'none' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-zinc-950/95 border border-zinc-800 p-4 rounded-2xl shadow-2xl space-y-3 backdrop-blur-md min-w-[180px]">
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{format(new Date(d.date), 'HH:mm:ss')}</p>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase">Price</span>
                              <span className="text-[11px] font-black text-white font-mono">₹{(d.close || 0).toFixed(2)}</span>
                            </div>
                            {d.support && (
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-emerald-500/70 font-bold uppercase">Support</span>
                                <span className="text-[11px] font-black text-emerald-500 font-mono">₹{d.support?.toFixed(2) || '0.00'}</span>
                              </div>
                            )}
                            {d.resistance && (
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-rose-500/70 font-bold uppercase">Resistance</span>
                                <span className="text-[11px] font-black text-rose-500 font-mono">₹{d.resistance?.toFixed(2) || '0.00'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="close" stroke="#3f3f46" strokeWidth={1.5} dot={false} opacity={0.4} isAnimationActive={false} />
                <Line type="stepAfter" dataKey="support" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 4" isAnimationActive={false} />
                <Line type="stepAfter" dataKey="resistance" stroke="#f43f5e" strokeWidth={2} dot={false} strokeDasharray="4 4" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-zinc-500 italic text-center font-medium uppercase tracking-widest relative z-10">
            Strategy identifies key pivot points and projects dynamic support (<span className="text-emerald-500 font-black">Green</span>) and resistance (<span className="text-rose-500 font-black">Red</span>) levels.
          </p>
        </motion.div>
      )}

      {strategy === 'trend_line' && (
        <div className="space-y-8 col-span-full">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/40 p-8 rounded-[2.5rem] border border-zinc-800/50 space-y-8 relative overflow-hidden group/tl"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/tl:bg-emerald-500/10 transition-all duration-700" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Trend Line Analysis</h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">Manual & Automated Projections</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const newTL: ManualTrendLine = {
                      id: Math.random().toString(36).substr(2, 9),
                      startDate: data[0].date,
                      startPrice: data[0].close,
                      endDate: data[data.length - 1].date,
                      endPrice: data[data.length - 1].close,
                      slope: (data[data.length - 1].close - data[0].close) / (data[data.length - 1].date - data[0].date),
                      label: `Trend ${manualTrendLines.length + 1}`
                    };
                    setManualTrendLines([...manualTrendLines, newTL]);
                  }}
                  className="px-5 py-2.5 bg-emerald-500 text-black text-[10px] font-black uppercase rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Trend Line
                </button>
              </div>
            </div>

            <div className="h-[350px] w-full bg-zinc-950/50 rounded-3xl border border-zinc-800/50 p-6 relative z-10 shadow-inner">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                  
                  {/* Support & Resistance Levels */}
                  {data[data.length - 1]?.resistance && (
                    <ReferenceLine 
                      y={data[data.length - 1]?.resistance} 
                      stroke="#f43f5e" 
                      strokeDasharray="2 2" 
                      strokeOpacity={0.4}
                      label={{ 
                        position: 'insideLeft', 
                        value: `RES: ₹${(data[data.length - 1]?.resistance || 0).toFixed(2)}`, 
                        fill: '#f43f5e', 
                        fontSize: 8,
                        opacity: 0.5
                      }} 
                    />
                  )}
                  {data[data.length - 1]?.support && (
                    <ReferenceLine 
                      y={data[data.length - 1]?.support} 
                      stroke="#10b981" 
                      strokeDasharray="2 2" 
                      strokeOpacity={0.4}
                      label={{ 
                        position: 'insideLeft', 
                        value: `SUP: ₹${(data[data.length - 1]?.support || 0).toFixed(2)}`, 
                        fill: '#10b981', 
                        fontSize: 8,
                        opacity: 0.5
                      }} 
                    />
                  )}
                  <XAxis dataKey="date" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="close" 
                    stroke="#3f3f46" 
                    strokeWidth={1.5} 
                    dot={false} 
                    isAnimationActive={false}
                    opacity={0.4}
                  />
                  {manualTrendLines.map(tl => {
                    const lineData = data.map(d => {
                      if (d.date < tl.startDate || d.date > tl.endDate) return { date: d.date };
                      const price = tl.startPrice + tl.slope * (d.date - tl.startDate);
                      return { date: d.date, [tl.id]: price };
                    });
                    return (
                      <Line 
                        key={tl.id}
                        data={lineData}
                        type="monotone"
                        dataKey={tl.id}
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                        strokeDasharray="6 6"
                        style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.4))' }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {manualTrendLines.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative z-10">
                {manualTrendLines.map((tl, index) => (
                  <div key={tl.id} className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50 flex flex-col gap-4 group/tlitem hover:border-zinc-700/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800 text-[10px] font-black text-zinc-500">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">{tl.label}</p>
                          <p className="text-[9px] text-zinc-600 font-mono uppercase tracking-tighter">Slope: {tl.slope?.toFixed(4) || '0.0000'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setManualTrendLines(manualTrendLines.filter(t => t.id !== tl.id))}
                        className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500 opacity-0 group-hover/tlitem:opacity-100 transition-all hover:bg-rose-500 hover:text-black"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Start Price</label>
                        <input 
                          type="number" 
                          value={tl.startPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setManualTrendLines(manualTrendLines.map(t => t.id === tl.id ? { ...t, startPrice: val, slope: (t.endPrice - val) / (t.endDate - t.startDate) } : t));
                          }}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-[11px] font-black text-white font-mono focus:border-emerald-500/50 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">End Price</label>
                        <input 
                          type="number" 
                          value={tl.endPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setManualTrendLines(manualTrendLines.map(t => t.id === tl.id ? { ...t, endPrice: val, slope: (val - t.startPrice) / (t.endDate - t.startDate) } : t));
                          }}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-[11px] font-black text-white font-mono focus:border-emerald-500/50 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-zinc-600 italic text-center py-4">No manual trend lines added. Use chart drawings or add one above.</p>
            )}
          </motion.div>
        </div>
      )}

      {/* Custom Strategy Builder */}
      {strategy === 'custom' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Entry Conditions */}
          <div className="bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                Entry Strategy (Sequential Builder)
              </h4>
              <button 
                onClick={() => addCondition('entry')}
                className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {entryConditions.map((cond, index) => (
                <div key={cond.id} className="flex flex-wrap items-center gap-2 bg-black/40 p-3 rounded-xl border border-white/5">
                  {index > 0 && (
                    <select 
                      value={cond.logic}
                      onChange={(e) => {
                        const newConds = entryConditions.map(c => c.id === cond.id ? { ...c, logic: e.target.value as any } : c);
                        setEntryConditions(newConds);
                      }}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[10px] text-emerald-500 font-bold"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}
                  <select 
                    value={cond.indicator}
                    onChange={(e) => {
                      const newConds = entryConditions.map(c => c.id === cond.id ? { ...c, indicator: e.target.value as any } : c);
                      setEntryConditions(newConds);
                    }}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    {availableIndicators.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                  <select 
                    value={cond.operator}
                    onChange={(e) => {
                      const newConds = entryConditions.map(c => c.id === cond.id ? { ...c, operator: e.target.value as any } : c);
                      setEntryConditions(newConds);
                    }}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option value=">">{'>'}</option>
                    <option value="<">{'<'}</option>
                    <option value=">=">{'>='}</option>
                    <option value="<=">{'<='}</option>
                    <option value="crosses_above">Crosses Above</option>
                    <option value="crosses_below">Crosses Below</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const newConds = entryConditions.map(c => c.id === cond.id ? { ...c, isConstant: !c.isConstant, value: (!c.isConstant ? 50 : 'close') as any } : c);
                        setEntryConditions(newConds);
                      }}
                      className="p-1 bg-zinc-800 rounded text-[10px] text-zinc-400 uppercase font-bold"
                    >
                      {cond.isConstant ? 'Value' : 'Indicator'}
                    </button>
                    {cond.isConstant ? (
                      <input 
                        type="number"
                        value={cond.value as number}
                        onChange={(e) => {
                          const newConds = entryConditions.map(c => c.id === cond.id ? { ...c, value: Number(e.target.value) } : c);
                          setEntryConditions(newConds);
                        }}
                        className="w-20 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    ) : (
                      <select 
                        value={cond.value as string}
                        onChange={(e) => {
                          const newConds = entryConditions.map(c => c.id === cond.id ? { ...c, value: e.target.value as any } : c);
                          setEntryConditions(newConds);
                        }}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        {availableIndicators.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                      </select>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5 ml-2 border-l border-zinc-800 pl-3">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Lookback:</span>
                    <input 
                      type="number"
                      min="0"
                      max="50"
                      value={cond.lookback}
                      onChange={(e) => {
                        const newConds = entryConditions.map(c => c.id === cond.id ? { ...c, lookback: Number(e.target.value) } : c);
                        setEntryConditions(newConds);
                      }}
                      className="w-12 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                    />
                    <span className="text-[10px] text-zinc-600">bars</span>
                  </div>

                  <button 
                    onClick={() => removeCondition('entry', cond.id)}
                    className="ml-auto p-1.5 text-zinc-500 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Exit Conditions */}
          <div className="bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-rose-500" />
                Exit Strategy (Sequential Builder)
              </h4>
              <button 
                onClick={() => addCondition('exit')}
                className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {exitConditions.map((cond, index) => (
                <div key={cond.id} className="flex flex-wrap items-center gap-2 bg-black/40 p-3 rounded-xl border border-white/5">
                  {index > 0 && (
                    <select 
                      value={cond.logic}
                      onChange={(e) => {
                        const newConds = exitConditions.map(c => c.id === cond.id ? { ...c, logic: e.target.value as any } : c);
                        setExitConditions(newConds);
                      }}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[10px] text-rose-500 font-bold"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}
                  <select 
                    value={cond.indicator}
                    onChange={(e) => {
                      const newConds = exitConditions.map(c => c.id === cond.id ? { ...c, indicator: e.target.value as any } : c);
                      setExitConditions(newConds);
                    }}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    {availableIndicators.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                  <select 
                    value={cond.operator}
                    onChange={(e) => {
                      const newConds = exitConditions.map(c => c.id === cond.id ? { ...c, operator: e.target.value as any } : c);
                      setExitConditions(newConds);
                    }}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option value=">">{'>'}</option>
                    <option value="<">{'<'}</option>
                    <option value=">=">{'>='}</option>
                    <option value="<=">{'<='}</option>
                    <option value="crosses_above">Crosses Above</option>
                    <option value="crosses_below">Crosses Below</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const newConds = exitConditions.map(c => c.id === cond.id ? { ...c, isConstant: !c.isConstant, value: (!c.isConstant ? 50 : 'close') as any } : c);
                        setExitConditions(newConds);
                      }}
                      className="p-1 bg-zinc-800 rounded text-[10px] text-zinc-400 uppercase font-bold"
                    >
                      {cond.isConstant ? 'Value' : 'Indicator'}
                    </button>
                    {cond.isConstant ? (
                      <input 
                        type="number"
                        value={cond.value as number}
                        onChange={(e) => {
                          const newConds = exitConditions.map(c => c.id === cond.id ? { ...c, value: Number(e.target.value) } : c);
                          setExitConditions(newConds);
                        }}
                        className="w-20 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    ) : (
                      <select 
                        value={cond.value as string}
                        onChange={(e) => {
                          const newConds = exitConditions.map(c => c.id === cond.id ? { ...c, value: e.target.value as any } : c);
                          setExitConditions(newConds);
                        }}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        {availableIndicators.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 ml-2 border-l border-zinc-800 pl-3">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Lookback:</span>
                    <input 
                      type="number"
                      min="0"
                      max="50"
                      value={cond.lookback}
                      onChange={(e) => {
                        const newConds = exitConditions.map(c => c.id === cond.id ? { ...c, lookback: Number(e.target.value) } : c);
                        setExitConditions(newConds);
                      }}
                      className="w-12 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
                    />
                    <span className="text-[10px] text-zinc-600">bars</span>
                  </div>

                  <button 
                    onClick={() => removeCondition('exit', cond.id)}
                    className="ml-auto p-1.5 text-zinc-500 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>

      {/* Risk & Trade Management */}
      <div className="bg-zinc-900/20 p-8 rounded-[2.5rem] border border-zinc-800/50 space-y-8 relative overflow-hidden group/risk">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/risk:bg-emerald-500/10 transition-all duration-700" />
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Risk & Trade Management</h3>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">Configure your defensive parameters</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
          {/* Stop Loss Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Stop Loss</label>
              <span className="text-[9px] text-zinc-600 font-mono">Exit Strategy</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="number" 
                  value={slType === 'PERCENT' ? stopLoss : slAtrMultiplier}
                  onChange={(e) => slType === 'PERCENT' ? setStopLoss(Number(e.target.value)) : setSlAtrMultiplier(Number(e.target.value))}
                  className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-rose-500/50 transition-all"
                  placeholder={slType === 'PERCENT' ? "SL %" : "ATR Mult"}
                />
                {slType === 'PERCENT' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">%</span>}
              </div>
              <select 
                value={slType}
                onChange={(e) => setSlType(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-3 text-[10px] text-white font-black uppercase appearance-none focus:outline-none focus:border-rose-500/50 cursor-pointer"
              >
                <option value="PERCENT">%</option>
                <option value="ATR">ATR</option>
                <option value="TRAILING_ATR">T-ATR</option>
              </select>
            </div>
          </div>

          {/* Take Profit Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Take Profit</label>
              <span className="text-[9px] text-zinc-600 font-mono">Target Strategy</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="number" 
                  value={tpType === 'PERCENT' ? takeProfit : tpType === 'ATR' ? tpAtrMultiplier : riskRewardRatio}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (tpType === 'PERCENT') setTakeProfit(val);
                    else if (tpType === 'ATR') setTpAtrMultiplier(val);
                    else setRiskRewardRatio(val);
                  }}
                  className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50 transition-all"
                  placeholder={tpType === 'PERCENT' ? "TP %" : tpType === 'ATR' ? "ATR Mult" : "R/R"}
                />
                {tpType === 'PERCENT' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">%</span>}
              </div>
              <select 
                value={tpType}
                onChange={(e) => setTpType(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-3 text-[10px] text-white font-black uppercase appearance-none focus:outline-none focus:border-emerald-500/50 cursor-pointer"
              >
                <option value="PERCENT">%</option>
                <option value="ATR">ATR</option>
                <option value="RR">R/R</option>
              </select>
            </div>
          </div>

          {/* Trailing Stop Loss */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Trailing SL</label>
              <span className="text-[9px] text-zinc-600 font-mono">Dynamic Exit</span>
            </div>
            <div className="relative">
              <input 
                type="number" 
                value={trailingStopLoss}
                onChange={(e) => setTrailingStopLoss(Number(e.target.value))}
                className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50 transition-all"
                placeholder="0 = Disabled"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">%</span>
            </div>
          </div>

          {/* Position Sizing */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Risk Per Trade</label>
              <span className="text-emerald-500 font-mono font-black text-[10px]">{riskPerTrade}%</span>
            </div>
            <div className="pt-2">
              <input 
                type="range" min="0.1" max="100" step="0.1" value={riskPerTrade} 
                onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between mt-2 text-[8px] text-zinc-600 font-black uppercase tracking-tighter">
                <span>Conservative</span>
                <span>Aggressive</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-8 border-t border-zinc-800/50 relative z-10">
          {/* Max Daily Loss */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Max Daily Loss</label>
            <div className="relative">
              <input 
                type="number" 
                value={maxDailyLoss}
                onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-rose-500/50 transition-all"
                placeholder="0 = Disabled"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">%</span>
            </div>
          </div>

          {/* Max Holding Bars */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Max Holding Bars</label>
            <div className="relative">
              <input 
                type="number" 
                value={maxHoldingBars}
                onChange={(e) => setMaxHoldingBars(Number(e.target.value))}
                className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-blue-500/50 transition-all"
                placeholder="0 = Disabled"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">Bars</span>
            </div>
          </div>

          {/* Breakeven Trigger */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Breakeven Trigger</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="number" 
                  value={breakevenTrigger}
                  onChange={(e) => setBreakevenTrigger(Number(e.target.value))}
                  className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-indigo-500/50 transition-all"
                  placeholder="Trigger %"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-[10px]">%</span>
              </div>
              <div className="relative w-20">
                <input 
                  type="number" 
                  value={breakevenOffset}
                  onChange={(e) => setBreakevenOffset(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-2 py-3 text-[10px] text-white font-mono focus:outline-none focus:border-indigo-500/50"
                  placeholder="Offset"
                />
              </div>
            </div>
          </div>

          {/* Partial Take Profit */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Partial Take Profit</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="number" 
                  value={partialTakeProfit}
                  onChange={(e) => setPartialTakeProfit(Number(e.target.value))}
                  className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50 transition-all"
                  placeholder="Trigger %"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-[10px]">%</span>
              </div>
              <div className="relative w-20">
                <input 
                  type="number" 
                  value={partialTakeProfitPercent}
                  onChange={(e) => setPartialTakeProfitPercent(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-2 py-3 text-[10px] text-white font-mono focus:outline-none focus:border-emerald-500/50"
                  placeholder="Sell %"
                />
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Results Section */}
      <AnimatePresence>
        {results && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-3xl group hover:border-emerald-500/50 transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Return</p>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
                <div className={cn(
                  "text-3xl font-black flex items-center gap-1",
                  results.totalReturn >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {results.totalReturn >= 0 ? '+' : ''}{(results.totalReturn || 0).toFixed(2)}%
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 font-medium">Net Profit: ₹{results.netProfit.toLocaleString()}</p>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-3xl group hover:border-blue-500/50 transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Win Rate</p>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-blue-500" />
                  </div>
                </div>
                <div className="text-3xl font-black text-white">
                  {(results.winRate || 0).toFixed(1)}%
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 font-medium">{results.totalTrades} Total Trades · {results.winningTrades} Wins</p>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-3xl group hover:border-rose-500/50 transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Max Drawdown</p>
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
                    <ArrowDownRight className="w-4 h-4 text-rose-500" />
                  </div>
                </div>
                <div className="text-3xl font-black text-rose-500">
                  -{(results.maxDrawdown || 0).toFixed(2)}%
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 font-medium">Risk Management Metric</p>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-3xl group hover:border-purple-500/50 transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sharpe Ratio</p>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-purple-500" />
                  </div>
                </div>
                <div className="text-3xl font-black text-emerald-400">
                  {(results.sharpeRatio || 0).toFixed(2)}
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 font-medium">Risk-Adjusted Return</p>
              </div>

              {/* AI Forecast Card */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-3xl group hover:border-purple-500/50 transition-all duration-300 col-span-2 md:col-span-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Market Forecast</p>
                    <div className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[8px] font-black uppercase tracking-tighter animate-pulse">Live Analysis</div>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-purple-500" />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-end gap-6">
                  {(() => {
                    const latest = data[data.length - 1];
                    if (!latest || !latest.predictedPrice) return null;
                    
                    const actual = latest.close;
                    const predicted = latest.predictedPrice;
                    const error = Math.abs(actual - predicted) / actual;
                    const isSignificantlyWrong = error > 0.05;
                    const isUptrend = (latest.trendSlope || 0) > 0;
                    
                    if (isSignificantlyWrong) {
                      return (
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center",
                              isUptrend ? "bg-emerald-500/10" : "bg-rose-500/10"
                            )}>
                              {isUptrend ? <TrendingUp className="w-6 h-6 text-emerald-500" /> : <TrendingDown className="w-6 h-6 text-rose-500" />}
                            </div>
                            <div>
                              <div className={cn(
                                "text-2xl font-black uppercase tracking-tight",
                                isUptrend ? "text-emerald-500" : "text-rose-500"
                              )}>
                                {isUptrend ? 'Uptrend Analysis' : 'Downtrend Analysis'}
                              </div>
                              <p className="text-[10px] text-zinc-500 font-medium">Market direction based on trend slope analysis</p>
                            </div>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed max-w-2xl">
                            AI prediction model detected high variance (&gt;5% deviation). Reverting to structural trend analysis. 
                            The current market shows a sustained {isUptrend ? 'upward' : 'downward'} trajectory with a trend slope of {latest.trendSlope?.toFixed(4) || '0.0000'}.
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <>
                        <div className="flex-1">
                          <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Target Price</div>
                          <div className="text-4xl font-black text-purple-400 tracking-tighter">
                            ₹{predicted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-2 font-medium">
                            Projected value based on trend projection and RSI mean reversion.
                          </p>
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Confidence Level</div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-500 transition-all duration-1000" 
                                style={{ width: `${latest.predictionConfidence}%` }} 
                              />
                            </div>
                            <span className="text-lg font-mono font-bold text-white">{Math.round(latest.predictionConfidence || 0)}%</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-2 font-medium">
                            Reliability index based on current market volatility.
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Price & Indicator Chart */}
            <div id="backtest-chart-container" className={cn(
              "bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl transition-all duration-500",
              isFullScreen && "fixed inset-0 z-[100] m-0 rounded-none border-none h-screen w-screen bg-zinc-950"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    Backtest Results: Price & Indicators
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className={cn(
                      "p-1.5 transition-colors rounded-lg hover:bg-zinc-800",
                      isFullScreen ? "text-emerald-500" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className={cn("w-full bg-black/40 rounded-2xl border border-zinc-800 overflow-hidden", isFullScreen ? "h-[calc(100vh-120px)]" : "h-[500px]")}>
                <TradingViewChart 
                  data={data}
                  theme="dark"
                  height={isFullScreen ? 800 : 500}
                  onCrosshairMove={(p) => setMousePos(p ? { x: typeof p.time === 'object' ? `${p.time.year}-${p.time.month}-${p.time.day}` : p.time, y: p.close } : null)}
                  visibleIndicators={visibleIndicators}
                  trades={results.trades}
                  chartType={chartType}
                  onChartTypeChange={setChartType}
                  prediction={data[data.length - 1]}
                />
              </div>
            </div>

            {/* Equity Chart */}
            <div id="equity-chart-container" className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Equity Curve
                </h3>
                <div className="flex items-center gap-4">
                  <div className="text-xs text-zinc-500 font-mono">
                    Final Capital: <span className="text-white font-bold">₹{results.finalCapital.toLocaleString()}</span>
                  </div>
                  <button 
                    onClick={handleEquitySnapshot}
                    className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                    title="Snapshot / Print"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-4 mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-emerald-500" />
                  <span>Buy Entry</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-rose-500" />
                  <span>Sell Exit</span>
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={results.equityCurve}
                    onMouseDown={handleChartMouseDown}
                    onMouseMove={handleChartMouseMove}
                    onMouseUp={handleChartMouseUp}
                  >
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      hide 
                      domain={[zoomLeft, zoomRight]}
                      allowDataOverflow={true}
                    />
                    <YAxis 
                      domain={['auto', 'auto']}
                      stroke="#71717a"
                      fontSize={10}
                      tickFormatter={(val) => `₹${((val || 0) / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                      labelStyle={{ display: 'none' }}
                      formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Capital']}
                    />
                    
                    {/* Zoom Selection Area */}
                    {refAreaLeft && refAreaRight && (
                      <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#10b981" fillOpacity={0.1} />
                    )}

                    <Area 
                      type="monotone" 
                      dataKey="capital" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorEquity)" 
                      isAnimationActive={false}
                    />
                    <Scatter
                      data={results.trades.map(t => {
                        const curvePoint = results.equityCurve.find(p => p.date === t.date);
                        return { 
                          date: t.date, 
                          capital: curvePoint?.capital || t.capital,
                          type: t.type
                        };
                      })}
                      x="date"
                      y="capital"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (!cx || !cy) return null;
                        const isBuy = payload.type === 'BUY';
                        return (
                          <path
                            key={`marker-${payload.date}-${payload.type}`}
                            d={isBuy ? `M${cx},${cy-8} L${cx-6},${cy+2} L${cx+6},${cy+2} Z` : `M${cx},${cy+8} L${cx-6},${cy-2} L${cx+6},${cy-2} Z`}
                            fill={isBuy ? "#10b981" : "#f43f5e"}
                            stroke="#000"
                            strokeWidth={1}
                          />
                        );
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trade Log */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/80">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <List className="w-4 h-4 text-zinc-400" />
                  Trade History
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-zinc-950 text-zinc-500 uppercase font-bold tracking-widest">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Price</th>
                      <th className="px-6 py-3">PnL</th>
                      <th className="px-6 py-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {results.trades.filter(t => t.type === 'SELL').map((trade, i) => {
                      const entryTrade = results.trades
                        .filter(t => t.type === 'BUY' && t.date < trade.date)
                        .sort((a, b) => b.date - a.date)[0];
                      const duration = entryTrade ? Math.round((new Date(trade.date).getTime() - new Date(entryTrade.date).getTime()) / (1000 * 60)) : 0;
                      
                      return (
                        <tr key={i} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-white font-medium">{format(new Date(trade.date), 'MMM dd, HH:mm')}</span>
                              <span className="text-[10px] text-zinc-600">Entry: {entryTrade ? format(new Date(entryTrade.date), 'HH:mm') : 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={cn(
                                "px-2 py-0.5 rounded font-bold text-[10px] w-fit",
                                trade.exitReason === 'SIGNAL' ? "bg-zinc-800 text-zinc-400" :
                                trade.exitReason === 'STOP_LOSS' ? "bg-rose-500/20 text-rose-500" :
                                trade.exitReason === 'TRAILING_STOP' ? "bg-amber-500/20 text-amber-500" :
                                trade.exitReason === 'PARTIAL_TP' ? "bg-emerald-500/20 text-emerald-500" :
                                trade.exitReason === 'TIME_EXIT' ? "bg-zinc-500/20 text-zinc-400" :
                                trade.exitReason === 'MAX_DAILY_LOSS' ? "bg-rose-800/20 text-rose-400" :
                                "bg-emerald-500/20 text-emerald-500"
                              )}>
                                {trade.exitReason}
                              </span>
                              <span className="text-[10px] text-zinc-600">{duration} min duration</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-white font-mono">₹{(trade.price || 0).toFixed(2)}</span>
                              <span className="text-[10px] text-zinc-600">Entry: ₹{(entryTrade?.price || 0).toFixed(2)}</span>
                            </div>
                          </td>
                          <td className={cn(
                            "px-6 py-4 font-bold font-mono",
                            (trade.pnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                          )}>
                            <div className="flex flex-col">
                              <span>{(trade.pnl || 0) >= 0 ? '+' : ''}₹{(trade.pnl || 0).toFixed(2)}</span>
                              <span className="text-[10px] opacity-60">Capital: ₹{trade.capital.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "px-2 py-1 rounded-lg font-black text-[10px] min-w-[50px] text-center",
                                (trade.pnlPercent || 0) >= 0 ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              )}>
                                {(trade.pnlPercent || 0) >= 0 ? '+' : ''}{(trade.pnlPercent || 0).toFixed(2)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!results && !isRunning && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800">
          <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-zinc-600" />
          </div>
          <div>
            <h3 className="text-white font-bold">Ready to Simulate?</h3>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto mt-1">
              Configure your strategy above and click "Run Backtest" to see historical performance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
