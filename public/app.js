// =============================================================================
// GLOBAL APP STATES
// =============================================================================
let activeTicker = 'AAPL';
let activeTimeframe = '1D';
let stocksData = {};
let alertsData = [];
let portfolioData = {};
let smtpSettings = {};

let primaryChart = null;
let secondaryChart = null;

// Baseline values to calculate price flashing
let previousPrices = {};

// =============================================================================
// DOM ELEMENTS SELECTORS
// =============================================================================
const tickerTape = document.getElementById('tickerTape');
const tickerCardsRow = document.getElementById('tickerCardsRow');
const terminalPrice = document.getElementById('terminalPrice');
const terminalChange = document.getElementById('terminalChange');
const terminalHigh = document.getElementById('terminalHigh');
const terminalLow = document.getElementById('terminalLow');
const activeAssetTitle = document.getElementById('activeAssetTitle');
const activeAssetTypeBadge = document.getElementById('activeAssetTypeBadge');
const activeTradeTicker = document.getElementById('activeTradeTicker');

// Indicators selectors
const indSma = document.getElementById('indSma');
const badgeSma = document.getElementById('badgeSma');
const indEma = document.getElementById('indEma');
const badgeEma = document.getElementById('badgeEma');
const indRsi = document.getElementById('indRsi');
const badgeRsi = document.getElementById('badgeRsi');
const indMacd = document.getElementById('indMacd');
const badgeMacd = document.getElementById('badgeMacd');
const sentimentText = document.getElementById('sentimentText');
const sentimentArrow = document.getElementById('sentimentArrow');

// Forms & Tables selectors
const alertForm = document.getElementById('alertForm');
const alertsTable = document.getElementById('alertsTable').getElementsByTagName('tbody')[0];
const portfolioCash = document.getElementById('portfolioCash');
const portfolioHoldingsValue = document.getElementById('portfolioHoldingsValue');
const portfolioTotal = document.getElementById('portfolioTotal');
const portfolioYield = document.getElementById('portfolioYield');
const holdingsTable = document.getElementById('holdingsTable').getElementsByTagName('tbody')[0];
const tradeQty = document.getElementById('tradeQty');

// SMTP Settings selectors
const smtpHost = document.getElementById('smtpHost');
const smtpPort = document.getElementById('smtpPort');
const smtpUser = document.getElementById('smtpUser');
const smtpPass = document.getElementById('smtpPass');
const smtpTo = document.getElementById('smtpTo');
const mockEmailToggle = document.getElementById('mockEmailToggle');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const testEmailBtn = document.getElementById('testEmailBtn');
const smtpModeBadge = document.getElementById('smtpModeBadge');

// =============================================================================
// PREMIUM TOAST NOTIFIER SYSTEM
// =============================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <div class="toast-msg">${message}</div>
    <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
  `;
  
  container.appendChild(toast);
  
  // Close handler
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.animation = 'slide-out 0.25s forwards';
    setTimeout(() => toast.remove(), 250);
  });
  
  // Auto remove
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slide-out 0.25s forwards';
      setTimeout(() => toast.remove(), 250);
    }
  }, 4000);
}

// =============================================================================
// DYNAMIC DATA INJECTION: TICKERS & GRIDS
// =============================================================================

function renderTickerTape() {
  if (!stocksData.length) return;
  
  tickerTape.innerHTML = '';
  // Duplicate array elements to ensure seamless sliding marquee
  const doubleList = [...stocksData, ...stocksData, ...stocksData];
  
  doubleList.forEach(stock => {
    const item = document.createElement('div');
    item.className = 'ticker-item';
    item.addEventListener('click', () => selectAsset(stock.ticker));
    
    const isPositive = stock.change >= 0;
    const arrow = isPositive ? 'fa-caret-up' : 'fa-caret-down';
    const changeClass = isPositive ? 'positive' : 'negative';
    
    item.innerHTML = `
      <span class="ticker-item-ticker">${stock.ticker}</span>
      <span class="ticker-item-price">$${stock.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
      <span class="ticker-item-change ${changeClass}">
        <i class="fa-solid ${arrow}"></i> ${isPositive ? '+' : ''}${stock.change}%
      </span>
    `;
    tickerTape.appendChild(item);
  });
}

function renderTickerCards() {
  if (!stocksData.length) return;
  
  tickerCardsRow.innerHTML = '';
  
  stocksData.forEach(stock => {
    const card = document.createElement('div');
    card.className = `ticker-card ${stock.ticker === activeTicker ? 'active' : ''}`;
    card.addEventListener('click', () => selectAsset(stock.ticker));
    
    const isPositive = stock.change >= 0;
    const arrow = isPositive ? 'fa-caret-up' : 'fa-caret-down';
    const changeClass = isPositive ? 'positive' : 'negative';
    
    // Check if price flashed from last polling
    let flashClass = '';
    const prev = previousPrices[stock.ticker];
    if (prev && prev !== stock.price) {
      flashClass = stock.price > prev ? 'flash-up' : 'flash-down';
    }
    
    card.innerHTML = `
      <div class="ticker-card-top">
        <span class="ticker-card-name">${stock.ticker} <span class="ticker-card-lbl">${stock.name}</span></span>
        <span class="ticker-card-type">${stock.type}</span>
      </div>
      <div class="ticker-card-price ${flashClass}">
        $${stock.price.toLocaleString(undefined, {minimumFractionDigits: 2})}
      </div>
      <div class="ticker-card-change ${changeClass}">
        <i class="fa-solid ${arrow}"></i> ${isPositive ? '+' : ''}${stock.change}%
      </div>
    `;
    
    tickerCardsRow.appendChild(card);
    
    // Clear flash classes after 800ms
    if (flashClass) {
      setTimeout(() => {
        const prices = card.querySelectorAll('.ticker-card-price');
        prices.forEach(p => p.classList.remove('flash-up', 'flash-down'));
      }, 800);
    }
  });
}

function updateActiveTerminalView() {
  const stock = stocksData.find(s => s.ticker === activeTicker);
  if (!stock) return;

  activeAssetTitle.textContent = `${stock.name} (${stock.ticker})`;
  activeAssetTypeBadge.textContent = stock.type;
  activeTradeTicker.textContent = stock.ticker;
  
  let flashClass = '';
  const prev = previousPrices[activeTicker];
  if (prev && prev !== stock.price) {
    flashClass = stock.price > prev ? 'flash-up' : 'flash-down';
  }
  
  terminalPrice.textContent = `$${stock.price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  terminalPrice.className = `current-price ${flashClass}`;
  
  const isPositive = stock.change >= 0;
  terminalChange.textContent = `${isPositive ? '+' : ''}${stock.change}%`;
  terminalChange.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
  
  terminalHigh.textContent = `$${stock.high.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  terminalLow.textContent = `$${stock.low.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  
  // Indicators Detail Text Values
  const lastSma = stock.indicators.sma;
  const lastEma = stock.indicators.ema;
  const lastRsi = stock.indicators.rsi;
  const lastMacdHist = stock.indicators.hist;

  indSma.textContent = lastSma ? `$${lastSma.toFixed(2)}` : 'Calculando...';
  indEma.textContent = lastEma ? `$${lastEma.toFixed(2)}` : 'Calculando...';
  indRsi.textContent = lastRsi ? `${lastRsi.toFixed(1)}` : 'Calculando...';
  indMacd.textContent = lastMacdHist ? lastMacdHist.toFixed(4) : 'Calculando...';

  // Badges Status Logic
  if (lastSma) {
    const smaBullish = stock.price > lastSma;
    badgeSma.className = `ind-badge ${smaBullish ? 'bullish' : 'bearish'}`;
    badgeSma.textContent = smaBullish ? 'Bullish' : 'Bearish';
  }
  if (lastEma) {
    const emaBullish = stock.price > lastEma;
    badgeEma.className = `ind-badge ${emaBullish ? 'bullish' : 'bearish'}`;
    badgeEma.textContent = emaBullish ? 'Bullish' : 'Bearish';
  }
  if (lastRsi) {
    let rsiLabel = 'Neutral';
    let rsiClass = 'neutral';
    if (lastRsi > 70) { rsiLabel = 'Overbought'; rsiClass = 'bearish'; }
    else if (lastRsi < 30) { rsiLabel = 'Oversold'; rsiClass = 'bullish'; }
    badgeRsi.className = `ind-badge ${rsiClass}`;
    badgeRsi.textContent = rsiLabel;
  }
  if (lastMacdHist) {
    const macdBullish = lastMacdHist > 0;
    badgeMacd.className = `ind-badge ${macdBullish ? 'bullish' : 'bearish'}`;
    badgeMacd.textContent = macdBullish ? 'Bullish' : 'Bearish';
  }

  // Calculate & Set Unified Market Sentiment
  calculateSentiment(stock);

  // Clear flash classes after 800ms
  if (flashClass) {
    setTimeout(() => {
      terminalPrice.classList.remove('flash-up', 'flash-down');
    }, 800);
  }
}

// =============================================================================
// TECHNICAL SENTIMENT CALCULATOR
// =============================================================================
function calculateSentiment(stock) {
  let score = 0; // -100 to 100
  let indicatorsChecked = 0;

  const currentPrice = stock.price;
  const sma = stock.indicators.sma;
  const ema = stock.indicators.ema;
  const rsi = stock.indicators.rsi;
  const macdHist = stock.indicators.hist;

  if (sma) {
    score += currentPrice > sma ? 25 : -25;
    indicatorsChecked++;
  }
  if (ema) {
    score += currentPrice > ema ? 25 : -25;
    indicatorsChecked++;
  }
  if (rsi) {
    if (rsi < 30) score += 30; // oversold buy
    else if (rsi > 70) score -= 30; // overbought sell
    else if (rsi > 50) score += 10;
    else score -= 10;
    indicatorsChecked++;
  }
  if (macdHist) {
    score += macdHist > 0 ? 20 : -20;
    indicatorsChecked++;
  }

  // Cap score
  score = Math.max(-100, Math.min(100, score));

  // Determine Recommendation Label
  let label = 'HOLD';
  let color = 'var(--text-secondary)';
  let angle = 0; // rotation angle from -90 to +90

  if (score > 60) {
    label = 'STRONG BUY';
    color = 'var(--success-color)';
  } else if (score > 15) {
    label = 'BUY';
    color = 'var(--teal-color)';
  } else if (score < -60) {
    label = 'STRONG SELL';
    color = 'var(--danger-color)';
  } else if (score < -15) {
    label = 'SELL';
    color = 'var(--danger-color)';
  }

  angle = (score / 100) * 90; // mapping score to degree constraints

  sentimentText.textContent = label;
  sentimentText.style.color = color;
  sentimentArrow.style.transform = `rotate(${angle}deg)`;
}

// =============================================================================
// CHARTJS PIPELINE MANAGER
// =============================================================================

function getSlicingPeriods() {
  if (activeTimeframe === '1D') return 15;
  if (activeTimeframe === '1W') return 30;
  return HISTORY_POINTS;
}

function initCharts() {
  const stock = stocksData.find(s => s.ticker === activeTicker);
  if (!stock) return;

  const points = getSlicingPeriods();
  const pricesSlice = stock.history.slice(-points);
  const smaSlice = stock.sma.slice(-points);
  const emaSlice = stock.ema.slice(-points);

  // Generate labels as timestamps or intervals
  const labels = Array.from({length: points}, (_, i) => `${points - i}p`);

  // PRIMARY CHART SETUP
  const ctx1 = document.getElementById('primaryChart').getContext('2d');
  
  // Custom linear gradient for glass shadow underneath price line
  const gradient = ctx1.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'hsla(245, 82%, 67%, 0.35)');
  gradient.addColorStop(1, 'hsla(245, 82%, 67%, 0.0)');

  primaryChart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Precio USD',
          data: pricesSlice,
          borderColor: 'hsl(245, 82%, 67%)',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#ffffff',
          fill: true,
          backgroundColor: gradient,
          tension: 0.25
        },
        {
          label: 'SMA (14)',
          data: smaSlice,
          borderColor: 'hsl(25, 95%, 55%)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0.1
        },
        {
          label: 'EMA (14)',
          data: emaSlice,
          borderColor: 'hsl(175, 84%, 43%)',
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: 'hsl(212, 25%, 82%)', font: { family: 'Outfit', weight: 'bold' } }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'hsl(222, 47%, 13%)',
          titleColor: 'hsl(210, 40%, 98%)',
          bodyColor: 'hsl(212, 25%, 82%)',
          borderColor: 'hsla(223, 30%, 22%, 0.6)',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'hsl(215, 20%, 65%)', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'hsl(215, 20%, 65%)', font: { size: 10 } }
        }
      }
    }
  });

  // SECONDARY CHART SETUP (MACD Line/Signal/Hist)
  const ctx2 = document.getElementById('secondaryChart').getContext('2d');
  
  const macdSlice = stock.macdHistory.slice(-points);
  const signalSlice = stock.signalHistory.slice(-points);
  const histSlice = stock.histHistory.slice(-points);

  secondaryChart = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: 'MACD Histograma',
          data: histSlice,
          backgroundColor: histSlice.map(h => h >= 0 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'),
          borderColor: histSlice.map(h => h >= 0 ? 'hsl(150, 84%, 43%)' : 'hsl(350, 84%, 55%)'),
          borderWidth: 1,
          barPercentage: 0.65,
          order: 3
        },
        {
          type: 'line',
          label: 'MACD',
          data: macdSlice,
          borderColor: 'hsl(245, 82%, 67%)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.2,
          order: 1
        },
        {
          type: 'line',
          label: 'Señal',
          data: signalSlice,
          borderColor: 'hsl(25, 95%, 55%)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.2,
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { display: false }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'hsl(215, 20%, 65%)', font: { size: 9 } }
        }
      }
    }
  });
}

function updateCharts() {
  const stock = stocksData.find(s => s.ticker === activeTicker);
  if (!stock || !primaryChart || !secondaryChart) return;

  const points = getSlicingPeriods();
  const pricesSlice = stock.history.slice(-points);
  const smaSlice = stock.sma.slice(-points);
  const emaSlice = stock.ema.slice(-points);
  const macdSlice = stock.macdHistory.slice(-points);
  const signalSlice = stock.signalHistory.slice(-points);
  const histSlice = stock.histHistory.slice(-points);

  const labels = Array.from({length: points}, (_, i) => `${points - i}p`);

  // Update primary chart data & labels incrementally
  primaryChart.data.labels = labels;
  primaryChart.data.datasets[0].data = pricesSlice;
  primaryChart.data.datasets[1].data = smaSlice;
  primaryChart.data.datasets[2].data = emaSlice;
  primaryChart.update('none'); // silent update (keeps transitions smooth)

  // Update secondary chart data
  secondaryChart.data.labels = labels;
  secondaryChart.data.datasets[0].data = histSlice;
  secondaryChart.data.datasets[0].backgroundColor = histSlice.map(h => h >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)');
  secondaryChart.data.datasets[0].borderColor = histSlice.map(h => h >= 0 ? 'hsl(150, 84%, 43%)' : 'hsl(350, 84%, 55%)');
  secondaryChart.data.datasets[1].data = macdSlice;
  secondaryChart.data.datasets[2].data = signalSlice;
  secondaryChart.update('none');
}

// =============================================================================
// ALERTS CONTROLLER CRUD
// =============================================================================

function renderAlerts() {
  alertsTable.innerHTML = '';
  
  if (alertsData.length === 0) {
    alertsTable.innerHTML = `
      <tr>
        <td colspan="6" class="empty-table-msg">No hay alertas configuradas.</td>
      </tr>
    `;
    return;
  }

  alertsData.forEach(alert => {
    const row = document.createElement('tr');
    
    const statusClass = alert.isTriggered ? 'triggered' : 'monitoring';
    const statusText = alert.isTriggered ? 'TRIGGERED' : 'MONITORING';
    const metricText = alert.metric.toUpperCase();
    const condText = alert.condition === 'above' ? 'Mayor que (>)' : 'Menor que (<)';

    row.innerHTML = `
      <td style="font-weight: 700; color: #ffffff;">${alert.asset}</td>
      <td>${metricText}</td>
      <td>${condText}</td>
      <td style="font-family: 'Outfit'; font-weight: 600;">${alert.threshold.toLocaleString()}</td>
      <td><span class="alert-trig-badge ${statusClass}">${statusText}</span></td>
      <td>
        ${alert.isTriggered ? `
          <button class="table-action-btn btn-reset" onclick="resetAlert('${alert.id}')" title="Reiniciar Alerta">
            <i class="fa-solid fa-arrows-rotate"></i>
          </button>
        ` : ''}
        <button class="table-action-btn btn-delete" onclick="deleteAlert('${alert.id}')" title="Eliminar Alerta">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    alertsTable.appendChild(row);
  });
}

async function addAlert(e) {
  e.preventDefault();
  
  const asset = document.getElementById('alertAsset').value;
  const metric = document.getElementById('alertMetric').value;
  const condition = document.getElementById('alertCondition').value;
  const threshold = parseFloat(document.getElementById('alertThreshold').value);

  if (!asset || !metric || !condition || isNaN(threshold)) return;

  try {
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset, metric, condition, threshold })
    });
    
    if (res.ok) {
      const newAlert = await res.json();
      alertsData.push(newAlert);
      renderAlerts();
      alertForm.reset();
      showToast(`¡Alerta para ${asset} creada con éxito!`);
    } else {
      const err = await res.json();
      showToast(err.error || 'No se pudo crear la alerta.', 'danger');
    }
  } catch (error) {
    showToast('Error de red al intentar crear la alerta.', 'danger');
  }
}

async function deleteAlert(id) {
  try {
    const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alertsData = alertsData.filter(a => a.id !== id);
      renderAlerts();
      showToast('Alerta eliminada correctamente.');
    } else {
      showToast('Error al intentar eliminar la alerta del servidor.', 'danger');
    }
  } catch (error) {
    showToast('Error de red al eliminar la alerta.', 'danger');
  }
}

async function resetAlert(id) {
  try {
    const res = await fetch(`/api/alerts/${id}/reset`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      // Update in-memory state
      const idx = alertsData.findIndex(a => a.id === id);
      if (idx !== -1) alertsData[idx] = data.alert;
      renderAlerts();
      showToast('Alerta armada e iniciando monitoreo nuevamente.');
    } else {
      showToast('No se pudo restablecer la alerta.', 'danger');
    }
  } catch (error) {
    showToast('Error de red al restablecer la alerta.', 'danger');
  }
}

// =============================================================================
// SIMULATED PORTFOLIO OPERATIONS
// =============================================================================

function renderPortfolio() {
  if (!portfolioData.totalWorth) return;

  portfolioCash.textContent = `$${portfolioData.cash.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  portfolioHoldingsValue.textContent = `$${portfolioData.holdingsValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  portfolioTotal.textContent = `$${portfolioData.totalWorth.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  
  const isPositive = portfolioData.gainPct >= 0;
  portfolioYield.textContent = `${isPositive ? '+' : ''}${portfolioData.gainPct.toFixed(2)}%`;
  portfolioYield.className = `yield ${isPositive ? 'positive' : 'negative'}`;

  // Render positions table
  holdingsTable.innerHTML = '';
  if (portfolioData.holdings.length === 0) {
    holdingsTable.innerHTML = `
      <tr>
        <td colspan="4" class="empty-table-msg">Sin posiciones abiertas.</td>
      </tr>
    `;
    return;
  }

  portfolioData.holdings.forEach(hold => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700; color:#fff; cursor:pointer;" onclick="selectAsset('${hold.ticker}')">${hold.ticker}</td>
      <td style="font-family:'Outfit'; font-weight:600;">${hold.qty}</td>
      <td style="font-family:'Outfit';">$${hold.currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
      <td style="font-family:'Outfit'; font-weight:700; color:#ffffff;">$${hold.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
    `;
    holdingsTable.appendChild(row);
  });
}

async function executeSimulatedTrade(type) {
  const qty = parseFloat(tradeQty.value);
  if (isNaN(qty) || qty <= 0) {
    showToast('Por favor introduce una cantidad válida.', 'danger');
    return;
  }

  try {
    const res = await fetch('/api/portfolio/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: activeTicker, type, quantity: qty })
    });

    if (res.ok) {
      const data = await res.json();
      showToast(`Operación exitosa: ${type.toUpperCase()} ${qty} ${activeTicker}`);
      // Immediate portfolio refresh
      fetchPortfolioData();
    } else {
      const err = await res.json();
      showToast(err.error || 'La transacción falló.', 'danger');
    }
  } catch (error) {
    showToast('Error de red al realizar el trade.', 'danger');
  }
}

// =============================================================================
// SMTP CONFIGURATION METHODS
// =============================================================================

function renderSettings() {
  smtpHost.value = smtpSettings.host || '';
  smtpPort.value = smtpSettings.port || '';
  smtpUser.value = smtpSettings.user || '';
  smtpPass.value = smtpSettings.pass || '';
  smtpTo.value = smtpSettings.to || '';
  
  // Load real-time settings values
  document.getElementById('marketMode').value = smtpSettings.marketMode || 'simulated';
  document.getElementById('alphaVantageKey').value = smtpSettings.alphaVantageKey || '';
  
  mockEmailToggle.checked = smtpSettings.mock;
  updateSmtpBadge();
}

function updateSmtpBadge() {
  if (smtpSettings.mock) {
    smtpModeBadge.innerHTML = '<i class="fa-solid fa-envelope-circle-check"></i> CORREO MOCK ACTIVE';
    smtpModeBadge.className = 'status-badge';
  } else {
    smtpModeBadge.innerHTML = '<i class="fa-solid fa-envelope-open-text" style="color:var(--teal-color);"></i> REAL SMTP ONLINE';
    smtpModeBadge.className = 'status-badge connected';
  }
}

async function saveSmtpSettings(e) {
  e.preventDefault();

  const host = smtpHost.value;
  const port = smtpPort.value;
  const user = smtpUser.value;
  const pass = smtpPass.value;
  const to = smtpTo.value;
  const mock = mockEmailToggle.checked;
  const marketMode = document.getElementById('marketMode').value;
  const alphaVantageKey = document.getElementById('alphaVantageKey').value;

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, port, user, pass, to, mock, marketMode, alphaVantageKey })
    });

    if (res.ok) {
      const data = await res.json();
      smtpSettings = data.settings;
      updateSmtpBadge();
      
      const modeText = marketMode === 'real' ? 'Tiempo Real (Binance / Stocks)' : 'Simulación';
      showToast(`Ajustes actualizados. Modo: ${modeText}`);
    } else {
      showToast('No se pudieron guardar los ajustes.', 'danger');
    }
  } catch (error) {
    showToast('Error de red al intentar guardar configuración.', 'danger');
  }
}

async function sendTestEmail() {
  testEmailBtn.disabled = true;
  testEmailBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
  
  try {
    const res = await fetch('/api/test-email', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      showToast(data.message);
    } else {
      const err = await res.json();
      showToast(err.error || 'No se pudo despachar el correo.', 'danger');
    }
  } catch (error) {
    showToast('Error de red al intentar enviar prueba.', 'danger');
  } finally {
    testEmailBtn.disabled = false;
    testEmailBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Correo de Prueba';
  }
}

// =============================================================================
// POLLING API & INITIALIZATION
// =============================================================================

function populateAlertAssetDropdown() {
  const select = document.getElementById('alertAsset');
  if (!select) return;
  select.innerHTML = '';
  stocksData.forEach(stock => {
    const opt = document.createElement('option');
    opt.value = stock.ticker;
    opt.textContent = `${stock.ticker} - ${stock.name}`;
    select.appendChild(opt);
  });
}

async function fetchStocksData(isInitial = false) {
  try {
    const res = await fetch('/api/stocks');
    if (res.ok) {
      const data = await res.json();
      
      // Save prices for flashing calculations
      if (stocksData.length) {
        stocksData.forEach(s => {
          previousPrices[s.ticker] = s.price;
        });
      }

      stocksData = data;
      
      renderTickerTape();
      renderTickerCards();
      updateActiveTerminalView();
      
      if (isInitial) {
        populateAlertAssetDropdown();
        initCharts();
      } else {
        updateCharts();
      }
      
      // Update badge server
      document.getElementById('serverStatusBadge').className = 'status-badge connected';
    }
  } catch (error) {
    console.error('Error polling stocks:', error);
    document.getElementById('serverStatusBadge').className = 'status-badge';
  }
}

async function fetchAlertsData() {
  try {
    const res = await fetch('/api/alerts');
    if (res.ok) {
      alertsData = await res.json();
      renderAlerts();
    }
  } catch (error) {
    console.error('Error polling alerts:', error);
  }
}

async function fetchPortfolioData() {
  try {
    const res = await fetch('/api/portfolio');
    if (res.ok) {
      portfolioData = await res.json();
      renderPortfolio();
    }
  } catch (error) {
    console.error('Error polling portfolio:', error);
  }
}

async function fetchSettingsData() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      smtpSettings = await res.json();
      renderSettings();
    }
  } catch (error) {
    console.error('Error polling settings:', error);
  }
}

function selectAsset(ticker) {
  if (ticker === activeTicker) return;
  activeTicker = ticker;
  
  // Re-render cards immediately to update active classes
  renderTickerCards();
  updateActiveTerminalView();
  
  // Clean destroy and initialize charts for new baseline scales
  if (primaryChart) primaryChart.destroy();
  if (secondaryChart) secondaryChart.destroy();
  initCharts();
  
  showToast(`Cambiado visualizador de análisis a ${ticker}`);
}

// Bind Timeframes buttons
document.querySelectorAll('.time-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeTimeframe = e.target.getAttribute('data-time');
    
    // Destroy charts and re-render with new sliced ranges
    if (primaryChart) primaryChart.destroy();
    if (secondaryChart) secondaryChart.destroy();
    initCharts();
  });
});

// Bind form submits & events
alertForm.addEventListener('submit', addAlert);
document.getElementById('settingsForm').addEventListener('submit', saveSmtpSettings);
testEmailBtn.addEventListener('click', sendTestEmail);
mockEmailToggle.addEventListener('change', (e) => {
  // Live update mock toggle on state adjustment
  smtpSettings.mock = e.target.checked;
  updateSmtpBadge();
});

// Trade buttons
document.getElementById('tradeBuyBtn').addEventListener('click', () => executeSimulatedTrade('buy'));
document.getElementById('tradeSellBtn').addEventListener('click', () => executeSimulatedTrade('sell'));

// =============================================================================
// INITIAL START
// =============================================================================
async function start() {
  // Initial fetch of data synchronously to avoid empty canvas creation issues
  await fetchStocksData(true);
  await fetchAlertsData();
  await fetchPortfolioData();
  await fetchSettingsData();

  // Setup periodic polling interval schedules (5 seconds as recommended)
  setInterval(() => {
    fetchStocksData(false);
    fetchAlertsData();
    fetchPortfolioData();
  }, 5000);
}

// Window load init
window.addEventListener('DOMContentLoaded', start);
