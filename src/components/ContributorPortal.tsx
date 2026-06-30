import React, { useState, useRef } from 'react';
import { CP_ACCOUNTS } from '../utils';
import { MediaItem } from '../types';

interface ContributorPortalProps {
  onBackToHome: () => void;
  onSubmitWish: (data: {
    type: 'video' | 'audio' | 'text' | 'photo';
    from: string;
    note: string;
    textBody?: string;
    url?: string | null;
    style?: string;
  }) => void;
  celebrantName: string;
  occasion: string;
  eventId?: string;
  allWishes?: MediaItem[];
  onDeleteWish?: (id: string) => void;
}

export default function ContributorPortal({
  onBackToHome,
  onSubmitWish,
  celebrantName,
  occasion,
  eventId = 'e1',
  allWishes = [],
  onDeleteWish
}: ContributorPortalProps) {
  const [organizerMode, setOrganizerMode] = useState(false);
  const [wishFilter, setWishFilter] = useState<'all' | 'video' | 'audio' | 'text' | 'photo'>('all');
  const [wishSortField, setWishSortField] = useState<'from' | 'created' | 'type'>('created');

  // Filter and Sort wishes pertaining to this event campaign
  const campaignWishes = allWishes.filter(w => !eventId || w.event === eventId);
  const sortedWishes = [...campaignWishes]
    .filter(w => wishFilter === 'all' || w.type === wishFilter)
    .sort((a, b) => {
      if (wishSortField === 'from') {
        return a.from.localeCompare(b.from);
      } else if (wishSortField === 'type') {
        return a.type.localeCompare(b.type);
      } else {
        return (b.created || 0) - (a.created || 0); // Recent first
      }
    });

  const [stage, setStage] = useState<'login' | 'upload' | 'success'>('login');
  const [email, setEmail] = useState('emeka@demo.ng');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('Friend');
  const [cpType, setCpType] = useState<'video' | 'audio' | 'text' | 'photo'>('text');
  
  // Custom attachment files
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [simulatedUploadStatus, setSimulatedUploadStatus] = useState<'none' | 'uploaded' | 'processing' | 'ready'>('none');

  React.useEffect(() => {
    if (selectedFile) {
      setSimulatedUploadStatus('uploaded');
      const t1 = setTimeout(() => {
        setSimulatedUploadStatus('processing');
      }, 700);
      const t2 = setTimeout(() => {
        setSimulatedUploadStatus('ready');
      }, 2000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      setSimulatedUploadStatus('none');
    }
  }, [selectedFile]);
  
  // Wish form states
  const [wishBody, setWishBody] = useState('');
  const [wishFrom, setWishFrom] = useState('');
  const [textStyle, setTextStyle] = useState('gradient');
  const [errorWord, setError] = useState('');
  
  // Custom interactive editing & recording states
  const [selectedFrame, setSelectedFrame] = useState('none');
  const [isPortalRecordingVoice, setIsPortalRecordingVoice] = useState(false);
  const [portalVoiceTimer, setPortalVoiceTimer] = useState(0);
  const [isPortalRecordingVideo, setIsPortalRecordingVideo] = useState(false);
  const [portalVideoTimer, setPortalVideoTimer] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const account = CP_ACCOUNTS[email as keyof typeof CP_ACCOUNTS];
    if (account && account.pw === password) {
      setName(account.name);
      setWishFrom(account.name);
      setStage('upload');
    } else {
      setError('Wrong password or email. Select an authorized quick login account below.');
    }
  };

  const handleQuickReg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishFrom) {
      setError('Please type your name first or use a quick select profile!');
      return;
    }
    setName(wishFrom);
    setStage('upload');
  };

  const selectDemoUser = (em: string) => {
    setEmail(em);
    setPassword('demo1234');
    setError('');
    
    const account = CP_ACCOUNTS[em as keyof typeof CP_ACCOUNTS];
    if (account) {
      setWishFrom(account.name);
    }
  };

  // Process selected files and generate direct preview links
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const tempUrl = URL.createObjectURL(file);
      setFileUrl(tempUrl);
    }
  };

  const handleWishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cpType === 'text' && !wishBody) return;
    if (!wishFrom) return;

    // Use live file URLs if provided, otherwise fallback to premium preset mock urls for demo success
    let activeUrl = fileUrl;
    if (!activeUrl) {
      if (cpType === 'video') {
        activeUrl = 'https://assets.mixkit.co/videos/preview/mixkit-celebration-with-fireworks-and-confetti-34063-large.mp4';
      } else if (cpType === 'audio') {
        activeUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
      } else if (cpType === 'photo') {
        activeUrl = 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop';
      }
    }

    onSubmitWish({
      type: cpType,
      from: `${wishFrom} (${relation})`,
      note: cpType === 'text' ? wishBody : `Special ${cpType} submitted for ${celebrantName}'s surprise album campaign!`,
      textBody: cpType === 'text' ? wishBody : undefined,
      url: activeUrl,
      style: textStyle
    });

    setStage('success');
  };

  return (
    <div className="fixed inset-0 bg-slate-900 overflow-y-auto z-[9999] flex flex-col pt-12 md:pt-16 pb-8 px-4 font-sans select-none">
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={onBackToHome}
          className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          ➔ Back to Home
        </button>
      </div>

      <div className={`w-full ${organizerMode ? 'max-w-4xl' : 'max-w-lg'} mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-2xl transition-all duration-300`}>
        <div className="absolute top-[-30px] right-[-30px] text-8xl opacity-10 pointer-events-none select-none">🎈</div>

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 id="contributor-portal-title" className="text-xl md:text-2xl font-black text-white">🎁 Campaign Surprise Portal</h1>
          <p className="text-xs text-indigo-400 font-bold">Secret surprise occasion contribution & organizer studio deck</p>
        </div>

        {/* Toggle between Contributor form and Organizer Submission Hub */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 gap-1">
          <button
            type="button"
            onClick={() => setOrganizerMode(false)}
            className={`flex-1 py-2.5 text-[11px] font-black uppercase rounded-xl transition cursor-pointer text-center ${
              !organizerMode 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ✍️ Contributor Form
          </button>
          <button
            type="button"
            onClick={() => setOrganizerMode(true)}
            className={`flex-1 py-2.5 text-[11px] font-black uppercase rounded-xl transition cursor-pointer text-center ${
              organizerMode 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            👨‍✈️ Organizer Hub ({campaignWishes.length})
          </button>
        </div>

        {/* ORGANIZER MODE: SORTING / FILTERING SUBMITTED WISHES */}
        {organizerMode ? (
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest pl-0.5">Submitted wishes review deck</h3>
              <p className="text-[11px] text-slate-300 mt-1">
                Currently tracking <b>{campaignWishes.length} contributions</b> for <b>{celebrantName}</b>'s surprise {occasion}. Use the tools below to organize them before executing final studio renders.
              </p>
            </div>

            {/* Sorting/Filtering Controls Container */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-b border-slate-800 pb-4">
              {/* Filter pills */}
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'video', 'audio', 'text', 'photo'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setWishFilter(type)}
                    className={`px-3 py-1.5 rounded-lg text-[9.5px] font-black tracking-wider uppercase transition cursor-pointer ${
                      wishFilter === type
                        ? 'bg-indigo-600 text-white font-black hover:bg-indigo-500'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {type === 'all'
                      ? '🎯 All'
                      : type === 'video'
                      ? '🎬 Videos'
                      : type === 'audio'
                      ? '🎙️ Audio'
                      : type === 'text'
                      ? '✍️ Text'
                      : '📸 Photos'}
                  </button>
                ))}
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] text-slate-400 font-extrabold uppercase whitespace-nowrap">Sort:</span>
                <select
                  value={wishSortField}
                  onChange={e => setWishSortField(e.target.value as any)}
                  className="h-8 bg-slate-900 border border-slate-850 rounded-lg px-2.5 text-[10px] font-bold text-white outline-none cursor-pointer hover:border-slate-700"
                >
                  <option value="created">Recent First ⏳</option>
                  <option value="from">SenderName A-Z 🔠</option>
                  <option value="type">Media Group 🎬</option>
                </select>
              </div>
            </div>

            {/* Wishes list grid */}
            {sortedWishes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-1">
                {sortedWishes.map(wish => (
                  <div key={wish.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-4 space-y-3 relative overflow-hidden flex flex-col justify-between">
                    <div>
                      {/* Name & Badge Header */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="text-xs font-black text-slate-100">{wish.from}</h4>
                          <span className="text-[9px] font-mono text-slate-400 uppercase">
                            Added {new Date(wish.created).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase ${
                          wish.type === 'video' ? 'bg-indigo-950 text-indigo-400 border border-indigo-900' :
                          wish.type === 'audio' ? 'bg-amber-950 text-amber-400 border border-amber-900' :
                          wish.type === 'photo' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                          'bg-pink-950 text-pink-400 border border-pink-900'
                        }`}>
                          {wish.type}
                        </span>
                      </div>

                      {/* Content Section / Players */}
                      <div className="mt-3">
                        {wish.type === 'text' && (
                          <div className={`p-3 rounded-xl bg-gradient-to-br ${
                            wish.style === 'royal' ? 'from-purple-900 to-indigo-950 text-white' :
                            wish.style === 'emerald' ? 'from-teal-850 to-emerald-950 text-teal-100' :
                            'from-pink-500 to-amber-500 text-white'
                          } min-h-[75px] flex items-center justify-center text-center p-3 relative`}>
                            <span className="text-[11px] font-extrabold italic leading-relaxed">
                              "{wish.textBody || wish.note}"
                            </span>
                          </div>
                        )}

                        {wish.type === 'photo' && wish.url && (
                          <div className="aspect-video rounded-xl overflow-hidden bg-slate-950 relative border border-slate-800">
                            <img src={wish.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}

                        {wish.type === 'video' && wish.url && (
                          <div className="aspect-video rounded-xl overflow-hidden bg-slate-950 relative border border-slate-800">
                            <video src={wish.url} controls className="w-full h-full object-contain" />
                          </div>
                        )}

                        {wish.type === 'audio' && wish.url && (
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 flex items-center gap-2">
                            <span className="text-sm">🎙️</span>
                            <audio src={wish.url} controls className="flex-1 h-7" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions / Delete */}
                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-850 mt-2">
                      <span className="text-[9px] text-slate-500 font-mono">
                        ID: {wish.id.substring(0, 8)}
                      </span>
                      {onDeleteWish && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove wish submission from ${wish.from}?`)) {
                              onDeleteWish(wish.id);
                            }
                          }}
                          className="text-[9.5px] font-black text-rose-400 hover:text-rose-300 transition cursor-pointer flex items-center gap-1"
                        >
                          🗑️ Delete Wish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-slate-900 border border-slate-850 rounded-2xl">
                <span className="text-3xl block filter grayscale mb-2">🎈</span>
                <p className="text-xs font-bold text-slate-300">No matching wish submissions found</p>
                <p className="text-[10px] text-slate-500 mt-1">Change your filtering pills or invite teammates to start receiving materials!</p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-900 text-center">
              <button
                onClick={onBackToHome}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-bold text-indigo-400 cursor-pointer"
              >
                ➔ Close Portal
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD CONTRIBUTOR FLOW STAGES */
          <>
            {/* STAGE 1: SIGN IN / QUICK REG */}
            {stage === 'login' && (
              <div className="space-y-4 animate-in zoom-in-95 duration-150">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center space-y-4">
                  <div className="text-4xl">🔐</div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Verification options</h3>
                    <p className="text-[11px] text-slate-400 mt-1">Authenticate or enter your nickname to attach your wish to the final video album.</p>
                  </div>

                  {/* Direct Quick Join Box */}
                  <form onSubmit={handleQuickReg} className="space-y-3 max-w-sm mx-auto border-b border-slate-800 pb-4">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider text-left pl-1">Join Instantly as Guest:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Type Your Name (e.g. Aunt Fatima)"
                        className="flex-1 h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-xs text-white outline-none focus:border-indigo-500"
                        value={wishFrom}
                        onChange={e => {
                          setWishFrom(e.target.value);
                          setError('');
                        }}
                      />
                      <button
                        type="submit"
                        className="h-11 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                      >
                        Continue ➔
                      </button>
                    </div>
                  </form>

                  {/* Verified Sign-in Form */}
                  <form onSubmit={handleLogin} className="space-y-3 max-w-sm mx-auto pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-left pl-1">Or Log in with Invite Email:</p>
                    <input
                      type="email"
                      required
                      placeholder="your@email.com"
                      className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-xs text-white outline-none focus:border-indigo-500"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                    <input
                      type="password"
                      required
                      placeholder="Password"
                      className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-xs text-white outline-none focus:border-indigo-500"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    
                    {errorWord && <div className="text-[10px] text-rose-500 font-bold font-mono">{errorWord}</div>}

                    <button
                      type="submit"
                      className="w-full h-11 border border-slate-800 hover:bg-slate-950 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Verify Authorized Partner Login
                    </button>
                  </form>

                  {/* Click Profile Shortcuts */}
                  <div className="border-t border-slate-850 pt-4 space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Invited Relations Shortcuts</p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {Object.keys(CP_ACCOUNTS).map(em => {
                        const nameShort = CP_ACCOUNTS[em as keyof typeof CP_ACCOUNTS].name;
                        return (
                          <button
                            key={em}
                            onClick={() => selectDemoUser(em)}
                            className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition hover:bg-slate-800 ${
                              email === em
                                ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400'
                                : 'border-slate-800 bg-slate-950 text-slate-400'
                            }`}
                          >
                            {nameShort}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Unique Share invite link generator */}
                  <div className="border-t border-slate-850 pt-4 space-y-2 text-left">
                    <p className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider pl-1 font-mono">
                      🔗 Unique Share Invite Link (Event: {eventId})
                    </p>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-300 font-mono truncate select-all flex-1 pr-1">
                        https://zippzap.ng/portal/{eventId}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(`https://zippzap.ng/portal/${eventId}`);
                          alert(`🔗 Surprise link copied for event ${eventId}! Share with your teammate networks!`);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-extrabold shrink-0 cursor-pointer transition text-center"
                      >
                        Copy Link
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 italic pl-1 leading-normal">
                      Contributors can use this custom link to join and submit secret videos or lovely audio greetings directly.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 2: CUSTOMIZE AND ATTACH WISH */}
            {stage === 'upload' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Invite guidelines card */}
                <div className="bg-indigo-950/50 border border-indigo-900 rounded-2xl p-4 text-xs text-indigo-200">
                  <span className="font-extrabold text-indigo-400 block mb-1">📨 PROMPT FROM CAMPAIGN MANAGER</span>
                  Hi {name}! 👋 I am organizing a surprise {occasion} video album for {celebrantName}!
                  Please record or write your special wish below. We stitch everything automatically!
                </div>

                {/* Relations dropdown selector */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Your relation to celebrant</label>
                  <select
                    className="w-full h-10 bg-slate-900 border border-slate-800 rounded-xl px-4 text-xs text-white outline-none focus:border-indigo-500"
                    value={relation}
                    onChange={e => setRelation(e.target.value)}
                  >
                    <option value="Friend">Friend</option>
                    <option value="Best Friend">Best Friend</option>
                    <option value="Family">Family Member</option>
                    <option value="Mom">Mother</option>
                    <option value="Dad">Father</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Colleague">Work Teammate</option>
                    <option value="Partner">Spouse / Partner</option>
                  </select>
                </div>

                {/* Select wish content option */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Choose your wish option type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['video', 'audio', 'text', 'photo'] as const).map(type => {
                      const isActive = cpType === type;
                      const emoji = type === 'video' ? '🎬' : type === 'audio' ? '🎙️' : type === 'text' ? '✍️' : '📸';
                      return (
                        <div
                          key={type}
                          onClick={() => {
                            setCpType(type);
                            setSelectedFile(null);
                            setFileUrl(null);
                          }}
                          className={`py-3 px-2 rounded-xl border text-center transition cursor-pointer select-none font-sans ${
                            isActive
                              ? 'border-indigo-500 bg-indigo-950/40 text-indigo-400 font-bold'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xl mb-1">{emoji}</div>
                          <div className="text-[10px] truncate capitalize">{type}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Inputs & Video overlays */}
                <form onSubmit={handleWishSubmit} className="space-y-4">
                  {cpType !== 'text' ? (
                    <div className="space-y-4">
                      {/* Hidden native input */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept={cpType === 'video' ? 'video/*' : cpType === 'audio' ? 'audio/*' : 'image/*'}
                        onChange={handleFileChange}
                      />
                      
                      {/* Integrated Recording HUD / Frame Selector depending on media type */}
                      {cpType === 'audio' && (
                        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">🎙️ Live Voice Message Recorder</span>
                            <span className="text-[9px] bg-slate-805 text-slate-400 px-2 py-0.5 rounded-full font-mono">mic available</span>
                          </div>
                          
                          {isPortalRecordingVoice ? (
                            <div className="flex flex-col items-center justify-center p-5 bg-rose-950/20 border border-rose-900/60 rounded-xl text-center space-y-3">
                              <div className="relative flex items-center justify-center">
                                <span className="absolute inline-flex h-9 w-9 rounded-full bg-rose-600 opacity-30 animate-ping" />
                                <span className="relative rounded-full h-7 w-7 bg-rose-650 flex items-center justify-center text-xs text-white">●</span>
                              </div>
                              <div className="font-mono text-xs font-extrabold text-rose-400 animate-pulse">RECORDING AUDIO: {portalVoiceTimer}s</div>
                              <p className="text-[10.5px] text-slate-350 max-w-xs">The studio-grade noise floor reduction and voice pitch optimizer are listening!</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsPortalRecordingVoice(false);
                                  const mockBlob = new Blob(["mock voice data"], { type: 'audio/mp3' });
                                  const file = new File([mockBlob], "voice-greeting.mp3", { type: "audio/mp3" });
                                  setSelectedFile(file);
                                  setFileUrl("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
                                  alert("🎙️ Simulated Vocal Track recorded successfully! Listen to the preview clip under Quick Attachment Section below.");
                                }}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                Stop & Attach recording
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsPortalRecordingVoice(true);
                                  setPortalVoiceTimer(0);
                                  const interval = setInterval(() => {
                                    setPortalVoiceTimer(t => {
                                      if (t >= 15) {
                                        clearInterval(interval);
                                        return t;
                                      }
                                      return t + 1;
                                    });
                                  }, 1000);
                                }}
                                className="py-2.5 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-900 text-rose-300 font-extrabold text-[10.5px] uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                🎙️ Tap to Record Live Voice
                              </button>
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold text-[10.5px] rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                              >
                                📤 Browse Audio File
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {cpType === 'video' && (
                        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">🎬 Live Selfie Video Studio</span>
                            <span className="text-[9px] bg-slate-805 text-slate-400 px-2 py-0.5 rounded-full font-mono">cam-ready</span>
                          </div>

                          {isPortalRecordingVideo ? (
                            <div className="flex flex-col items-center justify-center p-5 bg-indigo-950/20 border border-indigo-900/60 rounded-xl text-center space-y-3 relative overflow-hidden">
                              <div className="absolute top-2 right-2 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                                <span className="text-[8px] font-mono text-indigo-400 font-bold uppercase">LIVE FEED</span>
                              </div>
                              <div className="text-3xl animate-bounce">🎬</div>
                              <div className="font-mono text-xs font-extrabold text-indigo-400 animate-pulse">RECORDING CAMERA TIMELINE: {portalVideoTimer}s</div>
                              <p className="text-[10.5px] text-slate-350 max-w-xs">Strike a gorgeous smile and say your secret celebratory greeting!</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsPortalRecordingVideo(false);
                                  const mockBlob = new Blob(["mock video data"], { type: 'video/webm' });
                                  const file = new File([mockBlob], "camera-selfie.webm", { type: "video/webm" });
                                  setSelectedFile(file);
                                  setFileUrl("https://assets.mixkit.co/videos/preview/mixkit-celebration-with-fireworks-and-confetti-34063-large.mp4");
                                  alert("🎬 Simulated camera feed compiled! Review your attached surprise clip in the player below.");
                                }}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                Finish & Render wish
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsPortalRecordingVideo(true);
                                  setPortalVideoTimer(0);
                                  const interval = setInterval(() => {
                                    setPortalVideoTimer(t => {
                                      if (t >= 30) {
                                        clearInterval(interval);
                                        return t;
                                      }
                                      return t + 1;
                                    });
                                  }, 1000);
                                }}
                                className="py-2.5 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-900 text-indigo-300 font-extrabold text-[10.5px] uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                📷 Start Selfie Video Capture
                              </button>
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold text-[10.5px] rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                              >
                                📤 Browse Local clip
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {cpType === 'photo' && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-indigo-400">🖼️ Select Picture Frame Decorator</label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { id: 'none', label: 'None 🚫', borderClass: '' },
                              { id: 'classic-polaroid', label: 'Classic Polaroid 📸', borderClass: 'border-b-16 border-t-4 border-x-4 border-white shadow-xl text-slate-950 font-serif' },
                              { id: 'elegant-gold', label: 'Gilded VIP Gold 👑', borderClass: 'border-4 border-amber-400 ring-4 ring-amber-200' },
                              { id: 'vintage-filmstrip', label: 'Cinematic Film Strip 🎞️', borderClass: 'border-y-8 border-x-4 border-dashed border-slate-950' }
                            ].map(frm => {
                              const isActive = selectedFrame === frm.id;
                              return (
                                <button
                                  type="button"
                                  key={frm.id}
                                  onClick={() => {
                                    setSelectedFrame(frm.id);
                                    setTextStyle(frm.id); // Save to database payload
                                  }}
                                  className={`py-2 px-1 rounded-xl text-[9px] font-black border text-center transition cursor-pointer select-none ${
                                    isActive
                                      ? 'border-indigo-500 bg-indigo-950 text-indigo-300 font-black'
                                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                                  }`}
                                >
                                  {frm.label}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-indigo-450 font-bold text-[11px] rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            📸 Upload Image & Snap to Frame
                          </button>
                        </div>
                      )}

                      {/* Dropzone container fallback for drag actions */}
                      {!selectedFile && (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="border border-dashed border-slate-800 hover:border-indigo-500 hover:bg-slate-900/30 rounded-2xl py-6 px-4 text-center cursor-pointer transition select-none relative"
                        >
                          <p className="text-xs font-bold text-slate-400">Or drag & drop files here directly to attach</p>
                          <p className="text-[9px] text-slate-600 mt-1">Accepts PNG, JPG, MP4, MP3, WAV or WEBM</p>
                        </div>
                      )}

                      {/* Attached indicator */}
                      {selectedFile && (
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4.5 space-y-3.5 transition-all">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-xl bg-indigo-950 flex items-center justify-center text-md font-bold text-indigo-400">
                                {cpType === 'video' ? '🎬' : cpType === 'audio' ? '🎙️' : '📸'}
                              </span>
                              <div className="min-w-0">
                                <div className="font-extrabold text-slate-100 truncate text-xs" title={selectedFile.name}>
                                  {selectedFile.name}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Local Source Buffer
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFile(null);
                                setFileUrl(null);
                              }}
                              className="text-[10px] font-bold py-1 px-2.5 bg-slate-900 hover:bg-slate-850 rounded-lg text-slate-400 border border-slate-800 transition cursor-pointer"
                            >
                              Replace File
                            </button>
                          </div>

                          {/* Neural Status Stepper Bar */}
                          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850 space-y-2.5">
                            <div className="flex items-center justify-between text-[10px] font-bold tracking-tight">
                              <span className="text-slate-400 uppercase tracking-widest text-[9px]">Neural Pipeline Status</span>
                              {simulatedUploadStatus === 'uploaded' && (
                                <span className="text-amber-500 font-black flex items-center gap-1 animate-pulse">
                                  ✓ Uploaded Successfully
                                </span>
                              )}
                              {simulatedUploadStatus === 'processing' && (
                                <span className="text-indigo-400 font-black flex items-center gap-1 animate-pulse">
                                  ⏳ Processing AI Filters...
                                </span>
                              )}
                              {simulatedUploadStatus === 'ready' && (
                                <span className="text-emerald-400 font-black flex items-center gap-1">
                                  ✓ Ready for Compilation
                                </span>
                              )}
                            </div>

                            {/* Stepper progress bar line */}
                            <div className="grid grid-cols-3 gap-1.5">
                              <div className={`h-1.5 rounded-full transition-all duration-300 ${simulatedUploadStatus !== 'none' ? 'bg-amber-500' : 'bg-slate-850'}`} />
                              <div className={`h-1.5 rounded-full transition-all duration-300 ${simulatedUploadStatus === 'processing' || simulatedUploadStatus === 'ready' ? 'bg-indigo-500' : 'bg-slate-850'}`} />
                              <div className={`h-1.5 rounded-full transition-all duration-300 ${simulatedUploadStatus === 'ready' ? 'bg-emerald-500' : 'bg-slate-850'}`} />
                            </div>

                            {/* AI Processing dynamic feedback details */}
                            <div className="text-[10px] text-slate-400 leading-relaxed font-medium">
                              {simulatedUploadStatus === 'uploaded' && (
                                <p className="animate-in fade-in duration-300">
                                  📥 File received safely by secret server. Initializing auto-stretching container wrappers...
                                </p>
                              )}
                              {simulatedUploadStatus === 'processing' && (
                                <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                                  <p className="font-semibold text-slate-300">🛡️ Auto-applying background cleanups:</p>
                                  <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono text-slate-400 mt-1">
                                    <span className="flex items-center gap-1">✨ Stabilizing shakiness</span>
                                    <span className="flex items-center gap-1">🔆 Auto-brightness/contrast</span>
                                    <span className="flex items-center gap-1">🗣️ Voice speech boost</span>
                                    <span className="flex items-center gap-1">🧼 Noise / Echo gate</span>
                                  </div>
                                </div>
                              )}
                              {simulatedUploadStatus === 'ready' && (
                                <div className="space-y-1 animate-in zoom-in-95 duration-150">
                                  <p className="text-emerald-400 font-bold">🪄 Auto AI Enhancements Applied!</p>
                                  <p className="text-[9.5px] leading-normal text-slate-400">
                                    Face Centered successfully. Shakiness removed. Echo and mouth breathe noise floor suppressed by <span className="text-slate-200 font-mono">-14dB</span>. Perfect audio levels matched.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Immediate preview box inside contributor form with chosen decorations */}
                      {fileUrl && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">👀 Quick Attachment Preview</span>
                          
                          {cpType === 'photo' && (
                            <div className="w-full rounded bg-slate-950 p-6 flex items-center justify-center overflow-hidden">
                              <div className={`relative max-w-sm rounded bg-white transition-all overflow-hidden flex flex-col items-center p-2.5 pb-8 ${
                                selectedFrame === 'classic-polaroid' ? 'border-b-[45px] border-t-8 border-x-8 border-white shadow-2xl text-slate-900 font-serif' :
                                selectedFrame === 'elegant-gold' ? 'border-8 border-amber-400 ring-8 ring-amber-300 shadow-xl' :
                                selectedFrame === 'vintage-filmstrip' ? 'border-y-[20px] border-x-[10px] border-dashed border-zinc-950 shadow-md' :
                                'border border-slate-800 rounded-lg'
                              }`}>
                                <img src={fileUrl} className="max-h-[180px] object-contain rounded" alt="Decorated Memory" />
                                {selectedFrame === 'classic-polaroid' && (
                                  <div className="absolute bottom-[-32px] text-center font-bold text-slate-800 text-[10.5px]">
                                    {wishFrom || 'Best Friends'} — {occasion} 🥂
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {cpType === 'video' && (
                            <div className="aspect-video w-full rounded bg-slate-950 overflow-hidden">
                              <video src={fileUrl} controls className="w-full h-full object-contain" />
                            </div>
                          )}
                          
                          {cpType === 'audio' && (
                            <div className="p-2.5 bg-slate-950 rounded flex items-center gap-3 border border-slate-850">
                              <span className="text-xl">🎙️</span>
                              <audio src={fileUrl} controls className="flex-1 h-8" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Your surprise written greeting *</label>
                        <textarea
                          required
                          rows={4}
                          placeholder="Type your joyful surprise wish details here..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                          value={wishBody}
                          onChange={e => setWishBody(e.target.value)}
                        />
                      </div>

                      {/* Design style presets selector for Text greeting slide */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select slide visual design backdrop</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'gradient', label: 'Sunset Sunset 🌅', style: 'from-pink-500 to-amber-500' },
                            { id: 'royal', label: 'Royal Gold 👑', style: 'from-purple-900 to-indigo-950' },
                            { id: 'emerald', label: 'Emerald Forest 🌲', style: 'from-teal-800 to-emerald-950' }
                          ].map(theme => (
                            <div
                              key={theme.id}
                              onClick={() => setTextStyle(theme.id)}
                              className={`p-2.5 rounded-lg border text-center transition cursor-pointer select-none ${
                                textStyle === theme.id ? 'border-white text-white font-bold' : 'border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className={`h-4 w-full rounded bg-gradient-to-r ${theme.style} mb-1`} />
                              <span className="text-[9.5px] whitespace-nowrap">{theme.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sender Name Signature */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">From (Your Signature Name) *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Grandma Helen"
                        className="w-full h-11 bg-slate-900 border border-slate-800 rounded-xl px-4 text-xs text-white outline-none focus:border-indigo-500"
                        value={wishFrom}
                        onChange={e => setWishFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Campaign reference occasion</label>
                      <input
                        type="text"
                        disabled
                        className="w-full h-11 bg-slate-900/50 border border-slate-850 rounded-xl px-4 text-xs text-slate-500 cursor-not-allowed outline-none font-medium"
                        value={`${occasion} for ${celebrantName}`}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-lg transition mt-4 cursor-pointer flex items-center justify-center gap-2"
                  >
                    Submit My surprise wish 🎊
                  </button>
                </form>
              </div>
            )}

            {/* STAGE 3: SUCCESS BLOCK */}
            {stage === 'success' && (
              <div className="text-center py-8 space-y-6 animate-in zoom-in-95 duration-200">
                <div className="text-6xl animate-bounce">🎊</div>
                <div className="space-y-2">
                  <h2 className="text-lg font-black text-white">Wish Received Successfully!</h2>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-normal">
                    Thank you so much, {wishFrom}! Your {cpType} wish contribution has been integrated into the centralized surprise campaign. {celebrantName} is going to be incredibly amazed! 🤫
                  </p>
                </div>
                
                <button
                  onClick={onBackToHome}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-bold text-indigo-400 cursor-pointer transition"
                >
                  ➔ Return back to main system
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
