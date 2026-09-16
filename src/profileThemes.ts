// Profile Themes & Visual Templates for LinkManager
// Supports custom gamer girl / flowerish aesthetics, tech matrix banners, sunset synthwave, etc.

export interface ProfileTheme {
  id: 'default' | 'flowerish' | 'tech' | 'sunset' | 'emerald' | 'darkluxury';
  name: string;
  tagline: string;
  categoryTag: string;
  accentColor: string;
  secondaryAccent: string;
  heroBg: string;
  heroBorder: string;
  badgeBg: string;
  badgeColor: string;
  bannerSvg: string;
  previewColor: string;
  bannerStyleName: string;
}

export interface PresetAvatar {
  id: string;
  name: string;
  url: string;
}

export interface PresetBanner {
  id: string;
  name: string;
  category: string;
  svg: string;
  previewGradient: string;
}

// Crisp inline SVGs encoded as clean data URIs for 100% offline & instant rendering

// 1. Flowerish Sakura Banner: soft pastel pinks, cherry blossoms, cute floating petals, sparkle stars
const BANNER_FLOWERISH = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 240" width="100%" height="100%">
  <defs>
    <linearGradient id="sakuraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%23fdf2f8"/>
      <stop offset="35%" stop-color="%23fce7f3"/>
      <stop offset="70%" stop-color="%23fbcfe8"/>
      <stop offset="100%" stop-color="%23f472b6"/>
    </linearGradient>
    <linearGradient id="petalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%23fda4af"/>
      <stop offset="100%" stop-color="%23fb7185"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="240" fill="url(%23sakuraGrad)"/>
  <circle cx="850" cy="40" r="160" fill="%23ffffff" opacity="0.35"/>
  <circle cx="120" cy="220" r="140" fill="%23f472b6" opacity="0.2"/>
  <!-- Decorative Sakura Blossom Tree Branch Outline -->
  <path d="M1000,0 C850,30 750,110 650,70 C580,40 520,90 440,60" fill="none" stroke="%23f43f5e" stroke-width="3" opacity="0.3"/>
  <path d="M800,45 C770,90 700,100 680,140" fill="none" stroke="%23f43f5e" stroke-width="2" opacity="0.25"/>
  <!-- Floating Petals -->
  <g fill="url(%23petalGrad)" opacity="0.75">
    <path d="M720,50 C735,35 760,40 755,60 C750,75 730,70 720,50 Z" />
    <path d="M640,90 C655,75 680,80 675,100 C670,115 650,110 640,90 Z" transform="rotate(25 650 95)"/>
    <path d="M830,80 C845,65 870,70 865,90 C860,105 840,100 830,80 Z" transform="rotate(-15 845 85)"/>
    <path d="M490,40 C505,25 530,30 525,50 C520,65 500,60 490,40 Z" transform="rotate(40 505 45)"/>
    <path d="M380,110 C395,95 420,100 415,120 C410,135 390,130 380,110 Z" transform="rotate(-30 395 115)"/>
    <path d="M220,60 C235,45 260,50 255,70 C250,85 230,80 220,60 Z" transform="rotate(15 235 65)"/>
    <path d="M150,140 C165,125 190,130 185,150 C180,165 160,160 150,140 Z" transform="rotate(-45 165 145)"/>
  </g>
  <!-- Sparkles & Stars -->
  <g fill="%23ffffff" opacity="0.85">
    <path d="M780,110 L785,125 L800,130 L785,135 L780,150 L775,135 L760,130 L775,125 Z"/>
    <path d="M300,70 L303,80 L313,83 L303,86 L300,96 L297,86 L287,83 L297,80 Z"/>
    <path d="M570,140 L573,148 L581,151 L573,154 L570,162 L567,154 L559,151 L567,148 Z"/>
    <path d="M910,60 L912,66 L918,68 L912,70 L910,76 L908,70 L902,68 L908,66 Z"/>
  </g>
</svg>`;

// 2. Cyber Tech Matrix Banner: dark obsidian slate, cyan glowing circuit grid, futuristic nodes
const BANNER_TECH = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 240" width="100%" height="100%">
  <defs>
    <linearGradient id="techBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%23090d16"/>
      <stop offset="50%" stop-color="%230f172a"/>
      <stop offset="100%" stop-color="%23082f49"/>
    </linearGradient>
    <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="%2306b6d4" stop-opacity="0.1"/>
      <stop offset="50%" stop-color="%2306b6d4" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="%233b82f6" stop-opacity="0.2"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="240" fill="url(%23techBg)"/>
  <!-- Tech Grid Background -->
  <g stroke="%2306b6d4" stroke-width="0.8" opacity="0.15">
    <line x1="0" y1="40" x2="1000" y2="40"/>
    <line x1="0" y1="80" x2="1000" y2="80"/>
    <line x1="0" y1="120" x2="1000" y2="120"/>
    <line x1="0" y1="160" x2="1000" y2="160"/>
    <line x1="0" y1="200" x2="1000" y2="200"/>
    <line x1="100" y1="0" x2="100" y2="240"/>
    <line x1="250" y1="0" x2="250" y2="240"/>
    <line x1="400" y1="0" x2="400" y2="240"/>
    <line x1="550" y1="0" x2="550" y2="240"/>
    <line x1="700" y1="0" x2="700" y2="240"/>
    <line x1="850" y1="0" x2="850" y2="240"/>
  </g>
  <!-- Cyber Circuit Traces & Glow Nodes -->
  <path d="M0,120 L180,120 L240,60 L450,60 L510,120 L720,120 L780,180 L1000,180" fill="none" stroke="%2306b6d4" stroke-width="2.5" opacity="0.75"/>
  <path d="M100,240 L180,160 L380,160 L440,220 L680,220 L740,160 L920,160 L1000,80" fill="none" stroke="%233b82f6" stroke-width="1.8" opacity="0.65"/>
  <path d="M300,0 L360,60 L580,60 L640,0" fill="none" stroke="%2310b981" stroke-width="1.8" opacity="0.5"/>
  <!-- Glowing Nodes -->
  <circle cx="240" cy="60" r="5" fill="%2306b6d4" stroke="%23ffffff" stroke-width="1.5"/>
  <circle cx="510" cy="120" r="6" fill="%2338bdf8" stroke="%23ffffff" stroke-width="1.5"/>
  <circle cx="780" cy="180" r="5" fill="%2306b6d4" stroke="%23ffffff" stroke-width="1.5"/>
  <circle cx="380" cy="160" r="4.5" fill="%233b82f6" stroke="%23ffffff" stroke-width="1"/>
  <circle cx="740" cy="160" r="5" fill="%2310b981" stroke="%23ffffff" stroke-width="1.5"/>
  <!-- Matrix Hex / Tech Badge Accent -->
  <g transform="translate(860, 40)" opacity="0.4" stroke="%2306b6d4" stroke-width="1.5" fill="none">
    <polygon points="30,0 60,17 60,52 30,70 0,52 0,17"/>
    <polygon points="30,12 48,22 48,46 30,56 12,46 12,22"/>
  </g>
</svg>`;

// 3. Sunset Synthwave Banner: violet dusk to neon warm orange, horizon grid lines & radiant sun
const BANNER_SUNSET = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 240" width="100%" height="100%">
  <defs>
    <linearGradient id="sunsetSky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="%231e1b4b"/>
      <stop offset="45%" stop-color="%234c1d95"/>
      <stop offset="75%" stop-color="%23c026d3"/>
      <stop offset="100%" stop-color="%23f97316"/>
    </linearGradient>
    <linearGradient id="sunGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="%23fef08a"/>
      <stop offset="60%" stop-color="%23f97316"/>
      <stop offset="100%" stop-color="%23e11d48"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="240" fill="url(%23sunsetSky)"/>
  <!-- Glowing Synthwave Sun -->
  <circle cx="500" cy="170" r="100" fill="url(%23sunGrad)"/>
  <!-- Sun Blinds (horizontal stripes cutting through the sun) -->
  <rect x="380" y="145" width="240" height="4" fill="%234c1d95" opacity="0.9"/>
  <rect x="380" y="160" width="240" height="6" fill="%234c1d95" opacity="0.9"/>
  <rect x="380" y="178" width="240" height="9" fill="%234c1d95" opacity="0.9"/>
  <rect x="380" y="200" width="240" height="12" fill="%234c1d95" opacity="0.9"/>
  <!-- Mountain Silhouette in Background -->
  <polygon points="0,210 140,150 290,210 420,130 500,180 630,120 780,210 880,140 1000,210 1000,240 0,240" fill="%230f0c29" opacity="0.6"/>
  <!-- Horizon line -->
  <line x1="0" y1="210" x2="1000" y2="210" stroke="%23f43f5e" stroke-width="2"/>
  <!-- Stars in upper sky -->
  <g fill="%23ffffff" opacity="0.8">
    <circle cx="120" cy="30" r="1.5"/><circle cx="280" cy="50" r="2"/><circle cx="780" cy="35" r="1.5"/><circle cx="890" cy="65" r="2.5"/><circle cx="680" cy="20" r="1.5"/><circle cx="410" cy="40" r="1.2"/>
  </g>
</svg>`;

// 4. Emerald Forest Banner: botanical sage, mint, tropical monstera contours, organic serene aura
const BANNER_EMERALD = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 240" width="100%" height="100%">
  <defs>
    <linearGradient id="forestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%23064e3b"/>
      <stop offset="50%" stop-color="%23065f46"/>
      <stop offset="100%" stop-color="%23047857"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="240" fill="url(%23forestGrad)"/>
  <!-- Organic Leafy Silhouette Waves -->
  <path d="M0,240 Q250,80 500,240 T1000,240" fill="%23047857" opacity="0.4"/>
  <path d="M0,180 C200,60 400,200 600,120 C800,40 900,180 1000,140 L1000,240 L0,240 Z" fill="%2310b981" opacity="0.25"/>
  <!-- Botanical Palm Fronds Vector Outline -->
  <g stroke="%23a7f3d0" stroke-width="2" fill="none" opacity="0.35">
    <path d="M920,240 Q860,110 740,60"/>
    <path d="M830,130 Q780,100 760,80"/>
    <path d="M850,160 Q810,140 780,120"/>
    <path d="M880,190 Q840,180 810,160"/>
    <path d="M60,0 Q120,100 220,150"/>
    <path d="M120,60 Q170,80 190,95"/>
    <path d="M140,90 Q190,110 210,125"/>
  </g>
  <!-- Firefly / Sunlight Specks -->
  <g fill="%23fef08a" opacity="0.7">
    <circle cx="340" cy="80" r="3"/><circle cx="480" cy="140" r="2.5"/><circle cx="670" cy="90" r="3.5"/><circle cx="210" cy="170" r="2"/>
  </g>
</svg>`;

// 5. Obsidian Luxury Gold Banner: carbon stealth texture, gold geometric bevels, luxury sparkle
const BANNER_DARKLUXURY = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 240" width="100%" height="100%">
  <defs>
    <linearGradient id="obsidianBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%230a0a0a"/>
      <stop offset="60%" stop-color="%23171717"/>
      <stop offset="100%" stop-color="%23262626"/>
    </linearGradient>
    <linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="%23b45309"/>
      <stop offset="50%" stop-color="%23f59e0b"/>
      <stop offset="100%" stop-color="%23fef08a"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="240" fill="url(%23obsidianBg)"/>
  <!-- Diamond Geometrics & Gold Lines -->
  <g stroke="url(%23goldAccent)" stroke-width="1.5" fill="none" opacity="0.55">
    <polygon points="500,20 560,120 500,220 440,120"/>
    <polygon points="500,50 535,120 500,190 465,120"/>
    <line x1="0" y1="120" x2="440" y2="120"/>
    <line x1="560" y1="120" x2="1000" y2="120"/>
  </g>
  <g stroke="%23ffffff" stroke-width="0.75" opacity="0.1" fill="none">
    <polygon points="200,40 240,120 200,200 160,120"/>
    <polygon points="800,40 840,120 800,200 760,120"/>
  </g>
  <!-- Gold Stars -->
  <g fill="%23fef08a" opacity="0.85">
    <path d="M500,110 L503,117 L510,120 L503,123 L500,130 L497,123 L490,120 L497,117 Z"/>
    <path d="M200,113 L202,118 L207,120 L202,122 L200,127 L198,122 L193,120 L198,118 Z"/>
    <path d="M800,113 L802,118 L807,120 L802,122 L800,127 L798,122 L793,120 L798,118 Z"/>
  </g>
</svg>`;

// 6. Modern Clean Slate / Indigo Mesh Banner
const BANNER_DEFAULT = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 240" width="100%" height="100%">
  <defs>
    <linearGradient id="slateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%231e293b"/>
      <stop offset="50%" stop-color="%231e3a8a"/>
      <stop offset="100%" stop-color="%232563eb"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="240" fill="url(%23slateGrad)"/>
  <circle cx="850" cy="20" r="180" fill="%2338bdf8" opacity="0.25"/>
  <circle cx="150" cy="220" r="160" fill="%2360a5fa" opacity="0.2"/>
  <g stroke="%23ffffff" stroke-width="1" opacity="0.12">
    <line x1="0" y1="60" x2="1000" y2="60"/>
    <line x1="0" y1="120" x2="1000" y2="120"/>
    <line x1="0" y1="180" x2="1000" y2="180"/>
  </g>
</svg>`;

// Preset Avatar Illustrations (Crisp SVGs converted to data URIs)
export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'avatar_gamer_girl',
    name: '🌸 Gamer Girl',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="gAvatarBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%23fbcfe8"/><stop offset="100%" stop-color="%23f472b6"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(%23gAvatarBg)"/>
      <!-- Kitty Ears Headset -->
      <path d="M22,35 Q18,12 36,22" fill="%23ec4899" stroke="%23db2777" stroke-width="2"/>
      <path d="M78,35 Q82,12 64,22" fill="%23ec4899" stroke="%23db2777" stroke-width="2"/>
      <path d="M22,35 C22,18 78,18 78,35" fill="none" stroke="%23ffffff" stroke-width="4"/>
      <!-- Earcups -->
      <rect x="16" y="32" width="12" height="20" rx="6" fill="%23ffffff" stroke="%23f472b6" stroke-width="2"/>
      <rect x="72" y="32" width="12" height="20" rx="6" fill="%23ffffff" stroke="%23f472b6" stroke-width="2"/>
      <!-- Face -->
      <circle cx="50" cy="54" r="26" fill="%23fef2f2"/>
      <!-- Soft Pink Bangs -->
      <path d="M26,45 C32,32 68,32 74,45 C65,42 55,42 50,47 C45,42 35,42 26,45 Z" fill="%23f43f5e"/>
      <!-- Eyes with anime sparkle -->
      <ellipse cx="40" cy="54" rx="4" ry="5" fill="%23831843"/>
      <circle cx="41" cy="52" r="1.5" fill="%23ffffff"/>
      <ellipse cx="60" cy="54" rx="4" ry="5" fill="%23831843"/>
      <circle cx="61" cy="52" r="1.5" fill="%23ffffff"/>
      <!-- Blush -->
      <circle cx="34" cy="60" r="3" fill="%23f472b6" opacity="0.6"/>
      <circle cx="66" cy="60" r="3" fill="%23f472b6" opacity="0.6"/>
      <!-- Smile -->
      <path d="M47,62 Q50,65 53,62" fill="none" stroke="%23be185d" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'avatar_cyber_hacker',
    name: '⚡ Cyber Hacker',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="cAvatarBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%230f172a"/><stop offset="100%" stop-color="%23082f49"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(%23cAvatarBg)"/>
      <!-- Cyber Visor Glasses -->
      <rect x="22" y="42" width="56" height="16" rx="4" fill="%2306b6d4" stroke="%2322d3ee" stroke-width="1.5"/>
      <line x1="26" y1="50" x2="74" y2="50" stroke="%23ffffff" stroke-width="2"/>
      <!-- Hood -->
      <path d="M20,68 C20,25 80,25 80,68 C80,85 20,85 20,68 Z" fill="none" stroke="%2338bdf8" stroke-width="3"/>
      <!-- Terminal Prompt icon -->
      <text x="50" y="82" fill="%2306b6d4" font-family="monospace" font-size="12" font-weight="700" text-anchor="middle">&gt;_ DEV</text>
    </svg>`,
  },
  {
    id: 'avatar_pixel_gamer',
    name: '👾 Pixel Retro',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="pAvatarBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%23581c87"/><stop offset="100%" stop-color="%23a855f7"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(%23pAvatarBg)"/>
      <rect x="25" y="35" width="50" height="35" fill="%23e9d5ff" rx="4"/>
      <!-- Pixel Space Invader / Controller -->
      <rect x="35" y="44" width="8" height="8" fill="%236b21a8"/>
      <rect x="57" y="44" width="8" height="8" fill="%236b21a8"/>
      <rect x="42" y="58" width="16" height="4" fill="%236b21a8"/>
      <!-- Antennas -->
      <rect x="30" y="24" width="4" height="11" fill="%23e9d5ff"/>
      <rect x="66" y="24" width="4" height="11" fill="%23e9d5ff"/>
    </svg>`,
  },
  {
    id: 'avatar_botanical',
    name: '🌿 Botanical Green',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bAvatarBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%23065f46"/><stop offset="100%" stop-color="%2310b981"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(%23bAvatarBg)"/>
      <!-- Stylized Monstera / Clover Leaf -->
      <path d="M50,22 C40,35 25,45 35,65 C45,75 50,80 50,80 C50,80 55,75 65,65 C75,45 60,35 50,22 Z" fill="%23ecfdf5"/>
      <path d="M50,30 L50,75" stroke="%23059669" stroke-width="2.5"/>
      <path d="M50,45 Q40,40 34,44" stroke="%23059669" stroke-width="2"/>
      <path d="M50,55 Q60,50 66,54" stroke="%23059669" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'avatar_creator_star',
    name: '✨ Creator Star',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="sAvatarBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%23d97706"/><stop offset="100%" stop-color="%23fbbf24"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(%23sAvatarBg)"/>
      <!-- Star Sparkle Motif -->
      <path d="M50,15 L58,38 L82,42 L64,58 L70,82 L50,68 L30,82 L36,58 L18,42 L42,38 Z" fill="%23ffffff"/>
      <circle cx="50" cy="50" r="8" fill="%23f59e0b"/>
    </svg>`,
  },
];

// Preset Banners with descriptive visual styles
export const PRESET_BANNERS: PresetBanner[] = [
  {
    id: 'banner_flowerish',
    name: '🌸 Sakura & Gamer Girl',
    category: 'Aesthetic / Gaming',
    svg: BANNER_FLOWERISH,
    previewGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 40%, #f472b6 100%)',
  },
  {
    id: 'banner_tech',
    name: '⚡ Cyber Tech Matrix',
    category: 'Tech / Developer',
    svg: BANNER_TECH,
    previewGradient: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #082f49 100%)',
  },
  {
    id: 'banner_sunset',
    name: '🌅 Sunset Synthwave',
    category: 'Vibrant / Streamer',
    svg: BANNER_SUNSET,
    previewGradient: 'linear-gradient(135deg, #1e1b4b 0%, #c026d3 55%, #f97316 100%)',
  },
  {
    id: 'banner_emerald',
    name: '🌿 Emerald Sanctuary',
    category: 'Nature / Minimalist',
    svg: BANNER_EMERALD,
    previewGradient: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
  },
  {
    id: 'banner_darkluxury',
    name: '✨ Obsidian & Gold',
    category: 'Luxury / Pro',
    svg: BANNER_DARKLUXURY,
    previewGradient: 'linear-gradient(135deg, #0a0a0a 0%, #171717 60%, #b45309 100%)',
  },
  {
    id: 'banner_default',
    name: '🔹 Modern Indigo Slate',
    category: 'Clean / Default',
    svg: BANNER_DEFAULT,
    previewGradient: 'linear-gradient(135deg, #1e293b 0%, #1e3a8a 50%, #2563eb 100%)',
  },
];

// Theme Templates Collection
export const PROFILE_THEMES: Record<ProfileTheme['id'], ProfileTheme> = {
  default: {
    id: 'default',
    name: 'Modern Clean',
    tagline: 'Refined indigo slate with clean balance',
    categoryTag: 'Standard',
    accentColor: '#2563eb',
    secondaryAccent: '#3b82f6',
    heroBg: 'var(--card-bg)',
    heroBorder: 'var(--border-color)',
    badgeBg: 'rgba(37, 99, 235, 0.12)',
    badgeColor: '#2563eb',
    bannerSvg: BANNER_DEFAULT,
    previewColor: '#2563eb',
    bannerStyleName: 'banner_default',
  },
  flowerish: {
    id: 'flowerish',
    name: '🌸 Flowerish & Gamer Girl',
    tagline: 'Sakura petals, soft pastel pinks & cute gamer vibes',
    categoryTag: 'Aesthetic / Girl Gamers',
    accentColor: '#ec4899',
    secondaryAccent: '#f43f5e',
    heroBg: 'linear-gradient(to bottom, #fff5f7, #ffffff)',
    heroBorder: 'rgba(244, 114, 182, 0.35)',
    badgeBg: 'rgba(236, 72, 153, 0.14)',
    badgeColor: '#db2777',
    bannerSvg: BANNER_FLOWERISH,
    previewColor: '#ec4899',
    bannerStyleName: 'banner_flowerish',
  },
  tech: {
    id: 'tech',
    name: '⚡ Cyber Tech Matrix',
    tagline: 'Futuristic circuit nodes, terminal cyan & dark cyber aesthetic',
    categoryTag: 'Tech / Developers',
    accentColor: '#06b6d4',
    secondaryAccent: '#3b82f6',
    heroBg: 'linear-gradient(to bottom, #090e17, #0f172a)',
    heroBorder: 'rgba(6, 182, 212, 0.45)',
    badgeBg: 'rgba(6, 182, 212, 0.18)',
    badgeColor: '#22d3ee',
    bannerSvg: BANNER_TECH,
    previewColor: '#06b6d4',
    bannerStyleName: 'banner_tech',
  },
  sunset: {
    id: 'sunset',
    name: '🌅 Sunset Synthwave',
    tagline: 'Retro magenta horizon with neon orange and dusk violet',
    categoryTag: 'Creators / Streamers',
    accentColor: '#c026d3',
    secondaryAccent: '#f97316',
    heroBg: 'linear-gradient(to bottom, #1e1b4b, #2e1065)',
    heroBorder: 'rgba(192, 38, 211, 0.4)',
    badgeBg: 'rgba(192, 38, 211, 0.2)',
    badgeColor: '#f472b6',
    bannerSvg: BANNER_SUNSET,
    previewColor: '#c026d3',
    bannerStyleName: 'banner_sunset',
  },
  emerald: {
    id: 'emerald',
    name: '🌿 Emerald Botanical',
    tagline: 'Serene forest greens, organic contours & fresh botanical calm',
    categoryTag: 'Nature & Zen',
    accentColor: '#059669',
    secondaryAccent: '#10b981',
    heroBg: 'linear-gradient(to bottom, #064e3b, #065f46)',
    heroBorder: 'rgba(16, 185, 129, 0.35)',
    badgeBg: 'rgba(16, 185, 129, 0.18)',
    badgeColor: '#34d399',
    bannerSvg: BANNER_EMERALD,
    previewColor: '#10b981',
    bannerStyleName: 'banner_emerald',
  },
  darkluxury: {
    id: 'darkluxury',
    name: '✨ Obsidian Gold Luxury',
    tagline: 'Stealth charcoal with luminous gold borders and executive polish',
    categoryTag: 'Luxury / Pro',
    accentColor: '#f59e0b',
    secondaryAccent: '#d97706',
    heroBg: 'linear-gradient(to bottom, #111111, #1c1917)',
    heroBorder: 'rgba(245, 158, 11, 0.45)',
    badgeBg: 'rgba(245, 158, 11, 0.16)',
    badgeColor: '#fbbf24',
    bannerSvg: BANNER_DARKLUXURY,
    previewColor: '#f59e0b',
    bannerStyleName: 'banner_darkluxury',
  },
};

export const getThemeById = (id?: string): ProfileTheme => {
  if (id && id in PROFILE_THEMES) {
    return PROFILE_THEMES[id as ProfileTheme['id']];
  }
  return PROFILE_THEMES.default;
};

export const THEME_LIST: ProfileTheme[] = Object.values(PROFILE_THEMES);

export const getBannerSvg = (bannerStyle?: string, themeId?: string): string => {
  if (bannerStyle) {
    const found = PRESET_BANNERS.find((b) => b.id === bannerStyle);
    if (found) return found.svg;
  }
  const theme = getThemeById(themeId);
  return theme.bannerSvg;
};
