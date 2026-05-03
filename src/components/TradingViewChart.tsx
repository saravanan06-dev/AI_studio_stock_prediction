import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  createChart, 
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  MouseEventParams,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  createSeriesMarkers
} from 'lightweight-charts';
import { IndicatorResult } from '../utils/indicators';
import { cn } from '../utils/cn';
import { 
  Maximize2, 
  Minimize2, 
  Settings2, 
  Layers, 
  Eye, 
  EyeOff,
  Pencil,
  Ruler,
  Square,
  Circle,
  Minus,
  Type,
  Eraser,
  Undo2,
  Trash2,
  Zap,
  Activity,
  CandlestickChart as CandleIcon,
  TrendingUp,
  LineChart as LineIcon
} from 'lucide-react';

interface TradingViewChartProps {
  data: IndicatorResult[];
  theme?: 'light' | 'dark';
  height?: number;
  onCrosshairMove?: (data: any | null) => void;
  prediction?: any;
  drawings?: any[];
  onAddDrawing?: (drawing: any) => void;
  onDeleteDrawing?: (id: string) => void;
  visibleIndicators?: Record<string, boolean>;
  chartType?: 'candle' | 'line';
  onChartTypeChange?: (type: 'candle' | 'line') => void;
  trades?: any[];
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({ 
  data, 
  theme = 'dark', 
  height = 600,
  onCrosshairMove,
  prediction,
  drawings = [],
  onAddDrawing,
  onDeleteDrawing,
  visibleIndicators = {},
  chartType = 'candle',
  onChartTypeChange,
  trades = []
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  // Main Series
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  
  // Overlays (Price Pane)
  const sma10Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema10Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  // Sub-Panes (using scaleMargins)
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const atrSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const adLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [drawingMode, setDrawingMode] = useState<'none' | 'trendline' | 'horizontal'>('none');
  const [currentTrendline, setCurrentTrendline] = useState<{ start: { time: any, price: number }, end?: { time: any, price: number } } | null>(null);
  
  const priceLinesRef = useRef<any[]>([]);
  const fibLinesRef = useRef<any[]>([]);
  const trendlineSeriesListRef = useRef<ISeriesApi<'Line'>[]>([]);
  const aiPriceLineRef = useRef<any>(null);
  const candleMarkersApiRef = useRef<any>(null);
  const lineMarkersApiRef = useRef<any>(null);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: theme === 'dark' ? '#09090b' : '#ffffff' },
        textColor: theme === 'dark' ? '#a1a1aa' : '#3f3f46',
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#18181b' : '#f4f4f5' },
        horzLines: { color: theme === 'dark' ? '#18181b' : '#f4f4f5' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7',
        autoScale: true,
      },
      timeScale: {
        borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    // 1. Price Series
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
      visible: chartType === 'candle',
    });

    lineSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#10b981',
      lineWidth: 2,
      visible: chartType === 'line',
    });

    // 2. Volume Series (Overlay at bottom of price pane)
    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Overlay
    });
    volumeSeriesRef.current.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // 3. Indicators (Price Pane)
    sma10Ref.current = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'SMA 10', visible: !!visibleIndicators.sma });
    sma50Ref.current = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'SMA 50', visible: !!visibleIndicators.sma });
    ema10Ref.current = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, title: 'EMA 10', visible: !!visibleIndicators.ema });
    ema50Ref.current = chart.addSeries(LineSeries, { color: '#ec4899', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'EMA 50', visible: !!visibleIndicators.ema });
    
    bbUpperRef.current = chart.addSeries(LineSeries, { color: 'rgba(59, 130, 246, 0.3)', lineWidth: 1, title: 'BB Upper', visible: !!visibleIndicators.bb });
    bbLowerRef.current = chart.addSeries(LineSeries, { color: 'rgba(59, 130, 246, 0.3)', lineWidth: 1, title: 'BB Lower', visible: !!visibleIndicators.bb });
    bbMiddleRef.current = chart.addSeries(LineSeries, { color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Middle', visible: !!visibleIndicators.bb });

    // 4. Sub-Panes (Stacked using margins)
    rsiSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#8b5cf6',
      lineWidth: 2,
      title: 'RSI',
      priceScaleId: 'rsi',
      visible: !!visibleIndicators.rsi,
    });
    rsiSeriesRef.current.priceScale().applyOptions({
      scaleMargins: { top: 0.7, bottom: 0.2 },
    });

    macdHistRef.current = chart.addSeries(HistogramSeries, {
      color: '#10b981',
      priceScaleId: 'macd',
      visible: !!visibleIndicators.macd,
    });
    macdSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      priceScaleId: 'macd',
      visible: !!visibleIndicators.macd,
    });
    macdSignalRef.current = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      priceScaleId: 'macd',
      visible: !!visibleIndicators.macd,
    });
    macdSeriesRef.current.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0.1 },
    });

    atrSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#f43f5e',
      lineWidth: 2,
      title: 'ATR',
      priceScaleId: 'atr',
      visible: !!visibleIndicators.atr,
    });
    atrSeriesRef.current.priceScale().applyOptions({
      scaleMargins: { top: 0.9, bottom: 0 },
    });

    adLineSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#8b5cf6',
      lineWidth: 2,
      title: 'A/D Line',
      priceScaleId: 'ad',
      visible: !!visibleIndicators.ad,
    });
    adLineSeriesRef.current.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // Resize Handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    // Crosshair Handler
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!onCrosshairMove) return;
      
      if (!param.point || !param.time) {
        onCrosshairMove(null);
      } else {
        const activeSeries = chartType === 'candle' ? candleSeriesRef.current : lineSeriesRef.current;
        if (activeSeries && onCrosshairMove) {
          const point = param.seriesData.get(activeSeries);
          if (point) {
            // Pick only necessary properties to avoid circular references (Series/PriceScale)
            const cleanData: any = {
              time: typeof point.time === 'object' ? { ...(point.time as any) } : point.time,
            };
            
            if ('open' in point) {
              cleanData.open = Number((point as any).open);
              cleanData.high = Number((point as any).high);
              cleanData.low = Number((point as any).low);
              cleanData.close = Number((point as any).close);
            } else if ('value' in point) {
              cleanData.value = Number((point as any).value);
              cleanData.close = Number((point as any).value);
            }

            // Also fetch volume detail if volume series is available
            if (volumeSeriesRef.current) {
              const volPoint = param.seriesData.get(volumeSeriesRef.current);
              if (volPoint && 'value' in volPoint) {
                cleanData.volume = Number((volPoint as any).value);
              }
            }

            onCrosshairMove(cleanData);
          } else {
            onCrosshairMove(null);
          }
        }
      }
    });

    // Drawing Tool Handler
    chart.subscribeClick((param: MouseEventParams) => {
      if (!param.point || drawingMode === 'none') return;

      const activeSeries = chartType === 'candle' ? candleSeriesRef.current : lineSeriesRef.current;
      const price = activeSeries.coordinateToPrice(param.point.y);
      const time = param.time;
      if (price === null || !time) return;

      if (drawingMode === 'horizontal') {
        const line = activeSeries.createPriceLine({
          price: price,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Horizontal Level',
        });
        priceLinesRef.current.push(line);
      } else if (drawingMode === 'trendline') {
        if (!currentTrendline) {
          setCurrentTrendline({ start: { time, price } });
        } else {
          const newTrendline = { ...currentTrendline, end: { time, price } };
          setCurrentTrendline(null);
          
          const series = chart.addSeries(LineSeries, {
            color: '#10b981',
            lineWidth: 2,
          });
          series.setData([
            { time: newTrendline.start.time, value: newTrendline.start.price },
            { time: newTrendline.end!.time, value: newTrendline.end!.price }
          ]);
          trendlineSeriesListRef.current.push(series);
        }
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      candleMarkersApiRef.current = null;
      lineMarkersApiRef.current = null;
    };
  }, [theme]); // Recreation on theme change is necessary for background colors

  // Update Data
  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    const timeScale = data.map(d => (d.date / 1000) as any);
    
    const candlestickData: CandlestickData[] = data
      .filter(d => typeof d.open === 'number' && typeof d.high === 'number' && typeof d.low === 'number' && typeof d.close === 'number')
      .map(d => ({
        time: (d.date / 1000) as any,
        open: d.open!,
        high: d.high!,
        low: d.low!,
        close: d.close!,
      }));

    const lineData: LineData[] = data
      .filter(d => d.close !== null)
      .map(d => ({
        time: (d.date / 1000) as any,
        value: d.close,
      }));

    const volumeData: HistogramData[] = data
      .filter(d => d.volume !== null)
      .map(d => ({
        time: (d.date / 1000) as any,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)',
      }));

    candleSeriesRef.current?.setData(candlestickData);
    lineSeriesRef.current?.setData(lineData);
    volumeSeriesRef.current?.setData(volumeData);

    // Indicators Data
    const getLineData = (key: keyof IndicatorResult) => data
      .filter(d => d[key] !== undefined)
      .map(d => ({ time: (d.date / 1000) as any, value: d[key] as number }));

    sma10Ref.current?.setData(getLineData('sma10'));
    sma50Ref.current?.setData(getLineData('sma50'));
    ema10Ref.current?.setData(getLineData('ema10'));
    ema50Ref.current?.setData(getLineData('ema50'));
    bbUpperRef.current?.setData(getLineData('bbUpper'));
    bbLowerRef.current?.setData(getLineData('bbLower'));
    bbMiddleRef.current?.setData(getLineData('bbMiddle'));
    
    rsiSeriesRef.current?.setData(getLineData('rsi'));
    macdSeriesRef.current?.setData(getLineData('macd'));
    macdSignalRef.current?.setData(getLineData('macdSignal'));
    macdHistRef.current?.setData(data.map(d => ({
      time: (d.date / 1000) as any,
      value: d.macdHist || 0,
      color: (d.macdHist || 0) >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
    })));
    atrSeriesRef.current?.setData(getLineData('atr'));
    adLineSeriesRef.current?.setData(getLineData('adLine'));

    // Fibonacci Levels
    const latest = data[data.length - 1];
    fibLinesRef.current.forEach(line => candleSeriesRef.current?.removePriceLine(line));
    fibLinesRef.current = [];
    
    if (visibleIndicators.fib && latest) {
      const fibs = [
        { val: latest.fib236, label: '23.6%' },
        { val: latest.fib382, label: '38.2%' },
        { val: latest.fib500, label: '50.0%' },
        { val: latest.fib618, label: '61.8%' },
        { val: latest.fib786, label: '78.6%' },
      ];
      fibs.forEach(f => {
        if (f.val) {
          const line = candleSeriesRef.current?.createPriceLine({
            price: f.val,
            color: '#8b5cf6',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `Fib ${f.label}`,
          });
          if (line) fibLinesRef.current.push(line);
        }
      });
    }

    // Support / Resistance
    if (visibleIndicators.sr && latest) {
      if (latest.support) {
        const line = candleSeriesRef.current?.createPriceLine({
          price: latest.support,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Support',
        });
        if (line) fibLinesRef.current.push(line);
      }
      if (latest.resistance) {
        const line = candleSeriesRef.current?.createPriceLine({
          price: latest.resistance,
          color: '#f43f5e',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Resistance',
        });
        if (line) fibLinesRef.current.push(line);
      }
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, visibleIndicators]);

  // Update Markers (Trades)
  useEffect(() => {
    if (!candleSeriesRef.current || !lineSeriesRef.current) {
      return;
    }
    
    // Initialize marker APIs if not present
    if (!candleMarkersApiRef.current) {
      candleMarkersApiRef.current = createSeriesMarkers(candleSeriesRef.current, []);
    }
    if (!lineMarkersApiRef.current) {
      lineMarkersApiRef.current = createSeriesMarkers(lineSeriesRef.current, []);
    }
    
    const markers: any[] = (trades || []).map(t => ({
      time: (t.date / 1000) as any,
      position: t.type === 'BUY' ? 'belowBar' : 'aboveBar',
      color: t.type === 'BUY' ? '#10b981' : '#f43f5e',
      shape: t.type === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: `${t.type} @ ₹${t.price.toFixed(2)}${t.exitReason ? ` (${t.exitReason})` : ''}`,
    }));

    if (chartType === 'candle') {
      candleMarkersApiRef.current?.setMarkers(markers);
      lineMarkersApiRef.current?.setMarkers([]);
    } else {
      lineMarkersApiRef.current?.setMarkers(markers);
      candleMarkersApiRef.current?.setMarkers([]);
    }
  }, [trades, chartType]);

  // Handle Visibility Toggles
  useEffect(() => {
    sma10Ref.current?.applyOptions({ visible: !!visibleIndicators.sma });
    sma50Ref.current?.applyOptions({ visible: !!visibleIndicators.sma });
    ema10Ref.current?.applyOptions({ visible: !!visibleIndicators.ema });
    ema50Ref.current?.applyOptions({ visible: !!visibleIndicators.ema });
    bbUpperRef.current?.applyOptions({ visible: !!visibleIndicators.bb });
    bbLowerRef.current?.applyOptions({ visible: !!visibleIndicators.bb });
    bbMiddleRef.current?.applyOptions({ visible: !!visibleIndicators.bb });
    rsiSeriesRef.current?.applyOptions({ visible: !!visibleIndicators.rsi });
    macdSeriesRef.current?.applyOptions({ visible: !!visibleIndicators.macd });
    macdSignalRef.current?.applyOptions({ visible: !!visibleIndicators.macd });
    macdHistRef.current?.applyOptions({ visible: !!visibleIndicators.macd });
    atrSeriesRef.current?.applyOptions({ visible: !!visibleIndicators.atr });
    adLineSeriesRef.current?.applyOptions({ visible: !!visibleIndicators.adLine });
  }, [visibleIndicators]);

  // Handle Chart Type
  useEffect(() => {
    candleSeriesRef.current?.applyOptions({ visible: chartType === 'candle' });
    lineSeriesRef.current?.applyOptions({ visible: chartType === 'line' });
  }, [chartType]);

  // AI Prediction Line
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    if (aiPriceLineRef.current) {
      candleSeriesRef.current.removePriceLine(aiPriceLineRef.current);
      aiPriceLineRef.current = null;
    }
    if (prediction?.targetPrice) {
      aiPriceLineRef.current = candleSeriesRef.current.createPriceLine({
        price: prediction.targetPrice,
        color: '#a855f7',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `AI TARGET: ₹${prediction.targetPrice.toLocaleString()}`,
      });
    }
  }, [prediction]);

  const toggleFullScreen = () => {
    if (!chartContainerRef.current) return;
    if (!isFullScreen) chartContainerRef.current.requestFullscreen?.();
    else document.exitFullscreen?.();
    setIsFullScreen(!isFullScreen);
  };

  return (
    <div className={cn(
      "relative bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden group/chart",
      isFullScreen ? "fixed inset-0 z-[100] rounded-none" : ""
    )}>
      {/* Chart Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 p-1 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl">
        <div className="flex items-center border-r border-zinc-800 pr-2 mr-1">
          <button 
            onClick={() => onChartTypeChange?.(chartType === 'candle' ? 'line' : 'candle')}
            className="p-2 text-zinc-400 hover:text-white transition-all"
            title="Switch Chart Type"
          >
            {chartType === 'candle' ? <LineIcon className="w-4 h-4" /> : <CandleIcon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => setDrawingMode(drawingMode === 'trendline' ? 'none' : 'trendline')}
            className={cn(
              "p-2 rounded-xl transition-all",
              drawingMode === 'trendline' ? "bg-emerald-500/20 text-emerald-500" : "text-zinc-500 hover:text-zinc-300"
            )}
            title="Trendline Tool"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'horizontal' ? 'none' : 'horizontal')}
            className={cn(
              "p-2 rounded-xl transition-all",
              drawingMode === 'horizontal' ? "bg-emerald-500/20 text-emerald-500" : "text-zinc-500 hover:text-zinc-300"
            )}
            title="Horizontal Level Tool"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              priceLinesRef.current.forEach(line => candleSeriesRef.current?.removePriceLine(line));
              priceLinesRef.current = [];
              trendlineSeriesListRef.current.forEach(series => chartRef.current?.removeSeries(series));
              trendlineSeriesListRef.current = [];
              setCurrentTrendline(null);
            }}
            className="p-2 text-zinc-500 hover:text-rose-500 transition-all"
            title="Clear Drawings"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center border-l border-zinc-800 pl-2 ml-1">
          <button onClick={toggleFullScreen} className="p-2 text-zinc-500 hover:text-white">
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Prediction Badge */}
      {prediction && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 px-4 py-2 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">AI Target</span>
            </div>
            <span className="text-lg font-black text-white tracking-tighter">₹{(prediction.targetPrice || 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div 
        ref={chartContainerRef} 
        className="w-full" 
        style={{ height: isFullScreen ? '100vh' : `${height}px` }} 
      />

      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-3 max-w-[80%]">
        {Object.entries(visibleIndicators).map(([key, visible]) => {
          if (!visible) return null;
          const labels: Record<string, string> = {
            sma: 'SMA 10/50',
            ema: 'EMA 10/50',
            bb: 'Bollinger Bands',
            rsi: 'RSI (14)',
            macd: 'MACD (12,26,9)',
            atr: 'ATR',
            fib: 'Fibonacci Levels',
            adLine: 'A/D Line',
            sr: 'Support/Resistance'
          };
          return (
            <div key={key} className="flex items-center gap-2 bg-zinc-900/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-800">
               <div className={cn(
                 "w-1.5 h-1.5 rounded-full",
                 key === 'sma' ? 'bg-amber-500' : 
                 key === 'ema' ? 'bg-emerald-500' : 
                 key === 'bb' ? 'bg-blue-500' : 'bg-purple-500'
               )} />
               <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">{labels[key] || key}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
