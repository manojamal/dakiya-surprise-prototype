import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CelebrativeEvent,
  BirthdayContact,
  ActivityFeedItem,
  MediaItem,
  UserProfile
} from './types';
import { seedData, DEMO_ACCOUNTS, TIERS, applyThemeStyle } from './utils';

interface ToastMsg {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  title?: string;
}

// Component Imports
import Dashboard from './components/Dashboard';
import Celebrations from './components/Celebrations';
import MediaLibrary from './components/MediaLibrary';
import UploadForm from './components/UploadForm';
import VideoStudio from './components/VideoStudio';
import SlideshowStudio from './components/SlideshowStudio';
import TextToSpeech from './components/TextToSpeech';
import ThemeSelector from './components/ThemeSelector';
import ReactionRecorder from './components/ReactionRecorder';
import Plans from './components/Plans';
import Profile from './components/Profile';
import Delivery from './components/Delivery';
import Tracker from './components/Tracker';
import ContributorPortal from './components/ContributorPortal';
import CreateCampaign from './components/CreateCampaign';

export default function App() {
  // Toast notifications states
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success', title?: string) => {
    const id = 'toast_' + Date.now() + Math.random().toString(36).substr(2, 4);
    setToasts(prev => [...prev, { id, message, type, title }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const isFirstLoadBirthdaysRef = useRef(true);
  const isFirstLoadClipsRef = useRef(true);
  const isFirstLoadEventsRef = useRef(true);

  // Persistence state loaders
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('zz_logged_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [prefilledContact, setPrefilledContact] = useState<BirthdayContact | null>(null);

  const [events, setEvents] = useState<CelebrativeEvent[]>(() => {
    const saved = localStorage.getItem('zz_events');
    return saved ? JSON.parse(saved) : seedData().events;
  });

  const [birthdays, setBirthdays] = useState<BirthdayContact[]>(() => {
    const saved = localStorage.getItem('zz_birthdays');
    return saved ? JSON.parse(saved) : seedData().birthdays;
  });

  const [activity, setActivity] = useState<ActivityFeedItem[]>(() => {
    const saved = localStorage.getItem('zz_activity');
    return saved ? JSON.parse(saved) : seedData().activity;
  });

  const [media, setMedia] = useState<MediaItem[]>(() => {
    const saved = localStorage.getItem('zz_media');
    return saved ? JSON.parse(saved) : [];
  });

  // UI state managers
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPortalId, setShowPortalId] = useState<string | null>(null);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);

  // Authentication Fields state
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [loginEmail, setLoginEmail] = useState('adaeze@demo.ng');
  const [loginPassword, setLoginPassword] = useState('demo1234');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPlan, setRegPlan] = useState('gold');

  // Video Studio timeline clips
  const [studioClips, setStudioClips] = useState<any[]>(() => {
    const saved = localStorage.getItem('zz_studio_clips');
    return saved ? JSON.parse(saved) : [];
  });
  const [studioTimeline, setStudioTimeline] = useState<number[]>(() => {
    const saved = localStorage.getItem('zz_studio_timeline');
    return saved ? JSON.parse(saved) : [];
  });

  // Synchronize dynamic changes into localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('zz_logged_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('zz_logged_user');
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('zz_events', JSON.stringify(events));
    if (isFirstLoadEventsRef.current) {
      isFirstLoadEventsRef.current = false;
    } else {
      showToast('Surprise campaign details saved successfully.', 'success', 'AUTOSAVE PERSISTENCE');
    }
  }, [events]);

  useEffect(() => {
    localStorage.setItem('zz_birthdays', JSON.stringify(birthdays));
    if (isFirstLoadBirthdaysRef.current) {
      isFirstLoadBirthdaysRef.current = false;
    } else {
      showToast('Birthday contacts list saved successfully.', 'success', 'AUTOSAVE PERSISTENCE');
    }
  }, [birthdays]);

  useEffect(() => {
    localStorage.setItem('zz_activity', JSON.stringify(activity));
  }, [activity]);

  useEffect(() => {
    localStorage.setItem('zz_media', JSON.stringify(media));
  }, [media]);

  useEffect(() => {
    localStorage.setItem('zz_studio_clips', JSON.stringify(studioClips));
    if (isFirstLoadClipsRef.current) {
      isFirstLoadClipsRef.current = false;
    } else {
      showToast('Video studio timeline changes saved successfully.', 'success', 'AUTOSAVE PERSISTENCE');
    }
  }, [studioClips]);

  useEffect(() => {
    localStorage.setItem('zz_studio_timeline', JSON.stringify(studioTimeline));
  }, [studioTimeline]);

  // Auth logins
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const match = DEMO_ACCOUNTS[loginEmail];
    if (match && match.pw === loginPassword) {
      setUser(match);
      setCurrentPage('dashboard');
    } else {
      // Create guest fallback if demo not present
      const guest: UserProfile = {
        name: loginEmail.split('@')[0],
        em: loginEmail,
        pw: loginPassword,
        tier: 'gold',
        phone: '',
        city: 'Nigeria',
        points: 150,
        monthlyMsgCount: 0
      };
      setUser(guest);
      setCurrentPage('dashboard');
    }
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) return;

    const newUser: UserProfile = {
      name: regName,
      em: regEmail,
      pw: regPassword,
      tier: regPlan,
      phone: '',
      city: 'Nigeria',
      points: regPlan === 'elite' ? 300 : regPlan === 'gold' ? 100 : 20,
      monthlyMsgCount: 0
    };
    setUser(newUser);
    setCurrentPage('dashboard');
  };

  const handleQuickLogin = (emailKey: string) => {
    const acc = DEMO_ACCOUNTS[emailKey];
    if (acc) {
      setUser(acc);
      setCurrentPage('dashboard');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('dashboard');
  };

  // Add Contact logic
  const handleAddContact = (contact: Omit<BirthdayContact, 'id'>) => {
    const newContact: BirthdayContact = {
      id: 'bd_' + Date.now(),
      ...contact
    };
    setBirthdays(prev => [newContact, ...prev]);
    setActivity(prev => [
      {
        id: 'act_' + Date.now(),
        type: 'done',
        icon: '🎂',
        text: `Added contact entry: ${contact.name}`,
        time: 'Just now',
        stage: 'Calendar update'
      },
      ...prev
    ]);
  };

  const handlePlanSurprise = (id: string) => {
    const match = birthdays.find(b => b.id === id);
    if (!match) return;
    setPrefilledContact(match);
    setCurrentPage('create');
  };

  const handleDeleteContact = (id: string) => {
    setBirthdays(prev => prev.filter(c => c.id !== id));
  };

  // Save Media uploaded
  const handleSaveMedia = (newObj: any) => {
    const item: MediaItem = {
      id: 'med_' + Date.now(),
      created: Date.now(),
      ...newObj
    };
    setMedia(prev => [...prev, item]);
    setActivity(prev => [
      {
        id: 'act_' + Date.now(),
        type: 'done',
        icon: item.type === 'video' ? '🎬' : '🎙️',
        text: `Uploaded raw file: ${item.name}`,
        time: 'Just now',
        stage: 'Library update'
      },
      ...prev
    ]);
  };

  const handleSaveTextMedia = (data: { text: string; from: string; style: string }) => {
    const item: MediaItem = {
      id: 'med_' + Date.now(),
      type: 'text',
      name: `${data.from}'s Written Wish`,
      from: data.from,
      note: 'Written entry letter',
      event: '',
      size: data.text.length + ' chars',
      dur: 6,
      url: null,
      thumb: null,
      textBody: data.text,
      style: data.style,
      created: Date.now()
    };
    setMedia(prev => [...prev, item]);
    setActivity(prev => [
      {
        id: 'act_' + Date.now(),
        type: 'done',
        icon: '✍️',
        text: `Added text letter from: ${data.from}`,
        time: 'Just now',
        stage: 'Library update'
      },
      ...prev
    ]);
  };

  const handlePhotosUploaded = (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      const item: MediaItem = {
        id: 'med_photo_' + Date.now() + '_' + i,
        type: 'photo',
        name: file.name.replace(/\.[^.]+$/, ''),
        from: user?.name || 'Manager',
        note: 'Uploaded photo asset',
        event: 'General',
        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        dur: 0,
        url: url,
        thumb: url,
        created: Date.now()
      };
      setMedia(prev => [...prev, item]);
    }
  };

  // Selection managers
  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    setMedia(prev => prev.filter(m => !selectedIds.has(m.id)));
    setSelectedIds(new Set());
  };

  const handleClearDeliveredCache = () => {
    const deliveredEventIds = new Set(events.filter(e => e.status === 'delivered').map(e => e.id));
    setMedia(prev => prev.filter(m => !m.event || !deliveredEventIds.has(m.event)));
    showToast('Delivered campaign raw cache cleaned successfully!', 'success', 'CACHE CLEANER');
  };

  const handleUseSelectionInStudio = () => {
    const filtered = media.filter(m => selectedIds.has(m.id) && m.type === 'video');
    const newClips = filtered.map(item => ({
      id: item.id,
      file: item.file || null,
      url: item.url,
      dur: item.dur || 5,
      name: item.name,
      thumb: item.thumb,
      trimStart: 0,
      trimEnd: item.dur || 5,
      transition: 'fade'
    }));

    setStudioClips(prev => [...prev, ...newClips]);
    setStudioTimeline(prev => [...prev, ...newClips.map((_, i) => prev.length + i)]);
    setSelectedIds(new Set());
    setCurrentPage('studio');
  };

  // Video Studio clips loader trigger
  const handleAddNewClip = (file: File) => {
    const url = URL.createObjectURL(file);
    const item = {
      id: 'clip_' + Date.now(),
      file,
      url,
      dur: 10, // Simulated preloaded duration
      name: file.name,
      thumb: null,
      trimStart: 0,
      trimEnd: 10,
      transition: 'fade'
    };
    setStudioClips(prev => [...prev, item]);
    setStudioTimeline(prev => [...prev, prev.length]);
  };

  // Delivery trigger
  const handleMarkDelivered = (id: string) => {
    setEvents(prev =>
      prev.map(e => (e.id === id ? { ...e, status: 'delivered', pipeline: 5 } : e))
    );
    setActivity(prev => [
      {
        id: 'act_' + Date.now(),
        type: 'done',
        icon: '🚀',
        text: 'Surprise delivery fired to celebrant!',
        time: 'Just now',
        stage: 'Delivery pipeline complete'
      },
      ...prev
    ]);
  };

  const handlePortalWishSubmission = (data: {
    type: 'video' | 'audio' | 'text' | 'photo';
    from: string;
    note: string;
    textBody?: string;
    url?: string | null;
    style?: string;
  }) => {
    const item: MediaItem = {
      id: 'med_portal_' + Date.now(),
      type: data.type,
      name: `${data.from}'s Contribution wish`,
      from: data.from,
      note: data.note,
      event: showPortalId || 'surprise campaign',
      size: '—',
      dur: data.type === 'text' ? 6 : data.type === 'photo' ? 5 : 12,
      url: data.url || null,
      thumb: data.type === 'photo' ? data.url || null : null,
      textBody: data.textBody,
      style: data.style || 'gradient',
      created: Date.now()
    };
    setMedia(prev => [...prev, item]);
    setActivity(prev => [
      {
        id: 'act_' + Date.now(),
        type: 'done',
        icon: '📨',
        text: `${data.from} submitted a wish through the Contributor Portal`,
        time: 'Just now',
        stage: 'Portal Submission'
      },
      ...prev
    ]);

    // Live alert of submitted wish contribution
    showToast(
      `${data.from} submitted a new ${data.type} wish. Check event dashboard!`,
      'success',
      'NEW CONTRIBUTOR WISH RECEIVED'
    );
  };

  // Prebuilt soundtrack clicker inside Studio/Slideshow
  const handleUsePrebuiltSoundtrack = (musicId: string) => {
    setActivity(prev => [
      {
        id: 'act_' + Date.now(),
        type: 'done',
        icon: '🎵',
        text: `Loaded surprise background track ID: ${musicId}`,
        time: 'Just now',
        stage: 'Vocal/Mix updates'
      },
      ...prev
    ]);
  };

  // Navigation Options configurations grouped by logical workspace chapters
  const NAV_SECTIONS = [
    {
      title: 'Core chapters',
      items: [
        { id: 'dashboard', l: 'Dashboard hub', icon: '📊' },
        { id: 'birthdays', l: 'Calendar Campaigns', icon: '🎂' },
        { id: 'tracker', l: 'Pipeline logs', icon: '📈' }
      ]
    },
    {
      title: 'Creative studios',
      items: [
        { id: 'studio', l: 'Video Stitcher', icon: '🎬' },
        { id: 'slideshow', l: 'Slideshow Creator', icon: '🖼️' },
        { id: 'tts', l: 'Synthesizer TTS', icon: '🔊' }
      ]
    },
    {
      title: 'Media & wishes bin',
      items: [
        { id: 'library', l: 'Media Vault', icon: '🗂️' },
        { id: 'upload', l: 'Upload Wishes', icon: '📤' }
      ]
    },
    {
      title: 'Fulfillment',
      items: [
        { id: 'delivery', l: 'Surprise Dispatch', icon: '🚀' }
      ]
    },
    {
      title: 'Account & Colors',
      items: [
        { id: 'profile', l: 'Member Profile', icon: '👤' },
        { id: 'plans', l: 'Pricing Tiers', icon: '⭐' },
        { id: 'themes', l: 'Canvas Theme', icon: '🎨' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-[#1C1207] font-sans antialiased flex flex-col">
      
      {/* AUTH SCREEN COVER */}
      {!user && (
        <div className="fixed inset-0 bg-[#FFF8F0] z-[9999] flex flex-col lg:flex-row shadow-2xl">
          {/* Left panel branding */}
          <div className="lg:w-[420px] bg-slate-950 p-8 flex flex-col justify-between text-white relative overflow-hidden shrink-0">
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>ZippZap</span> <span className="text-indigo-400">⚡</span>
              </h2>
              <p className="text-xs text-slate-400">Perfect team and group surprises balance manager</p>
            </div>

            <div className="space-y-4 py-8 lg:py-0 select-none">
              <div className="flex gap-3 items-start bg-white/5 border border-white/10 rounded-2xl p-4">
                <span className="text-2xl">🎂</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Upcoming Calendars</h4>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">Never lose track of important celebration countdown benchmarks.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-white/5 border border-white/10 rounded-2xl p-4">
                <span className="text-2xl">🤵</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Surprise Milestones</h4>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">Monitor wish collection workflows in beautiful pipelines graphs.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-white/5 border border-white/10 rounded-2xl p-4">
                <span className="text-2xl">🎬</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Canvas Stitcher engine</h4>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">Merge audio sound mixers, voice clips, subtitles, and picture frames into high quality output.</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500">Trusted by thousands for life's special moments ⭐⭐⭐⭐⭐</p>
          </div>

          {/* Right form layout */}
          <div className="flex-1 overflow-y-auto px-6 py-12 flex items-center justify-center bg-white shadow-inner">
            <div className="w-full max-w-sm space-y-6">
              <div className="space-y-1.5 text-center lg:text-left">
                <h1 className="text-xl md:text-2xl font-black">Plan matching surprises</h1>
                <p className="text-xs text-slate-500">Log in or generate a guest profile to start organizing celebration campaigns</p>
              </div>

              {/* Login / Register selector toggler */}
              <div className="flex bg-[#FFF8F0]/80 p-1 border border-slate-100 rounded-xl max-w-xs mx-auto lg:mx-0">
                <button
                  onClick={() => setAuthTab('login')}
                  className={`flex-1 text-center py-2.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    authTab === 'login' ? 'bg-white shadow-md text-stone-900' : 'text-slate-500'
                  }`}
                >
                  Log In
                </button>
                <button
                  onClick={() => setAuthTab('signup')}
                  className={`flex-1 text-center py-2.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    authTab === 'signup' ? 'bg-white shadow-md text-stone-900' : 'text-slate-500'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {authTab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email address *</label>
                    <input
                      type="email"
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition flex items-center justify-center"
                  >
                    Authenticate Entry
                  </button>

                  <div className="border-t border-slate-100/50 pt-5 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Fast Entry Profiles</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickLogin('adaeze@demo.ng')}
                        className="py-2.5 bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl text-[10px] font-bold transition flex items-center justify-center cursor-pointer text-slate-700"
                      >
                        👩 Adaeze
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickLogin('silver@demo.ng')}
                        className="py-2.5 bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl text-[10px] font-bold transition flex items-center justify-center cursor-pointer text-slate-700"
                      >
                        👨 Chuks
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickLogin('diamond@demo.ng')}
                        className="py-2.5 bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl text-[10px] font-bold transition flex items-center justify-center cursor-pointer text-slate-700"
                      >
                        👩 Ngozi
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">First Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Oluwaseun"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="name@celebrate.com"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-600"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Min 8 characters required"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-600"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Choose Plan Tier</label>
                    <div className="grid grid-cols-2 gap-2 mt-2 select-none">
                      <div
                        onClick={() => setRegPlan('standard')}
                        className={`p-3.5 border rounded-xl cursor-pointer text-center transition ${
                          regPlan === 'standard' ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span className="text-xl">⭐</span>
                        <div className="text-[10px] font-bold">Standard</div>
                      </div>
                      <div
                        onClick={() => setRegPlan('gold')}
                        className={`p-3.5 border rounded-xl cursor-pointer text-center transition ${
                          regPlan === 'gold' ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span className="text-xl">🥇</span>
                        <div className="text-[10px] font-bold">Gold Plan</div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow transition mt-2 cursor-pointer flex items-center justify-center"
                  >
                    Generate Account Entry
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 select-none shadow-xs w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            
            {/* Branding Logo Block */}
            <div className="flex items-center gap-3">
              <div 
                onClick={() => setCurrentPage('dashboard')}
                className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition flex items-center justify-center font-extrabold text-white text-lg shadow-sm shadow-indigo-100 font-mono cursor-pointer"
              >
                ⚡
              </div>
              <div onClick={() => setCurrentPage('dashboard')} className="cursor-pointer">
                <h3 className="text-xs md:text-sm font-black tracking-tight text-slate-900 leading-none">ZippZap</h3>
                <p className="hidden xs:block text-[8px] font-black text-indigo-600 uppercase tracking-widest mt-1">TEAM CAMPAIGNS</p>
              </div>
            </div>

            {/* Desktop Center Active Page Badge indicator */}
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Workspace:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 uppercase tracking-wider border border-indigo-100 font-mono">
                ⭐ {currentPage.toUpperCase()}
              </span>
            </div>

            {/* Right side controls (User, Premium, Hamburger menu) */}
            <div className="flex items-center gap-2 md:gap-3">
              {user && (
                <div 
                  onClick={() => setCurrentPage('profile')}
                  className="hidden sm:flex items-center gap-2.5 bg-[#FFF8F0]/80 hover:bg-[#FFF8F0] border border-indigo-100/40 px-3 py-1.5 rounded-xl cursor-pointer transition select-none"
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black uppercase">
                    {user.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-extrabold text-slate-850 leading-none">{user.name}</div>
                    <div className="text-[8px] font-black text-indigo-600 uppercase mt-0.5 tracking-wider">{user.tier} Account</div>
                  </div>
                </div>
              )}

              {/* Profile Avatar Trigger (Mobile icon view) */}
              {user && (
                <button 
                  onClick={() => setCurrentPage('profile')}
                  className="sm:hidden w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 font-black text-xs flex items-center justify-center active:scale-95 transition"
                  title="Profile Setup"
                >
                  {user.name.charAt(0).toUpperCase()}
                </button>
              )}

              {/* Responsive Menu Dropdown button for all chapters */}
              <button
                onClick={() => setHamburgerOpen(!hamburgerOpen)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-800 font-extrabold text-[11px] active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>{hamburgerOpen ? '✕ Wrap navigation' : '☰ Page directory'}</span>
              </button>
            </div>

          </div>
        </div>

        {/* Sub-navigation bar: A beautiful horizontal scrolling quick switcher of channels */}
        <div className="bg-slate-50 border-t border-slate-100 px-1 py-1 sm:py-1.5">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none snap-x select-none w-full">
              {NAV_SECTIONS.flatMap(sec => sec.items).map(nav => {
                const isActive = currentPage === nav.id;
                return (
                  <button
                    key={nav.id}
                    onClick={() => {
                      setCurrentPage(nav.id);
                      setHamburgerOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold tracking-wide flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer snap-start border ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-xs border-indigo-700 font-black' 
                        : 'bg-white hover:bg-[#FFF8F0]/30 hover:text-indigo-600 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="text-sm shrink-0">{nav.icon}</span>
                    <span>{nav.l}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Full Workspace Chapters Overlay Menu Drawer (Accessible on ALL Viewports) */}
      {hamburgerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop blur overlay */}
          <div 
            onClick={() => setHamburgerOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300"
          />

          {/* Drawer sheet content container */}
          <div className="relative flex flex-col max-w-[320px] w-full bg-white border-l border-slate-200 h-full p-6 shadow-2xl z-50 animate-in slide-in-from-right duration-200 select-none overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-extrabold text-white text-md">
                  ⚡
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 leading-none">ZippZap</h3>
                  <p className="text-[8px] text-slate-400 font-bold tracking-wide uppercase mt-0.5">SURPRISE PORTAL</p>
                </div>
              </div>
              <button 
                onClick={() => setHamburgerOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition"
                title="Close sheet"
              >
                ✕
              </button>
            </div>

            {/* Structured Chapters menu inside sidebar drawer */}
            <div className="space-y-4 flex-1">
              {NAV_SECTIONS.map((section, idx) => (
                <div key={idx} className="space-y-1">
                  <span className="px-2 text-[8px] font-black tracking-widest text-slate-400 uppercase leading-none block py-1 mt-1">
                    {section.title}
                  </span>
                  {section.items.map(nav => {
                    const isActive = currentPage === nav.id;
                    return (
                      <button
                        key={nav.id}
                        onClick={() => {
                          setCurrentPage(nav.id);
                          setHamburgerOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs font-black border-indigo-700'
                            : 'text-slate-700 hover:bg-[#FFF8F0]/30 hover:text-indigo-600 border-transparent'
                        }`}
                      >
                        <span className="text-sm shrink-0">{nav.icon}</span>
                        <span className="truncate">{nav.l}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Profile banner footer in mobile drawer */}
            {user && (
              <div className="pt-4 border-t border-slate-100 mt-4 shrink-0">
                <div
                  onClick={() => {
                    setCurrentPage('profile');
                    setHamburgerOpen(false);
                  }}
                  className="bg-[#FFF8F0]/60 hover:bg-[#FFF8F0] border border-indigo-100/30 p-3 rounded-2xl flex items-center gap-3 transition cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-extrabold text-slate-900 truncate leading-tight">{user.name}</h4>
                    <p className="text-[9px] text-slate-400 capitalize mt-0.5 font-bold">Tier: {user.tier}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Workspace component renderer container */}
      <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full md:max-w-none overflow-y-auto space-y-6 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* COMPONENT VIEWER GATE */}
            {currentPage === 'dashboard' && (
          <Dashboard
            user={user}
            events={events}
            onUpdateEvents={setEvents}
            activity={activity}
            media={media}
            points={user?.points || 0}
            monthlyMsgCount={user?.monthlyMsgCount || 0}
            onNavigate={setCurrentPage}
            onOpenPortal={setShowPortalId}
            onUpdateClipsState={setStudioClips}
            onUpdateTimelineState={setStudioTimeline}
          />
        )}

        {currentPage === 'birthdays' && (
          <Celebrations
            birthdays={birthdays}
            onAddContact={handleAddContact}
            onPlanSurprise={handlePlanSurprise}
            onDeleteContact={handleDeleteContact}
          />
        )}

        {currentPage === 'library' && (
          <MediaLibrary
            media={media}
            events={events}
            onClearDeliveredCache={handleClearDeliveredCache}
            onDeleteMedia={id => setMedia(prev => prev.filter(m => m.id !== id))}
            onAddToStudio={id => {
              const item = media.find(m => m.id === id);
              if (item?.type === 'video') {
                const clip = {
                  id: item.id,
                  file: item.file || null,
                  url: item.url,
                  dur: item.dur || 10,
                  name: item.name,
                  thumb: item.thumb,
                  trimStart: 0,
                  trimEnd: item.dur || 10,
                  transition: 'fade'
                };
                setStudioClips(prev => [...prev, clip]);
                setStudioTimeline(prev => [...prev, prev.length]);
                alert('🎬 Video added to Studio pipeline!');
              }
            }}
            onAddToSlideshow={id => {
              const item = media.find(m => m.id === id);
              if (item?.type === 'photo') {
                alert('📸 Photo included in your slideshow project timeline!');
              }
            }}
            onPreviewMedia={id => {
              const item = media.find(m => m.id === id);
              if (item?.url) alert(`Previewing item: ${item.name}`);
            }}
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
            onClearSelection={() => setSelectedIds(new Set())}
            onDeleteSelected={handleDeleteSelected}
            onUseSelectionInStudio={handleUseSelectionInStudio}
            onUseSelectionInSlideshow={() => {
              setSelectedIds(new Set());
              setCurrentPage('slideshow');
            }}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'upload' && (
          <UploadForm
            onSaveMedia={handleSaveMedia}
            onSaveTextMedia={handleSaveTextMedia}
            onPhotosUploaded={handlePhotosUploaded}
            recentMedia={media}
            user={user}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'studio' && (
          <VideoStudio
            media={media}
            onAddNewClip={handleAddNewClip}
            timelineOrder={studioTimeline}
            clips={studioClips}
            onUpdateClipsState={setStudioClips}
            onUpdateTimelineState={setStudioTimeline}
            onClearTimelineAll={() => {
              setStudioClips([]);
              setStudioTimeline([]);
            }}
          />
        )}

        {currentPage === 'slideshow' && (
          <SlideshowStudio
            media={media}
            events={events}
            onAddNewPhoto={file => {
              const url = URL.createObjectURL(file);
              const item: MediaItem = {
                id: 'photo_' + Date.now(),
                type: 'photo',
                name: file.name,
                from: 'Manager upload',
                note: '',
                event: '',
                size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
                dur: 0,
                url,
                thumb: url,
                created: Date.now()
              };
              setMedia(prev => [...prev, item]);
            }}
            onClearSlideshowPics={() => {
              setMedia(prev => prev.filter(m => m.type !== 'photo'));
            }}
            onUsePrebuiltSurpriseAudioSound={handleUsePrebuiltSoundtrack}
          />
        )}

        {currentPage === 'tts' && (
          <TextToSpeech
            onSaveVoiceClip={(txt, duration, audioBlob, fileUrl) => {
              const item: MediaItem = {
                id: 'media_tts_' + Date.now(),
                type: 'audio',
                name: `Synthesised Wish`,
                from: user?.name || 'Synthesizer',
                note: txt,
                event: '',
                size: (audioBlob.size / 1024).toFixed(0) + ' KB',
                dur: duration,
                url: fileUrl,
                thumb: null,
                created: Date.now()
              };
              setMedia(prev => [...prev, item]);
            }}
            media={media}
          />
        )}

        {currentPage === 'themes' && <ThemeSelector onThemeChange={the => console.log('Theme changed to:', the)} />}

        {currentPage === 'create' && (
          <CreateCampaign
            onAddEvent={(newEvent) => {
              setEvents(prev => [newEvent, ...prev]);
              setActivity(prev => [
                {
                  id: 'act_' + Date.now(),
                  type: 'done',
                  icon: '🚀',
                  text: `Initiated active surprise campaign: ${newEvent.title}`,
                  time: 'Just now',
                  stage: 'Campaign live'
                },
                ...prev
              ]);
            }}
            onNavigate={setCurrentPage}
            prefilledContact={prefilledContact}
            onClearPrefilledContact={() => setPrefilledContact(null)}
          />
        )}

        {currentPage === 'profile' && (
          <Profile
            user={user}
            onSaveProfile={prof => {
              if (user) {
                setUser({ ...user, name: prof.name, phone: prof.phone, city: prof.city });
              }
            }}
            onLogout={handleLogout}
          />
        )}

        {currentPage === 'plans' && (
          <Plans
            user={user}
            onUpgradePlan={tierId => {
              if (user) {
                setUser({ ...user, tier: tierId });
              }
            }}
          />
        )}

        {currentPage === 'delivery' && (
          <Delivery
            events={events}
            onMarkDelivered={handleMarkDelivered}
            onOpenPortal={setShowPortalId}
          />
        )}

        {currentPage === 'tracker' && <Tracker events={events} activity={activity} />}
          </motion.div>
        </AnimatePresence>
      </main>

       {/* Contributor Portal Display over screen */}
      {showPortalId && (
        <ContributorPortal
          onBackToHome={() => setShowPortalId(null)}
          celebrantName={events.find(e => e.id === showPortalId)?.cel || 'Celebrant'}
          occasion={events.find(e => e.id === showPortalId)?.occ || 'Birthday'}
          onSubmitWish={handlePortalWishSubmission}
          eventId={showPortalId}
          allWishes={media}
          onDeleteWish={id => {
            setMedia(prev => prev.filter(m => m.id !== id));
            showToast('Wish contribution successfully removed by organizer.', 'warning', 'PORTAL MANAGER');
          }}
        />
      )}

      {/* Toast Notification Container in bottom-right corner */}
      <div className="fixed bottom-6 right-6 z-[60] w-80 space-y-3 pointer-events-none" id="global-toasts-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-xl flex gap-3 items-start animate-in slide-in-from-bottom duration-300 relative overflow-hidden"
          >
            {/* Ambient accent background colors conforming to type */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
              t.type === 'success' ? 'bg-emerald-500' : t.type === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'
            }`} />
            
            <div className="shrink-0 text-sm">
              {t.type === 'success' ? '✅' : t.type === 'warning' ? '⚠️' : 'ℹ️'}
            </div>
            
            <div className="flex-1 space-y-0.5">
              {t.title && <h5 className="text-[9px] font-black uppercase tracking-wider text-slate-400 select-none">{t.title}</h5>}
              <p className="text-[11px] font-bold text-slate-100 leading-normal">{t.message}</p>
            </div>
            
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-slate-400 hover:text-white font-extrabold text-xs ml-2 shrink-0 self-center cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
