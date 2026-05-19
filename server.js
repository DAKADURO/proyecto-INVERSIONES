require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =============================================================================
// IN-MEMORY DATABASE STATE (Supporting Real-time and Simulated modes)
// =============================================================================

const assets = {
  AAPL: { name: 'Apple Inc.', type: 'Stock', price: 189.50, change: 0.85, high: 191.00, low: 188.20, history: [], sma: [], ema: [], rsi: [], macd: [], signal: [], hist: [] },
  TSLA: { name: 'Tesla Inc.', type: 'Stock', price: 174.80, change: -1.24, high: 178.50, low: 172.90, history: [], sma: [], ema: [], rsi: [], macd: [], signal: [], hist: [] },
  MSFT: { name: 'Microsoft Corp.', type: 'Stock', price: 421.90, change: 1.45, high: 423.80, low: 418.50, history: [], sma: [], ema: [], rsi: [], macd: [], signal: [], hist: [] },
  FUNO11: { name: 'FIBRA Uno', type: 'FIBRA', price: 25.50, change: 0.12, high: 26.00, low: 25.10, history: [], sma: [], ema: [], rsi: [], macd: [], signal: [], hist: [], suffix: '.MX' },
  FMTY14: { name: 'FIBRA Monterrey', type: 'FIBRA', price: 11.20, change: -0.44, high: 11.50, low: 11.10, history: [], sma: [], ema: [], rsi: [], macd: [], signal: [], hist: [], suffix: '.MX' },
  WALMEX: { name: 'Walmart de México', type: 'Stock', price: 68.30, change: 0.55, high: 69.10, low: 67.80, history: [], sma: [], ema: [], rsi: [], macd: [], signal: [], hist: [], suffix: '.MX' },
  CEMEX: { name: 'Cemex SAB', type: 'Stock', price: 13.40, change: -1.10, high: 13.80, low: 13.20, history: [], sma: [], ema: [], rsi: [], macd: [], signal: [], hist: [], suffix: '.MX' },
  AMX: { name: 'América Móvil', type: 'Stock', price: 15.80, change: 0.22, high: 16.10, low: 15.60, history: [], sma: [], ema: [], rsi: [], macd: [], signal: [], hist: [], suffix: '.MX' },
  BTC: { name: 'Bitcoin', type: 'Crypto', price: 66850.00, change: 3.12, high: 67200.00, low: 64800.00, history: [], sma: [], ema: [], rsi: [], macd: [], signal: [], hist: [] },
  ETH: { name: 'Ethereum', type: 'Crypto', price: 3480.00, change: 2.54, high: 3510.00, low: 3390.00, history: [], sma: [], ema: [], rsi: [], macd: [], signal: [], hist: [] }
};

// Seed historical data initially
const HISTORY_POINTS = 50;
Object.keys(assets).forEach(ticker => {
  const asset = assets[ticker];
  let currentPrice = asset.price * (1 - (HISTORY_POINTS * 0.0015));
  for (let i = 0; i < HISTORY_POINTS; i++) {
    const volatility = asset.type === 'Crypto' ? 0.008 : 0.003;
    const changePct = (Math.random() - 0.48) * volatility;
    currentPrice = currentPrice * (1 + changePct);
    asset.history.push(Number(currentPrice.toFixed(2)));
  }
  asset.price = asset.history[asset.history.length - 1];
});

// Alerts Storage
let alerts = [
  { id: '1', asset: 'AAPL', metric: 'price', condition: 'above', threshold: 190.00, isTriggered: false, lastTriggered: null },
  { id: '2', asset: 'BTC', metric: 'rsi', condition: 'below', threshold: 30.00, isTriggered: false, lastTriggered: null }
];

// SMTP Settings Storage
let smtpSettings = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  user: process.env.SMTP_USER || 'your_email@gmail.com',
  pass: process.env.SMTP_PASS || 'your_app_password',
  to: process.env.EMAIL_TO || 'recipient_email@gmail.com',
  mock: process.env.MOCK_EMAIL === 'false' ? false : true,
  // NEW real-time settings
  marketMode: 'simulated', // 'simulated' or 'real'
  alphaVantageKey: process.env.ALPHA_VANTAGE_KEY || ''
};

// Simulated Portfolio
let portfolio = {
  balance: 10000.00,
  holdings: {
    AAPL: 10,
    BTC: 0.05
  }
};

// =============================================================================
// TECHNICAL INDICATORS MATHEMATICAL ENGINE
// =============================================================================

function calculateSMA(prices, period = 14) {
  const sma = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(Number((sum / period).toFixed(2)));
    }
  }
  return sma;
}

function calculateEMA(prices, period = 14) {
  const ema = [];
  const k = 2 / (period + 1);
  let currentEma = null;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ema.push(null);
    } else if (i === period - 1) {
      const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
      currentEma = sum / period;
      ema.push(Number(currentEma.toFixed(2)));
    } else {
      currentEma = prices[i] * k + currentEma * (1 - k);
      ema.push(Number(currentEma.toFixed(2)));
    }
  }
  return ema;
}

function calculateRSI(prices, period = 14) {
  const rsi = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < prices.length; i++) rsi.push(null);
  if (prices.length <= period) return rsi;

  const gains = [];
  const losses = [];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let sumGain = 0;
  let sumLoss = 0;
  for (let i = 0; i < period; i++) {
    sumGain += gains[i];
    sumLoss += losses[i];
  }
  avgGain = sumGain / period;
  avgLoss = sumLoss / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = Number((100 - 100 / (1 + rs)).toFixed(2));

  for (let i = period + 1; i < prices.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = Number((100 - 100 / (1 + rs)).toFixed(2));
  }
  return rsi;
}

function calculateMACD(prices) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (ema12[i] === null || ema26[i] === null) macdLine.push(null);
    else macdLine.push(Number((ema12[i] - ema26[i]).toFixed(4)));
  }

  const validMacdStartIndex = macdLine.findIndex(val => val !== null);
  const validMacdLine = macdLine.slice(validMacdStartIndex);
  const validSignal = calculateEMA(validMacdLine, 9);
  const signalLine = new Array(validMacdStartIndex).fill(null).concat(validSignal);
  
  const hist = [];
  for (let i = 0; i < prices.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) hist.push(null);
    else hist.push(Number((macdLine[i] - signalLine[i]).toFixed(4)));
  }
  return { macd: macdLine, signal: signalLine, hist };
}

function recalculateAllIndicators(ticker) {
  const asset = assets[ticker];
  asset.sma = calculateSMA(asset.history, 14);
  asset.ema = calculateEMA(asset.history, 14);
  asset.rsi = calculateRSI(asset.history, 14);
  const macdData = calculateMACD(asset.history);
  asset.macd = macdData.macd;
  asset.signal = macdData.signal;
  asset.hist = macdData.hist;
}

Object.keys(assets).forEach(recalculateAllIndicators);

// =============================================================================
// REAL-TIME FINANCIAL MARKETS FETCHERS (Binance for Crypto, Alpha Vantage for Stocks)
// =============================================================================

async function fetchRealCryptoPrices() {
  const tickers = { BTC: 'BTCUSDT', ETH: 'ETHUSDT' };
  
  for (const ticker of Object.keys(tickers)) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${tickers[ticker]}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const asset = assets[ticker];
      const newPrice = parseFloat(data.lastPrice);
      
      asset.price = Number(newPrice.toFixed(2));
      asset.change = parseFloat(data.priceChangePercent);
      asset.high = parseFloat(data.highPrice);
      asset.low = parseFloat(data.lowPrice);
      
      asset.history.shift();
      asset.history.push(asset.price);
      recalculateAllIndicators(ticker);
      
      console.log(`[REAL-TIME CRYPTO] ${ticker} updated: $${asset.price} (${asset.change}%)`);
    } catch (error) {
      console.error(`[REAL-TIME CRYPTO ERROR] Failed to fetch ${ticker}:`, error.message);
      // Fallback: drift simulated
      runSimulatedDrift(ticker);
    }
  }
}

// Alpha Vantage stock quotes fetching (sequential to avoid API rate blocks)
async function fetchRealStockPrices() {
  const stocks = Object.keys(assets).filter(t => assets[t].type === 'Stock' || assets[t].type === 'FIBRA');
  if (!smtpSettings.alphaVantageKey) {
    console.log(`[REAL-TIME STOCKS WARNING] No Alpha Vantage API Key configured. Stocks remain in simulated mode.`);
    // Fallback: simulate stock values
    stocks.forEach(runSimulatedDrift);
    return;
  }

  for (const ticker of stocks) {
    try {
      const asset = assets[ticker];
      const symbolQuery = ticker + (asset.suffix || '');
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbolQuery}&apikey=${smtpSettings.alphaVantageKey}`;
      const res = await fetch(url);
      const data = await res.json();
      
      const quote = data['Global Quote'];
      if (!quote || !quote['05. price']) {
        if (data['Note']) {
          console.warn(`[REAL-TIME STOCKS NOTE] Alpha Vantage rate limit reached:`, data['Note']);
        } else {
          console.warn(`[REAL-TIME STOCKS NOTE] Unexpected stock payload:`, data);
        }
        runSimulatedDrift(ticker);
        continue;
      }

      asset.price = parseFloat(quote['05. price']);
      const rawChange = quote['10. change percent'];
      asset.change = rawChange ? parseFloat(rawChange.replace('%', '')) : asset.change;
      asset.high = quote['03. high'] ? parseFloat(quote['03. high']) : asset.high;
      asset.low = quote['04. low'] ? parseFloat(quote['04. low']) : asset.low;
      
      asset.history.shift();
      asset.history.push(asset.price);
      recalculateAllIndicators(ticker);
      
      console.log(`[REAL-TIME STOCKS] ${ticker} updated: $${asset.price} (${asset.change}%)`);
    } catch (error) {
      console.error(`[REAL-TIME STOCKS ERROR] Failed to fetch ${ticker}:`, error.message);
      runSimulatedDrift(ticker);
    }
  }
}

function runSimulatedDrift(ticker) {
  const asset = assets[ticker];
  const volatility = asset.type === 'Crypto' ? 0.004 : (asset.type === 'FIBRA' ? 0.0006 : 0.0012);
  const changePct = (Math.random() - 0.495) * volatility;
  const priceDiff = asset.price * changePct;
  
  asset.price = Number((asset.price + priceDiff).toFixed(2));
  asset.change = Number((((asset.price - asset.history[0]) / asset.history[0]) * 100).toFixed(2));
  
  if (asset.price > asset.high) asset.high = asset.price;
  if (asset.price < asset.low) asset.low = asset.price;
  
  asset.history.shift();
  asset.history.push(asset.price);
  recalculateAllIndicators(ticker);
}

// =============================================================================
// MAIN INTERVAL RUNNING PIPELINES
// =============================================================================

let tickCount = 0;

setInterval(async () => {
  tickCount++;

  if (smtpSettings.marketMode === 'real') {
    // 1. Fetch Real Cryptos from Binance every 5 seconds (Free, unlimited quotes)
    await fetchRealCryptoPrices();
    
    // 2. Fetch Real Stocks from Alpha Vantage every 60 seconds (respecting 25req/day free limits)
    if (tickCount % 12 === 0 || tickCount === 1) {
      await fetchRealStockPrices();
    } else {
      // For intermediate stock ticks, drift simulated based on last real stock price
      const stocks = Object.keys(assets).filter(t => assets[t].type === 'Stock' || assets[t].type === 'FIBRA');
      stocks.forEach(runSimulatedDrift);
    }
  } else {
    // All assets simulated
    Object.keys(assets).forEach(runSimulatedDrift);
  }

  // Active check alerts criteria
  checkAlertsEngine();
}, 5000);

// =============================================================================
// ALERTS & SMTP EMAIL TRANSMISSION ENGINE
// =============================================================================

async function sendEmailNotification(alert, currentValue) {
  const asset = assets[alert.asset];
  const dateStr = new Date().toLocaleString();
  
  const metricName = alert.metric.toUpperCase();
  const alertColor = alert.condition === 'above' ? '#10b981' : '#ef4444';
  const alertIcon = alert.condition === 'above' ? '📈 BEYOND BREAKOUT' : '📉 BREAKOUT DOWN';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0f19; color: #f9fafb; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 30px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); }
        .header { text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #6366f1; font-size: 24px; margin: 0; letter-spacing: 1px; }
        .badge { display: inline-block; padding: 8px 16px; border-radius: 50px; font-weight: bold; text-transform: uppercase; font-size: 13px; margin: 15px 0; background-color: ${alertColor}1e; color: ${alertColor}; border: 1px solid ${alertColor}3c; }
        .ticker { font-size: 32px; font-weight: 800; text-align: center; margin: 10px 0; color: #ffffff; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: rgba(255, 255, 255, 0.03); padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(255, 255, 255, 0.05); }
        .detail-item { text-align: center; }
        .detail-label { font-size: 11px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; }
        .detail-val { font-size: 18px; font-weight: bold; margin-top: 5px; color: #f3f4f6; }
        .msg { font-size: 15px; line-height: 1.6; text-align: center; color: #d1d5db; margin: 20px 0; }
        .cta-btn { display: block; width: 200px; margin: 25px auto 0 auto; text-align: center; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); }
        .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #6b7280; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>GBM INVEST-ALERTS</h1>
          <div class="badge">${alertIcon}</div>
        </div>
        
        <div class="ticker">${alert.asset}</div>
        
        <div class="msg">
          Se ha disparado tu alerta personalizada de inversión para <strong>${asset.name} (${alert.asset})</strong>. 
          La condición establecida era que el indicador <strong>${metricName}</strong> estuviera <strong>${alert.condition === 'above' ? 'POR ENCIMA' : 'POR DEBAJO'}</strong> de <strong>${alert.threshold}</strong>.
        </div>
        
        <div class="details-grid">
          <div class="detail-item">
            <div class="detail-label">Valor Disparador</div>
            <div class="detail-val" style="color: ${alertColor};">${currentValue.toFixed(2)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Límite Establecido</div>
            <div class="detail-val">${alert.threshold.toFixed(2)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Precio Actual Asset</div>
            <div class="detail-val">$${asset.price.toLocaleString()}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Variación 24H</div>
            <div class="detail-val" style="color: ${asset.change >= 0 ? '#10b981' : '#ef4444'};">${asset.change >= 0 ? '+' : ''}${asset.change}%</div>
          </div>
        </div>
        
        <p style="text-align: center; font-size: 13px; color: #9ca3af;">
          Análisis Técnico: RSI: <strong>${(asset.rsi[asset.rsi.length-1] || 50).toFixed(1)}</strong> | SMA(14): <strong>$${(asset.sma[asset.sma.length-1] || asset.price).toFixed(2)}</strong>
        </p>

        <a href="http://localhost:${PORT}" class="cta-btn">Ir al Dashboard</a>
        
        <div class="footer">
          Alerta generada automáticamente a las ${dateStr} por GBM Invest-Alerts Engine.<br>
          Para administrar o desactivar tus alertas, visita el panel de control.
        </div>
      </div>
    </body>
    </html>
  `;

  console.log(`\n============== [ALERT TRIGGERED: ${alert.asset}] ==============`);
  console.log(`Condition: ${metricName} ${alert.condition.toUpperCase()} ${alert.threshold}`);
  console.log(`Current Value: ${currentValue.toFixed(2)}`);
  console.log(`Recipient: ${smtpSettings.to}`);
  
  if (smtpSettings.mock) {
    console.log(`[SMTP MOCK MODE] Email sent successfully (Logged to terminal).`);
    console.log(`=================================================================\n`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.port === 465,
      auth: {
        user: smtpSettings.user,
        pass: smtpSettings.pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"GBM Invest-Alerts" <${smtpSettings.user}>`,
      to: smtpSettings.to,
      subject: `⚠️ ALERTA GBM: ${alert.asset} se encuentra ${alert.condition === 'above' ? 'sobre' : 'bajo'} el límite`,
      text: `Alerta GBM: ${alert.asset} disparó su indicador ${metricName} (${currentValue.toFixed(2)}) ${alert.condition === 'above' ? 'sobre' : 'bajo'} tu umbral de ${alert.threshold}.`,
      html: htmlContent
    });

    console.log(`[SMTP REAL DISPATCH] Email successfully sent: ${info.messageId}`);
    console.log(`=================================================================\n`);
    return true;
  } catch (error) {
    console.error(`[SMTP ERROR] Failed to send actual email alert:`, error.message);
    console.log(`=================================================================\n`);
    return false;
  }
}

function checkAlertsEngine() {
  alerts.forEach(alert => {
    const asset = assets[alert.asset];
    if (!asset) return;

    let currentValue = null;
    if (alert.metric === 'price') {
      currentValue = asset.price;
    } else if (alert.metric === 'rsi') {
      currentValue = asset.rsi[asset.rsi.length - 1];
    } else if (alert.metric === 'sma') {
      currentValue = asset.sma[asset.sma.length - 1];
    } else if (alert.metric === 'ema') {
      currentValue = asset.ema[asset.ema.length - 1];
    }

    if (currentValue === null || currentValue === undefined) return;

    const meetsCondition = alert.condition === 'above' 
      ? currentValue > alert.threshold 
      : currentValue < alert.threshold;

    if (meetsCondition) {
      if (!alert.isTriggered) {
        alert.isTriggered = true;
        alert.lastTriggered = Date.now();
        sendEmailNotification(alert, currentValue);
      }
    } else {
      if (alert.isTriggered) {
        console.log(`[Alert System] Resetting trigger state for alert ${alert.id} (${alert.asset} ${alert.metric}) as it crossed back.`);
        alert.isTriggered = false;
      }
    }
  });
}

// =============================================================================
// API REST ENDPOINTS
// =============================================================================

app.get('/api/stocks', (req, res) => {
  res.json(Object.keys(assets).map(ticker => {
    const asset = assets[ticker];
    return {
      ticker,
      name: asset.name,
      type: asset.type,
      price: asset.price,
      change: asset.change,
      high: asset.high,
      low: asset.low,
      history: asset.history,
      indicators: {
        sma: asset.sma[asset.sma.length - 1],
        ema: asset.ema[asset.ema.length - 1],
        rsi: asset.rsi[asset.rsi.length - 1],
        macd: asset.macd[asset.macd.length - 1],
        signal: asset.signal[asset.signal.length - 1],
        hist: asset.hist[asset.hist.length - 1]
      },
      macdHistory: asset.macd,
      signalHistory: asset.signal,
      histHistory: asset.hist
    };
  }));
});

app.get('/api/alerts', (req, res) => {
  res.json(alerts);
});

app.post('/api/alerts', (req, res) => {
  const { asset, metric, condition, threshold } = req.body;
  if (!assets[asset] || !metric || !condition || threshold === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios o el asset no es válido.' });
  }

  const newAlert = {
    id: Date.now().toString(),
    asset,
    metric,
    condition,
    threshold: parseFloat(threshold),
    isTriggered: false,
    lastTriggered: null
  };

  alerts.push(newAlert);
  res.status(201).json(newAlert);
});

app.delete('/api/alerts/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = alerts.length;
  alerts = alerts.filter(a => a.id !== id);
  if (alerts.length < initialLength) {
    res.json({ success: true, message: 'Alerta eliminada correctamente.' });
  } else {
    res.status(404).json({ error: 'Alerta no encontrada.' });
  }
});

app.post('/api/alerts/:id/reset', (req, res) => {
  const { id } = req.params;
  const alert = alerts.find(a => a.id === id);
  if (alert) {
    alert.isTriggered = false;
    res.json({ success: true, message: 'Alerta reiniciada.', alert });
  } else {
    res.status(404).json({ error: 'Alerta no encontrada.' });
  }
});

app.get('/api/settings', (req, res) => {
  res.json({
    host: smtpSettings.host,
    port: smtpSettings.port,
    user: smtpSettings.user,
    to: smtpSettings.to,
    mock: smtpSettings.mock,
    marketMode: smtpSettings.marketMode,
    alphaVantageKey: smtpSettings.alphaVantageKey ? '••••••••••••••••' : '',
    pass: '••••••••••••••••'
  });
});

app.post('/api/settings', (req, res) => {
  const { host, port, user, pass, to, mock, marketMode, alphaVantageKey } = req.body;

  if (host) smtpSettings.host = host;
  if (port) smtpSettings.port = parseInt(port);
  if (user) smtpSettings.user = user;
  if (to) smtpSettings.to = to;
  if (mock !== undefined) smtpSettings.mock = !!mock;
  if (marketMode) smtpSettings.marketMode = marketMode;
  
  if (pass && pass !== '••••••••••••••••') {
    smtpSettings.pass = pass;
  }
  if (alphaVantageKey && alphaVantageKey !== '••••••••••••••••') {
    smtpSettings.alphaVantageKey = alphaVantageKey;
  }

  res.json({ 
    success: true, 
    message: 'Configuración de Servidor y Datos actualizada.', 
    settings: {
      host: smtpSettings.host,
      port: smtpSettings.port,
      user: smtpSettings.user,
      to: smtpSettings.to,
      mock: smtpSettings.mock,
      marketMode: smtpSettings.marketMode,
      alphaVantageKey: smtpSettings.alphaVantageKey ? '••••••••••••••••' : ''
    }
  });
});

app.post('/api/test-email', async (req, res) => {
  console.log(`[Test Request] Dispatched test alert email manually...`);
  const testAlert = {
    asset: 'BTC',
    metric: 'price',
    condition: 'above',
    threshold: 65000.00,
    isTriggered: true,
    lastTriggered: Date.now()
  };

  const success = await sendEmailNotification(testAlert, assets.BTC.price);
  if (success) {
    res.json({ success: true, message: smtpSettings.mock 
      ? '¡Prueba simulada exitosa! El contenido del correo se imprimió en la terminal del servidor.' 
      : `¡Prueba SMTP real exitosa! Correo enviado a ${smtpSettings.to}` 
    });
  } else {
    res.status(500).json({ error: 'No se pudo enviar el correo de prueba. Verifica tu configuración SMTP.' });
  }
});

app.get('/api/portfolio', (req, res) => {
  let holdingsValue = 0;
  const holdingDetails = Object.keys(portfolio.holdings).map(ticker => {
    const qty = portfolio.holdings[ticker];
    const asset = assets[ticker];
    const value = qty * (asset ? asset.price : 0);
    holdingsValue += value;
    return {
      ticker,
      qty,
      currentPrice: asset ? asset.price : 0,
      totalValue: value
    };
  }).filter(h => h.qty > 0);

  const totalWorth = portfolio.balance + holdingsValue;
  const initialValue = 10000.00;
  const totalGainPct = ((totalWorth - initialValue) / initialValue) * 100;

  res.json({
    cash: portfolio.balance,
    holdingsValue,
    totalWorth,
    gainPct: totalGainPct,
    holdings: holdingDetails
  });
});

app.post('/api/portfolio/trade', (req, res) => {
  const { ticker, type, quantity } = req.body;
  const asset = assets[ticker];
  const qty = parseFloat(quantity);

  if (!asset || isNaN(qty) || qty <= 0 || (type !== 'buy' && type !== 'sell')) {
    return res.status(400).json({ error: 'Transacción inválida.' });
  }

  const cost = asset.price * qty;

  if (type === 'buy') {
    if (portfolio.balance < cost) {
      return res.status(400).json({ error: `Fondos insuficientes. Requieres $${cost.toFixed(2)}.` });
    }
    portfolio.balance -= cost;
    portfolio.holdings[ticker] = (portfolio.holdings[ticker] || 0) + qty;
  } else if (type === 'sell') {
    const userOwned = portfolio.holdings[ticker] || 0;
    if (userOwned < qty) {
      return res.status(400).json({ error: `Posiciones insuficientes.` });
    }
    portfolio.balance += cost;
    portfolio.holdings[ticker] = userOwned - qty;
    if (portfolio.holdings[ticker] <= 0) {
      delete portfolio.holdings[ticker];
    }
  }

  res.json({ success: true, message: `Transacción exitosa.`, portfolio });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 =================================================================`);
  console.log(`🔥 GBM INVEST-ALERTS RUNNING AT: http://localhost:${PORT}`);
  console.log(`📈 Markets loading in Simulated & Real-time dual engine!`);
  console.log(`📧 SMTP Email Mode: ${smtpSettings.mock ? 'MOCK (Terminal logger)' : 'REAL SMTP SERVICE'}`);
  console.log(`====================================================================\n`);
});
