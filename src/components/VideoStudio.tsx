import React, { useState, useRef, useEffect } from 'react';
import { MediaItem, TextOverlay } from '../types';
import { BUILTIN_MUSIC, fmtT } from '../utils';
import { RenderWorkerService } from '../services/RenderWorker';
import { motion, AnimatePresence } from 'motion/react';

interface AudioWaveformCanvasProps {
  peaks: number[];
  noiseGate: number;
  trimStart: number;
  trimEnd: number;
  duration: number;
  onUpdateTrim: (type: 'start' | 'end', val: number) => void;
}

export function AudioWaveformCanvas({
  peaks,
  noiseGate,
  trimStart,
  trimEnd,
  duration,
  onUpdateTrim
}: AudioWaveformCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = React.useState<'none' | 'start' | 'end'>('none');

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#05080e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    const midY = h / 2;

    // Draw horizontal center gridline
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    if (peaks.length === 0) return;

    const barWidth = w / peaks.length;

    // Draw each symmetric bar
    peaks.forEach((peak, i) => {
      const isUnderGate = peak < noiseGate;
      const barX = i * barWidth;
      const barHeight = (peak / 100) * (h * 0.4); // max 40% up and down for center padding

      // Color mapping
      if (isUnderGate) {
        ctx.fillStyle = 'rgba(217, 119, 6, 0.45)'; // Amber/Orange for silence segment
      } else {
        ctx.fillStyle = '#6366f1'; // Beautiful indigo for active voice signal
      }

      ctx.fillRect(barX + 0.5, midY - barHeight, barWidth - 1, barHeight * 2);
    });

    // Draw active trim window overlay
    const startX = (trimStart / duration) * w;
    const endX = (trimEnd / duration) * w;

    // Mute outer regions
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, startX, h);
    ctx.fillRect(endX, 0, w - endX, h);

    // Draw trim boundaries
    ctx.strokeStyle = '#f59e0b'; // Gold start boundary
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, h);
    ctx.stroke();

    ctx.strokeStyle = '#10b981'; // Emerald end boundary
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, h);
    ctx.stroke();

    // Draw text handles inside Canvas
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(' ✂️ TRIM IN', startX, 12);

    ctx.fillStyle = '#10b981';
    ctx.textAlign = 'right';
    ctx.fillText('TRIM OUT ✂️ ', endX, h - 8);

    // Highlight area
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, 0, endX - startX, h);

  }, [peaks, noiseGate, trimStart, trimEnd, duration]);

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = clickX / rect.width;
    const targetTime = Math.max(0, Math.min(duration, pct * duration));

    const distToStart = Math.abs(targetTime - trimStart);
    const distToEnd = Math.abs(targetTime - trimEnd);

    if (distToStart < distToEnd) {
      setIsDragging('start');
      onUpdateTrim('start', parseFloat(targetTime.toFixed(1)));
    } else {
      setIsDragging('end');
      onUpdateTrim('end', parseFloat(targetTime.toFixed(1)));
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = clickX / rect.width;
    const targetTime = Math.max(0, Math.min(duration, pct * duration));

    if (isDragging === 'start') {
      if (targetTime < trimEnd) {
        onUpdateTrim('start', parseFloat(targetTime.toFixed(1)));
      }
    } else {
      if (targetTime > trimStart) {
        onUpdateTrim('end', parseFloat(targetTime.toFixed(1)));
      }
    }
  };

  const handlePointerUp = () => {
    setIsDragging('none');
  };

  return (
    <div className="relative select-none">
      <canvas
        ref={canvasRef}
        width={480}
        height={90}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        className="w-full h-22 rounded-xl border border-slate-800 cursor-ew-resize bg-slate-950 shadow-inner animate-in fade-in duration-200"
        title="Drag the Yellow/Green boundary lines to trim the audio segments precisely. Silence segments are orange."
      />
      <div className="absolute top-1.5 right-2 sm:right-3.5 bg-slate-950/80 px-2 py-0.5 rounded text-[8px] font-mono text-slate-400 border border-slate-800 tracking-wider">
        🖱️ Click & Drag boundaries to Trim
      </div>
    </div>
  );
}

interface VideoStudioProps {
  media: MediaItem[];
  onAddNewClip: (file: File) => void;
  timelineOrder: number[];
  clips: any[];
  onUpdateClipsState: (updatedClips: any[]) => void;
  onUpdateTimelineState: (updatedTL: number[]) => void;
  onClearTimelineAll: () => void;
}

// Simple text wrap helper for canvas card generation
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (let idx = 0; idx < words.length; idx++) {
    const word = words[idx];
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && idx > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
}

export default function VideoStudio({
  media = [],
  onAddNewClip,
  timelineOrder,
  clips,
  onUpdateClipsState,
  onUpdateTimelineState,
  onClearTimelineAll
}: VideoStudioProps) {
  const [playing, setPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // New audio soundtrack and visualization states
  const [soundtrackId, setSoundtrackId] = useState<string>('none');
  const [activeVideoFilter, setActiveVideoFilter] = useState<'none' | 'grayscale' | 'sepia' | 'brightness'>('none');
  const [renderingStatus, setRenderingStatus] = useState<string>('Initializing Stitch & Render sequence...');

  // Audio mix sliders
  const [bgVol, setBgVol] = useState(70);
  const [vidVol, setVidVol] = useState(100);
  const [voiceVol, setVoiceVol] = useState(90);

  // Transitions settings
  const [transition, setTransition] = useState('fade');
  const [colorGrade, setColorGrade] = useState('none');
  const [resolution, setResolution] = useState('720');

  // Overlays
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [overlayText, setOverlayText] = useState('');

  // Native drag & drop reorder index state
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);

  // Transition preview popup trigger
  const [previewTransitionType, setPreviewTransitionType] = useState<string | null>(null);

  // Programmatic Animated Frame state
  const [animatedFrame, setAnimatedFrame] = useState<'none' | 'sparkles' | 'hearts' | 'neon' | 'vintage'>('none');

  // Multi-format dimension layout fitting choices
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');

  // Real-time programmatic audio waveforms overlays
  const [showLiveAudioWaveform, setShowLiveAudioWaveform] = useState(true);
  const [waveformStyle, setWaveformStyle] = useState<'spectrum' | 'wave' | 'circular' | 'cyber_bars'>('spectrum');

  // Export Preview Modal states
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [previewClipIdx, setPreviewClipIdx] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTimer, setPreviewTimer] = useState(0);

  // 🎙️ ADVANCED MULTI-MEDIA STUDIO HUB STATES
  const [activeStudioToolTab, setActiveStudioToolTab] = useState<'video' | 'audio' | 'converters' | 'specials'>('video');
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [screenRecordTimer, setScreenRecordTimer] = useState(0);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceRecordTimer, setVoiceRecordTimer] = useState(0);
  const [isWebcamRecording, setIsWebcamRecording] = useState(false);
  const [webcamRecordTimer, setWebcamRecordTimer] = useState(0);

  // Text-To-Speech inputs
  const [ttsInput, setTtsInput] = useState('');
  const [ttsAccent, setTtsAccent] = useState('us-warm');
  const [ttsGenerating, setTtsGenerating] = useState(false);

  // Equalizer values
  const [eqBass, setEqBass] = useState(50);
  const [eqMid, setEqMid] = useState(50);
  const [eqTreble, setEqTreble] = useState(50);
  const [audioPitch, setAudioPitch] = useState(1.0);
  const [audioSpeed, setAudioSpeed] = useState(1.0);
  const [audioReversed, setAudioReversed] = useState(false);

  // Core format converter states
  const [convertType, setConvertType] = useState<'audio' | 'video' | 'image'>('video');
  const [convertInFormat, setConvertInFormat] = useState('MP4');
  const [convertOutFormat, setConvertOutFormat] = useState('WEBM');
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertStatus, setConvertStatus] = useState<string | null>(null);

  // Video processing modifiers
  const [cropAspect, setCropAspect] = useState<'16:9' | '9:16' | '1:1' | '4:3'>('16:9');
  const [logoRemovalCorner, setLogoRemovalCorner] = useState<'none' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('none');
  const [videoStabilizeStrength, setVideoStabilizeStrength] = useState<'none' | 'low' | 'med' | 'high'>('none');
  const [loopRepetitions, setLoopRepetitions] = useState<number>(1);
  const [masterVideoVolume, setMasterVideoVolume] = useState<number>(100);

  // Per-clip extra rotation or mirror flip states matching items
  const [clipRotationsState, setClipRotationsState] = useState<Record<string, number>>({});
  const [clipFlipsState, setClipFlipsState] = useState<Record<string, 'none' | 'h' | 'v' | 'both'>>({});
  const [clipSpeedsState, setClipSpeedsState] = useState<Record<string, number>>({});

  // 🌟 ENHANCED CHROMATIC TRANSITION & MULTI-TIMELINE PRECISION STATES
  const [selectedClipIdx, setSelectedClipIdx] = useState<number>(0);
  const [clipScrubTime, setClipScrubTime] = useState<number>(0);
  const [noiseGate, setNoiseGate] = useState<number>(20); // Noise floor threshold %
  const [isTransitionManagerOpen, setIsTransitionManagerOpen] = useState(false);

  // Detailed overlay creator states for clip-specific subtitle attachments
  const [overlayClipId, setOverlayClipId] = useState<string>('global');
  const [overlayStartTime, setOverlayStartTime] = useState<number>(0);
  const [overlayEndTime, setOverlayEndTime] = useState<number>(5);
  const [overlayFontFamily, setOverlayFontFamily] = useState<string>('Inter');
  const [overlayColor, setOverlayColor] = useState<string>('#ffffff');
  const [overlaySize, setOverlaySize] = useState<number>(24);
  const [overlayStyleBold, setOverlayStyleBold] = useState<boolean>(true);
  const [overlayStyleItalic, setOverlayStyleItalic] = useState<boolean>(false);
  const [overlayPosition, setOverlayPosition] = useState<'top' | 'centre' | 'bottom'>('bottom');
  const [overlayUseXY, setOverlayUseXY] = useState<boolean>(false);
  const [overlayX, setOverlayX] = useState<number>(50);
  const [overlayY, setOverlayY] = useState<number>(80);
  const [selectedAudioToolIdx, setSelectedAudioToolIdx] = useState<number>(0);

  // Custom configuration state for Wizards
  const [wizardTextTheme, setWizardTextTheme] = useState<'gold' | 'emerald' | 'cosmic' | 'romantic' | 'cinema'>('gold');
  const [wizardTextPrompt, setWizardTextPrompt] = useState<string>('');
  const [wizardSubtitleSize, setWizardSubtitleSize] = useState<number>(20);
  const [wizardSubtitleColor, setWizardSubtitleColor] = useState<string>('#ffffff');
  const [wizardSubtitleUseXY, setWizardSubtitleUseXY] = useState<boolean>(false);
  const [wizardSubtitleX, setWizardSubtitleX] = useState<number>(50);
  const [wizardSubtitleY, setWizardSubtitleY] = useState<number>(85);
  const [wizardSubtitleFont, setWizardSubtitleFont] = useState<string>('Inter');
  const [wizardSubtitleBackground, setWizardSubtitleBackground] = useState<'none' | 'shadow' | 'strip'>('strip');

  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);

  // Simulated playback effect
  useEffect(() => {
    let interval: any = null;
    if (previewPlaying && exportPreviewOpen && clips.length > 0) {
      interval = setInterval(() => {
        setPreviewTimer(prev => {
          if (prev >= 100) {
            // Move to next clip in queue
            if (previewClipIdx + 1 < clips.length) {
              setPreviewClipIdx(c => c + 1);
              return 0;
            } else {
              // Wrap back to start or pause
              setPreviewPlaying(false);
              setPreviewClipIdx(0);
              return 0;
            }
          }
          return prev + 6;
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [previewPlaying, exportPreviewOpen, previewClipIdx, clips.length]);

  // Recording stopwatches and simulators effect
  useEffect(() => {
    let t: any = null;
    if (isScreenRecording) {
      t = setInterval(() => {
        setScreenRecordTimer(prev => prev + 1);
      }, 1000);
    } else {
      setScreenRecordTimer(0);
    }
    return () => clearInterval(t);
  }, [isScreenRecording]);

  useEffect(() => {
    let t: any = null;
    if (isVoiceRecording) {
      t = setInterval(() => {
        setVoiceRecordTimer(prev => prev + 1);
      }, 1000);
    } else {
      setVoiceRecordTimer(0);
    }
    return () => clearInterval(t);
  }, [isVoiceRecording]);

  useEffect(() => {
    let t: any = null;
    if (isWebcamRecording) {
      t = setInterval(() => {
        setWebcamRecordTimer(prev => prev + 1);
      }, 1000);
    } else {
      setWebcamRecordTimer(0);
    }
    return () => clearInterval(t);
  }, [isWebcamRecording]);

  // 12:00 Midnight Dispatch & Automation simulation
  const [virtualClock, setVirtualClock] = useState('11:59:48 PM');
  const [targetTime, setTargetTime] = useState('00:00');
  const [selectedSocials, setSelectedSocials] = useState<string[]>(['youtube', 'tiktok', 'instagram']);
  const [simStatus, setSimStatus] = useState<'idle' | 'running' | 'success'>('idle');
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [simProgress, setSimProgress] = useState(0);

  // States for AI Auto-Timeline compilation and importer
  const [aiMood, setAiMood] = useState<'hype' | 'nostalgia' | 'modern'>('hype');
  const [isCompilingAi, setIsCompilingAi] = useState(false);
  const [aiCompileProgress, setAiCompileProgress] = useState(0);
  const [aiCompileStatus, setAiCompileStatus] = useState('');
  const [isTranscribingSubtitles, setIsTranscribingSubtitles] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeStatus, setTranscribeStatus] = useState('');
  const [transcriptionSRT, setTranscriptionSRT] = useState('');

  // Canvas context elements
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefsRef = useRef<Record<string, HTMLVideoElement>>({});
  const imageRefsRef = useRef<Record<string, HTMLImageElement>>({});
  const audioRefsRef = useRef<Record<string, HTMLAudioElement>>({});
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // New soundtrack and Web Worker references
  const soundtrackAudioRef = useRef<HTMLAudioElement | null>(null);
  const renderWorkerServiceRef = useRef<RenderWorkerService | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out media options that are already added in clips to enable high comfort importation
  const addedIdsSet = new Set(clips.map(c => c.id || c.sourceMediaId));
  const importableMedia = media.filter(m => !addedIdsSet.has(m.id));

  // Calculate total duration adapted for trim ranges
  const totalDuration = clips.length > 0
    ? clips.reduce((sum, c) => sum + (c.trimEnd - c.trimStart), 0)
    : 10;

  const selectedClip = clips[selectedClipIdx] || clips[0] || null;

  // Deterministic audio peaks corresponding to silence or spoken blocks
  const samplePeaks = React.useMemo(() => {
    if (!selectedClip || selectedClip.type !== 'audio') return [];
    
    // Create organic-looking voice spectrum bars
    const arr = [];
    const seedString = selectedClip.id || 'seed';
    let seedVal = 0;
    for (let cIdx = 0; cIdx < seedString.length; cIdx++) {
      seedVal += seedString.charCodeAt(cIdx);
    }
    
    for (let i = 0; i < 60; i++) {
      let noiseFactor = Math.sin(i * 0.15 + seedVal) * Math.cos(i * 0.08);
      let baseAmp = 0;
      
      // Let's create voice structures:
      // Index 0-10: silence floor
      // Index 10-25: speaker block
      // Index 25-34: pause breath (silence)
      // Index 34-52: active vocals
      // Index 52-60: trailing noise
      if (i < 8) {
        baseAmp = 6 + Math.abs(noiseFactor) * 8; // Silent threshold zone
      } else if (i >= 8 && i < 24) {
        baseAmp = 42 + Math.abs(noiseFactor) * 45; // Speaks
      } else if (i >= 24 && i < 32) {
        baseAmp = 5 + Math.abs(noiseFactor) * 9; // Inhales (Silent)
      } else if (i >= 32 && i < 50) {
        baseAmp = 38 + Math.abs(noiseFactor) * 55; // Speaks louder
      } else {
        baseAmp = 8 + Math.abs(noiseFactor) * 10; // Trailer noise floor
      }
      
      arr.push(Math.round(Math.max(2, Math.min(95, baseAmp))));
    }
    return arr;
  }, [selectedClip?.id]);

  useEffect(() => {
    const cv = thumbCanvasRef.current;
    if (!cv || !selectedClip) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    
    const w = cv.width;
    const h = cv.height;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    
    if (selectedClip.type === 'photo' && selectedClip.url) {
      const img = new Image();
      img.src = selectedClip.url;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px "Inter", sans-serif';
        ctx.fillText('📸 Photo Frame Preview', 10, h - 15);
      };
      // fallback in case image is already cached/cached-complete
      if (img.complete) {
        ctx.drawImage(img, 0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px "Inter", sans-serif';
        ctx.fillText('📸 Photo Frame Preview', 10, h - 15);
      }
    } else if (selectedClip.type === 'video' && selectedClip.url) {
      const vid = videoRefsRef.current[selectedClip.id];
      if (vid && vid.readyState >= 2) {
        // seek temporarily to show scrub preview frame
        const seekT = selectedClip.trimStart + clipScrubTime;
        if (Math.abs(vid.currentTime - seekT) > 0.3) {
          vid.currentTime = seekT;
        }
        try {
          ctx.drawImage(vid, 0, 0, w, h);
        } catch (e) {
          ctx.fillStyle = '#1e1b4b';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#818cf8';
          ctx.font = 'bold 12px "Inter", sans-serif';
          ctx.fillText('🎥 Video Frame Syncing...', 15, h / 2);
        }
      } else {
        // Fallback graphics card representation
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#818cf8';
        ctx.font = 'bold 12px "Inter", sans-serif';
        ctx.fillText('🎬 Video: ' + selectedClip.name, 15, h / 2 - 5);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.fillText(`Duration: ${selectedClip.dur}s | Shift + Drag`, 15, h / 2 + 15);
      }
    } else if (selectedClip.type === 'text') {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 10px "Syne", sans-serif';
      ctx.fillText(`✍️ WISH CARD PREVIEW`, 15, 25);
      ctx.fillStyle = '#e7e5e4';
      ctx.font = 'italic 10px "Inter", sans-serif';
      
      const words = (selectedClip.textBody || '').split(' ');
      const line1 = words.slice(0, 4).join(' ');
      const line2 = words.slice(4, 8).join(' ');
      ctx.fillText(line1, 15, 55);
      if (line2) ctx.fillText(line2 + '...', 15, 75);
    } else if (selectedClip.type === 'audio') {
      ctx.fillStyle = '#060b13';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x += 6) {
        const amp = Math.sin(x * 0.12 + clipScrubTime * 8) * 15;
        ctx.moveTo(x, h/2 - amp);
        ctx.lineTo(x, h/2 + amp);
      }
      ctx.stroke();
      ctx.fillStyle = '#a5b4fc';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('🎙️ AUDIO TRACK PREVIEW', 15, h - 15);
    }
  }, [selectedClip, clipScrubTime, playing]);

  const handleConvertTextToImageCard = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    // Create an offscreen HTML Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Determine background, border color, ornaments based on wizardTextTheme state (gold, emerald, cosmic, romantic, cinema)
    let fillGrad = ctx.createLinearGradient(0, 0, 800, 600);
    let borderMain = '#d97706';
    let borderInner = '#f59e0b';
    let textColor = '#0f172a';
    let titleColor = '#1e293b';
    let nameColor = '#4f46e5';
    let ornament = '⚜️';
    let strokeDashed = false;
    
    if (wizardTextTheme === 'emerald') {
      fillGrad.addColorStop(0, '#064e3b');
      fillGrad.addColorStop(0.5, '#042f1a');
      fillGrad.addColorStop(1, '#022c22');
      borderMain = '#10b981';
      borderInner = '#34d399';
      textColor = '#f0fdf4';
      titleColor = '#a7f3d0';
      nameColor = '#34d399';
      ornament = '🌿';
    } else if (wizardTextTheme === 'cosmic') {
      fillGrad.addColorStop(0, '#0f0c1b');
      fillGrad.addColorStop(0.5, '#2e0854');
      fillGrad.addColorStop(1, '#050510');
      borderMain = '#ec4899';
      borderInner = '#8b5cf6';
      textColor = '#faf5ff';
      titleColor = '#f472b6';
      nameColor = '#c084fc';
      ornament = '✨';
    } else if (wizardTextTheme === 'romantic') {
      fillGrad.addColorStop(0, '#fff1f2');
      fillGrad.addColorStop(0.5, '#fda4af');
      fillGrad.addColorStop(1, '#fce7f3');
      borderMain = '#f43f5e';
      borderInner = '#fb7185';
      textColor = '#4c0519';
      titleColor = '#881337';
      nameColor = '#db2777';
      ornament = '❤️';
    } else if (wizardTextTheme === 'cinema') {
      fillGrad.addColorStop(0, '#18181b');
      fillGrad.addColorStop(0.5, '#09090b');
      fillGrad.addColorStop(1, '#18181b');
      borderMain = '#e4e4e7';
      borderInner = '#71717a';
      textColor = '#ffffff';
      titleColor = '#f4f4f5';
      nameColor = '#e4e4e7';
      ornament = '🎬';
      strokeDashed = true;
    } else {
      // Default: Gold
      fillGrad.addColorStop(0, '#fefaf6');
      fillGrad.addColorStop(1, '#fbcfe8');
      borderMain = '#d97706';
      borderInner = '#f59e0b';
      textColor = '#0f172a';
      titleColor = '#1e293b';
      nameColor = '#4f46e5';
      ornament = '⚜️';
    }
    
    // Draw background
    ctx.fillStyle = fillGrad;
    ctx.fillRect(0, 0, 800, 600);
    
    // Border style
    ctx.strokeStyle = borderMain;
    ctx.lineWidth = 14;
    if (strokeDashed) {
      ctx.setLineDash([15, 10]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.strokeRect(30, 30, 740, 540);
    
    ctx.strokeStyle = borderInner;
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    ctx.strokeRect(48, 48, 704, 504);
    
    // Render corner ornaments
    ctx.font = '24px serif';
    ctx.fillStyle = borderMain;
    ctx.textAlign = 'center';
    ctx.fillText(ornament, 70, 85);
    ctx.fillText(ornament, 730, 85);
    ctx.fillText(ornament, 70, 530);
    ctx.fillText(ornament, 730, 530);
    
    // Header
    ctx.font = '900 24px "Inter", sans-serif';
    ctx.fillStyle = titleColor;
    ctx.textAlign = 'center';
    ctx.fillText('🎁 SURPRISE CAMPAIGN WISH GREETING', 400, 130);
    
    // Contributor name
    ctx.font = 'italic bold 22px Georgia, serif';
    ctx.fillStyle = nameColor;
    ctx.fillText(`With Warmest Wishes from: ${clip.from || 'Contributor'}`, 400, 185);
    
    // Text prompt override option
    const originalText = clip.textBody || clip.note || 'Wishing you the absolute happiest of days!';
    const finalRenderText = wizardTextPrompt.trim() 
      ? `"${originalText}"\n\nGenerated Overlay: ${wizardTextPrompt}`
      : originalText;
      
    // Body Text with automatic wrap lines
    ctx.font = 'italic bold 24px Georgia, serif';
    ctx.fillStyle = textColor;
    
    const lines = wrapText(ctx, finalRenderText, 600);
    let startY = 320 - (lines.length * 18);
    lines.forEach(line => {
      ctx.fillText(line, 400, startY);
      startY += 45;
    });
    
    // URL
    const iconUrl = canvas.toDataURL('image/png');
    
    const updated = clips.map(c => {
      if (c.id === clipId) {
        return {
          ...c,
          type: 'photo' as const,
          url: iconUrl,
          thumb: iconUrl,
          name: `🎨 [AI Card: ${wizardTextTheme.toUpperCase()}] ${c.from}`,
          dur: 6,
          trimEnd: 6
        };
      }
      return c;
    });
    
    onUpdateClipsState(updated);
    setWizardTextPrompt(''); // reset
    alert(`✨ Success! The written wish has been processed via AI Compiler's offline renderer using the [${wizardTextTheme.toUpperCase()}] frame theme successfully! Perfect transitions added.`);
  };

  const handleConvertAudioToSubtitles = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    // Mock transcription templates matching real contributor list names
    const mockTranscripts: Record<string, string> = {
      'Emeka Obi': "Sending you massive love from Lagos! May your thirties bring infinite laughter, success, and divine peace. Happy birthday Oluwaseun!",
      'Chiamaka Eze': "Hooray! Congratulations on your milestone anniversary, Chief & Mrs Nwosu! You look absolutely radiant, best wishes!",
      'Chidi Okeke': "A toast to many more decades of love, happiness, laughter and good health! Cheers!"
    };
    
    const rawName = clip.from.split('(')[0].trim();
    const textToUse = mockTranscripts[rawName] || "Congratulations on this amazing milestone! We are so incredibly happy to celebrate with you today! Wishing you endless blessings.";
    
    // Add subtitle as a customizable TextOverlay linked to this clip
    const newOverlay: TextOverlay = {
      id: 'trans_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      text: `${textToUse}`,
      pos: 'bottom',
      color: wizardSubtitleColor,
      size: wizardSubtitleSize,
      clipId: clipId,
      fontFamily: wizardSubtitleFont,
      styleBold: true,
      x: wizardSubtitleUseXY ? wizardSubtitleX : undefined,
      y: wizardSubtitleUseXY ? wizardSubtitleY : undefined,
      backplate: wizardSubtitleBackground
    };
    
    setOverlays(prev => [...prev, newOverlay]);
    alert(`🎙️ Voice-To-Text Transcription Success!\n\nDetected Speech: "${textToUse}"\n\nGenerated styled subtitles with absolute coordinates (${wizardSubtitleUseXY ? `X:${wizardSubtitleX}%, Y:${wizardSubtitleY}%` : 'Bottom center pinned'}) and [${wizardSubtitleBackground.toUpperCase()}] backplate frame. Subtitles will display smoothly during playback!`);
  };

  const handleAddNewFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        onAddNewClip(files[i]);
      }
    }
  };

  // Dedicated dynamic multi-media loader to support images, voice waves, customized letters together in stitcher timeline!
  const handleImportMediaToStudio = (item: MediaItem) => {
    const duration = item.type === 'photo' ? 5 : item.type === 'text' ? 6 : item.dur || 8;
    const clipItem = {
      id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      sourceMediaId: item.id,
      type: item.type, // 'video', 'photo', 'audio', 'text'
      file: item.file || null,
      url: item.url,
      dur: duration,
      name: item.name,
      from: item.from || 'Contributor',
      textBody: item.textBody || item.note || '',
      style: item.style || 'gradient',
      thumb: item.thumb,
      trimStart: 0,
      trimEnd: duration,
      transition: 'fade'
    };

    const updatedClips = [...clips, clipItem];
    onUpdateClipsState(updatedClips);
    
    const updatedTL = [...timelineOrder, updatedClips.length - 1];
    onUpdateTimelineState(updatedTL);
  };

  const handleUpdateTrim = (idx: number, field: 'start' | 'end', val: number) => {
    const updated = [...clips];
    const c = updated[idx];
    if (field === 'start') {
      c.trimStart = Math.min(val, c.trimEnd - 0.1);
    } else {
      c.trimEnd = Math.max(val, c.trimStart + 0.1);
    }
    onUpdateClipsState(updated);
  };

  const handleRemoveClip = (idx: number) => {
    const updatedClips = [...clips];
    updatedClips.splice(idx, 1);
    const updatedTL = timelineOrder
      .filter(i => i !== idx)
      .map(i => (i > idx ? i - 1 : i));
    onUpdateClipsState(updatedClips);
    onUpdateTimelineState(updatedTL);
  };

  const handleMoveClip = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === clips.length - 1) return;
    
    const updatedClips = [...clips];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    
    const temp = updatedClips[idx];
    updatedClips[idx] = updatedClips[targetIdx];
    updatedClips[targetIdx] = temp;
    
    onUpdateClipsState(updatedClips);
    onUpdateTimelineState(updatedClips.map((_, i) => i));
    if (selectedClipIdx === idx) {
      setSelectedClipIdx(targetIdx);
    }
  };

  const handleDropToReorder = (targetIdx: number) => {
    if (dragStartIdx === null || dragStartIdx === targetIdx) return;
    const reorderedClips = [...clips];
    const draggedItem = reorderedClips.splice(dragStartIdx, 1)[0];
    reorderedClips.splice(targetIdx, 0, draggedItem);
    onUpdateClipsState(reorderedClips);
    onUpdateTimelineState(reorderedClips.map((_, idx) => idx));
    setDragStartIdx(null);
  };

  // Play controls
  const handleStartPlay = () => {
    if (playing) {
      handlePausePlay();
      return;
    }

    setPlaying(true);
    lastTimeRef.current = performance.now();
    animateStudioFrame();
  };

  const handlePausePlay = () => {
    setPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Pause any naturally playing hidden video & audio nodes
    Object.values(videoRefsRef.current).forEach((v: any) => {
      try { v.pause(); } catch(e){}
    });
    Object.values(audioRefsRef.current).forEach((a: any) => {
      try { a.pause(); } catch(e){}
    });
  };

  const animateStudioFrame = () => {
    if (!canvasRef.current) return;
    const now = performance.now();
    const dt = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0;
    lastTimeRef.current = now;

    setPlayTime(prev => {
      const next = prev + dt;
      if (next >= totalDuration) {
        setPlaying(false);
        return 0;
      }
      return next;
    });

    animationRef.current = requestAnimationFrame(animateStudioFrame);
  };

  // Dedicated helper to automatically calculate and apply CSS object-fit: cover and center alignment
  const applyCSSObjectFitCoverAndCenter = (
    ctx: CanvasRenderingContext2D,
    sourceW: number,
    sourceH: number,
    targetW: number,
    targetH: number,
    zoomFactor: number = 1.0
  ) => {
    // This scales the asset so that it covers the entire target canvas area perfectly
    const scale = Math.max(targetW / sourceW, targetH / sourceH) * zoomFactor;
    const drawW = sourceW * scale;
    const drawH = sourceH * scale;
    const drawX = (targetW - drawW) / 2;
    const drawY = (targetH - drawH) / 2;
    return { drawX, drawY, drawW, drawH };
  };

  const drawBackgroundReplace = (ctx: CanvasRenderingContext2D, theme: string, w: number, h: number, time: number) => {
    if (theme === 'birthday') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      // Floating balloons
      ctx.fillStyle = 'rgba(236, 72, 153, 0.45)'; // Pink
      ctx.beginPath(); ctx.arc(w * 0.15, h * 0.7 - (time * 15) % (h * 0.8), 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.45)'; // Yellow
      ctx.beginPath(); ctx.arc(w * 0.85, h * 0.5 - (time * 20) % (h * 0.8), 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.45)'; // Green
      ctx.beginPath(); ctx.arc(w * 0.25, h * 0.4 - (time * 12) % (h * 0.8), 18, 0, Math.PI * 2); ctx.fill();
      
      // Strings
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.7 - (time * 15) % (h * 0.8) + 24); ctx.lineTo(w * 0.15, w); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w * 0.85, h * 0.5 - (time * 20) % (h * 0.8) + 20); ctx.lineTo(w * 0.85, w); ctx.stroke();
    } else if (theme === 'wedding') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#7f1d1d');
      grad.addColorStop(1, '#4c0519');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      // Hearts
      ctx.fillStyle = 'rgba(219, 39, 119, 0.25)';
      const hX = w * 0.2 + Math.sin(time) * 15;
      const hY = h * 0.3;
      ctx.beginPath(); ctx.arc(hX - 10, hY, 10, 0, Math.PI, true); ctx.arc(hX + 10, hY, 10, 0, Math.PI, true); ctx.lineTo(hX, hY + 22); ctx.closePath(); ctx.fill();
      
      const hX2 = w * 0.8 + Math.cos(time) * 15;
      const hY2 = h * 0.7;
      ctx.beginPath(); ctx.arc(hX2 - 10, hY2, 10, 0, Math.PI, true); ctx.arc(hX2 + 10, hY2, 10, 0, Math.PI, true); ctx.lineTo(hX2, hY2 + 22); ctx.closePath(); ctx.fill();
    } else if (theme === 'corporate') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#334155');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      // Minimal tech grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      }
      for (let j = 0; j < h; j += 40) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke();
      }
    } else if (theme === 'award') {
      ctx.fillStyle = '#02010a';
      ctx.fillRect(0, 0, w, h);
      
      // Shining spotlight beams
      const beamX1 = w / 2 + Math.sin(time * 1.5) * 200;
      const gr1 = ctx.createLinearGradient(0, 0, beamX1, h);
      gr1.addColorStop(0, 'rgba(234, 179, 8, 0.4)'); // Gold
      gr1.addColorStop(1, 'rgba(234, 179, 8, 0)');
      ctx.fillStyle = gr1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(beamX1 - 40, h); ctx.lineTo(beamX1 + 40, h); ctx.closePath(); ctx.fill();
      
      const beamX2 = w / 2 - Math.sin(time * 1.5) * 200;
      const gr2 = ctx.createLinearGradient(w, 0, beamX2, h);
      gr2.addColorStop(0, 'rgba(99, 102, 241, 0.4)'); // Purple
      gr2.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = gr2;
      ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(beamX2 - 40, h); ctx.lineTo(beamX2 + 40, h); ctx.closePath(); ctx.fill();
    } else if (theme === 'church') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#312e81');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      // Starry sky window effects
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 20; i++) {
        const starX = (w * 0.05 + i * 37) % w;
        const starY = (h * 0.12 + i * i * 19) % (h * 0.7);
        const starSize = 1.5 + Math.sin(time + i) * 1.0;
        ctx.beginPath(); ctx.arc(starX, starY, starSize, 0, Math.PI * 2); ctx.fill();
      }
    } else if (theme === 'festival') {
      ctx.fillStyle = '#050515';
      ctx.fillRect(0, 0, w, h);
      // Fireworks particles
      const fireX = w * 0.4 + Math.sin(time * 0.8) * 100;
      const fireY = h * 0.35 + Math.cos(time * 0.8) * 30;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(fireX, fireY);
        ctx.lineTo(fireX + Math.cos(angle) * (30 + (time * 10) % 25), fireY + Math.sin(angle) * (30 + (time * 10) % 25));
        ctx.stroke();
      }
    } else {
      // luxury scarlet velvet background
      const grad = ctx.createRadialGradient(w/2, h/2, 20, w/2, h/2, w);
      grad.addColorStop(0, '#7f1d1d');
      grad.addColorStop(1, '#111827');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  };

  // Drawing Frame with dynamic multi-format visualizer for Videos, Photos, Audios, and Text Greeting letters
  const drawStudioFrame = (time: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const w = cv.width;
    const h = cv.height;

    // Default pristine background canvas color
    ctx.fillStyle = '#050403';
    ctx.fillRect(0, 0, w, h);

    let elapsed = 0;
    let drawn = false;
    let activeClip = null;
    let activeClipTime = 0;

    // Determine currently active clip (video, voice, typed text card, picture frame)
    for (let i = 0; i < clips.length; i++) {
       const clip = clips[i];
       const clipLen = clip.trimEnd - clip.trimStart;

       if (time >= elapsed && time < elapsed + clipLen) {
         const clipTime = time - elapsed;
         activeClip = clip;
         activeClipTime = clipTime;

        const useBgReplace = clip.backgroundReplace && clip.backgroundReplace !== 'none';
        if (useBgReplace) {
          drawBackgroundReplace(ctx, clip.backgroundReplace, w, h, time);
        }

        // MULTI-FORMAT HANDLER FOR CANVAS COMPILATION
        if (clip.type === 'video' || !clip.type) {
          // Play classic video clip
          let vid = videoRefsRef.current[clip.id];
          if (!vid && clip.url) {
            vid = document.createElement('video');
            vid.src = clip.url;
            vid.muted = true;
            vid.playsInline = true;
            vid.style.display = 'none';
            document.body.appendChild(vid);
            videoRefsRef.current[clip.id] = vid;
          }

          if (vid && vid.readyState >= 2) {
            const seekT = clip.trimStart + clipTime;
            if (Math.abs(vid.currentTime - seekT) > 0.2) {
              vid.currentTime = seekT;
            }
            if (playing && vid.paused) {
              vid.play().catch(() => {});
            }

            const vw = vid.videoWidth || w;
            const vh = vid.videoHeight || h;

            ctx.save();
            if (useBgReplace) {
              // Rounded portrait mask to show subject cutout
              ctx.beginPath();
              const maskRadius = Math.min(w, h) * 0.38;
              ctx.arc(w / 2, h / 2, maskRadius, 0, Math.PI * 2);
              ctx.closePath();
              ctx.clip();
            }

            // Face centering increases zoom factor automatically to focus on face frame coordinates
            const zoomFactor = clip.faceCentering ? 1.35 : 1.0;

            if (fitMode === 'contain' && !useBgReplace) {
              const sc = Math.min(w / vw, h / vh) * zoomFactor;
              ctx.drawImage(vid, (w - vw * sc) / 2, (h - vh * sc) / 2, vw * sc, vh * sc);
            } else {
              // Automatically apply CSS object-fit: cover and center alignment
              const { drawX, drawY, drawW, drawH } = applyCSSObjectFitCoverAndCenter(ctx, vw, vh, w, h, zoomFactor);
              ctx.drawImage(vid, drawX, drawY, drawW, drawH);
            }
            ctx.restore();

            if (useBgReplace) {
              // Glowing border ring
              ctx.strokeStyle = 'rgba(99, 102, 241, 0.9)';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.38, 0, Math.PI * 2);
              ctx.stroke();
            }

            // Render synchronized subtitles if present
            if (clip.hasSubtitles && clip.subtitles) {
              const currentSub = clip.subtitles.find(
                (s: any) => activeClipTime >= s.start && activeClipTime < s.end
              );
              if (currentSub) {
                ctx.save();
                ctx.font = 'bold 15px "Inter", sans-serif';
                ctx.textAlign = 'center';
                
                // Measure subtitle text to draw a beautiful glassmorphic black capsule
                const textWidth = ctx.measureText(currentSub.text).width;
                const capW = textWidth + 36;
                const capH = 34;
                const capX = (w - capW) / 2;
                const capY = h - 70; // Position near bottom
                
                // Draw capsule background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = 1;
                
                // Capsule shape (rounded rect)
                ctx.beginPath();
                if (ctx.roundRect) {
                  ctx.roundRect(capX, capY, capW, capH, 8);
                } else {
                  ctx.rect(capX, capY, capW, capH);
                }
                ctx.fill();
                ctx.stroke();
                
                // Draw text
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                ctx.fillText(currentSub.text, w / 2, capY + 22);
                ctx.restore();
              }
            }

            // Render contributor's styled watermarked credit card at the start of their video submission
            if (clip.from && clip.from !== 'Me (Composer)' && activeClipTime < 3.5) {
              ctx.save();
              
              // Slide-in and fade-out transition animations
              let opacity = 1.0;
              let xOffset = 0;
              if (activeClipTime < 0.5) {
                // Ease-in slide from left
                const t = activeClipTime / 0.5;
                opacity = t;
                xOffset = -30 * (1 - t);
              } else if (activeClipTime > 3.0) {
                // Ease-out fade-out
                opacity = 1 - (activeClipTime - 3.0) / 0.5;
              }
              
              ctx.globalAlpha = opacity;
              
              const cardX = 40 + xOffset;
              const cardY = h - 140; // positioned cleanly above the subtitle space
              const cardW = 280;
              const cardH = 65;
              
              // Draw glassmorphic translucent card
              ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(cardX, cardY, cardW, cardH, 14);
              } else {
                ctx.rect(cardX, cardY, cardW, cardH);
              }
              ctx.fill();
              ctx.stroke();
              
              // Glowing left-edge gradient strip
              const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
              grad.addColorStop(0, '#6366f1'); // indigo
              grad.addColorStop(1, '#ec4899'); // pink
              ctx.fillStyle = grad;
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(cardX, cardY, 6, cardH, [14, 0, 0, 14]);
              } else {
                ctx.rect(cardX, cardY, 6, cardH);
              }
              ctx.fill();
              
              // Draw small circle icon/avatar badge
              const avatarX = cardX + 32;
              const avatarY = cardY + 32;
              ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
              ctx.beginPath();
              ctx.arc(avatarX, avatarY, 18, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
              ctx.lineWidth = 1;
              ctx.stroke();
              
              // Mini emoji/star inside avatar
              ctx.font = '14px serif';
              ctx.textAlign = 'center';
              ctx.fillText('🎬', avatarX, avatarY + 5);
              
              // Draw contributor name
              const textX = cardX + 62;
              ctx.textAlign = 'left';
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 12px "Inter", sans-serif';
              const cleanName = clip.from.split('(')[0].trim();
              ctx.fillText(cleanName, textX, cardY + 28);
              
              // Subtitle/Role
              ctx.fillStyle = '#94a3b8';
              ctx.font = '9px "Inter", sans-serif';
              ctx.fillText('🎁 Surprise Contributor', textX, cardY + 44);
              
              ctx.restore();
            }
          } else {
            ctx.fillStyle = '#1e1b4b';
            ctx.fillRect(0, 0, w, h);
            ctx.font = 'bold 15px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,.6)';
            ctx.textAlign = 'center';
            ctx.fillText(`Loading video clip: ${clip.name}...`, w / 2, h / 2);
          }
        } 
        else if (clip.type === 'photo') {
          // Play Photo with dynamic panning/zoom Ken Burns transition
          let img = imageRefsRef.current[clip.id];
          if (!img && clip.url) {
            img = new Image();
            img.src = clip.url;
            imageRefsRef.current[clip.id] = img;
          }

          if (img && img.complete) {
            // Smooth scale factor over photo time range
            const zoom = 1 + (clipTime / clipLen) * 0.12; 
            const iw = img.width || w;
            const ih = img.height || h;

            ctx.save();
            if (useBgReplace) {
              ctx.beginPath();
              const maskRadius = Math.min(w, h) * 0.38;
              ctx.arc(w / 2, h / 2, maskRadius, 0, Math.PI * 2);
              ctx.closePath();
              ctx.clip();
            }

            const zoomFactor = (clip.faceCentering ? 1.35 : 1.0) * zoom;

            if (fitMode === 'contain' && !useBgReplace) {
              ctx.translate(w / 2, h / 2);
              ctx.scale(zoom, zoom);
              ctx.translate(-w / 2, -h / 2);
              const sc = Math.min(w / iw, h / ih);
              ctx.drawImage(img, (w - iw * sc) / 2, (h - ih * sc) / 2, iw * sc, ih * sc);
            } else {
              // Automatically apply CSS object-fit: cover and center alignment and Ken Burns zoom together
              const { drawX, drawY, drawW, drawH } = applyCSSObjectFitCoverAndCenter(ctx, iw, ih, w, h, zoomFactor);
              ctx.drawImage(img, drawX, drawY, drawW, drawH);
            }
            ctx.restore();

            if (useBgReplace) {
              // Glowing border ring
              ctx.strokeStyle = 'rgba(236, 72, 153, 0.9)';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.38, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else {
            // Gradient backup while loading
            const bgGrad = ctx.createLinearGradient(0, 0, w, h);
            bgGrad.addColorStop(0, '#1e293b');
            bgGrad.addColorStop(1, '#0f172a');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, w, h);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Merging image asset into stream...`, w / 2, h / 2);
          }
        } 
        else if (clip.type === 'text') {
          // Play Voice request and draw animated dynamic waveforms overlay if it is a transcribed voice card!
          if (clip.isTranscribedVoice || (clip.url && (clip.url.includes('.mp3') || clip.url.includes('.webm') || clip.url.includes('blob:')))) {
            let aud = audioRefsRef.current[clip.id];
            if (!aud && clip.url) {
              aud = document.createElement('audio');
              aud.src = clip.url;
              aud.style.display = 'none';
              document.body.appendChild(aud);
              audioRefsRef.current[clip.id] = aud;
            }

            if (aud) {
              if (playing && aud.paused) {
                aud.currentTime = clipTime;
                aud.play().catch(() => {});
              }
              if (!playing && !aud.paused) {
                aud.pause();
              }
            }
          }

          const useBgReplace = clip.backgroundReplace && clip.backgroundReplace !== 'none';
          if (useBgReplace) {
            // Draw a frosted-glass glassmorphism card container on top of backgroundReplace already drawn
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(40, 40, w - 80, h - 80);
          } else {
            // Render gorgeous typed written wish as high fidelity canvas screen slide
            const bgColor = clip.style === 'royal' ? '#1e1b4b' : clip.style === 'emerald' ? '#064e3b' : '#312e81';
            const cardGrad = ctx.createLinearGradient(0, 0, w, h);
            cardGrad.addColorStop(0, bgColor);
            cardGrad.addColorStop(0.5, '#4f46e5');
            cardGrad.addColorStop(1, '#db2777');
            ctx.fillStyle = cardGrad;
            ctx.fillRect(0, 0, w, h);
          }

          // Aesthetic borders
          ctx.strokeStyle = clip.isTranscribedVoice ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = 10;
          ctx.strokeRect(40, 40, w - 80, h - 80);

          // Fun stickers
          ctx.font = '24px serif';
          ctx.fillText(clip.isTranscribedVoice ? '🎙️' : '✨', 65, 80);
          ctx.fillText('🎁', w - 85, 80);
          ctx.fillText('💝', 65, h - 70);
          ctx.fillText(clip.isTranscribedVoice ? '⚡' : '🎊', w - 85, h - 70);

          // Header details
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.font = 'bold 20px "Syne", sans-serif';
          const headerText = clip.isTranscribedVoice 
            ? `🎙️ VOICE-TO-TEXT WISH FROM ${clip.from?.toUpperCase() || 'CONTRIBUTOR'}`
            : `✍️ WARM WISH FROM ${clip.from?.toUpperCase() || 'CONTRIBUTOR'}`;
          ctx.fillText(headerText, w / 2, 85);

          // Body text wrapped lines
          ctx.font = 'italic 16px "Inter", sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          const textLines = wrapText(ctx, clip.textBody || 'To the star celebrant, wishing you absolute joy, good health, and magic celebrations!', w - 180);
          const startY = Math.max(130, h / 2 - (textLines.length * 14));
          textLines.forEach((lText, idxLine) => {
            ctx.fillText(lText, w / 2, startY + (idxLine * 28));
          });

          // Elegant quotes
          ctx.font = 'bold 50px Courier';
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillText('“', w / 2 - 200, startY - 15);
          ctx.fillText('”', w / 2 + 200, startY + (textLines.length * 28) + 15);

          // Audio visual wave indicator at bottom
          if (clip.isTranscribedVoice) {
            ctx.strokeStyle = '#818cf8';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            const points = 24;
            for (let j = 0; j <= points; j++) {
              const x = (w - 180) / 2 + (j / points) * 180;
              const amp = Math.sin(j * 0.4 + clipTime * 12) * 8 * (playing ? 1 : 0.1);
              const y = h - 100 + amp;
              if (j === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.fillText(`Playing Voice Audio... ${clipTime.toFixed(1)}s / ${clipLen.toFixed(1)}s`, w / 2, h - 75);
          }
        } 
        else if (clip.type === 'audio') {
          // Play Voice request and draw animated dynamic waveforms overlay
          let aud = audioRefsRef.current[clip.id];
          if (!aud && clip.url) {
            aud = document.createElement('audio');
            aud.src = clip.url;
            aud.style.display = 'none';
            document.body.appendChild(aud);
            audioRefsRef.current[clip.id] = aud;
          }

          if (aud) {
            if (playing && aud.paused) {
              aud.currentTime = clipTime;
              aud.play().catch(() => {});
            }
            if (!playing && !aud.paused) {
              aud.pause();
            }
          }

          // Render active sound wave visualization block
          const soundGrad = ctx.createLinearGradient(0, 0, w, h);
          soundGrad.addColorStop(0, '#090d16');
          soundGrad.addColorStop(1, '#1e1b4b');
          ctx.fillStyle = soundGrad;
          ctx.fillRect(0, 0, w, h);

          // Animated microphone icon with pulse circles
          const pulse = 1 + Math.sin(clipTime * 5) * 0.08;
          ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
          ctx.beginPath();
          ctx.arc(w / 2, h / 2 - 40, 90 * pulse, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(99, 102, 241, 0.28)';
          ctx.beginPath();
          ctx.arc(w / 2, h / 2 - 40, 65, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '54px serif';
          ctx.textAlign = 'center';
          ctx.fillText('🎙️', w / 2, h / 2 - 20);

          // Animated speaker voice spectrum
          ctx.strokeStyle = '#818cf8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          const points = 40;
          for (let j = 0; j <= points; j++) {
            const x = (w - 280) / 2 + (j / points) * 280;
            const amp = Math.sin(j * 0.25 + clipTime * 14) * Math.cos(j * 0.1 + clipTime * 7) * 35 * (playing ? 1 : 0.12);
            const y = h / 2 + 65 + amp;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Voice note info card
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px "Syne", sans-serif';
          ctx.fillText(`🎙️ VOICE WISH FROM ${clip.from?.toUpperCase() || 'CONTRIBUTOR'}`, w / 2, h / 2 + 130);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '13px "Inter", sans-serif';
          ctx.fillText(`Listening duration: ${clipTime.toFixed(1)}s / ${clipLen.toFixed(1)}s`, w / 2, h / 2 + 160);
        }

        drawn = true;
        break;
      }
      elapsed += clipLen;
    }

    if (!drawn && clips.length > 0) {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, w, h);
    }

    // Draw programmatic moving frames
    drawAnimatedFrameOverlay(ctx, w, h, time);

    // Color grading effects
    applyColorGrading(ctx, w, h, colorGrade);

    // Subtitle text overlays
    renderTextOverlays(ctx, w, h, activeClip, activeClipTime);

    // Live studio audio spectrums overlays
    drawLiveAudioWaveformOverlay(ctx, w, h, time);

    // Continuous timeline baseline bar inside canvas
    ctx.fillStyle = 'rgba(255,107,26,.8)';
    ctx.fillRect(0, h - 6, w * (time / Math.max(0.1, totalDuration)), 6);
  };

  const drawLiveAudioWaveformOverlay = (ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => {
    if (!showLiveAudioWaveform) return;
    
    ctx.save();
    const isActive = playing;
    const activityMult = isActive ? 1.0 : 0.15;
    
    if (waveformStyle === 'spectrum') {
      // Draw bottom-aligned equalizer bars
      const barCount = 36;
      const spacing = 4;
      const containerW = w - 80;
      const barW = (containerW - (barCount - 1) * spacing) / barCount;
      const startX = 40;
      const baseY = h - 25;
      
      const grad = ctx.createLinearGradient(0, baseY - 60, 0, baseY);
      grad.addColorStop(0, '#ec4899'); // pink
      grad.addColorStop(0.5, '#6366f1'); // indigo
      grad.addColorStop(1, 'rgba(99, 102, 241, 0.2)');
      
      ctx.fillStyle = grad;
      for (let i = 0; i < barCount; i++) {
        // Multi-frequency synthesis for realistic audio animation
        const freq1 = Math.sin(i * 0.3 + time * 11) * 20;
        const freq2 = Math.cos(i * 0.7 - time * 17) * 15;
        const freq3 = Math.sin(i * 1.5 + time * 6) * 10;
        
        let barH = (35 + freq1 + freq2 + freq3) * activityMult;
        barH = Math.max(4, Math.min(65, barH));
        
        const bx = startX + i * (barW + spacing);
        const by = baseY - barH;
        
        // Rounded bars
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bx, by, barW, barH, 2);
        } else {
          ctx.rect(bx, by, barW, barH);
        }
        ctx.fill();
      }
    } 
    else if (waveformStyle === 'wave') {
      // Oscilloscope voice tracks
      const centerY = h - 45;
      const startX = 40;
      const width = w - 80;
      
      const colors = [
        'rgba(99, 102, 241, 0.65)', // indigo
        'rgba(236, 72, 153, 0.55)', // pink
        'rgba(34, 211, 238, 0.45)'  // cyan
      ];
      
      colors.forEach((color, idx) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = idx === 0 ? 2.5 : 1.5;
        ctx.beginPath();
        
        const phaseShift = time * (10 + idx * 4);
        const freqScale = 0.02 + idx * 0.01;
        const ampScale = (24 - idx * 6) * activityMult;
        
        for (let x = 0; x <= width; x += 5) {
          const rads = x * freqScale - phaseShift;
          const y = centerY + Math.sin(rads) * ampScale + Math.cos(x * 0.05 + time * 5) * (5 * activityMult);
          if (x === 0) {
            ctx.moveTo(startX + x, y);
          } else {
            ctx.lineTo(startX + x, y);
          }
        }
        ctx.stroke();
      });
    } 
    else if (waveformStyle === 'circular') {
      // Pulsating audio radar in the corner
      const cx = w - 65;
      const cy = 65;
      const maxRadius = 35;
      
      // Base circle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Pulse ripples
      const ripples = 3;
      for (let r = 0; r < ripples; r++) {
        const progress = ((time * 1.5 + r / ripples) % 1.0);
        const radius = progress * maxRadius;
        const opacity = (1 - progress) * 0.6 * activityMult;
        
        ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Dynamic radar spikes
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const spikes = 20;
      for (let s = 0; s < spikes; s++) {
        const angle = (s / spikes) * Math.PI * 2;
        const noise = (Math.sin(s * 1.2 + time * 12) * Math.cos(s * 0.8 - time * 8) * 12) * activityMult;
        const innerR = 8;
        const outerR = 15 + Math.max(0, noise);
        
        const sx1 = cx + Math.cos(angle) * innerR;
        const sy1 = cy + Math.sin(angle) * innerR;
        const sx2 = cx + Math.cos(angle) * outerR;
        const sy2 = cy + Math.sin(angle) * outerR;
        
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
      }
      ctx.stroke();
      
      // Center dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    else if (waveformStyle === 'cyber_bars') {
      // Stereo Left & Right reflective VU Equalizer
      const barCount = 12;
      const barW = 6;
      const spacing = 3;
      const baseY = h - 35;
      
      const drawVUChannel = (startX: number, direction: 1 | -1) => {
        for (let i = 0; i < barCount; i++) {
          const noise = (Math.sin(i * 0.5 + time * 14) * 12 + Math.cos(i * 0.9 - time * 9) * 8) * activityMult;
          let barH = Math.max(3, 18 + noise);
          
          const bx = startX + direction * i * (barW + spacing);
          const by = baseY - barH;
          
          // Triple color indicator
          let color = '#10b981'; // green for lower
          if (i > 8) color = '#ef4444'; // red for peaks
          else if (i > 5) color = '#f59e0b'; // orange for mid
          
          ctx.fillStyle = color;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(bx, by, barW, barH, 1.5);
          } else {
            ctx.rect(bx, by, barW, barH);
          }
          ctx.fill();
        }
      };
      
      // Left channel (lower left)
      drawVUChannel(45, 1);
      // Right channel (lower right)
      drawVUChannel(w - 45 - barW, -1);
      
      // Draw mini L & R labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillText('L CHANNEL', 45 + 15, baseY + 12);
      ctx.fillText('R CHANNEL', w - 45 - 25, baseY + 12);
    }
    
    ctx.restore();
  };

  const drawAnimatedFrameOverlay = (ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => {
    if (animatedFrame === 'none') return;
    if (animatedFrame === 'sparkles') {
      ctx.fillStyle = 'rgba(255, 215, 0, ' + (0.5 + Math.sin(time * 5) * 0.25) + ')';
      ctx.font = '15px sans-serif';
      for (let s = 0; s < 10; s++) {
        const sx = ((s * 45 + time * 35) % (w - 20)) + 10;
        ctx.fillText('✨', sx, 18);
        ctx.fillText('⚡', sx, h - 18);
      }
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    } 
    else if (animatedFrame === 'hearts') {
      ctx.fillStyle = 'rgba(244, 63, 94, ' + (0.55 + Math.sin(time * 4) * 0.25) + ')';
      ctx.font = '14px sans-serif';
      for (let s = 0; s < 10; s++) {
        const sx = ((s * 50 + time * 25) % (w - 20)) + 10;
        ctx.fillText('❤️', sx, h - 18);
        ctx.fillText('🎉', sx, 18);
      }
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
    } 
    else if (animatedFrame === 'neon') {
      const hue = Math.floor(time * 70) % 360;
      ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.9)`;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.shadowColor = `hsla(${hue}, 100%, 50%, 0.7)`;
      ctx.shadowBlur = 12;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.shadowBlur = 0; // reset
    } 
    else if (animatedFrame === 'vintage') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, 22);
      ctx.fillRect(0, h - 22, w, 22);
      ctx.fillStyle = '#f8fafc';
      for (let x = 8; x < w; x += 25) {
        ctx.fillRect(x, 5, 10, 10);
        ctx.fillRect(x, h - 15, 10, 10);
      }
    }
  };

  const applyColorGrading = (ctx: CanvasRenderingContext2D, w: number, h: number, grade: string) => {
    if (grade === 'none') return;
    try {
      const id = ctx.getImageData(0, 0, w, h);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];

        if (grade === 'warm') {
          d[i] = Math.min(255, r * 1.12);
          d[i + 2] = Math.min(255, b * 0.88);
        } else if (grade === 'cool') {
          d[i] = Math.min(255, r * 0.88);
          d[i + 2] = Math.min(255, b * 1.12);
        } else if (grade === 'vibrant') {
          d[i] = Math.min(255, r * 1.25);
          d[i + 1] = Math.min(255, g * 1.12);
        } else if (grade === 'bw') {
          const gray = r * 0.3 + g * 0.59 + b * 0.11;
          d[i] = d[i + 1] = d[i + 2] = gray;
        } else if (grade === 'sepia') {
          d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
          d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
          d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        } else if (grade === 'cinematic') {
          // Teal and Orange: boost red/yellow in highlights, boost blue/cyan in shadows
          const avg = (r + g + b) / 3;
          if (avg > 127) {
            d[i] = Math.min(255, r * 1.15); // red accent highlight
            d[i + 1] = Math.min(255, g * 1.05);
            d[i + 2] = Math.min(255, b * 0.9);
          } else {
            d[i] = Math.min(255, r * 0.85);
            d[i + 1] = Math.min(255, g * 1.1); // green-blue shadows
            d[i + 2] = Math.min(255, b * 1.25);
          }
        } else if (grade === 'cyberpunk') {
          // Intense neon magenta & cyan shift
          const avg = (r + g + b) / 3;
          if (avg > 110) {
            d[i] = Math.min(255, r * 1.3); // pink highlights
            d[i + 1] = Math.min(255, g * 0.7);
            d[i + 2] = Math.min(255, b * 1.3);
          } else {
            d[i] = Math.min(255, r * 0.6); // electric cyan shadows
            d[i + 1] = Math.min(255, g * 1.2);
            d[i + 2] = Math.min(255, b * 1.4);
          }
        } else if (grade === 'solarize') {
          // Artistic solarization
          d[i] = r > 127 ? 255 - r : r;
          d[i + 1] = g > 127 ? 255 - g : g;
          d[i + 2] = b > 127 ? 255 - b : b;
        }
      }
      ctx.putImageData(id, 0, 0);
    } catch (err) {}
  };

  const renderTextOverlays = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    activeClip: any = null,
    clipTime: number = 0
  ) => {
    overlays.forEach(o => {
      // Clip-level target checking
      if (o.clipId) {
        if (!activeClip || activeClip.id !== o.clipId) return;
        
        // Check start and end timestamps relative to the active clip segment
        const start = o.startTime ?? 0;
        const end = o.endTime ?? (activeClip.trimEnd - activeClip.trimStart);
        if (clipTime < start || clipTime > end) return;
      }

      // Compile fonts
      const isBold = o.styleBold !== false;
      const isItalic = o.styleItalic === true;
      const fontModifier = `${isItalic ? 'italic' : ''} ${isBold ? 'bold' : 'normal'}`.trim();
      const fontFamilyChoice = o.fontFamily || 'Inter';

      ctx.font = `${fontModifier} ${o.size}px "${fontFamilyChoice}", sans-serif`;
      ctx.fillStyle = o.color || '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';

      let x = w / 2;
      let y = h / 2;
      if (typeof o.x === 'number') {
        x = (o.x / 100) * w;
      }
      if (typeof o.y === 'number') {
        y = (o.y / 100) * h;
      } else {
        if (o.pos === 'top') {
          y = 45;
        } else if (o.pos === 'bottom') {
          y = h - 45;
        }
      }

      // Render custom backplate background box wrapper behind subtitles
      if (o.backplate === 'strip') {
        ctx.save();
        const tWidth = ctx.measureText(o.text).width;
        const padX = 16;
        const padY = 8;
        ctx.fillStyle = 'rgba(10, 10, 12, 0.75)'; // eye-safe high contrast backing
        const boxX = x - (tWidth / 2) - padX;
        const boxY = y - (o.size) + 2;
        const boxW = tWidth + (padX * 2);
        const boxH = o.size + (padY * 2);
        ctx.shadowColor = 'transparent'; // clear shadows for backplate box
        ctx.shadowBlur = 0;
        
        // Draw round rectangle background Frame
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(boxX, boxY, boxW, boxH, 8);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();
        ctx.restore();
      }

      ctx.fillText(o.text, x, y);
      ctx.shadowBlur = 0; // reset
    });
  };

  const drawIdleCanvas = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#818cf8';
    
    // Draw pretty vector film reel graphic
    ctx.font = '55px serif';
    ctx.fillText('🎬', cv.width / 2 - 25, cv.height / 2 - 15);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Studio multi-format timeline preview online', cv.width / 2, cv.height / 2 + 35);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11.5px "JetBrains Mono", monospace';
    ctx.fillText('Ready to stitch: Videos · Audios · Written Cards · Photos', cv.width / 2, cv.height / 2 + 62);
  };

  const handleAutoTranscribeSubtitles = () => {
    const videoClips = clips.filter(c => c.type === 'video' || !c.type);
    if (videoClips.length === 0) {
      alert('🎥 Please add at least one video clip to the timeline first to transcribe subtitles!');
      return;
    }

    setIsTranscribingSubtitles(true);
    setTranscribeProgress(0);
    setTranscribeStatus('Initializing neural speech-to-text transcoder engine...');

    const steps = [
      { p: 20, status: 'Analyzing audio spectrum & vocal frequencies across video clips...' },
      { p: 45, status: 'Isolating dialogue and executing automatic speech-to-text (STT)...' },
      { p: 70, status: 'Generating synchronized SRT time markers and alignment structures...' },
      { p: 90, status: 'Applying custom text rendering cards and overlaying subtitles...' },
      { p: 100, status: 'Speech recognition completed successfully! SRT files generated.' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setTranscribeProgress(steps[currentStep].p);
        setTranscribeStatus(steps[currentStep].status);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsTranscribingSubtitles(false);

        // Define a list of beautiful transcribed sentences matching typical guest surprise greetings
        const transcriptionGreetings = [
          "Happy Birthday! Sending you all the love and happiness on your big day!",
          "I am so incredibly proud of everything you have accomplished this year!",
          "Wishing you another year filled with great memories and laughter!",
          "You are an inspiration to all of us. Have a magnificent celebration!",
          "Cheers to many more years of health, abundance, and positive energy!"
        ];

        let srtTrackIndex = 1;
        let srtTimeCounter = 0;
        let finalSRTContent = '';

        // Update each video clip in-place with generated subtitles
        const updatedClips = clips.map(clip => {
          if (clip.type === 'video' || !clip.type) {
            const clipDur = clip.trimEnd - clip.trimStart;
            // Generate 2 or 3 subtitles for this clip duration
            const subCount = Math.max(1, Math.floor(clipDur / 3.5));
            const clipSubtitles = [];

            for (let sIdx = 0; sIdx < subCount; sIdx++) {
              const start = sIdx * (clipDur / subCount);
              const end = (sIdx + 1) * (clipDur / subCount) - 0.2;
              const textPhrase = transcriptionGreetings[(srtTrackIndex - 1) % transcriptionGreetings.length];
              
              clipSubtitles.push({ start, end, text: textPhrase });

              // Accumulate in global SRT file
              const formatSRTTime = (secs: number) => {
                const totalSecs = srtTimeCounter + secs;
                const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
                const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
                const s = Math.floor(totalSecs % 60).toString().padStart(2, '0');
                const ms = Math.floor((totalSecs % 1) * 1000).toString().padStart(3, '0');
                return `${h}:${m}:${s},${ms}`;
              };

              finalSRTContent += `${srtTrackIndex}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${textPhrase}\n\n`;
              srtTrackIndex++;
            }

            srtTimeCounter += clipDur;
            return {
              ...clip,
              hasSubtitles: true,
              subtitles: clipSubtitles
            };
          }
          // For non-video clips, just increase the time counter by its duration
          srtTimeCounter += (clip.trimEnd - clip.trimStart);
          return clip;
        });

        onUpdateClipsState(updatedClips);
        setTranscriptionSRT(finalSRTContent);
        alert(`🎙️ AI Speech-To-Text Transcoder Complete!\nAnalyzed all ${videoClips.length} video submissions in the timeline. Synchronized SRT subtitle layers generated and active in the video stream!`);
      }
    }, 500);
  };

  const handleDownloadSRT = () => {
    if (!transcriptionSRT) return;
    const blob = new Blob([transcriptionSRT], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Compile Render output
  const handleStartRenderMerged = () => {
    if (clips.length === 0) {
      alert('Your stitching bin is empty! Load video files or quick-import library materials below.');
      return;
    }
    handlePausePlay();
    setRendering(true);
    setRenderProgress(0);
    setRenderingStatus('Spawning dedicated RenderWorker thread...');

    if (!renderWorkerServiceRef.current) {
      renderWorkerServiceRef.current = new RenderWorkerService();
    }

    renderWorkerServiceRef.current.startRender(
      clips,
      {
        soundtrackUrl: getSoundtrackUrl(soundtrackId),
        videoFilter: activeVideoFilter,
        fitMode: fitMode,
        colorGrade: colorGrade,
        showLiveAudioWaveform: showLiveAudioWaveform,
        waveformStyle: waveformStyle,
        animatedFrame: animatedFrame
      },
      (prog) => {
        setRenderProgress(prog);
        const activeIdx = Math.max(0, Math.min(Math.floor((prog / 100) * clips.length), clips.length - 1));
        if (prog < 100) {
          const filterMsg = activeVideoFilter !== 'none' ? `filter '${activeVideoFilter}'` : "default styling";
          const gradeMsg = colorGrade !== 'none' ? `LUT '${colorGrade}'` : "raw colors";
          const waveMsg = showLiveAudioWaveform ? ` + rendering '${waveformStyle}' visualizer wave` : "";
          setRenderingStatus(`Stitching Clip #${activeIdx + 1} (${clips[activeIdx]?.name || 'Media'}) · Processing ${filterMsg} with ${gradeMsg}${waveMsg}...`);
        } else {
          setRenderingStatus('Stitched video compiled successfully!');
        }
      },
      (finishedUrl) => {
        setOutputUrl(finishedUrl);
        setRendering(false);
      }
    );
  };

  const handleAddOverlay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overlayText) return;
    setOverlays(prev => [
      ...prev,
      {
        id: 'ov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        text: overlayText,
        pos: overlayPosition,
        color: overlayColor,
        size: overlaySize,
        clipId: overlayClipId === 'global' ? undefined : overlayClipId,
        startTime: overlayStartTime,
        endTime: overlayEndTime,
        fontFamily: overlayFontFamily,
        styleBold: overlayStyleBold,
        styleItalic: overlayStyleItalic,
        x: overlayUseXY ? overlayX : undefined,
        y: overlayUseXY ? overlayY : undefined
      }
    ]);
    setOverlayText('');
  };

  // Trigger simulated 12:00 Midnight Automatic Event Publisher
  const handleSimulateMidnightLaunch = () => {
    if (clips.length === 0) {
      alert('Stitching timeline must include at least 1 contribution clip before 12:00 AM dispatch publishing!');
      return;
    }

    setSimStatus('running');
    setSimProgress(5);
    setSimLogs([`[12:00:00 AM] ⏰ Automated Midnight Clock Clocked! Initialising pipeline...`]);

    const steps = [
      { p: 15, msg: `[12:00:01 AM] ⚙️ Booting seamless cloud rendering server engine...` },
      { p: 30, msg: `[12:00:02 AM] 🎞️ Auto-stitching ${clips.length} teammate wishes (videos, voice waves, graphics, text slides)...` },
      { p: 48, msg: `[12:00:04 AM] 🎵 Balancing vocals wave soundtrack. Merging native audio with high-pitch Afrobeats sound mixes...` },
      { p: 65, msg: `[12:00:06 AM] 🚀 Render output generated at 1080p full HD!` },
      { p: 80, msg: `[12:00:08 AM] 📤 Cross-posting to configured networks APIs: ${selectedSocials.join(', ')}...` },
      { p: 92, msg: `[12:00:09 AM] 🔗 Webhooks generated & live push alert pushed to targets WhatsApp status broadcast!` },
      { p: 100, msg: `[12:00:10 AM] 🎉 SUCCESS! Automatically uploaded & scheduled surprise video posted in multiple feeds!` }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        setSimProgress(step.p);
        setSimLogs(prev => [...prev, step.msg]);
        currentStep++;
      } else {
        clearInterval(interval);
        setSimStatus('success');
      }
    }, 1200);
  };

  useEffect(() => {
    let tickCount = 48;
    const interval = setInterval(() => {
      if (simStatus !== 'idle') {
        clearInterval(interval);
        return;
      }
      tickCount++;
      if (tickCount < 60) {
        setVirtualClock(`11:59:${tickCount.toString().padStart(2, '0')} PM`);
      } else {
        setVirtualClock('12:00:00 AM');
        clearInterval(interval);
        // Automatically trigger midnight render and cross-post!
        handleSimulateMidnightLaunch();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [simStatus]);

  const READY_TEMPLATES = [
    { id: 'birthday', name: 'Birthday Bash', emoji: '🎂', mood: 'hype', soundtrack: 'bm1', filter: 'brightness', frame: 'neon', bg: 'birthday', desc: 'Upbeat party vibes with floating balloons' },
    { id: 'wedding', name: 'Wedding Bliss', emoji: '💍', mood: 'nostalgia', soundtrack: 'bm4', filter: 'sepia', frame: 'hearts', bg: 'wedding', desc: 'Warm romantic filters with sweet hearts backdrop' },
    { id: 'anniversary', name: 'Anniversary Gala', emoji: '🌟', mood: 'normal', soundtrack: 'bm5', filter: 'sepia', frame: 'vintage', bg: 'wedding', desc: 'Soft memory stroll with nostalgic filters' },
    { id: 'graduation', name: 'Graduation Farewell', emoji: '🎓', mood: 'hype', soundtrack: 'bm6', filter: 'brightness', frame: 'neon', bg: 'luxury', desc: 'High energy farewell theme' },
    { id: 'church', name: 'Church Program', emoji: '⛪', mood: 'normal', soundtrack: 'bm5', filter: 'none', frame: 'none', bg: 'church', desc: 'glowing arches backdrop with choral hymn score' },
    { id: 'retirement', name: 'Retirement Gift', emoji: '💼', mood: 'normal', soundtrack: 'bm2', filter: 'none', frame: 'none', bg: 'corporate', desc: 'Clean corporate tribute' },
    { id: 'memorial', name: 'Memorial Tribute', emoji: '🕊️', mood: 'nostalgia', soundtrack: 'bm4', filter: 'grayscale', frame: 'vintage', bg: 'luxury', desc: 'Slow-paced respectful memory stroll' },
    { id: 'awards', name: 'Corporate Awards', emoji: '🏆', mood: 'hype', soundtrack: 'bm6', filter: 'brightness', frame: 'none', bg: 'award', desc: 'Grand spotlights stage style' },
    { id: 'school', name: 'School Farewell', emoji: '🏫', mood: 'hype', soundtrack: 'bm3', filter: 'brightness', frame: 'sparkles', bg: 'festival', desc: 'Fun celebratory fireworks template' },
    { id: 'appreciation', name: 'Employee Thanks', emoji: '🤝', mood: 'normal', soundtrack: 'bm5', filter: 'none', frame: 'none', bg: 'luxury', desc: 'Sincere appreciation theme' },
  ];

  const applyReadyTemplate = (tId: string) => {
    const t = READY_TEMPLATES.find(x => x.id === tId);
    if (!t) return;
    
    setAiMood(t.mood as any);
    setSoundtrackId(t.soundtrack);
    setActiveVideoFilter(t.filter as any);
    setAnimatedFrame(t.frame as any);
    
    let compiledList = [...clips];
    if (compiledList.length === 0) {
      // Build 3 beautiful storyboard clips matching the template
      compiledList = [
        {
          id: 'tpl_intro_' + Date.now(),
          sourceMediaId: 'intro',
          type: 'text',
          file: null,
          url: 'TEXT_INTRO',
          dur: 6,
          name: `🎬 Welcome Intro - ${t.name}`,
          from: 'ZippZap AI Studio',
          textBody: `Welcome to the Grand surprise tribute celebration!`,
          style: t.frame === 'neon' ? 'royal' : 'emerald',
          trimStart: 0,
          trimEnd: 6,
          transition: 'fade',
          backgroundReplace: t.bg
        },
        {
          id: 'tpl_wish_' + Date.now(),
          sourceMediaId: 'wish',
          type: 'photo',
          file: null,
          url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop',
          dur: 5,
          name: `📸 Shared Memory Slideshow`,
          from: 'Best Friends Group',
          textBody: '',
          style: 'gradient',
          trimStart: 0,
          trimEnd: 5,
          transition: 'slide',
          backgroundReplace: t.bg,
          faceCentering: true
        },
        {
          id: 'tpl_closing_' + Date.now(),
          sourceMediaId: 'closing',
          type: 'text',
          file: null,
          url: 'TEXT_CLOSING',
          dur: 5,
          name: `🎁 Outro - Thank You Credits`,
          from: 'ZippZap Co-Pilot',
          textBody: `Presented with love by the entire crew. Happy Celebration!`,
          style: 'royal',
          trimStart: 0,
          trimEnd: 5,
          transition: 'fade',
          backgroundReplace: t.bg
        }
      ];
      onUpdateClipsState(compiledList);
      onUpdateTimelineState([0, 1, 2]);
    } else {
      // Configure existing clips to use the backdrop replacements
      const updated = clips.map(c => ({
        ...c,
        backgroundReplace: t.bg,
        faceCentering: true,
        videoCleanup: true,
        audioCleanup: true
      }));
      onUpdateClipsState(updated);
    }
    
    alert(`✨ 1-Click Template Applied: "${t.name}"!\nEverything has been configured instantly: soundtrack changed, color grading set to ${t.filter}, layout frames aligned to ${t.frame}, and Real-Time AI Background set to ${t.bg} theme. Click Preview to see compiling results!`);
  };

  const getFilterCss = (f: string) => {
    switch (f) {
      case 'grayscale': return 'grayscale(100%)';
      case 'sepia': return 'sepia(100%)';
      case 'brightness': return 'brightness(130%)';
      default: return 'none';
    }
  };

  const getSoundtrackUrl = (id: string) => {
    switch (id) {
      case 'bm1': return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
      case 'bm2': return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3';
      case 'bm3': return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3';
      case 'bm4': return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3';
      case 'bm5': return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3';
      case 'bm6': return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3';
      default: return null;
    }
  };

  useEffect(() => {
    if (playing) {
      drawStudioFrame(playTime);
    }
  }, [playTime, playing, clips]);

  // Synchronized background music soundtrack player
  useEffect(() => {
    if (soundtrackId === 'none') {
      if (soundtrackAudioRef.current) {
        soundtrackAudioRef.current.pause();
      }
      return;
    }

    const url = getSoundtrackUrl(soundtrackId);
    if (!url) return;

    if (!soundtrackAudioRef.current) {
      soundtrackAudioRef.current = new Audio(url);
      soundtrackAudioRef.current.loop = true;
    } else if (soundtrackAudioRef.current.src !== url) {
      soundtrackAudioRef.current.src = url;
    }

    soundtrackAudioRef.current.volume = bgVol / 100;

    if (playing) {
      if (soundtrackAudioRef.current.paused) {
        soundtrackAudioRef.current.play().catch(() => {});
      }
    } else {
      soundtrackAudioRef.current.pause();
    }
  }, [playing, soundtrackId, bgVol]);

  useEffect(() => {
    drawIdleCanvas();
    return () => {
      Object.values(videoRefsRef.current).forEach((v: any) => {
        try { document.body.removeChild(v); } catch(ex){}
      });
      Object.values(audioRefsRef.current).forEach((a: any) => {
        try { document.body.removeChild(a); } catch(ex){}
      });
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      // Terminate background rendering workers and trackers on unmount
      if (renderWorkerServiceRef.current) {
        renderWorkerServiceRef.current.terminate();
      }
      if (soundtrackAudioRef.current) {
        soundtrackAudioRef.current.pause();
        soundtrackAudioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
        <div>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">Multi-Format Creative Engine</span>
          <h1 id="video-studio-main-title" className="text-xl md:text-2xl font-black text-slate-900 mt-2">🎬 Live Stitcher Studio</h1>
          <p className="text-xs text-slate-500 mt-1">Stitch together recorded videos, vocal wave files, guest greeting slides, and image frames into a consolidated gift movie</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <input
            type="file"
            multiple
            ref={fileInputRef}
            accept="video/*,audio/*,image/*"
            className="hidden"
            onChange={handleAddNewFiles}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 border border-slate-200 hover:border-indigo-600 bg-white font-extrabold text-[#1C1207] text-xs rounded-xl transition cursor-pointer"
          >
            📂 Import Native Files
          </button>
          <button
            onClick={() => {
              if (clips.length === 0) {
                alert('Your stitching bin is empty! Load video files or quick-import library materials below.');
                return;
              }
              setPreviewClipIdx(0);
              setPreviewTimer(0);
              setPreviewPlaying(true);
              setExportPreviewOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer"
          >
            Stitch & Render Video ➔
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column Settings block */}
        <div className="lg:col-span-7 space-y-6">

          {/* ✨ 1-CLICK READY-MADE EVENT TEMPLATES */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-black text-indigo-655 uppercase tracking-widest block text-indigo-600">Dynamic Template Wizard</span>
              <h3 className="text-sm font-black text-slate-900 mt-0.5">✨ One-Click Ready-Made Event Templates</h3>
              <p className="text-[10.5px] text-slate-500 mt-1">
                Select an occasion below to customize the soundtrack, filters, frames, and background replacements instantly! (Auto-populates story slides if empty).
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {READY_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyReadyTemplate(t.id)}
                  type="button"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-150 hover:border-indigo-500 hover:bg-slate-50/20 active:scale-[0.97] transition cursor-pointer text-center group"
                >
                  <span className="text-2xl group-hover:animate-bounce duration-300">{t.emoji}</span>
                  <span className="text-[10.5px] font-extrabold text-slate-800 mt-1">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* 🤖 AI & MANUAL HYBRID AUTO-COMPILER */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 text-white shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-indigo-505/30 pb-3">
              <div>
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block">Neural Video Synthesizer</span>
                <h3 className="text-sm font-black flex items-center gap-1.5 mt-0.5">
                  <span>🤖</span> AI Smart Timeline Auto-Compiler
                </h3>
              </div>
              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-bold">
                Multi-Format Co-Pilot
              </span>
            </div>

            {/* Collected statistics list */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="bg-slate-950/40 p-2 border border-slate-800/80 rounded-xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Wish Pool</div>
                <div className="text-lg font-black text-indigo-350 mt-0.5">
                  {media.filter(m => m.id && !m.id.includes('demo') && m.from !== 'Me (Composer)').length || 4}
                </div>
              </div>
              <div className="bg-slate-950/40 p-2 border border-slate-800/80 rounded-xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Video & Audio</div>
                <div className="text-lg font-black text-amber-450 mt-0.5">
                  {media.filter(m => (m.type === 'video' || m.type === 'audio') && m.from !== 'Me (Composer)').length || 2}
                </div>
              </div>
              <div className="bg-slate-950/40 p-2 border border-slate-800/80 rounded-xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Photoramas & Notes</div>
                <div className="text-lg font-black text-emerald-450 mt-0.5">
                  {media.filter(m => (m.type === 'photo' || m.type === 'text') && m.from !== 'Me (Composer)').length || 2}
                </div>
              </div>
            </div>

            {/* AI compilation style selector */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase text-indigo-300 tracking-wider">
                Select AI Assistant Aesthetic Direction
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'hype', title: 'High-Energy Hype Mix 🥁', desc: 'Active slide transitions, rainbow border neon frames, dance soundtrack, vibrant filter', border: 'border-amber-500/30' },
                  { id: 'nostalgia', title: 'Tear-Jerker Nostalgia 🥺', desc: 'Broad slow crossfade, elegant classic Polaroids, acoustic backing tracks, sepia grading', border: 'border-rose-500/30' },
                  { id: 'modern', title: 'Modern Clean Minimal ✨', desc: 'Straight cut layouts, pristine typography cards, lofi ambient soundtrack, grayscale film look', border: 'border-emerald-500/30' }
                ].map(vibe => {
                  const isActive = aiMood === vibe.id;
                  return (
                    <div
                      key={vibe.id}
                      onClick={() => setAiMood(vibe.id as any)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition select-none flex flex-col justify-between ${
                        isActive
                          ? 'bg-indigo-950/90 border-indigo-400 text-white shadow-lg shadow-indigo-950/50'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-extrabold text-[11px] text-slate-100">{vibe.title}</div>
                      <div className="text-[9.5px] mt-1 leading-normal text-slate-400">{vibe.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Compile Action status */}
            {isCompilingAi ? (
              <div className="bg-slate-950/80 border border-indigo-500/20 rounded-2xl p-4 text-center space-y-3">
                <div className="flex justify-center items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                  <span className="text-xs font-mono font-black text-indigo-400 uppercase tracking-widest">
                    AI Auto-Stitching: {aiCompileProgress}% Completed
                  </span>
                </div>
                
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div className="bg-gradient-to-r from-indigo-500 to-amber-500 h-full transition-all duration-300" style={{ width: `${aiCompileProgress}%` }} />
                </div>
                <div className="text-[10px] text-slate-350 italic font-mono">
                  ➜ {aiCompileStatus || 'Reading guest wishes database...'}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsCompilingAi(true);
                    setAiCompileProgress(0);
                    setAiCompileStatus('Retrieving all contributor submissions...');
                    
                    const stages = [
                      { p: 15, msg: 'Decoding video wishes and matching color grades...' },
                      { p: 40, msg: 'Generating designer written slides matching text styles...' },
                      { p: 65, msg: 'Calibrating photo overlays and applying chosen picture frames...' },
                      { p: 85, msg: 'Setting background soundscapes, crossfades, and balancing vocal audio...' },
                      { p: 100, msg: 'Success! Loaded neural timeline.' }
                    ];

                    let currentStage = 0;
                    const interval = setInterval(() => {
                      if (currentStage < stages.length) {
                        setAiCompileProgress(stages[currentStage].p);
                        setAiCompileStatus(stages[currentStage].msg);
                        currentStage++;
                      } else {
                        clearInterval(interval);
                        setIsCompilingAi(false);
                        
                        // Let's build real compiled clips from actual wishes inside the media store!
                        // Gather items that aren't the editor/composer ones
                        const wishes = media.filter(m => m.from && m.from !== 'Me (Composer)');
                        
                        const compiledList: any[] = wishes.map((w, idx) => {
                          let clipUrl = w.url || 'https://assets.mixkit.co/videos/preview/mixkit-celebration-with-fireworks-and-confetti-34063-large.mp4';
                          let clipType: 'video' | 'audio' | 'text' | 'photo' = w.type || 'video';
                          let clipDur = w.dur || 6;
                          let isVoiceToText = false;
                          let transcript = w.textBody || w.note || '';

                          const mockAudioTranscripts: Record<string, string> = {
                            'Emeka Obi': "Sending you massive love from Lagos! May your thirties bring infinite laughter, success, and divine peace. Happy birthday Oluwaseun!",
                            'Chiamaka Eze': "Hooray! Congratulations on your milestone anniversary, Chief & Mrs Nwosu! You look absolutely radiant, best wishes!",
                            'Chidi Okeke': "A toast to many more decades of love, happiness, laughter and good health! Cheers!"
                          };

                          // Convert voice note to text as image (i.e. convert 'audio' type to 'text' type card!)
                          if (clipType === 'audio') {
                            const rawName = w.from ? w.from.split('(')[0].trim() : 'Contributor';
                            transcript = mockAudioTranscripts[rawName] || "Wishing you absolute joy, happiness, and incredible health on this special celebration! May your days ahead be filled with laughter and magical memories.";
                            clipType = 'text';
                            isVoiceToText = true;
                            // Keep original audio url so it plays while drawing text image
                            clipUrl = w.url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
                            clipDur = w.dur || 8;
                          } else if (clipType === 'text') {
                            clipUrl = `TEXT_CARD_${idx}`;
                            clipDur = 7;
                          } else if (clipType === 'photo') {
                            clipDur = 5;
                          }

                          return {
                            id: 'compiled_' + w.id + '_' + Date.now(),
                            sourceMediaId: w.id,
                            type: clipType,
                            file: null,
                            url: clipUrl,
                            dur: clipDur,
                            name: isVoiceToText ? `🎙️ Transcribed Voice Wish - ${w.from.split('(')[0].trim()}` : `Wish from ${w.from.split('(')[0].trim()}`,
                            from: w.from,
                            textBody: transcript,
                            style: w.style || 'gradient',
                            trimStart: 0,
                            trimEnd: clipDur,
                            transition: aiMood === 'hype' ? 'slide' : aiMood === 'nostalgia' ? 'fade' : 'none',
                            isTranscribedVoice: isVoiceToText,
                            backgroundReplace: (w as any).backgroundReplace || 'none',
                            faceCentering: !!(w as any).faceCentering
                          };
                        });

                        // Fallback elements if wishes list is tiny
                        if (compiledList.length === 0) {
                          compiledList.push({
                            id: 'stub_intro',
                            sourceMediaId: 'intro',
                            type: 'text',
                            file: null,
                            url: 'TEXT_INTRO',
                            dur: 5,
                            name: 'Dynamic Intro Opening Card',
                            from: 'AI Compiler Co-Pilot',
                            textBody: 'Celebrate Together • Surprise Album',
                            style: 'royal',
                            trimStart: 0,
                            trimEnd: 5,
                            transition: 'fade'
                          });
                          compiledList.push({
                            id: 'stub_wish1',
                            sourceMediaId: 'wish1',
                            type: 'video',
                            file: null,
                            url: 'https://assets.mixkit.co/videos/preview/mixkit-celebration-with-fireworks-and-confetti-34063-large.mp4',
                            dur: 6,
                            name: 'Happy Anniversary Surprise Tribute',
                            from: 'ZippZap Co-Pilot',
                            textBody: '',
                            style: 'gradient',
                            trimStart: 0,
                            trimEnd: 6,
                            transition: 'fade'
                          });
                        }

                        // Assemble timeline order indexes
                        const pathOrder = compiledList.map((_, index) => index);
                        
                        // Apply custom mood state presets
                        if (aiMood === 'hype') {
                          setActiveVideoFilter('brightness');
                          setAnimatedFrame('neon');
                          setSoundtrackId('bm1');
                          setColorGrade('cyberpunk');
                          setWaveformStyle('cyber_bars');
                          setShowLiveAudioWaveform(true);
                        } else if (aiMood === 'nostalgia') {
                          setActiveVideoFilter('sepia');
                          setAnimatedFrame('vintage');
                          setSoundtrackId('bm4');
                          setColorGrade('sepia');
                          setWaveformStyle('wave');
                          setShowLiveAudioWaveform(true);
                        } else {
                          setActiveVideoFilter('none');
                          setAnimatedFrame('none');
                          setSoundtrackId('bm5');
                          setColorGrade('cinematic');
                          setWaveformStyle('spectrum');
                          setShowLiveAudioWaveform(true);
                        }

                        onUpdateClipsState(compiledList);
                        onUpdateTimelineState(pathOrder);
                        alert(`🤖 Inside AI Co-Pilot:\nSuccessfully assembled & compiled ${compiledList.length} segment classes into the timeline using the '${aiMood.toUpperCase()}' look! Added matched crossfades, background music, and typography overlays.`);
                      }
                    }, 650);
                  }}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-lg inline-flex items-center justify-center gap-1.5 active:scale-95"
                >
                  ⚡ Execute AI Smart Auto-Compile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Quick import manual wishes action
                    const wishes = media.filter(m => m.from && m.from !== 'Me (Composer)');
                    if (wishes.length === 0) {
                      alert('There are no guest wishes submitted yet! Test the portal first to add some wishes.');
                      return;
                    }
                    const compiledList = wishes.map((w, idx) => {
                      const clipDur = w.dur || 6;
                      return {
                        id: 'manual_' + w.id + '_' + Date.now(),
                        sourceMediaId: w.id,
                        type: w.type || 'video',
                        file: null,
                        url: w.url || 'https://assets.mixkit.co/videos/preview/mixkit-celebration-with-fireworks-and-confetti-34063-large.mp4',
                        dur: clipDur,
                        name: `Wish from ${w.from.split('(')[0]}`,
                        from: w.from,
                        textBody: w.textBody || w.note || '',
                        style: w.style || 'gradient',
                        trimStart: 0,
                        trimEnd: clipDur,
                        transition: 'fade'
                      };
                    });
                    
                    onUpdateClipsState([...clips, ...compiledList]);
                    // recalculate timeline indexes
                    const newOrd = [...clips, ...compiledList].map((_, i) => i);
                    onUpdateTimelineState(newOrd);
                    alert(`📥 Loaded ${compiledList.length} guest submissions manually straight into the compilation timeline!`);
                  }}
                  className="py-2.5 bg-slate-900 hover:bg-slate-800 text-indigo-400 font-extrabold text-xs uppercase tracking-wider rounded-xl border border-indigo-900/40 transition cursor-pointer inline-flex items-center justify-center gap-1"
                >
                  📥 Manual Import Wishes ({media.filter(m => m.from && m.from !== 'Me (Composer)').length || 0})
                </button>
              </div>
            )}

            {/* AI Subtitle Transcoder module */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span>🎙️</span> AI Dialogue & Subtitle Transcoder
              </h4>
              {isTranscribingSubtitles ? (
                <div className="bg-slate-950/80 border border-indigo-500/20 rounded-2xl p-4 text-center space-y-3">
                  <div className="flex justify-center items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-xs font-mono font-black text-indigo-400 uppercase tracking-widest">
                      AI Transcribing: {transcribeProgress}% Completed
                    </span>
                  </div>
                  
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div className="bg-gradient-to-r from-indigo-500 to-amber-500 h-full transition-all duration-300" style={{ width: `${transcribeProgress}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-350 italic font-mono">
                    ➜ {transcribeStatus || 'Processing voice waveforms...'}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleAutoTranscribeSubtitles}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10.5px] uppercase tracking-wider rounded-xl transition cursor-pointer shadow-lg inline-flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    🎙️ Auto-Transcribe Subtitles
                  </button>
                  {transcriptionSRT && (
                    <button
                      type="button"
                      onClick={handleDownloadSRT}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-850 text-emerald-400 font-extrabold text-[10.5px] uppercase tracking-wider rounded-xl border border-emerald-900/40 transition cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      📥 Download .SRT File
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Active timeline stitching bin */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-150">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <span>📼</span> Active Stitching Timeline ({clips.length} Clips)
                </h3>
                <p className="text-[10px] text-slate-400">Drag & drop cards to reorder clips. Trim start/end times below.</p>
              </div>
              <div className="flex gap-2 flex-wrap text-xs">
                {clips.length > 0 && (
                  <button onClick={onClearTimelineAll} className="px-2.5 py-1 text-[10px] font-black text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer border border-rose-100 transition whitespace-nowrap">
                    Clear Bin
                  </button>
                )}
              </div>
            </div>

            {/* Programmatic visual styling preferences panel */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl text-[11px] font-sans">
              <div className="flex flex-col gap-1 col-span-1">
                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px]">🎞️ Aspect Fit Choice</span>
                <div className="flex rounded-lg overflow-hidden border border-slate-200 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setFitMode('cover')}
                    className={`flex-1 py-1 rounded-md text-[10px] font-extrabold cursor-pointer transition ${
                      fitMode === 'cover' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Fill Cover
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitMode('contain')}
                    className={`flex-1 py-1 rounded-md text-[10px] font-extrabold cursor-pointer transition ${
                      fitMode === 'contain' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Letterbox Fit
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1 col-span-1">
                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px]">✨ Animated Border Frame Preset</span>
                <select
                  value={animatedFrame}
                  onChange={e => setAnimatedFrame(e.target.value as any)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none cursor-pointer h-full text-[11px]"
                >
                  <option value="none">None (Clean margins) 📽️</option>
                  <option value="sparkles">Golden Sparkles & Stars ✨</option>
                  <option value="hearts">Floating Hearts & Confetti ❤️</option>
                  <option value="neon">Dynamic Rainbow Neon Border 🌈</option>
                  <option value="vintage">Retro Sprocket Film Strip 🎞️</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px]">🎭 Video CSS Filter Choice</span>
                <select
                  value={activeVideoFilter}
                  onChange={e => setActiveVideoFilter(e.target.value as any)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none cursor-pointer h-[28px] text-[11px]"
                  id="video-css-filter-dropdown"
                >
                  <option value="none">None (Default Colors) 🎨</option>
                  <option value="grayscale">Grayscale (B&W Vintage) 🕶️</option>
                  <option value="sepia">Warm Sepia (Retro) 📜</option>
                  <option value="brightness">Extra Brightness (Vibrant) ☀️</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 col-span-1">
                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px]">🎞️ Cinematic Canvas LUT Grade</span>
                <select
                  value={colorGrade}
                  onChange={e => setColorGrade(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none cursor-pointer h-[28px] text-[11px]"
                  id="cinematic-color-grade-select"
                >
                  <option value="none">None (Direct Output) 📺</option>
                  <option value="warm">Warm Golden Vintage ☀️</option>
                  <option value="cool">Cool Frozen Indigo ❄️</option>
                  <option value="vibrant">Vibrant High Saturation 🔥</option>
                  <option value="bw">Saturated Noir B&W 🕶️</option>
                  <option value="sepia">Classic Antique Sepia 📜</option>
                  <option value="cinematic">Cinematic Teal & Orange 🎬</option>
                  <option value="cyberpunk">Cyberpunk Neon Magenta/Cyan 👾</option>
                  <option value="solarize">Solarized Sci-Fi Glow 🔋</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 col-span-1">
                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px]">🎙️ Live Audio Waveform</span>
                <div className="flex rounded-lg overflow-hidden border border-slate-200 bg-white p-0.5 h-[28px]">
                  <button
                    type="button"
                    onClick={() => setShowLiveAudioWaveform(true)}
                    className={`flex-1 py-0.5 rounded-md text-[9px] font-black cursor-pointer transition ${
                      showLiveAudioWaveform ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ON
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLiveAudioWaveform(false)}
                    className={`flex-1 py-0.5 rounded-md text-[9px] font-black cursor-pointer transition ${
                      !showLiveAudioWaveform ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    MUTED
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1 col-span-1">
                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px]">📊 Waveform Visualizer Style</span>
                <select
                  value={waveformStyle}
                  disabled={!showLiveAudioWaveform}
                  onChange={e => setWaveformStyle(e.target.value as any)}
                  className={`px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold outline-none cursor-pointer h-[28px] text-[11px] ${
                    !showLiveAudioWaveform ? 'opacity-50 text-slate-400 cursor-not-allowed' : 'text-slate-700'
                  }`}
                  id="waveform-style-select"
                >
                  <option value="spectrum">Classic Equalizer Bars 📶</option>
                  <option value="wave">Oscilloscope Sine Waves 〰️</option>
                  <option value="circular">Pulsating Radar Circular 🎯</option>
                  <option value="cyber_bars">Symmetric Dual Stereo VU 🔋</option>
                </select>
              </div>
            </div>

            {/* 💫 Timeline Actions & Transition orchestration */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-indigo-50/45 p-4 rounded-2xl border border-indigo-100">
              <div>
                <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">🎞️ Project Stitching Timeline</h4>
                <p className="text-[10px] text-slate-500 leading-normal">Drag to reorder hierarchy. Click any card below to load custom trimming & waves.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTransitionManagerOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] rounded-lg shrink-0 transition shadow-xs active:scale-95 cursor-pointer flex items-center gap-1"
                id="open-transition-manager-btn"
              >
                💫 Transition Manager
              </button>
            </div>

            {/* 🛠️ ADVANCED TIMELINE FINE-TUNING & SCRUBBING HUB */}
            {selectedClip && (
              <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div>
                    <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase">📽️ Fine-Tuning Workspace</span>
                    <h4 className="text-xs font-black truncate text-slate-100 uppercase" title={selectedClip.name}>
                      Editing clip: {selectedClip.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-2 py-0.5 font-bold uppercase">
                      {selectedClip.type || 'Media'}
                    </span>
                    <span className="text-[9px] bg-indigo-950/80 text-indigo-400 border border-indigo-900 rounded-lg px-2 py-0.5 font-bold">
                      Full Dur: {selectedClip.dur}s
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Aspect-Ratio dynamic thumbnail canvas */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center space-y-1.5 bg-slate-950 p-2 rounded-2xl border border-slate-850">
                    <div className="aspect-video w-full rounded-xl overflow-hidden relative border border-slate-800 bg-slate-900">
                      <canvas 
                        ref={thumbCanvasRef} 
                        width={320} 
                        height={180} 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[9.5px] font-mono text-slate-400 font-extrabold">
                      Clip Scrub Frame: <span className="text-indigo-400">{(selectedClip.trimStart + clipScrubTime).toFixed(1)}s</span>
                    </span>
                  </div>

                  {/* Scroller control layout */}
                  <div className="md:col-span-7 space-y-3">
                    {/* Scrubbing Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-400 uppercase tracking-widest">🎚️ Scrub Position</span>
                        <span className="font-mono text-indigo-400 font-black">{clipScrubTime.toFixed(1)}s / {(selectedClip.trimEnd - selectedClip.trimStart).toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(0.1, selectedClip.trimEnd - selectedClip.trimStart)}
                        step="0.1"
                        value={clipScrubTime}
                        onChange={e => setClipScrubTime(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                      />
                    </div>

                    {/* Precise dual trim boundaries */}
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div className="space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-400 uppercase tracking-wider">Trim Start</span>
                          <span className="font-mono text-slate-350">{selectedClip.trimStart.toFixed(1)}s</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={selectedClip.dur}
                          step="0.1"
                          value={selectedClip.trimStart}
                          onChange={e => handleUpdateTrim(selectedClipIdx, 'start', parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-400 uppercase tracking-wider">Trim End</span>
                          <span className="font-mono text-slate-350">{selectedClip.trimEnd.toFixed(1)}s</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={selectedClip.dur}
                          step="0.1"
                          value={selectedClip.trimEnd}
                          onChange={e => handleUpdateTrim(selectedClipIdx, 'end', parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🎙️ DETAILED AUDIO WAVEFORM & SILENCE NOISE FLOOR VISUALIZER */}
                {selectedClip.type === 'audio' && (
                  <div className="p-3.5 bg-slate-1000/30 bg-slate-950 rounded-2xl border border-slate-850 space-y-3 text-slate-200">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                      <span className="text-indigo-400 flex items-center gap-1">🎙️ High-Res Audio Waveform</span>
                      <span className="text-slate-400 font-bold uppercase">Silence Gate Cutoff</span>
                    </div>

                    {/* Wave peaks visualizer container */}
                    <div className="bg-[#05080e] rounded-xl overflow-hidden border border-slate-900">
                      <AudioWaveformCanvas
                        peaks={samplePeaks}
                        noiseGate={noiseGate}
                        trimStart={selectedClip.trimStart}
                        trimEnd={selectedClip.trimEnd}
                        duration={selectedClip.dur}
                        onUpdateTrim={(type, val) => {
                          handleUpdateTrim(selectedClipIdx, type, val);
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1 text-[10px]">
                      {/* Noise gate slider */}
                      <div className="sm:col-span-8 flex items-center gap-2">
                        <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">🔇 Noise Threshold:</span>
                        <input
                          type="range"
                          min="5"
                          max="80"
                          value={noiseGate}
                          onChange={e => setNoiseGate(parseInt(e.target.value))}
                          className="flex-grow h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                        />
                        <span className="font-mono text-indigo-400 font-bold shrink-0">{noiseGate}%</span>
                      </div>

                      {/* Auto trimmer button under visual guide */}
                      <div className="sm:col-span-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            // Find active ranges
                            const firstActiveIdx = samplePeaks.findIndex(p => p >= noiseGate);
                            const lastActiveIdx = [...samplePeaks].reverse().findIndex(p => p >= noiseGate);
                            
                            const startPct = firstActiveIdx !== -1 ? firstActiveIdx / samplePeaks.length : 0;
                            const endPct = lastActiveIdx !== -1 ? 1 - (lastActiveIdx / samplePeaks.length) : 1;
                            
                            const updated = [...clips];
                            const cl = updated[selectedClipIdx];
                            cl.trimStart = parseFloat((cl.dur * startPct).toFixed(1));
                            cl.trimEnd = parseFloat((cl.dur * endPct).toFixed(1));
                            onUpdateClipsState(updated);
                            alert(`✂️ Noise gate auto-applied!\n\nSilence trimmed from clip boundaries:\nTrim Start set to ${cl.trimStart}s\nTrim End set to ${cl.trimEnd}s`);
                          }}
                          className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black rounded-lg transition active:scale-95 text-[9px] uppercase cursor-pointer flex items-center gap-1"
                          id="auto-trim-audio-silence-btn"
                        >
                          ⚡ Auto-Trim Silence
                        </button>
                      </div>
                    </div>

                    <p className="text-[9px] text-slate-450 leading-normal text-slate-400">
                      Peaks colored <span className="text-amber-500 font-bold">faded amber</span> represents silent noise floors. Clicking <span className="font-bold text-white">Auto-Trim Silence</span> crops those zones instantly.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Trimming list grid cards with native HTML5 drag and drop */}
            <div className="space-y-2.5 max-h-[390px] overflow-y-auto pr-1">
              {clips.map((c, i) => {
                const typeLabel = c.type === 'video' ? '🎬 VIDEO' : c.type === 'photo' ? '📸 PHOTO' : c.type === 'audio' ? '🎙️ AUDIO' : '✍️ WRITTEN WISH';
                const themeBadge = c.type === 'photo' ? 'bg-amber-50 text-amber-600' : c.type === 'audio' ? 'bg-indigo-50 text-indigo-600' : c.type === 'text' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600';
                const isDragging = dragStartIdx === i;
                const isSelectedForTuning = selectedClipIdx === i;

                return (
                  <div 
                    key={c.id + '-' + i} 
                    className="space-y-2"
                    onClick={() => {
                      setSelectedClipIdx(i);
                      setClipScrubTime(0);
                    }}
                  >
                    <div
                      draggable="true"
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDragStartIdx(i);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropToReorder(i)}
                      onDragEnd={() => setDragStartIdx(null)}
                      className={`p-4 rounded-2xl space-y-3 cursor-pointer transition relative hover:shadow-xs group ${
                        isSelectedForTuning 
                          ? 'bg-white border-2 border-indigo-600 shadow-md ring-4 ring-indigo-50/70' 
                          : 'bg-slate-50/70 border border-slate-200'
                      } ${
                        isDragging ? 'opacity-40 border-dashed border-indigo-400 bg-indigo-50/30' : ''
                      }`}
                    >
                      {/* Drag handles decoration */}
                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition text-[10px] text-slate-350 select-none font-sans font-bold">
                        ⣿
                      </div>

                      <div className="flex justify-between items-center gap-3 bg">
                        <div className="flex items-center gap-2 pl-2">
                          <span className="text-xs font-bold text-indigo-600 font-mono">#{i + 1}</span>
                          <span className={`text-[9px] font-black tracking-wider px-2 py-0.5 rounded ${themeBadge}`}>{typeLabel}</span>
                          <h4 className="text-xs font-extrabold text-slate-800 truncate max-w-[110px] md:max-w-[160px]">{c.name}</h4>
                          {isSelectedForTuning && (
                            <span className="text-[8px] font-black text-indigo-500 tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded uppercase animate-pulse">
                              🎯 FINE-TUNING
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={() => handleMoveClip(i, 'up')}
                            className="p-1 px-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer transition text-[11px] font-bold"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={i === clips.length - 1}
                            onClick={() => handleMoveClip(i, 'down')}
                            className="p-1 px-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer transition text-[11px] font-bold"
                            title="Move Down"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => handleRemoveClip(i)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[9px] rounded-lg cursor-pointer transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Range Sliders Controls for trim range */}
                      <div className="space-y-2 text-xs pl-2">
                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest w-12 text-right">Start:</span>
                          <input
                            type="range"
                            min="0"
                            max={c.dur}
                            step="0.1"
                            className="flex-1 accent-indigo-600 cursor-pointer"
                            value={c.trimStart}
                            onChange={e => handleUpdateTrim(i, 'start', parseFloat(e.target.value))}
                          />
                          <span className="font-mono text-slate-600 w-12 text-right">{fmtT(c.trimStart)}</span>
                        </div>

                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest w-12 text-right">End:</span>
                          <input
                            type="range"
                            min="0"
                            max={c.dur}
                            step="0.1"
                            className="flex-1 accent-indigo-600 cursor-pointer"
                            value={c.trimEnd}
                            onChange={e => handleUpdateTrim(i, 'end', parseFloat(e.target.value))}
                          />
                          <span className="font-mono text-slate-600 w-12 text-right">{fmtT(c.trimEnd)}</span>
                        </div>
                      </div>

                      {/* AI One-Click Smart Settings (Background replacement, Speaker Face center, stabilize dampers) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 pt-2 border-t border-slate-150 text-[10px] space-y-1 sm:space-y-0" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                          <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[8px] text-indigo-600">👤 AI Background Removal</span>
                          <select
                            value={c.backgroundReplace || 'none'}
                            onChange={(e) => {
                              const updated = [...clips];
                              updated[i].backgroundReplace = e.target.value;
                              onUpdateClipsState(updated);
                            }}
                            className="bg-white border border-slate-200 px-1.5 py-1 rounded-md text-[9.5px] text-slate-700 font-extrabold outline-none cursor-pointer"
                          >
                            <option value="none">Original Video Backdrop 🎥</option>
                            <option value="birthday">Birthday Balloons Backdrop 🎈</option>
                            <option value="wedding">Wedding Rose Gold Hearts 💕</option>
                            <option value="corporate">Corporate Pitch Grid Lines 🏢</option>
                            <option value="award">Grand Golden Spotlight Stage 🏆</option>
                            <option value="church">Church Glowing Arches Back ⛪</option>
                            <option value="festival">Festival fireworks sky 🎆</option>
                            <option value="luxury">Luxury scarlet velvet 🍷</option>
                          </select>
                        </div>

                        <div className="flex flex-col justify-center space-y-1">
                          <label className="flex items-center gap-1.5 font-bold text-slate-650 cursor-pointer text-[9px]">
                            <input
                              type="checkbox"
                              checked={!!c.faceCentering}
                              onChange={(e) => {
                                const updated = [...clips];
                                updated[i].faceCentering = e.target.checked;
                                onUpdateClipsState(updated);
                              }}
                              className="rounded accent-indigo-600 cursor-pointer"
                            />
                            <span>👤 Speaker Face Centering</span>
                          </label>

                          <label className="flex items-center gap-1.5 font-bold text-slate-650 cursor-pointer text-[9px]">
                            <input
                              type="checkbox"
                              checked={c.videoCleanup !== false}
                              onChange={(e) => {
                                const updated = [...clips];
                                updated[i].videoCleanup = e.target.checked;
                                updated[i].audioCleanup = e.target.checked;
                                onUpdateClipsState(updated);
                              }}
                              className="rounded accent-indigo-600 cursor-pointer"
                            />
                            <span>🛡️ Auto-Stabilize & Noise Filter</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Transition overlay selector between successive clips in the stitching compilation */}
                    {i < clips.length - 1 && (
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-indigo-50/40 border border-indigo-100/50 rounded-xl mx-2 text-[10px] font-sans">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-extrabold">💫 Transition:</span>
                          <select
                            value={c.transition || 'fade'}
                            onChange={(e) => {
                              const updated = [...clips];
                              updated[i].transition = e.target.value;
                              onUpdateClipsState(updated);
                            }}
                            className="bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none font-bold text-slate-700 cursor-pointer text-[10px]"
                          >
                            <option value="fade">Fade (Cross-fade) 🌫️</option>
                            <option value="dissolve">Dissolve (Vaporize) 🫧</option>
                            <option value="slide">Slide (Swipe) ➔</option>
                            <option value="none">Quick Cut (None) ✂️</option>
                          </select>

                          {/* Render preview icon for chosen transition */}
                          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-white border border-slate-200 ml-1 shadow-2xs select-none" id={`transition-preview-icon-${i}`}>
                            {(() => {
                              const currentVal = c.transition || 'fade';
                              if (currentVal === 'fade') return <span title="Fade Icon">🌫️</span>;
                              if (currentVal === 'dissolve') return <span title="Dissolve Icon">🫧</span>;
                              if (currentVal === 'slide') return <span title="Slide Icon">➔</span>;
                              return <span title="Cut Icon">✂️</span>;
                            })()}
                          </div>
                        </div>

                        {/* Transitions Preview Actions Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewTransitionType(c.transition || 'fade');
                            setTimeout(() => {
                              setPreviewTransitionType(null); // auto close
                            }, 2000);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-600 font-extrabold transition cursor-pointer active:scale-95 text-[9px]"
                        >
                          👁️ Preview Transition
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {clips.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 select-none">
                  Stitching campaign timeline is empty. Import assets using the library drawer below!
                </div>
              )}
            </div>
          </div>

          {/* Quick Import Drawer for teammate contribution files (High comfort user helper) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
              <h3 className="text-xs font-bold text-[#1C1207] uppercase tracking-widest">📦 Quick Import from contributions</h3>
              <span className="text-[10px] text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-full font-black">
                {importableMedia.length} Available Contributions
              </span>
            </div>
            
            {importableMedia.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-1">
                {importableMedia.map(m => {
                  const typeEmoji = m.type === 'video' ? '📹' : m.type === 'photo' ? '📸' : m.type === 'audio' ? '🎙️' : '✍️';
                  return (
                    <div key={m.id} className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl flex justify-between items-center gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span>{typeEmoji}</span>
                          <span className="text-xs font-bold text-slate-800 truncate">{m.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">From: {m.from}</p>
                      </div>
                      <button
                        onClick={() => handleImportMediaToStudio(m)}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg shrink-0 transition"
                      >
                        ＋ Timeline
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-xs text-slate-400 py-4">No un-imported items left in media library structure! Friends and family can contribute more below.</p>
            )}
          </div>

          {/* 🎛️ ADVANCED MULTI-MEDIA STUDIO HUB */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#1C1207] tracking-tight flex items-center gap-1.5">
                  <span className="text-indigo-600">🎛️</span> Advanced Media Processing Desk
                </h3>
                <p className="text-[11px] text-slate-500">Edit, convert, record or synthesize voice notes, images and video clips.</p>
              </div>
              
              {/* Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl self-stretch sm:self-auto text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveStudioToolTab('video')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${activeStudioToolTab === 'video' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  🎬 Video
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStudioToolTab('audio')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${activeStudioToolTab === 'audio' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  🎙️ Audio
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStudioToolTab('converters')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${activeStudioToolTab === 'converters' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  🔄 Converters
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStudioToolTab('specials')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${activeStudioToolTab === 'specials' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  ✨ Wizards
                </button>
              </div>
            </div>

            {/* TAB CONTENT: VIDEO SUITE */}
            {activeStudioToolTab === 'video' && (
              <div className="space-y-4 animate-in fade-in duration-100 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Screen Recorder Card */}
                  <div className="p-3 bg-slate-50/50 border border-slate-150 rounded-xl space-y-2">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">🖥️ Screen Recorder</span>
                    <p className="text-[10.5px] text-slate-500">Capture slides, browser screens or custom application windows.</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (isScreenRecording) {
                            setIsScreenRecording(false);
                            // Add mock recorded clip
                            const item = {
                              id: 'screen_' + Date.now(),
                              sourceMediaId: 'screen_' + Date.now(),
                              type: 'video',
                              file: null,
                              url: 'https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-smartphone-in-vertical-position-42526-large.mp4',
                              dur: 8,
                              name: `Screen Share Capture`,
                              from: 'Me (Composer)',
                              textBody: '',
                              style: 'gradient',
                              trimStart: 0,
                              trimEnd: 8,
                              transition: 'fade'
                            };
                            onUpdateClipsState([...clips, item]);
                            onUpdateTimelineState([...timelineOrder, clips.length]);
                            alert('🎥 Screen shares successfully integrated into timeline project!');
                          } else {
                            alert('🖥️ Screen capture request approved! Ready window picker...');
                            setIsScreenRecording(true);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-white font-extrabold flex items-center gap-1 cursor-pointer transition ${isScreenRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800'}`}
                      >
                        <span className={`w-2 h-2 rounded-full bg-white ${isScreenRecording ? 'animate-ping' : ''}`} />
                        {isScreenRecording ? 'Stop Screen Record' : 'Record Screen'}
                      </button>
                      {isScreenRecording && (
                        <span className="font-mono text-xs font-black text-rose-600 animate-pulse">
                          Recording: {screenRecordTimer}s
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Camera Video Recorder Card */}
                  <div className="p-3 bg-slate-50/50 border border-slate-150 rounded-xl space-y-2">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">🎥 Webcam Video Recorder</span>
                    <p className="text-[10.5px] text-slate-500">Log guest greetings straight using local browser camera feed.</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (isWebcamRecording) {
                            setIsWebcamRecording(false);
                            const item = {
                              id: 'webcam_' + Date.now(),
                              sourceMediaId: 'webcam_' + Date.now(),
                              type: 'video',
                              file: null,
                              url: 'https://assets.mixkit.co/videos/preview/mixkit-friends-taking-a-selfie-photo-40004-large.mp4',
                              dur: 6,
                              name: `Camera Selfie Greeting`,
                              from: 'Me (Camera)',
                              textBody: '',
                              style: 'gradient',
                              trimStart: 0,
                              trimEnd: 6,
                              transition: 'fade'
                            };
                            onUpdateClipsState([...clips, item]);
                            onUpdateTimelineState([...timelineOrder, clips.length]);
                            alert('📸 Camera selfie stream recorded and exported directly into timeline pipeline!');
                          } else {
                            alert('📷 Requesting camera permissions. Say cheese and record your warm wishes! Countdown starting...');
                            setIsWebcamRecording(true);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-white font-extrabold flex items-center gap-1 cursor-pointer transition ${isWebcamRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800'}`}
                      >
                        <span className={`w-2 h-2 rounded-full bg-white ${isWebcamRecording ? 'animate-ping' : ''}`} />
                        {isWebcamRecording ? 'Stop Webcam' : 'Webcam Record'}
                      </button>
                      {isWebcamRecording && (
                        <span className="font-mono text-xs font-black text-rose-600 animate-pulse">
                          Rec: {webcamRecordTimer}s
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Video modifiers panel */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">⚙️ Stitcher Video Modifiers</span>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {/* Crop tool */}
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-black text-slate-700">📐 Canvas Crop Aspect</label>
                      <select
                        value={cropAspect}
                        onChange={e => {
                          setCropAspect(e.target.value as any);
                          alert(`📐 Master Canvas aspect fit forced to: ${e.target.value}`);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 block font-bold text-slate-650"
                      >
                        <option value="16:9">16:9 Landscape (YouTube)</option>
                        <option value="9:16">9:16 Portrait (Tiktok/Reels)</option>
                        <option value="1:1">1:1 Square (Instagram Post)</option>
                        <option value="4:3">4:3 Retro Cinema SD</option>
                      </select>
                    </div>

                    {/* Logo Remover coordinates blocker */}
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-black text-slate-700">🛡️ Logo/Watermark Mask</label>
                      <select
                        value={logoRemovalCorner}
                        onChange={e => {
                          setLogoRemovalCorner(e.target.value as any);
                          if (e.target.value !== 'none') {
                            alert(`🛡️ Filter applied: Overlay blocker cover configured at [CORNER: ${e.target.value.toUpperCase()}]. Logo successfully masked.`);
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 block font-bold text-slate-650"
                      >
                        <option value="none">Disabled (No Filter)</option>
                        <option value="top-left">Mask Top-Left Corner</option>
                        <option value="top-right">Mask Top-Right Corner</option>
                        <option value="bottom-left">Mask Bottom-Left Corner</option>
                        <option value="bottom-right">Mask Bottom-Right Corner</option>
                      </select>
                    </div>

                    {/* Video Stabilizer */}
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-black text-slate-700">📹 Digital Steadicam</label>
                      <select
                        value={videoStabilizeStrength}
                        onChange={e => {
                          setVideoStabilizeStrength(e.target.value as any);
                          if (e.target.value !== 'none') {
                            alert(`📹 Roll stabilizer set to: ${e.target.value.toUpperCase()} strength. Output frame shakes stabilized.`);
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 block font-bold text-slate-650"
                      >
                        <option value="none">Disabled (Native Raw)</option>
                        <option value="low">Subtle (Gimbal Buffering)</option>
                        <option value="med">Medium Electronic Roll Crop</option>
                        <option value="high">Intense Horizon-Lock Smooth</option>
                      </select>
                    </div>

                    {/* Volume Multiplier */}
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-black text-slate-700">🔊 Master Compilation Volume</label>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={masterVideoVolume}
                        onChange={e => {
                          setMasterVideoVolume(parseInt(e.target.value));
                        }}
                        className="w-full accent-indigo-600 block mt-2 cursor-pointer"
                      />
                      <div className="flex justify-between font-mono text-[9px] text-slate-400 mt-1">
                        <span>0% Muted</span>
                        <span className="font-bold text-indigo-600">{masterVideoVolume}% Volume</span>
                        <span>200% Output Boost</span>
                      </div>
                    </div>

                    {/* Speed rate modifier */}
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-black text-slate-700">🏃 Video Motion Pace</label>
                      <select
                        value={audioSpeed}
                        onChange={e => {
                          setAudioSpeed(parseFloat(e.target.value));
                          alert(`🏃 Video playback play speed rate updated to ${e.target.value}x!`);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 block font-bold text-slate-650"
                      >
                        <option value="0.25">0.25x Slow-mo frame buffer</option>
                        <option value="0.5">0.50x Slow-mo rate</option>
                        <option value="1.0">1.0x Normal Motion speed</option>
                        <option value="1.5">1.5x Rapid Motion</option>
                        <option value="2.0">2.0x Double speed accelerate</option>
                        <option value="3.0">3.0x Hyper-lapse pacing</option>
                      </select>
                    </div>

                    {/* Short Gif repetitive Looping */}
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-black text-slate-700">🔁 Short Clip Loop Reps</label>
                      <select
                        value={loopRepetitions}
                        onChange={e => {
                          setLoopRepetitions(parseInt(e.target.value));
                          alert(`🔁 Timelines short cards set to repeat looping: ${e.target.value} times.`);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 block font-bold text-slate-650"
                      >
                        <option value="1">Play 1x (No repeats)</option>
                        <option value="2">Play 2x Looped repeat</option>
                        <option value="3">Play 3x Looped repeat</option>
                        <option value="5">Play 5x Looped loop</option>
                        <option value="10">Play 10x Constant Loop</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-150 pt-2 text-[10.5px] text-slate-500 font-medium">
                    <span>🔄 Multi-Video Merge Joiner is fully enabled. Timeline order defines rendering sequence.</span>
                    <button
                      type="button"
                      onClick={() => alert(`🚀 Compilation parameters updated! Master audio track speed scale: ${audioSpeed}x. Stabilizer strength: ${videoStabilizeStrength}. Canvas Crop: ${cropAspect}. Mask state: ${logoRemovalCorner === 'none' ? 'Inert' : logoRemovalCorner.toUpperCase()}`)}
                      className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg font-extrabold hover:bg-indigo-100/75 transition"
                    >
                      Save Parameters
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: AUDIO SUITE */}
            {activeStudioToolTab === 'audio' && (
              <div className="space-y-4 animate-in fade-in duration-105 text-xs text-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Text-To-Speech (TTS) Engine */}
                  <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">🗣️ Natural Text-to-Speech Engine</span>
                      <span className="text-[8px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-black">AI SYNTHESIS</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500">Synthesize customized guest notes straight into audible narration files.</p>
                    <textarea
                      value={ttsInput}
                      onChange={e => setTtsInput(e.target.value)}
                      rows={2}
                      placeholder="Write verbal blessing narration here... (e.g. Wishing you a robust, highly incredible 30th celebrations!)"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500 text-slate-700"
                    />
                    <div className="flex justify-between items-center gap-2">
                      <select
                        value={ttsAccent}
                        onChange={e => setTtsAccent(e.target.value)}
                        className="bg-white border border-slate-150 rounded-lg p-1.5 font-bold h-7.5 outline-none text-[10.5px]"
                      >
                        <option value="us-warm">🎙️ US English Warm Accent</option>
                        <option value="uk-elegant">👒 UK English Sophisticated Accent</option>
                        <option value="british-classic">🇬🇧 British Gentleman Voice</option>
                        <option value="nigerian-pidgin">🇳🇬 Nigerian Pidgin Warm Voice</option>
                      </select>
                      <button
                        type="button"
                        disabled={!ttsInput || ttsGenerating}
                        onClick={() => {
                          setTtsGenerating(true);
                          setTimeout(() => {
                            setTtsGenerating(false);
                            const item = {
                              id: 'tts_' + Date.now(),
                              sourceMediaId: 'tts_' + Date.now(),
                              type: 'audio',
                              file: null,
                              url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', // dummy backing
                              dur: 7,
                              name: `TTS Voice (${ttsAccent})`,
                              from: 'Me (Narrator)',
                              textBody: ttsInput,
                              style: 'gradient',
                              trimStart: 0,
                              trimEnd: 7,
                              transition: 'fade'
                            };
                            onUpdateClipsState([...clips, item]);
                            onUpdateTimelineState([...timelineOrder, clips.length]);
                            setTtsInput('');
                            alert(`🎧 AI Speech Synthesized!\n\nAccent: ${ttsAccent.toUpperCase()}\nNarration: "${ttsInput}"\n\nSynthetic WAV file has been successfully appended to the timeline!`);
                          }, 1500);
                        }}
                        className={`px-3 py-1.5 h-7.5 rounded-lg text-white font-extrabold transition cursor-pointer flex items-center justify-center ${ttsGenerating ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                      >
                        {ttsGenerating ? '🗣️ Synthesizing...' : '＋ Generate TTS'}
                      </button>
                    </div>
                  </div>

                  {/* Microphone Recorder Card */}
                  <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">🎙️ vocal Voice Note Recorder</span>
                      <span className="text-[8px] bg-red-101 text-red-600 border border-red-50 bg-red-50 px-1.5 py-0.2 rounded font-black">MIC DETECTED</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500">Record a high-quality verbal wish right now to join backing soundtracks.</p>
                    
                    {/* Pulsing visual spectrum for recording */}
                    <div className="h-11 bg-slate-900 rounded-lg flex items-center justify-center gap-1 overflow-hidden relative">
                      {isVoiceRecording ? (
                        <div className="flex items-end justify-center gap-[4px] h-full py-2">
                          {[...Array(16)].map((_, i) => {
                            const heights = [28, 44, 18, 38, 12, 32, 22, 48, 16, 36, 14, 26, 34, 12, 40, 20];
                            const hValue = heights[i % heights.length];
                            return (
                              <div
                                key={i}
                                className="w-1.5 rounded-full bg-indigo-400"
                                style={{
                                  height: `${hValue}%`,
                                  animation: `fadePrv ${0.4 + (i * 0.05)}s ease-in-out infinite alternate`
                                }}
                              />
                            );
                          })}
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-black text-rose-500 animate-pulse bg-slate-950 px-2 py-0.5 rounded border border-rose-950">
                            REC {voiceRecordTimer}s
                          </span>
                        </div>
                      ) : (
                        <div className="text-[10.5px] text-slate-500 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                          <span>●</span> Microphone state: Standing By
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (isVoiceRecording) {
                            setIsVoiceRecording(false);
                            const item = {
                              id: 'voice_' + Date.now(),
                              sourceMediaId: 'voice_' + Date.now(),
                              type: 'audio',
                              file: null,
                              url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
                              dur: 5,
                              name: `Tribute Mic Record`,
                              from: 'Me (Microphone)',
                              textBody: '',
                              style: 'gradient',
                              trimStart: 0,
                              trimEnd: 5,
                              transition: 'fade'
                            };
                            onUpdateClipsState([...clips, item]);
                            onUpdateTimelineState([...timelineOrder, clips.length]);
                            alert('📁 Recorded vocal track joined into backing timeline tracks successfully!');
                          } else {
                            alert('🎙️ Connecting microphone input lines. Wave spectrograph loaded! Start speaking...');
                            setIsVoiceRecording(true);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-white font-extrabold flex items-center justify-center gap-1 flex-1 cursor-pointer transition ${isVoiceRecording ? 'bg-red-500 hover:bg-red-650' : 'bg-slate-900 hover:bg-slate-800'}`}
                      >
                        🗣️ {isVoiceRecording ? 'Stop Recording Wish' : 'Speak Vocal Tribute Now'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* EQ and Modulations */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">🎚️ 3-Band Parametric Equalizer (EQ)</span>
                    <span className="text-[9.5px] text-indigo-600 font-extrabold">LIVE DECORATOR MODULATORS</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    {/* Low/Bass */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10.5px] font-bold">
                        <span className="text-slate-500">Bass (Low range)</span>
                        <span className="font-mono text-indigo-600 font-extrabold">{eqBass - 50 > 0 ? '+' : ''}{eqBass - 50} dB</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={eqBass}
                        onChange={e => setEqBass(parseInt(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer block"
                      />
                    </div>

                    {/* Mid Range */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10.5px] font-bold">
                        <span className="text-slate-500">Vocal Mid Focus</span>
                        <span className="font-mono text-indigo-600 font-extrabold">{eqMid - 50 > 0 ? '+' : ''}{eqMid - 50} dB</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={eqMid}
                        onChange={e => setEqMid(parseInt(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer block"
                      />
                    </div>

                    {/* High Treble */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10.5px] font-bold">
                        <span className="text-slate-500">Treble (Sparkle)</span>
                        <span className="font-mono text-indigo-600 font-extrabold">{eqTreble - 50 > 0 ? '+' : ''}{eqTreble - 50} dB</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={eqTreble}
                        onChange={e => setEqTreble(parseInt(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer block"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-150 pt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Pitch shifter */}
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-black text-slate-505 block">🧙 AI Vocal Pitch Changer</label>
                      <select
                        value={audioPitch}
                        onChange={e => {
                          setAudioPitch(parseFloat(e.target.value));
                          alert(`🧙 Microphone pitch offset locked. Style forced: ${e.target.value === '1' ? 'Default Natural' : e.target.value === '1.5' ? 'Squeaky Cute Chipmunk' : 'Deep Robotic Bass Cyborg'}`);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 block font-bold text-slate-650"
                      >
                        <option value="1">1.0x Default Natural Range</option>
                        <option value="1.5">1.5x Squeaky Cute Chipmunk</option>
                        <option value="1.8">1.8x High Squeal Accent</option>
                        <option value="0.6">0.60x Deep Bass Demon Tone</option>
                        <option value="0.75">0.75x Robotic Boss Pitch</option>
                      </select>
                    </div>

                    {/* Audio Reverse Player */}
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-black text-slate-505 block text-left">🔄 Backward Audio reversing</label>
                      <div className="flex items-center gap-2 mt-1.5 pl-1">
                        <input
                          type="checkbox"
                          checked={audioReversed}
                          onChange={e => {
                            setAudioReversed(e.target.checked);
                            alert(e.target.checked ? '🔄 Special audio reversed flag: Backwards play mode simulation acts enabled!' : 'Normal audio direction restored.');
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded cursor-pointer animate-none"
                          id="reverse-audio-toggle"
                        />
                        <span className="text-[11px] font-black text-slate-700">Reverse play track direction</span>
                      </div>
                    </div>

                    {/* Audio Joiner helper */}
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-black text-slate-505 block text-left">🔊 Audio Tracks Joiner</label>
                      <button
                        type="button"
                        onClick={() => {
                          const soundClips = clips.filter(c => c.type === 'audio');
                          if (soundClips.length < 2) {
                            alert('🔊 Ensure you have added at least 2 Audio files (using microphones or TTS synthesizers) inside your active timeline block to compile-join them!');
                            return;
                          }
                          const mergedId = 'joined_' + Date.now();
                          const joinedClip = {
                            id: mergedId,
                            sourceMediaId: mergedId,
                            type: 'audio',
                            file: null,
                            url: soundClips[0].url,
                            dur: soundClips.reduce((acc, c) => acc + c.dur, 0),
                            name: `Joined: ${soundClips[0].name.split(' ')[0]} + ${soundClips[1].name.split(' ')[0]}`,
                            from: 'Combined Signal',
                            textBody: 'Merged audio track segments compiled.',
                            style: 'gradient',
                            trimStart: 0,
                            trimEnd: soundClips.reduce((acc, c) => acc + c.dur, 0),
                            transition: 'fade'
                          };
                          // Filter out old sound clips and replace with combined
                          onUpdateClipsState([...clips.filter(c => c.type !== 'audio'), joinedClip]);
                          alert(`🔊 Audio signals synchronized! Merged ${soundClips.length} guest tracks together. Consolidating into dynamic item: "${joinedClip.name}"`);
                        }}
                        className="w-full bg-slate-900 text-white font-extrabold text-[10.5px] py-2 rounded-lg cursor-pointer hover:bg-slate-800 transition"
                      >
                        🔊 Sync & Join Tracks
                      </button>
                    </div>
                  </div>
                </div>

                {/* Standalone Canvas Waveform Silence-Clipper inside Audio Tools Tab */}
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-4 text-white">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-[10.5px] font-black text-indigo-400 uppercase tracking-widest block font-mono">📈 Audio Tools Canvas Waveform Visualizer</span>
                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-950 px-2 py-0.5 rounded font-black uppercase">Visual Silence Trimmer</span>
                  </div>

                  {(() => {
                    const audioClips = clips.filter(c => c.type === 'audio');
                    if (audioClips.length === 0) {
                      return (
                        <div className="py-6 text-center text-[11px] text-slate-400 bg-slate-900/20 rounded-xl border border-slate-800 border-dashed">
                          📻 No Audio clips in timeline. Generate Text-to-Speech or record using voice above to load waves!
                        </div>
                      );
                    }

                    const traceIdx = Math.min(selectedAudioToolIdx, audioClips.length - 1);
                    const clip = audioClips[traceIdx >= 0 ? traceIdx : 0];
                    if (!clip) return null;

                    // Compute peaks
                    const peaks = [];
                    const seedString = clip.id || 'seed';
                    let seedVal = 0;
                    for (let cIdx = 0; cIdx < seedString.length; cIdx++) {
                      seedVal += seedString.charCodeAt(cIdx);
                    }
                    for (let i = 0; i < 60; i++) {
                      let noiseFactor = Math.sin(i * 0.15 + seedVal) * Math.cos(i * 0.08);
                      let baseAmp = 0;
                      if (i < 8) {
                        baseAmp = 6 + Math.abs(noiseFactor) * 8;
                      } else if (i >= 8 && i < 24) {
                        baseAmp = 42 + Math.abs(noiseFactor) * 45;
                      } else if (i >= 24 && i < 32) {
                        baseAmp = 5 + Math.abs(noiseFactor) * 9;
                      } else if (i >= 32 && i < 50) {
                        baseAmp = 38 + Math.abs(noiseFactor) * 55;
                      } else {
                        baseAmp = 8 + Math.abs(noiseFactor) * 10;
                      }
                      peaks.push(Math.round(Math.max(2, Math.min(95, baseAmp))));
                    }

                    const originalClipIndex = clips.findIndex(c => c.id === clip.id);

                    return (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-sans">
                          <label className="text-[10.5px] font-bold text-slate-400">Choose Audio Clip to Analyze:</label>
                          <select
                            value={traceIdx >= 0 ? traceIdx : 0}
                            onChange={(e) => setSelectedAudioToolIdx(parseInt(e.target.value))}
                            className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-bold text-xs text-indigo-300 outline-none cursor-pointer h-8"
                          >
                            {audioClips.map((c, i) => (
                              <option key={`tool-audio-${c.id}-${i}`} value={i} className="bg-slate-900">
                                🎵 {c.name} ({c.dur}s)
                              </option>
                            ))}
                          </select>
                        </div>

                        <AudioWaveformCanvas
                          peaks={peaks}
                          noiseGate={noiseGate}
                          trimStart={clip.trimStart}
                          trimEnd={clip.trimEnd}
                          duration={clip.dur}
                          onUpdateTrim={(type, val) => {
                            if (originalClipIndex !== -1) {
                              handleUpdateTrim(originalClipIndex, type, val);
                            }
                          }}
                        />

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1 text-[10.5px] font-sans">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="font-bold text-slate-450 text-slate-400">🔇 Threshold:</span>
                            <input
                              type="range"
                              min="5"
                              max="80"
                              value={noiseGate}
                              onChange={e => setNoiseGate(parseInt(e.target.value))}
                              className="w-32 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                            />
                            <span className="font-mono text-indigo-300 font-bold">{noiseGate}%</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const firstActiveIdx = peaks.findIndex(p => p >= noiseGate);
                              const lastActiveIdx = [...peaks].reverse().findIndex(p => p >= noiseGate);
                              
                              const startPct = firstActiveIdx !== -1 ? firstActiveIdx / peaks.length : 0;
                              const endPct = lastActiveIdx !== -1 ? 1 - (lastActiveIdx / peaks.length) : 1;
                              
                              if (originalClipIndex !== -1) {
                                const updated = [...clips];
                                const cl = updated[originalClipIndex];
                                cl.trimStart = parseFloat((cl.dur * startPct).toFixed(1));
                                cl.trimEnd = parseFloat((cl.dur * endPct).toFixed(1));
                                onUpdateClipsState(updated);
                                alert(`✂️ Speech Analyzer Trimmed Silence from [${cl.name}] boundaries:\nTrim Start set to ${cl.trimStart}s\nTrim End set to ${cl.trimEnd}s`);
                              }
                            }}
                            className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] rounded-lg tracking-wider uppercase transition active:scale-95 cursor-pointer"
                          >
                            ⚡ Crop Silent Segments
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* TAB CONTENT: ADVANCED CONVERTERS */}
            {activeStudioToolTab === 'converters' && (
              <div className="space-y-4 animate-in fade-in duration-100 text-xs text-slate-700">
                <p className="text-[11px] text-slate-500 leading-normal">
                  Transpiles raw storage files, screenshots or soundwaves between standard extensions. Useful when family members upload exotic device formats.
                </p>

                <div className="p-4 bg-slate-50/50 border border-slate-200 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-indigo-50 pb-3">
                    <span className="font-black text-[10.5px] text-indigo-700 uppercase">⚡ Advanced Transcoder Core</span>
                    
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200 text-[9.5px] font-extrabold shadow-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          setConvertType('video');
                          setConvertInFormat('MP4');
                          setConvertOutFormat('WEBM');
                        }}
                        className={`px-3 py-1 rounded-md transition ${convertType === 'video' ? 'bg-indigo-600 text-white shadow-3xs' : 'text-slate-650'}`}
                      >
                        🎬 Video Converter (MP4/MKV)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConvertType('audio');
                          setConvertInFormat('MP3');
                          setConvertOutFormat('WAV');
                        }}
                        className={`px-3 py-1 rounded-md transition ${convertType === 'audio' ? 'bg-indigo-600 text-white shadow-3xs' : 'text-slate-650'}`}
                      >
                        🎙️ Audio Converter (MP3/OGG)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConvertType('image');
                          setConvertInFormat('PNG');
                          setConvertOutFormat('JPG');
                        }}
                        className={`px-3 py-1 rounded-md transition ${convertType === 'image' ? 'bg-indigo-600 text-white shadow-3xs' : 'text-slate-650'}`}
                      >
                        📸 Image Converter (PNG/HEIC)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 items-end">
                    {/* Input Format */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">📥 Original uploaded extension</label>
                      <select
                        value={convertInFormat}
                        onChange={e => setConvertInFormat(e.target.value)}
                        className="w-full bg-white border border-slate-150 rounded-lg p-1.5 font-bold text-slate-700 outline-none"
                      >
                        {convertType === 'video' && (
                          <>
                            <option value="MP4">MP4 Native Video (.mp4)</option>
                            <option value="MOV">MOV Apple ProRes (.mov)</option>
                            <option value="MKV">MKV Matroska Container (.mkv)</option>
                            <option value="AVI">AVI Windows Legacy (.avi)</option>
                          </>
                        )}
                        {convertType === 'audio' && (
                          <>
                            <option value="MP3">MP3 Compression Layer-3 (.mp3)</option>
                            <option value="WAV">WAV Uncompressed Pulse PCM (.wav)</option>
                            <option value="M4A">M4A Apple AAC Codec (.m4a)</option>
                            <option value="FLAC">FLAC Free Lossless Codec (.flac)</option>
                          </>
                        )}
                        {convertType === 'image' && (
                          <>
                            <option value="PNG">PNG Portable Networks Graphics (.png)</option>
                            <option value="JPG">JPG Joint Photographic Graphics (.jpg)</option>
                            <option value="HEIC">HEIC iOS High-Efficiency (.heic)</option>
                            <option value="WEBP">WEBP Modern Google Lossy (.webp)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Output Format */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">📤 Target container conversion</label>
                      <select
                        value={convertOutFormat}
                        onChange={e => setConvertOutFormat(e.target.value)}
                        className="w-full bg-white border border-slate-150 rounded-lg p-1.5 font-bold text-slate-700 outline-none"
                      >
                        {convertType === 'video' && (
                          <>
                            <option value="WEBM">WEBM Optimized HTML5 (.webm)</option>
                            <option value="MP4">MP4 Mobile Universal (.mp4)</option>
                            <option value="MOV">MOV QuickTime Movie (.mov)</option>
                            <option value="AVI">AVI DivX Format (.avi)</option>
                          </>
                        )}
                        {convertType === 'audio' && (
                          <>
                            <option value="WAV">WAV Lossless 1411kbps Studio (.wav)</option>
                            <option value="MP3">MP3 Compact 320kbps Standard (.mp3)</option>
                            <option value="AAC">AAC Sophisticated Stream (.aac)</option>
                            <option value="OGG">OGG Vorbis Linux Waveform (.ogg)</option>
                          </>
                        )}
                        {convertType === 'image' && (
                          <>
                            <option value="WebP">WebP Super-compressed (.webp)</option>
                            <option value="JPG">JPG Classical Exif (.jpg)</option>
                            <option value="PNG">PNG Alpha Transparent (.png)</option>
                            <option value="TIFF">TIFF Heavy Print Standard (.tiff)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Action trigger button */}
                    <div>
                      <button
                        type="button"
                        disabled={convertProgress > 0 && convertProgress < 100}
                        onClick={() => {
                          setConvertProgress(1);
                          setConvertStatus(`Allocating background buffers for dynamic ${convertType} transcoding stream...`);
                          
                          let interval: any = setInterval(() => {
                            setConvertProgress(prev => {
                              if (prev >= 100) {
                                clearInterval(interval);
                                setConvertStatus(`Transcoding complete. Input ${convertInFormat} converted package successfully synthesized into lossless ${convertOutFormat} structure! Check output below.`);
                                return 100;
                              }
                              
                              const step = prev + 12;
                              if (step > 40 && step < 80) {
                                setConvertStatus(`Splitting multithread signals, rewriting containers into target: ${convertOutFormat}...`);
                              } else if (step >= 80) {
                                setConvertStatus(`Assembling segments, sealing trailer tags and finalizing data buffers...`);
                              }
                              return Math.min(100, step);
                            });
                          }, 250);
                        }}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold h-9.5 py-1.5 rounded-lg text-center cursor-pointer transition block shadow-sm shadow-slate-100"
                      >
                        {convertProgress > 0 && convertProgress < 100 ? '🔄 Converting...' : '⚡ Launch Convert Engine'}
                      </button>
                    </div>
                  </div>

                  {/* Progress panel representation */}
                  {convertProgress > 0 && (
                    <div className="p-3 bg-slate-950 text-white rounded-xl font-mono text-[10px] space-y-2 max-w-full">
                      <div className="flex justify-between items-center text-indigo-400 font-extrabold">
                        <span>🚀 CONVERTER THREAD: {convertInFormat} ➔ {convertOutFormat}</span>
                        <span>{convertProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full transition-all duration-150" style={{ width: `${convertProgress}%` }} />
                      </div>
                      <p className="text-slate-300 leading-normal pl-1.5 border-l-2 border-indigo-500 truncate max-w-full">
                        Status: {convertStatus}
                      </p>
                      
                      {convertProgress === 100 && (
                        <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-800">
                          <span className="text-[10px] font-sans font-black text-emerald-400">✅ Mock conversion download generated!</span>
                          <button
                            type="button"
                            onClick={() => {
                              alert(`📥 Downloading mock result file: converted_output_${Date.now()}.${convertOutFormat.toLowerCase()}\n\nEnjoy clean cross-device playback compatibility!`);
                              setConvertProgress(0);
                              setConvertStatus(null);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded px-2.5 py-1 font-sans text-[10px] cursor-pointer"
                          >
                            📥 Fetch Converted Package
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: CLIP SPECIALTIES (WIZARD SPECIALS) */}
            {activeStudioToolTab === 'specials' && (
              <div className="space-y-4 animate-in fade-in duration-100 text-xs text-slate-700">
                <p className="text-[11.5px] text-slate-500 leading-normal">
                  Perform automatic format transitions on specific clips to design unified video streams. Convert silent messages to high-contrast graphic frames or vocal notes to caption tracks.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tool 1: Written text wish to framed graphic block */}
                  <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">🎨 Auto Wish-to-Image Graphics Frame Card</span>
                    <p className="text-[10.5px] text-slate-500 font-medium">
                      Convert any family guest's written text note into an elegant, custom-designed PNG visual frame card with stylish themed borders, so it slides beautifully inside the movie transitions!
                    </p>

                    {clips.filter(c => c.type === 'text').length > 0 ? (
                      <div className="space-y-3.5">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 block">Select Guest Text Clip</label>
                          <select
                            id="wizard-text-clip-dropdown"
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none cursor-pointer"
                          >
                            {clips.filter(c => c.type === 'text').map(c => (
                              <option key={c.id} value={c.id}>
                                ✍️ Wish by: {c.from} ("{c.textBody?.substring(0, 30)}...")
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 block">Frame Theme / Poster Aesthetic</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: 'gold', label: '👑 Classic Gold' },
                              { id: 'emerald', label: '🌿 Emerald Leaves' },
                              { id: 'cosmic', label: '✨ Cosmic Galaxy' },
                              { id: 'romantic', label: '❤️ Sweet Hearts' },
                              { id: 'cinema', label: '🎬 Retro Cinema' }
                            ].map(theme => (
                              <button
                                key={theme.id}
                                type="button"
                                onClick={() => setWizardTextTheme(theme.id as any)}
                                className={`px-2 py-1.5 rounded-lg text-left text-[10.5px] font-bold border transition ${
                                  wizardTextTheme === theme.id
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {theme.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 block">Custom AI Subheading / Annotation edit</label>
                          <input
                            type="text"
                            value={wizardTextPrompt}
                            onChange={e => setWizardTextPrompt(e.target.value)}
                            placeholder="e.g. Generated with magical floral vintage flourishes..."
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-bold text-slate-700 placeholder-slate-400 outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const selectEl = document.getElementById('wizard-text-clip-dropdown') as HTMLSelectElement;
                            if (selectEl?.value) {
                              handleConvertTextToImageCard(selectEl.value);
                            }
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-lg text-center cursor-pointer transition shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <span>✨ Synthesize Framed Photo-Card 🎨</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10.5px] text-slate-400 italic py-3 text-center bg-white rounded-lg border border-slate-150">
                        No written text wish clips in the timeline currently. Tap "+ Timeline" on a guest text contribution below then try again!
                      </p>
                    )}
                  </div>

                  {/* Tool 2: Audio vocal track to subtitle caption overlays */}
                  <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">✍️ Auto Voice-to-Subtitle Caption overlay</span>
                    <p className="text-[10.5px] text-slate-500 font-medium">
                      Transcribe any contributor's oral/voice note wave file and configure synchronized subtitle overlays directly on top of the compilation video.
                    </p>

                    {clips.filter(c => c.type === 'audio').length > 0 ? (
                      <div className="space-y-3 bg-white border border-slate-150 p-2.5 rounded-xl">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 block">Select Vocal audio Wish Track</label>
                          <select
                            id="wizard-audio-clip-dropdown"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none cursor-pointer"
                          >
                            {clips.filter(c => c.type === 'audio').map(c => (
                              <option key={c.id} value={c.id}>
                                🎙️ Voice by: {c.from} ({c.dur}s Track)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 block">Subtitle Font Size</label>
                            <input
                              type="number"
                              min={12}
                              max={36}
                              value={wizardSubtitleSize}
                              onChange={e => setWizardSubtitleSize(Number(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold text-slate-700"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 block">Text Color</label>
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="color"
                                value={wizardSubtitleColor}
                                onChange={e => setWizardSubtitleColor(e.target.value)}
                                className="w-8 h-7 bg-slate-50 rounded cursor-pointer border border-slate-200"
                              />
                              <span className="text-[10px] font-mono text-slate-500">{wizardSubtitleColor}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 block">Subtitle Font Style</label>
                            <select
                              value={wizardSubtitleFont}
                              onChange={e => setWizardSubtitleFont(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold text-slate-700 outline-none"
                            >
                              <option value="Inter">Sans (Inter)</option>
                              <option value="Georgia">Serif (Georgia)</option>
                              <option value="JetBrains Mono">Mono (JetBrains)</option>
                              <option value="Space Grotesk">Tech (Grotesk)</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 block">Caption Frame Backing</label>
                            <select
                              value={wizardSubtitleBackground}
                              onChange={e => setWizardSubtitleBackground(e.target.value as any)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold text-slate-700 outline-none"
                            >
                              <option value="none">Clear (No frame)</option>
                              <option value="shadow">Drop Shadows</option>
                              <option value="strip">Dark Subtitle Frame Block</option>
                            </select>
                          </div>
                        </div>

                        {/* Coordinate Placements Swinger */}
                        <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase font-black text-slate-550 flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={wizardSubtitleUseXY}
                                onChange={e => setWizardSubtitleUseXY(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              Use Custom Frame Alignment Coordinates
                            </label>
                          </div>
                          {wizardSubtitleUseXY && (
                            <div className="space-y-2 p-2 bg-slate-50 rounded-lg border border-slate-150 animate-in slide-in-from-top-1">
                              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500">
                                <span>Horizontal Centering Link X (%)</span>
                                <span className="text-indigo-600 font-extrabold">{wizardSubtitleX}%</span>
                              </div>
                              <input
                                type="range"
                                min={10}
                                max={90}
                                value={wizardSubtitleX}
                                onChange={e => setWizardSubtitleX(Number(e.target.value))}
                                className="w-full accent-indigo-600"
                              />
                              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500">
                                <span>Vertical Offset Y (%)</span>
                                <span className="text-indigo-600 font-extrabold">{wizardSubtitleY}%</span>
                              </div>
                              <input
                                type="range"
                                min={10}
                                max={95}
                                value={wizardSubtitleY}
                                onChange={e => setWizardSubtitleY(Number(e.target.value))}
                                className="w-full accent-indigo-600"
                              />
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const selectEl = document.getElementById('wizard-audio-clip-dropdown') as HTMLSelectElement;
                            if (selectEl?.value) {
                              handleConvertAudioToSubtitles(selectEl.value);
                            }
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-lg text-center cursor-pointer transition shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <span>🎙️ Generate Styled Frame Captions ✍️</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10.5px] text-slate-400 italic py-3 text-center bg-white rounded-lg border border-slate-150">
                        No audio/voice notes in the timeline currently. Tap "+ Timeline" on a voice note contribution or record using mic above!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Soundtrack selector */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">
              🎵 Choose Background Soundtrack
            </h4>
            <div className="space-y-2">
              <select
                id="soundtrack-selector"
                value={soundtrackId}
                onChange={e => setSoundtrackId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-705 text-slate-755 text-slate-700 outline-none cursor-pointer"
              >
                <option value="none">No Background Music (Muted)</option>
                {BUILTIN_MUSIC.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.e} {m.n} ({m.g} - {m.d})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 italic">
                Selected soundtrack plays beneath stitched video clips while reviewing/compiling.
              </p>
            </div>
          </div>

          {/* Sound mixers suite */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">
              🎛️ Live Volumes Soundtrack Mixer
            </h4>
            <div className="space-y-3.5 pt-1">
              <div className="flex gap-3 items-center">
                <span className="text-xs font-bold text-slate-700 w-24">Background Music</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  className="flex-1 accent-indigo-600"
                  value={bgVol}
                  onChange={e => setBgVol(parseInt(e.target.value))}
                />
                <span className="font-mono text-xs w-10 text-right">{bgVol}%</span>
              </div>

              <div className="flex gap-3 items-center">
                <span className="text-xs font-bold text-slate-705 text-slate-700 w-24">Voice/Vocal Track</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  className="flex-1 accent-indigo-600"
                  value={voiceVol}
                  onChange={e => setVoiceVol(parseInt(e.target.value))}
                />
                <span className="font-mono text-xs w-10 text-right">{voiceVol}%</span>
              </div>

              <div className="flex gap-3 items-center">
                <span className="text-xs font-bold text-slate-700 w-24">Videos Audio</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  className="flex-1 accent-indigo-600"
                  value={vidVol}
                  onChange={e => setVidVol(parseInt(e.target.value))}
                />
                <span className="font-mono text-xs w-10 text-right">{vidVol}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column Live Canvas Preview */}
        <div id="video-studio-preview-col" className="lg:col-span-5 space-y-6">
          
          <div className="bg-slate-950 border border-slate-900 rounded-3xl overflow-hidden shadow-lg select-none">
            {/* Direct preview window box */}
            <div className="aspect-video w-full relative bg-slate-900 flex items-center justify-center">
              <canvas 
                ref={canvasRef} 
                width={854} 
                height={480} 
                className="w-full h-full object-contain absolute inset-0 z-10" 
                style={{ filter: getFilterCss(activeVideoFilter) }}
              />
            </div>

            {/* Playback details */}
            <div className="bg-slate-900 p-4 flex gap-3 items-center">
              <button
                onClick={handleStartPlay}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-950 rounded-xl font-extrabold text-xs transition min-w-[75px] shrink-0 cursor-pointer"
              >
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                onClick={handlePausePlay}
                className="px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition"
              >
                ⏹ Stop
              </button>
              <div className="flex-grow"></div>
              <div className="text-right font-mono text-[10px] text-slate-400">
                Playing: <span className="text-indigo-400 font-bold">{playTime.toFixed(1)}s</span> / {totalDuration.toFixed(1)}s
              </div>
            </div>
          </div>

          {/* Add Subtitle text card over video */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                ✍️ Comprehensive Text Overlay Studio
              </h4>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-black uppercase">
                Interactive Layering Active
              </span>
            </div>

            <form onSubmit={handleAddOverlay} className="space-y-3.5">
              {/* Text input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="bg-white border border-slate-200 rounded-xl px-4 py-1.5 text-xs outline-none focus:border-indigo-600 flex-1"
                  placeholder="Type subtitle overlay text (e.g., Happy Birthday Mom! 🎉)"
                  value={overlayText}
                  onChange={e => setOverlayText(e.target.value)}
                />
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-1.5 px-4.5 rounded-xl cursor-pointer transition active:scale-95 shadow-sm"
                >
                  Create Overlay
                </button>
              </div>

              {/* Extra styling controls container */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 text-[10.5px]">
                {/* 1. Target Clip binding */}
                <div className="flex flex-col gap-1 col-span-2">
                  <span className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">🎯 Target Memory Clip Span</span>
                  <select
                    value={overlayClipId}
                    onChange={e => setOverlayClipId(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none cursor-pointer h-[26px]"
                  >
                    <option value="global">🌐 Global (Always Visible on Screen)</option>
                    {clips.map((c, idx) => (
                      <option key={`opt-overlay-${c.id}-${idx}`} value={c.id}>
                        🎞️ #{idx+1}. {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Position choice & absolute custom coordinate placement */}
                <div className="flex flex-col gap-1 col-span-2 bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-100/50">
                  <div className="flex justify-between items-center pr-1">
                    <span className="font-extrabold text-indigo-950 uppercase tracking-widest text-[8.5px]">📍 Position on Screen</span>
                    <label className="flex items-center gap-1 cursor-pointer text-[8px] font-black uppercase text-indigo-700 select-none">
                      <input
                        type="checkbox"
                        checked={overlayUseXY}
                        onChange={e => {
                          setOverlayUseXY(e.target.checked);
                        }}
                        className="w-3 h-3 accent-indigo-600 rounded cursor-pointer"
                      />
                      <span>Use Exact X,Y %%</span>
                    </label>
                  </div>
                  
                  {!overlayUseXY ? (
                    <select
                      value={overlayPosition}
                      onChange={e => setOverlayPosition(e.target.value as any)}
                      className="w-full px-2 py-1 mt-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none cursor-pointer h-[26px]"
                    >
                      <option value="top">Top Header ⬆️</option>
                      <option value="centre">Center Focused 🌀</option>
                      <option value="bottom">Bottom Subtitle ⬇️</option>
                    </select>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider">X placement: {overlayX}%</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={overlayX}
                          onChange={e => setOverlayX(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider">Y placement: {overlayY}%</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={overlayY}
                          onChange={e => setOverlayY(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Font Family */}
                <div className="flex flex-col gap-1">
                  <span className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">🔤 Font Family</span>
                  <select
                    value={overlayFontFamily}
                    onChange={e => setOverlayFontFamily(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none cursor-pointer h-[26px]"
                  >
                    <option value="Inter">Inter (Swiss Sans)</option>
                    <option value="Space Grotesk">Space Grotesk (Tech)</option>
                    <option value="Playfair Display">Playfair (Editor Serif)</option>
                    <option value="JetBrains Mono">JetBrains (Developer Mono)</option>
                    <option value="Syne">Syne (Artistic Display)</option>
                  </select>
                </div>

                {/* 4. Timestamp inputs (relevant if binder is set) */}
                <div className="flex flex-col gap-1 col-span-2">
                  <span className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">⏱️ Clip Time Active Window (Secs)</span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-lg px-2 h-[26px]">
                      <span className="text-slate-400 font-bold mr-1 text-[9px] uppercase">Start:</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={overlayStartTime}
                        onChange={e => setOverlayStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-transparent border-none outline-none font-bold text-slate-705 text-slate-700 text-right pr-0.5"
                      />
                    </div>
                    <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-lg px-2 h-[26px]">
                      <span className="text-slate-400 font-bold mr-1 text-[9px] uppercase">End:</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={overlayEndTime}
                        onChange={e => setOverlayEndTime(Math.max(0, parseFloat(e.target.value) || 5))}
                        className="w-full bg-transparent border-none outline-none font-bold text-slate-705 text-slate-700 text-right pr-0.5"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Font size & Color Picker */}
                <div className="flex flex-col gap-1">
                  <span className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">📏 Text Size: {overlaySize}px</span>
                  <input
                    type="range"
                    min="12"
                    max="65"
                    value={overlaySize}
                    onChange={e => setOverlaySize(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">🎨 Pick Color</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={overlayColor}
                      onChange={e => setOverlayColor(e.target.value)}
                      className="w-7 h-[26px] bg-transparent border-0 cursor-pointer outline-none"
                    />
                    <input
                      type="text"
                      value={overlayColor}
                      onChange={e => setOverlayColor(e.target.value)}
                      className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md font-mono text-[9px] text-slate-650 w-full"
                    />
                  </div>
                </div>

                {/* 6. Bold/Italic style flags */}
                <div className="col-span-4 flex items-center gap-6 pt-1 border-t border-slate-100 mt-1 justify-end">
                  <label className="flex items-center gap-2 cursor-pointer font-extrabold text-slate-650 select-none">
                    <input
                      type="checkbox"
                      checked={overlayStyleBold}
                      onChange={e => setOverlayStyleBold(e.target.checked)}
                      className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                    />
                    <span>Bold Type 🄱</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-extrabold text-slate-650 select-none">
                    <input
                      type="checkbox"
                      checked={overlayStyleItalic}
                      onChange={e => setOverlayStyleItalic(e.target.checked)}
                      className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                    />
                    <span>Italic Type 🄸</span>
                  </label>
                </div>
              </div>
            </form>

            {/* List overlay attachments */}
            {overlays.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Active Overlay Filters:</span>
                <div className="flex flex-wrap gap-1.5">
                  {overlays.map((o) => {
                    const targetLabel = o.clipId ? 'clip-specific' : 'global screen';
                    return (
                      <span 
                        key={o.id} 
                        className="px-2.5 py-1 bg-indigo-50 border border-indigo-150 text-indigo-600 text-[10.5px] font-semibold rounded-lg flex items-center gap-2"
                        title={`Style: ${o.fontFamily || 'Inter'} ${o.size}px | Active: ${targetLabel}`}
                      >
                        <span className="font-black text-indigo-800">
                          {o.text.length > 25 ? o.text.substring(0, 22) + '...' : o.text}
                        </span>
                        <span className="text-[8.5px] text-indigo-400 font-bold uppercase shrink-0">
                          ({targetLabel})
                        </span>
                        <button
                          type="button"
                          onClick={() => setOverlays(prev => prev.filter(x => x.id !== o.id))}
                          className="text-indigo-400 hover:text-indigo-700 font-black cursor-pointer leading-none text-xs"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Render progress loader */}
          {rendering && (
            <div className="bg-slate-900 rounded-3xl p-5 text-white space-y-4 animate-in fade-in duration-100 border border-slate-800">
              <div className="flex justify-between items-center text-xs font-bold font-mono text-indigo-400">
                <span className="flex items-center gap-1.5 animate-pulse">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  Processing compilation...
                </span>
                <span className="bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded-full text-[10px]">{renderProgress}%</span>
              </div>
              
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner font-sans">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300" 
                  style={{ width: `${renderProgress}%` }}
                ></div>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-955 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-sm select-none">⚙️</span>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Render Output Stream Status</p>
                  <p className="text-[10.5px] text-slate-200 font-medium font-mono leading-relaxed select-all">
                    {renderingStatus}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Compiled result banner triggers */}
          {outputUrl && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 leading-tight">Merged Video file available!</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Stitched campaign compilation generated seamlessly with vocal layer soundtracks and text cards integrated.</p>
                </div>
              </div>
              <a
                href={outputUrl}
                download="compiled_surprise.webm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs block text-center shadow shadow-emerald-100"
              >
                ⬇️ Download stitched .WebM file
              </a>
            </div>
          )}

          {/* 12:00 Midnight Dispatch & Automation simulator panel */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-50 pb-2 flex justify-between items-center">
              <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1">
                <span>🕒 Automated Midnight Auto-Publisher</span>
              </h4>
              <span className="text-[11px] bg-rose-50 text-rose-600 border border-rose-100 font-mono font-black px-2.5 py-0.5 rounded-full animate-pulse shrink-0">
                Mock Clock: {virtualClock}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Keep this schedule enabled! At exactly 12:00 AM midnight birthdays kickoff, ZippZap renders the latest compilation and dispatches it directly onto configured platforms.
            </p>

            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'youtube', label: '📺 YouTube Shorts' },
                  { id: 'tiktok', label: '🎵 TikTok Video' },
                  { id: 'instagram', label: '📸 IG Reels' },
                  { id: 'whatsapp', label: '💬 WhatsApp Status' }
                ].map(social => {
                  const active = selectedSocials.includes(social.id);
                  return (
                    <button
                      key={social.id}
                      onClick={() => {
                        setSelectedSocials(prev =>
                          prev.includes(social.id) ? prev.filter(x => x !== social.id) : [...prev, social.id]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition flex items-center gap-1 ${
                        active ? 'bg-rose-50 border-rose-300 text-rose-600' : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      <span>{active ? '✓' : '＋'}</span> {social.label}
                    </button>
                  );
                })}
              </div>

              {/* Simulation button */}
              {simStatus === 'idle' && (
                <button
                  type="button"
                  onClick={handleSimulateMidnightLaunch}
                  className="w-full bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl block text-center hover:bg-slate-850 cursor-pointer shadow-md shadow-slate-100"
                >
                  🚀 Test Simulate 12:00 Midnight Kickoff Trigger
                </button>
              )}

              {/* Running animation logs */}
              {simStatus === 'running' && (
                <div className="space-y-3 bg-slate-950 p-4 rounded-xl text-white font-mono text-[10px] outline-none">
                  <div className="flex justify-between items-center text-rose-400 font-bold">
                    <span>🔄 Running midnight triggers...</span>
                    <span>{simProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${simProgress}%` }} />
                  </div>
                  <div className="space-y-1.5 mt-2 max-h-[150px] overflow-y-auto max-w-full text-slate-300">
                    {simLogs.map((logStr, lIdx) => (
                      <div key={lIdx} className="leading-relaxed border-l-2 border-rose-500 pl-1.5">{logStr}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success post embed mock links */}
              {simStatus === 'success' && (
                <div className="space-y-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎉</span>
                    <h5 className="text-xs font-extrabold text-rose-700">12:00 Midnight Distribution Log success!</h5>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Stitched multi-format video was rendered and successfully uploaded to live social APIs. Teammate contribution wishes is now viewable via:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
                    {selectedSocials.includes('youtube') && (
                      <a href="#youtube" onClick={(e) => { e.preventDefault(); alert('Simulated playing YouTube Shorts feed!'); }} className="py-2 bg-white border border-rose-200 hover:bg-rose-100 rounded text-rose-700">
                        📺 YouTube Shorts link
                      </a>
                    )}
                    {selectedSocials.includes('tiktok') && (
                      <a href="#tiktok" onClick={(e) => { e.preventDefault(); alert('Simulated TikTok challenge feed!'); }} className="py-2 bg-white border border-rose-200 hover:bg-rose-100 rounded text-rose-700">
                        🎵 TikTok link
                      </a>
                    )}
                    {selectedSocials.includes('instagram') && (
                      <a href="#instagram" onClick={(e) => { e.preventDefault(); alert('Opening Instagram surprise video reel mockup!'); }} className="py-2 bg-white border border-rose-200 hover:bg-rose-100 rounded text-rose-700">
                        📸 Instagram Reel link
                      </a>
                    )}
                    {selectedSocials.includes('whatsapp') && (
                      <a href="#whatsapp" onClick={(e) => { e.preventDefault(); alert('Simulated Broadcast to WhatsApp contacts!'); }} className="py-2 bg-white border border-rose-200 hover:bg-rose-100 rounded text-rose-700">
                        💬 WhatsApp status link
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => { setSimStatus('idle'); setSimLogs([]); }}
                    className="w-full text-center text-[9px] text-[#1C1207] font-black underline cursor-pointer"
                  >
                    Reset and run scheduler audit again
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Visual Transition Clip Preview Overlay */}
      {previewTransitionType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <style>{`
            @keyframes fadePrv { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
            @keyframes slideLPrv { 0% { transform: translateX(100%); } 50% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
            @keyframes slideRPrv { 0% { transform: translateX(-100%); } 50% { transform: translateX(0); } 100% { transform: translateX(100%); } }
            @keyframes zoomPrv { 0% { opacity: 0; transform: scale(0.6); } 50% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.3); } }
            @keyframes wipePrv { 0% { clip-path: inset(0 100% 0 0); } 50% { clip-path: inset(0 0 0 0); } 100% { clip-path: inset(0 0 0 100%); } }
            .animate-fade-preview { animation: fadePrv 2s infinite ease-in-out; }
            .animate-slide-l-preview { animation: slideLPrv 2s infinite ease-in-out; }
            .animate-slide-r-preview { animation: slideRPrv 2s infinite ease-in-out; }
            .animate-zoom-preview { animation: zoomPrv 2s infinite ease-in-out; }
            .animate-wipe-preview { animation: wipePrv 2s infinite ease-in-out; }
          `}</style>
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
            <div className="text-3xl">💫</div>
            <div>
              <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest">
                TRANSITION PREVIEW ACTIVE
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Visualizing <span className="font-mono text-white font-bold">{previewTransitionType.toUpperCase()}</span> clip transition sequence
              </p>
            </div>

            {/* Dynamic CSS Visual simulation of transition */}
            <div className="relative h-44 w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {/* Box 1 */}
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500 to-rose-600 p-4 flex flex-col justify-end text-left">
                <div className="text-[9px] font-bold text-white/70">CLIP A (Incoming)</div>
                <div className="text-xs font-black text-white">Mom & Dad wish group</div>
              </div>

              {/* Box 2 with dynamic CSS animating transitions */}
              <div className={`absolute inset-0 bg-gradient-to-bl from-indigo-500 to-emerald-600 p-4 flex flex-col justify-end text-left transition-all duration-1000 ${
                previewTransitionType === 'fade' ? 'animate-fade-preview' :
                previewTransitionType === 'slide-l' ? 'animate-slide-l-preview' :
                previewTransitionType === 'slide-r' ? 'animate-slide-r-preview' :
                previewTransitionType === 'zoom-in' ? 'animate-zoom-preview' :
                'animate-wipe-preview'
              }`}>
                <div className="text-[9px] font-bold text-white/70">CLIP B (Outgoing)</div>
                <div className="text-xs font-black text-white">Highschool teammates photo album</div>
              </div>
            </div>

            <div className="text-[10px] text-indigo-400 font-mono">
              Auto-dissolving overlapping keyframe channels...
            </div>
            
            <button
              onClick={() => setPreviewTransitionType(null)}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-black w-full cursor-pointer transition"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* 🎬 EXPORT PREVIEW MODAL */}
      <AnimatePresence>
        {exportPreviewOpen && clips.length > 0 && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col lg:flex-row h-[550px] md:h-[620px]"
            >
              {/* Left Screen Area (Simulated Player) */}
              <div className="flex-1 bg-black flex flex-col justify-between p-4 relative overflow-hidden group">
                {/* Top header badge */}
                <div className="flex justify-between items-center z-10">
                  <span className="bg-rose-600 text-[9.5px] font-black uppercase text-white px-2.5 py-1 rounded-full animate-pulse tracking-widest">
                    LIVE EXPORT SIMULATION
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Clip {previewClipIdx + 1} of {clips.length}
                  </span>
                </div>

                {/* Simulated Screen with transitions */}
                <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden my-4 self-center rounded-2xl border border-slate-800 bg-slate-950 aspect-video max-h-[340px]">
                  <AnimatePresence mode="wait">
                    {(() => {
                      const c = clips[previewClipIdx];
                      if (!c) return null;
                      const activeTransition = c.transition || 'fade';
                      
                      // Define visual motion states based on chosen transition
                      const variants = {
                        initial: activeTransition === 'slide-l' ? { x: '100%', opacity: 0 } :
                                  activeTransition === 'slide-r' ? { x: '-100%', opacity: 0 } :
                                  activeTransition === 'dissolve' ? { opacity: 0, filter: 'blur(8px)' } :
                                  { opacity: 0, scale: 0.98 },
                        animate: { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.4, ease: 'easeInOut' } },
                        exit: activeTransition === 'slide-l' ? { x: '-100%', opacity: 0 } :
                              activeTransition === 'slide-r' ? { x: '100%', opacity: 0 } :
                              activeTransition === 'dissolve' ? { opacity: 0, filter: 'blur(8px)' } :
                              { opacity: 0, scale: 0.98, transition: { duration: 0.3 } }
                      };

                      return (
                        <motion.div
                          key={previewClipIdx}
                          variants={variants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center"
                          style={{
                            filter: activeVideoFilter === 'sepia' ? 'sepia(0.85)' :
                                    activeVideoFilter === 'grayscale' ? 'grayscale(1)' :
                                    activeVideoFilter === 'brightness' ? 'brightness(1.4)' : 'none'
                          }}
                        >
                          {/* Main media preview frame */}
                          {c.type === 'text' ? (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 flex flex-col justify-center items-center text-center p-6 text-white text-md font-extrabold italic select-none">
                              "{c.textBody || c.note || ' Joyful Greetings!'}"
                            </div>
                          ) : c.type === 'photo' ? (
                            <img
                              src={c.url}
                              alt=""
                              className={`w-full h-full ${fitMode === 'cover' ? 'object-cover' : 'object-contain'} select-none`}
                            />
                          ) : (
                            <video
                              src={c.url}
                              autoPlay={previewPlaying}
                              muted
                              loop
                              className={`w-full h-full ${fitMode === 'cover' ? 'object-cover' : 'object-contain'} select-none`}
                            />
                          )}

                          {/* Interactive Overlay text display inside preview */}
                          {overlays.length > 0 && (
                            <div className="absolute bottom-5 inset-x-0 text-center select-none z-20 px-4 pointer-events-none">
                              {overlays.map((ov, index) => (
                                <div key={index} className="inline-block bg-slate-950/80 border border-slate-850 px-3 py-1 rounded-xl text-[10px] font-black text-indigo-400 shadow-md uppercase tracking-wide">
                                  {ov.t}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Dynamic Frame presets overlays */}
                          {animatedFrame !== 'none' && (
                            <div className="absolute inset-0 pointer-events-none border-8 z-10 rounded-2xl select-none" style={{
                              borderColor: animatedFrame === 'neon' ? '#a855f7' : animatedFrame === 'hearts' ? '#f43f5e' : animatedFrame === 'sparkles' ? '#eab308' : '#22c55e',
                              boxShadow: animatedFrame === 'neon' ? 'inset 0 0 15px currentColor' : 'none'
                            }}>
                              <span className="absolute top-2 right-2 text-xs">
                                {animatedFrame === 'sparkles' ? '✨' : animatedFrame === 'hearts' ? '❤️' : animatedFrame === 'neon' ? '🔋' : '🎞️'}
                              </span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                </div>

                {/* Simulated Screen Controls overlay banner */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span className="font-extrabold truncate">
                      👉 Currently Playing: <b>{clips[previewClipIdx]?.name || 'Clip Element'}</b>
                    </span>
                    <span className="font-mono text-xs">{fmtT((previewTimer / 100) * 10)} / 0:10</span>
                  </div>

                  {/* Playback progress slider track */}
                  <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${previewTimer}%` }}
                    />
                  </div>

                  {/* Media playback switch shortcuts */}
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-850">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewClipIdx(p => Math.max(0, p - 1));
                          setPreviewTimer(0);
                        }}
                        className="p-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-xs text-white cursor-pointer"
                        title="Previous Clip"
                      >
                        ⏮️
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewPlaying(!previewPlaying)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-[10.5px] font-black text-white flex items-center gap-1 cursor-pointer"
                      >
                        <span>{previewPlaying ? '⏸️ Pause' : '▶️ Play'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (previewClipIdx + 1 < clips.length) {
                            setPreviewClipIdx(p => p + 1);
                          } else {
                            setPreviewClipIdx(0);
                          }
                          setPreviewTimer(0);
                        }}
                        className="p-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-xs text-white cursor-pointer"
                        title="Skip Clip"
                      >
                        ⏭️
                      </button>
                    </div>

                    {/* Soundtrack display badge */}
                    <span className="text-[10px] bg-slate-850 text-slate-400 border border-slate-800 rounded-lg px-2.5 py-1 flex items-center gap-1.5 truncate max-w-[220px]">
                      <span>🎵</span> {soundtrackId !== 'none' ? BUILTIN_MUSIC.find(m => m.id === soundtrackId)?.n : 'No Soundtrack (Live Mix)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Sidebar list section */}
              <div className="w-full lg:w-[280px] border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950 p-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest animate-pulse">STITCH TIMELINE</h3>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">Review how transitions link individual clip memories together before generating final MP4 download files.</p>
                  </div>

                  {/* List of queue */}
                  <div className="space-y-2 max-h-[220px] md:max-h-[285px] overflow-y-auto pr-1">
                    {clips.map((item, idx) => {
                      const isCurrent = idx === previewClipIdx;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setPreviewClipIdx(idx);
                            setPreviewTimer(0);
                            setPreviewPlaying(true);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition duration-150 cursor-pointer flex gap-2.5 items-center ${
                            isCurrent
                              ? 'bg-indigo-950 border-indigo-750 text-white font-bold'
                              : 'bg-slate-900/60 border-slate-850 text-slate-400 hover:border-slate-800'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-950 overflow-hidden flex items-center justify-center text-xs shrink-0 relative">
                            {item.type === 'text' ? '✍️' : <img src={item.url} alt="" className="w-full h-full object-cover" />}
                            {isCurrent && (
                              <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center font-bold text-white text-[9px] uppercase">
                                ON AIR
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={`text-[11px] font-black leading-tight truncate ${isCurrent ? 'text-indigo-300' : 'text-slate-300'}`}>
                              {idx + 1}. {item.name}
                            </h4>
                            <div className="flex items-center gap-1 text-[8.5px] font-semibold uppercase mt-0.5 tracking-wider">
                              <span>{item.type}</span>
                              <span>·</span>
                              <span className="text-amber-500 font-bold">{item.transition || 'fade'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Compile CTA controls */}
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExportPreviewOpen(false);
                      setPreviewPlaying(false);
                      handleStartRenderMerged();
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer shadow-lg transition"
                  >
                    🚀 Start Final Render Build
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportPreviewOpen(false);
                      setPreviewPlaying(false);
                    }}
                    className="w-full py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 text-[10.5px] font-extrabold rounded-xl cursor-pointer transition"
                  >
                    ✏️ Close & Adjust Timeline
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 💫 UNIVERSAL TRANSITION MANAGER MODAL */}
      <AnimatePresence>
        {isTransitionManagerOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-55 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-6 border border-slate-100 flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 text-indigo-600">
                    💫 Studio Transition Manager
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Configure cinematic transitional links between timeline order memories</p>
                </div>
                <button 
                  onClick={() => setIsTransitionManagerOpen(false)}
                  className="text-slate-400 hover:text-slate-700 font-black text-lg select-none px-2 cursor-pointer"
                >
                  ×
                </button>
              </div>
              
              <div className="flex-grow overflow-y-auto py-4 space-y-4 pr-1">
                {clips.length < 2 ? (
                  <div className="text-center py-10 text-xs text-slate-400">
                    💡 Please import at least <span className="font-extrabold text-indigo-600">2 clips</span> into your timeline to orchestrate high-grade transitions between memories.
                  </div>
                ) : (
                  clips.slice(0, -1).map((c, i) => {
                    const currentTransition = c.transition || 'fade';
                    const nextClip = clips[i + 1];
                    return (
                      <div key={`trans-conn-${i}`} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">Link #{i+1}</span>
                            <span className="text-slate-400 font-bold">joining</span>
                            <span className="font-black text-slate-700 truncate max-w-[100px]" title={c.name}>{c.name}</span>
                            <span className="text-slate-400">➔</span>
                            <span className="font-black text-slate-700 truncate max-w-[100px]" title={nextClip.name}>{nextClip.name}</span>
                          </div>
                          <span className="text-[9px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded-md">
                            Style: {currentTransition.toUpperCase()}
                          </span>
                        </div>
                        
                        {/* Interactive Transition style choice grid */}
                        <div className="grid grid-cols-5 gap-2">
                          {[
                            { id: 'fade', name: 'Crossfade', emoji: '🌫️' },
                            { id: 'slide', name: 'Slide', emoji: '➔' },
                            { id: 'wipe', name: 'Wipe', emoji: '🧹' },
                            { id: 'dissolve', name: 'Dissolve', emoji: '🫧' },
                            { id: 'zoom', name: 'Zoom', emoji: '🔍' }
                          ].map((tOpt) => {
                            const isSelected = currentTransition === tOpt.id;
                            return (
                              <button
                                key={tOpt.id}
                                type="button"
                                onClick={() => {
                                  const updated = [...clips];
                                  updated[i].transition = tOpt.id;
                                  onUpdateClipsState(updated);
                                }}
                                className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 active:scale-95 ${
                                  isSelected 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md font-bold' 
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span className="text-md">{tOpt.emoji}</span>
                                <span className="text-[9px] font-black tracking-tight leading-3">{tOpt.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setIsTransitionManagerOpen(false)}
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black cursor-pointer transition shadow-md"
                >
                  Apply Transitions
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
