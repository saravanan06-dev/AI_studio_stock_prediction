import React, { useState } from 'react';
import { 
  X, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  ArrowRightLeft,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { portfolioService, calculateFee } from '../services/portfolioService';
import { Card } from './Card';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  type: 'BUY' | 'SELL';
  currentPrice: number;
  onSuccess: () => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({ 
  isOpen, 
  onClose, 
  symbol, 
  type, 
  currentPrice,
  onSuccess
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const totalValue = quantity * currentPrice;
  const estimatedFee = calculateFee(totalValue);

  const handleTrade = async () => {
    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await portfolioService.placeOrder(symbol, type, quantity, currentPrice);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        setQuantity(1);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md"
      >
        <Card className={cn(
          "bg-zinc-950 border-zinc-800 overflow-hidden shadow-2xl relative",
          type === 'BUY' ? "border-emerald-500/20" : "border-rose-500/20"
        )}>
          {/* Header */}
          <div className={cn(
            "p-6 border-b border-zinc-800 flex items-center justify-between",
            type === 'BUY' ? "bg-emerald-500/5" : "bg-rose-500/5"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg",
                type === 'BUY' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-rose-500/10 border-rose-500/20 text-rose-500"
              )}>
                {type === 'BUY' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tighter uppercase">{type} {symbol}</h3>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Market Order</span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Price Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Price</div>
                <div className="text-xs font-black text-white">₹{currentPrice.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Value</div>
                <div className="text-xs font-black text-white">₹{totalValue.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Fee</div>
                <div className="text-xs font-black text-amber-400">₹{estimatedFee.toLocaleString()}</div>
              </div>
            </div>

            {/* Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Order Quantity</label>
              <div className="relative">
                <input 
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-black border-2 border-zinc-800 rounded-2xl py-4 px-6 text-xl font-black text-white focus:outline-none focus:border-emerald-500/50 transition-all text-center"
                />
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 font-black">#</div>
              </div>
            </div>

            {/* Fee Info */}
            <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-[10px] text-amber-400/80 font-medium">
                Transaction fee of 0.05% (min ₹1) applies. Total cost: ₹{(totalValue + (type === 'BUY' ? estimatedFee : -estimatedFee)).toLocaleString()}
              </p>
            </div>

            {/* Error/Success Messages */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-[10px] font-black uppercase tracking-widest"
                >
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-[10px] font-black uppercase tracking-widest"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Order Executed Successfully
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Button */}
            <button
              onClick={handleTrade}
              disabled={loading || success}
              className={cn(
                "w-full py-4 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3",
                type === 'BUY' 
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20" 
                  : "bg-rose-500 text-white hover:bg-rose-400 shadow-rose-500/20",
                (loading || success) && "opacity-50 cursor-not-allowed"
              )}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Confirm {type} Order
                </>
              )}
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
