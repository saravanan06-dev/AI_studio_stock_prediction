export interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export type OrderType = 'BUY' | 'SELL';

export interface Order {
  id: string;
  uid: string;
  symbol: string;
  type: OrderType;
  quantity: number;
  price: number;
  totalValue: number;
  fee: number;
  timestamp: any; // Firestore Timestamp
  realizedPnL?: number; // Only for SELL
}

export interface Holding {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  investedValue: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface PortfolioSummary {
  totalInvestment: number;
  currentValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  realizedPnL: number;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
