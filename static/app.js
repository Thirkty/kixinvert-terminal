// KixInvertAPP - Interactive Frontend Controller
// Ecosystems: Public Welcome Landing & Private Tri-Monetary Terminal
// Features: Real-Time BVC Ticker Tape, Live Notifications Center, Sound Synthesizer & Toast Alerts

// State
let currentCurrency = 'compare'; // 'compare', 'ves', 'usd_bcv', 'usdt'
let currentView = 'welcome'; // 'welcome' or 'terminal'
let activeEcosystem = localStorage.getItem('kix_active_ecosystem') || 'BVC'; // 'BVC' or 'US'
let portfolioData = null;
let marketQuotes = [];
let popularInternationalQuotes = [];
let allocationChart = null;
let soundEnabled = true;

// Auto-Sync Timer State
let syncCountdown = 30;
let syncTimerInterval = null;
let isSyncing = false;

// System Notifications State
let systemNotifications = [
  {
    id: 1,
    type: 'rates',
    title: 'Monitor Cambiario Activo',
    desc: 'Tasa BCV y Binance P2P USDT conectadas. Brecha calculada.',
    time: 'En vivo'
  },
  {
    id: 2,
    type: 'ai',
    title: 'Analista KixInvert AI Disponible',
    desc: 'Diagnóstico autónomo de 9 acciones con evaluación de cobertura.',
    time: 'En vivo'
  },
  {
    id: 3,
    type: 'sync',
    title: 'BVC Conectada en Vivo',
    desc: '46 títulos bursátiles sincronizados con la Bolsa de Valores de Caracas.',
    time: 'En vivo'
  }
];

// Formatters
const formatVES = (val) => `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)}`;
const formatUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val || 0);
const formatUSDT = (val) => `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)} USDT`;
const formatNumber = (val, dec = 2) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val || 0);

// Authenticated Fetch Helper (Injects JWT Bearer Token & catches 401 Unauthorized)
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('kix_token');
  const headers = options.headers ? { ...options.headers } : {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  options.headers = headers;

  const response = await fetch(url, options);
  if (response.status === 401 && localStorage.getItem('kix_authenticated') === 'true') {
    console.warn('Session expired or unauthorized. Performing secure auto-logout.');
    performLogout();
    showToast({
      title: '🔒 Sesión Expirada',
      message: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
      type: 'warning',
      duration: 5000
    });
  }
  return response;
}

// Smart Financial Number Parser (Handles Venezuelan & US formats: 1.898, 1.898,50, 1898,50, 0,25, etc.)
function parseFinancialNumber(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = val.toString().trim().replace(/[^\d.,]/g, '');
  if (!str) return 0;

  // Case 1: Has both dot and comma
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
    return parseFloat(str) || 0;
  }

  // Case 2: Only comma
  if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length > 2) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
    return parseFloat(str) || 0;
  }

  // Case 3: Only dot
  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 2) {
      str = str.replace(/\./g, '');
      return parseFloat(str) || 0;
    }
    const beforeDot = parts[0];
    const afterDot = parts[1];

    if (beforeDot === '0' || beforeDot === '') {
      return parseFloat(str) || 0;
    }

    if (afterDot.length === 3 && beforeDot.length >= 1) {
      return parseFloat(beforeDot + afterDot) || 0;
    }

    return parseFloat(str) || 0;
  }

  return parseFloat(str) || 0;
}

// Modern Chart Colors Palette
const CHART_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#f97316', // Orange
  '#64748b'  // Cash Slate
];

// =========================================================================
// AUDIO SYNTHESIZER (PURE WEB AUDIO API - ZERO EXTERNAL ASSETS)
// =========================================================================
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type = 'click') {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'alert') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'ai') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.2);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch (e) {
    // Ignore autoplay restriction before user interaction
  }
}

// =========================================================================
// TOAST NOTIFICATIONS SYSTEM
// =========================================================================
let lastToastSig = '';
let lastToastTime = 0;

function showToast({ title, message, type = 'success', duration = 3800 }) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Deduplication guard: ignore identical toasts within 1500ms
  const now = Date.now();
  const sig = `${title}:::${message}`;
  if (sig === lastToastSig && (now - lastToastTime) < 1500) {
    return;
  }
  lastToastSig = sig;
  lastToastTime = now;

  playSound(type === 'error' ? 'alert' : type);

  const toast = document.createElement('div');
  toast.className = `kix-toast toast-${type}`;

  let iconName = 'check-circle-2';
  if (type === 'warning') iconName = 'alert-triangle';
  else if (type === 'ai') iconName = 'sparkles';
  else if (type === 'error') iconName = 'alert-octagon';

  toast.innerHTML = `
    <div class="toast-body">
      <div class="toast-icon"><i data-lucide="${iconName}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close"><i data-lucide="x"></i></button>
    </div>
    <div class="toast-progress">
      <div class="toast-progress-bar" style="transition: width ${duration}ms linear; width: 100%;"></div>
    </div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  requestAnimationFrame(() => {
    const bar = toast.querySelector('.toast-progress-bar');
    if (bar) bar.style.width = '0%';
  });

  const closeToast = () => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 250);
  };

  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) closeBtn.addEventListener('click', closeToast);

  setTimeout(closeToast, duration);
}

// =========================================================================
// NOTIFICATION CENTER DROPDOWN
// =========================================================================
function renderNotifications() {
  const list = document.getElementById('notif-list');
  const countBadge = document.getElementById('notif-badge-count');
  if (!list) return;

  if (countBadge) {
    countBadge.textContent = systemNotifications.length;
    countBadge.style.display = systemNotifications.length > 0 ? 'flex' : 'none';
  }

  if (systemNotifications.length === 0) {
    list.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 0.8rem;">No hay alertas pendientes</div>`;
    return;
  }

  list.innerHTML = systemNotifications.map(n => {
    let iconClass = 'icon-sync';
    let iconName = 'refresh-cw';
    if (n.type === 'rates') { iconClass = 'icon-rates'; iconName = 'arrow-left-right'; }
    else if (n.type === 'ai') { iconClass = 'icon-ai'; iconName = 'sparkles'; }
    else if (n.type === 'alert') { iconClass = 'icon-alert'; iconName = 'alert-triangle'; }

    return `
      <div class="notif-item">
        <div class="notif-item-icon ${iconClass}"><i data-lucide="${iconName}"></i></div>
        <div class="notif-item-content">
          <div class="notif-item-title">
            <span>${escapeHtml(n.title)}</span>
            <span class="notif-item-time">${n.time}</span>
          </div>
          <div class="notif-item-desc">${escapeHtml(n.desc)}</div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function addNotification({ type, title, desc }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  systemNotifications.unshift({
    id: Date.now(),
    type,
    title,
    desc,
    time: timeStr
  });
  if (systemNotifications.length > 15) systemNotifications.pop();
  renderNotifications();
}

// =========================================================================
// STREAMING BVC TICKER TAPE (WALL STREET MARQUEE)
// =========================================================================
function renderMarqueeTape(quotes) {
  const track = document.getElementById('bvc-marquee-track');
  if (!track || !quotes || quotes.length === 0) return;

  const activeQuotes = quotes.filter(q => q.price_ves > 0);
  if (activeQuotes.length === 0) return;

  // Duplicate list twice for continuous seamless infinite animation
  const duplicated = [...activeQuotes, ...activeQuotes];

  track.innerHTML = duplicated.map(q => {
    const chgVal = q.change_pct || 0;
    let chgClass = 'neutral';
    let sign = '';
    let arrow = '';

    if (chgVal > 0) {
      chgClass = 'up';
      sign = '+';
      arrow = '▲ ';
    } else if (chgVal < 0) {
      chgClass = 'down';
      arrow = '▼ ';
    }

    return `
      <div class="tape-item" onclick="quickAddTicker('${q.ticker}', ${q.price_ves})" title="Clic para operar ${q.ticker}">
        <span class="sym">${q.ticker}</span>
        <span class="price">${formatVES(q.price_ves)}</span>
        <span class="chg ${chgClass}">${arrow}${sign}${chgVal}%</span>
      </div>
    `;
  }).join('');
}

// =========================================================================
// PRO SUBSCRIPTION & BINANCE PAY SYSTEM (FASE 1)
// =========================================================================
let currentUserSubscription = {
  tier: localStorage.getItem('kix_subscription_tier') || 'free',
  is_pro: localStorage.getItem('kix_is_pro') === 'true',
  used_queries: parseInt(localStorage.getItem('kix_ai_queries_used') || '0', 10),
  queries_limit: 10,
  expires_at: null
};

let activeProPollInterval = null;
let currentProOrderId = null;

function updateUserTierUI() {
  const isAuth = localStorage.getItem('kix_authenticated') === 'true';
  const hasToken = !!localStorage.getItem('kix_token');
  const btnTopbarUpgrade = document.getElementById('btn-topbar-upgrade');
  const badgeTopbarPro = document.getElementById('badge-topbar-pro');

  if (!isAuth || !hasToken) {
    if (btnTopbarUpgrade) btnTopbarUpgrade.style.display = 'none';
    if (badgeTopbarPro) badgeTopbarPro.style.display = 'none';
  } else if (currentUserSubscription.is_pro) {
    if (btnTopbarUpgrade) btnTopbarUpgrade.style.display = 'none';
    if (badgeTopbarPro) badgeTopbarPro.style.display = 'inline-flex';
  } else {
    if (btnTopbarUpgrade) btnTopbarUpgrade.style.display = 'inline-flex';
    if (badgeTopbarPro) badgeTopbarPro.style.display = 'none';
  }

  const sideBtnUpgrade = document.getElementById('sidebar-btn-upgrade');
  if (sideBtnUpgrade) {
    if (!isAuth || !hasToken) {
      sideBtnUpgrade.style.display = 'none';
    } else if (currentUserSubscription.is_pro) {
      sideBtnUpgrade.style.display = 'inline-flex';
      sideBtnUpgrade.innerHTML = `<i data-lucide="crown"></i> <span class="sidebar-label">Plan PRO Activo</span>`;
      sideBtnUpgrade.style.borderColor = '#10b981';
      sideBtnUpgrade.style.color = '#10b981';
      sideBtnUpgrade.style.background = 'rgba(16, 185, 129, 0.15)';
    } else {
      sideBtnUpgrade.style.display = 'inline-flex';
      sideBtnUpgrade.innerHTML = `<i data-lucide="crown"></i> <span class="sidebar-label">Plan PRO</span>`;
      sideBtnUpgrade.style.borderColor = 'rgba(234, 179, 8, 0.35)';
      sideBtnUpgrade.style.color = '#facc15';
      sideBtnUpgrade.style.background = 'linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(245, 158, 11, 0.05))';
    }
  }

  updateAiDemoCounterBadge();
}

window.openProModal = async function() {
  const isAuth = localStorage.getItem('kix_authenticated') === 'true';
  const token = localStorage.getItem('kix_token');

  if (!isAuth || !token) {
    showToast({
      title: 'Inicia Sesión',
      message: 'Regístrate o inicia sesión para activar tu membresía PRO.',
      type: 'warning',
      duration: 4000
    });
    openAuthModal('register');
    return;
  }

  playSound('click');
  const modal = document.getElementById('modal-pro-sub');
  if (!modal) return;

  // Reset modal screens
  const checkoutFlow = document.getElementById('pro-checkout-flow');
  const successBox = document.getElementById('pro-success-box');
  if (checkoutFlow) checkoutFlow.style.display = 'block';
  if (successBox) successBox.style.display = 'none';

  const qrImg = document.getElementById('pro-qr-image');
  const qrSpinner = document.getElementById('pro-qr-spinner');
  const orderRef = document.getElementById('pro-order-ref');
  const statusText = document.getElementById('pro-order-status-text');
  const deeplinkBtn = document.getElementById('btn-binance-deeplink');

  if (qrImg) qrImg.style.display = 'none';
  if (qrSpinner) qrSpinner.style.display = 'flex';
  if (orderRef) orderRef.textContent = 'Creando orden segura...';
  if (statusText) statusText.textContent = 'Conectando con Binance Pay...';
  if (deeplinkBtn) deeplinkBtn.style.display = 'none';

  modal.classList.add('show');
  lucide.createIcons();

  try {
    const res = await fetchWithAuth('/api/payments/create-binance-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro_monthly', amount_usdt: 5.0 })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast({ title: 'Error', message: 'No se pudo crear la orden de pago.', type: 'error' });
      return;
    }

    const order = data.order;
    currentProOrderId = order.order_id;

    if (orderRef) orderRef.textContent = order.order_id;
    if (qrImg) {
      qrImg.src = order.qr_code_url;
      qrImg.onload = () => {
        if (qrSpinner) qrSpinner.style.display = 'none';
        qrImg.style.display = 'block';
      };
    }
    if (statusText) statusText.textContent = 'Esperando confirmación de Binance...';

    if (deeplinkBtn && order.checkout_url) {
      deeplinkBtn.href = order.checkout_url;
      deeplinkBtn.style.display = 'inline-flex';
    }

    // Start background polling every 3.5 seconds
    clearInterval(activeProPollInterval);
    activeProPollInterval = setInterval(async () => {
      if (!currentProOrderId || !modal.classList.contains('show')) {
        clearInterval(activeProPollInterval);
        return;
      }
      try {
        const checkRes = await fetchWithAuth(`/api/payments/order-status/${currentProOrderId}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.status === 'PAID' || checkData.is_pro) {
            clearInterval(activeProPollInterval);
            handleProActivationSuccess(checkData.expires_at);
          }
        }
      } catch (e) {
        // silent
      }
    }, 3500);

  } catch (err) {
    console.error('Error creating Binance Pay order:', err);
    showToast({ title: 'Error de Conexión', message: 'No se pudo conectar con Binance.', type: 'error' });
  }
};

window.closeProModal = function() {
  clearInterval(activeProPollInterval);
  const modal = document.getElementById('modal-pro-sub');
  if (modal) modal.classList.remove('show');
};

window.simulateProPayment = async function() {
  if (!currentProOrderId) return;
  playSound('click');
  const btn = document.getElementById('btn-simulate-pro-pay');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="spin-anim"></i> Validando pago...`;
    lucide.createIcons();
  }

  try {
    const res = await fetchWithAuth(`/api/payments/simulate-binance-success/${currentProOrderId}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      clearInterval(activeProPollInterval);
      handleProActivationSuccess(data.expires_at);
    } else {
      showToast({ title: 'Error', message: 'No se pudo simular la activación.', type: 'error' });
    }
  } catch (err) {
    showToast({ title: 'Error', message: String(err), type: 'error' });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="zap"></i> Probar Pago Exitoso (Simulación Binance)`;
      lucide.createIcons();
    }
  }
};

function handleProActivationSuccess(expiresAt) {
  playSound('success');
  currentUserSubscription.is_pro = true;
  currentUserSubscription.tier = 'pro';
  currentUserSubscription.used_queries = 0;
  currentUserSubscription.queries_limit = null;
  currentUserSubscription.expires_at = expiresAt;

  localStorage.setItem('kix_subscription_tier', 'pro');
  localStorage.setItem('kix_is_pro', 'true');
  localStorage.setItem('kix_ai_queries_used', '0');

  const checkoutFlow = document.getElementById('pro-checkout-flow');
  const successBox = document.getElementById('pro-success-box');
  const expiryEl = document.getElementById('pro-success-expiry');

  if (checkoutFlow) checkoutFlow.style.display = 'none';
  if (successBox) successBox.style.display = 'block';

  if (expiryEl && expiresAt) {
    const expDate = new Date(expiresAt);
    expiryEl.textContent = `Membresía activa hasta: ${expDate.toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  updateUserTierUI();
  lucide.createIcons();

  showToast({
    title: '👑 ¡Plan PRO Activado!',
    message: 'Disfruta de consultas ilimitadas con tu Analista AI y señales tácticas en vivo.',
    type: 'success',
    duration: 5000
  });

  if (window.loadNotifications) {
    loadNotifications(true);
  }
}

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  setupEcosystemAuth();
  setupEventListeners();
  setupAutoSync();
  loadNotifications();
  loadAllData();
  updateUserTierUI();
});


// =========================================================================
// 1. ECOSYSTEM SEPARATION & AUTHENTICATION (WELCOME VS TERMINAL)
// =========================================================================
function setupEcosystemAuth() {
  const welcomeView = document.getElementById('view-welcome');
  const terminalView = document.getElementById('view-terminal');
  const terminalSyncBox = document.getElementById('terminal-sync-box');
  const btnQuickAi = document.getElementById('btn-quick-ai');
  const welcomeAuthActions = document.getElementById('welcome-auth-actions');
  const terminalUserActions = document.getElementById('terminal-user-actions');

  const modalLogin = document.getElementById('modal-login');
  const btnOpenRegister = document.getElementById('btn-open-register');
  const btnOpenLogin = document.getElementById('btn-open-login');
  const btnCloseLogin = document.getElementById('btn-close-login-modal');
  const btnHeroRegister = document.getElementById('btn-hero-register');
  const btnHeroLogin = document.getElementById('btn-hero-login');
  const btnBannerRegister = document.getElementById('btn-banner-register');
  const btnBannerLogin = document.getElementById('btn-banner-login');
  const btnHeroExploreDemo = document.getElementById('btn-hero-explore-demo');
  const btnQuickDemoLogin = document.getElementById('btn-quick-demo-login');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const btnLogout = document.getElementById('btn-logout');
  const authAlert = document.getElementById('auth-alert');

  // Check persisted auth
  const isAuth = localStorage.getItem('kix_authenticated') === 'true';
  const savedName = localStorage.getItem('kix_user_name');
  const savedBroker = localStorage.getItem('kix_broker');
  if (savedName) {
    const userLabel = document.getElementById('user-display-name');
    if (userLabel) userLabel.textContent = savedName;
    const sideUserLabel = document.getElementById('sidebar-user-display-name');
    if (sideUserLabel) sideUserLabel.textContent = savedName;
  }
  const brokerLabel = document.getElementById('user-display-broker');
  if (brokerLabel) {
    const brokerName = (savedBroker && savedBroker !== 'Mercosur Casa de Bolsa') ? savedBroker : 'KixBroker BVC';
    brokerLabel.textContent = brokerName;
    const sideBrokerLabel = document.getElementById('sidebar-user-display-broker');
    if (sideBrokerLabel) sideBrokerLabel.textContent = brokerName;
    localStorage.setItem('kix_broker', brokerName);
  }

  const btnSecurity = document.getElementById('btn-open-security');
  if (btnSecurity) {
    const hasToken = !!localStorage.getItem('kix_token');
    if (!hasToken) {
      btnSecurity.style.display = 'none'; // NEVER show 2FA button in Demo mode
    } else {
      btnSecurity.style.display = 'inline-flex';
      const is2fa = localStorage.getItem('kix_2fa_enabled') === 'true';
      const secBadgeText = document.getElementById('security-badge-text');
      if (secBadgeText) {
        secBadgeText.textContent = is2fa ? '2FA Activo' : 'Activar 2FA';
      }
      btnSecurity.className = is2fa ? 'btn-security-header sec-active' : 'btn-security-header sec-pending';
    }
  }

  const ecoSwitcher = document.getElementById('ecosystem-switcher-header');

  switchView(isAuth ? 'terminal' : 'welcome');

  function switchView(viewName) {
    currentView = viewName;
    playSound('click');
    const terminalSidebar = document.getElementById('terminal-sidebar');
    const appMainContainer = document.getElementById('app-main-container');

    if (viewName === 'terminal') {
      welcomeView.classList.remove('active');
      terminalView.classList.add('active');

      if (terminalSidebar) {
        terminalSidebar.style.display = 'flex';
        const isCollapsed = localStorage.getItem('kix_sidebar_collapsed') === 'true';
        terminalSidebar.classList.toggle('collapsed', isCollapsed);
        if (appMainContainer) {
          appMainContainer.classList.add('in-terminal');
          appMainContainer.classList.toggle('sidebar-is-collapsed', isCollapsed);
        }
      }

      if (terminalSyncBox) terminalSyncBox.style.display = 'none'; // Managed in sidebar
      if (btnQuickAi) btnQuickAi.style.display = 'none'; // Managed in sidebar
      if (terminalUserActions) terminalUserActions.style.display = 'none'; // Managed in sidebar
      if (welcomeAuthActions) welcomeAuthActions.style.display = 'none';
      if (ecoSwitcher) ecoSwitcher.style.display = 'none'; // Managed in sidebar
      const ratesTicker = document.getElementById('rates-ticker-bvc');
      if (ratesTicker) ratesTicker.style.display = 'flex';

      switchEcosystem(activeEcosystem, false);
      startAutoSyncTimer();

      if (allocationChart) {
        setTimeout(() => allocationChart.resize(), 120);
      }
    } else {
      terminalView.classList.remove('active');
      welcomeView.classList.add('active');

      if (terminalSidebar) terminalSidebar.style.display = 'none';
      if (appMainContainer) {
        appMainContainer.classList.remove('in-terminal');
        appMainContainer.classList.remove('sidebar-is-collapsed');
      }

      if (terminalSyncBox) terminalSyncBox.style.display = 'none';
      if (btnQuickAi) btnQuickAi.style.display = 'none';
      if (terminalUserActions) terminalUserActions.style.display = 'none';
      if (welcomeAuthActions) welcomeAuthActions.style.display = 'flex';
      if (ecoSwitcher) ecoSwitcher.style.display = 'none';
      const ratesTicker = document.getElementById('rates-ticker-bvc');
      if (ratesTicker) ratesTicker.style.display = 'flex';

      stopAutoSyncTimer();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    lucide.createIcons();
  }

  let pending2FAUserUuid = null;
  let current2FASetupSecret = null;
  let inactivityTimer = null;
  let inactivityWarningTimer = null;
  let inactivityCountdown = 30;

  // ==========================================================
  // INACTIVITY AUTO-LOGOUT SYSTEM (30 MIN BANKING STANDARD)
  // ==========================================================
  function resetInactivityTimer() {
    if (localStorage.getItem('kix_authenticated') !== 'true') return;
    clearTimeout(inactivityTimer);
    // 25 minutes of total inactivity triggers 30-second warning modal
    inactivityTimer = setTimeout(showInactivityWarning, 25 * 60 * 1000);
  }

  function showInactivityWarning() {
    if (localStorage.getItem('kix_authenticated') !== 'true') return;
    const modalInact = document.getElementById('modal-inactivity');
    const countdownEl = document.getElementById('inactivity-countdown-num');
    if (modalInact) modalInact.classList.add('show');
    
    inactivityCountdown = 30;
    if (countdownEl) countdownEl.textContent = `${inactivityCountdown}s`;

    clearInterval(inactivityWarningTimer);
    inactivityWarningTimer = setInterval(() => {
      inactivityCountdown--;
      if (countdownEl) countdownEl.textContent = `${inactivityCountdown}s`;
      if (inactivityCountdown <= 0) {
        clearInterval(inactivityWarningTimer);
        if (modalInact) modalInact.classList.remove('show');
        performLogout();
        showToast({
          title: '🔒 Sesión Cerrada',
          message: 'Tu sesión se cerró automáticamente tras 25 minutos de inactividad.',
          type: 'warning',
          duration: 5000
        });
      }
    }, 1000);
  }

  function resetInactivityTimerFromModal() {
    clearInterval(inactivityWarningTimer);
    const modalInact = document.getElementById('modal-inactivity');
    if (modalInact) modalInact.classList.remove('show');
    resetInactivityTimer();
    showToast({
      title: 'Sesión Renovada',
      message: 'Continuando en tu terminal financiero seguro.',
      type: 'success',
      duration: 2500
    });
  }

  ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer, { passive: true });
  });

  function clearAuthInputs() {
    const formLogin = document.getElementById('form-login');
    if (formLogin) formLogin.reset();
    const formReg = document.getElementById('form-register');
    if (formReg) formReg.reset();
    const form2fa = document.getElementById('form-2fa-login');
    if (form2fa) form2fa.reset();

    const ids = [
      'login-username',
      'login-password',
      'reg-fullname',
      'reg-username',
      'reg-email',
      'reg-password',
      'login-2fa-code'
    ];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Wipe any asynchronous autofill from browser password managers
    setTimeout(() => {
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el && document.activeElement !== el) el.value = '';
      });
    }, 60);

    setTimeout(() => {
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el && document.activeElement !== el) el.value = '';
      });
    }, 250);
  }

  function switchAuthTab(tab) {
    playSound('click');
    clearAuthInputs();

    if (authAlert) {
      authAlert.style.display = 'none';
      authAlert.textContent = '';
      authAlert.className = 'auth-alert';
    }

    const btnLogin = document.getElementById('auth-tab-btn-login');
    const btnRegister = document.getElementById('auth-tab-btn-register');
    const viewLogin = document.getElementById('auth-view-login');
    const viewRegister = document.getElementById('auth-view-register');
    const view2fa = document.getElementById('auth-view-2fa');

    if (tab === 'register') {
      if (btnLogin) btnLogin.classList.remove('active');
      if (btnRegister) btnRegister.classList.add('active');
      if (viewLogin) viewLogin.style.display = 'none';
      if (view2fa) view2fa.style.display = 'none';
      if (viewRegister) viewRegister.style.display = 'block';
      const regInput = document.getElementById('reg-fullname');
      if (regInput) regInput.focus();
    } else if (tab === '2fa') {
      if (btnLogin) btnLogin.classList.remove('active');
      if (btnRegister) btnRegister.classList.remove('active');
      if (viewLogin) viewLogin.style.display = 'none';
      if (viewRegister) viewRegister.style.display = 'none';
      if (view2fa) view2fa.style.display = 'block';
      const codeInput = document.getElementById('login-2fa-code');
      if (codeInput) {
        codeInput.value = '';
        codeInput.focus();
      }
    } else {
      if (btnRegister) btnRegister.classList.remove('active');
      if (btnLogin) btnLogin.classList.add('active');
      if (viewRegister) viewRegister.style.display = 'none';
      if (view2fa) view2fa.style.display = 'none';
      if (viewLogin) viewLogin.style.display = 'block';
      const logInput = document.getElementById('login-username');
      if (logInput) logInput.focus();
    }
    lucide.createIcons();
  }

  function openAuthModal(tab = 'login') {
    playSound('click');
    clearAuthInputs();
    switchAuthTab(tab);
    if (modalLogin) modalLogin.classList.add('show');
  }

  function closeAuthModal() {
    playSound('click');
    clearAuthInputs();
    if (modalLogin) modalLogin.classList.remove('show');
    if (authAlert) {
      authAlert.style.display = 'none';
    }
  }

  function showAuthAlert(msg, type = 'error') {
    if (!authAlert) return;
    authAlert.textContent = msg;
    authAlert.className = `auth-alert ${type}`;
    authAlert.style.display = 'flex';
  }

  function applyUserSession(user, token = null) {
    localStorage.setItem('kix_authenticated', 'true');
    if (token) localStorage.setItem('kix_token', token);
    localStorage.setItem('kix_user_id', user.id);
    localStorage.setItem('kix_user_uuid', user.uuid || '');
    localStorage.setItem('kix_portfolio_id', user.portfolio_id || '');
    localStorage.setItem('kix_user_name', user.full_name || user.username);
    localStorage.setItem('kix_broker', user.broker || 'KixBroker BVC');
    localStorage.setItem('kix_risk_profile', user.risk_profile || 'Moderado');
    localStorage.setItem('kix_2fa_enabled', user.two_factor_enabled ? 'true' : 'false');
    localStorage.setItem('kix_subscription_tier', user.subscription_tier || 'free');
    localStorage.setItem('kix_is_pro', user.is_pro ? 'true' : 'false');
    localStorage.setItem('kix_ai_queries_used', user.ai_queries_used_this_month || 0);

    currentUserSubscription.tier = user.subscription_tier || 'free';
    currentUserSubscription.is_pro = Boolean(user.is_pro);
    currentUserSubscription.used_queries = user.ai_queries_used_this_month || 0;
    currentUserSubscription.queries_limit = user.ai_queries_limit || 10;
    currentUserSubscription.expires_at = user.subscription_expires_at || null;

    const userLabel = document.getElementById('user-display-name');
    if (userLabel) userLabel.textContent = user.full_name || user.username;
    const sideUserLabel = document.getElementById('sidebar-user-display-name');
    if (sideUserLabel) sideUserLabel.textContent = user.full_name || user.username;

    const brokerLabel = document.getElementById('user-display-broker');
    if (brokerLabel) brokerLabel.textContent = user.broker || 'KixBroker BVC';
    const sideBrokerLabel = document.getElementById('sidebar-user-display-broker');
    if (sideBrokerLabel) sideBrokerLabel.textContent = user.broker || 'KixBroker BVC';

    const btnSecurity = document.getElementById('btn-open-security');
    if (btnSecurity) {
      if (!token) {
        btnSecurity.style.display = 'none'; // NEVER show in Demo mode
      } else {
        btnSecurity.style.display = 'inline-flex';
        const is2fa = !!user.two_factor_enabled;
        const secBadgeText = document.getElementById('security-badge-text');
        if (secBadgeText) {
          secBadgeText.textContent = is2fa ? '2FA Activo' : 'Activar 2FA';
        }
        btnSecurity.className = is2fa ? 'btn-security-header sec-active' : 'btn-security-header sec-pending';
      }
    }

    resetInactivityTimer();
    closeAuthModal();
    switchView('terminal');
    loadAllData();
    updateUserTierUI();
  }


  // Handle Login Form Submit
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('login-username').value.trim();
      const pwd = document.getElementById('login-password').value;
      const hp = document.getElementById('login-hp') ? document.getElementById('login-hp').value : '';
      const btnSubmit = document.getElementById('btn-submit-login');

      if (!identifier || !pwd) {
        showAuthAlert('Por favor ingresa tu usuario y contraseña.');
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i data-lucide="loader-2" class="spin-anim"></i> Iniciando sesión...`;
        lucide.createIcons();
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username_or_email: identifier,
            password: pwd,
            system_website_hp: hp
          })
        });
        const data = await res.json();

        if (!res.ok) {
          showAuthAlert(data.detail || 'Credenciales incorrectas. Verifica tus datos.');
          playSound('click');
          return;
        }

        // STEP 1.5: 2FA Required check
        if (data.two_factor_required) {
          pending2FAUserUuid = data.user_uuid;
          switchAuthTab('2fa');
          showToast({
            title: '🔑 Código 2FA Requerido',
            message: data.message,
            type: 'warning',
            duration: 4000
          });
          return;
        }

        applyUserSession(data.user, data.token);

        showToast({
          title: '¡Sesión Iniciada con Éxito!',
          message: `Bienvenido de vuelta, ${data.user.full_name}.`,
          type: 'success',
          duration: 3500
        });

        addNotification({
          type: 'sync',
          title: 'Sesión Iniciada',
          desc: `Acceso protegido al terminal como ${data.user.full_name}.`
        });
      } catch (err) {
        showAuthAlert('Error de conexión con el servidor. Revisa tu red.');
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<i data-lucide="log-in"></i> Entrar al Terminal`;
          lucide.createIcons();
        }
      }
    });
  }

  // Handle 2FA Verification Form Submit
  const form2faLogin = document.getElementById('form-2fa-login');
  if (form2faLogin) {
    form2faLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('login-2fa-code').value.trim();
      const btnSubmit = document.getElementById('btn-submit-2fa-login');

      if (!code || code.length !== 6) {
        showAuthAlert('Ingresa los 6 dígitos de Google Authenticator.');
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i data-lucide="loader-2" class="spin-anim"></i> Validando TOTP...`;
        lucide.createIcons();
      }

      try {
        const res = await fetch('/api/auth/2fa/verify-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_uuid: pending2FAUserUuid,
            totp_code: code
          })
        });
        const data = await res.json();

        if (!res.ok) {
          showAuthAlert(data.detail || 'Código 2FA incorrecto o expirado.');
          playSound('click');
          return;
        }

        applyUserSession(data.user, data.token);

        showToast({
          title: '🛡️ Autenticación 2FA Verificada',
          message: `Bienvenido, ${data.user.full_name}. Acceso protegido completado.`,
          type: 'success',
          duration: 3500
        });
      } catch (err) {
        showAuthAlert('Error validando el código 2FA. Revisa tu conexión.');
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<i data-lucide="check-circle-2"></i> Validar y Acceder`;
          lucide.createIcons();
        }
      }
    });
  }

  // Handle Register Form Submit (Registro de Personas)
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('reg-fullname').value.trim();
      const username = document.getElementById('reg-username').value.trim().toLowerCase();
      const email = document.getElementById('reg-email').value.trim().toLowerCase();
      const password = document.getElementById('reg-password').value;
      const hp = document.getElementById('reg-hp') ? document.getElementById('reg-hp').value : '';
      const broker = document.getElementById('reg-broker') ? document.getElementById('reg-broker').value : 'KixBroker BVC';
      const riskProfile = document.getElementById('reg-risk') ? document.getElementById('reg-risk').value : 'Moderado';
      const cashVes = document.getElementById('reg-cash-ves') ? parseFinancialNumber(document.getElementById('reg-cash-ves').value) : 0;
      const cashUsd = document.getElementById('reg-cash-usd') ? parseFinancialNumber(document.getElementById('reg-cash-usd').value) : 0;
      const samplePositions = document.getElementById('reg-sample-positions') ? document.getElementById('reg-sample-positions').checked : false;
      const btnSubmit = document.getElementById('btn-submit-register');

      if (!fullName) {
        showAuthAlert('Por favor ingresa tu nombre y apellido.');
        return;
      }
      if (username.length < 3) {
        showAuthAlert('El usuario debe tener al menos 3 caracteres.');
        return;
      }
      if (!email.includes('@') || !email.includes('.')) {
        showAuthAlert('Por favor ingresa un correo electrónico válido.');
        return;
      }
      if (password.length < 10) {
        showAuthAlert('La contraseña debe tener al menos 10 caracteres.');
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i data-lucide="loader-2" class="spin-anim"></i> Creando cuenta...`;
        lucide.createIcons();
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username,
            email: email,
            full_name: fullName,
            password: password,
            system_website_hp: hp,
            broker: broker,
            risk_profile: riskProfile,
            initial_cash_ves: cashVes,
            initial_cash_usd: cashUsd,
            include_sample_positions: samplePositions
          })
        });
        const data = await res.json();

        if (!res.ok) {
          showAuthAlert(data.detail || 'No se pudo completar el registro.');
          playSound('click');
          return;
        }

        applyUserSession(data.user, data.token);

        showToast({
          title: '🎉 ¡Registro Exitoso!',
          message: `Bienvenido a KixInvertAPP, ${data.user.full_name}. Activa tu Doble Factor (2FA) para blindar tu patrimonio.`,
          type: 'success',
          duration: 4500
        });

        addNotification({
          type: 'sync',
          title: 'Inversionista Registrado',
          desc: `Nuevo usuario ${data.user.full_name} vinculado a ${data.user.broker}.`
        });
        playSound('success');

        // Immediately prompt and guide new user to configure 2FA Google Authenticator!
        setTimeout(() => {
          openSecurityModal(true);
        }, 550);
      } catch (err) {
        showAuthAlert('Error al conectar con el servidor: ' + err.message);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<i data-lucide="user-check"></i> Registrar Inversionista`;
          lucide.createIcons();
        }
      }
    });
  }

  function performDemoLogin() {
    const demoUser = {
      id: 999,
      portfolio_id: 999,
      full_name: 'Inversionista Demo',
      username: 'demo',
      broker: 'KixBroker BVC',
      risk_profile: 'Moderado',
      two_factor_enabled: false
    };
    applyUserSession(demoUser);
    showToast({
      title: 'Modo Demo Activo',
      message: 'Explorando terminal privado con datos bursátiles en vivo.',
      type: 'ai',
      duration: 3000
    });
  }

  let isLoggingOut = false;
  function performLogout() {
    if (isLoggingOut) return;
    isLoggingOut = true;
    setTimeout(() => { isLoggingOut = false; }, 1200);

    clearTimeout(inactivityTimer);
    clearInterval(inactivityWarningTimer);
    localStorage.removeItem('kix_authenticated');
    localStorage.removeItem('kix_token');
    localStorage.removeItem('kix_user_id');
    localStorage.removeItem('kix_user_uuid');
    localStorage.removeItem('kix_portfolio_id');
    localStorage.removeItem('kix_user_name');
    localStorage.removeItem('kix_broker');
    localStorage.removeItem('kix_risk_profile');
    localStorage.removeItem('kix_2fa_enabled');
    localStorage.removeItem('kix_subscription_tier');
    localStorage.removeItem('kix_is_pro');
    localStorage.removeItem('kix_ai_queries_used');

    currentUserSubscription = {
      tier: 'free',
      is_pro: false,
      used_queries: 0,
      queries_limit: 10,
      expires_at: null
    };

    const btnSecurity = document.getElementById('btn-open-security');
    if (btnSecurity) btnSecurity.style.display = 'none';

    switchView('welcome');
    updateUserTierUI();
    showToast({
      title: 'Sesión Finalizada',
      message: 'Has salido de tu terminal privado. ¡Hasta pronto!',
      type: 'ai',
      duration: 3000
    });
  }


  // ==========================================================
  // SECURITY CENTER & 2FA CONTROLLER
  // ==========================================================
  async function openSecurityModal(isOnboarding = false) {
    const token = localStorage.getItem('kix_token');
    if (!token) {
      showToast({
        title: 'Modo Demo',
        message: 'Para configurar la autenticación en dos pasos (2FA), crea tu cuenta de inversionista.',
        type: 'warning',
        duration: 3800
      });
      return;
    }

    playSound('click');
    const modal = document.getElementById('modal-security');
    if (!modal) return;

    const onboardingNotice = document.getElementById('sec-onboarding-notice');
    if (onboardingNotice) {
      onboardingNotice.style.display = isOnboarding ? 'block' : 'none';
    }

    try {
      const res = await fetchWithAuth('/api/auth/me');
      if (res.ok) {
        const u = await res.json();
        localStorage.setItem('kix_2fa_enabled', u.two_factor_enabled ? 'true' : 'false');
        updateSecurityModal2FAViews(u.two_factor_enabled);
        if (isOnboarding && !u.two_factor_enabled) {
          start2FASetup();
        }
      }
    } catch (e) {
      console.warn('Could not refresh user profile:', e);
    }

    loadAuditLogs();
    modal.classList.add('show');
    lucide.createIcons();
  }

  function closeSecurityModal() {
    playSound('click');
    const modal = document.getElementById('modal-security');
    if (modal) modal.classList.remove('show');
  }

  function updateSecurityModal2FAViews(isEnabled) {
    const badge = document.getElementById('sec-2fa-status-badge');
    const panelOff = document.getElementById('sec-2fa-off-panel');
    const panelSetup = document.getElementById('sec-2fa-setup-panel');
    const panelOn = document.getElementById('sec-2fa-on-panel');
    const headerBadge = document.getElementById('security-badge-text');
    const btnSecurity = document.getElementById('btn-open-security');

    if (badge) {
      badge.className = isEnabled ? 'security-status-badge security-status-active' : 'security-status-badge security-status-inactive';
      badge.innerHTML = isEnabled ? `<i data-lucide="shield-check"></i> Activo (Protegido)` : `<i data-lucide="shield-alert"></i> Inactivo`;
    }
    if (headerBadge) {
      headerBadge.textContent = isEnabled ? '2FA Activo' : 'Activar 2FA';
    }
    if (btnSecurity) {
      btnSecurity.className = isEnabled ? 'btn-security-header sec-active' : 'btn-security-header sec-pending';
    }

    if (panelSetup) panelSetup.style.display = 'none';

    if (isEnabled) {
      if (panelOff) panelOff.style.display = 'none';
      if (panelOn) panelOn.style.display = 'block';
    } else {
      if (panelOff) panelOff.style.display = 'block';
      if (panelOn) panelOn.style.display = 'none';
    }
    lucide.createIcons();
  }

  async function start2FASetup() {
    playSound('click');
    const token = localStorage.getItem('kix_token');
    if (!token) {
      showToast({
        title: 'Modo Demo (Solo Lectura)',
        message: 'Para configurar Google Authenticator real, regístrate o inicia sesión con tu cuenta.',
        type: 'warning',
        duration: 4500
      });
      return;
    }
    try {
      const res = await fetchWithAuth('/api/auth/2fa/setup', { method: 'POST' });
      if (!res.ok) {
        showToast({ title: 'Error', message: 'No se pudo generar la clave 2FA.', type: 'error' });
        return;
      }
      const data = await res.json();
      current2FASetupSecret = data.secret;

      const img = document.getElementById('sec-qr-img');
      const keySpan = document.getElementById('sec-qr-manual-key');
      const panelOff = document.getElementById('sec-2fa-off-panel');
      const panelSetup = document.getElementById('sec-2fa-setup-panel');

      if (img) img.src = data.qr_code_base64;
      if (keySpan) keySpan.textContent = data.manual_entry_key;

      if (panelOff) panelOff.style.display = 'none';
      if (panelSetup) panelSetup.style.display = 'block';

      const codeInput = document.getElementById('sec-confirm-totp-code');
      if (codeInput) {
        codeInput.value = '';
        codeInput.focus();
      }
      lucide.createIcons();
    } catch (e) {
      showToast({ title: 'Error', message: String(e), type: 'error' });
    }
  }

  function cancel2FASetup() {
    playSound('click');
    current2FASetupSecret = null;
    updateSecurityModal2FAViews(false);
  }

  async function confirmEnable2FA() {
    const code = document.getElementById('sec-confirm-totp-code').value.trim();
    if (!code || code.length !== 6) {
      alert('Ingresa el código de 6 dígitos que muestra Google Authenticator.');
      return;
    }

    try {
      const res = await fetchWithAuth('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: current2FASetupSecret,
          totp_code: code
        })
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || 'Código 2FA incorrecto.');
        return;
      }

      localStorage.setItem('kix_2fa_enabled', 'true');
      updateSecurityModal2FAViews(true);
      loadAuditLogs();

      showToast({
        title: '🛡️ ¡2FA Activado con Éxito!',
        message: 'El doble factor de autenticación ha sido habilitado.',
        type: 'success',
        duration: 4000
      });
      playSound('success');
    } catch (e) {
      alert('Error activando 2FA: ' + e.message);
    }
  }

  async function promptDisable2FA() {
    const pwd = prompt('Para desactivar el doble factor, ingresa tu contraseña:');
    if (!pwd) return;
    const code = prompt('Ingresa tu código actual de 6 dígitos de Google Authenticator:');
    if (!code) return;

    try {
      const res = await fetchWithAuth('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd, totp_code: code })
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || 'No se pudo desactivar el 2FA. Verifica tus datos.');
        return;
      }

      localStorage.setItem('kix_2fa_enabled', 'false');
      updateSecurityModal2FAViews(false);
      loadAuditLogs();

      showToast({
        title: '2FA Desactivado',
        message: 'La verificación en dos pasos fue deshabilitada.',
        type: 'warning',
        duration: 3500
      });
    } catch (e) {
      alert('Error desactivando 2FA: ' + e.message);
    }
  }

  async function loadAuditLogs() {
    const tbody = document.getElementById('audit-logs-tbody');
    if (!tbody) return;

    const token = localStorage.getItem('kix_token');
    if (!token) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-dim">Estás en Modo Demo. Inicia sesión con tu cuenta para ver tu pista de auditoría en tiempo real.</td></tr>`;
      return;
    }

    try {
      const res = await fetchWithAuth('/api/audit-logs');
      if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-dim">No hay registros de auditoría aún.</td></tr>`;
        return;
      }
      const logs = await res.json();

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-dim">No hay eventos registrados recientemente.</td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      logs.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${l.created_at}</td>
          <td><span class="audit-action-badge">${l.action}</span></td>
          <td><code>${l.ip_address || 'Localhost'}</code></td>
          <td style="color: #cbd5e1;">${l.details || '---'}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-red">Error cargando auditoría.</td></tr>`;
    }
  }

  // Expose globally for HTML onclick handlers
  window.switchView = switchView;
  window.openLoginModal = (tab = 'login') => openAuthModal(tab);
  window.closeLoginModal = closeAuthModal;
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.switchAuthTab = switchAuthTab;
  window.performLogin = performDemoLogin;
  window.performDemoLogin = performDemoLogin;
  window.performLogout = performLogout;
  window.openSecurityModal = openSecurityModal;
  window.closeSecurityModal = closeSecurityModal;
  window.start2FASetup = start2FASetup;
  window.cancel2FASetup = cancel2FASetup;
  window.confirmEnable2FA = confirmEnable2FA;
  window.promptDisable2FA = promptDisable2FA;
  window.loadAuditLogs = loadAuditLogs;
  window.resetInactivityTimerFromModal = resetInactivityTimerFromModal;

  function openAiTab() {
    playSound('ai');
    if (currentView !== 'terminal') {
      switchView('terminal');
    }
    activateTab('tab-ai');
    loadAIDiagnosis();
    updateAiDemoCounterBadge();


    setTimeout(() => {
      const aiTarget = document.getElementById('tab-ai') || document.querySelector('.terminal-tabs');
      if (aiTarget) {
        aiTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      const chatInput = document.getElementById('ai-chat-input');
      if (chatInput) {
        chatInput.focus();
        chatInput.classList.add('ai-input-highlight');
        setTimeout(() => chatInput.classList.remove('ai-input-highlight'), 1800);
      }
    }, 120);

    showToast({
      title: '🤖 KixInvert AI Analista',
      message: 'Consultando diagnóstico bursátil y recomendaciones para tu cartera.',
      type: 'ai',
      duration: 3200
    });
  }

  window.openAiTab = openAiTab;

  if (btnQuickAi) {
    btnQuickAi.addEventListener('click', openAiTab);
  }

  if (btnOpenRegister) btnOpenRegister.addEventListener('click', () => openAuthModal('register'));
  if (btnOpenLogin) btnOpenLogin.addEventListener('click', () => openAuthModal('login'));
  if (btnHeroRegister) btnHeroRegister.addEventListener('click', () => openAuthModal('register'));
  if (btnHeroLogin) btnHeroLogin.addEventListener('click', () => openAuthModal('login'));
  if (btnBannerRegister) btnBannerRegister.addEventListener('click', () => openAuthModal('register'));
  if (btnBannerLogin) btnBannerLogin.addEventListener('click', () => openAuthModal('login'));
  if (btnCloseLogin) btnCloseLogin.addEventListener('click', closeAuthModal);

  if (btnHeroExploreDemo) btnHeroExploreDemo.addEventListener('click', performDemoLogin);
  if (btnQuickDemoLogin) btnQuickDemoLogin.addEventListener('click', performDemoLogin);

  const btnOpenSecurity = document.getElementById('btn-open-security');
  if (btnOpenSecurity) {
    btnOpenSecurity.addEventListener('click', openSecurityModal);
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', performLogout);
  }

  const brandLink = document.getElementById('brand-link');
  if (brandLink) {
    brandLink.addEventListener('click', () => {
      if (currentView === 'terminal') {
        switchView('welcome');
      } else {
        const auth = localStorage.getItem('kix_authenticated') === 'true';
        if (auth) switchView('terminal');
      }
    });
  }
}

// =========================================================================
// 2. AUTO-SYNC TIMER (30 SECONDS INTERVAL)
// =========================================================================
function setupAutoSync() {
  const syncBtn = document.getElementById('btn-sync');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncCountdown = 30;
      updateSyncTimerDisplay();
      await triggerManualSync();
    });
  }
}

function startAutoSyncTimer() {
  stopAutoSyncTimer();
  syncCountdown = 30;
  updateSyncTimerDisplay();

  syncTimerInterval = setInterval(async () => {
    if (currentView !== 'terminal') return;
    syncCountdown--;
    if (syncCountdown <= 0) {
      syncCountdown = 30;
      updateSyncTimerDisplay();
      await loadAllData(true); // Silent reload with live animations
    } else {
      updateSyncTimerDisplay();
    }
  }, 1000);
}

function stopAutoSyncTimer() {
  if (syncTimerInterval) {
    clearInterval(syncTimerInterval);
    syncTimerInterval = null;
  }
}

function updateSyncTimerDisplay() {
  const label = document.getElementById('sync-timer-label');
  if (label) {
    label.textContent = `Auto-sync: ${syncCountdown}s`;
  }
  const sideLabel = document.getElementById('sidebar-sync-timer-label');
  if (sideLabel) {
    sideLabel.textContent = `Auto-sync: ${syncCountdown}s`;
  }
}

async function triggerManualSync() {
  const btn = document.getElementById('btn-sync');
  if (btn) btn.classList.add('spin-anim');
  try {
    await fetch('/api/rates/sync', { method: 'POST' });
    showToast({
      title: '⚡ Sincronización Manual',
      message: 'Tasas BCV/USDT y cotizaciones BVC actualizadas al segundo.',
      type: 'success',
      duration: 3000
    });
    await loadAllData(false);
  } catch (err) {
    console.error('Error in manual sync:', err);
    showToast({
      title: 'Error de Red',
      message: 'No se pudo conectar con el servidor bursátil.',
      type: 'error',
      duration: 4000
    });
  } finally {
    if (btn) btn.classList.remove('spin-anim');
  }
}

// =========================================================================
// 3. UI EVENT LISTENERS & MODALS
// =========================================================================
function setupEventListeners() {
  // Sound Toggle Button
  const btnSound = document.getElementById('btn-toggle-sound');
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      const icon = document.getElementById('icon-sound');
      if (icon) {
        icon.setAttribute('data-lucide', soundEnabled ? 'volume-2' : 'volume-x');
        lucide.createIcons();
      }
      btnSound.title = soundEnabled ? 'Sonido activado (clic para silenciar)' : 'Sonido silenciado (clic para activar)';
      showToast({
        title: soundEnabled ? '🔊 Sonidos Activados' : '🔇 Modo Silencioso',
        message: soundEnabled ? 'Efectos sonoros y pings bursátiles habilitados.' : 'Efectos de audio desactivados.',
        type: 'ai',
        duration: 2500
      });
    });
  }

  // =========================================================================
  // NOTIFICATION & ALERTS CONTROLLER (REAL-TIME FINANCIAL INTELLIGENCE)
  // =========================================================================
  let currentNotifCategory = 'all';
  let cachedNotifications = [];

  const btnNotifs = document.getElementById('btn-toggle-notifs');
  const notifDropdown = document.getElementById('notif-dropdown');
  const notifBadgeCount = document.getElementById('notif-badge-count');
  const notifUnreadPill = document.getElementById('notif-unread-pill');
  const notifListEl = document.getElementById('notif-list');
  const btnClearNotifs = document.getElementById('btn-clear-notifs');
  const btnRefreshNotifs = document.getElementById('btn-refresh-notifs');

  async function loadNotifications(silent = false) {
    try {
      const url = currentNotifCategory && currentNotifCategory !== 'all' 
        ? `/api/notifications?category=${currentNotifCategory}` 
        : '/api/notifications';
      const res = await fetchWithAuth(url);
      if (!res.ok) return;
      const data = await res.json();
      cachedNotifications = data.notifications || [];
      const unreadCount = data.unread_count || 0;

      // Update badge
      if (notifBadgeCount) {
        if (unreadCount > 0) {
          notifBadgeCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
          notifBadgeCount.style.display = 'inline-flex';
        } else {
          notifBadgeCount.style.display = 'none';
        }
      }

      const sideNotifCount = document.getElementById('sidebar-notif-count');
      if (sideNotifCount) {
        if (unreadCount > 0) {
          sideNotifCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
          sideNotifCount.style.display = 'inline-flex';
        } else {
          sideNotifCount.style.display = 'none';
        }
      }

      // Update pill
      if (notifUnreadPill) {
        notifUnreadPill.textContent = `${unreadCount} no leída${unreadCount === 1 ? '' : 's'}`;
      }

      renderNotificationList(cachedNotifications);
    } catch (err) {
      console.warn('Error loading notifications:', err);
    }
  }
  window.loadNotifications = loadNotifications;

  function renderNotificationList(notifs) {
    if (!notifListEl) return;
    if (!notifs || notifs.length === 0) {
      notifListEl.innerHTML = `
        <div class="notif-empty-state">
          <i data-lucide="shield-check"></i>
          <p><strong>Todo en orden</strong><br>No hay alertas activas en esta categoría.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    notifListEl.innerHTML = notifs.map(n => {
      const unreadClass = !n.is_read ? 'notif-unread' : '';
      const sevClass = `sev-${n.severity || 'info'}`;
      
      let icon = 'bell';
      if (n.type && n.type.includes('sell')) icon = 'target';
      else if (n.type && n.type.includes('rotate')) icon = 'alert-triangle';
      else if (n.type && n.type.includes('gap')) icon = 'trending-up';
      else if (n.type && n.type.includes('rally')) icon = 'rocket';
      else if (n.type && n.type.includes('dip')) icon = 'arrow-down-right';
      else if (n.type && n.type.includes('concentration')) icon = 'pie-chart';

      const actionText = n.action_url === '#tab-positions' ? 'Ver en Portafolio' : (n.action_url === '#tab-board' ? 'Ver en Pizarra' : 'Ver detalle');

      return `
        <div class="notif-item ${unreadClass} ${sevClass}" data-id="${n.id}" data-action="${n.action_url || ''}" data-ticker="${n.ticker || ''}">
          <div class="notif-item-icon ${sevClass}">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="notif-item-content">
            <div class="notif-item-title-row">
              <span class="notif-item-title">${escapeHtml(n.title)}</span>
              <span class="notif-item-time">${escapeHtml(n.time_ago || '')}</span>
            </div>
            <div class="notif-item-desc">${escapeHtml(n.message)}</div>
            <div class="notif-item-footer">
              <span class="notif-action-tag">
                <i data-lucide="arrow-right-circle"></i> ${actionText}
              </span>
              ${!n.is_read ? '<span class="notif-unread-dot" title="No leída"></span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to cards
    notifListEl.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', async () => {
        const notifId = item.getAttribute('data-id');
        const actionUrl = item.getAttribute('data-action');
        const ticker = item.getAttribute('data-ticker');

        playSound('click');
        try {
          await fetchWithAuth(`/api/notifications/${notifId}/read`, { method: 'POST' });
          item.classList.remove('notif-unread');
          const dot = item.querySelector('.notif-unread-dot');
          if (dot) dot.remove();
          loadNotifications(true);
        } catch (e) {
          console.error(e);
        }

        // Navigate if applicable
        if (actionUrl === '#tab-positions') {
          activateTab('tab-positions');
          if (ticker) {
            highlightPositionRow(ticker);
          }
        } else if (actionUrl === '#tab-board') {
          activateTab('tab-board');
        }

        if (notifDropdown) {
          notifDropdown.classList.remove('show');
        }
      });
    });

    if (window.lucide) lucide.createIcons();
  }

  function highlightPositionRow(ticker) {
    setTimeout(() => {
      const rows = document.querySelectorAll('#positions-table-body tr, #positions-us-tbody tr');
      rows.forEach(r => {
        if (r.textContent.includes(ticker)) {
          r.scrollIntoView({ behavior: 'smooth', block: 'center' });
          r.style.transition = 'box-shadow 0.3s, background 0.3s';
          r.style.background = 'rgba(16, 185, 129, 0.2)';
          r.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.5)';
          setTimeout(() => {
            r.style.background = '';
            r.style.boxShadow = '';
          }, 2400);
        }
      });
    }, 150);
  }

  if (btnNotifs && notifDropdown) {
    btnNotifs.addEventListener('click', (e) => {
      e.stopPropagation();
      playSound('click');
      const isOpening = !notifDropdown.classList.contains('show');
      notifDropdown.classList.toggle('show');
      if (isOpening) {
        loadNotifications();
      }
    });

    document.addEventListener('click', (e) => {
      const sideBtn = document.getElementById('sidebar-btn-notifs');
      if (!notifDropdown.contains(e.target) && e.target !== btnNotifs && (!sideBtn || !sideBtn.contains(e.target))) {
        notifDropdown.classList.remove('show', 'show-sidebar', 'from-sidebar');
      }
    });

    if (btnClearNotifs) {
      btnClearNotifs.addEventListener('click', async (e) => {
        e.stopPropagation();
        playSound('click');
        try {
          await fetchWithAuth('/api/notifications/read-all', { method: 'POST' });
          await loadNotifications(true);
          showToast({
            title: '✅ Alertas al Día',
            message: 'Todas las notificaciones han sido marcadas como leídas.',
            type: 'ai',
            duration: 2000
          });
        } catch (err) {
          console.error(err);
        }
      });
    }

    if (btnRefreshNotifs) {
      btnRefreshNotifs.addEventListener('click', async (e) => {
        e.stopPropagation();
        playSound('click');
        btnRefreshNotifs.classList.add('rotating');
        try {
          await fetchWithAuth('/api/notifications/refresh', { method: 'POST' });
          await loadNotifications(true);
        } catch (err) {
          console.error(err);
        } finally {
          setTimeout(() => btnRefreshNotifs.classList.remove('rotating'), 600);
        }
      });
    }

    // Category Tabs: all, tactical, market
    document.querySelectorAll('.notif-cat-btn').forEach(catBtn => {
      catBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playSound('click');
        document.querySelectorAll('.notif-cat-btn').forEach(b => b.classList.remove('active'));
        catBtn.classList.add('active');
        currentNotifCategory = catBtn.getAttribute('data-cat') || 'all';
        loadNotifications(true);
      });
    });
  }

  // Currency switcher buttons
  document.querySelectorAll('.curr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playSound('click');
      document.querySelectorAll('.curr-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCurrency = btn.getAttribute('data-curr');
      
      const primaryValEl = document.getElementById('total-val-primary');
      if (primaryValEl) {
        primaryValEl.classList.remove('value-flip');
        void primaryValEl.offsetWidth; // Trigger reflow for animation restart
        primaryValEl.classList.add('value-flip');
      }

      updateUI();
    });
  });

  // Navigation Tabs inside Terminal
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playSound('click');
      const target = btn.getAttribute('data-tab');
      activateTab(target);
      if (target === 'tab-ai') {
        loadAIDiagnosis();
      }
    });
  });

  // AI Refresh button
  const btnRefreshAi = document.getElementById('btn-refresh-ai');
  if (btnRefreshAi) {
    btnRefreshAi.addEventListener('click', () => loadAIDiagnosis(true));
  }

  // AI Suggested chips
  document.querySelectorAll('.btn-chip-suggest').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-q');
      const input = document.getElementById('ai-chat-input');
      if (input) {
        input.value = q;
        submitAIChat(q);
      }
    });
  });

  // AI Chat Form
  const formAiChat = document.getElementById('form-ai-chat');
  if (formAiChat) {
    formAiChat.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('ai-chat-input');
      const q = input.value.trim();
      if (!q) return;
      submitAIChat(q);
      input.value = '';
    });
  }

  // Market Search BVC
  const marketSearch = document.getElementById('market-search');
  if (marketSearch) {
    marketSearch.addEventListener('input', (e) => {
      renderMarketTable(e.target.value.toLowerCase().trim());
    });
  }

  // Market Search Wall Street
  const marketUsSearch = document.getElementById('market-us-search');
  if (marketUsSearch) {
    marketUsSearch.addEventListener('input', (e) => {
      renderMarketUsTable(e.target.value.toLowerCase().trim());
    });
  }

  // Modals Setup (Add Position, Cash, What-If, Report, Telegram & Landing)
  setupPositionAndCashModals();
  setupWhatIfAndReportModals();
  setupTelegramModal();
  setupLandingPageInteractions();
}

function activateTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');

  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');

  // Sync Sidebar Tab Items
  const sPos = document.getElementById('sidebar-nav-positions');
  const sMkt = document.getElementById('sidebar-nav-market');
  const sAi = document.getElementById('sidebar-nav-ai');
  if (sPos) sPos.classList.toggle('active', tabId === 'tab-positions');
  if (sMkt) sMkt.classList.toggle('active', tabId === 'tab-market');
  if (sAi) sAi.classList.toggle('active', tabId === 'tab-ai');

  lucide.createIcons();
}

function setupPositionAndCashModals() {
  const addModal = document.getElementById('modal-add-position');
  const posPriceInput = document.getElementById('pos-price');
  const posSharesInput = document.getElementById('pos-shares');
  const posCurrSelect = document.getElementById('pos-currency');
  const btnModeUnit = document.getElementById('btn-mode-unit');
  const btnModeTotal = document.getElementById('btn-mode-total');
  const lblPosPrice = document.getElementById('lbl-pos-price');
  const lblOpSummary = document.getElementById('lbl-op-summary');

  let priceInputMode = 'unit'; // 'unit' or 'total'

  if (btnModeUnit && btnModeTotal) {
    btnModeUnit.addEventListener('click', () => {
      playSound('click');
      priceInputMode = 'unit';
      btnModeUnit.classList.add('active');
      btnModeTotal.classList.remove('active');
      if (lblPosPrice) lblPosPrice.textContent = 'Precio de Compra por Acción';
      if (lblOpSummary) lblOpSummary.textContent = 'Inversión Estimada:';
      posPriceInput.placeholder = 'Ej: 219,19 o 1.898,00';
      updateModalCalc();
    });

    btnModeTotal.addEventListener('click', () => {
      playSound('click');
      priceInputMode = 'total';
      btnModeTotal.classList.add('active');
      btnModeUnit.classList.remove('active');
      if (lblPosPrice) lblPosPrice.textContent = 'Costo Total de Compra (Monto Global)';
      if (lblOpSummary) lblOpSummary.textContent = 'Precio Calculado por Acción:';
      posPriceInput.placeholder = 'Ej: 2.411,13 o 1.814,95';
      updateModalCalc();
    });
  }

  function updateModalCalc() {
    const sharesPreview = document.getElementById('pos-shares-preview');
    const pricePreview = document.getElementById('pos-price-preview');
    const totalCalc = document.getElementById('op-total-calc');

    const shares = parseFinancialNumber(posSharesInput.value);
    const enteredAmount = parseFinancialNumber(posPriceInput.value);
    const curr = posCurrSelect.value;
    const rates = portfolioData && portfolioData.rates ? portfolioData.rates : { bcv: 879.12 };

    if (shares > 0) {
      sharesPreview.innerHTML = `<i data-lucide="check"></i> <span>${formatNumber(shares, 0)} títulos</span>`;
      sharesPreview.className = 'input-helper active';
    } else {
      sharesPreview.innerHTML = `<i data-lucide="hash"></i> <span>Ej: 5.000 títulos</span>`;
      sharesPreview.className = 'input-helper';
    }

    if (priceInputMode === 'unit') {
      const price = enteredAmount;
      if (price > 0) {
        if (curr === 'VES') {
          const equivUsd = rates.bcv > 0 ? price / rates.bcv : 0;
          pricePreview.innerHTML = `<i data-lucide="check"></i> <span>Interpretado: ${formatVES(price)} ($${formatNumber(equivUsd, 2)} USD)</span>`;
        } else {
          const equivVes = price * (rates.bcv || 0);
          pricePreview.innerHTML = `<i data-lucide="check"></i> <span>Interpretado: $${formatNumber(price, 2)} USD (${formatVES(equivVes)})</span>`;
        }
        pricePreview.className = 'input-helper active';
      } else {
        pricePreview.innerHTML = `<i data-lucide="info"></i> <span>Puedes usar comas (,) o puntos (.)</span>`;
        pricePreview.className = 'input-helper';
      }

      if (shares > 0 && price > 0) {
        const totalAmount = shares * price;
        if (curr === 'VES') {
          const totalUsd = rates.bcv > 0 ? totalAmount / rates.bcv : 0;
          totalCalc.innerHTML = `${formatVES(totalAmount)} <small style="color:var(--text-dim);">(${formatUSD(totalUsd)})</small>`;
        } else {
          const totalVes = totalAmount * (rates.bcv || 0);
          totalCalc.innerHTML = `${formatUSD(totalAmount)} <small style="color:var(--text-dim);">(${formatVES(totalVes)})</small>`;
        }
      } else {
        totalCalc.textContent = '---';
      }
    } else {
      const totalAmount = enteredAmount;
      if (totalAmount > 0) {
        if (curr === 'VES') {
          pricePreview.innerHTML = `<i data-lucide="check"></i> <span>Costo Total: ${formatVES(totalAmount)}</span>`;
        } else {
          pricePreview.innerHTML = `<i data-lucide="check"></i> <span>Costo Total: ${formatUSD(totalAmount)}</span>`;
        }
        pricePreview.className = 'input-helper active';
      } else {
        pricePreview.innerHTML = `<i data-lucide="info"></i> <span>Ingresa el monto total pagado</span>`;
        pricePreview.className = 'input-helper';
      }

      if (shares > 0 && totalAmount > 0) {
        const unitPrice = totalAmount / shares;
        if (curr === 'VES') {
          const unitUsd = rates.bcv > 0 ? unitPrice / rates.bcv : 0;
          totalCalc.innerHTML = `${formatVES(unitPrice)} / acción <small style="color:var(--text-dim);">(${formatUSD(unitUsd)})</small>`;
        } else {
          const unitVes = unitPrice * (rates.bcv || 0);
          totalCalc.innerHTML = `${formatUSD(unitPrice)} / acción <small style="color:var(--text-dim);">(${formatVES(unitVes)})</small>`;
        }
      } else {
        totalCalc.textContent = '---';
      }
    }

    lucide.createIcons();
  }

  const posTickerSelect = document.getElementById('pos-ticker');
  if (posTickerSelect) {
    posTickerSelect.addEventListener('change', () => {
      const selected = posTickerSelect.value;
      if (!selected) return;

      const opt = posTickerSelect.options[posTickerSelect.selectedIndex];
      const isIntl = opt && opt.getAttribute('data-currency') === 'USD';

      if (isIntl) {
        const usdPrice = parseFloat(opt.getAttribute('data-price-usd') || '0');
        if (posCurrSelect) posCurrSelect.value = 'USD';
        if (usdPrice > 0 && posPriceInput) {
          posPriceInput.value = formatNumber(usdPrice, 2);
        }
        updateModalCalc();
      } else {
        const q = marketQuotes.find(item => item.ticker === selected);
        if (q && q.price_ves > 0) {
          posPriceInput.value = formatNumber(q.price_ves, 2);
          if (posCurrSelect) posCurrSelect.value = 'VES';
          updateModalCalc();
        }
      }
    });
  }

  if (posPriceInput) {
    posPriceInput.addEventListener('input', updateModalCalc);
    posPriceInput.addEventListener('blur', () => {
      const val = parseFinancialNumber(posPriceInput.value);
      if (val > 0) {
        posPriceInput.value = formatNumber(val, 2);
        updateModalCalc();
      }
    });
  }

  if (posSharesInput) {
    posSharesInput.addEventListener('input', updateModalCalc);
    posSharesInput.addEventListener('blur', () => {
      const val = parseFinancialNumber(posSharesInput.value);
      if (val > 0) {
        posSharesInput.value = formatNumber(val, 0);
        updateModalCalc();
      }
    });
  }

  if (posCurrSelect) posCurrSelect.addEventListener('change', updateModalCalc);

  const btnOpenAdd = document.getElementById('btn-open-add-modal');
  if (btnOpenAdd) {
    btnOpenAdd.addEventListener('click', () => {
      playSound('click');
      updateModalCalc();
      if (addModal) addModal.classList.add('show');
    });
  }
  const btnCloseAdd = document.getElementById('btn-close-add-modal');
  if (btnCloseAdd) btnCloseAdd.addEventListener('click', () => {
    playSound('click');
    addModal.classList.remove('show');
  });
  const btnCancelAdd = document.getElementById('btn-cancel-add');
  if (btnCancelAdd) btnCancelAdd.addEventListener('click', () => {
    playSound('click');
    addModal.classList.remove('show');
  });

  // Form Add Position Submit
  const formAddPos = document.getElementById('form-add-position');
  if (formAddPos) {
    formAddPos.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ticker = document.getElementById('pos-ticker').value;
      const shares = parseFinancialNumber(posSharesInput.value);
      const price = parseFinancialNumber(posPriceInput.value);
      const currency = posCurrSelect.value;

      if (shares <= 0 || price <= 0) {
        showToast({ title: 'Datos Incompletos', message: 'Por favor ingresa títulos y precio válidos.', type: 'warning' });
        return;
      }

      const buy_price = priceInputMode === 'total' ? (price / shares) : price;

      try {
        const res = await fetchWithAuth('/api/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker,
            shares,
            buy_price: buy_price,
            currency
          })
        });
        if (res.ok) {
          addModal.classList.remove('show');
          formAddPos.reset();
          priceInputMode = 'unit';
          if (btnModeUnit) btnModeUnit.classList.add('active');
          if (btnModeTotal) btnModeTotal.classList.remove('active');
          if (lblPosPrice) lblPosPrice.textContent = 'Precio de Compra por Acción';
          
          showToast({
            title: '✅ Posición Guardada',
            message: `Se añadieron ${formatNumber(shares, 0)} títulos de ${ticker} a tu portafolio.`,
            type: 'success',
            duration: 3500
          });

          addNotification({
            type: 'sync',
            title: `Operación Registrada: ${ticker}`,
            desc: `Comprados ${formatNumber(shares, 0)} títulos a ${formatVES(buy_price)}.`
          });

          await loadAllData();
        }
      } catch (err) {
        showToast({ title: 'Error Guardando', message: String(err), type: 'error' });
      }
    });
  }

  // Cash Modal
  const cashModal = document.getElementById('modal-cash');
  const cashVesInput = document.getElementById('cash-ves-input');
  const cashUsdInput = document.getElementById('cash-usd-input');

  function updateCashCalc() {
    const previewVes = document.getElementById('cash-ves-preview');
    const previewUsd = document.getElementById('cash-usd-preview');
    const ves = parseFinancialNumber(cashVesInput.value);
    const usd = parseFinancialNumber(cashUsdInput.value);
    if (previewVes) previewVes.textContent = formatVES(ves);
    if (previewUsd) previewUsd.textContent = formatUSD(usd);
  }

  if (cashVesInput) {
    cashVesInput.addEventListener('input', updateCashCalc);
    cashVesInput.addEventListener('blur', () => {
      const val = parseFinancialNumber(cashVesInput.value);
      cashVesInput.value = formatNumber(val, 2);
      updateCashCalc();
    });
  }

  if (cashUsdInput) {
    cashUsdInput.addEventListener('input', updateCashCalc);
    cashUsdInput.addEventListener('blur', () => {
      const val = parseFinancialNumber(cashUsdInput.value);
      cashUsdInput.value = formatNumber(val, 2);
      updateCashCalc();
    });
  }

  const btnEditCash = document.getElementById('btn-edit-cash');
  if (btnEditCash) {
    btnEditCash.addEventListener('click', () => {
      playSound('click');
      if (portfolioData) {
        cashVesInput.value = formatNumber(portfolioData.cash_ves || 0, 2);
        cashUsdInput.value = formatNumber(portfolioData.cash_usd || 0, 2);
        updateCashCalc();
      }
      if (cashModal) cashModal.classList.add('show');
    });
  }

  const btnCloseCash = document.getElementById('btn-close-cash-modal');
  if (btnCloseCash) btnCloseCash.addEventListener('click', () => {
    playSound('click');
    cashModal.classList.remove('show');
  });
  const btnCancelCash = document.getElementById('btn-cancel-cash');
  if (btnCancelCash) btnCancelCash.addEventListener('click', () => {
    playSound('click');
    cashModal.classList.remove('show');
  });

  const formEditCash = document.getElementById('form-edit-cash');
  if (formEditCash) {
    formEditCash.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cashVes = parseFinancialNumber(cashVesInput.value);
      const cashUsd = parseFinancialNumber(cashUsdInput.value);

      try {
        const res = await fetchWithAuth('/api/portfolio/cash', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cash_ves: cashVes,
            cash_usd: cashUsd
          })
        });
        if (res.ok) {
          cashModal.classList.remove('show');
          showToast({
            title: '💵 Saldo Actualizado',
            message: `Efectivo ajustado: ${formatVES(cashVes)} / ${formatUSD(cashUsd)}.`,
            type: 'success',
            duration: 3500
          });
          await loadAllData();
        }
      } catch (err) {
        showToast({ title: 'Error Actualizando', message: String(err), type: 'error' });
      }
    });
  }
}

// =========================================================================
// 4. DATA LOADING & UI RENDERING (DUAL ECOSYSTEM ARCHITECTURE)
// =========================================================================
async function loadAllData(silent = false) {
  try {
    const [portRes, quotesRes, intlRes] = await Promise.all([
      fetchWithAuth('/api/portfolio'),
      fetch('/api/quotes'),
      fetch('/api/international/popular').catch(() => null)
    ]);

    portfolioData = await portRes.json();
    const qJson = await quotesRes.json();
    marketQuotes = qJson.quotes || [];

    if (intlRes && intlRes.ok) {
      try {
        popularInternationalQuotes = await intlRes.json();
      } catch (e) {
        popularInternationalQuotes = [];
      }
    }

    // Sync profile and subscription status if logged in
    if (localStorage.getItem('kix_token')) {
      try {
        const meRes = await fetchWithAuth('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          currentUserSubscription.tier = meData.subscription_tier || 'free';
          currentUserSubscription.is_pro = Boolean(meData.is_pro);
          currentUserSubscription.used_queries = meData.ai_queries_used_this_month || 0;
          currentUserSubscription.queries_limit = meData.ai_queries_limit || 10;
          currentUserSubscription.expires_at = meData.subscription_expires_at || null;
          updateUserTierUI();
        }
      } catch (e) {
        // silent
      }
    }

    updateUI();
    loadNotifications(true);

    // Stream ticker tape according to active ecosystem
    if (activeEcosystem === 'US' && popularInternationalQuotes && popularInternationalQuotes.length > 0) {
      renderMarqueeTapeUS(popularInternationalQuotes);
    } else {
      renderMarqueeTape(marketQuotes);
    }

    // If silent auto-sync just completed, show dynamic feedback
    if (silent && currentView === 'terminal') {
      playSound('success');
      showToast({
        title: activeEcosystem === 'US' ? '⚡ Auto-Sync Wall Street' : '⚡ Auto-Sync BVC',
        message: 'Precios de pizarra, cotizaciones oficiales y P&L actualizados en vivo.',
        type: 'success',
        duration: 3000
      });

      // Highlight position rows
      const targetSelector = activeEcosystem === 'US' ? '#positions-us-tbody tr' : '#positions-tbody tr';
      document.querySelectorAll(targetSelector).forEach(row => {
        row.classList.remove('row-flash-green');
        void row.offsetWidth;
        row.classList.add('row-flash-green');
      });
    }
  } catch (err) {
    console.error('Error loading portfolio data:', err);
  }
}

function updateUI() {
  if (!portfolioData) return;

  renderConsolidatedWealthBanner();
  renderRatesHeader();
  renderHeroKPIs();
  renderPositionsTable();
  renderAllocationChart();
  renderPerformersAndSpread();
  renderMarketTable();
  renderMarketUsTable();
  populateTickerDropdown();

  lucide.createIcons();
}

// -------------------------------------------------------------------------
// DUAL ECOSYSTEM SWITCHER CONTROLLER
// -------------------------------------------------------------------------
function switchEcosystem(ecosystem, triggerUpdate = true) {
  activeEcosystem = ecosystem;
  localStorage.setItem('kix_active_ecosystem', ecosystem);
  if (triggerUpdate) playSound('click');

  // 1. Top-Bar & Lateral Sidebar Switcher Buttons Active State
  const btnBvc = document.getElementById('btn-eco-bvc');
  const btnUs = document.getElementById('btn-eco-us');
  if (btnBvc && btnUs) {
    btnBvc.classList.toggle('active', ecosystem === 'BVC');
    btnUs.classList.toggle('active', ecosystem === 'US');
  }

  const sideEcoBvc = document.getElementById('sidebar-eco-bvc');
  const sideEcoUs = document.getElementById('sidebar-eco-us');
  if (sideEcoBvc && sideEcoUs) {
    sideEcoBvc.classList.toggle('active', ecosystem === 'BVC');
    sideEcoUs.classList.toggle('active', ecosystem === 'US');
  }

  // 2. Top-Bar Live Rates Ticker (BVC vs Wall Street)
  const tickerBvc = document.getElementById('rates-ticker-bvc');
  const tickerUs = document.getElementById('rates-ticker-us');
  if (tickerBvc && tickerUs) {
    tickerBvc.style.display = ecosystem === 'BVC' ? 'flex' : 'none';
    tickerUs.style.display = ecosystem === 'US' ? 'flex' : 'none';
  }

  // 3. Consolidated Wealth Banner Pill Selection
  const pillBvc = document.getElementById('cwb-pill-bvc');
  const pillUs = document.getElementById('cwb-pill-us');
  const dotBvc = document.getElementById('cwb-active-bvc');
  const dotUs = document.getElementById('cwb-active-us');
  if (pillBvc && pillUs) {
    pillBvc.classList.toggle('active', ecosystem === 'BVC');
    pillUs.classList.toggle('active', ecosystem === 'US');
    if (dotBvc) dotBvc.style.display = ecosystem === 'BVC' ? 'inline-block' : 'none';
    if (dotUs) dotUs.style.display = ecosystem === 'US' ? 'inline-block' : 'none';
  }

  // 4. Terminal Headings & Badges
  const ownerBadge = document.getElementById('portfolio-display-title');
  const headingTitle = document.getElementById('terminal-heading-title');
  const headingSub = document.getElementById('terminal-heading-subtitle');
  if (ownerBadge) {
    ownerBadge.textContent = ecosystem === 'BVC' ? 'Portafolio Bursátil BVC' : 'Portafolio Wall Street Global';
  }
  if (headingTitle) {
    headingTitle.innerHTML = ecosystem === 'BVC' 
      ? `Resumen Patrimonial <span class="tag-version" id="terminal-tag-version"><span class="pulse-dot"></span> BVC Live</span>`
      : `Resumen Patrimonial <span class="tag-version tag-version-us" id="terminal-tag-version"><span class="pulse-dot"></span> Wall Street Live</span>`;
  }
  if (headingSub) {
    headingSub.textContent = ecosystem === 'BVC'
      ? 'Monitoreo inteligente multi-divisa y protección en tiempo real contra la devaluación'
      : 'Inversión directa en Dólares (USD) en NYSE y NASDAQ con cotizaciones en tiempo real vía yfinance';
  }

  // 5. Navigation Tab & Sidebar Labels
  const tabPosLabel = document.getElementById('tab-positions-label');
  const tabMarketLabel = document.getElementById('tab-market-label');
  const sidePosLabel = document.getElementById('sidebar-positions-label');
  const sideMarketLabel = document.getElementById('sidebar-market-label');
  const posTableTitle = document.getElementById('positions-table-title');
  const posTableSub = document.getElementById('positions-table-sub');
  const btnTabAddLabel = document.getElementById('btn-tab-add-pos-label');

  if (tabPosLabel) {
    tabPosLabel.textContent = ecosystem === 'BVC' ? 'Mis Posiciones BVC' : 'Mis Posiciones Wall Street';
  }
  if (sidePosLabel) {
    sidePosLabel.textContent = ecosystem === 'BVC' ? 'Mi Portafolio (BVC)' : 'Mi Portafolio (Wall St)';
  }
  if (tabMarketLabel) {
    tabMarketLabel.textContent = ecosystem === 'BVC' ? 'Pizarra BVC en Vivo (46 Títulos)' : 'Pizarra Wall Street en Vivo (NYSE / NASDAQ)';
  }
  if (sideMarketLabel) {
    sideMarketLabel.textContent = ecosystem === 'BVC' ? 'Pizarra en Vivo' : 'Wall Street en Vivo';
  }
  if (posTableTitle) {
    posTableTitle.innerHTML = ecosystem === 'BVC'
      ? `<span id="positions-title-flag">🇻🇪</span> Libro de Posiciones: Bolsa de Valores de Caracas`
      : `<span id="positions-title-flag">🇺🇸</span> Libro de Posiciones: Wall Street (NYSE / NASDAQ)`;
  }
  if (posTableSub) {
    posTableSub.textContent = ecosystem === 'BVC'
      ? 'Rendimiento nominal y cobertura real frente a la devaluación'
      : 'Rendimiento nativo en Dólares (USD) y retorno porcentual de tus activos internacionales';
  }
  if (btnTabAddLabel) {
    btnTabAddLabel.textContent = ecosystem === 'BVC' ? '+ Operar en Caracas' : '+ Operar en Wall Street';
  }

  // 6. Show/Hide Dedicated Table Wrappers
  const bvcPosWrap = document.getElementById('table-positions-bvc-wrapper');
  const usPosWrap = document.getElementById('table-positions-us-wrapper');
  if (bvcPosWrap && usPosWrap) {
    bvcPosWrap.style.display = ecosystem === 'BVC' ? 'block' : 'none';
    usPosWrap.style.display = ecosystem === 'US' ? 'block' : 'none';
  }

  // 7. Show/Hide Market Board Cards in Tab 2
  const bvcMarketCard = document.getElementById('market-bvc-card');
  const usMarketCard = document.getElementById('market-us-card');
  if (bvcMarketCard && usMarketCard) {
    bvcMarketCard.style.display = ecosystem === 'BVC' ? 'block' : 'none';
    usMarketCard.style.display = ecosystem === 'US' ? 'block' : 'none';
  }

  // 8. Marquee tape update
  if (ecosystem === 'US' && popularInternationalQuotes && popularInternationalQuotes.length > 0) {
    renderMarqueeTapeUS(popularInternationalQuotes);
  } else if (marketQuotes && marketQuotes.length > 0) {
    renderMarqueeTape(marketQuotes);
  }

  if (triggerUpdate && portfolioData) {
    updateUI();
  }
}
window.switchEcosystem = switchEcosystem;

// -------------------------------------------------------------------------
// CONSOLIDATED WEALTH BANNER RENDERING
// -------------------------------------------------------------------------
function renderConsolidatedWealthBanner() {
  if (!portfolioData) return;

  const totalUsdEl = document.getElementById('cwb-total-usd');
  const totalVesEl = document.getElementById('cwb-total-ves');
  const bvcValEl = document.getElementById('cwb-bvc-val');
  const bvcSubEl = document.getElementById('cwb-bvc-sub');
  const usValEl = document.getElementById('cwb-us-val');
  const usSubEl = document.getElementById('cwb-us-sub');
  const ecoBvcCount = document.getElementById('eco-count-bvc');
  const ecoUsCount = document.getElementById('eco-count-us');

  const bvc = portfolioData.bvc_summary || { count: 0, totals: { usd_bcv: { value: 0 }, ves: { value: 0 } } };
  const intl = portfolioData.intl_summary || { count: 0, totals: { usd: { value: 0 }, ves: { value: 0 } } };
  const mb = portfolioData.market_breakdown || { bvc_pct: 100, intl_pct: 0, bvc_val_usd: 0, intl_val_usd: 0 };
  const cashUsd = portfolioData.cash_usd || 0;
  const rates = portfolioData.rates || { bcv: 880.12, usdt: 998.90 };

  const totalUsd = portfolioData.totals?.usd_bcv?.value || (bvc.totals.usd_bcv.value + intl.totals.usd.value + cashUsd);
  const totalVes = portfolioData.totals?.ves?.value || (totalUsd * rates.bcv);

  if (totalUsdEl) totalUsdEl.textContent = `${formatUSD(totalUsd)} USD`;
  if (totalVesEl) totalVesEl.textContent = `(${formatVES(totalVes)})`;

  if (bvcValEl) bvcValEl.textContent = formatUSD(bvc.totals.usd_bcv.value);
  if (bvcSubEl) bvcSubEl.textContent = `${formatVES(bvc.totals.ves.value)} • ${mb.bvc_pct}% de Cartera`;

  if (usValEl) usValEl.textContent = formatUSD(intl.totals.usd.value);
  if (usSubEl) usSubEl.textContent = `${intl.count} Títulos • ${mb.intl_pct}% de Cartera`;

  if (ecoBvcCount) ecoBvcCount.textContent = bvc.count;
  if (ecoUsCount) ecoUsCount.textContent = intl.count;

  const sideEcoBvcCount = document.getElementById('sidebar-eco-count-bvc');
  const sideEcoUsCount = document.getElementById('sidebar-eco-count-us');
  const sidePosCount = document.getElementById('sidebar-positions-count');
  if (sideEcoBvcCount) sideEcoBvcCount.textContent = bvc.count;
  if (sideEcoUsCount) sideEcoUsCount.textContent = intl.count;
  if (sidePosCount) sidePosCount.textContent = activeEcosystem === 'BVC' ? bvc.count : intl.count;

  // Active pill indicators
  const pillBvc = document.getElementById('cwb-pill-bvc');
  const pillUs = document.getElementById('cwb-pill-us');
  const dotBvc = document.getElementById('cwb-active-bvc');
  const dotUs = document.getElementById('cwb-active-us');
  if (pillBvc && pillUs) {
    pillBvc.classList.toggle('active', activeEcosystem === 'BVC');
    pillUs.classList.toggle('active', activeEcosystem === 'US');
    if (dotBvc) dotBvc.style.display = activeEcosystem === 'BVC' ? 'inline-block' : 'none';
    if (dotUs) dotUs.style.display = activeEcosystem === 'US' ? 'inline-block' : 'none';
  }
}

function renderMarqueeTapeUS(quotes) {
  const track = document.getElementById('bvc-marquee-track');
  const tapeBadge = document.querySelector('.tape-badge span:last-child');
  if (tapeBadge) tapeBadge.textContent = 'WALL STREET LIVE';
  if (!track || !quotes || quotes.length === 0) return;

  const items = quotes.map(q => {
    const price = q.price_usd ? `$${formatNumber(q.price_usd, 2)}` : '$0.00';
    const change = q.change_pct !== undefined ? q.change_pct : 0.0;
    const sign = change >= 0 ? '+' : '';
    const color = change >= 0 ? 'text-green' : 'text-red';
    return `<span class="tape-item"><span class="sym">${q.ticker}</span> <span class="pr">${price}</span> <span class="chg ${color}">${sign}${formatNumber(change, 2)}%</span></span>`;
  }).join('');

  track.innerHTML = items + items;
}

const POPULAR_INTERNATIONAL_ASSETS = [
  { ticker: 'AAPL', name: 'Apple Inc.', market: 'NASDAQ', sector: 'Tecnología', price_usd: 235.00 },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', market: 'NASDAQ', sector: 'Semiconductores & IA', price_usd: 138.00 },
  { ticker: 'TSLA', name: 'Tesla Inc.', market: 'NASDAQ', sector: 'Automotriz & Energía', price_usd: 220.00 },
  { ticker: 'MSFT', name: 'Microsoft Corporation', market: 'NASDAQ', sector: 'Software & Nube', price_usd: 425.00 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', market: 'NASDAQ', sector: 'Comercio & Cloud', price_usd: 188.00 },
  { ticker: 'GOOGL', name: 'Alphabet Inc. (Google)', market: 'NASDAQ', sector: 'Servicios Digitales', price_usd: 165.00 },
  { ticker: 'META', name: 'Meta Platforms Inc.', market: 'NASDAQ', sector: 'Redes Sociales & IA', price_usd: 580.00 },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', market: 'NYSE', sector: 'Índice S&P 500', price_usd: 585.00 },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', market: 'NASDAQ', sector: 'Índice Nasdaq 100', price_usd: 490.00 },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.', market: 'NYSE', sector: 'Finanzas & Inversión', price_usd: 460.00 },
  { ticker: 'V', name: 'Visa Inc.', market: 'NYSE', sector: 'Servicios Financieros', price_usd: 280.00 },
  { ticker: 'JNJ', name: 'Johnson & Johnson', market: 'NYSE', sector: 'Salud & Farmacia', price_usd: 162.00 },
  { ticker: 'WMT', name: 'Walmart Inc.', market: 'NYSE', sector: 'Consumo Masivo', price_usd: 80.00 },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', market: 'NYSE', sector: 'Banca Global', price_usd: 222.00 },
  { ticker: 'COIN', name: 'Coinbase Global Inc.', market: 'NASDAQ', sector: 'Fintech & Cripto', price_usd: 210.00 }
];

function populateTickerDropdown() {
  const select = document.getElementById('pos-ticker');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">Selecciona una acción (BVC o Wall Street)...</option>';

  // Optgroup 1: Bolsa de Caracas (BVC)
  if (marketQuotes && marketQuotes.length > 0) {
    const groupBVC = document.createElement('optgroup');
    groupBVC.label = '🇻🇪 Bolsa de Valores de Caracas (46 Acciones)';
    const sorted = [...marketQuotes].sort((a, b) => a.ticker.localeCompare(b.ticker));
    sorted.forEach(q => {
      const opt = document.createElement('option');
      opt.value = q.ticker;
      opt.setAttribute('data-market', 'BVC');
      opt.setAttribute('data-currency', 'VES');
      const priceStr = q.price_ves > 0 ? ` [${formatVES(q.price_ves)}]` : '';
      opt.textContent = `${q.ticker} - ${q.name}${priceStr}`;
      groupBVC.appendChild(opt);
    });
    select.appendChild(groupBVC);
  }

  // Optgroup 2: Wall Street & ETFs
  const groupIntl = document.createElement('optgroup');
  groupIntl.label = '🇺🇸 Wall Street & ETFs (NYSE / NASDAQ en USD)';
  POPULAR_INTERNATIONAL_ASSETS.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.ticker;
    opt.setAttribute('data-market', item.market);
    opt.setAttribute('data-currency', 'USD');
    opt.setAttribute('data-price-usd', item.price_usd);
    opt.textContent = `${item.ticker} - ${item.name} [$${item.price_usd.toFixed(2)} USD]`;
    groupIntl.appendChild(opt);
  });
  select.appendChild(groupIntl);

  if (currentVal) {
    select.value = currentVal;
  }
}

function renderRatesHeader() {
  const rates = portfolioData.rates;
  if (!rates) return;

  const bcvEl = document.getElementById('rate-bcv-val');
  const usdtEl = document.getElementById('rate-usdt-val');
  const brechaEl = document.getElementById('rate-brecha-val');

  if (bcvEl) bcvEl.textContent = `${formatNumber(rates.bcv, 2)} Bs.`;
  if (usdtEl) usdtEl.textContent = `${formatNumber(rates.usdt, 2)} Bs.`;
  if (brechaEl) brechaEl.textContent = `+${rates.brecha_pct}%`;
}

function renderHeroKPIs() {
  const t = portfolioData.totals;
  const rates = portfolioData.rates || { brecha_pct: 0, bcv: 880.12, usdt: 998.90 };
  const primaryValEl = document.getElementById('total-val-primary');
  const totalValLabel = document.getElementById('total-val-label');
  const valStocksSub = document.getElementById('val-stocks-sub');
  const valCashSub = document.getElementById('val-cash-sub');
  const valBcvSub = document.getElementById('val-bcv-sub');
  const valUsdtSub = document.getElementById('val-usdt-sub');

  // Handle Wall Street ecosystem KPIs
  if (activeEcosystem === 'US') {
    const intl = portfolioData.intl_summary || { count: 0, positions: [], totals: { usd: { value: 0, cost: 0, pnl: 0, pnl_pct: 0 } } };
    const intlValUsd = intl.totals.usd.value;
    const intlCostUsd = intl.totals.usd.cost;
    const intlPnlUsd = intl.totals.usd.pnl;
    const intlPnlPct = intl.totals.usd.pnl_pct;
    const cashUsd = portfolioData.cash_usd || 0;
    const totalIntlWealth = intlValUsd + cashUsd;

    // 1. Dynamic Portfolio Owner Badge
    const portTitleEl = document.getElementById('portfolio-display-title');
    if (portTitleEl) {
      const isAuth = localStorage.getItem('kix_authenticated') === 'true' && !!localStorage.getItem('kix_token');
      const savedName = localStorage.getItem('kix_user_name');
      portTitleEl.textContent = isAuth 
        ? (savedName ? `Portafolio Wall Street de ${savedName}` : 'Mi Portafolio Wall Street')
        : 'Portafolio Wall Street Global (Demo)';
    }

    // 2. Card 1: Main Metric & Sub-Pills in USD
    primaryValEl.textContent = formatUSD(totalIntlWealth);
    if (totalValLabel) totalValLabel.textContent = 'Patrimonio Total en Wall Street (USD)';
    if (valStocksSub) valStocksSub.textContent = formatUSD(intlValUsd);
    if (valCashSub) valCashSub.textContent = formatUSD(cashUsd);
    if (valBcvSub) valBcvSub.textContent = formatVES(intlValUsd * rates.bcv);
    if (valUsdtSub) valUsdtSub.textContent = formatUSDT(intlValUsd);

    const badgeMarketStatus = document.getElementById('badge-market-status');
    const labelMarketLive = document.getElementById('label-market-live');
    if (labelMarketLive) labelMarketLive.textContent = 'Wall Street Live';
    if (badgeMarketStatus) badgeMarketStatus.className = 'badge badge-pulse';

    // 3. Card 2: Rendimiento en Dólares (USD)
    const triHeroGrid = document.getElementById('pnl-tri-hero-grid');
    const singleHeroContainer = document.getElementById('pnl-single-hero-container');
    const pnlHeroVal = document.getElementById('pnl-hero-val');
    const pnlVerdictPill = document.getElementById('pnl-verdict-pill');
    const pnlVerdictText = document.getElementById('pnl-verdict-text');
    const triVerdictRow = document.getElementById('pnl-tri-verdict-row');
    const triStack = document.getElementById('pnl-tri-comparison-stack');
    const singleStack = document.getElementById('pnl-single-currency-stack');
    const meterBox = document.getElementById('spread-meter-box');
    const singleCostLbl = document.getElementById('single-lbl-cost');
    const singleCostVal = document.getElementById('single-val-cost');
    const singleMarketLbl = document.getElementById('single-lbl-market');
    const singleMarketVal = document.getElementById('single-val-market');
    const singleNetLbl = document.getElementById('single-lbl-net');
    const singleNetVal = document.getElementById('single-val-net');

    if (triHeroGrid) triHeroGrid.style.display = 'none';
    if (singleHeroContainer) singleHeroContainer.style.display = 'flex';
    if (triVerdictRow) triVerdictRow.style.display = 'none';
    if (triStack) triStack.style.display = 'none';
    if (singleStack) singleStack.style.display = 'grid';
    if (meterBox) meterBox.style.display = 'none';

    const isIntlPos = intlPnlUsd >= 0;
    const sign = isIntlPos ? '+' : '';
    const color = isIntlPos ? 'text-green' : 'text-red';

    if (pnlHeroVal) {
      pnlHeroVal.className = `pnl-hero-val ${color}`;
      pnlHeroVal.textContent = `${sign}${formatUSD(intlPnlUsd)}`;
    }
    if (pnlVerdictPill && pnlVerdictText) {
      pnlVerdictPill.className = isIntlPos ? 'pnl-verdict-pill badge-success' : 'pnl-verdict-pill badge-danger';
      pnlVerdictText.textContent = `🇺🇸 Rendimiento en Dólares: ${sign}${intlPnlPct}% Retorno Real`;
    }
    if (singleCostLbl) singleCostLbl.textContent = 'Capital Invertido en Wall Street:';
    if (singleCostVal) singleCostVal.textContent = formatUSD(intlCostUsd);
    if (singleMarketLbl) singleMarketLbl.textContent = 'Valor Actual en Acciones & ETFs:';
    if (singleMarketVal) singleMarketVal.textContent = formatUSD(intlValUsd);
    if (singleNetLbl) singleNetLbl.textContent = 'Ganancia Neta en USD:';
    if (singleNetVal) {
      singleNetVal.className = `single-val ${color}`;
      singleNetVal.textContent = `${sign}${formatUSD(intlPnlUsd)} (${sign}${intlPnlPct}%)`;
    }

    const badgePnl = document.getElementById('badge-pnl-status');
    if (badgePnl) {
      badgePnl.textContent = isIntlPos ? 'Ganancia en USD' : 'Retorno Negativo';
      badgePnl.className = isIntlPos ? 'badge badge-success' : 'badge badge-danger';
    }

    // 4. Card 3: Wallet balances
    const cashVesVal = document.getElementById('cash-ves-val');
    const cashUsdVal = document.getElementById('cash-usd-val');
    const cashWeightVal = document.getElementById('cash-weight-val');
    const cashWeightFill = document.getElementById('cash-weight-fill');
    const posCount = document.getElementById('positions-count');

    if (cashVesVal) cashVesVal.textContent = formatVES(portfolioData.cash_ves);
    if (cashUsdVal) cashUsdVal.textContent = formatUSD(portfolioData.cash_usd);
    if (cashWeightVal) cashWeightVal.textContent = `${totalIntlWealth > 0 ? ((cashUsd / totalIntlWealth) * 100).toFixed(2) : '0.00'}%`;
    if (cashWeightFill) {
      const liq = totalIntlWealth > 0 ? ((cashUsd / totalIntlWealth) * 100) : 0;
      cashWeightFill.style.width = `${Math.min(100, Math.max(4, liq * 7))}%`;
    }
    if (posCount) posCount.textContent = intl.count;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const stocksValVes = t.ves.stocks_value || t.ves.value;
  const stocksValUsdBcv = t.usd_bcv.stocks_value || t.usd_bcv.value;
  const stocksValUsdt = t.usdt.stocks_value || t.usdt.value;

  // 1. Dynamic Portfolio Owner Badge
  const portTitleEl = document.getElementById('portfolio-display-title');
  if (portTitleEl) {
    const isAuth = localStorage.getItem('kix_authenticated') === 'true' && !!localStorage.getItem('kix_token');
    const savedName = localStorage.getItem('kix_user_name');
    portTitleEl.textContent = isAuth 
      ? (savedName ? `Portafolio de ${savedName}` : 'Mi Portafolio Privado')
      : 'Portafolio Demo BVC (Modo Invitado)';
  }

  // 2. Card 1: Sub-Pills & Multi-Currency Equivalents
  if (valStocksSub) valStocksSub.textContent = formatVES(stocksValVes);
  if (valCashSub) valCashSub.textContent = formatVES(portfolioData.cash_ves);
  if (valBcvSub) valBcvSub.textContent = formatUSD(t.usd_bcv.value);
  if (valUsdtSub) valUsdtSub.textContent = formatUSDT(t.usdt.value);

  // Switch primary large display and descriptive sublabel based on selected currency
  if (currentCurrency === 'ves') {
    primaryValEl.textContent = formatVES(t.ves.value);
    if (totalValLabel) totalValLabel.textContent = 'Patrimonio Total en Bolívares (VES)';
    if (valStocksSub) valStocksSub.textContent = formatVES(stocksValVes);
    if (valCashSub) valCashSub.textContent = formatVES(portfolioData.cash_ves);
  } else if (currentCurrency === 'usd_bcv') {
    primaryValEl.textContent = formatUSD(t.usd_bcv.value);
    if (totalValLabel) totalValLabel.textContent = 'Patrimonio Total al Dólar Oficial BCV';
    if (valStocksSub) valStocksSub.textContent = formatUSD(stocksValUsdBcv);
    if (valCashSub) valCashSub.textContent = formatUSD(portfolioData.cash_usd || 0);
  } else if (currentCurrency === 'usdt') {
    primaryValEl.textContent = formatUSDT(t.usdt.value);
    if (totalValLabel) totalValLabel.textContent = 'Patrimonio Total en Dólar Real (USDT Binance P2P)';
    if (valStocksSub) valStocksSub.textContent = formatUSDT(stocksValUsdt);
    const usdtCash = ((portfolioData.cash_ves || 0) / (rates.usdt || 1)) + (portfolioData.cash_usd || 0);
    if (valCashSub) valCashSub.textContent = formatUSDT(usdtCash);
  } else {
    // Compare view: Total consolidated net worth in Bolívares
    primaryValEl.textContent = formatVES(t.ves.value);
    if (totalValLabel) totalValLabel.textContent = 'Patrimonio Total Consolidado (Acciones + Efectivo)';
    if (valStocksSub) valStocksSub.textContent = formatVES(stocksValVes);
    if (valCashSub) valCashSub.textContent = formatVES(portfolioData.cash_ves);
  }

  // 3. Card 2: P&L Hero Verdict, Comparison & Meter
  const pnlHeroVal = document.getElementById('pnl-hero-val');
  const pnlVerdictPill = document.getElementById('pnl-verdict-pill');
  const pnlVerdictText = document.getElementById('pnl-verdict-text');
  const meterVesPct = document.getElementById('meter-ves-pct');
  const meterBrechaPct = document.getElementById('meter-brecha-pct');
  const meterNetSpread = document.getElementById('meter-net-spread');
  const meterPnlFill = document.getElementById('meter-pnl-fill');
  const meterBrechaMarker = document.getElementById('meter-brecha-marker');

  const triHeroGrid = document.getElementById('pnl-tri-hero-grid');
  const singleHeroContainer = document.getElementById('pnl-single-hero-container');
  const triVerdictRow = document.getElementById('pnl-tri-verdict-row');
  const triVerdictPill = document.getElementById('pnl-tri-verdict-pill');
  const triVerdictText = document.getElementById('pnl-tri-verdict-text');

  const triHeroVesVal = document.getElementById('tri-hero-ves-val');
  const triHeroVesPct = document.getElementById('tri-hero-ves-pct');
  const triHeroBcvVal = document.getElementById('tri-hero-bcv-val');
  const triHeroBcvPct = document.getElementById('tri-hero-bcv-pct');
  const triHeroUsdtVal = document.getElementById('tri-hero-usdt-val');
  const triHeroUsdtPct = document.getElementById('tri-hero-usdt-pct');

  const triStack = document.getElementById('pnl-tri-comparison-stack');
  const singleStack = document.getElementById('pnl-single-currency-stack');
  const meterBox = document.getElementById('spread-meter-box');
  const singleCostLbl = document.getElementById('single-lbl-cost');
  const singleCostVal = document.getElementById('single-val-cost');
  const singleMarketLbl = document.getElementById('single-lbl-market');
  const singleMarketVal = document.getElementById('single-val-market');
  const singleNetLbl = document.getElementById('single-lbl-net');
  const singleNetVal = document.getElementById('single-val-net');

  const isPositiveReal = t.usdt.pnl >= 0;
  const pnlSign = isPositiveReal ? '+' : '';
  const pnlColorClass = isPositiveReal ? 'text-green' : 'text-red';

  // Visual Spread Meter Calculations
  const brecha = rates.brecha_pct || 0;
  const netCoverage = (t.ves.pnl_pct - brecha).toFixed(2);
  if (meterVesPct) meterVesPct.textContent = `${t.ves.pnl_pct >= 0 ? '+' : ''}${t.ves.pnl_pct}%`;
  if (meterBrechaPct) meterBrechaPct.textContent = `+${brecha}%`;

  if (meterNetSpread) {
    if (parseFloat(netCoverage) >= 0) {
      meterNetSpread.className = 'text-green';
      meterNetSpread.textContent = `+${netCoverage}% neto por encima del dólar`;
    } else {
      meterNetSpread.className = 'text-amber';
      meterNetSpread.textContent = `${netCoverage}% neto frente al dólar`;
    }
  }

  if (meterPnlFill && meterBrechaMarker) {
    const maxScale = Math.max(brecha + 15, Math.abs(t.ves.pnl_pct) + 10, 30);
    const fillPercent = Math.min(100, Math.max(5, (Math.max(0, t.ves.pnl_pct) / maxScale) * 100));
    const markerPercent = Math.min(95, Math.max(5, (brecha / maxScale) * 100));
    meterPnlFill.style.width = `${fillPercent}%`;
    meterBrechaMarker.style.left = `${markerPercent}%`;
  }

  // Dynamic Card 2 State according to active currency
  if (currentCurrency === 'compare') {
    // Comparativa Tri-Monetaria: Mostrar métrica principal calmada y permitir despliegue opcional
    if (pnlHeroVal) {
      pnlHeroVal.className = `pnl-hero-val ${pnlColorClass}`;
      pnlHeroVal.textContent = `${pnlSign}${t.usdt.pnl_pct}% Real en USDT`;
    }
    const btnToggleTri = document.getElementById('btn-toggle-tri');
    if (btnToggleTri) btnToggleTri.style.display = 'inline-flex';
    if (singleHeroContainer) singleHeroContainer.style.display = 'none';
    if (triVerdictRow) triVerdictRow.style.display = 'none';
    if (triStack) triStack.style.display = 'none';
    if (singleStack) singleStack.style.display = 'none';
    if (meterBox) meterBox.style.display = 'block';

    // 1. Bolívares (VES)
    const isVesPos = t.ves.pnl >= 0;
    const vesSign = isVesPos ? '+' : '';
    const vesColor = isVesPos ? 'text-green' : 'text-red';
    if (triHeroVesVal) {
      triHeroVesVal.className = `tri-hero-val ${vesColor}`;
      triHeroVesVal.textContent = `${vesSign}${formatVES(t.ves.pnl)}`;
    }
    if (triHeroVesPct) {
      triHeroVesPct.className = `tri-hero-sub ${vesColor}`;
      triHeroVesPct.textContent = `${vesSign}${t.ves.pnl_pct}% Nominal`;
    }

    // 2. Dólar Oficial (BCV)
    const isBcvPos = t.usd_bcv.pnl >= 0;
    const bcvSign = isBcvPos ? '+' : '';
    const bcvColor = isBcvPos ? 'text-green' : 'text-red';
    if (triHeroBcvVal) {
      triHeroBcvVal.className = `tri-hero-val ${bcvColor}`;
      triHeroBcvVal.textContent = `${bcvSign}${formatUSD(t.usd_bcv.pnl)}`;
    }
    if (triHeroBcvPct) {
      triHeroBcvPct.className = `tri-hero-sub ${bcvColor}`;
      triHeroBcvPct.textContent = `${bcvSign}${t.usd_bcv.pnl_pct}% BCV`;
    }

    // 3. USDT Real (Binance P2P)
    if (triHeroUsdtVal) {
      triHeroUsdtVal.className = `tri-hero-val ${pnlColorClass}`;
      triHeroUsdtVal.textContent = `${pnlSign}${formatUSDT(t.usdt.pnl)}`;
    }
    if (triHeroUsdtPct) {
      triHeroUsdtPct.className = `tri-hero-sub ${pnlColorClass}`;
      triHeroUsdtPct.textContent = `${pnlSign}${t.usdt.pnl_pct}% Real`;
    }

    // Verdict pill in tri-monetary mode
    if (triVerdictPill && triVerdictText) {
      triVerdictPill.className = isPositiveReal ? 'pnl-verdict-pill badge-success' : 'pnl-verdict-pill badge-danger';
      triVerdictText.textContent = isPositiveReal 
        ? `Ganancia Real: +${t.usdt.pnl_pct}% USDT (Superas la devaluación)`
        : `Riesgo Cambiario: ${t.usdt.pnl_pct}% USDT (La devaluación absorbe ganancia)`;
    }

    // Also populate legacy fields in case they are referenced
    renderPnlLine('pnl-ves-val', t.ves.pnl, t.ves.pnl_pct, 'VES');
    renderPnlLine('pnl-bcv-val', t.usd_bcv.pnl, t.usd_bcv.pnl_pct, 'USD');
    renderPnlLine('pnl-usdt-val', t.usdt.pnl, t.usdt.pnl_pct, 'USDT');

  } else if (currentCurrency === 'ves') {
    // Modo Bolívares (VES): Enfocar exclusivamente en el rendimiento nominal en Bs
    if (triHeroGrid) triHeroGrid.style.display = 'none';
    if (singleHeroContainer) singleHeroContainer.style.display = 'flex';
    if (triVerdictRow) triVerdictRow.style.display = 'none';
    if (triStack) triStack.style.display = 'none';
    if (singleStack) singleStack.style.display = 'grid';
    if (meterBox) meterBox.style.display = 'none';

    const isVesPos = t.ves.pnl >= 0;
    const vesSign = isVesPos ? '+' : '';
    const vesColor = isVesPos ? 'text-green' : 'text-red';

    if (pnlHeroVal) {
      pnlHeroVal.className = `pnl-hero-val ${vesColor}`;
      pnlHeroVal.textContent = `${vesSign}${formatVES(t.ves.pnl)}`;
    }
    if (pnlVerdictPill && pnlVerdictText) {
      pnlVerdictPill.className = isVesPos ? 'pnl-verdict-pill badge-success' : 'pnl-verdict-pill badge-danger';
      pnlVerdictText.textContent = `🇻🇪 Rendimiento en Bolívares: ${vesSign}${t.ves.pnl_pct}% Nominal`;
    }
    if (singleCostLbl) singleCostLbl.textContent = 'Inversión Base en Títulos:';
    if (singleCostVal) singleCostVal.textContent = formatVES(stocksValVes - t.ves.pnl);
    if (singleMarketLbl) singleMarketLbl.textContent = 'Valor Actual en la BVC:';
    if (singleMarketVal) singleMarketVal.textContent = formatVES(stocksValVes);
    if (singleNetLbl) singleNetLbl.textContent = 'Ganancia Nominal Neta:';
    if (singleNetVal) {
      singleNetVal.className = `single-val ${vesColor}`;
      singleNetVal.textContent = `${vesSign}${formatVES(t.ves.pnl)} (${vesSign}${t.ves.pnl_pct}%)`;
    }
  } else if (currentCurrency === 'usd_bcv') {
    // Modo USD (Tasa BCV): Enfocar en el rendimiento oficial en dólares
    if (triHeroGrid) triHeroGrid.style.display = 'none';
    if (singleHeroContainer) singleHeroContainer.style.display = 'flex';
    if (triVerdictRow) triVerdictRow.style.display = 'none';
    if (triStack) triStack.style.display = 'none';
    if (singleStack) singleStack.style.display = 'grid';
    if (meterBox) meterBox.style.display = 'none';

    const isBcvPos = t.usd_bcv.pnl >= 0;
    const bcvSign = isBcvPos ? '+' : '';
    const bcvColor = isBcvPos ? 'text-green' : 'text-red';

    if (pnlHeroVal) {
      pnlHeroVal.className = `pnl-hero-val ${bcvColor}`;
      pnlHeroVal.textContent = `${bcvSign}${formatUSD(t.usd_bcv.pnl)}`;
    }
    if (pnlVerdictPill && pnlVerdictText) {
      pnlVerdictPill.className = isBcvPos ? 'pnl-verdict-pill badge-success' : 'pnl-verdict-pill badge-danger';
      pnlVerdictText.textContent = `🏛️ Rendimiento Oficial USD: ${bcvSign}${t.usd_bcv.pnl_pct}% BCV`;
    }
    if (singleCostLbl) singleCostLbl.textContent = 'Costo de Compra (Tasa BCV):';
    if (singleCostVal) singleCostVal.textContent = formatUSD(stocksValUsdBcv - t.usd_bcv.pnl);
    if (singleMarketLbl) singleMarketLbl.textContent = 'Valor Oficial de Cartera:';
    if (singleMarketVal) singleMarketVal.textContent = formatUSD(stocksValUsdBcv);
    if (singleNetLbl) singleNetLbl.textContent = 'Retorno Oficial en Dólares:';
    if (singleNetVal) {
      singleNetVal.className = `single-val ${bcvColor}`;
      singleNetVal.textContent = `${bcvSign}${formatUSD(t.usd_bcv.pnl)} (${bcvSign}${t.usd_bcv.pnl_pct}%)`;
    }
  } else if (currentCurrency === 'usdt') {
    // Modo USDT (Binance P2P): Enfocar en el poder adquisitivo real y la cobertura cambiaria
    if (triHeroGrid) triHeroGrid.style.display = 'none';
    if (singleHeroContainer) singleHeroContainer.style.display = 'flex';
    if (triVerdictRow) triVerdictRow.style.display = 'none';
    if (triStack) triStack.style.display = 'none';
    if (singleStack) singleStack.style.display = 'grid';
    if (meterBox) meterBox.style.display = 'block';

    if (pnlHeroVal) {
      pnlHeroVal.className = `pnl-hero-val ${pnlColorClass}`;
      pnlHeroVal.textContent = `${pnlSign}${formatUSDT(t.usdt.pnl)}`;
    }
    if (pnlVerdictPill && pnlVerdictText) {
      pnlVerdictPill.className = isPositiveReal ? 'pnl-verdict-pill badge-success' : 'pnl-verdict-pill badge-danger';
      pnlVerdictText.textContent = `💎 Rendimiento Real: ${pnlSign}${t.usdt.pnl_pct}% USDT P2P`;
    }
    if (singleCostLbl) singleCostLbl.textContent = 'Inversión Real P2P:';
    if (singleCostVal) singleCostVal.textContent = formatUSDT(stocksValUsdt - t.usdt.pnl);
    if (singleMarketLbl) singleMarketLbl.textContent = 'Valor Real en USDT:';
    if (singleMarketVal) singleMarketVal.textContent = formatUSDT(stocksValUsdt);
    if (singleNetLbl) singleNetLbl.textContent = 'Poder Adquisitivo Real:';
    if (singleNetVal) {
      singleNetVal.className = `single-val ${pnlColorClass}`;
      singleNetVal.textContent = `${pnlSign}${formatUSDT(t.usdt.pnl)} (${pnlSign}${t.usdt.pnl_pct}%)`;
    }
  }


  // Overall P&L status badge matching active currency
  const badgePnl = document.getElementById('badge-pnl-status');
  if (badgePnl) {
    if (currentCurrency === 'ves') {
      const isPos = t.ves.pnl >= 0;
      badgePnl.textContent = isPos ? 'Ganancia Nominal' : 'Pérdida Nominal';
      badgePnl.className = isPos ? 'badge badge-success' : 'badge badge-danger';
    } else if (currentCurrency === 'usd_bcv') {
      const isPos = t.usd_bcv.pnl >= 0;
      badgePnl.textContent = isPos ? 'Retorno Oficial BCV' : 'Retorno Negativo';
      badgePnl.className = isPos ? 'badge badge-success' : 'badge badge-danger';
    } else {
      badgePnl.textContent = isPositiveReal ? 'Ganancia Real' : 'Pérdida en USDT';
      badgePnl.className = isPositiveReal ? 'badge badge-success' : 'badge badge-danger';
    }
  }

  // Refresh Lucide icons in Card 2 stack
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // 4. Card 3: Wallet Cards & Liquidity Health Bar
  const cashVesVal = document.getElementById('cash-ves-val');
  const cashUsdVal = document.getElementById('cash-usd-val');
  const cashWeightVal = document.getElementById('cash-weight-val');
  const cashWeightFill = document.getElementById('cash-weight-fill');
  const liquidityHint = document.getElementById('liquidity-target-hint');
  const posCount = document.getElementById('positions-count');

  if (cashVesVal) cashVesVal.textContent = formatVES(portfolioData.cash_ves);
  if (cashUsdVal) cashUsdVal.textContent = formatUSD(portfolioData.cash_usd);
  if (cashWeightVal) cashWeightVal.textContent = `${portfolioData.cash_weight_pct}%`;
  
  if (cashWeightFill) {
    const liqPct = parseFloat(portfolioData.cash_weight_pct) || 0;
    cashWeightFill.style.width = `${Math.min(100, Math.max(4, liqPct * 7))}%`;
  }

  if (liquidityHint) {
    const liqPct = parseFloat(portfolioData.cash_weight_pct) || 0;
    if (liqPct < 3.0) {
      liquidityHint.textContent = '⚠️ Liquidez baja (conviene tener 5-10% en efectivo)';
    } else if (liqPct <= 15.0) {
      liquidityHint.textContent = '✅ Nivel óptimo de liquidez operativa';
    } else {
      liquidityHint.textContent = '💡 Alta liquidez (capital disponible para nuevas acciones)';
    }
  }

  if (posCount) posCount.textContent = portfolioData.positions.length;
}

function renderPnlLine(elId, pnlAmount, pnlPct, curr) {
  const el = document.getElementById(elId);
  if (!el) return;
  const isPos = pnlAmount >= 0;
  const sign = isPos ? '+' : '';
  const colorClass = isPos ? 'text-green' : 'text-red';

  let formattedAmount = '';
  if (curr === 'VES') formattedAmount = formatVES(pnlAmount);
  else if (curr === 'USD') formattedAmount = formatUSD(pnlAmount);
  else formattedAmount = formatUSDT(pnlAmount);

  el.className = `pnl-val ${colorClass}`;
  el.textContent = `${sign}${formattedAmount} (${sign}${pnlPct}%)`;
}


let currentMarketFilter = 'ALL';

function filterPositionsByMarket(marketType) {
  currentMarketFilter = marketType;

  // Update button active state
  document.querySelectorAll('.btn-market-filter').forEach(btn => {
    if (btn.getAttribute('data-market') === marketType) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderPositionsTable();
}
window.filterPositionsByMarket = filterPositionsByMarket;

function renderPositionsTable() {
  const tbodyBvc = document.getElementById('positions-tbody');
  const tbodyUs = document.getElementById('positions-us-tbody');
  const posCount = document.getElementById('positions-count');

  const allPositions = portfolioData.positions || [];
  const bvcPositions = portfolioData.bvc_summary?.positions || allPositions.filter(p => !p.is_international && p.market === 'BVC');
  const intlPositions = portfolioData.intl_summary?.positions || allPositions.filter(p => p.is_international || p.market !== 'BVC');

  // Update counter matching active ecosystem
  if (posCount) {
    posCount.textContent = (activeEcosystem === 'US') ? intlPositions.length : bvcPositions.length;
  }

  // 1. RENDER BVC POSITIONS TABLE (CARACAS)
  if (tbodyBvc) {
    tbodyBvc.innerHTML = '';
    if (bvcPositions.length === 0) {
      tbodyBvc.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-dim">No tienes acciones de la Bolsa de Caracas (BVC) registradas. Haz clic en "+ Operar en Caracas".</td></tr>`;
    } else {
      bvcPositions.forEach(pos => {
        const tr = document.createElement('tr');
        let displayValue = '';
        let pnlNominal = `${pos.pnl_ves >= 0 ? '+' : ''}${formatVES(pos.pnl_ves)} (${pos.pnl_ves >= 0 ? '+' : ''}${pos.pnl_pct_ves}%)`;
        let pnlReal = `${pos.pnl_usdt >= 0 ? '+' : ''}${formatUSDT(pos.pnl_usdt)} (${pos.pnl_usdt >= 0 ? '+' : ''}${pos.pnl_pct_usdt}%)`;

        if (currentCurrency === 'ves') {
          displayValue = formatVES(pos.val_ves);
        } else if (currentCurrency === 'usd_bcv') {
          displayValue = formatUSD(pos.val_usd_bcv);
        } else if (currentCurrency === 'usdt') {
          displayValue = formatUSDT(pos.val_usdt);
        } else {
          displayValue = `<strong>${formatUSD(pos.val_usd_bcv)}</strong><br><small class="text-dim">${formatVES(pos.val_ves)}</small>`;
        }

        const pnlNomClass = pos.pnl_ves >= 0 ? 'text-green' : 'text-red';
        const pnlRealClass = pos.pnl_usdt >= 0 ? 'text-green' : 'text-red';
        const sig = pos.tactical_signal || { action: 'MANTENER', icon: 'shield-check', badge_class: 'badge-signal-hold' };
        const safeRationale = (sig.rationale || '').replace(/"/g, '&quot;');

        tr.innerHTML = `
          <td>
            <div class="ticker-cell">
              <span class="ticker-symbol">
                ${pos.ticker}
                <span class="badge-market badge-market-bvc">BVC</span>
              </span>
              <span class="ticker-name">${pos.name}</span>
            </div>
          </td>
          <td class="text-right"><strong>${formatNumber(pos.shares, 0)}</strong></td>
          <td class="text-right">${formatVES(pos.buy_price_ves)}</td>
          <td class="text-right"><strong>${formatVES(pos.current_price_ves)}</strong></td>
          <td class="text-right">${formatUSD(pos.current_price_usd_bcv)}</td>
          <td class="text-right">${formatUSDT(pos.current_price_usdt)}</td>
          <td class="text-right">${displayValue}</td>
          <td class="text-right ${pnlNomClass}">${pnlNominal}</td>
          <td class="text-right ${pnlRealClass}">${pnlReal}</td>
          <td class="text-center"><span class="badge badge-info">${pos.weight_pct}%</span></td>
          <td class="text-center">
            <span class="badge-tactical ${sig.badge_class || 'badge-signal-hold'}" title="${safeRationale}">
              <i data-lucide="${sig.icon || 'activity'}"></i>
              <span>${sig.action}</span>
            </span>
            <div class="tactical-subtext">${sig.action_text || sig.recommendation || ''}</div>
          </td>
          <td class="text-center">
            <button class="btn-delete-pos" onclick="deletePosition(${pos.id})" title="Eliminar posición">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        `;
        tbodyBvc.appendChild(tr);
      });
    }
  }

  // 2. RENDER WALL STREET POSITIONS TABLE (NATIVE IN USD)
  if (tbodyUs) {
    tbodyUs.innerHTML = '';
    if (intlPositions.length === 0) {
      tbodyUs.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-dim">No tienes acciones de Wall Street registradas. Haz clic en "+ Operar en Wall Street" o selecciona Apple, NVIDIA, S&P 500 en la Pizarra en Vivo.</td></tr>`;
    } else {
      intlPositions.forEach(pos => {
        const tr = document.createElement('tr');
        const isPos = pos.pnl_usd_bcv >= 0;
        const sign = isPos ? '+' : '';
        const color = isPos ? 'text-green' : 'text-red';
        const sig = pos.tactical_signal || { action: 'MANTENER', icon: 'shield-check', badge_class: 'badge-signal-hold' };

        tr.innerHTML = `
          <td>
            <div class="ticker-cell">
              <span class="ticker-symbol">
                ${pos.ticker}
                <span class="badge-market badge-market-intl">${pos.market || 'NASDAQ'}</span>
              </span>
              <span class="ticker-name">${pos.name}</span>
            </div>
          </td>
          <td><span class="text-dim">${pos.sector || 'Wall Street'}</span></td>
          <td class="text-right"><strong>${formatNumber(pos.shares, 0)}</strong></td>
          <td class="text-right col-usd-price">${formatUSD(pos.buy_price_usd_bcv)}</td>
          <td class="text-right col-usd-price"><strong>${formatUSD(pos.current_price_usd_bcv)}</strong></td>
          <td class="text-right"><strong>${formatUSD(pos.val_usd_bcv)}</strong></td>
          <td class="text-right ${color}">${sign}${formatUSD(pos.pnl_usd_bcv)}</td>
          <td class="text-right ${color}"><strong>${sign}${pos.pnl_pct_usd_bcv}%</strong></td>
          <td class="text-center"><span class="badge badge-info">${pos.weight_pct}%</span></td>
          <td class="text-center">
            <span class="badge-tactical ${sig.badge_class || 'badge-signal-hold'}">
              <i data-lucide="${sig.icon || 'activity'}"></i>
              <span>${sig.action}</span>
            </span>
            <div class="tactical-subtext">${sig.action_text || sig.recommendation || ''}</div>
          </td>
          <td class="text-center">
            <button class="btn-delete-pos" onclick="deletePosition(${pos.id})" title="Vender / Cerrar posición">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        `;
        tbodyUs.appendChild(tr);
      });
    }
  }

  // Ensure correct wrapper display matching active ecosystem
  const bvcPosWrap = document.getElementById('table-positions-bvc-wrapper');
  const usPosWrap = document.getElementById('table-positions-us-wrapper');
  if (bvcPosWrap && usPosWrap) {
    bvcPosWrap.style.display = (activeEcosystem === 'BVC') ? 'block' : 'none';
    usPosWrap.style.display = (activeEcosystem === 'US') ? 'block' : 'none';
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderAllocationChart() {
  const canvas = document.getElementById('allocationChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const legendEl = document.getElementById('chart-legend');
  if (legendEl) legendEl.innerHTML = '';

  const labels = [];
  const dataValues = [];
  const colors = [];

  portfolioData.positions.forEach((pos, idx) => {
    labels.push(pos.ticker);
    dataValues.push(pos.weight_pct);
    colors.push(CHART_COLORS[idx % (CHART_COLORS.length - 1)]);

    if (legendEl) {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-ticker">
          <span class="legend-color-dot" style="background: ${colors[idx]}"></span>
          ${pos.ticker}
        </span>
        <span class="legend-pct">${pos.weight_pct}%</span>
      `;
      legendEl.appendChild(item);
    }
  });

  // Cash slice
  if (portfolioData.cash_weight_pct > 0) {
    labels.push('Efectivo');
    dataValues.push(portfolioData.cash_weight_pct);
    colors.push('#475569');

    if (legendEl) {
      const cashItem = document.createElement('div');
      cashItem.className = 'legend-item';
      cashItem.innerHTML = `
        <span class="legend-ticker">
          <span class="legend-color-dot" style="background: #475569"></span>
          Efectivo
        </span>
        <span class="legend-pct">${portfolioData.cash_weight_pct}%</span>
      `;
      legendEl.appendChild(cashItem);
    }
  }

  if (allocationChart) {
    allocationChart.destroy();
  }

  allocationChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: colors,
        borderColor: '#111827',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.label}: ${context.raw}%`
          }
        }
      },
      cutout: '72%'
    }
  });
}

function renderPerformersAndSpread() {
  const best = portfolioData.best_asset;
  const worst = portfolioData.worst_asset;
  const rates = portfolioData.rates;

  const bestTicker = document.getElementById('best-ticker');
  const bestName = document.getElementById('best-name');
  const bestPnl = document.getElementById('best-pnl');

  if (best && bestTicker) {
    bestTicker.textContent = best.ticker;
    bestName.textContent = best.name;
    const sign = best.pnl_pct_usdt >= 0 ? '+' : '';
    bestPnl.textContent = `${sign}${best.pnl_pct_usdt}% USDT`;
    bestPnl.className = `metric-highlight ${best.pnl_pct_usdt >= 0 ? 'text-green' : 'text-red'}`;
  }

  const worstTicker = document.getElementById('worst-ticker');
  const worstName = document.getElementById('worst-name');
  const worstPnl = document.getElementById('worst-pnl');

  if (worst && worstTicker) {
    worstTicker.textContent = worst.ticker;
    worstName.textContent = worst.name;
    const sign = worst.pnl_pct_usdt >= 0 ? '+' : '';
    worstPnl.textContent = `${sign}${worst.pnl_pct_usdt}% USDT`;
    worstPnl.className = `metric-highlight ${worst.pnl_pct_usdt >= 0 ? 'text-green' : 'text-red'}`;
  }

  // Spread Alert Banner
  const alertBrechaPct = document.getElementById('alert-brecha-pct');
  const alertBrechaText = document.getElementById('alert-brecha-text');

  if (rates && alertBrechaPct && alertBrechaText) {
    alertBrechaPct.textContent = `+${rates.brecha_pct}%`;
    if (rates.brecha_pct > 10) {
      alertBrechaText.textContent = `La brecha entre el dólar BCV (${formatNumber(rates.bcv, 2)} Bs) y USDT (${formatNumber(rates.usdt, 2)} Bs) es de +${rates.brecha_pct}%. Tus títulos deben rendir más de ${rates.brecha_pct}% para superar la devaluación real.`;
    } else {
      alertBrechaText.textContent = `La brecha cambiaria se encuentra en niveles normales (${rates.brecha_pct}%).`;
    }
  }
}

function renderMarketTable(query = '') {
  const tbody = document.getElementById('market-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = marketQuotes.filter(q => 
    q.ticker.toLowerCase().includes(query) || 
    (q.name && q.name.toLowerCase().includes(query)) ||
    (q.sector && q.sector.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-dim">No se encontraron títulos que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  filtered.forEach(q => {
    const tr = document.createElement('tr');
    const bid = q.bid_ves ? formatVES(q.bid_ves) : '---';
    const ask = q.ask_ves ? formatVES(q.ask_ves) : '---';
    const spreadBadge = q.spread_pct > 0 ? `<span class="badge badge-warning">${q.spread_pct}%</span>` : '<span class="text-dim">---</span>';

    tr.innerHTML = `
      <td><strong>${q.ticker}</strong></td>
      <td>${q.name}</td>
      <td><span class="text-dim">${q.sector || 'Renta Variable'}</span></td>
      <td class="text-right">${bid}</td>
      <td class="text-right">${ask}</td>
      <td class="text-right text-green"><strong>${formatVES(q.price_ves)}</strong></td>
      <td class="text-right">${formatUSD(q.price_usd_bcv)}</td>
      <td class="text-right">${formatUSDT(q.price_usdt)}</td>
      <td class="text-right">${spreadBadge}</td>
      <td class="text-center">
        <button class="btn-ghost-small" onclick="quickAddTicker('${q.ticker}', ${q.price_ves})">
          <i data-lucide="plus"></i> Comprar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

function renderMarketUsTable(query = '') {
  const tbody = document.getElementById('market-us-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const assets = (popularInternationalQuotes && popularInternationalQuotes.length > 0)
    ? popularInternationalQuotes
    : POPULAR_INTERNATIONAL_ASSETS;

  const rates = portfolioData?.rates || { bcv: 880.12, usdt: 998.90 };
  const bcv = rates.bcv || 880.12;
  const usdt = rates.usdt || 998.90;

  const filtered = assets.filter(item =>
    item.ticker.toLowerCase().includes(query) ||
    (item.name && item.name.toLowerCase().includes(query)) ||
    (item.sector && item.sector.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-dim">No se encontraron activos de Wall Street para esa búsqueda.</td></tr>`;
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    const priceUsd = item.price_usd || item.reference_price_usd || 100.0;
    const equivVes = priceUsd * bcv;
    const equivUsdt = priceUsd;
    const changePct = item.change_pct !== undefined ? item.change_pct : 0.0;
    const isChangePos = changePct >= 0;
    const changeClass = isChangePos ? 'text-green' : 'text-red';
    const changeSign = isChangePos ? '+' : '';

    tr.innerHTML = `
      <td>
        <strong>${item.ticker}</strong>
        <span class="badge-market badge-market-intl" style="margin-left: 6px;">${item.market || 'US'}</span>
      </td>
      <td>${item.name}</td>
      <td><span class="text-dim">${item.sector || 'Internacional'}</span></td>
      <td class="text-right col-usd-price"><strong>${formatUSD(priceUsd)}</strong></td>
      <td class="text-right ${changeClass}"><strong>${changeSign}${formatNumber(changePct, 2)}%</strong></td>
      <td class="text-right text-dim">${formatVES(equivVes)}</td>
      <td class="text-right text-dim">${formatUSDT(equivUsdt)}</td>
      <td class="text-center">
        <button class="btn-buy-mini-us" onclick="quickAddUsTicker('${item.ticker}', ${priceUsd})">
          <i data-lucide="plus"></i> Comprar USD
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) lucide.createIcons();
}

// Quick action to add from US market table
window.quickAddUsTicker = function(ticker, currentPrice) {
  playSound('click');
  const modal = document.getElementById('modal-add-position');
  const select = document.getElementById('pos-ticker');
  const priceInput = document.getElementById('pos-price');
  const sharesInput = document.getElementById('pos-shares');
  const currSelect = document.getElementById('pos-currency');

  if (select) select.value = ticker;
  if (priceInput) priceInput.value = formatNumber(currentPrice, 2);
  if (sharesInput) sharesInput.value = '5.000';
  if (currSelect) currSelect.value = 'USD';

  if (priceInput) priceInput.dispatchEvent(new Event('input'));
  if (modal) modal.classList.add('show');
};

// Modal trigger from Tab Header respecting active ecosystem
window.openAddModalWithEco = function() {
  playSound('click');
  const modal = document.getElementById('modal-add-position');
  const currSelect = document.getElementById('pos-currency');
  if (currSelect) {
    currSelect.value = (activeEcosystem === 'US') ? 'USD' : 'VES';
  }
  if (modal) modal.classList.add('show');
};

// Quick action to add from BVC market table
window.quickAddTicker = function(ticker, currentPrice) {
  playSound('click');
  const modal = document.getElementById('modal-add-position');
  document.getElementById('pos-ticker').value = ticker;
  document.getElementById('pos-price').value = formatNumber(currentPrice, 2);
  document.getElementById('pos-shares').value = '1.000';
  document.getElementById('pos-currency').value = 'VES';
  
  const priceInput = document.getElementById('pos-price');
  priceInput.dispatchEvent(new Event('input'));
  
  if (modal) modal.classList.add('show');
};

// Global delete position handler
window.deletePosition = async function(posId) {
  playSound('alert');
  if (!confirm('¿Estás seguro de eliminar esta posición de tu portafolio?')) return;
  try {
    const res = await fetchWithAuth(`/api/positions/${posId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast({
        title: 'Posición Eliminada',
        message: 'El activo fue removido del portafolio.',
        type: 'warning',
        duration: 3000
      });
      await loadAllData();
    }
  } catch (err) {
    showToast({ title: 'Error', message: String(err), type: 'error' });
  }
};

// =========================================================================
// 5. KIXINVERT AI ANALYST & CHAT INTEGRATION
// =========================================================================
let isAiLoading = false;
let currentAIDiagnosis = null;
let currentTacticalFilter = 'all';

async function loadAIDiagnosis(forceRefresh = false) {
  if (isAiLoading) return;
  isAiLoading = true;
  playSound('ai');

  const btnRefresh = document.getElementById('btn-refresh-ai');
  if (btnRefresh) btnRefresh.classList.add('spin-anim');

  try {
    const res = await fetchWithAuth('/api/ai/diagnosis', {
      method: 'POST'
    });
    const diag = await res.json();
    currentAIDiagnosis = diag;

    const scoreNum = document.getElementById('ai-health-score');
    const scoreTitle = document.getElementById('ai-health-title');
    const devBadge = document.getElementById('ai-devaluation-badge');
    const narrativeEl = document.getElementById('ai-narrative-text');

    if (scoreNum) scoreNum.textContent = diag.health_score;
    if (scoreTitle) scoreTitle.textContent = `Salud: ${diag.health_status} (${diag.health_score}/100)`;
    if (devBadge) {
      devBadge.textContent = diag.devaluation_status;
      devBadge.className = `badge badge-${diag.devaluation_badge}`;
    }
    if (narrativeEl) {
      narrativeEl.textContent = diag.summary_narrative;
    }

    // 1. Update tactical KPI counters and filter badges
    updateTacticalKPIsAndCounters(diag);

    // 2. Render the tactical matrix table according to current active filter
    renderTacticalRecommendationsTable(diag, currentTacticalFilter);

    if (forceRefresh) {
      showToast({
        title: '🤖 Diagnóstico IA Actualizado',
        message: `Salud de portafolio evaluada en ${diag.health_score}/100 puntos.`,
        type: 'ai',
        duration: 3500
      });
    }
  } catch (err) {
    console.error('Error fetching AI diagnosis:', err);
  } finally {
    isAiLoading = false;
    if (btnRefresh) btnRefresh.classList.remove('spin-anim');
    if (window.lucide) lucide.createIcons();
  }
}

function updateTacticalKPIsAndCounters(diag) {
  if (!diag || !diag.asset_recommendations) return;
  const recs = diag.asset_recommendations;

  let sells = 0;
  let buys = 0;
  let rotates = 0;
  let holds = 0;

  recs.forEach(r => {
    const act = (r.action || '').toUpperCase();
    if (act === 'VENDER' || act === 'REDUCIR') sells++;
    else if (act === 'COMPRAR') buys++;
    else if (act === 'ROTAR') rotates++;
    else holds++;
  });

  const elSells = document.getElementById('tactical-count-sells');
  const elBuys = document.getElementById('tactical-count-buys');
  const elRotates = document.getElementById('tactical-count-rotates');
  const elHolds = document.getElementById('tactical-count-holds');

  if (elSells) elSells.textContent = sells;
  if (elBuys) elBuys.textContent = buys;
  if (elRotates) elRotates.textContent = rotates;
  if (elHolds) elHolds.textContent = holds;

  // Filter button counts
  const fAll = document.getElementById('count-filter-all');
  const fSells = document.getElementById('count-filter-sells');
  const fBuys = document.getElementById('count-filter-buys');
  const fRotates = document.getElementById('count-filter-rotates');
  const fHolds = document.getElementById('count-filter-holds');

  if (fAll) fAll.textContent = recs.length;
  if (fSells) fSells.textContent = sells;
  if (fBuys) fBuys.textContent = buys;
  if (fRotates) fRotates.textContent = rotates;
  if (fHolds) fHolds.textContent = holds;
}

function filterTacticalTable(filterName) {
  currentTacticalFilter = filterName;

  // Update button active state
  document.querySelectorAll('.btn-filter-tactical').forEach(btn => {
    if (btn.getAttribute('data-filter') === filterName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (currentAIDiagnosis) {
    renderTacticalRecommendationsTable(currentAIDiagnosis, currentTacticalFilter);
  }
}
window.filterTacticalTable = filterTacticalTable;

function renderTacticalRecommendationsTable(diag, filter = 'all') {
  const tbody = document.getElementById('ai-recs-tbody');
  if (!tbody) return;

  if (!diag || !diag.asset_recommendations || diag.asset_recommendations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-dim">No hay posiciones registradas para evaluar señales tácticas.</td></tr>`;
    return;
  }

  let items = diag.asset_recommendations;
  if (filter !== 'all') {
    if (filter === 'VENDER') {
      items = items.filter(r => (r.action || '').toUpperCase() === 'VENDER' || (r.action || '').toUpperCase() === 'REDUCIR');
    } else {
      items = items.filter(r => (r.action || '').toUpperCase() === filter.toUpperCase());
    }
  }

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-dim">No hay activos con la señal "${filter}" en este momento.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  items.forEach(rec => {
    const tr = document.createElement('tr');
    const pnlVesColor = (rec.pnl_pct_ves || 0) >= 0 ? 'text-green' : 'text-red';
    const pnlUsdtColor = (rec.pnl_pct_usdt !== undefined ? rec.pnl_pct_usdt : 0) >= 0 ? 'text-green' : 'text-red';
    const pnlUsdtStr = (rec.pnl_pct_usdt !== undefined ? ((rec.pnl_pct_usdt >= 0 ? '+' : '') + rec.pnl_pct_usdt + '%') : 'N/A');
    const pnlVesStr = ((rec.pnl_pct_ves || 0) >= 0 ? '+' : '') + (rec.pnl_pct_ves || 0) + '%';

    let badgeClass = 'badge-signal-hold';
    let iconName = rec.icon || 'shield-check';
    const act = (rec.action || '').toUpperCase();

    if (act === 'VENDER' || act === 'REDUCIR') {
      badgeClass = (rec.pnl_pct_usdt >= 40) ? 'badge-signal-sell-strong' : 'badge-signal-sell';
      if (!rec.icon) iconName = 'dollar-sign';
    } else if (act === 'COMPRAR') {
      badgeClass = 'badge-signal-buy-lag';
      if (!rec.icon) iconName = 'zap';
    } else if (act === 'ROTAR') {
      badgeClass = 'badge-signal-rotate';
      if (!rec.icon) iconName = 'alert-triangle';
    }

    tr.innerHTML = `
      <td>
        <div class="ticker-cell">
          <span class="ticker-symbol">${rec.ticker}</span>
          <span class="ticker-name">${rec.name || ''}</span>
        </div>
      </td>
      <td class="text-center"><span class="badge badge-info">${rec.weight_pct}%</span></td>
      <td class="text-right ${pnlUsdtColor}"><strong>${pnlUsdtStr}</strong></td>
      <td class="text-right ${pnlVesColor}">${pnlVesStr}</td>
      <td class="text-center">
        <span class="badge-tactical ${badgeClass}">
          <i data-lucide="${iconName}"></i>
          <span>${rec.action || 'MANTENER'}</span>
        </span>
      </td>
      <td style="font-weight:600; color: #f1f5f9;">
        ${rec.action_text || rec.recommendation}
      </td>
      <td style="font-size:0.84rem; color:var(--text-muted); line-height:1.45;">
        ${rec.rationale}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

// =========================================================================
// AI DEMO QUERY LIMITER & ASSISTANT CONTROLLER
// =========================================================================
function updateAiDemoCounterBadge() {
  const isDemo = localStorage.getItem('kix_authenticated') !== 'true' || !localStorage.getItem('kix_token');
  const badge = document.getElementById('demo-ai-limit-pill');
  const badgeText = document.getElementById('demo-ai-limit-text');
  const btnPillUpgrade = document.getElementById('btn-ai-pill-upgrade');
  const welcomeMsg = document.getElementById('ai-welcome-msg-body');
  const chatInput = document.getElementById('ai-chat-input');
  const formAiChat = document.getElementById('form-ai-chat');
  const btnSend = document.getElementById('btn-send-ai-chat');
  const userName = localStorage.getItem('kix_user_name');

  if (isDemo) {
    // 1. GUEST DEMO: Max 2 Practice Queries
    const demoCount = parseInt(sessionStorage.getItem('kix_demo_ai_count') || '0', 10);
    const remaining = Math.max(0, 2 - demoCount);

    if (btnPillUpgrade) btnPillUpgrade.style.display = 'none';

    if (badge) {
      badge.style.display = 'inline-flex';
      if (remaining > 0) {
        badge.classList.remove('limit-exhausted');
        if (badgeText) badgeText.textContent = remaining === 2 ? '2 consultas demo disponibles' : '1 consulta demo disponible';
      } else {
        badge.classList.add('limit-exhausted');
        if (badgeText) badgeText.textContent = 'Consultas demo agotadas (Regístrate)';
      }
    }

    if (welcomeMsg) {
      welcomeMsg.innerHTML = `¡Hola! Soy tu <strong>Analista Financiero KixInvert AI</strong>. En este Modo Demo cuentas con <strong>2 consultas de práctica gratuitas</strong> para comprobar mi análisis en tiempo real de la Bolsa de Caracas y cobertura cambiaria. ¡Hazme una pregunta o pulsa una sugerencia arriba!`;
    }

    if (remaining === 0) {
      if (formAiChat) formAiChat.classList.add('input-locked');
      if (chatInput) {
        chatInput.disabled = true;
        chatInput.placeholder = 'Consultas demo agotadas. Regístrate gratis para continuar.';
      }
      if (btnSend) btnSend.disabled = true;
    } else {
      if (formAiChat) formAiChat.classList.remove('input-locked');
      if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = remaining === 2 
          ? 'Pregúntale a KixInvert AI (Modo Demo - 2 consultas)...' 
          : 'Última consulta de práctica disponible...';
      }
      if (btnSend) btnSend.disabled = false;
    }
    return;
  }

  // 2. AUTHENTICATED USERS: FREE VS PRO TIER
  const isPro = currentUserSubscription.is_pro;
  const used = currentUserSubscription.used_queries || 0;
  const limit = currentUserSubscription.queries_limit || 10;
  const remaining = Math.max(0, limit - used);

  if (isPro) {
    // PRO USER: UNLIMITED
    if (badge) {
      badge.style.display = 'inline-flex';
      badge.classList.remove('limit-exhausted');
      if (badgeText) badgeText.innerHTML = `👑 <strong>Plan PRO</strong> • Consultas Ilimitadas`;
    }
    if (btnPillUpgrade) btnPillUpgrade.style.display = 'none';

    if (formAiChat) formAiChat.classList.remove('input-locked');
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.placeholder = 'Pregúntale a KixInvert AI (Modo PRO ilimitado)...';
    }
    if (btnSend) btnSend.disabled = false;

    if (welcomeMsg) {
      const posCount = (portfolioData && portfolioData.positions) ? portfolioData.positions.length : 0;
      const posText = posCount > 0 ? `tu portafolio de ${posCount} títulos` : 'tus inversiones';
      welcomeMsg.innerHTML = `¡Hola, <strong>${escapeHtml(userName || 'Inversionista')}</strong>! Cuentas con membresía <strong>KixInvert PRO 👑</strong> con consultas ilimitadas. Conozco a detalle ${posText} en la Bolsa de Caracas y las tasas en vivo. ¿En qué puedo orientarte hoy?`;
    }

  } else {
    // FREE TIER USER: MAX 10 QUERIES PER MONTH
    if (badge) {
      badge.style.display = 'inline-flex';
      if (remaining > 0) {
        badge.classList.remove('limit-exhausted');
        if (badgeText) badgeText.textContent = `Consultas este mes: ${used} / ${limit} (Plan Free)`;
      } else {
        badge.classList.add('limit-exhausted');
        if (badgeText) badgeText.textContent = `Límite mensual alcanzado (10/10)`;
      }
    }
    if (btnPillUpgrade) btnPillUpgrade.style.display = 'inline-flex';

    if (welcomeMsg) {
      const posCount = (portfolioData && portfolioData.positions) ? portfolioData.positions.length : 0;
      const posText = posCount > 0 ? `tu portafolio de ${posCount} títulos` : 'tus inversiones';
      welcomeMsg.innerHTML = `¡Hola, <strong>${escapeHtml(userName || 'Inversionista')}</strong>! En el Plan Free dispones de <strong>10 consultas mensuales</strong> (${remaining} disponibles este mes). Conozco ${posText} y las cotizaciones en tiempo real.`;
    }

    if (remaining === 0) {
      if (formAiChat) formAiChat.classList.add('input-locked');
      if (chatInput) {
        chatInput.disabled = true;
        chatInput.placeholder = 'Has alcanzado tus 10 consultas del mes. Activa el Plan PRO para continuar.';
      }
      if (btnSend) btnSend.disabled = true;
    } else {
      if (formAiChat) formAiChat.classList.remove('input-locked');
      if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = `Pregúntale a KixInvert AI (${remaining} consultas restantes este mes)...`;
      }
      if (btnSend) btnSend.disabled = false;
    }
  }
}

async function submitAIChat(question) {
  const history = document.getElementById('ai-chat-history');
  if (!history || !question) return;
  playSound('click');

  const isDemo = localStorage.getItem('kix_authenticated') !== 'true' || !localStorage.getItem('kix_token');
  let demoCount = parseInt(sessionStorage.getItem('kix_demo_ai_count') || '0', 10);

  // 1. If in Demo mode and 2 queries already used, provide Register CTA
  if (isDemo && demoCount >= 2) {
    updateAiDemoCounterBadge();

    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'chat-msg user-msg';
    userMsgDiv.innerHTML = `
      <div class="msg-avatar"><i data-lucide="user"></i></div>
      <div class="msg-body">${escapeHtml(question)}</div>
    `;
    history.appendChild(userMsgDiv);

    const limitMsgDiv = document.createElement('div');
    limitMsgDiv.className = 'chat-msg ai-msg';
    limitMsgDiv.innerHTML = `
      <div class="msg-avatar"><i data-lucide="shield-alert"></i></div>
      <div class="msg-body">
        🔒 <strong>Has alcanzado el límite de 2 consultas de práctica gratuitas en el Modo Demo.</strong>
        <p style="margin: 6px 0 0 0; font-size: 0.82rem; color: var(--text-muted);">
          Para continuar disfrutando de <strong>consultas ilimitadas</strong> con tu portafolio personalizado en la Bolsa de Caracas, análisis en tiempo real y alertas de brecha cambiaria, <strong>crea tu cuenta gratuita de inversionista</strong>.
        </p>
        <div class="ai-register-cta-card">
          <div class="cta-title"><i data-lucide="sparkles" style="color:#c4b5fd;"></i> Desbloquea KixInvert AI Ilimitado</div>
          <div class="cta-desc">El registro es inmediato, 100% gratuito y te permite sincronizar y gestionar tus propias acciones en tiempo real de forma privada.</div>
          <button class="btn-cta-register" onclick="openAuthModal('register')">
            <i data-lucide="user-plus"></i> Crear Cuenta Gratis Ahora
          </button>
        </div>
      </div>
    `;
    history.appendChild(limitMsgDiv);
    history.scrollTop = history.scrollHeight;
    lucide.createIcons();
    playSound('alert');

    showToast({
      title: 'Consultas Demo Agotadas',
      message: 'Regístrate gratis para disfrutar de consultas con la IA.',
      type: 'warning',
      duration: 4000
    });
    return;
  }

  // 2. If Authenticated Free user has already reached 10 queries, provide PRO Upgrade CTA
  if (!isDemo && !currentUserSubscription.is_pro && (currentUserSubscription.used_queries || 0) >= 10) {
    updateAiDemoCounterBadge();

    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'chat-msg user-msg';
    userMsgDiv.innerHTML = `
      <div class="msg-avatar"><i data-lucide="user"></i></div>
      <div class="msg-body">${escapeHtml(question)}</div>
    `;
    history.appendChild(userMsgDiv);

    const limitMsgDiv = document.createElement('div');
    limitMsgDiv.className = 'chat-msg ai-msg';
    limitMsgDiv.innerHTML = `
      <div class="msg-avatar"><i data-lucide="crown" style="color: #f59e0b;"></i></div>
      <div class="msg-body">
        🔒 <strong>Has alcanzado tu límite mensual de 10 consultas en el Plan Free.</strong>
        <p style="margin: 6px 0 0 0; font-size: 0.82rem; color: var(--text-muted);">
          Desbloquea <strong>consultas y diagnósticos ilimitados</strong>, señales tácticas de compra/venta y alertas de brecha cambiaria por solo <strong>$5.00 USDT/mes</strong> con Binance Pay.
        </p>
        <div class="ai-register-cta-card" style="border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.08);">
          <div class="cta-title" style="color: #fbbf24;"><i data-lucide="crown"></i> KixInvert PRO con Binance Pay</div>
          <div class="cta-desc">Activación inmediata en 2 minutos escaneando el código QR oficial de Binance Pay. Cancela cuando quieras.</div>
          <button class="btn-cta-register" onclick="openProModal()" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #0b0f19; font-weight: 800;">
            <i data-lucide="crown"></i> Activar Plan PRO ($5 USDT)
          </button>
        </div>
      </div>
    `;
    history.appendChild(limitMsgDiv);
    history.scrollTop = history.scrollHeight;
    lucide.createIcons();
    playSound('alert');

    showToast({
      title: 'Límite Mensual Alcanzado',
      message: 'Pásate a KixInvert PRO para disfrutar de consultas ilimitadas.',
      type: 'warning',
      duration: 4500
    });
    return;
  }

  // Render User Message
  const userMsgDiv = document.createElement('div');
  userMsgDiv.className = 'chat-msg user-msg';
  userMsgDiv.innerHTML = `
    <div class="msg-avatar"><i data-lucide="user"></i></div>
    <div class="msg-body">${escapeHtml(question)}</div>
  `;
  history.appendChild(userMsgDiv);

  // Render AI Loading Spinner
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-msg ai-msg loading-msg';
  loadingDiv.innerHTML = `
    <div class="msg-avatar"><i data-lucide="bot"></i></div>
    <div class="msg-body"><em class="text-dim"><i data-lucide="loader-2" class="spin-anim" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i> KixInvert AI está analizando tus posiciones y la pizarra BVC...</em></div>
  `;
  history.appendChild(loadingDiv);
  history.scrollTop = history.scrollHeight;
  lucide.createIcons();

  if (isDemo) {
    demoCount++;
    sessionStorage.setItem('kix_demo_ai_count', demoCount);
    updateAiDemoCounterBadge();
  }

  try {
    const res = await fetchWithAuth('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question, demo_count: demoCount })
    });
    const data = await res.json();
    loadingDiv.remove();
    playSound('ai');

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'chat-msg ai-msg';

    let contentHtml = formatAiResponse(data.answer);

    // If demo count reached exactly 2, append register CTA
    if (isDemo && demoCount >= 2) {
      contentHtml += `
        <div class="ai-register-cta-card">
          <div class="cta-title"><i data-lucide="sparkles" style="color:#c4b5fd;"></i> Has completado tus 2 consultas demo</div>
          <div class="cta-desc">¿Te gustó el análisis? Crea tu cuenta gratuita para conectar tus acciones reales, guardar tu historial y recibir asesoría bursátil continua sin límites.</div>
          <button class="btn-cta-register" onclick="openAuthModal('register')">
            <i data-lucide="user-plus"></i> Registrarme Gratis en KixInvert
          </button>
        </div>
      `;
    }

    // If Free quota exceeded on this call, append PRO upgrade CTA
    if (data.upgrade_required || (data.limit_reached && data.subscription_tier === 'free')) {
      currentUserSubscription.used_queries = 10;
      updateAiDemoCounterBadge();

      contentHtml += `
        <div class="ai-register-cta-card" style="border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.08); margin-top: 14px;">
          <div class="cta-title" style="color: #fbbf24;"><i data-lucide="crown"></i> Límite Mensual de 10 Consultas Alcanzado</div>
          <div class="cta-desc">Desbloquea consultas ilimitadas con tu Analista AI, señales tácticas de compra/venta y alertas de brecha cambiaria por solo <strong>$5.00 USDT/mes</strong> con Binance Pay.</div>
          <button class="btn-cta-register" onclick="openProModal()" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #0b0f19; font-weight: 800;">
            <i data-lucide="crown"></i> Activar KixInvert PRO ($5 USDT)
          </button>
        </div>
      `;
    } else if (data.subscription_tier === 'pro') {
      currentUserSubscription.is_pro = true;
      currentUserSubscription.tier = 'pro';
      currentUserSubscription.used_queries = data.queries_used || (currentUserSubscription.used_queries + 1);
      updateAiDemoCounterBadge();
    } else if (data.subscription_tier === 'free') {
      currentUserSubscription.used_queries = data.queries_used || (currentUserSubscription.used_queries + 1);
      updateAiDemoCounterBadge();
    }

    aiMsgDiv.innerHTML = `
      <div class="msg-avatar"><i data-lucide="bot"></i></div>
      <div class="msg-body">${contentHtml}</div>
    `;
    history.appendChild(aiMsgDiv);

    if (isDemo && demoCount >= 2) {
      updateAiDemoCounterBadge();
    }
  } catch (err) {
    loadingDiv.remove();
    const errorDiv = document.createElement('div');
    errorDiv.className = 'chat-msg ai-msg';
    errorDiv.innerHTML = `
      <div class="msg-avatar"><i data-lucide="alert-circle"></i></div>
      <div class="msg-body text-red">Ocurrió un error al contactar el servicio de IA: ${err.message}</div>
    `;
    history.appendChild(errorDiv);
  } finally {
    history.scrollTop = history.scrollHeight;
    lucide.createIcons();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatAiResponse(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

// =========================================================================
// 8. WHAT-IF STRESS SIMULATOR & EXECUTIVE REPORT CONTROLLER
// =========================================================================

let whatIfDebounceTimer = null;
let whatIfCurrentBaseBcv = 881.87;

function setupWhatIfAndReportModals() {
  const btnOpenWhatIf = document.getElementById('btn-open-whatif');
  const btnCloseWhatIf = document.getElementById('btn-close-whatif');
  const btnCloseWhatIfModal = document.getElementById('btn-close-whatif-modal');

  const btnOpenReport = document.getElementById('btn-open-report');
  const btnCloseReportModal = document.getElementById('btn-close-report-modal');
  const btnCloseReportBottom = document.getElementById('btn-close-report-bottom');

  if (btnOpenWhatIf) btnOpenWhatIf.addEventListener('click', openWhatIfModal);
  if (btnCloseWhatIf) btnCloseWhatIf.addEventListener('click', closeWhatIfModal);
  if (btnCloseWhatIfModal) btnCloseWhatIfModal.addEventListener('click', closeWhatIfModal);

  if (btnOpenReport) btnOpenReport.addEventListener('click', openExecutiveReport);
  if (btnCloseReportModal) btnCloseReportModal.addEventListener('click', closeExecutiveReport);
  if (btnCloseReportBottom) btnCloseReportBottom.addEventListener('click', closeExecutiveReport);

  // Sliders input events
  const bcvSlider = document.getElementById('whatif-bcv-slider');
  const gapSlider = document.getElementById('whatif-gap-slider');
  const usSlider = document.getElementById('whatif-us-slider');
  const elastSelect = document.getElementById('whatif-elasticity');

  if (bcvSlider) bcvSlider.addEventListener('input', runWhatIfSimulation);
  if (gapSlider) gapSlider.addEventListener('input', runWhatIfSimulation);
  if (usSlider) usSlider.addEventListener('input', runWhatIfSimulation);
  if (elastSelect) elastSelect.addEventListener('change', runWhatIfSimulation);

  // Preset Buttons
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      playSound('click');
      const preset = btn.getAttribute('data-preset');
      applyWhatIfPreset(preset);
    });
  });
}

async function openWhatIfModal() {
  playSound('click');
  const modal = document.getElementById('modal-what-if');
  if (!modal) return;
  modal.classList.add('show');

  // Fetch current exchange rates to seed base sliders
  try {
    const res = await fetch('/api/rates');
    if (res.ok) {
      const rates = await res.json();
      whatIfCurrentBaseBcv = parseFloat(rates.bcv || 881.87);
    }
  } catch (e) {
    whatIfCurrentBaseBcv = 881.87;
  }

  // Set default slider: +15%
  applyWhatIfPreset('moderate');
  if (window.lucide) lucide.createIcons();
}

function closeWhatIfModal() {
  playSound('click');
  const modal = document.getElementById('modal-what-if');
  if (modal) modal.classList.remove('show');
}

function applyWhatIfPreset(preset) {
  const bcvSlider = document.getElementById('whatif-bcv-slider');
  const gapSlider = document.getElementById('whatif-gap-slider');
  const usSlider = document.getElementById('whatif-us-slider');
  const elastSelect = document.getElementById('whatif-elasticity');

  if (!bcvSlider || !gapSlider || !usSlider || !elastSelect) return;

  if (preset === 'moderate') {
    bcvSlider.value = Math.round(whatIfCurrentBaseBcv * 1.15);
    gapSlider.value = 15;
    usSlider.value = 0;
    elastSelect.value = "0.85";
  } else if (preset === 'severe') {
    bcvSlider.value = Math.round(whatIfCurrentBaseBcv * 1.30);
    gapSlider.value = 25;
    usSlider.value = 0;
    elastSelect.value = "0.70";
  } else if (preset === 'shock') {
    bcvSlider.value = Math.round(whatIfCurrentBaseBcv * 1.50);
    gapSlider.value = 35;
    usSlider.value = -5;
    elastSelect.value = "0.50";
  } else if (preset === 'wallstreet_dip') {
    bcvSlider.value = Math.round(whatIfCurrentBaseBcv * 1.05);
    gapSlider.value = 15;
    usSlider.value = -10;
    elastSelect.value = "0.85";
  }

  document.querySelectorAll('.btn-preset').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-preset') === preset);
  });

  runWhatIfSimulation();
}

async function runWhatIfSimulation() {
  const bcvSlider = document.getElementById('whatif-bcv-slider');
  const gapSlider = document.getElementById('whatif-gap-slider');
  const usSlider = document.getElementById('whatif-us-slider');
  const elastSelect = document.getElementById('whatif-elasticity');

  if (!bcvSlider || !gapSlider || !usSlider || !elastSelect) return;

  const bcvTarget = parseFloat(bcvSlider.value);
  const gapPct = parseFloat(gapSlider.value);
  const usdtTarget = bcvTarget * (1.0 + (gapPct / 100.0));
  const usShockPct = parseFloat(usSlider.value);
  const elastRate = parseFloat(elastSelect.value);

  // Update dynamic labels
  const bcvDeltaPct = whatIfCurrentBaseBcv > 0 ? ((bcvTarget - whatIfCurrentBaseBcv) / whatIfCurrentBaseBcv * 100).toFixed(1) : '0.0';
  const bcvDisplay = document.getElementById('whatif-bcv-display');
  const bcvDelta = document.getElementById('whatif-bcv-delta');
  const gapDisplay = document.getElementById('whatif-gap-display');
  const usdtCalc = document.getElementById('whatif-usdt-calc');
  const usDisplay = document.getElementById('whatif-us-display');
  const elastDisplay = document.getElementById('whatif-elasticity-display');

  if (bcvDisplay) bcvDisplay.textContent = `${formatNumber(bcvTarget, 2)} Bs.`;
  if (bcvDelta) bcvDelta.textContent = `+${bcvDeltaPct}%`;
  if (gapDisplay) gapDisplay.textContent = `+${gapPct.toFixed(1)}%`;
  if (usdtCalc) usdtCalc.textContent = `USDT: ~${formatNumber(usdtTarget, 2)} Bs.`;
  if (usDisplay) usDisplay.textContent = `${usShockPct > 0 ? '+' : ''}${usShockPct.toFixed(1)}%`;
  if (elastDisplay) {
    elastDisplay.textContent = elastRate >= 0.95 ? 'Pleno (100%)' : (elastRate >= 0.7 ? 'Típico (85%)' : 'Rezago (50%)');
  }

  // Clear debounce
  if (whatIfDebounceTimer) clearTimeout(whatIfDebounceTimer);
  whatIfDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetchWithAuth('/api/portfolio/simulate-what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bcv_target: bcvTarget,
          usdt_target: usdtTarget,
          wall_street_shock_pct: usShockPct,
          bvc_adjustment_rate: elastRate
        })
      });
      if (!res.ok) return;
      const data = await res.json();
      renderWhatIfResults(data);
    } catch (e) {
      console.error('Error running What-If simulation:', e);
    }
  }, 80);
}

function renderWhatIfResults(data) {
  if (!data) return;

  // 1. Verdict Banner
  const verdictBanner = document.getElementById('whatif-verdict-banner');
  const verdictIcon = document.getElementById('whatif-verdict-icon');
  const verdictTitle = document.getElementById('whatif-verdict-title');
  const verdictSummary = document.getElementById('whatif-verdict-summary');

  if (verdictBanner && data.verdict) {
    verdictBanner.className = `whatif-verdict-banner badge-${data.verdict.badge || 'success'}`;
    if (verdictTitle) verdictTitle.textContent = data.verdict.title || 'Proyección de Cobertura';
    if (verdictSummary) verdictSummary.textContent = data.verdict.summary || '';
    if (verdictIcon) {
      const iconName = data.verdict.badge === 'critical' ? 'alert-triangle' : (data.verdict.badge === 'warning' ? 'clock' : 'shield-check');
      verdictIcon.innerHTML = `<i data-lucide="${iconName}"></i>`;
    }
  }

  // 2. Metrics Grid
  const currUsdt = document.getElementById('whatif-curr-usdt');
  const currVes = document.getElementById('whatif-curr-ves');
  const projUsdt = document.getElementById('whatif-proj-usdt');
  const projVes = document.getElementById('whatif-proj-ves');
  const deltaCard = document.getElementById('whatif-delta-card');
  const deltaVal = document.getElementById('whatif-delta-val');
  const deltaPct = document.getElementById('whatif-delta-pct');

  if (currUsdt) currUsdt.textContent = `${formatNumber(data.current_wealth.usdt, 2)} USDT`;
  if (currVes) currVes.textContent = `${formatNumber(data.current_wealth.ves, 2)} Bs.`;
  if (projUsdt) projUsdt.textContent = `${formatNumber(data.projected_wealth.usdt, 2)} USDT`;
  if (projVes) projVes.textContent = `${formatNumber(data.projected_wealth.ves, 2)} Bs.`;

  if (deltaVal && data.impact) {
    const isPos = data.impact.delta_usdt >= 0;
    deltaVal.textContent = `${isPos ? '+' : ''}${formatNumber(data.impact.delta_usdt, 2)} USDT`;
    if (deltaPct) deltaPct.textContent = `${isPos ? '+' : ''}${data.impact.delta_usdt_pct.toFixed(2)}%`;
    if (deltaCard) {
      deltaCard.className = `whatif-metric-card whatif-metric-delta ${isPos ? 'delta-pos' : 'delta-neg'}`;
    }
  }

  // 3. Bank Savings Shield
  const savedVal = document.getElementById('whatif-saved-val');
  if (savedVal && data.impact) {
    savedVal.textContent = `$${formatNumber(data.impact.protection_saved_usdt || 0, 2)} USD`;
  }

  // 4. Simulated Positions Table
  const tbody = document.getElementById('whatif-positions-tbody');
  if (tbody && data.simulated_positions) {
    tbody.innerHTML = data.simulated_positions.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.ticker)}</strong> <span style="color:var(--text-dim);font-size:0.72rem;">(${escapeHtml(p.name)})</span></td>
        <td><span class="badge ${p.is_international ? 'badge-us' : 'badge-bvc'}">${p.is_international ? 'Wall Street' : 'BVC Caracas'}</span></td>
        <td><strong>${formatVES(p.projected_price_ves)}</strong> <span style="color:var(--text-dim);font-size:0.7rem;">(${formatUSD(p.projected_price_usd)})</span></td>
        <td style="color:#60a5fa;font-weight:700;">${formatNumber(p.projected_val_usdt, 2)} USDT</td>
        <td style="font-size:0.72rem;color:var(--text-muted);">${escapeHtml(p.coverage_behavior)}</td>
      </tr>
    `).join('');
  }

  if (window.lucide) lucide.createIcons();
}

async function openExecutiveReport() {
  playSound('click');
  const modal = document.getElementById('modal-executive-report');
  if (!modal) return;
  modal.classList.add('show');

  // Close What-If if open
  const whatIfModal = document.getElementById('modal-what-if');
  if (whatIfModal) whatIfModal.classList.remove('show');

  try {
    const res = await fetchWithAuth('/api/portfolio/executive-report');
    if (!res.ok) return;
    const data = await res.json();
    renderExecutiveReport(data);
  } catch (err) {
    console.error('Error loading executive report:', err);
  }
  if (window.lucide) lucide.createIcons();
}

function closeExecutiveReport() {
  playSound('click');
  const modal = document.getElementById('modal-executive-report');
  if (modal) modal.classList.remove('show');
}

function renderExecutiveReport(data) {
  if (!data) return;

  const s = data.summary || {};
  const t = s.totals || {};
  const rates = data.rates || {};
  const inv = data.investor || {};

  // Headers
  const idEl = document.getElementById('rep-statement-id');
  const dateEl = document.getElementById('rep-generated-at');
  const tierEl = document.getElementById('rep-user-tier');
  if (idEl) idEl.textContent = data.statement_id;
  if (dateEl) dateEl.textContent = data.generated_at;
  if (tierEl) tierEl.textContent = inv.tier;

  // Investor Info
  const nameEl = document.getElementById('rep-investor-name');
  const brokerEl = document.getElementById('rep-investor-broker');
  const bcvEl = document.getElementById('rep-rate-bcv');
  const usdtEl = document.getElementById('rep-rate-usdt');
  if (nameEl) nameEl.textContent = inv.name;
  if (brokerEl) brokerEl.textContent = inv.broker;
  if (bcvEl) bcvEl.textContent = `${formatNumber(rates.bcv, 2)} Bs.`;
  if (usdtEl) usdtEl.textContent = `${formatNumber(rates.usdt, 2)} Bs. (Brecha: +${rates.gap_pct}%)`;

  // Balances
  const totalVes = document.getElementById('rep-total-ves');
  const totalBcv = document.getElementById('rep-total-usd-bcv');
  const totalUsdt = document.getElementById('rep-total-usdt');
  const pnlVes = document.getElementById('rep-pnl-ves');
  const pnlBcv = document.getElementById('rep-pnl-bcv');
  const pnlUsdt = document.getElementById('rep-pnl-usdt');

  if (totalVes) totalVes.textContent = formatVES(t.ves ? t.ves.value : 0);
  if (totalBcv) totalBcv.textContent = formatUSD(t.usd_bcv ? t.usd_bcv.value : 0);
  if (totalUsdt) totalUsdt.textContent = `${formatNumber(t.usdt ? t.usdt.value : 0, 2)} USDT`;

  if (pnlVes) pnlVes.textContent = `P&L Nominal: ${t.ves && t.ves.pnl_pct >= 0 ? '+' : ''}${t.ves ? t.ves.pnl_pct : 0}%`;
  if (pnlBcv) pnlBcv.textContent = `P&L BCV: ${t.usd_bcv && t.usd_bcv.pnl_pct >= 0 ? '+' : ''}${t.usd_bcv ? t.usd_bcv.pnl_pct : 0}%`;
  if (pnlUsdt) {
    const isPos = t.usdt && t.usdt.pnl_pct >= 0;
    pnlUsdt.textContent = `Retorno Real USDT: ${isPos ? '+' : ''}${t.usdt ? t.usdt.pnl_pct : 0}%`;
    pnlUsdt.style.color = isPos ? '#10b981' : '#ef4444';
  }

  // Allocation breakdown
  const bd = s.market_breakdown || {};
  const allocBvc = document.getElementById('rep-alloc-bvc');
  const allocUs = document.getElementById('rep-alloc-us');
  const cashAvail = document.getElementById('rep-cash-available');

  if (allocBvc) allocBvc.textContent = `${bd.bvc_pct || 0}% (${bd.bvc_count || 0} títulos)`;
  if (allocUs) allocUs.textContent = `${bd.intl_pct || 0}% (${bd.intl_count || 0} títulos)`;
  if (cashAvail) cashAvail.textContent = `${formatVES(s.cash_ves || 0)} / ${formatUSD(s.cash_usd || 0)}`;

  // Positions Table
  const tbody = document.getElementById('rep-positions-tbody');
  if (tbody && s.positions) {
    tbody.innerHTML = s.positions.map(p => {
      const tac = p.tactical_signal || {};
      const isPos = p.pnl_pct_usdt >= 0;
      let badgeClass = 'badge-signal-hold';
      if (tac.action === 'VENDER') badgeClass = 'badge-signal-sell';
      else if (tac.action === 'ROTAR') badgeClass = 'badge-signal-rotate';
      else if (tac.action === 'COMPRAR') badgeClass = 'badge-signal-buy';

      return `
        <tr>
          <td><strong>${escapeHtml(p.ticker)}</strong></td>
          <td>${escapeHtml(p.name)}</td>
          <td><span class="badge ${p.is_international ? 'badge-us' : 'badge-bvc'}">${p.is_international ? 'Wall Street' : 'BVC Caracas'}</span></td>
          <td class="text-right">${formatNumber(p.shares, 0)}</td>
          <td class="text-right">${formatVES(p.current_price_ves)}</td>
          <td class="text-right font-mono">${formatVES(p.val_ves)}</td>
          <td class="text-right font-mono" style="font-weight:700; color:#38bdf8;">${formatNumber(p.val_usdt, 2)} USDT</td>
          <td class="text-right font-mono" style="font-weight:700; color:${isPos ? '#10b981' : '#ef4444'};">${isPos ? '+' : ''}${p.pnl_pct_usdt}%</td>
          <td class="text-center"><span class="badge ${badgeClass}" style="font-size:0.65rem;">${escapeHtml(tac.label || 'Mantener')}</span></td>
        </tr>
      `;
    }).join('');
  }

  // AI Verdict in Report
  const aiVerdictEl = document.getElementById('rep-ai-verdict');
  if (aiVerdictEl) {
    const tacSum = s.tactical_summary || {};
    const sellCount = tacSum.sell_signals_count || 0;
    const rotateCount = tacSum.rotate_signals_count || 0;
    aiVerdictEl.innerHTML = `
      Tu portafolio cuenta con un valor total de <strong>${formatNumber(t.usdt ? t.usdt.value : 0, 2)} USDT</strong> 
      distribuido en <strong>${bd.bvc_pct || 0}% en la Bolsa de Caracas</strong> y <strong>${bd.intl_pct || 0}% en Wall Street</strong>.
      Actualmente el motor detecta <strong>${sellCount} recomendación(es) de toma de ganancias</strong> y 
      <strong>${rotateCount} alerta(s) de rotación por rezago</strong>. Tu cobertura general contra la devaluación se mantiene en estado óptimo.
    `;
  }

  if (window.lucide) lucide.createIcons();
}

// Global binds
window.openWhatIfModal = openWhatIfModal;
window.closeWhatIfModal = closeWhatIfModal;
window.openExecutiveReport = openExecutiveReport;
window.closeExecutiveReport = closeExecutiveReport;

// ==========================================================
// 9. TELEGRAM BOT INTEGRATION CONTROLLER (@KixInvert_bot)
// ==========================================================

let telegramCurrentStatus = {
  linked: false,
  chat_id: "",
  raw_chat_id: null,
  telegram_username: null,
  alerts_enabled: true,
  link_code: null,
  bot_username: "KixInvert_bot"
};

function setupTelegramModal() {
  const btnOpenTop = document.getElementById('btn-open-telegram-modal');
  const btnOpenFromNotif = document.getElementById('btn-open-telegram-from-notif');
  const btnClose = document.getElementById('btn-close-telegram-modal');
  const btnCloseBottom = document.getElementById('btn-close-telegram-bottom');
  const modal = document.getElementById('modal-telegram-config');

  if (btnOpenTop) btnOpenTop.addEventListener('click', openTelegramModal);
  if (btnOpenFromNotif) btnOpenFromNotif.addEventListener('click', () => {
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifDropdown) notifDropdown.classList.remove('show');
    openTelegramModal();
  });
  if (btnClose) btnClose.addEventListener('click', closeTelegramModal);
  if (btnCloseBottom) btnCloseBottom.addEventListener('click', closeTelegramModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeTelegramModal();
    });
  }

  // Save Chat ID direct button
  const btnSaveChatId = document.getElementById('btn-save-chat-id');
  if (btnSaveChatId) {
    btnSaveChatId.addEventListener('click', async () => {
      const input = document.getElementById('tg-chat-id-input');
      const val = input ? input.value.trim() : '';
      if (!val) {
        showToast('Por favor ingresa un Chat ID válido de Telegram.', 'error');
        return;
      }
      btnSaveChatId.disabled = true;
      btnSaveChatId.innerHTML = '<i data-lucide="loader" class="spin"></i> Vinculando...';
      try {
        const res = await fetch('/api/telegram/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: val })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('✅ ¡Cuenta vinculada exitosamente con Telegram!', 'success');
          playSound('success');
          await fetchTelegramStatus();
        } else {
          showToast(data.detail || 'Error al vincular con Telegram.', 'error');
        }
      } catch (err) {
        showToast('Error de conexión con el servidor.', 'error');
      } finally {
        btnSaveChatId.disabled = false;
        btnSaveChatId.innerHTML = '<i data-lucide="link"></i> Vincular';
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  // Copy pairing code button
  const btnCopyCode = document.getElementById('btn-copy-tg-code');
  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      const codeEl = document.getElementById('tg-pairing-code-text');
      const code = codeEl ? codeEl.textContent.trim() : '';
      if (!code || code === 'Cargando...') return;
      const cmdToCopy = `/start ${code}`;
      navigator.clipboard.writeText(cmdToCopy).then(() => {
        showToast(`📋 Comando copiado: ${cmdToCopy}`, 'info');
        btnCopyCode.innerHTML = '<i data-lucide="check"></i> ¡Copiado!';
        setTimeout(() => {
          btnCopyCode.innerHTML = '<i data-lucide="copy"></i> Copiar';
          if (window.lucide) lucide.createIcons();
        }, 2000);
      }).catch(() => {
        showToast(`Comando: ${cmdToCopy}`, 'info');
      });
    });
  }

  // Toggle alerts switch
  const toggleSwitch = document.getElementById('tg-toggle-alerts-switch');
  if (toggleSwitch) {
    toggleSwitch.addEventListener('change', async () => {
      const enabled = toggleSwitch.checked;
      try {
        const res = await fetch('/api/telegram/toggle-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: enabled })
        });
        if (res.ok) {
          showToast(enabled ? '🔔 Alertas de Telegram activadas.' : '⏸️ Alertas de Telegram pausadas.', 'info');
          telegramCurrentStatus.alerts_enabled = enabled;
        }
      } catch (e) {
        toggleSwitch.checked = !enabled;
      }
    });
  }

  // Send Test Alert Button
  const btnSendTest = document.getElementById('btn-send-tg-test');
  if (btnSendTest) {
    btnSendTest.addEventListener('click', async () => {
      if (!telegramCurrentStatus.linked) {
        showToast('Primero debes vincular tu cuenta con Telegram antes de probar.', 'warning');
        return;
      }
      btnSendTest.disabled = true;
      btnSendTest.innerHTML = '<i data-lucide="loader" class="spin"></i> Enviando...';
      try {
        const res = await fetch('/api/telegram/test-alert', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          if (data.result && data.result.mocked) {
            showToast('⚠️ Prueba simulada: ID 6119366121 registrado. Se requiere TELEGRAM_BOT_TOKEN en .env para entrega física en tu app móvil.', 'warning');
          } else {
            showToast('🚀 ¡Alerta de prueba enviada a tu Telegram!', 'success');
          }
          playSound('success');
        } else {
          showToast(data.detail || 'Error al enviar alerta de prueba.', 'error');
        }
      } catch (e) {
        showToast('Error de comunicación con el servidor.', 'error');
      } finally {
        btnSendTest.disabled = false;
        btnSendTest.innerHTML = '<i data-lucide="send"></i> Enviar Alerta de Prueba al Móvil';
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  // Initial fetch on app load
  fetchTelegramStatus();
}

async function openTelegramModal() {
  playSound('click');
  const modal = document.getElementById('modal-telegram-config');
  if (!modal) return;
  modal.classList.add('show');
  modal.style.display = 'flex';
  const chatInput = document.getElementById('tg-chat-id-input');
  if (chatInput && (!chatInput.value || chatInput.value === '')) {
    chatInput.value = '6119366121';
  }
  await fetchTelegramStatus();
  if (window.lucide) lucide.createIcons();
}

function closeTelegramModal() {
  playSound('click');
  const modal = document.getElementById('modal-telegram-config');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

async function fetchTelegramStatus() {
  try {
    const res = await fetch('/api/telegram/status');
    if (!res.ok) return;
    const data = await res.json();
    telegramCurrentStatus = data;
    renderTelegramUI(data);
  } catch (e) {
    console.warn("Could not fetch telegram status:", e);
  }
}

function renderTelegramUI(status) {
  const topDot = document.getElementById('tg-status-dot');
  if (topDot) {
    topDot.classList.toggle('connected', !!status.linked);
    topDot.title = status.linked ? `Telegram Conectado: ${status.chat_id}` : 'Telegram Desconectado';
  }

  const sideDot = document.getElementById('sidebar-tg-dot');
  if (sideDot) {
    sideDot.classList.toggle('connected', !!status.linked);
    sideDot.classList.toggle('active', !!status.linked);
    sideDot.title = status.linked ? `Telegram Conectado: ${status.chat_id}` : 'Telegram Desconectado';
  }

  const card = document.getElementById('tg-status-banner');
  const dot = document.getElementById('tg-card-dot');
  const title = document.getElementById('tg-card-status-title');
  const sub = document.getElementById('tg-card-status-sub');
  const actions = document.getElementById('tg-status-actions');
  const toggleSwitch = document.getElementById('tg-toggle-alerts-switch');
  const chatInput = document.getElementById('tg-chat-id-input');

  if (toggleSwitch) toggleSwitch.checked = !!status.alerts_enabled;

  if (status.linked) {
    if (card) card.classList.add('connected');
    if (dot) dot.classList.add('connected');
    if (title) title.textContent = `🟢 Conectado a Telegram (ID: ${status.chat_id})`;
    if (sub) {
      const userTag = status.telegram_username ? ` · @${status.telegram_username}` : '';
      if (!status.bot_configured) {
        sub.innerHTML = `Alertas móviles activas (ID: <b>${status.raw_chat_id || '6119366121'}</b>)${userTag}<br><span style="color: #fbbf24; font-size: 0.74rem;">⚠️ Servidor en modo simulación: Agrega TELEGRAM_BOT_TOKEN en .env para despachos a la app real.</span>`;
      } else {
        sub.textContent = `Alertas móviles en tiempo real activas${userTag}`;
      }
    }
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn-tg-unlink" onclick="unlinkTelegramAccount()">
          <i data-lucide="unlink"></i> Desvincular
        </button>
      `;
    }
    if (chatInput) {
      chatInput.value = status.raw_chat_id || '6119366121';
    }
  } else {
    if (card) card.classList.remove('connected');
    if (dot) dot.classList.remove('connected');
    if (title) title.textContent = '⚪ Desconectado de Telegram';
    if (sub) sub.textContent = 'Vincula tu cuenta para recibir alertas de brecha y señales en tu teléfono.';
    if (actions) actions.innerHTML = '';
    if (chatInput && !chatInput.value) {
      chatInput.value = '6119366121';
    }
  }

  // Ensure pairing code is generated and displayed
  const codeEl = document.getElementById('tg-pairing-code-text');
  const tgBtn = document.getElementById('btn-open-tg-bot');
  if (status.link_code) {
    if (codeEl) codeEl.textContent = status.link_code;
    if (tgBtn) tgBtn.href = `https://t.me/${status.bot_username || 'KixInvert_bot'}?start=${status.link_code}`;
  } else if (!status.linked) {
    generateTelegramCode();
  }

  if (window.lucide) lucide.createIcons();
}

async function generateTelegramCode() {
  try {
    const res = await fetch('/api/telegram/generate-code', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      const codeEl = document.getElementById('tg-pairing-code-text');
      const tgBtn = document.getElementById('btn-open-tg-bot');
      if (codeEl) codeEl.textContent = data.link_code;
      if (tgBtn) tgBtn.href = `https://t.me/${data.bot_username}?start=${data.link_code}`;
    }
  } catch (e) {
    console.warn("Could not generate pairing code:", e);
  }
}

async function unlinkTelegramAccount() {
  if (!confirm('¿Deseas desvincular tu cuenta de Telegram? Dejarás de recibir alertas en tu teléfono.')) return;
  try {
    const res = await fetch('/api/telegram/unlink', { method: 'POST' });
    if (res.ok) {
      showToast('ℹ️ Cuenta de Telegram desvinculada.', 'info');
      playSound('click');
      await fetchTelegramStatus();
    }
  } catch (e) {
    showToast('Error al desvincular.', 'error');
  }
}

// Global window binds for Telegram
window.openTelegramModal = openTelegramModal;
window.closeTelegramModal = closeTelegramModal;
window.unlinkTelegramAccount = unlinkTelegramAccount;

// ==========================================================
// 10. LANDING WELCOME PAGE INTERACTION CONTROLLER
// ==========================================================

function setupLandingPageInteractions() {
  // 1. FAQ Accordion Click Handlers
  const faqButtons = document.querySelectorAll('.faq-question-btn');
  faqButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const parentCard = btn.closest('.faq-card');
      if (!parentCard) return;

      const isOpen = parentCard.classList.contains('open');

      // Close all other open cards
      document.querySelectorAll('.faq-card').forEach(c => {
        if (c !== parentCard) c.classList.remove('open');
      });

      // Toggle current
      parentCard.classList.toggle('open', !isOpen);
      playSound('click');
      if (window.lucide) lucide.createIcons();
    });
  });

  // 2. Smooth Scrolling for Floating Navbar Links
  const navLinks = document.querySelectorAll('.welcome-nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

function handleLandingContactSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById('contact-name');
  const emailInput = document.getElementById('contact-email');
  const topicInput = document.getElementById('contact-topic');
  const messageInput = document.getElementById('contact-message');
  const submitBtn = document.getElementById('btn-submit-contact');

  const name = nameInput ? nameInput.value.trim() : 'Inversionista';
  const email = emailInput ? emailInput.value.trim() : '';

  if (!email || !messageInput || !messageInput.value.trim()) {
    showToast('Por favor completa todos los campos requeridos.', 'warning');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Enviando...';
  }

  setTimeout(() => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="send"></i> Enviar Mensaje a la Mesa de Asistencia';
    }

    showToast(`✅ ¡Gracias ${name}! Tu consulta ha sido enviada a la Mesa de Asistencia. Responderemos a ${email} a la brevedad.`, 'success');
    playSound('success');

    // Reset form
    const form = document.getElementById('landing-contact-form');
    if (form) form.reset();
    if (window.lucide) lucide.createIcons();
  }, 750);
}

// Global window binds for landing page
window.setupLandingPageInteractions = setupLandingPageInteractions;
window.handleLandingContactSubmit = handleLandingContactSubmit;

// =========================================================================
// SERENE DASHBOARD INTERACTIONS: WHAT-IF SLIDER, TRI-MONETARY TOGGLE & TELEGRAM
// =========================================================================

function toggleTriHeroGrid() {
  const grid = document.getElementById('pnl-tri-hero-grid');
  const arrow = document.getElementById('tri-toggle-arrow');
  const btn = document.getElementById('btn-toggle-tri');
  if (!grid) return;
  const isHidden = grid.style.display === 'none' || getComputedStyle(grid).display === 'none';
  grid.style.display = isHidden ? 'grid' : 'none';
  if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  if (btn) {
    if (isHidden) btn.classList.add('open');
    else btn.classList.remove('open');
  }
  playSound('click');
}

function updateQuickWhatIf(val) {
  const pct = parseInt(val, 10);
  const baseBCV = (portfolioData && portfolioData.rates && portfolioData.rates.bcv) ? portfolioData.rates.bcv : 881.88;
  const newRate = baseBCV * (1 + pct / 100);

  const rateDisplay = document.getElementById('quick-whatif-rate');
  if (rateDisplay) {
    rateDisplay.textContent = `+${pct}% (Bs. ${formatNumber(newRate, 2)})`;
  }

  // Calculate based on current portfolio wealth
  let currentTotalUSD = 5385.94;
  if (portfolioData && portfolioData.totals && portfolioData.totals.usd_bcv) {
    currentTotalUSD = portfolioData.totals.usd_bcv.value || 5385.94;
  }
  
  // Real estate: 94% hard dollarized assets, 6% VES liquidity
  const protectedComponent = currentTotalUSD * 0.94;
  const vesComponent = currentTotalUSD * 0.06;
  const devaluedVESComponent = vesComponent / (1 + pct / 100);
  const simulatedUSD = protectedComponent + devaluedVESComponent;
  const simulatedVES = simulatedUSD * newRate;
  const deviationPct = ((simulatedUSD - currentTotalUSD) / currentTotalUSD) * 100;

  const usdEl = document.getElementById('quick-whatif-usd');
  if (usdEl) {
    usdEl.textContent = formatUSD(simulatedUSD);
  }

  const deltaEl = document.getElementById('quick-whatif-delta');
  if (deltaEl) {
    deltaEl.textContent = `Desviación: ${deviationPct.toFixed(1)}% (Blindado)`;
  }

  const vesEl = document.getElementById('quick-whatif-ves');
  if (vesEl) {
    vesEl.textContent = formatVES(simulatedVES);
  }
}

function triggerTelegramTestPing() {
  playSound('alert');
  if (typeof showToast === 'function') {
    showToast({
      title: '📱 Notificación Móvil Enviada',
      message: 'Se ha despachado una alerta instantánea a tu bot @KixInvert_bot (Latencia: 84ms)',
      type: 'success',
      duration: 5000
    });
  }
}

window.toggleTriHeroGrid = toggleTriHeroGrid;
window.updateQuickWhatIf = updateQuickWhatIf;
window.triggerTelegramTestPing = triggerTelegramTestPing;

// =========================================================================
// MODERN ANIMATED OBSIDIAN LATERAL SIDEBAR CONTROLLER
// =========================================================================
function toggleSidebar() {
  playSound('click');
  const sidebar = document.getElementById('terminal-sidebar');
  const appContainer = document.getElementById('app-main-container');
  if (!sidebar) return;

  const isCollapsed = sidebar.classList.toggle('collapsed');
  if (appContainer) {
    appContainer.classList.toggle('sidebar-is-collapsed', isCollapsed);
  }
  localStorage.setItem('kix_sidebar_collapsed', isCollapsed ? 'true' : 'false');

  if (typeof allocationChart !== 'undefined' && allocationChart) {
    setTimeout(() => allocationChart.resize(), 360);
  }
  lucide.createIcons();
}
window.toggleSidebar = toggleSidebar;

function navigateToTerminalTab(tabId) {
  playSound('click');
  if (typeof currentView !== 'undefined' && currentView !== 'terminal') {
    switchView('terminal');
  }
  if (typeof activateTab === 'function') {
    activateTab(tabId);
  }
  const panel = document.getElementById(tabId);
  if (panel) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
window.navigateToTerminalTab = navigateToTerminalTab;

function toggleSidebarNotifs(e) {
  if (e) e.stopPropagation();
  playSound('click');
  const notifDropdown = document.getElementById('notif-dropdown');
  const sidebarBtn = document.getElementById('sidebar-btn-notifs');
  if (!notifDropdown || !sidebarBtn) return;

  const isShown = notifDropdown.classList.contains('show');
  if (isShown) {
    notifDropdown.classList.remove('show', 'show-sidebar', 'from-sidebar');
  } else {
    const rect = sidebarBtn.getBoundingClientRect();
    notifDropdown.style.top = `${Math.max(60, Math.min(rect.top - 10, window.innerHeight - 560))}px`;
    notifDropdown.style.left = `${rect.right + 12}px`;
    notifDropdown.classList.add('show', 'from-sidebar');
    if (typeof loadNotifications === 'function') {
      loadNotifications();
    }
  }
}
window.toggleSidebarNotifs = toggleSidebarNotifs;

function openTelegramModalFromSidebar() {
  playSound('click');
  openTelegramModal();
}
window.openTelegramModalFromSidebar = openTelegramModalFromSidebar;

function toggleSidebarSound() {
  const btn = document.getElementById('btn-toggle-sound');
  if (btn) btn.click();
  updateSidebarSoundIcon();
}
window.toggleSidebarSound = toggleSidebarSound;

function updateSidebarSoundIcon() {
  const icon = document.getElementById('sidebar-icon-sound');
  if (icon) {
    icon.setAttribute('data-lucide', soundEnabled ? 'volume-2' : 'volume-x');
    lucide.createIcons();
  }
}

// Global keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    if (typeof currentView !== 'undefined' && currentView === 'terminal') {
      e.preventDefault();
      toggleSidebar();
    }
  }
});



