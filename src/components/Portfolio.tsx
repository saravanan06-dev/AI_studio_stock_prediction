import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  History, 
  Plus, 
  Minus, 
  Filter, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  DollarSign,
  PieChart,
  BarChart3,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { portfolioService } from '../services/portfolioService';
import { Order, Holding, PortfolioSummary, StockData } from '../types';
import { Card } from './Card';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PortfolioProps {
  currentPrices: Record<string, StockData>;
  onTrade: (symbol: string, type: 'BUY' | 'SELL') => void;
  onViewHistory: () => void;
}

export const Portfolio: React.FC<PortfolioProps> = ({ currentPrices, onTrade, onViewHistory }) => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'profit' | 'loss'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [h, o] = await Promise.all([
          portfolioService.getHoldings(),
          portfolioService.getOrderHistory()
        ]);
        
        // Enrich holdings with current prices
        const enrichedHoldings = h.map(holding => {
          const currentPrice = currentPrices[holding.symbol]?.price || holding.avgBuyPrice;
          const currentValue = holding.quantity * currentPrice;
          const unrealizedPnL = currentValue - holding.investedValue;
          const unrealizedPnLPercent = (unrealizedPnL / holding.investedValue) * 100;

          return {
            ...holding,
            currentPrice,
            currentValue,
            unrealizedPnL,
            unrealizedPnLPercent
          };
        });

        setHoldings(enrichedHoldings);
        setOrders(o);
      } catch (error) {
        console.error('Error fetching portfolio:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPrices]);

  const summary: PortfolioSummary = holdings.reduce((acc, h) => {
    acc.totalInvestment += h.investedValue;
    acc.currentValue += h.currentValue;
    acc.totalPnL += h.unrealizedPnL;
    return acc;
  }, {
    totalInvestment: 0,
    currentValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    realizedPnL: orders.reduce((acc, o) => acc + (o.realizedPnL || 0), 0)
  });

  summary.totalPnL += summary.realizedPnL;
  summary.totalPnLPercent = summary.totalInvestment > 0 
    ? (summary.totalPnL / summary.totalInvestment) * 100 
    : 0;

  const filteredHoldings = holdings.filter(h => {
    const matchesSearch = h.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'profit') return matchesSearch && h.unrealizedPnL > 0;
    if (filter === 'loss') return matchesSearch && h.unrealizedPnL < 0;
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-900 rounded-2xl" />
          ))}
        </div>
        <div className="h-96 bg-zinc-900 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-emerald-500" />
            📁 My Portfolio
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-1 uppercase tracking-widest">Real-time performance tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onViewHistory}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
          >
            <History className="w-4 h-4" />
            Order History
          </button>
        </div>
      </div>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          label="Total Investment" 
          value={`₹${summary.totalInvestment.toLocaleString()}`} 
          icon={DollarSign}
          color="blue"
        />
        <SummaryCard 
          label="Current Value" 
          value={`₹${summary.currentValue.toLocaleString()}`} 
          icon={TrendingUp}
          color="emerald"
        />
        <SummaryCard 
          label="Total P&L" 
          value={`₹${summary.totalPnL.toLocaleString()}`} 
          trend={summary.totalPnLPercent}
          icon={PieChart}
          color={summary.totalPnL >= 0 ? "emerald" : "rose"}
        />
        <SummaryCard 
          label="Realized P&L (Net)" 
          value={`₹${summary.realizedPnL.toLocaleString()}`} 
          icon={BarChart3}
          color={summary.realizedPnL >= 0 ? "emerald" : "rose"}
        />
      </div>

      <div className="space-y-6">
        {/* Filters & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500" />
              <div className="flex bg-black/40 p-1 rounded-lg border border-zinc-800">
                {(['all', 'profit', 'loss'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                      filter === f ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text"
                placeholder="Search holdings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>

          {/* Holdings Table */}
          <Card className="bg-zinc-900/30 border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900/50 border-b border-zinc-800">
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Stock</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Quantity</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Avg. Price</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Current Price</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Invested</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Current Value</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">P&L</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredHoldings.length > 0 ? (
                    filteredHoldings.map((h) => (
                      <tr key={h.symbol} className="hover:bg-zinc-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400 border border-zinc-700">
                              {h.symbol.split('.')[0].substring(0, 2)}
                            </div>
                            <div>
                              <div className="text-xs font-black text-white">{h.symbol}</div>
                              <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">NSE Listed</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-zinc-300">{h.quantity}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-zinc-300">₹{h.avgBuyPrice.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-white">₹{h.currentPrice.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-zinc-400">₹{h.investedValue.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-white">₹{h.currentValue.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className={cn(
                            "flex flex-col items-end",
                            h.unrealizedPnL >= 0 ? "text-emerald-500" : "text-rose-500"
                          )}>
                            <div className="flex items-center gap-1 text-xs font-black">
                              {h.unrealizedPnL >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              ₹{Math.abs(h.unrealizedPnL).toLocaleString()}
                            </div>
                            <div className="text-[10px] font-bold">
                              {h.unrealizedPnL >= 0 ? '+' : ''}{(h.unrealizedPnLPercent || 0).toFixed(2)}%
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => onTrade(h.symbol, 'BUY')}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all"
                              title="Buy More"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => onTrade(h.symbol, 'SELL')}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                              title="Sell"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3 text-zinc-600">
                          <AlertCircle className="w-8 h-8 opacity-20" />
                          <p className="text-xs font-black uppercase tracking-widest">No holdings found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    );
};

const SummaryCard = ({ 
  label, 
  value, 
  trend, 
  icon: Icon, 
  color 
}: { 
  label: string; 
  value: string; 
  trend?: number; 
  icon: any; 
  color: 'emerald' | 'rose' | 'blue' | 'amber' 
}) => (
  <Card className="bg-zinc-900/50 border-zinc-800 p-5 relative overflow-hidden group">
    <div className={cn(
      "absolute top-0 right-0 w-24 h-24 blur-3xl rounded-full -mr-12 -mt-12 transition-all opacity-20 group-hover:opacity-40",
      color === 'emerald' ? "bg-emerald-500" :
      color === 'rose' ? "bg-rose-500" :
      color === 'blue' ? "bg-blue-500" : "bg-amber-500"
    )} />
    
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center border",
          color === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
          color === 'rose' ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
          color === 'blue' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
          "bg-amber-500/10 border-amber-500/20 text-amber-500"
        )}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter",
            trend >= 0 ? "text-emerald-500" : "text-rose-500"
          )}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend || 0).toFixed(2)}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</h4>
        <p className="text-xl font-black text-white tracking-tighter">{value}</p>
      </div>
    </div>
  </Card>
);
