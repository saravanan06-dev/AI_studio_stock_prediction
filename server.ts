import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import YahooFinance from "yahoo-finance2";
import { format, subDays } from "date-fns";

const yf = new (YahooFinance as any)();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const searchResult = await yf.search(query) as any;
      const suggestions = (searchResult.quotes || [])
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          type: q.quoteType || 'EQUITY',
          exchDisp: q.exchDisp
        }))
        .slice(0, 15); // Return more results for the dedicated search
      
      res.json(suggestions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stock/:symbol", async (req, res) => {
    try {
      let symbol = req.params.symbol.toUpperCase();
      const queryOptions = {
        period1: subDays(new Date(), 365),
        period2: new Date(),
        interval: "1d" as const,
      };
      
      let chartResult: any = null;
      
      const attemptFetch = async (sym: string) => {
        try {
          return await yf.chart(sym, queryOptions);
        } catch (e) {
          return null;
        }
      };

      // First attempt
      chartResult = await attemptFetch(symbol);
      
      // If first attempt fails, try searching for related symbols
      if (!chartResult || !chartResult.quotes || chartResult.quotes.length === 0) {
        const searchResult = await yf.search(symbol) as any;
        if (searchResult.quotes && searchResult.quotes.length > 0) {
          // Filter for valid symbols and remove duplicates
          const suggestions = searchResult.quotes
            .filter((q: any) => q.symbol)
            .slice(0, 12) // Increased from 5
            .map((q: any) => ({
              symbol: q.symbol,
              name: q.shortname || q.longname || q.symbol,
              type: q.quoteType || 'EQUITY'
            }));
          
          if (suggestions.length > 0) {
            // Check if the first suggestion is a very strong match and try it automatically
            const bestMatch = suggestions[0].symbol;
            if (bestMatch.toUpperCase() === symbol) {
               const secondAttempt = await attemptFetch(bestMatch);
               if (secondAttempt && secondAttempt.quotes && secondAttempt.quotes.length > 0) {
                 chartResult = secondAttempt;
                 symbol = bestMatch;
               }
            }

            if (!chartResult) {
              return res.status(404).json({ 
                error: `No data found for "${req.params.symbol}".`,
                suggestions: suggestions
              });
            }
          }
        }
      }
      
      if (!chartResult || !chartResult.quotes || chartResult.quotes.length === 0) {
        return res.status(404).json({ error: `No data found for symbol "${req.params.symbol}". It may be delisted or invalid.` });
      }

      // Format chart quotes to match expected historical format if needed
      const formattedResult = (chartResult.quotes as any[]).map(q => ({
        date: q.date,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
        adjClose: q.adjclose
      }));

      // Fetch related symbols even on success
      let related: any[] = [];
      try {
        const searchResult = await yf.search(symbol) as any;
        if (searchResult.quotes && searchResult.quotes.length > 0) {
          related = searchResult.quotes
            .filter((q: any) => q.symbol && q.symbol !== symbol)
            .slice(0, 12) // Increased from 6
            .map((q: any) => ({
              symbol: q.symbol,
              name: q.shortname || q.longname || q.symbol,
              type: q.quoteType || 'EQUITY'
            }));
        }
      } catch (e) {
        console.error("Error fetching related symbols:", e);
      }

      res.json({
        symbol,
        quotes: formattedResult,
        related
      });
    } catch (error: any) {
      console.error("Error fetching stock data:", error);
      const details = error.errors || error.subErrors || null;
      if (details) {
        console.error("Validation details:", JSON.stringify(details, null, 2));
      }
      res.status(500).json({ error: error.message, details });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
