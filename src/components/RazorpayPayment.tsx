import React, { useState, useEffect } from 'react';
import { cn } from '../utils/cn';
import { CreditCard, ShieldCheck, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface RazorpayPaymentProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
  userName?: string;
  userEmail?: string;
  userContact?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const RazorpayPayment: React.FC<RazorpayPaymentProps> = ({ 
  amount, 
  onSuccess, 
  onCancel,
  userName = "Guest User",
  userEmail = "user@example.com",
  userContact = "9999999999"
}) => {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = async () => {
    setProcessing(true);
    setError(null);

    try {
      // 1. Create order on server
      const orderResponse = await fetch('/api/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: (import.meta as any).env.VITE_RAZORPAY_KEY_ID || '',
        amount: orderData.amount,
        currency: orderData.currency,
        name: "StockPredict AI",
        description: "Premium Subscription",
        order_id: orderData.id,
        handler: async (response: any) => {
          // 3. Verify payment on server
          try {
            const verifyResponse = await fetch('/api/verify-razorpay-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok && verifyData.status === 'success') {
              setSucceeded(true);
              setTimeout(() => {
                onSuccess();
              }, 2000);
            } else {
              throw new Error(verifyData.message || 'Payment verification failed');
            }
          } catch (err: any) {
            setError(err.message);
            setProcessing(false);
          }
        },
        prefill: {
          name: userName,
          email: userEmail,
          contact: userContact,
        },
        theme: {
          color: "#10b981", // emerald-500
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error('Razorpay error:', err);
      setError(err.message || 'Network error. Please try again.');
      setProcessing(false);
    }
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h3 className="text-xl font-black text-white mb-2">Payment Successful!</h3>
        <p className="text-zinc-400 text-sm">Your transaction has been processed securely.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center">
        <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-6 h-6 text-emerald-500" />
        </div>
        <h3 className="text-lg font-black text-white mb-2">Premium Access</h3>
        <p className="text-zinc-400 text-sm mb-6">
          Get unlimited AI predictions, advanced technical indicators, and real-time alerts.
        </p>
        
        <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-emerald-500 uppercase mb-6">
          <ShieldCheck className="w-3 h-3" />
          Secure Payment via Razorpay
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs mb-4 animate-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 rounded-2xl bg-zinc-900 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all"
          >
            Cancel
          </button>
          <button
            disabled={processing}
            onClick={handlePayment}
            className={cn(
              "flex-[2] px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              processing
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
            )}
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay ₹${amount.toFixed(2)}`
            )}
          </button>
        </div>
      </div>

      <p className="text-[10px] text-center text-zinc-500 uppercase tracking-tighter">
        Payments are processed securely by Razorpay. No card data is stored on our servers.
      </p>
    </div>
  );
};
