require('dotenv').config();
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/* =========================================
   WHATSAPP → SEO JOB POST BOT (FINAL)
   ========================================= */

console.log('🚀 SEO Job Bot starting...');

process.on('unhandledRejection', err => {
  console.error('❌ UNHANDLED REJECTION:', err);
});
process.on('uncaughtException', err => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
});

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/* ========= CONFIG ========= */
console.log('🔑 GEMINI KEY PREFIX:', GEMINI_API_KEY?.slice(0, 6));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const WP_URL = 'https://bpharmajobs.com';
const WP_USERNAME = process.env.WP_USERNAME;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

/* 🔥 DEFAULT FEATURED IMAGE (Media ID) */
const DEFAULT_FEATURED_IMAGE_ID = 3292; // ← REPLACE WITH REAL MEDIA ID

const SOURCE_GROUPS = ['Autoposter'];
const TARGET_GROUPS = ['All India MR & Manager Job Group','FMCG Sales Naukri.Com'];

const JOB_KEYWORDS = [
  'job',
  'vacancy',
  'hiring',
  'required',
  'opening',
  'apply',
  'recruitment',
  'urgent'
];

/* ========================== */


/* ========= WHATSAPP CLIENT ========= */

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'seo-job-bot' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  }
});

client.on('qr', qr => {
  console.log('📱 Scan QR with WhatsApp');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ Bot is running and monitoring groups...');
});

/* ========= MESSAGE HANDLER ========= */

client.on('message', async message => {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    const isSourceGroup = SOURCE_GROUPS.some(g =>
      chat.name.toLowerCase().includes(g.toLowerCase())
    );
    if (!isSourceGroup) return;

    const text = message.body.toLowerCase();
    const isJobPost = JOB_KEYWORDS.some(k => text.includes(k));
    if (!isJobPost) return;

    console.log('📩 Job detected → Creating SEO post...');

    /* ========= GEMINI ========= */

    const model = genAI.getGenerativeModel({
      model: 'models/gemini-1.5-flash'
    });

    const prompt = `
You are an SEO expert for a pharma jobs website.

Create a FULLY SEO-OPTIMIZED WordPress job post similar to:
"Area Sales Manager Pharma Jobs Multiple Locations 2026"

Return ONLY valid JSON in this exact format:

{
  "title": "SEO optimized job title (max 60 chars)",
  "slug": "seo-friendly-url-slug",
  "meta_description": "SEO meta description (max 160 chars)",
  "tags": ["pharma jobs", "medical representative", "area sales manager"],
  "content": "<h2>Job Details</h2>Well structured HTML job content",
  "schema": {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": "",
    "description": "",
    "datePosted": "",
    "employmentType": "Full-time",
    "hiringOrganization": {
      "@type": "Organization",
      "name": ""
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "",
        "addressCountry": "IN"
      }
    }
  }
}

Job Message:
${message.body}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('❌ Gemini returned invalid JSON');
      return;
    }

    const jobData = JSON.parse(jsonMatch[0]);

    /* ========= FINAL CONTENT (WITH SCHEMA) ========= */

    const finalContent = `
${jobData.content}

<script type="application/ld+json">
${JSON.stringify(jobData.schema)}
</script>
`;

    /* ========= POST TO WORDPRESS ========= */

    const wpResponse = await axios.post(
      `${WP_URL}/wp-json/wp/v2/posts`,
      {
        title: jobData.title,
        slug: jobData.slug,
        content: finalContent,
        status: 'publish',

        /* 🔥 DEFAULT FEATURED IMAGE */
        featured_media: DEFAULT_FEATURED_IMAGE_ID,

        /* 🔍 SEO META (Rank Math) */
        meta: {
          rank_math_description: jobData.meta_description,
          rank_math_focus_keyword: jobData.tags.join(', ')
        }
      },
      {
        auth: {
          username: WP_USERNAME,
          password: WP_APP_PASSWORD
        }
      }
    );

    const postUrl = wpResponse.data.link;
    console.log(`✅ Job posted successfully: ${postUrl}`);

    /* ========= SHARE TO TARGET GROUPS ========= */

    const chats = await client.getChats();
    for (const group of TARGET_GROUPS) {
      const targetChat = chats.find(
        c => c.isGroup && c.name.includes(group)
      );
      if (targetChat) {
        await targetChat.sendMessage(
          `🆕 *New Pharma Job Posted*\n\n*${jobData.title}*\n\n🔗 ${postUrl}`
        );
      }
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
});

/* ========= START BOT ========= */

client.initialize();




