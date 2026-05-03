import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, User, Bird, X, Minimize2, Maximize2, Loader2, Image as ImageIcon } from 'lucide-react';
import { chatWithAI } from '../services/geminiService';
import { cn } from '../utils/cn';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

interface ChatBotProps {
  className?: string;
  title?: string;
  onOpenKeySelector?: () => void;
  context?: string;
}

export const ChatBot: React.FC<ChatBotProps> = ({ className, title = "Storm Bird AI", onOpenKeySelector, context }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am Storm Bird AI, your advanced market intelligence assistant. How can I help you navigate the markets today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastErrorWasRateLimit, setLastErrorWasRateLimit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setLastErrorWasRateLimit(false);

    try {
      const response = await chatWithAI(userMessage, context);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.text,
        imageUrl: response.imageUrl 
      }]);
      if (response.isRateLimit) {
        setLastErrorWasRateLimit(true);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  return (
    <div className={cn("bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[400px]", className)}>
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
            <Bird className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg, i) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={i}
            className={cn(
              "flex gap-3 max-w-[85%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              msg.role === 'user' ? "bg-zinc-800" : "bg-emerald-500/10"
            )}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-zinc-400" /> : <Bird className="w-4 h-4 text-emerald-500" />}
            </div>
            <div className={cn(
              "p-3 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' ? "bg-zinc-800 text-white rounded-tr-none" : "bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-none"
            )}>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
              
              {msg.imageUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-zinc-800 group relative">
                  <img 
                    src={msg.imageUrl} 
                    alt="AI Generated" 
                    className="w-full h-auto object-cover cursor-zoom-in transition-transform group-hover:scale-105"
                    onClick={() => setZoomedImage(msg.imageUrl!)}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <Maximize2 className="w-5 h-5 text-white" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-3 mr-auto">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
              <Bird className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl rounded-tl-none">
              <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
            </div>
          </div>
        )}
        {lastErrorWasRateLimit && onOpenKeySelector && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl"
          >
            <p className="text-xs text-amber-500 text-center font-medium">
              The shared AI quota is exhausted. Use your own API key for unlimited access.
            </p>
            <button 
              onClick={onOpenKeySelector}
              className="px-4 py-2 bg-amber-500 text-black text-xs font-bold rounded-lg hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
            >
              Select API Key
            </button>
          </motion.div>
        )}
      </div>

      <div className="p-4 bg-zinc-900/80 border-t border-zinc-800">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about any stock or ask for a chart..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-12"
            onClick={() => setZoomedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-2 bg-zinc-800 rounded-full text-white hover:bg-zinc-700 transition-colors"
              onClick={() => setZoomedImage(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={zoomedImage}
              alt="Zoomed AI content"
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
