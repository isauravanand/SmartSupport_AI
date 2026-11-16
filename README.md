# Smart Customer Support & Voice Agent — UrbanThread

A production-ready AI customer care platform built for **UrbanThread** (a contemporary online apparel and streetwear brand), enabling:

1. **An AI Website Chatbot** powered by Google Gemini (`@google/genai`) using an authoritative shared business knowledge base.
2. **An Automated AI Phone Support Agent** for inbound customer calls powered by **Bolna.ai**.

There is **no** database, admin panel, login, ticket management, or unnecessary complexity. All business intelligence is centralized in an easily editable knowledge base shared seamlessly across web chat and voice telephony.

---

## 1. Project Structure

```text
UrbanThreads/
├── index.html            # Customer-facing support webpage (UrbanThread branding)
├── style.css             # Minimal dark stylesheet (responsive desktop & mobile)
├── script.js             # Vanilla frontend JavaScript (LocalStorage, Gemini & Groq)
├── package.json          # Root scripts: npm start, npm run dev
├── .env                  # Active environment variables (API keys, support phone)
├── .env.example          # Environment variable template
├── .gitignore            # Git exclusions (prevents committing secrets and node_modules)
├── README.md             # Complete documentation and setup guide
│
└── backend/
    ├── server.js         # Production Express server (dual AI engine & Bolna endpoints)
    ├── businessConfig.js # Shared config loader & Bolna prompt generator
    ├── package.json      # Backend package specifications
    │
    └── knowledge/        # Authoritative store knowledge base
        ├── business-knowledge.md  # Detailed Markdown knowledge base (loaded by Gemini/Groq)
        └── business-knowledge.txt # Clean plain-text knowledge base (for Bolna upload & URL endpoint)
```

---

## 2. Shared Business Knowledge Base (UrbanThread)

The knowledge base is stored in two easily editable files:
- **Markdown format**: [`backend/knowledge/business-knowledge.md`](file:///c:/Users/saura/OneDrive/Desktop/BBA_WALI_PROJECT/backend/knowledge/business-knowledge.md)
- **Plain text format**: [`backend/knowledge/business-knowledge.txt`](file:///c:/Users/saura/OneDrive/Desktop/BBA_WALI_PROJECT/backend/knowledge/business-knowledge.txt)

> [!NOTE]
> **Demonstration Notice**: All product names, pricing ranges, and policies are sample demonstration data designed for an online apparel brand. The business owner can customize and replace them with their own catalog and verified policies.

### Knowledge Summary

| Category | Information |
| :--- | :--- |
| **Brand** | **UrbanThread** (Contemporary casual wear, streetwear, and everyday essentials) |
| **Products & Prices** | **T-Shirts**: ₹499–₹899<br>**Shirts**: ₹799–₹1,499<br>**Jeans**: ₹1,199–₹2,199<br>**Hoodies & Sweatshirts**: ₹999–₹1,799<br>**Dresses**: ₹999–₹2,499<br>**Jackets & Outerwear**: ₹1,499–₹3,499 |
| **Delivery Policy** | **3 to 7 business days** across India.<br>Free shipping on orders above ₹999; flat ₹79 shipping for orders below ₹999. |
| **Returns Policy** | Accepted within **7 days of delivery** in unused condition with tags attached. |
| **Exchange Policy** | Free size and color exchanges supported within 7 days, subject to stock availability. |
| **Refund Policy** | Initiated within **5 to 7 business days** to original payment method or bank account after warehouse approval. |
| **Payment Options** | UPI (GPay, PhonePe, Paytm, BHIM), Credit/Debit Cards, Net Banking, and Cash on Delivery (COD for cart value ₹499–₹4,999, ₹49 fee). |
| **Support Hours** | **Monday to Saturday: 10:00 AM – 7:00 PM IST** (Human escalation); **24/7** AI Web and Voice coverage. |
| **Support Contacts** | Phone: `+91 (800) 555-8722` \| Email: `support@urbanthread.in` |

---

## 3. Quick Start Guide

### Step 1: Install Dependencies
Open a terminal in the project root:

```bash
npm install
```

### Step 2: Configure Environment Variables
Verify or edit `.env` in the root (or `backend/.env`):

```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*

# Google Gemini API Key (Primary Provider: https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Groq API Configuration (Automatic Fallback Provider: https://console.groq.com/)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Bolna.ai Automated Voice Agent (https://bolna.ai/)
BOLNA_API_KEY=your_bolna_api_key_here
BOLNA_AGENT_ID=your_bolna_agent_id_here

# Configured Business Support Phone Number
SUPPORT_PHONE_NUMBER=+91 (800) 555-8722
```

### Step 3: Start the Server
```bash
npm start
```
- Open **[http://localhost:5000](http://localhost:5000)** in your browser.
- The web app and APIs are live immediately.

---

## 4. Dual-Engine AI Architecture (Gemini Primary + Groq Fallback)

To guarantee high availability and handle rate limits smoothly:

1. **Primary Provider — Google Gemini (`@google/genai`)**:
   - Model: `gemini-2.5-flash`
   - Handles multi-turn conversational inquiries grounded in `business-knowledge.md`.
2. **Fallback Provider — Groq (`groq-sdk`)**:
   - Model: `llama-3.3-70b-versatile` (or `llama-3.1-8b-instant`)
   - **Automatic Trigger**: If Gemini encounters rate limits (HTTP 429, ResourceExhausted, or quota limits), the backend silently and instantly routes the request to Groq.
   - Groq provides ultra-fast inference with very high requests-per-minute (RPM) limits, ensuring customers never see downtime or timeout errors.
3. **Identical Grounding**:
   - Both models receive the exact same authoritative knowledge base from [`backend/knowledge/business-knowledge.md`](file:///c:/Users/saura/OneDrive/Desktop/BBA_WALI_PROJECT/backend/knowledge/business-knowledge.md) and strict anti-hallucination rules.
   - The response JSON structure includes `provider: "gemini" | "groq"` and `fallbackTriggered: boolean`.

---

## 5. Bolna.ai Voice Agent Knowledge Connection Guide

Bolna.ai allows you to create an AI voice assistant that talks naturally with callers over the phone. You can connect the UrbanThread knowledge base to Bolna using either of the two standard methods below:

### Option A: Direct Document Upload (Recommended for quick setup)
1. Log in to your **[Bolna Dashboard](https://bolna.ai/)**.
2. Go to **Knowledge Base** (or **Data Sources / Documents** tab in Agent Studio).
3. Click **Add Document / Upload File**.
4. Upload [`backend/knowledge/business-knowledge.txt`](file:///c:/Users/saura/OneDrive/Desktop/BBA_WALI_PROJECT/backend/knowledge/business-knowledge.txt) (or `business-knowledge.md`).
5. Link this Knowledge Base to your Inbound Voice Agent in Bolna.

### Option B: URL-Based Knowledge Ingestion
1. Start your backend server and make it publicly accessible (e.g. using ngrok or deploying to a cloud host).
2. Bolna provides a **Web Scraping / URL Ingestion** option in Knowledge Base settings.
3. Enter your public knowledge endpoint URL:
   ```text
   https://<your-public-domain>/knowledge/business
   ```
4. This endpoint returns the entire knowledge base formatted in pure plain text (`Content-Type: text/plain; charset=utf-8`), allowing Bolna to index it directly. Any updates to your knowledge file can be re-crawled automatically without re-uploading documents.

### Option C: Voice Prompt Injection
1. Open the pre-built prompt endpoint in your browser:
   **[http://localhost:5000/api/bolna/prompt](http://localhost:5000/api/bolna/prompt)**
2. Copy the generated `bolnaVoicePrompt` string.
3. In Bolna **Agent Studio**, paste it directly into the **Agent Prompt / System Prompt** field.
4. This prompt contains spoken instructions formatted specifically for phone conversation (short sentences, no asterisks, friendly spoken greeting and closing).

---

## 6. Connecting Inbound Phone Calls with Bolna.ai

1. **Assign Phone Number**:
   - In Bolna Dashboard, go to **Calling** $\rightarrow$ **Inbound Calling**.
   - Enable Inbound Calling and assign a virtual phone number (or connect your Twilio/Exotel SIP number).
   - Update `SUPPORT_PHONE_NUMBER` in `backend/.env` with this number so the website's **Call Our AI Voice Agent** button points directly to it.
2. **Setup Webhook Receiver**:
   - In your Bolna agent's **Extractions / Webhook** tab, enter:
     ```text
     https://<your-public-domain>/api/bolna/webhook
     ```
   - Our Express backend will receive real-time call status updates (`in-progress`, `completed`) and call transcripts.

---

## 7. API Reference

| Method | Endpoint | Content-Type | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/knowledge/business` | `text/plain` | Authoritative UrbanThread knowledge base in plain text for Bolna URL ingestion & documentation |
| **GET** | `/api/config` | `application/json` | Public business branding, support phone, hours, and suggested questions |
| **POST** | `/api/chat` | `application/json` | Multi-turn conversational endpoint powered by Google Gemini |
| **GET** | `/api/bolna/prompt` | `application/json` | Voice-optimized system prompt for Bolna Inbound Agent |
| **POST** | `/api/bolna/webhook` | `application/json` | Webhook receiver for Bolna inbound call events and transcripts |
| **GET** | `/api/health` | `application/json` | Health check for Gemini and Bolna configuration status |
