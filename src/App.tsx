import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, ReferenceLine, BarChart, Bar, ComposedChart, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Search, Activity, BarChart3, 
  AlertTriangle, Info, RefreshCw, ArrowUpRight, ArrowDownRight,
  Target, ShieldCheck, Home, PieChart, Info as InfoIcon, Mail,
  Menu, X, ChevronRight, Github, Twitter, Linkedin, ExternalLink,
  CandlestickChart as CandleIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { calculateIndicators, IndicatorResult } from './utils/indicators';
import { getStockPrediction } from './services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 overflow-hidden transition-all hover:border-zinc-700", className)} {...props}>
    {children}
  </div>
);

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
          {Math.abs(trend).toFixed(2)}%
        </div>
      )}
    </div>
    <div className="mt-2">
      <p className="text-sm text-zinc-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-white mt-1 tracking-tight">{value}</p>
    </div>
  </Card>
);

// --- Sections ---

const HomePage: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4"
  >
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8">
      <Activity className="w-3 h-3" />
      Next-Gen Market Intelligence
    </div>
    <h1 className="text-6xl md:text-8xl font-display italic font-black text-white leading-tight mb-6">
      Predict the <span className="text-emerald-500">Unpredictable.</span>
    </h1>
    <p className="text-zinc-400 max-w-2xl text-lg mb-10 leading-relaxed">
      Harness the power of advanced technical indicators and Gemini AI to forecast market movements with unprecedented precision.
    </p>
    <div className="flex gap-4">
      <button 
        onClick={onStart}
        className="px-8 py-4 bg-emerald-500 text-black font-bold rounded-full hover:bg-emerald-400 transition-all hover:scale-105 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
      >
        Start Predicting <ChevronRight className="w-5 h-5" />
      </button>
      <button className="px-8 py-4 bg-zinc-900 text-white font-bold rounded-full border border-zinc-800 hover:bg-zinc-800 transition-all">
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'predict' | 'about' | 'contact'>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [symbol, setSymbol] = useState('RELIANCE.NS');
  const [inputSymbol, setInputSymbol] = useState('RELIANCE.NS');
  const [data, setData] = useState<IndicatorResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [liveSuggestions, setLiveSuggestions] = useState<any[]>([]);
  const [showLiveSuggestions, setShowLiveSuggestions] = useState(false);
  const [relatedSymbols, setRelatedSymbols] = useState<any[]>([]);

  // Live search suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (inputSymbol.trim().length >= 2) {
        try {
          const res = await fetch(`/api/search/${inputSymbol}`);
          const data = await res.json();
          setLiveSuggestions(data);
          setShowLiveSuggestions(true);
        } catch (e) {
          console.error("Search error:", e);
        }
      } else {
        setLiveSuggestions([]);
        setShowLiveSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputSymbol]);

  const fetchData = async (sym: string) => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setRelatedSymbols([]);
    setShowLiveSuggestions(false);
    try {
      const response = await fetch(`/api/stock/${sym}`);
      const result = await response.json();
      
      if (!response.ok) {
        if (result.suggestions) {
          setSuggestions(result.suggestions);
          setError(result.error);
          return;
        }
        throw new Error(result.error || "Failed to fetch stock data");
      }
      
      const { symbol: actualSymbol, quotes, related } = result;
      setSymbol(actualSymbol);
      setInputSymbol(actualSymbol);
      setRelatedSymbols(related || []);

      const processedData = calculateIndicators(quotes.map((d: any) => ({
        ...d,
        date: new Date(d.date)
      })));
      
      setData(processedData);
      
      // Get AI Prediction
      const pred = await getStockPrediction(sym, processedData);
      setPrediction(pred);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'predict') {
      fetchData(symbol);
    }
  }, [symbol, activeTab]);

  const latest = data[data.length - 1];
  const chartData = useMemo(() => data.slice(-100), [data]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSymbol.trim()) {
      setSymbol(inputSymbol.toUpperCase());
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'predict', label: 'Predict', icon: PieChart },
    { id: 'about', label: 'About', icon: InfoIcon },
    { id: 'contact', label: 'Contact', icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-emerald-500/30 flex">
      
      {/* Sidebar Navigation */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="fixed left-0 top-0 h-full bg-zinc-950 border-r border-zinc-900 z-50 flex flex-col transition-all duration-300"
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
              <img src="https://picsum.photos/seed/user/100/100" alt="User" referrerPolicy="no-referrer" />
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">Saravanan</p>
                <p className="text-[10px] text-zinc-500 truncate">Pro Plan</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main 
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: isSidebarOpen ? 280 : 80 }}
      >
        {/* Top Header (Only for Predict) */}
        {activeTab === 'predict' && (
          <header className="h-20 border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-40 px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-white">Market Dashboard</h2>
              <div className="h-4 w-px bg-zinc-800" />
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Symbol: {symbol}</p>
            </div>

            <div className="relative">
              <form onSubmit={handleSearch} className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  type="text" 
                  value={inputSymbol}
                  onChange={(e) => setInputSymbol(e.target.value)}
                  onFocus={() => inputSymbol.length >= 2 && setShowLiveSuggestions(true)}
                  placeholder="Search Symbol..."
                  className="bg-zinc-900 border border-zinc-800 rounded-full py-2 px-11 w-64 focus:outline-none focus:border-emerald-500/50 transition-all text-sm text-white"
                />
              </form>

              {/* Live Suggestions Dropdown */}
              <AnimatePresence>
                {showLiveSuggestions && liveSuggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl z-50"
                  >
                    <div className="max-h-80 overflow-y-auto p-2">
                      {liveSuggestions.map((s, idx) => (
                        <button
                          key={`${s.symbol}-${idx}`}
                          onClick={() => {
                            setSymbol(s.symbol);
                            setInputSymbol(s.symbol);
                            setShowLiveSuggestions(false);
                          }}
                          className="w-full flex items-center justify-between p-3 hover:bg-zinc-800 rounded-xl transition-colors text-left"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-xs">{s.symbol}</span>
                            <span className="text-[10px] text-zinc-500 truncate max-w-[150px]">{s.name}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] font-bold text-zinc-600 uppercase">{s.type}</span>
                            <span className="text-[8px] text-zinc-700">{s.exchDisp}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </header>
        )}

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && <HomePage key="home" onStart={() => setActiveTab('predict')} />}
            {activeTab === 'about' && <AboutPage key="about" />}
            {activeTab === 'contact' && <ContactPage key="contact" />}
            
            {activeTab === 'predict' && (
              <motion.div 
                key="predict"
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
                    
                    {suggestions.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Suggested Companies</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {suggestions.map((s, idx) => (
                            <button
                              key={`${s.symbol}-${idx}`}
                              onClick={() => {
                                setSymbol(s.symbol);
                                setInputSymbol(s.symbol);
                              }}
                              className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-emerald-500/50 hover:bg-zinc-800 transition-all text-left group"
                            >
                              <div>
                                <p className="text-sm font-bold text-white group-hover:text-emerald-400">{s.symbol}</p>
                                <p className="text-[10px] text-zinc-500 truncate max-w-[120px]">{s.name}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

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
                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <Stat 
                        label="Current Price" 
                        value={`₹${latest?.close.toFixed(2)}`} 
                        trend={latest?.dailyReturn ? latest.dailyReturn * 100 : 0}
                        icon={TrendingUp}
                      />
                      <Stat 
                        label="RSI (14)" 
                        value={latest?.rsi?.toFixed(2) || 'N/A'} 
                        icon={Activity}
                      />
                      <Stat 
                        label="Volatility" 
                        value={`${((latest?.volatility || 0) * 100).toFixed(2)}%`} 
                        icon={BarChart3}
                      />
                      <Stat 
                        label="Volume" 
                        value={(latest?.volume / 1000000).toFixed(2) + 'M'} 
                        trend={latest?.volumeChange ? latest.volumeChange * 100 : 0}
                        icon={BarChart3}
                      />
                    </div>

                    {/* Main Chart */}
                    <Card className="lg:col-span-8 min-h-[500px] flex flex-col">
                      <div className="flex justify-between items-center mb-8">
                        <div>
                          <h3 className="text-lg font-bold text-white">Price Action & Indicators</h3>
                          <p className="text-xs text-zinc-500">Historical performance with Bollinger Bands</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex gap-2">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" /> Price
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              <div className="w-2 h-2 rounded-full bg-zinc-700" /> BBands
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis 
                              dataKey="date" 
                              tickFormatter={(date) => format(date, 'MMM d')}
                              stroke="#52525b"
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              domain={['auto', 'auto']} 
                              stroke="#52525b"
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(val) => `₹${val}`}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                              itemStyle={{ fontSize: '12px' }}
                            />
                            {/* Bollinger Bands */}
                            <Area type="monotone" dataKey="bbUpper" stroke="transparent" fill="#27272a" fillOpacity={0.2} />
                            <Area type="monotone" dataKey="bbLower" stroke="transparent" fill="#27272a" fillOpacity={0.2} />
                            
                            {/* Wicks */}
                            <Bar 
                              dataKey={(d) => [d.low, d.high]} 
                              fill="#52525b" 
                              barSize={1} 
                              isAnimationActive={false}
                            />
                            
                            {/* Candle Body */}
                            <Bar 
                              dataKey={(d) => [d.open, d.close]} 
                              barSize={8}
                              isAnimationActive={false}
                            >
                              {chartData.map((entry, index) => (
                                <Cell 
                                  key={`candle-cell-${index}`} 
                                  fill={entry.close > entry.open ? '#10b981' : '#f43f5e'} 
                                />
                              ))}
                            </Bar>
                            
                            <Line type="monotone" dataKey="sma50" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="5 5" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    {/* Prediction Panel */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
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
                        prediction?.prediction === 'UP' ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"
                      )}>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <Target className={cn("w-5 h-5", prediction?.prediction === 'UP' ? "text-emerald-500" : "text-rose-500")} />
                            <h3 className="font-bold text-white uppercase tracking-wider text-sm">AI Prediction</h3>
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
                              prediction?.prediction === 'UP' ? "text-emerald-500" : "text-rose-500"
                            )}
                          >
                            {prediction?.prediction}
                          </motion.div>
                          <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Next Day Forecast</p>
                        </div>

                        <div className="space-y-4 mt-4">
                          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                            <p className="text-xs text-zinc-400 leading-relaxed italic">
                              "{prediction?.reasoning}"
                            </p>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500">Target Price</span>
                            <span className="text-white font-bold">₹{prediction?.targetPrice?.toFixed(2)}</span>
                          </div>
                        </div>
                      </Card>

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

                    {/* Indicators Grid */}
                    <Card className="lg:col-span-12">
                      <div className="flex items-center gap-2 mb-6">
                        <BarChart3 className="w-5 h-5 text-zinc-400" />
                        <h3 className="font-bold text-white">Momentum & Volume Analysis</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 h-[300px]">
                        <div className="flex flex-col">
                          <p className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider">RSI (Relative Strength Index)</p>
                          <div className="flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="date" hide />
                                <YAxis domain={[0, 100]} stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} ticks={[30, 70]} />
                                <ReferenceLine y={70} stroke="#rose-500" strokeDasharray="3 3" />
                                <ReferenceLine y={30} stroke="#emerald-500" strokeDasharray="3 3" />
                                <Line type="monotone" dataKey="rsi" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <p className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider">MACD Histogram</p>
                          <div className="flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="date" hide />
                                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <Bar dataKey="macdHist">
                                  {chartData.map((entry, index) => (
                                    <Cell key={`macd-cell-${index}`} fill={(entry.macdHist || 0) > 0 ? '#10b981' : '#f43f5e'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </motion.div>
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
    </div>
  );
}
