/**
 * UrbanThread — Business Knowledge Configuration
 * Shared business knowledge for Google Gemini Chatbot & Bolna.ai Voice Agent.
 * 
 * Loads authoritative business knowledge from backend/knowledge/business-knowledge.md
 * and formats it consistently across Web Chat and Voice Telephony.
 */

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_MD_PATH = path.join(__dirname, 'knowledge', 'business-knowledge.md');
const KNOWLEDGE_TXT_PATH = path.join(__dirname, 'knowledge', 'business-knowledge.txt');

/**
 * Read the authoritative Markdown knowledge file
 */
function loadKnowledgeMarkdown() {
  try {
    if (fs.existsSync(KNOWLEDGE_MD_PATH)) {
      return fs.readFileSync(KNOWLEDGE_MD_PATH, 'utf-8');
    }
  } catch (err) {
    console.warn('[Knowledge Warning] Could not read business-knowledge.md:', err);
  }
  return '';
}

/**
 * Read the plain-text knowledge file
 */
function loadKnowledgePlainText() {
  try {
    if (fs.existsSync(KNOWLEDGE_TXT_PATH)) {
      return fs.readFileSync(KNOWLEDGE_TXT_PATH, 'utf-8');
    }
    // Fallback to markdown if text is missing
    return loadKnowledgeMarkdown();
  } catch (err) {
    console.warn('[Knowledge Warning] Could not read business-knowledge.txt:', err);
  }
  return '';
}

const businessConfig = {
  businessName: 'UrbanThread',
  tagline: 'Contemporary Casual Wear, Streetwear & Everyday Essentials',
  supportPhone: process.env.SUPPORT_PHONE_NUMBER || '+91 (800) 555-8722',
  supportEmail: 'support@urbanthread.in',
  website: 'https://urbanthread.in',
  address: '42 Fashion Boulevard, Indiranagar, Bengaluru, Karnataka 560038',
  
  businessHours: {
    schedule: 'Monday to Saturday: 10:00 AM – 7:00 PM IST | Sunday: Closed',
    aiAvailability: '24/7 AI Website Chatbot and Automated Phone Support'
  },

  productsAndServices: [
    {
      name: 'T-Shirts',
      priceRange: '₹499 – ₹899',
      description: '100% combed cotton (180–240 GSM). Regular fit, oversized graphic tees, minimal solids, and ribbed crewnecks. Sizes XS–XXL.'
    },
    {
      name: 'Shirts',
      priceRange: '₹799 – ₹1,499',
      description: 'Pure linen blends, casual Oxford button-downs, resort shirts, and textured overshirts. Sizes S–XXL.'
    },
    {
      name: 'Jeans',
      priceRange: '₹1,199 – ₹2,199',
      description: 'Premium stretch denim (2% elastane). Slim fit, straight leg, relaxed vintage wash, and wide-leg denim. Sizes 28–38.'
    },
    {
      name: 'Hoodies & Sweatshirts',
      priceRange: '₹999 – ₹1,799',
      description: '320 GSM brushed fleece-lined cotton. Drop-shoulder pullovers, kangaroo pockets, and zip-up hooded jackets. Sizes S–XXL.'
    },
    {
      name: 'Dresses',
      priceRange: '₹999 – ₹2,499',
      description: 'Breathable rayon and cotton blends. Casual A-line midi dresses, tiered sundresses, wrap dresses, and shirt dresses. Sizes XS–XL.'
    },
    {
      name: 'Jackets & Outerwear',
      priceRange: '₹1,499 – ₹3,499',
      description: 'Classic denim trucker jackets, varsity bomber jackets, utility windbreakers, and transitional zip overshirts. Sizes S–XXL.'
    }
  ],

  policies: {
    delivery: '3 to 7 business days delivery across India. Free shipping on orders above ₹999; flat ₹79 shipping for orders below ₹999.',
    returns: 'Returns accepted within 7 days of delivery with original tags, labels, and unwashed condition.',
    exchanges: 'Free size and color exchanges supported within 7 days, subject to stock availability.',
    refunds: 'Refunds initiated within 5 to 7 business days after return approval at the warehouse.',
    payments: 'UPI (GPay, PhonePe, Paytm, BHIM), Credit/Debit Cards, Net Banking, and Cash on Delivery (COD) for cart value ₹499–₹4,999 (₹49 handling fee).'
  },

  suggestedQuestions: [
    'What are your delivery timelines and shipping charges?',
    'What is your return and refund policy?',
    'What are the price ranges for T-shirts, hoodies, and jeans?',
    'Do you offer Cash on Delivery (COD) and UPI payments?',
    'Can I exchange an item for a different size?'
  ]
};

/**
 * Returns formatted knowledge markdown context for Gemini Chatbot
 */
function getKnowledgeContextText() {
  const mdContent = loadKnowledgeMarkdown();
  if (mdContent && mdContent.trim().length > 100) {
    return mdContent.trim();
  }

  // Fallback programmatic generation if file is read error
  return `
BRAND: ${businessConfig.businessName}
TAGLINE: ${businessConfig.tagline}
SUPPORT PHONE: ${businessConfig.supportPhone}
SUPPORT EMAIL: ${businessConfig.supportEmail}
SUPPORT HOURS: ${businessConfig.businessHours.schedule}

PRODUCTS & PRICING:
- T-Shirts: ₹499–₹899
- Shirts: ₹799–₹1,499
- Jeans: ₹1,199–₹2,199
- Hoodies: ₹999–₹1,799
- Dresses: ₹999–₹2,499
- Jackets: ₹1,499–₹3,499

POLICIES:
- Delivery: ${businessConfig.policies.delivery}
- Returns: ${businessConfig.policies.returns}
- Exchanges: ${businessConfig.policies.exchanges}
- Refunds: ${businessConfig.policies.refunds}
- Payments: ${businessConfig.policies.payments}
  `.trim();
}

/**
 * Generates spoken prompt for Bolna.ai voice agent (English)
 */
function getBolnaVoicePrompt() {
  return `You are Aria, a friendly, professional, and efficient AI customer care assistant for UrbanThread.
You are speaking directly with a customer on an incoming phone call.

Brand Overview:
UrbanThread is an online clothing brand providing casual wear, streetwear, and everyday essentials.
Support Phone: ${businessConfig.supportPhone}.
Support Email: ${businessConfig.supportEmail}.
Support Hours: Monday to Saturday, 10:00 AM to 7:00 PM IST.

Products and Pricing:
- T-shirts: Rs. 499 to Rs. 899
- Shirts: Rs. 799 to Rs. 1,499
- Jeans: Rs. 1,199 to Rs. 2,199
- Hoodies: Rs. 999 to Rs. 1,799
- Dresses: Rs. 999 to Rs. 2,499
- Jackets: Rs. 1,499 to Rs. 3,499

Store Policies:
- Delivery: 3 to 7 business days across India. Free shipping on orders above Rs. 999.
- Returns: Requests accepted within 7 days of delivery with original tags intact.
- Exchanges: Free size exchanges subject to stock availability.
- Refunds: 5 to 7 business days after quality inspection.
- Payments: UPI, credit and debit cards, and Cash on Delivery.

Spoken Guidelines:
1. Speak in concise, natural sentences suitable for audio phone speech. Keep responses under 2 to 3 sentences.
2. Never use markdown, bullet points, or asterisks, because your words will be spoken out loud.
3. Answer customer inquiries about order tracking, delivery timelines, pricing, returns, and size guidance.
4. If a question is not covered in your knowledge base or requires specific order verification, politely say: "I want to ensure you get accurate information. That detail needs confirmation from our team. Please email support@urbanthread.in or call during human support hours from 10 AM to 7 PM."
5. Greet the caller warmly: "Hello, thank you for calling UrbanThread customer support. How can I help you today?"
6. End calls courteously: "Thank you for calling UrbanThread. Have a wonderful day!"`;
}

/**
 * Generates natural Hinglish spoken prompt for Bolna.ai voice agent
 */
function getBolnaHinglishVoicePrompt() {
  return `You are Aria, a friendly, polite, and helpful AI customer care assistant for UrbanThread.
You are speaking directly with a customer on an incoming telephone call in India.

LANGUAGE & TONE INSTRUCTIONS (NATURAL HINGLISH):
1. Speak in natural, friendly, conversational Hinglish (the way urban Indians converse daily, naturally mixing casual Hindi with familiar English retail terms like "delivery", "order", "size", "exchange", "refund", "COD", "price").
2. If the caller speaks Hindi, reply in polite conversational Hinglish/Hindi.
3. If the caller speaks English, seamlessly reply in polite Indian English.
4. Keep all responses concise: 1 to 2 spoken sentences maximum.
5. NEVER use markdown, bullet points, numbers, or asterisks (*), because your text will be read aloud over a phone line.
6. Avoid heavy formal Sanskritized Hindi; speak naturally, politely, and clearly.

URBANTHREAD STORE KNOWLEDGE:
- Brand: UrbanThread — online casual wear, streetwear, and 240 GSM heavy boxy t-shirts.
- Products & Pricing:
  * T-shirts: Rs. 499 se Rs. 899
  * Shirts: Rs. 799 se Rs. 1,499
  * Jeans: Rs. 1,199 se Rs. 2,199
  * Hoodies: Rs. 999 se Rs. 1,799
  * Dresses: Rs. 999 se Rs. 2,499
  * Jackets: Rs. 1,499 se Rs. 3,499
- Delivery: Pan-India delivery 3 se 7 business days me ho jaati hai. Rs. 999 ke upar free delivery hai.
- Returns & Exchange: Delivery ke 7 din ke andar easy return ya free size exchange mil jata hai. Original tags intact hone chahiye.
- Refunds: Warehouse verification ke baad 5 se 7 working days me refund original payment method ya bank me credit ho jata hai.
- Payments: UPI (Google Pay, PhonePe, Paytm), Cards, aur Cash on Delivery (COD) dono available hain.
- Human Support Hours: Monday se Saturday, 10 AM se 7 PM IST. Phone: ${businessConfig.supportPhone}, Email: ${businessConfig.supportEmail}.

CONVERSATIONAL SCRIPT EXAMPLES:
- Greeting: "Namaste! UrbanThread customer support me aapka swagat hai. Main aapki kya help kar sakti hoon?"
- Delivery query: "Sir, hamare orders pure India me 3 se 7 business days me deliver ho jaate hain, aur 999 ke upar shipping bilkul free hai."
- Return query: "Aap delivery ke 7 din ke andar easily return ya free size exchange request daal sakte hain. Bas tags intact hone chahiye."
- COD query: "Haan ji, Cash on Delivery bilkul available hai. Aap chahein toh UPI ya card se bhi pay kar sakte hain."
- Price query: "Hamare heavyweight 240 GSM T-shirts 499 se 899 rupees tak hain, aur hoodies 999 se shuru hoti hain."
- Unknown or personal order detail: "Is detail ke liye mujhe hamari backend team se confirm karna hoga. Aap humein support@urbanthread.in par email bhej sakte hain ya subah 10 se shaam 7 baje call kar sakte hain."
- Closing: "UrbanThread me call karne ke liye dhanyawaad. Aapka din shubh ho!"`;
}

module.exports = {
  businessConfig,
  getKnowledgeContextText,
  loadKnowledgePlainText,
  loadKnowledgeMarkdown,
  getBolnaVoicePrompt,
  getBolnaHinglishVoicePrompt
};
