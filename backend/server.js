/**
 * Smart Customer Support & Voice Agent - Minimal Backend Server
 * Powered by Node.js, Express, Google Gemini API & Bolna.ai Voice Agent
 */

const path = require('path');
// Load environment variables from backend/.env or root .env
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const Groq = require('groq-sdk');
const {
  businessConfig,
  getKnowledgeContextText,
  loadKnowledgePlainText,
  getBolnaVoicePrompt,
  getBolnaHinglishVoicePrompt
} = require('./businessConfig');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files (index.html, style.css, script.js from root directory)
app.use(express.static(path.join(__dirname, '..')));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

/* ==========================================================================
   1. Health Check Endpoint
   ========================================================================== */
app.get('/api/health', (req, res) => {
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY && 
    process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' && 
    process.env.GEMINI_API_KEY.trim() !== ''
  );

  const groqConfigured = Boolean(
    process.env.GROQ_API_KEY && 
    process.env.GROQ_API_KEY !== 'your_groq_api_key_here' && 
    process.env.GROQ_API_KEY.trim() !== ''
  );

  const bolnaConfigured = Boolean(
    process.env.BOLNA_API_KEY && 
    process.env.BOLNA_API_KEY !== 'your_bolna_api_key_here' && 
    process.env.BOLNA_API_KEY.trim() !== ''
  );

  res.status(200).json({
    status: 'online',
    application: `${businessConfig.businessName} Customer Support & Voice Agent`,
    aiProviders: {
      primary: {
        provider: 'Google Gemini',
        configured: geminiConfigured,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        role: 'Primary intelligence engine'
      },
      fallback: {
        provider: 'Groq',
        configured: groqConfigured,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        role: 'High rate-limit fallback on quota exhaustion'
      }
    },
    bolna: {
      configured: bolnaConfigured,
      agentId: process.env.BOLNA_AGENT_ID || 'Not set',
      supportPhoneNumber: businessConfig.supportPhone
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/* ==========================================================================
   2. Business Public Configuration Endpoint
   ========================================================================== */
app.get('/api/config', (req, res) => {
  // Returns public business details for frontend display without leaking private API keys
  res.status(200).json({
    success: true,
    data: {
      businessName: businessConfig.businessName,
      tagline: businessConfig.tagline,
      supportPhone: businessConfig.supportPhone,
      supportEmail: businessConfig.supportEmail,
      website: businessConfig.website,
      address: businessConfig.address,
      businessHours: businessConfig.businessHours,
      suggestedQuestions: businessConfig.suggestedQuestions,
      bolnaVoiceEnabled: Boolean(process.env.BOLNA_AGENT_ID && process.env.BOLNA_AGENT_ID !== 'your_bolna_agent_id_here')
    }
  });
});

/* ==========================================================================
   2b. Shared Business Knowledge Base Endpoint (Plain Text for Bolna & Docs)
   ========================================================================== */
app.get('/knowledge/business', (req, res) => {
  const plainText = loadKnowledgePlainText();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(plainText);
});

app.get('/api/knowledge/business', (req, res) => {
  const plainText = loadKnowledgePlainText();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(plainText);
});

/* ==========================================================================
   3. Dual-Engine AI Chatbot (Gemini Primary + Groq Fallback)
   ========================================================================== */

/**
 * Call Primary Provider: Google Gemini (with 4.5-second fail-fast timeout)
 */
async function generateWithGemini(contents, systemInstruction) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || !apiKey.trim()) {
    const err = new Error('GEMINI_KEY_NOT_CONFIGURED');
    err.code = 'GEMINI_KEY_NOT_CONFIGURED';
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  // 3.5 second fail-fast timeout so user never waits when Gemini queues up
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('GEMINI_TIMEOUT: Gemini took longer than 3.5s to respond.')), 3500)
  );

  const apiPromise = ai.models.generateContent({
    model: modelName,
    contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json'
    }
  });

  const response = await Promise.race([apiPromise, timeoutPromise]);

  return {
    rawText: response.text || '',
    model: modelName,
    provider: 'gemini'
  };
}

/**
 * Call Fallback Provider: Groq (Ultra-high rate limits)
 */
async function generateWithGroq(messages, systemInstruction) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here' || !apiKey.trim()) {
    const err = new Error('GROQ_KEY_NOT_CONFIGURED');
    err.code = 'GROQ_KEY_NOT_CONFIGURED';
    throw err;
  }

  const groq = new Groq({ apiKey: apiKey.trim() });
  const modelName = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const fullMessages = [
    { role: 'system', content: systemInstruction },
    ...messages
  ];

  const chatCompletion = await groq.chat.completions.create({
    messages: fullMessages,
    model: modelName,
    response_format: { type: 'json_object' },
    temperature: 0.3
  });

  const rawText = chatCompletion.choices?.[0]?.message?.content || '';
  return {
    rawText,
    model: modelName,
    provider: 'groq'
  };
}

app.post('/api/chat', async (req, res, next) => {
  try {
    const { message, history } = req.body;

    // Validate request
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'A non-empty customer message string is required.'
      });
    }

    const customerQuery = message.trim();

    // Check availability of provider keys
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY && 
      process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' && 
      process.env.GEMINI_API_KEY.trim() !== ''
    );

    const hasGroqKey = Boolean(
      process.env.GROQ_API_KEY && 
      process.env.GROQ_API_KEY !== 'your_groq_api_key_here' && 
      process.env.GROQ_API_KEY.trim() !== ''
    );

    if (!hasGeminiKey && !hasGroqKey) {
      return res.status(503).json({
        success: false,
        error: 'AI_KEYS_NOT_CONFIGURED',
        message: 'No AI provider key configured. Please set GEMINI_API_KEY (primary) or GROQ_API_KEY (fallback) in backend/.env.'
      });
    }

    // Construct grounded system instructions using the Business Knowledge Context
    const knowledgeContext = getKnowledgeContextText();
    const systemInstruction = `You are a professional, friendly, and helpful customer support representative for ${businessConfig.businessName}.

AUTHORITATIVE BUSINESS KNOWLEDGE BASE:
${knowledgeContext}

STRICT OPERATIONAL GUIDELINES:
1. Answer customer questions regarding products, sizing, prices, delivery, returns, exchanges, business hours, and store policies accurately and clearly using ONLY the supplied business information.
2. Groundedness Rule: NEVER invent product availability, prices, or policies not present in the knowledge base.
3. Missing Information Rule: If information is missing, not explicitly covered, or requires personal order tracking/verification, politely state that it needs confirmation from the team and suggest contacting support at ${businessConfig.supportPhone} or ${businessConfig.supportEmail}.
4. Understand natural language and maintain conversation context from earlier turns in the conversation.
5. If the customer has an urgent issue, requires phone assistance, or wishes to speak with a human or voice agent, suggest calling ${businessConfig.supportPhone} and set "suggestPhoneCall" to true.
6. Maintain a polite, empathetic, and professional customer care tone at all times.
7. FORMATTING & READABILITY (CRITICAL):
   - Always structure your answers with clean Markdown spacing:
   - Use distinct paragraphs separated by double newlines (\n\n).
   - Use bullet points (- item) for lists, specifications, or timelines.
   - Use bold (**keyword**) for key names, delivery days, and prices.
   - Never output a squished single-paragraph wall of text.

You MUST reply with a valid JSON object matching this structure:
{
  "reply": "Your clear, helpful, customer support response here.",
  "suggestPhoneCall": false
}`;

    // Format conversation history for Gemini (contents: [{ role, parts }])
    const geminiContents = [];
    // Format conversation history for Groq/OpenAI (messages: [{ role, content }])
    const groqMessages = [];

    if (Array.isArray(history)) {
      for (const turn of history) {
        if (!turn || !turn.text || typeof turn.text !== 'string') continue;
        const geminiRole = (turn.sender === 'user' || turn.role === 'user') ? 'user' : 'model';
        const groqRole = (turn.sender === 'user' || turn.role === 'user') ? 'user' : 'assistant';
        
        geminiContents.push({
          role: geminiRole,
          parts: [{ text: turn.text.trim() }]
        });

        groqMessages.push({
          role: groqRole,
          content: turn.text.trim()
        });
      }
    }

    // Add current user prompt
    geminiContents.push({
      role: 'user',
      parts: [{ text: customerQuery }]
    });

    groqMessages.push({
      role: 'user',
      content: customerQuery
    });

    let aiResult = null;
    let fallbackTriggered = false;
    let geminiErrorReason = null;

    // 1. Attempt Primary: Gemini
    if (hasGeminiKey) {
      try {
        aiResult = await generateWithGemini(geminiContents, systemInstruction);
      } catch (geminiError) {
        geminiErrorReason = geminiError.message || 'Gemini service error';
        console.warn(`[AI Primary Warning] Gemini error or rate limit hit: ${geminiErrorReason}`);

        // If Groq is configured, trigger automatic fallback!
        if (hasGroqKey) {
          console.log('[AI Fallback] Routing request to Groq (Llama-3.3-70b) due to Gemini limit/error...');
          try {
            aiResult = await generateWithGroq(groqMessages, systemInstruction);
            fallbackTriggered = true;
          } catch (groqError) {
            console.error('[AI Fallback Error] Groq also failed:', groqError);
            return res.status(502).json({
              success: false,
              error: 'ALL_PROVIDERS_FAILED',
              message: `Primary (Gemini) failed: ${geminiErrorReason}. Fallback (Groq) also failed: ${groqError.message}`
            });
          }
        } else {
          return res.status(502).json({
            success: false,
            error: 'GEMINI_API_ERROR',
            message: `Gemini API error: ${geminiErrorReason}. Add GROQ_API_KEY in backend/.env to enable automatic high-limit fallback.`
          });
        }
      }
    } else {
      // Direct Groq if Gemini key is omitted
      console.log('[AI Direct Routing] Routing directly to Groq...');
      try {
        aiResult = await generateWithGroq(groqMessages, systemInstruction);
        fallbackTriggered = true;
      } catch (groqError) {
        console.error('[AI Groq Error]', groqError);
        return res.status(502).json({
          success: false,
          error: 'GROQ_API_ERROR',
          message: `Groq API error: ${groqError.message}`
        });
      }
    }

    // Parse JSON reply
    let parsedData = {};
    const rawText = aiResult.rawText || '';
    try {
      const cleanJson = rawText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      parsedData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.warn(`[${aiResult.provider} Parse Notice] Falling back to text wrapper:`, rawText);
      parsedData = {
        reply: rawText || 'Thank you for your question. How else can I assist you?',
        suggestPhoneCall: false
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        reply: parsedData.reply || 'Thank you for contacting UrbanThread. How may I help you today?',
        suggestPhoneCall: Boolean(parsedData.suggestPhoneCall),
        supportPhone: businessConfig.supportPhone,
        provider: aiResult.provider,
        model: aiResult.model,
        fallbackTriggered
      }
    });

  } catch (err) {
    next(err);
  }
});

/* ==========================================================================
   4. Bolna.ai Voice Agent Integration
   ========================================================================== */

/**
 * Returns the customized, spoken prompt for Bolna.ai voice agent
 * Copy and paste this prompt directly into your Bolna Agent Studio -> Inbound Call prompt.
 */
app.get('/api/bolna/prompt', (req, res) => {
  res.status(200).json({
    success: true,
    agentName: `${businessConfig.businessName} Inbound Agent`,
    agentId: process.env.BOLNA_AGENT_ID || 'Not configured',
    supportPhone: businessConfig.supportPhone,
    recommendedForIndia: 'bolnaHinglishVoicePrompt',
    bolnaHinglishVoicePrompt: getBolnaHinglishVoicePrompt(),
    bolnaEnglishVoicePrompt: getBolnaVoicePrompt(),
    bolnaVoicePrompt: getBolnaHinglishVoicePrompt(), // Default to Hinglish for Indian callers
    setupInstructions: {
      step1: 'In Bolna Agent Studio, open your Agent.',
      step2: 'Under Speech-to-Text (ASR), select "Bolna ASR" or "Deepgram Nova-2" with Hindi/English / Hinglish language.',
      step3: 'Under Text-to-Speech (TTS), select an Indian accent voice (e.g. ElevenLabs Indian English / Hindi, Azure, or Sarvam AI).',
      step4: 'Copy and paste bolnaHinglishVoicePrompt into the System Prompt box in Bolna.',
      step5: 'Go to Calling -> Inbound Calling, toggle on Inbound, and assign your business phone number.'
    }
  });
});

/**
 * Bolna.ai Webhook Endpoint
 * Receives real-time call events, status transitions, and post-call transcripts from Bolna.ai
 */
app.post('/api/bolna/webhook', (req, res) => {
  const event = req.body || {};
  const callId = event.call_id || event.id || event.execution_id || 'Unknown';
  const status = event.status || event.call_status || 'received';
  const contact = event.contact_number || event.caller_id || 'Private';

  console.log(`[Bolna Webhook] Call ID: ${callId} | Status: ${status} | Caller: ${contact}`);

  // If Bolna post-call extraction or transcript is present
  if (event.transcript) {
    console.log(`[Bolna Call Transcript] Call ID: ${callId} -> Transcript length: ${event.transcript.length} chars`);
  }

  // Acknowledge receipt to Bolna server immediately
  return res.status(200).json({
    success: true,
    received: true,
    callId,
    timestamp: new Date().toISOString()
  });
});

/* ==========================================================================
   5. Fallback 404 & Global Error Handling
   ========================================================================== */
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.method} ${req.originalUrl}' not found.`
  });
});

app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected server error occurred.'
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`${businessConfig.businessName} Customer Support & Voice Agent`);
  console.log(`Web App & API running at: http://localhost:${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`Configured Support Phone: ${businessConfig.supportPhone}`);
  console.log('====================================================');
});

module.exports = { app, server };
