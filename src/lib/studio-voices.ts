export interface StudioVoicePersona {
  id: "Kore" | "Charon" | "Puck" | "Zephyr" | "Fenrir" | "Orus";
  shortName: string;
  label: string;
  roleBadge: string;
  description: string;
  lang: string;
  gender: "female" | "male";
  pitch: number;
  rate: number;
}

export const STUDIO_VOICE_LIST: StudioVoicePersona[] = [
  {
    id: "Kore",
    shortName: "👩🏼 Sarah (Kore)",
    label: "Sarah (Kore) — Warm US Female Executive · Upbeat",
    roleBadge: "Warm US Female",
    description: "Warm, upbeat US female executive voice — ideal for local service reception & friendly website walkthroughs.",
    lang: "en-US",
    gender: "female",
    pitch: 1.2,
    rate: 1.04,
  },
  {
    id: "Charon",
    shortName: "🧔🏻‍♂️ Marcus (Charon)",
    label: "Marcus (Charon) — Deep Baritone Male Consultant · Authoritative",
    roleBadge: "Deep Baritone Male",
    description: "Deep, calm baritone male consultant — authoritative for medical, legal, and high-ticket remodeling.",
    lang: "en-US",
    gender: "male",
    pitch: 0.68,
    rate: 0.88,
  },
  {
    id: "Puck",
    shortName: "👨🏻‍💻 Ryan (Puck)",
    label: "Ryan (Puck) — Fast Silicon Valley Male Founder · Energetic",
    roleBadge: "Fast Male Founder",
    description: "Energetic, fast-paced Silicon Valley founder — great for quick conversion audits and growth demos.",
    lang: "en-US",
    gender: "male",
    pitch: 1.05,
    rate: 1.15,
  },
  {
    id: "Zephyr",
    shortName: "🇬🇧 Victoria (Zephyr)",
    label: "Victoria (Zephyr) — Crisp British UK Female Agency Director",
    roleBadge: "British UK Female",
    description: "Polished British UK female agency director — refined, articulate, and executive.",
    lang: "en-GB",
    gender: "female",
    pitch: 1.14,
    rate: 0.98,
  },
  {
    id: "Fenrir",
    shortName: "🦅 Viktor (Fenrir)",
    label: "Viktor (Fenrir) — Bold Wall Street Male Closer · Direct",
    roleBadge: "Bold NY Closer",
    description: "Direct, high-conviction New York closer — built for urgent revenue & missed-call pitches.",
    lang: "en-US",
    gender: "male",
    pitch: 0.78,
    rate: 1.08,
  },
  {
    id: "Orus",
    shortName: "🌍 Tunde (Orus)",
    label: "Tunde (Orus) — Warm Global / Nigerian Male Executive Advisor",
    roleBadge: "Global Executive Male",
    description: "Warm, resonant global & Nigerian English executive advisor — trustworthy, clear, and persuasive.",
    lang: "en-NG",
    gender: "male",
    pitch: 0.85,
    rate: 0.94,
  },
];

export const STUDIO_VOICE_PERSONAS: StudioVoicePersona[] = STUDIO_VOICE_LIST;

export function getStudioVoicePersona(voiceId?: string): StudioVoicePersona {
  return (
    STUDIO_VOICE_LIST.find((v) => v.id === voiceId) || STUDIO_VOICE_LIST[0]
  );
}

// Tiny 10ms silent WAV used to bless HTMLAudioElement during user gestures
const SILENT_UNLOCK_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let sharedAudioCtx: AudioContext | null = null;
let sharedAudioEl: HTMLAudioElement | null = null;
let currentActiveAudio: HTMLAudioElement | null = null;
let currentActiveUtterance: SpeechSynthesisUtterance | null = null;
let pendingAutoplayCleanup: (() => void) | null = null;
let speechCancelTimeoutId: ReturnType<typeof setTimeout> | null = null;

let activeWalkthroughSiteId: string | null = null;
let activeWalkthroughStartedAt = 0;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      try {
        sharedAudioCtx = new AudioCtx();
      } catch {
        sharedAudioCtx = null;
      }
    }
  }
  return sharedAudioCtx;
}

/**
 * Returns a single persistent HTMLAudioElement attached invisibly to document.body.
 * Never overwrites the element on route changes so a user-gesture blessing on any
 * page permanently unlocks playback for the entire session.
 */
function getSharedAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioEl) {
    try {
      sharedAudioEl = new Audio();
      sharedAudioEl.id = "vh-persistent-studio-audio";
      sharedAudioEl.preload = "auto";
      sharedAudioEl.style.display = "none";
      (sharedAudioEl as any).playsInline = true;
      if (typeof document !== "undefined" && document.body) {
        document.body.appendChild(sharedAudioEl);
      }
    } catch {
      sharedAudioEl = null;
    }
  } else if (
    typeof document !== "undefined" &&
    document.body &&
    !sharedAudioEl.parentNode
  ) {
    try {
      document.body.appendChild(sharedAudioEl);
    } catch {}
  }
  return sharedAudioEl;
}

/**
 * Unlocks Web Audio API and HTML5 Audio synchronously inside any user gesture.
 */
export function unlockStudioAudioOnUserGesture(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = getSharedAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  } catch {}

  try {
    const el = getSharedAudioElement();
    if (el && el.paused && !currentActiveAudio) {
      el.src = SILENT_UNLOCK_WAV;
      el.volume = 0.01;
      const p = el.play();
      if (p !== undefined) {
        p.then(() => {
          if (el.src === SILENT_UNLOCK_WAV) {
            el.pause();
            el.currentTime = 0;
            el.volume = 1;
          }
        }).catch(() => {
          el.volume = 1;
        });
      }
    }
  } catch {}

  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }
  } catch {}
}

// Automatically prime audio context on the very first user interaction anywhere in the app
if (typeof window !== "undefined") {
  const globalPrimeEvents = [
    "pointerdown",
    "mousedown",
    "touchstart",
    "touchend",
    "click",
    "keydown",
  ];
  const onGlobalFirstGesture = () => {
    unlockStudioAudioOnUserGesture();
    globalPrimeEvents.forEach((evt) => {
      window.removeEventListener(evt, onGlobalFirstGesture, {
        capture: true,
      } as EventListenerOptions);
    });
  };
  globalPrimeEvents.forEach((evt) => {
    window.addEventListener(evt, onGlobalFirstGesture, {
      passive: true,
      capture: true,
    });
  });
}

function clearPendingAutoplayUnlock(): void {
  if (pendingAutoplayCleanup) {
    try {
      pendingAutoplayCleanup();
    } catch {}
    pendingAutoplayCleanup = null;
  }
}

/**
 * Arms listeners on user-activation events.
 * Does NOT remove listeners until audio or speech genuinely starts playing.
 */
function registerFirstInteractionUnlock(retryFn: () => void): void {
  if (typeof window === "undefined") return;
  clearPendingAutoplayUnlock();

  const activationEvents = [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "touchstart",
    "touchend",
    "click",
    "keydown",
    "wheel",
  ];

  let lastAttemptAt = 0;
  const handler = () => {
    const now = Date.now();
    if (now - lastAttemptAt < 250) return;
    lastAttemptAt = now;

    try {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch {}

    retryFn();
  };

  activationEvents.forEach((evt) => {
    window.addEventListener(evt, handler, { passive: true, capture: true });
  });

  pendingAutoplayCleanup = () => {
    activationEvents.forEach((evt) => {
      window.removeEventListener(evt, handler, {
        capture: true,
      } as EventListenerOptions);
    });
  };
}

/**
 * Stops currently playing audio/speech WITHOUT clearing pendingAutoplayCleanup.
 */
function stopActiveAudioPlaybackOnly(): void {
  if (speechCancelTimeoutId) {
    clearTimeout(speechCancelTimeoutId);
    speechCancelTimeoutId = null;
  }
  if (currentActiveAudio) {
    try {
      currentActiveAudio.onended = null;
      currentActiveAudio.onerror = null;
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
    } catch {}
    currentActiveAudio = null;
  }
  if (currentActiveUtterance) {
    currentActiveUtterance.onstart = null;
    currentActiveUtterance.onend = null;
    currentActiveUtterance.onerror = null;
    currentActiveUtterance = null;
  }
  if (typeof window !== "undefined") {
    (window as any).__vhActiveUtterance = null;
    if ("speechSynthesis" in window) {
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
      } catch {}
    }
  }
}

export function stopAllStudioVoices(): void {
  activeWalkthroughSiteId = null;
  activeWalkthroughStartedAt = 0;
  clearPendingAutoplayUnlock();
  stopActiveAudioPlaybackOnly();
}

export const stopStudioVoice = stopAllStudioVoices;

export function playStudioWavUrl(
  wavDataUrl: string,
  onStart?: () => void,
  onEnd?: () => void,
  fallbackText?: string,
  fallbackVoiceId?: string
): void {
  stopActiveAudioPlaybackOnly();

  let started = false;
  const markStarted = () => {
    if (started) return;
    started = true;
    clearPendingAutoplayUnlock();
    onStart?.();
  };

  const audio = getSharedAudioElement() || new Audio();
  audio.volume = 1;
  audio.muted = false;
  audio.src = wavDataUrl;
  currentActiveAudio = audio;

  audio.onended = () => {
    if (currentActiveAudio === audio) currentActiveAudio = null;
    onEnd?.();
  };
  audio.onerror = () => {
    if (currentActiveAudio === audio) currentActiveAudio = null;
    if (!started && fallbackText) {
      speakBrowserPersonaFallback(
        fallbackText,
        fallbackVoiceId || "Kore",
        onStart,
        onEnd
      );
    } else {
      onEnd?.();
    }
  };

  try {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          markStarted();
        })
        .catch(() => {
          if (currentActiveAudio === audio) currentActiveAudio = null;
          // Arm first-interaction unlock so the very next tap/click/scroll plays the Studio audio
          registerFirstInteractionUnlock(() => {
            playStudioWavUrl(
              wavDataUrl,
              onStart,
              onEnd,
              fallbackText,
              fallbackVoiceId
            );
          });
        });
    } else {
      markStarted();
    }
  } catch {
    registerFirstInteractionUnlock(() => {
      playStudioWavUrl(
        wavDataUrl,
        onStart,
        onEnd,
        fallbackText,
        fallbackVoiceId
      );
    });
  }
}

export function speakBrowserPersonaFallback(
  textToSpeak: string,
  voiceId: string = "Kore",
  onStart?: () => void,
  onEnd?: () => void,
  customUnlockRetry?: () => void
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (customUnlockRetry) {
      registerFirstInteractionUnlock(customUnlockRetry);
    } else {
      onEnd?.();
    }
    return;
  }

  if (currentActiveAudio) {
    try {
      currentActiveAudio.onended = null;
      currentActiveAudio.onerror = null;
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
    } catch {}
    currentActiveAudio = null;
  }

  const retryAction =
    customUnlockRetry ||
    (() => speakBrowserPersonaFallback(textToSpeak, voiceId, onStart, onEnd));

  if (!pendingAutoplayCleanup) {
    registerFirstInteractionUnlock(retryAction);
  }

  const executeSpeak = () => {
    const synth = window.speechSynthesis;
    const wasSpeakingOrPending = synth.speaking || synth.pending;

    const queueUtterance = () => {
      try {
        if (synth.paused) {
          synth.resume();
        }
      } catch {}

      const utter = new SpeechSynthesisUtterance(textToSpeak);
      currentActiveUtterance = utter;
      (window as any).__vhActiveUtterance = utter;

      const voices = synth.getVoices();
      const voiceMeta = getStudioVoicePersona(voiceId);
      const isFemale = voiceMeta.gender === "female";

      const femaleKeywords = [
        "Female",
        "Samantha",
        "Victoria",
        "Karen",
        "Zira",
        "Aria",
        "Jenny",
        "Google UK English Female",
        "Google US English",
        "Moira",
        "Tessa",
      ];
      const maleKeywords = [
        "Male",
        "Daniel",
        "Alex",
        "David",
        "Guy",
        "Christopher",
        "Google UK English Male",
        "Aaron",
        "Fred",
        "Arthur",
      ];
      const targetKeywords = isFemale ? femaleKeywords : maleKeywords;

      const matchedVoice =
        voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith(voiceMeta.lang.toLowerCase()) &&
            targetKeywords.some((kw) =>
              v.name.toLowerCase().includes(kw.toLowerCase())
            )
        ) ||
        voices.find((v) =>
          targetKeywords.some((kw) =>
            v.name.toLowerCase().includes(kw.toLowerCase())
          )
        ) ||
        voices.find((v) =>
          v.lang.toLowerCase().startsWith(voiceMeta.lang.toLowerCase())
        ) ||
        voices[
          Math.max(
            0,
            STUDIO_VOICE_LIST.findIndex((v) => v.id === voiceId)
          ) % Math.max(1, voices.length)
        ];

      if (matchedVoice) utter.voice = matchedVoice;
      utter.lang = matchedVoice?.lang || voiceMeta.lang || "en-US";
      utter.pitch = voiceMeta.pitch;
      utter.rate = voiceMeta.rate;
      utter.volume = 1;

      let didStart = false;
      utter.onstart = () => {
        didStart = true;
        if (!customUnlockRetry) {
          clearPendingAutoplayUnlock();
        }
        onStart?.();
      };
      utter.onend = () => {
        if (currentActiveUtterance === utter) {
          currentActiveUtterance = null;
          (window as any).__vhActiveUtterance = null;
        }
        if (didStart) onEnd?.();
      };
      utter.onerror = () => {
        if (currentActiveUtterance === utter) {
          currentActiveUtterance = null;
          (window as any).__vhActiveUtterance = null;
        }
        if (!didStart) {
          registerFirstInteractionUnlock(retryAction);
        } else {
          onEnd?.();
        }
      };

      try {
        synth.speak(utter);
      } catch {
        registerFirstInteractionUnlock(retryAction);
      }

      setTimeout(() => {
        if (!didStart && !synth.speaking) {
          registerFirstInteractionUnlock(retryAction);
        }
      }, 400);
    };

    if (wasSpeakingOrPending) {
      try {
        synth.cancel();
      } catch {}
      if (speechCancelTimeoutId) clearTimeout(speechCancelTimeoutId);
      speechCancelTimeoutId = setTimeout(queueUtterance, 35);
    } else {
      queueUtterance();
    }
  };

  const initialVoices = window.speechSynthesis.getVoices();
  if (initialVoices.length > 0) {
    executeSpeak();
  } else {
    let fired = false;
    const runOnce = () => {
      if (fired) return;
      fired = true;
      window.speechSynthesis.removeEventListener?.("voiceschanged", runOnce);
      executeSpeak();
    };
    window.speechSynthesis.addEventListener?.("voiceschanged", runOnce);
    setTimeout(runOnce, 120);
  }
}

const clientAudioCache = new Map<string, string>();

export async function speakTextWithStudioPersona(
  textToSpeak: string,
  voiceId: string = "Kore",
  businessName: string = "Our Team",
  onStart?: () => void,
  onEnd?: () => void,
  preloadedWavDataUrl?: string
): Promise<void> {
  const cleanText = String(textToSpeak || "").trim();
  if (!cleanText) return;

  const cacheKey = `${voiceId}::${cleanText}`;
  if (preloadedWavDataUrl && preloadedWavDataUrl.startsWith("data:audio/")) {
    clientAudioCache.set(cacheKey, preloadedWavDataUrl);
  }

  const cachedWav = clientAudioCache.get(cacheKey);
  if (cachedWav) {
    playStudioWavUrl(cachedWav, onStart, onEnd, cleanText, voiceId);
    return;
  }

  let didAnyVoiceStart = false;
  const wrappedOnStart = () => {
    didAnyVoiceStart = true;
    clearPendingAutoplayUnlock();
    onStart?.();
  };

  registerFirstInteractionUnlock(() => {
    const readyWav = clientAudioCache.get(cacheKey);
    if (readyWav) {
      playStudioWavUrl(readyWav, wrappedOnStart, onEnd, cleanText, voiceId);
    } else {
      void speakTextWithStudioPersona(
        cleanText,
        voiceId,
        businessName,
        wrappedOnStart,
        onEnd
      );
    }
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("/api/crm/generate-voice-pitch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        businessName,
        voiceName: voiceId,
        voice: voiceId,
        customScript: cleanText,
        regenerateScriptForVoice: false,
      }),
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    const wavUri = data?.wavDataUrl || data?.audioDataUri;
    if (res.ok && wavUri) {
      clientAudioCache.set(cacheKey, wavUri);
      playStudioWavUrl(wavUri, wrappedOnStart, onEnd, cleanText, voiceId);
      return;
    }
  } catch {}

  if (!didAnyVoiceStart) {
    speakBrowserPersonaFallback(cleanText, voiceId, wrappedOnStart, onEnd);
  }
}

export function speakWithStudioVoice(
  textToSpeak: string,
  voiceId: string = "Kore",
  options?: {
    businessName?: string;
    onStart?: () => void;
    onEnd?: () => void;
    preloadedWavDataUrl?: string;
  }
): void {
  void speakTextWithStudioPersona(
    textToSpeak,
    voiceId,
    options?.businessName || "Our Team",
    options?.onStart,
    options?.onEnd,
    options?.preloadedWavDataUrl
  );
}

/**
 * Checks if the arrival walkthrough voice for a given siteId is already active or starting.
 */
export function isSiteWalkthroughAlreadyActive(siteId: string): boolean {
  if (!siteId || activeWalkthroughSiteId !== siteId) return false;
  if (currentActiveAudio && !currentActiveAudio.paused) return true;
  if (Date.now() - activeWalkthroughStartedAt < 4000) return true;
  return false;
}

/**
 * Starts the automatic invisible site walkthrough voice synchronously.
 * Uses the preloaded data URI if available, or streams directly from
 * `/api/website-builder/public/:siteId/walkthrough-audio` so `audio.play()`
 * runs synchronously inside user click handlers or on page arrival.
 */
export function startSiteWalkthroughAudio(siteId: string, site?: any): void {
  if (!siteId || typeof window === "undefined") return;
  activeWalkthroughSiteId = siteId;
  activeWalkthroughStartedAt = Date.now();

  const preferredVoice =
    site?.siteConfig?.chatbotConfig?.voicePersona ||
    site?.siteConfig?.walkthroughVoice ||
    "Kore";
  const ownerFirst = site?.ownerName
    ? String(site.ownerName).trim().split(/\s+/)[0]
    : "";
  const greeting = ownerFirst ? `Hi ${ownerFirst}!` : `Hi there!`;
  const cityPhrase = site?.city ? ` in ${site.city}` : "";
  const bizName = site?.businessName || "your business";
  const arrivalScript = `${greeting} Welcome to the new custom website we built for ${bizName}${cityPhrase}. We engineered this page with an interactive 4-tap instant quote calculator and a 24/7 automated chat assistant so local customers can request estimates and book with you in seconds. Take a look around your live website right here, and click Claim Your Site Now at the top to launch it on your domain with zero build fee!`;

  const preloadedDataUri =
    site?.walkthroughWavDataUrl || site?.siteConfig?.walkthroughWavDataUrl;
  const audioSrc =
    preloadedDataUri && preloadedDataUri.startsWith("data:audio/")
      ? preloadedDataUri
      : `/api/website-builder/public/${encodeURIComponent(
          siteId
        )}/walkthrough-audio`;

  playStudioWavUrl(
    audioSrc,
    undefined,
    () => {
      if (activeWalkthroughSiteId === siteId) {
        activeWalkthroughSiteId = null;
      }
    },
    arrivalScript,
    preferredVoice
  );
}
