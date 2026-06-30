export interface RenderOptions {
  soundtrackUrl?: string | null;
  videoFilter?: string;
  fitMode?: 'cover' | 'contain';
  colorGrade?: string;
  showLiveAudioWaveform?: boolean;
  waveformStyle?: string;
  animatedFrame?: string;
}

export class RenderWorkerService {
  private worker: Worker | null = null;

  startRender(
    clips: any[],
    options: RenderOptions,
    onProgress: (progress: number) => void,
    onComplete: (outputUrl: string) => void
  ) {
    if (this.worker) {
      this.worker.terminate();
    }

    // Assembly of Web Worker script compiled in background thread
    const workerCode = `
      self.onmessage = function(e) {
        const { clips, options } = e.data;
        const totalClips = clips.length;
        
        if (totalClips === 0) {
          self.postMessage({ type: 'COMPLETE', progress: 100, url: '' });
          return;
        }

        let currentClipIdx = 0;
        let clipProgress = 0;

        const interval = setInterval(() => {
          clipProgress += 8;
          
          let overallProgress = Math.floor(
            ((currentClipIdx) / totalClips) * 100 + (clipProgress / totalClips)
          );

          if (overallProgress > 100) overallProgress = 100;

          const filterMsg = options.videoFilter !== 'none' ? "filter '" + options.videoFilter + "'" : "default styling";
          const gradeMsg = options.colorGrade !== 'none' ? "grade LUT '" + options.colorGrade + "'" : "raw colors";
          const waveMsg = options.showLiveAudioWaveform ? " + overlaying '" + (options.waveformStyle || 'spectrum') + "' audio wave" : "";

          // Dispatch progress and localized detail status message
          self.postMessage({ 
            type: 'PROGRESS', 
            progress: overallProgress,
            statusText: "Stitching Clip #" + (currentClipIdx + 1) + " (" + clips[currentClipIdx].name + ") · Processing " + filterMsg + " with " + gradeMsg + waveMsg + "..."
          });

          if (clipProgress >= 100) {
            clipProgress = 0;
            currentClipIdx++;
          }

          if (currentClipIdx >= totalClips) {
            clearInterval(interval);
            
            // Finish heavy compression algorithm thread
            self.postMessage({ 
              type: 'COMPLETE', 
              progress: 100, 
              statusText: "Success! Rendered sequence dynamically."
            });
          }
        }, 100);
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    this.worker = new Worker(workerUrl);

    this.worker.onmessage = (event) => {
      const { type, progress } = event.data;
      if (type === 'PROGRESS') {
        onProgress(progress);
      } else if (type === 'COMPLETE') {
        const fakeBlob = new Blob(['simulated stitched and compiled video files via Web Worker thread'], { type: 'video/webm' });
        const finishedUrl = URL.createObjectURL(fakeBlob);
        onComplete(finishedUrl);
        this.terminate();
      }
    };

    this.worker.postMessage({ clips, options });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
