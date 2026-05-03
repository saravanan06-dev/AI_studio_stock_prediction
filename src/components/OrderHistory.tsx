import React, { useState, useEffect } from 'react';
import { 
  History, 
  Clock,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Download,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { portfolioService } from '../services/portfolioService';
import { Order } from '../types';
import { Card } from './Card';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const OrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | '7D' | '30D' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDates, setShowCustomDates] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const o = await portfolioService.getOrderHistory();
        setOrders(o);
      } catch (error) {
        console.error('Error fetching order history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || o.type === typeFilter;
    
    let matchesDate = true;
    if (o.timestamp) {
      const orderDate = o.timestamp.toDate();
      const now = new Date();

      if (dateRangeFilter === '7D') {
        matchesDate = isWithinInterval(orderDate, {
          start: startOfDay(subDays(now, 7)),
          end: endOfDay(now)
        });
      } else if (dateRangeFilter === '30D') {
        matchesDate = isWithinInterval(orderDate, {
          start: startOfDay(subDays(now, 30)),
          end: endOfDay(now)
        });
      } else if (dateRangeFilter === 'CUSTOM' && customStartDate && customEndDate) {
        matchesDate = isWithinInterval(orderDate, {
          start: startOfDay(new Date(customStartDate)),
          end: endOfDay(new Date(customEndDate))
        });
      }
    }

    return matchesSearch && matchesType && matchesDate;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-12 bg-zinc-900 rounded-xl w-1/4" />
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
            <History className="w-8 h-8 text-emerald-500" />
            📜 Order History
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-1 uppercase tracking-widest">Complete record of your transactions</p>
        </div>
        <button 
          className="px-4 py-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition-all"
          onClick={() => {
            // Placeholder for export functionality
            console.log('Exporting history...');
          }}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500" />
              <div className="flex bg-black/40 p-1 rounded-lg border border-zinc-800">
                {(['ALL', 'BUY', 'SELL'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                      typeFilter === t ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <div className="flex bg-black/40 p-1 rounded-lg border border-zinc-800">
                {(['ALL', '7D', '30D', 'CUSTOM'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setDateRangeFilter(r);
                      if (r === 'CUSTOM') setShowCustomDates(true);
                      else setShowCustomDates(false);
                    }}
                    className={cn(
                      "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                      dateRangeFilter === r ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Search by symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
        </div>

        <AnimatePresence>
          {showCustomDates && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-zinc-800/50 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">From</span>
                  <input 
                    type="date" 
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-black/40 border border-zinc-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">To</span>
                  <input 
                    type="date" 
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-black/40 border border-zinc-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Orders Table */}
      <Card className="bg-zinc-900/30 border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Transaction Log</h3>
          </div>
          <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
            {filteredOrders.length} transactions found
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/20 border-b border-zinc-800">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Date & Time</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Stock</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Quantity</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Price</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Value</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Fee</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Net</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Realized P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-zinc-600" />
                        <div className="text-[10px] font-bold text-zinc-400">
                          {o.timestamp ? format(o.timestamp.toDate(), 'MMM dd, HH:mm') : 'Pending...'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[8px] font-black text-zinc-500 border border-zinc-700">
                          {o.symbol.split('.')[0].substring(0, 2)}
                        </div>
                        <span className="text-xs font-black text-white">{o.symbol}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                        o.type === 'BUY' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      )}>
                        {o.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-zinc-300">{o.quantity}</td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-zinc-300">₹{o.price.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-zinc-300">₹{o.totalValue.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-amber-500/60">₹{(o.fee || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-white">
                      ₹{(o.totalValue + (o.type === 'BUY' ? (o.fee || 0) : -(o.fee || 0))).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {o.type === 'SELL' && o.realizedPnL !== undefined ? (
                        <div className={cn(
                          "flex items-center justify-end gap-1 text-xs font-black",
                          o.realizedPnL >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {o.realizedPnL >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          ₹{Math.abs(o.realizedPnL).toLocaleString()}
                        </div>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-zinc-600">
                      <AlertCircle className="w-8 h-8 opacity-20" />
                      <p className="text-xs font-black uppercase tracking-widest">No transactions found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
