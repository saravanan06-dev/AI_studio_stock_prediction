import express from "express";
console.log("[SERVER] Starting server.ts...");
import { createServer as createViteServer } from "vite";
import path from "path";
import YahooFinance from "yahoo-finance2";
// The user requested initialization: const yahooFinance = new YahooFinance();
const yahooFinance = new (YahooFinance as any)();
import { format, subDays } from "date-fns";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import Razorpay from "razorpay";
import crypto from "crypto";
import { spawn } from "child_process";
import fs from "fs";

// Initialize Razorpay lazily
let razorpay: any = null;
const getRazorpay = () => {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      console.warn("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set. Razorpay functionality will be disabled.");
      return null;
    }
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpay;
};

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Start Python ML Backend immediately
  startPythonBackend();

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Start Python ML Backend
  function startPythonBackend() {
    console.log("[SERVER] startPythonBackend() called. CWD:", process.cwd());
    const pythonMlDir = path.join(process.cwd(), 'python_ml');
    
    // Add logic to include local bin in PATH for pip
    const localBin = path.join(process.env.HOME || '/root', '.local/bin');
    console.log("[SERVER] Local bin path:", localBin);
    const pythonEnv = { 
      ...process.env, 
      PATH: `${process.env.PATH}:${localBin}`,
      PYTHONPATH: pythonMlDir
    };

    const runPipInstall = (bootstrapAttempted = false) => {
      console.log("[SERVER] Running pip install...");
      const packages = ["pandas", "numpy", "yfinance", "scikit-learn", "xgboost", "fastapi", "uvicorn", "requests", "joblib"];
      
      const tryInstall = (args: string[], onDone: (code: number) => void) => {
        console.log(`[SERVER] Executing: python3 -m pip install ${args.join(' ')}`);
        const p = spawn("python3", ["-m", "pip", "install", ...args], { cwd: pythonMlDir, env: pythonEnv });
        p.stdout.on('data', (d) => console.log(`[PIP STDOUT] ${d}`));
        p.stderr.on('data', (d) => console.error(`[PIP STDERR] ${d}`));
        p.on("exit", onDone);
      };

      tryInstall(["--no-cache-dir", ...packages], (code) => {
        if (code === 0) {
          console.log("[SERVER] Pip installation successful.");
          runActualBackend();
        } else {
          tryInstall(["--user", "--no-cache-dir", ...packages], (uCode) => {
            if (uCode === 0) {
              console.log("[SERVER] Pip --user installation successful.");
              runActualBackend();
            } else if (!bootstrapAttempted) {
              console.error("[SERVER] Pip failed. Bootstrapping pip...");
              const downloader = spawn("python3", ["-c", "import urllib.request; urllib.request.urlretrieve('https://bootstrap.pypa.io/get-pip.py', 'get-pip.py')"], { cwd: pythonMlDir });
              downloader.on("exit", (dCode) => {
                if (dCode === 0) {
                  const installer = spawn("python3", ["get-pip.py", "--force-reinstall"], { cwd: pythonMlDir, env: pythonEnv });
                  installer.stdout.on('data', (d) => console.log(`[BOOTSTRAP STDOUT] ${d}`));
                  installer.stderr.on('data', (d) => console.error(`[BOOTSTRAP STDERR] ${d}`));
                  installer.on("exit", (iCode) => {
                    if (iCode === 0) runPipInstall(true);
                    else {
                      // One last try with --user for bootstrap
                      const installerUser = spawn("python3", ["get-pip.py", "--user", "--force-reinstall"], { cwd: pythonMlDir, env: pythonEnv });
                      installerUser.on("exit", (iuCode) => {
                        if (iuCode === 0) runPipInstall(true);
                        else oneByOneFallback();
                      });
                    }
                  });
                } else oneByOneFallback();
              });
            } else {
              oneByOneFallback();
            }
          });
        }
      });

      const oneByOneFallback = () => {
        let currentIdx = 0;
        const installNext = () => {
          if (currentIdx >= packages.length) {
            runActualBackend();
            return;
          }
          const pkg = packages[currentIdx];
          console.log(`[SERVER] Installing ${pkg}...`);
          const p = spawn("python3", ["-m", "pip", "install", "--user", pkg], { cwd: pythonMlDir, env: pythonEnv });
          p.on("exit", () => {
            currentIdx++;
            installNext();
          });
        };
        installNext();
      };
    };

    console.log("[SERVER] Probing Python dependencies...");
    const checker = spawn("python3", ["-c", "import pandas, numpy, fastapi, uvicorn, xgboost"], { 
      cwd: pythonMlDir,
      env: pythonEnv
    });
    
    checker.on("error", (err) => {
      console.error("[SERVER] Failed to start python3 checker:", err);
    });
    
    checker.on("exit", (code) => {
      console.log(`[SERVER] Python dependency checker exited with code ${code}`);
      if (code === 0) {
        console.log("[SERVER] Python dependencies OK.");
        runActualBackend();
      } else {
        console.log("[SERVER] Python dependencies MISSING or Python error. Bootstrapping...");
        runPipInstall();
      }
    });

    let backendRunning = false;
    function runActualBackend() {
      if (backendRunning) return;
      backendRunning = true;

      console.log(`[SERVER] Starting Python Backend. CWD: ${pythonMlDir}`);
      
      const pythonProcess = spawn("python3", ["api_backend.py"], { 
        cwd: pythonMlDir,
        env: pythonEnv
      });
      pythonProcess.stdout.on('data', (d) => console.log(`[BACKEND STDOUT] ${d}`));
      pythonProcess.stderr.on('data', (d) => console.error(`[BACKEND STDERR] ${d}`));
      pythonProcess.on("exit", (code) => {
        console.log(`[SERVER] Python Backend exited with code ${code}`);
        backendRunning = false;
        if (code !== 0) setTimeout(runActualBackend, 15000);
      });

      console.log(`[SERVER] Starting Model Trainer. CWD: ${pythonMlDir}`);
      const trainer = spawn("python3", ["model_trainer.py"], { 
        cwd: pythonMlDir,
        env: pythonEnv
      });
      trainer.stdout.on('data', (d) => console.log(`[TRAINER STDOUT] ${d}`));
      trainer.stderr.on('data', (d) => console.error(`[TRAINER STDERR] ${d}`));
    }
  }

  // WebSocket Server
  const wss = new WebSocketServer({ server });
  const clients = new Map<WebSocket, Set<string>>();

  wss.on("connection", (ws) => {
    console.log("New WebSocket connection");
    clients.set(ws, new Set());

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "subscribe") {
          const symbols = clients.get(ws);
          if (symbols) {
            data.symbols.forEach((s: string) => symbols.add(s.toUpperCase()));
          }
        } else if (data.type === "unsubscribe") {
          const symbols = clients.get(ws);
          if (symbols) {
            data.symbols.forEach((s: string) => symbols.delete(s.toUpperCase()));
          }
        }
      } catch (e) {
        console.error("WS message error:", e);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log("WebSocket connection closed");
    });
  });

  // Price Update Loop
  const priceCache = new Map<string, number>();
  let isFetching = false;
  let lastFetchError = 0;
  const FETCH_INTERVAL = 5000; // Update every 5 seconds
  const RETRY_DELAY = 60000; // 1 minute delay if rate limited (429)

  setInterval(async () => {
    if (isFetching) return;
    
    const now = Date.now();
    if (now - lastFetchError < RETRY_DELAY && lastFetchError !== 0) {
      return;
    }

    const allSymbols = new Set<string>();
    clients.forEach((symbols) => {
      symbols.forEach((s) => allSymbols.add(s));
    });

    if (allSymbols.size === 0) return;

    const symbolsArray = Array.from(allSymbols);
    isFetching = true;

    try {
      const chunkSize = 50;
      const updatesMap = new Map<string, any>();

      for (let i = 0; i < symbolsArray.length; i += chunkSize) {
        const chunk = symbolsArray.slice(i, i + chunkSize);
        try {
          // Fetch batch quotes from Yahoo Finance
          const quotes = await yahooFinance.quote(chunk);
          const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

          quotesArray.forEach((quote: any) => {
            if (quote && quote.symbol) {
              const symbol = quote.symbol.toUpperCase();
              const price = quote.regularMarketPrice;
              const prevPrice = priceCache.get(symbol);
              
              if (price !== undefined) {
                priceCache.set(symbol, price);
                updatesMap.set(symbol, {
                  symbol,
                  price,
                  timestamp: new Date().toISOString(),
                  change: prevPrice ? (price - prevPrice) / prevPrice : 0,
                  high: quote.regularMarketDayHigh,
                  low: quote.regularMarketDayLow,
                  volume: quote.regularMarketVolume
                });
              }
            }
          });
        } catch (e: any) {
          console.error(`Batch fetch error for chunk:`, e.message);
          if (e.message.includes('429')) {
            lastFetchError = Date.now();
            console.warn("Yahoo Finance rate limit hit, backing off...");
            break; 
          }
        }
      }

      if (updatesMap.size > 0) {
        // Broadcast to interested clients effectively
        clients.forEach((symbols, ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            const clientUpdates: any[] = [];
            symbols.forEach(s => {
              const update = updatesMap.get(s);
              if (update) clientUpdates.push(update);
            });
            
            if (clientUpdates.length > 0) {
              ws.send(JSON.stringify({ type: "update", data: clientUpdates }));
            }
          }
        });
      }
      
      // Reset error state on success
      if (lastFetchError !== 0) lastFetchError = 0;
      
    } catch (e: any) {
      console.error("Price update loop error:", e.message);
    } finally {
      isFetching = false;
    }
  }, FETCH_INTERVAL);

  // API Routes
  app.get("/api/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      console.log(`Search request for: "${query}"`);
      
      let searchResult: any = null;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (attempts < maxAttempts) {
        try {
          searchResult = await yahooFinance.search(query);
          break;
        } catch (e) {
          attempts++;
          if (attempts >= maxAttempts) throw e;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const suggestions = (searchResult.quotes || [])
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          type: q.quoteType || 'EQUITY',
          exchDisp: q.exchDisp
        }))
        .slice(0, 15);
      
      res.json(suggestions);
    } catch (error: any) {
      console.error(`Search error for "${req.params.query}":`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/quotes", async (req, res) => {
    try {
      const { symbols } = req.body;
      if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.json([]);
      }
      // yahooFinance.quote can take an array of symbols
      const quotes = await yahooFinance.quote(symbols);
      // Ensure it's always an array even for single symbol
      const result = Array.isArray(quotes) ? quotes : [quotes];
      res.json(result);
    } catch (error: any) {
      console.error("Batch quote error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Razorpay Order Creation Endpoint
  app.post("/api/create-razorpay-order", async (req, res) => {
    try {
      const { amount, currency = "INR", receipt } = req.body;
      
      const razorpayInstance = getRazorpay();
      if (!razorpayInstance) {
        return res.status(500).json({ error: "Razorpay is not configured on the server." });
      }

      const options = {
        amount: Math.round(amount * 100), // Razorpay expects amount in paise
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
      };

      const order = await razorpayInstance.orders.create(options);
      res.json(order);
    } catch (error: any) {
      console.error("Razorpay Order error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Razorpay Payment Verification Endpoint
  app.post("/api/verify-razorpay-payment", async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        return res.status(500).json({ error: "Razorpay secret key is missing." });
      }

      const hmac = crypto.createHmac("sha256", keySecret);
      hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
      const generated_signature = hmac.digest("hex");

      if (generated_signature === razorpay_signature) {
        res.json({ status: "success", message: "Payment verified successfully" });
      } else {
        res.status(400).json({ status: "failure", message: "Invalid signature" });
      }
    } catch (error: any) {
      console.error("Razorpay Verification error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ml-predict/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      
      const fetchWithMultiAddress = async (subPath: string) => {
        const addresses = ["http://127.0.0.1:8001", "http://localhost:8001", "http://0.0.0.0:8001"];
        let lastError = null;
        
        for (const address of addresses) {
          try {
            console.log(`[SERVER] Attempting ML prediction for ${symbol} at ${address}${subPath}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(`${address}${subPath}`, {
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) return await response.json();
            console.warn(`[SERVER] ${address} returned status ${response.status}`);
          } catch (e: any) {
            lastError = e;
            console.warn(`[SERVER] Connection to ${address} failed: ${e.message}`);
          }
        }
        throw lastError || new Error("All ML backend addresses failed");
      };
      
      try {
        const data = await fetchWithMultiAddress(`/predict?symbol=${symbol}`);
        res.json(data);
      } catch (e: any) {
        console.warn(`[SERVER] ML backend unavailable, using Gemini fallback for ${symbol}`);
        
        try {
          const { getStockPrediction } = await import("./src/services/geminiService");
          // Generate dummy/mock data for Gemini if needed, but it usually uses historical context
          // Since we don't have the data here easily (it's in the frontend usually),
          // we'll just return a message saying fallback is active.
          
          res.json({
            symbol,
            prediction: "NEUTRAL",
            confidence: 0.5,
            error: "ML Backend offline. Gemini analysis available in UI.",
            isFallback: true
          });
        } catch (fallbackError) {
          res.json({
            symbol,
            prediction: "NEUTRAL",
            confidence: 0,
            error: "ML Backend and Fallback unavailable.",
            isOffline: true
          });
        }
      }
    } catch (error: any) {
      console.error("[SERVER] ML Predict Route unexpected error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stock/:symbol", async (req, res) => {
    try {
      let symbol = req.params.symbol.toUpperCase();
      const interval = (req.query.interval as string) || "1d";
      
      // Map common UI timeframes to Yahoo Finance intervals
      const intervalMap: Record<string, any> = {
        "1m": "1m",
        "2m": "2m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "1h",
        "1d": "1d",
        "1w": "1wk",
        "1mo": "1mo",
        "3mo": "3mo"
      };

      const yfInterval = intervalMap[interval] || "1d";
      
      // Adjust lookback based on interval to avoid data limits
      let daysBack = 365;
      if (yfInterval === "1m" || yfInterval === "2m" || yfInterval === "5m") daysBack = 7;
      else if (yfInterval === "15m" || yfInterval === "30m") daysBack = 30;
      else if (yfInterval === "1h") daysBack = 60;

      const queryOptions = {
        period1: subDays(new Date(), daysBack),
        period2: new Date(),
        interval: yfInterval,
      };
      
      let chartResult: any = null;
      
      const attemptFetch = async (sym: string) => {
        try {
          console.log(`[SERVER] Fetching chart for ${sym} with interval ${yfInterval}`);
          // Use historical if chart fails or for longer periods
          let result: any = null;
          try {
            result = await yahooFinance.chart(sym, queryOptions);
          } catch (chartError) {
            console.warn(`[SERVER] yahooFinance.chart failed for ${sym}, trying yahooFinance.historical...`);
            const historicalData: any = await yahooFinance.historical(sym, {
              period1: queryOptions.period1,
              period2: queryOptions.period2,
              interval: yfInterval as any,
            });
            if (historicalData && historicalData.length > 0) {
              result = {
                quotes: historicalData.map((d: any) => ({
                  date: d.date,
                  open: d.open,
                  high: d.high,
                  low: d.low,
                  close: d.close,
                  volume: d.volume,
                  adjClose: d.adjClose
                }))
              };
            }
          }

          if (result && result.quotes && result.quotes.length > 0) {
            console.log(`[SERVER] Successfully fetched ${result.quotes.length} quotes for ${sym}`);
            return result;
          }
          return null;
        } catch (e: any) {
          console.error(`[SERVER] Error fetching data for ${sym}:`, e.message);
          return null;
        }
      };

      // First attempt
      chartResult = await attemptFetch(symbol);
      
      // If first attempt fails, try searching for related symbols
      if (!chartResult || !chartResult.quotes || chartResult.quotes.length === 0) {
        try {
          const searchResult = await yahooFinance.search(symbol) as any;
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
      } catch (e) {
          console.error("[SERVER] Error during search fallback:", e);
        }
      }
      
      if (!chartResult || !chartResult.quotes || chartResult.quotes.length === 0) {
        return res.status(404).json({ error: `No data found for symbol "${req.params.symbol}". It may be delisted or invalid.` });
      }

      // Format chart quotes to match expected historical format if needed
      // Important: Filter out quotes with null values which Yahoo Finance sometimes returns for holidays/missing data
      const formattedResult = (chartResult.quotes as any[])
        .filter(q => q && q.date && q.close !== null && q.open !== null && q.high !== null && q.low !== null)
        .map(q => ({
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
        const searchResult = await yahooFinance.search(symbol) as any;
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
        name: chartResult.meta?.shortName || chartResult.meta?.longName || symbol,
        quotes: formattedResult,
        quote: await (async () => {
          try {
            return await yahooFinance.quote(symbol);
          } catch (error) {
            console.warn(`[SERVER] Yahoo Finance quote failed for ${symbol}:`, error);
            // Fallback: create a minimal quote object from chart data
            const lastCandle = formattedResult[formattedResult.length - 1];
            return {
              symbol,
              regularMarketPrice: lastCandle?.close,
              regularMarketChange: 0,
              regularMarketChangePercent: 0,
              currency: 'INR'
            };
          }
        })(),
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
    try {
      console.log("[SERVER] Initializing Vite middleware...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[SERVER] Vite middleware initialized.");
    } catch (viteError) {
      console.error("[SERVER] Failed to initialize Vite middleware:", viteError);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.warn("[SERVER] dist directory not found. Static serving disabled.");
    }
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Test yahoo-finance2
    yahooFinance.search("AAPL").then(() => {
      console.log("[SERVER] yahoo-finance2 is operational.");
    }).catch((err: any) => {
      console.error("[SERVER] yahoo-finance2 test failed:", err.message || err);
    });

    // Start Python ML Backend AFTER server is listening to avoid blocking startup
    // startPythonBackend(); // Moved up
  });
}

process.on("uncaughtException", (err) => {
  console.error("[SERVER] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[SERVER] Unhandled Rejection at:", promise, "reason:", reason);
});

startServer().catch(err => {
  console.error("[SERVER] Failed to start server:", err);
});
