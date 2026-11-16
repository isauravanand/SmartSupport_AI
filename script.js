/**
 * URBANTHREAD — Streetwear E-Commerce & AI Concierge / Voice Agent
 * Pure Vanilla JavaScript (No Frameworks)
 * 
 * Features:
 * - Floating Bottom-Right Dock for Gemini AI Chatbot & Bolna.ai Voice Support
 * - Full multi-turn Gemini AI chat with context retention via POST /api/chat
 * - LocalStorage conversation persistence & clear chat capability
 * - Dynamic /api/config business data synchronization
 * - Product filtering & size selection
 * - Interactive Shopping Bag counter & toast notifications
 */

// Storage & API Configuration
const STORAGE_KEY = 'urbanthread_chat_history_v3';

/**
 * Smart API Base URL resolver:
 * - If running on a static dev server (like VS Code Live Server on port 5500/5501/3000/8080) or file://,
 *   redirects API requests to the active Node.js backend at http://localhost:5000.
 * - If served directly by the Express backend (localhost:5000) or deployed to production cloud (Render, Railway, etc.),
 *   uses relative path '' so it works on any domain or port seamlessly.
 */
function getApiBaseUrl() {
  if (window.SMARTSUPPORT_API_URL) return window.SMARTSUPPORT_API_URL;
  const port = window.location.port;
  const isStaticDevServer = port === '5500' || port === '5501' || port === '3000' || port === '8080';
  const isLocalFile = !window.location.protocol.startsWith('http');

  if (isStaticDevServer || isLocalFile) {
    return 'http://localhost:5000';
  }

  return '';
}

const API_BASE_URL = getApiBaseUrl();

// Global State
let conversationHistory = []; // Array of { role: 'user' | 'model', text: string, timestamp: string, suggestPhoneCall?: boolean }
let isSubmitting = false;
let configuredPhone = '+91 (800) 555-8722';
let bagCount = 0;

// DOM Elements - Floating Widgets & Modals
const dockChatTrigger = document.getElementById('dockChatTrigger');
const dockVoiceTrigger = document.getElementById('dockVoiceTrigger');
const navVoiceBtn = document.getElementById('navVoiceBtn');
const heroChatTrigger = document.getElementById('heroChatTrigger');
const chatWidgetPanel = document.getElementById('chatWidgetPanel');
const closeChatBtn = document.getElementById('closeChatBtn');
const openBolnaFromChatBtn = document.getElementById('openBolnaFromChatBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const bolnaModalOverlay = document.getElementById('bolnaModalOverlay');
const closeBolnaModal = document.getElementById('closeBolnaModal');
const switchToChatBtn = document.getElementById('switchToChatBtn');
const bolnaCallActionBtn = document.getElementById('bolnaCallActionBtn');
const bolnaPhoneDisplay = document.getElementById('bolnaPhoneDisplay');
const footerPhoneDisplay = document.getElementById('footerPhoneDisplay');

// DOM Elements - Mobile Navigation Drawer
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileNavDrawer = document.getElementById('mobileNavDrawer');
const menuOpenIcon = document.getElementById('menuOpenIcon');
const menuCloseIcon = document.getElementById('menuCloseIcon');
const drawerVoiceBtn = document.getElementById('drawerVoiceBtn');
const drawerChatBtn = document.getElementById('drawerChatBtn');

// DOM Elements - Chat Stream & Input
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const suggestedPromptsBar = document.getElementById('suggestedPromptsBar');

// DOM Elements - E-Commerce
const bagCountElement = document.getElementById('bagCount');
const toastNotification = document.getElementById('toastNotification');
const toastText = document.getElementById('toastText');
const filterPills = document.querySelectorAll('.filter-pill');
const productCards = document.querySelectorAll('.product-card');

/**
 * Format current time in 12-hour format
 */
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Escape HTML to prevent injection
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format markdown and structured text for assistant messages
 */
function formatChatMessage(rawText) {
  if (!rawText) return '';
  let text = escapeHtml(rawText);
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Break squished headers and list bullets when the LLM outputs single-line text
  text = text.replace(/([:.!?])\s*(\*\*[A-Z][^*]+?\*\*\s*[:-]?\s*)/g, '$1\n\n$2\n');
  text = text.replace(/\s+(\*\*[A-Z][^*]+?\*\*\s*-\s*)/g, '\n\n$1\n');
  text = text.replace(/([^\n])\s+-\s+(?!\d)/g, '$1\n- ');
  text = text.replace(/([^\n])\s*[•●]\s*/g, '$1\n• ');
  text = text.replace(/([.!?])\s+(If you have any|Let me know|Feel free|Have any other|Please let me know|Hope this helps)/gi, '$1\n\n$2');

  const lines = text.split('\n');
  const blocks = [];
  let currentList = null;
  let currentParagraph = [];

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      const pText = currentParagraph.join('<br>').trim();
      if (pText) blocks.push(`<p>${pText}</p>`);
      currentParagraph = [];
    }
  }

  function flushList() {
    if (currentList) {
      const itemsHtml = currentList.items.map(item => {
        const textContent = typeof item === 'object' ? item.text : item;
        const cls = (typeof item === 'object' && item.isSubItem) ? ' class="msg-sub-item"' : '';
        return `<li${cls}>${textContent}</li>`;
      }).join('');
      blocks.push(`<${currentList.type} class="msg-list">${itemsHtml}</${currentList.type}>`);
      currentList = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      flushParagraph();
      flushList();
      continue;
    }

    // Markdown Heading: ### Title
    const headingMatch = rawLine.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push(`<h4 class="msg-heading">${headingMatch[1]}</h4>`);
      continue;
    }

    // Bold section titles: **Delivery timeline:** or **Shipping charges**
    const boldHeaderMatch = rawLine.match(/^\*\*([^*]+)\*\*:?$/);
    if (boldHeaderMatch) {
      flushParagraph();
      flushList();
      blocks.push(`<div class="msg-section-header"><strong>${boldHeaderMatch[1]}</strong></div>`);
      continue;
    }

    // Check for unordered list item: - item, * item, • item
    const isSubItem = /^\s{2,}[-*•]/.test(lines[i]);
    const ulMatch = rawLine.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push({ text: ulMatch[1], isSubItem });
      continue;
    }

    // Check for ordered list item: 1. Item, 2. Item
    const olMatch = rawLine.match(/^(\d+)[.)]\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push({ text: olMatch[2], isSubItem: false });
      continue;
    }

    // Plain paragraph text line
    flushList();
    currentParagraph.push(rawLine);
  }

  flushParagraph();
  flushList();

  let formatted = blocks.join('');

  // Inline styling:
  // Bold: **text** or __text__
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong class="msg-bold">$1</strong>');
  formatted = formatted.replace(/__(.+?)__/g, '<strong class="msg-bold">$1</strong>');

  // Italic: *text* or _text_
  formatted = formatted.replace(/(^|[^\*])\*([^\*]+?)\*([^\*]|$)/g, '$1<em>$2</em>$3');
  formatted = formatted.replace(/(^|[^_])_([^_]+?)_([^_]|$)/g, '$1<em>$2</em>$3');

  // Code snippets: `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="msg-code">$1</code>');

  // Markdown links: [text](url)
  formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="msg-link">$1</a>');

  // Price badge highlight: ₹999 or ₹ 79
  formatted = formatted.replace(/(₹\s?\d+(?:,\d+)*(?:\.\d+)?)/g, '<span class="msg-price">$1</span>');

  return formatted || escapeHtml(rawText);
}

/**
 * Show Toast Notification
 */
function showToast(message) {
  if (!toastNotification || !toastText) return;
  toastText.textContent = message;
  toastNotification.classList.add('active');
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toastNotification.classList.remove('active');
  }, 2800);
}

/**
 * Save history to browser localStorage
 */
function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationHistory));
  } catch (e) {
    console.warn('[Storage] Failed to save chat history:', e);
  }
}

/**
 * Load history from browser localStorage
 */
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        conversationHistory = parsed;
        return true;
      }
    }
  } catch (e) {
    console.warn('[Storage] Failed to load chat history:', e);
  }
  return false;
}

/**
 * Fetch business configuration from backend
 */
async function loadBusinessConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/config`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const result = await res.json();

    if (result && result.success && result.data) {
      const b = result.data;

      // Update phone links
      if (b.supportPhone) {
        configuredPhone = b.supportPhone;
        const cleanPhone = b.supportPhone.replace(/[^0-9+]/g, '');
        if (bolnaCallActionBtn) bolnaCallActionBtn.href = `tel:${cleanPhone}`;
        if (bolnaPhoneDisplay) bolnaPhoneDisplay.textContent = b.supportPhone;
        if (footerPhoneDisplay) {
          footerPhoneDisplay.href = `tel:${cleanPhone}`;
          footerPhoneDisplay.textContent = b.supportPhone;
        }
      }

      // Populate suggested prompts
      if (Array.isArray(b.suggestedQuestions) && b.suggestedQuestions.length > 0) {
        renderSuggestedPrompts(b.suggestedQuestions);
      }
    }
  } catch (err) {
    console.warn('[Config] Could not fetch /api/config. Using default store prompts.', err);
    renderDefaultSuggestedPrompts();
  }
}

/**
 * Render Suggested Prompts Bar
 */
function renderSuggestedPrompts(prompts) {
  if (!suggestedPromptsBar) return;
  suggestedPromptsBar.innerHTML = prompts.map(p => `
    <button type="button" class="prompt-chip-btn" data-prompt="${escapeHtml(p)}">
      ${escapeHtml(p)}
    </button>
  `).join('');

  suggestedPromptsBar.querySelectorAll('.prompt-chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.getAttribute('data-prompt');
      if (query) sendMessage(query);
    });
  });
}

function renderDefaultSuggestedPrompts() {
  renderSuggestedPrompts([
    'What are your delivery timelines and shipping charges?',
    'What is your return and refund policy?',
    'What are the price ranges for T-shirts, hoodies, and jeans?',
    'Do you offer Cash on Delivery (COD) and UPI payments?',
    'Can I exchange an item for a different size?'
  ]);
}

/**
 * Render Initial Welcome Banner inside Stream
 */
function renderWelcomeBanner() {
  if (!chatMessages) return;

  const welcomeDiv = document.createElement('div');
  welcomeDiv.className = 'chat-welcome-card';
  welcomeDiv.id = 'chatWelcomeCard';
  welcomeDiv.innerHTML = `
    <div class="welcome-brand-tag">URBANTHREAD CONCIERGE</div>
    <div class="welcome-title">Welcome to UrbanThread.</div>
    <p class="welcome-text">
      I'm your AI stylist &amp; customer care concierge powered by Google Gemini. 
      Ask me about 240 GSM T-shirt sizing, our 3–7 day delivery, 7-day return policy, or Cash on Delivery.
    </p>
  `;

  chatMessages.appendChild(welcomeDiv);
}

/**
 * Render Message Bubble
 */
function appendMessage(sender, text, timestamp = getCurrentTime(), suggestPhoneCall = false, isError = false) {
  if (!chatMessages) return;

  const msgRow = document.createElement('div');
  msgRow.className = `msg-row ${sender}`;

  const formattedContent = sender === 'model'
    ? formatChatMessage(text)
    : escapeHtml(text).replace(/\n/g, '<br>');

  const errorClass = isError ? ' is-error' : '';
  let innerHTML = `<div class="msg-bubble${errorClass}">${formattedContent}</div>`;

  // If the AI suggests calling phone support
  if (suggestPhoneCall) {
    const cleanPhone = configuredPhone.replace(/[^0-9+]/g, '');
    innerHTML += `
      <a href="tel:${cleanPhone}" class="chat-escalation-action">
        <i data-lucide="phone-call" style="width: 13px; height: 13px;"></i>
        <span>Call Voice Agent (${configuredPhone})</span>
      </a>
    `;
  }

  innerHTML += `<span class="msg-time">${escapeHtml(timestamp)}</span>`;
  msgRow.innerHTML = innerHTML;

  chatMessages.appendChild(msgRow);
  if (window.lucide) lucide.createIcons();

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Show / Hide Typing Indicator
 */
function showTypingIndicator() {
  removeTypingIndicator();
  if (!chatMessages) return;

  const typingDiv = document.createElement('div');
  typingDiv.className = 'msg-row model';
  typingDiv.id = 'chatTypingIndicator';
  typingDiv.innerHTML = `
    <div class="typing-bubble">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const existing = document.getElementById('chatTypingIndicator');
  if (existing) existing.remove();
}

/**
 * Send Message to Gemini API
 */
async function sendMessage(text) {
  if (!text || typeof text !== 'string' || !text.trim()) return;
  if (isSubmitting) return;

  const userQuery = text.trim();
  const timeNow = getCurrentTime();

  // 1. Add user message to UI
  appendMessage('user', userQuery, timeNow);

  // 2. Add to internal history
  conversationHistory.push({
    role: 'user',
    text: userQuery,
    timestamp: timeNow
  });
  saveHistory();

  // 3. Reset input
  if (chatInput) {
    chatInput.value = '';
    chatInput.focus();
  }

  // 4. Show typing state
  isSubmitting = true;
  if (sendBtn) sendBtn.disabled = true;
  showTypingIndicator();

  try {
    // Multi-turn context payload
    const payload = {
      message: userQuery,
      history: conversationHistory.slice(-8)
    };

    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    removeTypingIndicator();

    if (!res.ok) {
      let errorMsg = `Server returned status ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.message) errorMsg = errJson.message;
      } catch (e) {
        // use fallback
      }
      throw new Error(errorMsg);
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Invalid server response structure');
    }

    const reply = json.data.reply || 'Thank you for your question. How else may I assist you with your order?';
    const suggestCall = Boolean(json.data.suggestPhoneCall);
    const replyTime = getCurrentTime();

    // 5. Append AI message
    appendMessage('model', reply, replyTime, suggestCall);

    // 6. Save AI message
    conversationHistory.push({
      role: 'model',
      text: reply,
      timestamp: replyTime,
      suggestPhoneCall: suggestCall
    });
    saveHistory();

  } catch (err) {
    removeTypingIndicator();
    console.error('[Chat Error]', err);
    appendMessage(
      'model',
      `⚠️ ${err.message || 'Could not connect to AI service. Please verify server connection.'}`,
      getCurrentTime(),
      true,
      true
    );
  } finally {
    isSubmitting = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

/**
 * Clear Chat History
 */
function clearChat() {
  if (confirm('Clear your conversation history with UrbanThread Concierge?')) {
    conversationHistory = [];
    localStorage.removeItem(STORAGE_KEY);
    if (chatMessages) {
      chatMessages.innerHTML = '';
      renderWelcomeBanner();
    }
  }
}

/**
 * Open Chat Window with an explicit prompt
 */
window.openChatWithPrompt = function(promptText) {
  openChatPanel();
  if (promptText) {
    setTimeout(() => {
      sendMessage(promptText);
    }, 300);
  }
};

/**
 * Open / Close Floating Chat Panel
 */
function openChatPanel() {
  if (chatWidgetPanel) {
    chatWidgetPanel.classList.add('active');
    if (chatInput) chatInput.focus();
  }
  // Close voice modal if open
  closeVoiceModal();
}

function closeChatPanel() {
  if (chatWidgetPanel) {
    chatWidgetPanel.classList.remove('active');
  }
}

function toggleChatPanel() {
  if (chatWidgetPanel && chatWidgetPanel.classList.contains('active')) {
    closeChatPanel();
  } else {
    openChatPanel();
  }
}

/**
 * Open / Close Bolna Voice Modal
 */
function openVoiceModal() {
  if (bolnaModalOverlay) {
    bolnaModalOverlay.classList.add('active');
    bolnaModalOverlay.setAttribute('aria-hidden', 'false');
  }
}

function closeVoiceModal() {
  if (bolnaModalOverlay) {
    bolnaModalOverlay.classList.remove('active');
    bolnaModalOverlay.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Mobile Menu Drawer Triggers
  function toggleMobileMenu(forceState) {
    if (!mobileNavDrawer) return;
    const shouldOpen = forceState !== undefined ? forceState : !mobileNavDrawer.classList.contains('active');
    mobileNavDrawer.classList.toggle('active', shouldOpen);
    mobileNavDrawer.setAttribute('aria-hidden', !shouldOpen);
    if (mobileMenuToggle) {
      mobileMenuToggle.setAttribute('aria-expanded', shouldOpen);
    }
    if (menuOpenIcon) menuOpenIcon.style.display = shouldOpen ? 'none' : 'block';
    if (menuCloseIcon) menuCloseIcon.style.display = shouldOpen ? 'block' : 'none';
  }

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => toggleMobileMenu());
  }

  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => toggleMobileMenu(false));
  });

  if (drawerVoiceBtn) {
    drawerVoiceBtn.addEventListener('click', () => {
      toggleMobileMenu(false);
      openVoiceModal();
    });
  }

  if (drawerChatBtn) {
    drawerChatBtn.addEventListener('click', () => {
      toggleMobileMenu(false);
      openChatPanel();
    });
  }

  // Floating Widget Triggers
  if (dockChatTrigger) {
    dockChatTrigger.addEventListener('click', toggleChatPanel);
  }
  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', closeChatPanel);
  }
  if (heroChatTrigger) {
    heroChatTrigger.addEventListener('click', openChatPanel);
  }
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', clearChat);
  }

  // Voice Modal Triggers
  if (dockVoiceTrigger) {
    dockVoiceTrigger.addEventListener('click', openVoiceModal);
  }
  if (navVoiceBtn) {
    navVoiceBtn.addEventListener('click', openVoiceModal);
  }
  if (openBolnaFromChatBtn) {
    openBolnaFromChatBtn.addEventListener('click', openVoiceModal);
  }
  if (closeBolnaModal) {
    closeBolnaModal.addEventListener('click', closeVoiceModal);
  }
  if (switchToChatBtn) {
    switchToChatBtn.addEventListener('click', () => {
      closeVoiceModal();
      openChatPanel();
    });
  }
  if (bolnaModalOverlay) {
    bolnaModalOverlay.addEventListener('click', (e) => {
      if (e.target === bolnaModalOverlay) closeVoiceModal();
    });
  }

  // Chat Form Submission
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage(chatInput.value);
    });
  }

  // Product Category Filters
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filter = pill.getAttribute('data-filter');
      productCards.forEach(card => {
        const cat = card.getAttribute('data-category');
        if (filter === 'all' || cat === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Size Pills Toggling
  document.querySelectorAll('.size-pill').forEach(pill => {
    pill.addEventListener('click', function(e) {
      e.stopPropagation();
      const parentRow = this.closest('.size-pill-row');
      if (parentRow) {
        parentRow.querySelectorAll('.size-pill').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });

  // Quick Add to Bag
  document.querySelectorAll('.quick-add-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const title = this.getAttribute('data-title') || 'Item';
      bagCount += 1;
      if (bagCountElement) bagCountElement.textContent = bagCount;
      showToast(`Added "${title}" to your bag.`);
    });
  });

  // Bag Trigger Toast
  const bagBtn = document.getElementById('bagBtn');
  if (bagBtn) {
    bagBtn.addEventListener('click', () => {
      if (bagCount === 0) {
        showToast('Your bag is empty. Explore our 240 GSM collection!');
      } else {
        showToast(`You have ${bagCount} item(s) in your bag. Free shipping applies above ₹999.`);
      }
    });
  }

  // ESC key to close active overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeVoiceModal();
      closeChatPanel();
    }
  });
}

/**
 * Initialize Application
 */
async function init() {
  setupEventListeners();

  // Load config & suggested questions
  await loadBusinessConfig();

  // Initialize Chat Messages
  if (chatMessages) {
    chatMessages.innerHTML = '';
    const hasHistory = loadHistory();
    if (!hasHistory) {
      renderWelcomeBanner();
    } else {
      renderWelcomeBanner();
      conversationHistory.forEach(item => {
        appendMessage(
          item.role,
          item.text,
          item.timestamp,
          item.suggestPhoneCall
        );
      });
    }
  }

  // Lucide Icons Render
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
