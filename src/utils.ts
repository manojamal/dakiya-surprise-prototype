import { CelebrativeEvent, BirthdayContact, ActivityFeedItem, MediaItem, TextOverlay, PlanTier, UserProfile } from './types';

export const TIERS: Record<string, PlanTier> = {
  freemium: {
    id: 'freemium', l: 'Freemium', i: '🆓', p: 'Free', c: '#5C6B8A', bg: '#F0F2F8', badge: 'FREE',
    msgAllowance: 2, videoUploads: 1, signUpPoints: 20, referralPoints: 20,
    studio: 'basic', personalization: 'basic', celebrations: ['Birthday'],
    deliverySpeed: 'basic', support: 'Self-service (FAQ)', ai: false, mixer: false, premiumEffects: false, price: 0
  },
  standard: {
    id: 'standard', l: 'Standard', i: '⭐', p: '₦2,500', c: '#0A7A4A', bg: '#F0FFF8', badge: 'STANDARD',
    msgAllowance: 20, videoUploads: 5, signUpPoints: 50, referralPoints: 50,
    studio: 'standard', personalization: 'occasion', celebrations: 'all',
    deliverySpeed: 'scheduled', support: 'Email support', ai: false, mixer: false, premiumEffects: false, price: 2500
  },
  gold: {
    id: 'gold', l: 'Gold', i: '🥇', p: '₦4,999', c: '#B07A00', bg: '#FFF8E6', badge: 'GOLD',
    msgAllowance: 75, videoUploads: 20, signUpPoints: 100, referralPoints: 100,
    studio: 'full', personalization: 'advanced', celebrations: 'all',
    deliverySpeed: 'priority', support: 'Priority support', ai: true, mixer: true, premiumEffects: false, price: 4999
  },
  elite: {
    id: 'elite', l: 'Elite', i: '💎', p: '₦9,999', c: '#6B21D9', bg: '#F3EBFF', badge: 'ELITE',
    msgAllowance: Infinity, videoUploads: Infinity, signUpPoints: 300, referralPoints: 300,
    studio: 'premium', personalization: 'hyper', celebrations: 'all+custom',
    deliverySpeed: 'realtime', support: 'Dedicated concierge', ai: true, mixer: true, premiumEffects: true, price: 9999
  },
  demo: {
    id: 'demo', l: 'Demo', i: '🚀', p: 'Free', c: '#FF6B1A', bg: '#FFF8F0', badge: 'DEMO',
    msgAllowance: Infinity, videoUploads: Infinity, signUpPoints: 999, referralPoints: 999,
    studio: 'premium', personalization: 'hyper', celebrations: 'all+custom',
    deliverySpeed: 'realtime', support: 'Dedicated concierge', ai: true, mixer: true, premiumEffects: true, price: 0
  }
};

export const SURPRISE_THEMES = [
  { id: 'classic', name: 'Classic Orange', desc: 'Warm & celebratory — the ZippZap default',
    colors: { orange: '#FF6B1A', c1: '#FFF8F0', c2: '#FFF0E4', ink: '#1C1207' }, emoji: '🎉' },
  { id: 'royal', name: 'Royal Purple', desc: 'Elegant & prestigious',
    colors: { orange: '#6B21D9', c1: '#F8F0FF', c2: '#F0E8FF', ink: '#1A0A2E' }, emoji: '👑' },
  { id: 'emerald', name: 'Emerald Green', desc: 'Fresh, natural & vibrant',
    colors: { orange: '#0A7A4A', c1: '#F0FFF8', c2: '#E0FFF0', ink: '#0A2010' }, emoji: '💚' },
  { id: 'midnight', name: 'Midnight Dark', desc: 'Bold, modern & dramatic',
    colors: { orange: '#4A9EFF', c1: '#0D1117', c2: '#161B22', ink: '#E6EDF3' }, emoji: '🌙' },
  { id: 'rose', name: 'Rose Gold', desc: 'Soft, romantic & feminine',
    colors: { orange: '#C96B8A', c1: '#FFF0F4', c2: '#FFE0EA', ink: '#2E0A18' }, emoji: '🌹' },
  { id: 'naija', name: 'Naija Vibes', desc: 'Green-white-green Nigerian pride!',
    colors: { orange: '#008751', c1: '#F0FFF4', c2: '#E0FFE8', ink: '#0A1E10' }, emoji: '🇳🇬' },
  { id: 'gold', name: 'Gold & Black', desc: 'Luxurious, premium & VIP',
    colors: { orange: '#D4A820', c1: '#1A1500', c2: '#221D00', ink: '#F5E6A0' }, emoji: '✨' },
  { id: 'ocean', name: 'Ocean Blue', desc: 'Cool, calm & professional',
    colors: { orange: '#0070F3', c1: '#EFF6FF', c2: '#DBEAFE', ink: '#0A1628' }, emoji: '🌊' },
  { id: 'sunset', name: 'Sunset Theme', desc: 'Warm gradient sunset style',
    colors: { orange: '#FF6B6B', c1: '#FFF0F0', c2: '#FFE4E4', ink: '#2E0A0A' }, emoji: '🌅' }
];

export const BUILTIN_MUSIC = [
  { id: 'bm1', n: 'Afrobeats Celebration', g: 'Afrobeats', d: '3:10', e: '🎺' },
  { id: 'bm2', n: 'Happy Birthday Piano', g: 'Classical', d: '2:30', e: '🎹' },
  { id: 'bm3', n: 'Naija Party Vibes', g: 'Afropop', d: '2:55', e: '🎸' },
  { id: 'bm4', n: 'Emotional Strings', g: 'Cinematic', d: '3:20', e: '🎻' },
  { id: 'bm5', n: 'Soft Gospel Choir', g: 'Gospel', d: '3:45', e: '🎤' },
  { id: 'bm6', n: 'Drum & Bass Energy', g: 'Electronic', d: '2:40', e: '🥁' }
];

export const PIPELINE_STAGES = [
  { id: 0, label: 'Event Created', icon: '✦', desc: 'Surprise event set up' },
  { id: 1, label: 'Invites Sent', icon: '📨', desc: 'Contributors notified' },
  { id: 2, label: 'Collecting Wishes', icon: '💌', desc: 'Contributors submitting' },
  { id: 3, label: 'Compiling', icon: '🤖', desc: 'Building the video' },
  { id: 4, label: 'Ready to Send', icon: '✅', desc: 'Video ready for delivery' },
  { id: 5, label: 'Delivered', icon: '🎊', desc: 'Surprise sent!' }
];

export const PHOTO_FRAMES = [
  { id: 'none', name: 'No Frame' },
  { id: 'white', name: 'White Border' },
  { id: 'gold', name: 'Gold Elegant' },
  { id: 'shadow', name: 'Drop Shadow' },
  { id: 'polaroid', name: 'Polaroid' },
  { id: 'vintage', name: 'Vintage' },
  { id: 'rounded', name: 'Rounded' },
  { id: 'film', name: 'Film Strip' }
];

export const SS_TRANSITIONS = [
  { id: 'fade', name: 'Fade', icon: '🌫️' },
  { id: 'slide-l', name: 'Slide Left', icon: '◀' },
  { id: 'slide-r', name: 'Slide Right', icon: '▶' },
  { id: 'zoom-in', name: 'Zoom In', icon: '🔍' },
  { id: 'zoom-out', name: 'Zoom Out', icon: '🔎' },
  { id: 'flip', name: 'Flip', icon: '🔄' },
  { id: 'wipe', name: 'Wipe', icon: '↔️' },
  { id: 'dissolve', name: 'Dissolve', icon: '✨' },
  { id: 'none', name: 'Cut', icon: '✂️' }
];

const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const fd = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().split('T')[0]; };
const pd = (d: number) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().split('T')[0]; };

export const fmtD = (s: string) => new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
export const daysTo = (s: string) => Math.ceil((new Date(s).getTime() - new Date().getTime()) / 86400000);
export const fmtT = (s: number) => { if (!s || isNaN(s)) return '0:00'; const m = Math.floor(s / 60), sec = Math.floor(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; };

export function getMediaDur(url: string, type: string = 'video'): Promise<number> {
  return new Promise(res => {
    const el = document.createElement(type === 'audio' ? 'audio' : 'video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => res(el.duration || 0);
    el.onerror = () => res(0);
    el.src = url;
  });
}

export function capVidThumb(url: string): Promise<string | null> {
  return new Promise(res => {
    const v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.preload = 'auto';
    v.currentTime = 0.5;
    v.oncanplay = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 180;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(v, 0, 0, 320, 180);
          res(c.toDataURL());
        } else {
          res(null);
        }
      } catch (e) {
        res(null);
      }
    };
    v.onerror = () => res(null);
    v.load();
  });
}


export function seedData() {
  const now = Date.now();
  const events: CelebrativeEvent[] = [
    {
      id: 'e1', title: "Oluwaseun's 30th Birthday", occ: 'Birthday', cel: 'Oluwaseun Adeyemi', date: fd(9), emoji: '🎂', status: 'active',
      invites: [
        { name: 'Emeka Obi', contact: 'emeka@demo.ng', sent: true, responded: true, viewed: true, method: 'WhatsApp' },
        { name: 'Chiamaka Eze', contact: 'chiamaka@demo.ng', sent: true, responded: true, viewed: true, method: 'Email' },
        { name: 'Babatunde Adewale', contact: 'babatunde@demo.ng', sent: true, responded: false, viewed: true, method: 'SMS' },
        { name: 'Kemi Adesanya', contact: 'kemi@demo.ng', sent: true, responded: false, viewed: false, method: 'WhatsApp' }
      ],
      uploads: [], link: 'SEUN30NG', pipeline: 2, created: now - 86400000 * 2
    },
    {
      id: 'e2', title: "Mama Nkechi's Anniversary", occ: 'Anniversary', cel: 'Chief & Mrs Nwosu', date: fd(3), emoji: '💍', status: 'active',
      invites: [
        { name: 'Chidi Okeke', contact: 'chidi@demo.ng', sent: true, responded: true, viewed: true, method: 'WhatsApp' }
      ],
      uploads: [], link: 'NKECHI25NG', pipeline: 1, created: now - 86400000 * 4
    },
    {
      id: 'e3', title: "Damilola's Graduation", occ: 'Graduation', cel: 'Damilola Obaseki', date: pd(5), emoji: '🎓', status: 'delivered',
      invites: [], uploads: [], link: 'DAMI2025NG', pipeline: 5, created: now - 86400000 * 12
    }
  ];

  const birthdays: BirthdayContact[] = [
    { id: 'b1', name: 'Oluwaseun Adeyemi', rel: 'Friend', date: fd(9), phone: '+234 803 456 7890', emoji: '🧑' },
    { id: 'b2', name: 'Kemi Adesanya', rel: 'Family', date: fd(14), phone: '+234 807 654 3210', emoji: '👩' },
    { id: 'b3', name: 'Obinna Nwosu', rel: 'Colleague', date: fd(22), phone: '+234 809 876 5432', emoji: '👨' },
    { id: 'b4', name: 'Funke Akindele', rel: 'Friend', date: fd(30), phone: '+234 802 111 2222', emoji: '👩' }
  ];

  const activity: ActivityFeedItem[] = [
    { id: 'act_1', type: 'done', icon: '💌', text: "Chiamaka submitted a voice note", time: '4h ago', stage: 'Collecting Wishes' },
    { id: 'act_2', type: 'done', icon: '📨', text: 'Invite sent to 4 contributors', time: '1d ago', stage: 'Invites Sent' },
    { id: 'act_3', type: 'done', icon: '✦', text: "Oluwaseun's Birthday event created", time: '2d ago', stage: 'Event Created' },
    { id: 'act_4', type: 'done', icon: '⭐', text: 'Damilola rated their surprise 5 stars!', time: '5d ago', stage: 'Delivered' }
  ];

  const timeline = { v: [], a: [], t: [], p: [], m: [] };
  const overlays: TextOverlay[] = [
    { id: 'o1', text: 'Happy 30th Birthday Oluwaseun! 🎂', pos: 'centre', color: '#FF6B1A', size: 48 },
    { id: 'o2', text: 'From all of us with love 💕', pos: 'bottom', color: '#ffffff', size: 36 }
  ];

  return { events, birthdays, activity, timeline, overlays };
}

export const CP_ACCOUNTS = {
  'emeka@demo.ng': { name: 'Emeka Obi', pw: 'demo1234' },
  'chiamaka@demo.ng': { name: 'Chiamaka Eze', pw: 'demo1234' },
  'babatunde@demo.ng': { name: 'Babatunde Adewale', pw: 'demo1234' },
  'kemi@demo.ng': { name: 'Kemi Adesanya', pw: 'demo1234' }
};

export const DEMO_ACCOUNTS: Record<string, UserProfile> = {
  'adaeze@demo.ng': { name: 'Adaeze Okonkwo', pw: 'demo1234', tier: 'demo', isDemo: true, em: 'adaeze@demo.ng', phone: '+234 801 234 5678', city: 'Lagos', points: 999, monthlyMsgCount: 0 },
  'silver@demo.ng': { name: 'Chukwuemeka Eze', pw: 'demo1234', tier: 'demo', isDemo: true, em: 'silver@demo.ng', phone: '', city: 'Abuja', points: 450, monthlyMsgCount: 0 },
  'diamond@demo.ng': { name: 'Ngozi Adichie', pw: 'demo1234', tier: 'demo', isDemo: true, em: 'diamond@demo.ng', phone: '+234 812 345 6789', city: 'Enugu', points: 1200, monthlyMsgCount: 0 }
};

export function applyThemeStyle(colors: { orange: string; c1: string; c2: string; ink: string }) {
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const adjustColor = (hex: string, amount: number) => {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  const root = document.documentElement.style;
  root.setProperty('--orange', colors.orange);
  root.setProperty('--oran2', adjustColor(colors.orange, 30));
  root.setProperty('--c1', colors.c1);
  root.setProperty('--c2', colors.c2);
  root.setProperty('--ink', colors.ink);
  root.setProperty('--oran-l', hexToRgba(colors.orange, 0.1));
  root.setProperty('--oran-m', hexToRgba(colors.orange, 0.3));
}
