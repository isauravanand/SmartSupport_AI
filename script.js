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
// In production or local server, relative path '' works automatically on any domain or port.
// Falls back to http://localhost:5000 only if opened via file:// protocol.
const API_BASE_URL = window.location.protocol.startsWith('http')
  ? ''
  : (window.SMARTSUPPORT_API_URL || 'http://localhost:5000');

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

  let innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div>`;

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
