const axios = require('axios');
const { dbAll, dbRun } = require('../config/db');
require('dotenv').config();

/**
 * Resolves AI prompts using NVIDIA NIM Llama 3.3 or Google Gemini,
 * falling back to local heuristic answers if keys are unconfigured.
 */
async function getAIInsight(prompt, userKey) {
  // 1. Attempt NVIDIA NIM Call
  const nimKey = process.env.NVIDIA_API_KEY || (userKey && userKey.startsWith('nvapi-') ? userKey : null);
  if (nimKey && nimKey !== 'your_nvidia_nim_api_key_here') {
    try {
      const response = await axios.post(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        {
          model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          top_p: 0.7,
          max_tokens: 1024,
        },
        {
          headers: {
            "Authorization": `Bearer ${nimKey}`,
            "Content-Type": "application/json"
          },
          timeout: 25000
        }
      );
      return response.data.choices[0].message.content;
    } catch (err) {
      console.error('[AI] NVIDIA NIM Request Failed, falling back to Gemini...', err.response?.data || err.message);
    }
  }

  // 2. Attempt Google Gemini Call
  const geminiKey = process.env.GEMINI_API_KEY || userKey;
  if (geminiKey && geminiKey.length > 10 && !geminiKey.startsWith('nvapi-')) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const { data } = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }]
      }, { timeout: 25000 });
      return data.candidates[0].content.parts[0].text;
    } catch (err) {
      console.error('[AI] Gemini Request Failed:', err.message);
    }
  }

  // 3. Automated Local Heuristic Fallback
  await new Promise(resolve => setTimeout(resolve, 600));
  const lp = prompt.toLowerCase();
  let fallbackText = '### 🤖 AI Insight (Simulated Offline Mode)\n\n*Note: No active API Key was detected in your `.env` or input. Showing a simulated research response based on local data.* \n\n';

  if (lp.includes('grant')) {
    fallbackText += `**Top Match Grant Call: IDRC AI4D Africa (Sustainable Development & AI)**
- **Suitability**: High. Aligns perfectly with the School of Science, Engineering & Health (SSEH) research on digital trust and SMS scam detection.
- **Potential Investigators**: Dr. Japheth Mursi, Hamid Nach.
- **Action Items**: Draft a multidisciplinary proposal linking SSEH AI research with School of Law policy frameworks.

**Secondary Match: Omidyar Network — Digital Public Infrastructure**
- **Focus**: Building trust and secure transacting systems in emerging markets.
- **Alignment**: Deep matches with "AI Against Smishing in Kenya".`;
  } else if (lp.includes('idrc')) {
    fallbackText += `**IDRC AI4D African Research Suitability Ranking:**

1. **Dr. Japheth Kiplang'at Mursi (SSEH)**
   - **Research Focus**: Culturally Adapted SMS scam detection, MPesa mobile-financial security.
   - **Relevance**: 10/10. Standard-setting work in AI security in Africa. Excellent international collaboration track record (co-authors in Canada and South Africa).
   
2. **Salim Mwarika (SOC)**
   - **Research Focus**: Social impact, digital trust, and information diffusion in mobile ecosystems.
   - **Relevance**: 8.5/10. Great intersectional insights for human-centered technology adoption.`;
  } else if (lp.includes('journal')) {
    fallbackText += `**Scopus Indexed Journal Targets (Q1/Q2 tiers):**

1. ***Information Technology for Development* (Taylor & Francis — Q1)**
   - **Scope**: ICT and socio-economic development, mobile financial services in Africa.
   - **Fit**: Perfect for M-Pesa ecosystem analysis, digital financial inclusion, and secure fintech.
   
2. ***Electronic Commerce Research and Applications* (Elsevier — Q1)**
   - **Scope**: E-commerce technology, security trust, user profiling.
   - **Fit**: Exceptional for smishing detection models and digital transaction trust research.

3. ***African Journal of Science, Technology, Innovation and Development* (AJOL / Routledge — Q2)**
   - **Scope**: Innovation policy and regional development.
   - **Fit**: Excellent general outlet for Daystar University multi-school joint projects.`;
  } else {
    fallbackText += `Based on the publications in your database, Daystar University shows strong emerging clusters in:
1. **Faith, Ethics & AI Integration** (SSEH + SMT collaboration)
2. **Mobile Financial Ecosystem Security** (M-Pesa and Smishing detection)
3. **Community & Maternal Health Informatics** (SON + SHSS)

To activate live, real-time custom analysis across your records, please add an **NVIDIA_API_KEY** or **GEMINI_API_KEY** to your environment configuration.`;
  }

  return fallbackText;
}

/**
 * Re-analyzes publications in batch using AI to classify and write UN SDGs.
 */
async function performSDGReanalysis() {
  const nimKey = process.env.NVIDIA_API_KEY;
  if (!nimKey || nimKey === 'your_nvidia_nim_api_key_here') {
    throw new Error('NVIDIA_API_KEY is required in .env for batch AI analysis');
  }

  const rows = await dbAll('SELECT id, title, abstract FROM publications');
  let updatedCount = 0;

  // Process in small parallel batches to respect rate limits
  for (let i = 0; i < rows.length; i += 5) {
    const batch = rows.slice(i, i + 5);
    await Promise.all(batch.map(async (row) => {
      if (!row.abstract || row.abstract.length < 20) return;

      const prompt = `Identify the top 1-3 United Nations Sustainable Development Goals (SDGs) relevant to this research abstract. 
      Output ONLY the SDG numbers/labels (e.g., "SDG 3, SDG 9") separated by commas. Do not include any other text.
      
      Title: ${row.title}
      Abstract: ${row.abstract}`;

      try {
        const response = await axios.post(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          {
            model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 50,
          },
          { 
            headers: { "Authorization": `Bearer ${nimKey}` },
            timeout: 20000 
          }
        );

        const aiSdgs = response.data.choices[0].message.content.trim().replace(/\.$/, '');
        await dbRun('UPDATE publications SET sdgs = ? WHERE id = ?', [aiSdgs, row.id]);
        updatedCount++;
      } catch (err) {
        console.error(`[AI-SDG] Error updating publication ${row.id}:`, err.message);
      }
    }));

    // Rate-limiting throttle pause
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return updatedCount;
}

module.exports = {
  getAIInsight,
  performSDGReanalysis
};
