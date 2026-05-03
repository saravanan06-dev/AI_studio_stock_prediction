import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  orderBy,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Order, OrderType, Holding } from '../types';

const FEE_PERCENTAGE = 0.0005; // 0.05%
const MIN_FEE = 1; // ₹1 minimum fee

export function calculateFee(totalValue: number) {
  const fee = totalValue * FEE_PERCENTAGE;
  return Math.max(fee, MIN_FEE);
}

export const portfolioService = {
  async placeOrder(symbol: string, type: OrderType, quantity: number, price: number) {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const uid = auth.currentUser.uid;
    const totalValue = quantity * price;
    const fee = calculateFee(totalValue);

    // 1. Get all orders for this symbol to reconstruct the FIFO pool
    const allOrdersQuery = query(
      collection(db, 'orders'),
      where('uid', '==', uid),
      where('symbol', '==', symbol),
      orderBy('timestamp', 'asc')
    );
    const allOrdersSnap = await getDocs(allOrdersQuery);
    const allOrders = allOrdersSnap.docs.map(d => d.data() as Order);

    // Reconstruct the current FIFO pool from history
    let buyPool: { quantity: number, price: number, feePerShare: number }[] = [];
    allOrders.forEach(order => {
      if (order.type === 'BUY') {
        buyPool.push({ 
          quantity: order.quantity, 
          price: order.price, 
          feePerShare: (order.fee || 0) / order.quantity 
        });
      } else {
        let sellQty = order.quantity;
        while (sellQty > 0 && buyPool.length > 0) {
          if (buyPool[0].quantity <= sellQty) {
            sellQty -= buyPool[0].quantity;
            buyPool.shift();
          } else {
            buyPool[0].quantity -= sellQty;
            sellQty = 0;
          }
        }
      }
    });

    let realizedPnL = 0;
    let newInvestedValue = 0;
    let newQuantity = 0;

    if (type === 'BUY') {
      // Add the new order to the pool to calculate new holding state
      const feePerShare = fee / quantity;
      buyPool.push({ quantity, price, feePerShare });
      
      newQuantity = buyPool.reduce((sum, item) => sum + item.quantity, 0);
      newInvestedValue = buyPool.reduce((sum, item) => sum + (item.quantity * (item.price + item.feePerShare)), 0);
    } else {
      const currentTotalQuantity = buyPool.reduce((sum, item) => sum + item.quantity, 0);
      if (currentTotalQuantity < quantity) {
        throw new Error('Insufficient quantity to sell');
      }

      let sellQty = quantity;
      let totalCostBasis = 0;
      
      // Process the sell using FIFO
      while (sellQty > 0 && buyPool.length > 0) {
        const take = Math.min(sellQty, buyPool[0].quantity);
        totalCostBasis += take * (buyPool[0].price + buyPool[0].feePerShare);
        
        if (buyPool[0].quantity <= sellQty) {
          sellQty -= buyPool[0].quantity;
          buyPool.shift();
        } else {
          buyPool[0].quantity -= sellQty;
          sellQty = 0;
        }
      }
      
      // Realized P&L = (Sell Value - Sell Fee) - Cost Basis (which includes Buy Fees)
      realizedPnL = (totalValue - fee) - totalCostBasis;
      
      newQuantity = buyPool.reduce((sum, item) => sum + item.quantity, 0);
      newInvestedValue = buyPool.reduce((sum, item) => sum + (item.quantity * (item.price + item.feePerShare)), 0);
    }

    // 2. Create the order
    const orderData = {
      uid,
      symbol,
      type,
      quantity,
      price,
      totalValue,
      fee,
      timestamp: serverTimestamp(),
      ...(type === 'SELL' && { realizedPnL })
    };
    await addDoc(collection(db, 'orders'), orderData);

    // 3. Update Holding
    const holdingRef = doc(db, 'holdings', `${uid}_${symbol}`);
    const newAvgPrice = newQuantity > 0 ? newInvestedValue / newQuantity : 0;

    await setDoc(holdingRef, {
      uid,
      symbol,
      quantity: newQuantity,
      avgBuyPrice: newAvgPrice,
      investedValue: newInvestedValue,
      lastUpdatedAt: serverTimestamp()
    });
  },

  async getHoldings() {
    if (!auth.currentUser) return [];
    const q = query(
      collection(db, 'holdings'),
      where('uid', '==', auth.currentUser.uid),
      where('quantity', '>', 0)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as Holding);
  },

  async getOrderHistory() {
    if (!auth.currentUser) return [];
    const q = query(
      collection(db, 'orders'),
      where('uid', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Order);
  }
};
