import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, Zap, Star, CheckCircle2, Lock } from 'lucide-react';
import { RazorpayPayment } from './RazorpayPayment';
import { cn } from '../utils/cn';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, amount, onSuccess }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-[32px] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-8 pb-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">Upgrade to Pro</h2>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Unlock Advanced AI Insights</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Features List */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Star, label: "Advanced AI Predictions", color: "text-amber-500" },
                  { icon: Zap, label: "Real-time Data Streams", color: "text-purple-500" },
                  { icon: ShieldCheck, label: "Priority Support", color: "text-emerald-500" },
                  { icon: CheckCircle2, label: "Unlimited Backtesting", color: "text-blue-500" }
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                    <feature.icon className={cn("w-4 h-4", feature.color)} />
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-tight">{feature.label}</span>
                  </div>
                ))}
              </div>

              {/* Razorpay Integration */}
              <div className="pt-4 border-t border-zinc-900">
                <RazorpayPayment 
                  amount={amount} 
                  onSuccess={() => {
                    onSuccess();
                    setTimeout(onClose, 2500);
                  }} 
                  onCancel={onClose} 
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-zinc-900/30 border-t border-zinc-900 flex items-center justify-center gap-4">
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3" />
                PCI DSS Compliant
              </div>
              <div className="w-1 h-1 rounded-full bg-zinc-800" />
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <Lock className="w-3 h-3" />
                256-bit SSL Encryption
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
