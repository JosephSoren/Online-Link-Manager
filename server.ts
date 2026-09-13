import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// Procedural fallback SVG generator in case AI model is busy, rate-limited or keyless
function generateProceduralThumbnail(title: string, description: string, url: string, category: string, style?: string): string {
  let hostname = 'link';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    hostname = parsed.hostname.replace('www.', '');
  } catch {
    hostname = url || 'link';
  }

  // Pick color palette based on category or hash
  const hash = (title + hostname).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const themes = [
    { from: '#4f46e5', to: '#7c3aed', accent: '#06b6d4', bg: '#0f172a', name: 'indigo' },
    { from: '#2563eb', to: '#38bdf8', accent: '#ec4899', bg: '#0284c7', name: 'blue' },
    { from: '#059669', to: '#10b981', accent: '#f59e0b', bg: '#064e3b', name: 'emerald' },
    { from: '#d97706', to: '#f59e0b', accent: '#ef4444', bg: '#78350f', name: 'amber' },
    { from: '#db2777', to: '#f43f5e', accent: '#8b5cf6', bg: '#831843', name: 'rose' },
    { from: '#7c3aed', to: '#c026d3', accent: '#10b981', bg: '#581c87', name: 'purple' },
  ];

  const palette = themes[hash % themes.length];
  const safeTitle = (title || hostname || 'Bookmark').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeDesc = (description || `Resource for ${category || 'Web'}`).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 100);
  const safeHost = hostname.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.from}" />
        <stop offset="60%" stop-color="${palette.to}" />
        <stop offset="100%" stop-color="${palette.bg}" />
      </linearGradient>
      <linearGradient id="meshGrad" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.05" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="24" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    
    <!-- Background Canvas -->
    <rect width="640" height="360" fill="url(#bgGrad)" />
    
    <!-- Decorative geometric background elements -->
    <circle cx="560" cy="80" r="180" fill="url(#meshGrad)" filter="url(#glow)" />
    <circle cx="80" cy="300" r="140" fill="${palette.accent}" opacity="0.2" filter="url(#glow)" />
    
    <g opacity="0.12" stroke="#ffffff" stroke-width="1.5">
      <line x1="0" y1="90" x2="640" y2="90" />
      <line x1="0" y1="180" x2="640" y2="180" />
      <line x1="0" y1="270" x2="640" y2="270" />
      <line x1="160" y1="0" x2="160" y2="360" />
      <line x1="320" y1="0" x2="320" y2="360" />
      <line x1="480" y1="0" x2="480" y2="360" />
    </g>

    <!-- Glass card container -->
    <rect x="40" y="45" width="560" height="270" rx="16" fill="#0f172a" fill-opacity="0.4" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1" />
    
    <!-- Category Pill -->
    <g transform="translate(64, 75)">
      <rect width="100" height="28" rx="14" fill="#ffffff" fill-opacity="0.18" />
      <text x="50" y="18" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" text-anchor="middle" letter-spacing="0.5">${category || 'Link'}</text>
    </g>

    <!-- Domain badge -->
    <g transform="translate(176, 75)">
      <rect width="140" height="28" rx="14" fill="#000000" fill-opacity="0.25" />
      <text x="70" y="18" fill="${palette.accent}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" text-anchor="middle">${safeHost}</text>
    </g>

    <!-- Main Title -->
    <text x="64" y="165" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="700">
      ${safeTitle.length > 28 ? safeTitle.slice(0, 26) + '...' : safeTitle}
    </text>

    <!-- Description snippet -->
    <text x="64" y="205" fill="#e2e8f0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" opacity="0.85">
      ${safeDesc.length > 55 ? safeDesc.slice(0, 52) + '...' : safeDesc}
    </text>

    <!-- Visual Sparkle Icon Accent -->
    <g transform="translate(510, 190)">
      <circle cx="28" cy="28" r="28" fill="${palette.from}" fill-opacity="0.6" />
      <path d="M28 14 L31 24 L41 27 L31 30 L28 40 L25 30 L15 27 L25 24 Z" fill="#ffffff" />
    </g>

    <!-- Bottom aesthetic bar -->
    <rect x="64" y="275" width="220" height="4" rx="2" fill="url(#bgGrad)" />
  </svg>`;

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Route: Generate preview thumbnail for link
  app.post('/api/generate-thumbnail', async (req, res) => {
    try {
      const { title = '', description = '', url = '', category = 'Work', style = 'modern' } = req.body;

      if (!title && !url) {
        return res.status(400).json({ error: 'Title or URL is required' });
      }

      const stylePrompts: Record<string, string> = {
        modern: 'modern UI illustration with clean geometric vectors and soft gradients',
        isometric: 'isometric 3D digital art with vibrant depth and clean studio lighting',
        minimal: 'minimalist elegant gradient with abstract waves and clean aesthetic',
        tech: 'futuristic cyber tech banner with neon accents and sleek glowing nodes',
        creative: 'artistic digital illustration with rich saturated colors and painterly details'
      };

      const selectedStyle = stylePrompts[style] || stylePrompts.modern;
      const promptText = `A crisp, professional 16:9 website preview card thumbnail banner for "${title}". Description: "${description || 'Digital web tool and productivity platform'}". Category: ${category}. Style: ${selectedStyle}. High quality digital art suitable for a modern bookmark card thumbnail, no watermark, no text errors.`;

      const withTimeout = <T>(promise: Promise<T>, ms: number, desc: string): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${desc} timed out after ${ms}ms`)), ms))
        ]);
      };

      const ai = getAI();

      if (ai) {
        // Step 1: Attempt image generation model with 6s timeout
        try {
          const imageRes = await withTimeout(
            ai.models.generateContent({
              model: 'gemini-3.1-flash-lite-image',
              contents: { parts: [{ text: promptText }] },
              config: {
                imageConfig: { aspectRatio: '16:9' }
              }
            }),
            6000,
            'Gemini image model'
          );

          for (const part of imageRes.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData && part.inlineData.data) {
              return res.json({
                thumbnail: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
                source: 'gemini-image',
                prompt: promptText
              });
            }
          }
        } catch (imgError: any) {
          console.warn('Image model note:', imgError?.message || imgError);
        }

        // Step 2: Attempt Gemini Flash text model to generate custom tailored SVG artwork with 6s timeout
        try {
          const svgResponse = await withTimeout(
            ai.models.generateContent({
              model: 'gemini-flash-latest',
              contents: `Create a clean, self-contained SVG image (width="100%" height="100%" viewBox="0 0 640 360") to serve as an eye-catching bookmark preview thumbnail card for "${title}".
Description: "${description || 'Web application and bookmark'}"
Category: ${category}
Style: ${selectedStyle}
Instructions:
- Return ONLY valid raw SVG starting with <svg and ending with </svg>.
- Do not wrap in markdown quotes or code blocks.
- Use attractive dark-themed gradients (<defs><linearGradient...>), glowing geometric curves, and an icon badge.
- Include the title "${title.replace(/"/g, '')}" nicely rendered inside the graphic.`,
            }),
            6000,
            'Gemini SVG model'
          );

          const rawText = svgResponse.text?.trim() || '';
          const svgMatch = rawText.match(/<svg[\s\S]*?<\/svg>/i);
          if (svgMatch) {
            const cleanSvg = svgMatch[0];
            const base64 = Buffer.from(cleanSvg).toString('base64');
            return res.json({
              thumbnail: `data:image/svg+xml;base64,${base64}`,
              source: 'gemini-svg',
              prompt: promptText
            });
          }
        } catch (svgError: any) {
          console.warn('Gemini SVG generation note:', svgError?.message || svgError);
        }
      }

      // Step 3: Fast, elegant procedural fallback SVG thumbnail
      const fallbackThumbnail = generateProceduralThumbnail(title, description, url, category, style);
      return res.json({
        thumbnail: fallbackThumbnail,
        source: 'procedural-svg',
        prompt: promptText
      });
    } catch (err: any) {
      console.error('Error generating thumbnail:', err);
      return res.status(500).json({ error: err.message || 'Failed to generate preview thumbnail' });
    }
  });

  // Mount Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
