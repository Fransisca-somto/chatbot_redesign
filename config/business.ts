// ============================================================
// AUTOCIAL DIGITALS — BUSINESS CONFIGURATION
// ⭐ THIS IS THE ONLY FILE YOU NEED TO EDIT
// All business-specific information is imported from here.
// ============================================================

export interface Service {
  id: number;
  name: string;
  price: number;
  description: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface BusinessConfig {
  name: string;
  tagline: string;
  description: string;
  location: string;
  operatingHours: string;
  contactPhone: string;
  contactEmail: string;
  agentWhatsAppNumber: string;
  agentEmail: string;
  bookingLink: string;
  currency: string;
  services: Service[];
  faqs: FAQ[];
  welcomeMessage: string;
  commands: {
    menu: string[];
    book: string[];
    faq: string[];
    agent: string[];
  };
  mediaImages: {
    welcomeBanner: string;
    servicesCatalog: string;
    bookingConfirm: string;
  };
  brandTone: string;
}

export const BUSINESS_CONFIG: BusinessConfig = {
  name: "Autocial Digitals",
  tagline: "Automate your engagement. Elevate your brand.",
  description:
    "Autocial Digitals provides smart social media management and AI chatbot solutions. We help businesses automate customer interactions, streamline content, and maintain an active 24/7 online presence — without the manual stress.",
  location: "Fully Remote / Online",
  operatingHours:
    "Monday – Friday: 9:00 AM – 6:00 PM (WAT) | AI Chatbot Support: 24/7",
  contactPhone: "+2348069971549",
  contactEmail: "fransiscasomto@gmail.com",
  agentWhatsAppNumber: "+2348069971549",
  agentEmail: "fransiscasomto@gmail.com",
  bookingLink: "https://calendly.com/autocialdigitals/consultation",
  currency: "NGN",

  services: [
    {
      id: 1,
      name: "Smart Chatbot Setup",
      price: 50000,
      description:
        "A custom AI chatbot integrated into one platform of your choice — WhatsApp, Instagram, or your Website. Handles 24/7 FAQs and lead capture so you never miss a customer, even while you sleep. One-time setup fee.",
    },
    {
      id: 2,
      name: "Social Starter Package",
      price: 100000,
      description:
        "Professional management of 2 social media platforms with 3 posts per week and basic community management. Ideal for businesses ready to build a consistent online presence without lifting a finger. Billed monthly.",
    },
    {
      id: 3,
      name: "The Autocial Pro",
      price: 250000,
      description:
        "Our flagship, all-in-one package. Full content management across 3 platforms, a tailored content strategy, plus a fully automated AI chatbot for seamless 24/7 customer service. The complete solution for serious brands. Billed monthly.",
    },
  ],

  faqs: [
    {
      question: "Do you need my login passwords?",
      answer:
        "No! For social media management, we prefer you grant us 'Editor' or 'Manager' access through the platform's settings, or we use secure scheduling tools — so your passwords always stay private and safe.",
    },
    {
      question: "How long does it take to set up my custom chatbot?",
      answer:
        "Typically 3 to 5 business days. We use that time to learn your business, map out your customer journeys, and train the bot to sound exactly like you.",
    },
    {
      question:
        "Will I get to approve social media posts before they go live?",
      answer:
        "Absolutely. We provide a monthly content calendar for your review, and nothing is published without your green light.",
    },
    {
      question: "Which platforms can the chatbot work on?",
      answer:
        "We can integrate your custom AI chatbot across WhatsApp, Instagram Direct Messages, Facebook Messenger, and directly onto your website.",
    },
    {
      question:
        "What happens if a customer asks a question the chatbot doesn't know?",
      answer:
        "The bot knows its limits! If it gets stuck, it politely lets the customer know and instantly routes the conversation to a human team member — sending you a notification so you never lose a lead.",
    },
    {
      question:
        "Do I have to sign a long-term contract for the monthly packages?",
      answer:
        "Not at all. The Social Starter and Autocial Pro packages are both month-to-month. We believe in earning your business every month. You can upgrade, downgrade, or cancel anytime with a 30-day notice.",
    },
    {
      question:
        "Who creates the content? Do I need to provide my own photos or videos?",
      answer:
        "We handle all the copywriting and graphic design! That said, if you have raw photos or videos of your products, team, or workspace, sharing them helps make the content much more authentic and engaging.",
    },
    {
      question: "Can the chatbot book appointments or take orders?",
      answer:
        "Yes! Depending on your setup, we can program your bot to qualify leads, collect contact details, share your booking links, and guide customers through a basic ordering process.",
    },
    {
      question: "What industries do you work with?",
      answer:
        "We work with a wide range of industries including e-commerce, service-based businesses, real estate, and tech. Because we custom-build every strategy and train each bot on your specific business data, our solutions fit almost any niche.",
    },
    {
      question: "How do I get started?",
      answer:
        "Simple — book a free consultation via our Calendly link and we'll walk you through the best solution for your business. Reply with /book to grab a time slot right now.",
    },
  ],

  welcomeMessage: `Welcome to *Autocial Digitals!* 👋🤖

We help businesses automate customer engagement and grow their brand online — smarter, faster, and without the manual stress.

How can we help you today? Reply with a number:

*1️⃣* — View our Services & Pricing
*2️⃣* — Book a Free Consultation
*3️⃣* — FAQs & How It Works
*4️⃣* — Speak to a Human Agent`,

  commands: {
    menu: ["/menu", "/start", "/hello", "hi", "hello", "hey", "start"],
    book: ["/book", "/booking", "2", "book", "reserve", "consultation", "schedule"],
    faq: ["/faq", "/help", "3", "faq", "help", "how it works", "questions"],
    agent: ["/agent", "4", "human", "agent", "speak to human", "talk to someone"],
  },

  mediaImages: {
    welcomeBanner:
      "https://dummyimage.com/1200x400/eeeeee/333333.png&text=Welcome+to+Autocial+Digitals",
    servicesCatalog:
      "https://dummyimage.com/800x800/eeeeee/333333.png&text=Autocial+Digitals+Services+Catalog",
    bookingConfirm:
      "https://dummyimage.com/1200x400/eeeeee/333333.png&text=Consultation+Booked!",
  },

  brandTone: `
    - Professional but extremely friendly and simple — like texting a helpful friend
    - Use VERY simple, everyday English. No complex sentences or marketing jargon.
    - Keep responses ultra-short. Never write a wall of text.
    - Use emojis moderately to keep messages warm and approachable
    - Always be solution-focused; frame every answer around what the customer gains
    - Never invent prices, timelines, or policies not stated in this config
    - When a customer seems ready to buy or book, always prompt them toward /book
    - Refer to monthly packages as month-to-month — never imply lock-in
    - If a question falls outside your knowledge base, escalate to a human agent via /agent rather than guessing
  `.trim(),
};