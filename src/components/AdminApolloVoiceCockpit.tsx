import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  Phone,
  Sparkles,
  Play,
  Square,
  Download,
  Send,
  Settings,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Crosshair,
  Volume2,
  Trash2,
} from "lucide-react";
import { getSaasToken } from "@/lib/saas-auth";

const STUDIO_VOICES = [
  {
    id: "Kore",
    shortName: "👩🏼 Sarah (US Female)",
    label: "Sarah (Kore) — Warm US Female Executive · Upbeat",
    lang: "en-US",
    gender: "female",
    pitch: 1.2,
    rate: 1.04,
  },
  {
    id: "Charon",
    shortName: "🧔🏻‍♂️ Marcus (Deep Male)",
    label: "Marcus (Charon) — Deep Baritone Male Consultant · Authoritative",
    lang: "en-US",
    gender: "male",
    pitch: 0.68,
    rate: 0.88,
  },
  {
    id: "Puck",
    shortName: "👨🏻‍💻 Ryan (Fast Founder)",
    label: "Ryan (Puck) — Fast Silicon Valley Male Founder · Energetic",
    lang: "en-US",
    gender: "male",
    pitch: 1.05,
    rate: 1.15,
  },
  {
    id: "Zephyr",
    shortName: "🇬🇧 Victoria (UK Female)",
    label: "Victoria (Zephyr) — Crisp British UK Female Agency Director",
    lang: "en-GB",
    gender: "female",
    pitch: 1.14,
    rate: 0.98,
  },
  {
    id: "Fenrir",
    shortName: "🦅 Viktor (Bold Closer)",
    label: "Viktor (Fenrir) — Bold Wall Street Male Closer · Direct",
    lang: "en-US",
    gender: "male",
    pitch: 0.78,
    rate: 1.08,
  },
  {
    id: "Orus",
    shortName: "🌍 Tunde (Global Male)",
    label: "Tunde (Orus) — Warm Global / Nigerian Male Executive Advisor",
    lang: "en-NG",
    gender: "male",
    pitch: 0.85,
    rate: 0.94,
  },
];

interface AdminApolloVoiceCockpitProps {
  systemSettings: {
    apolloEnrichmentEnabled: boolean;
    apolloDecisionMaker: boolean;
    apolloTechStackSignals: boolean;
    apolloBuyerIntentScore: boolean;
    apolloSmartFilters: boolean;
    apolloMultiChannelCockpit: boolean;
    apolloVoiceNoteEnabled: boolean;
    apolloMachineCallerEnabled: boolean;
    apolloAccessMode: "all_plans" | "growth_and_above" | "owner_only";
  };
  onToggleModule: (patch: Record<string, any>, label: string) => void;
  onLaunchCrm: () => void;
}

export default function AdminApolloVoiceCockpit({
  systemSettings,
  onToggleModule,
  onLaunchCrm,
}: AdminApolloVoiceCockpitProps) {
  const [businessName, setBusinessName] = useState("Apex Dental & Implant Studio");
  const [ownerName, setOwnerName] = useState("Dr. David Chen");
  const [ownerRole, setOwnerRole] = useState("Founder & Lead Dentist");
  const [category, setCategory] = useState("Dental Clinic");
  const [city, setCity] = useState("Houston");
  const [website, setWebsite] = useState("https://apexdentalstudio.com");
  const [cmsPlatform, setCmsPlatform] = useState("WordPress");
  const [missingSignal, setMissingSignal] = useState("No 24/7 AI Receptionist or Instant Online Booking Widget");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [dialPhone, setDialPhone] = useState("");

  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [script, setScript] = useState("");
  const [wavDataUrl, setWavDataUrl] = useState<string | null>(null);
  const [wavBase64, setWavBase64] = useState<string | null>(null);
  const [synthesizedVoiceId, setSynthesizedVoiceId] = useState<string | null>(null);

  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [placingCall, setPlacingCall] = useState(false);
  const [checkingCall, setCheckingCall] = useState(false);

  const [callerConfig, setCallerConfig] = useState<any>(null);
  const [newKeyProvider, setNewKeyProvider] = useState<"bland" | "retell" | "vapi">("bland");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyFromNumber, setNewKeyFromNumber] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const [lastCallId, setLastCallId] = useState<string | null>(null);
  const [lastCallProvider, setLastCallProvider] = useState<string | null>(null);
  const [lastCallStatus, setLastCallStatus] = useState<string | null>(null);
  const [lastCallTranscript, setLastCallTranscript] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const authHeaders = (): Record<string, string> => {
    const tok = getSaasToken() || localStorage.getItem("vh_admin_token") || "admin123";
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tok}`,
    };
  };

  const loadCallerConfig = useCallback(async () => {
    try {
      const r = await fetch("/api/crm/voice-caller/config", { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        setCallerConfig(d.config || null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadCallerConfig();
  }, [loadCallerConfig]);

  const stopSpeaking = useCallback(() => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const playWav = useCallback(
    (url: string) => {
      stopSpeaking();
      const audio = new Audio(url);
      activeAudioRef.current = audio;
      setSpeaking(true);
      audio.onended = () => {
        setSpeaking(false);
        activeAudioRef.current = null;
      };
      audio.onerror = () => {
        setSpeaking(false);
        activeAudioRef.current = null;
      };
      audio.play().catch(() => {
        setSpeaking(false);
        activeAudioRef.current = null;
      });
    },
    [stopSpeaking]
  );

  const speakBrowserFallback = useCallback(
    (textToSpeak: string, voiceId: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      stopSpeaking();
      const utter = new SpeechSynthesisUtterance(textToSpeak);
      const voices = window.speechSynthesis.getVoices();
      const voiceMeta = STUDIO_VOICES.find((v) => v.id === voiceId) || STUDIO_VOICES[0];
      const isFemale = voiceMeta.gender === "female";
      const femaleKeywords = ["Female", "Samantha", "Victoria", "Karen", "Zira", "Aria", "Jenny", "Google UK English Female", "Moira", "Tessa"];
      const maleKeywords = ["Male", "Daniel", "Alex", "David", "Guy", "Christopher", "Google UK English Male", "Aaron", "Fred", "Arthur"];
      const targetKeywords = isFemale ? femaleKeywords : maleKeywords;

      const matchedVoice =
        voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith(voiceMeta.lang.toLowerCase()) &&
            targetKeywords.some((kw) => v.name.toLowerCase().includes(kw.toLowerCase()))
        ) ||
        voices.find((v) => targetKeywords.some((kw) => v.name.toLowerCase().includes(kw.toLowerCase()))) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(voiceMeta.lang.toLowerCase())) ||
        voices[STUDIO_VOICES.findIndex((v) => v.id === voiceId) % Math.max(1, voices.length)];

      if (matchedVoice) utter.voice = matchedVoice;
      utter.pitch = voiceMeta.pitch;
      utter.rate = voiceMeta.rate;
      setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    },
    [stopSpeaking]
  );

  const generateVoicePitch = async (
    overrideVoice?: string,
    autoPlay = true,
    regenerateScriptForVoice = false
  ) => {
    const targetVoice = overrideVoice || selectedVoice;
    stopSpeaking();
    setGeneratingVoice(true);
    setFeedback(null);
    try {
      const r = await fetch("/api/crm/generate-voice-pitch", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          businessName,
          ownerName,
          ownerRole,
          category,
          city,
          website,
          cmsPlatform,
          missingSignals: [missingSignal],
          painPoint: missingSignal,
          agencyName: "DevStudio",
          voiceName: targetVoice,
          customScript: regenerateScriptForVoice ? "" : script,
          regenerateScriptForVoice,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to generate voice pitch");

      setScript(data.script || "");
      setSynthesizedVoiceId(targetVoice);
      setWavDataUrl(data.wavDataUrl || null);
      setWavBase64(data.wavBase64 || null);

      setFeedback({
        type: "ok",
        text: data.wavDataUrl
          ? `✓ Studio Voice Synthesized: ${data.voiceLabel || targetVoice} (${data.engine})`
          : `✓ Voice Script Ready (${data.voiceLabel || targetVoice}) — playing neural voice!`,
      });

      if (autoPlay) {
        if (data.wavDataUrl) {
          playWav(data.wavDataUrl);
        } else if (data.script) {
          speakBrowserFallback(data.script, targetVoice);
        }
      }
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message || "Voice synthesis failed" });
    } finally {
      setGeneratingVoice(false);
    }
  };

  const handleSelectPersona = (voiceId: string) => {
    setSelectedVoice(voiceId);
    generateVoicePitch(voiceId, true, true);
  };

  const handlePlayCurrentVoice = async () => {
    if (wavDataUrl && synthesizedVoiceId === selectedVoice) {
      playWav(wavDataUrl);
      return;
    }
    await generateVoicePitch(selectedVoice, true, false);
  };

  const handleSendVoiceEmail = async () => {
    if (!recipientEmail.trim()) {
      setFeedback({ type: "err", text: "Enter a recipient email address to send the .wav voice note." });
      return;
    }
    setSendingEmail(true);
    setFeedback(null);
    try {
      const r = await fetch("/api/crm/send-voice-email", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          to: recipientEmail.trim(),
          businessName,
          ownerName,
          script,
          wavBase64,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to email voice note");
      setFeedback({
        type: "ok",
        text: `✓ AI Voice-Note (.wav) emailed to ${recipientEmail.trim()} via ${d.sentVia || "SMTP Pool"}!`,
      });
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message || "Failed to send voice email" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleAddCallerKey = async () => {
    if (!newKeyValue.trim()) return;
    setSavingKey(true);
    setFeedback(null);
    try {
      const r = await fetch("/api/crm/voice-caller/config", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          newKey: {
            provider: newKeyProvider,
            label: newKeyLabel.trim() || `${newKeyProvider.toUpperCase()} Key`,
            apiKey: newKeyValue.trim(),
            fromNumber: newKeyFromNumber.trim(),
          },
        }),
      });
      const d = await r.json();
      if (d.config) setCallerConfig(d.config);
      setNewKeyValue("");
      setNewKeyLabel("");
      setFeedback({
        type: "ok",
        text: `✓ Added ${newKeyProvider.toUpperCase()} API key to Outbound AI Machine Caller rotational pool!`,
      });
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message || "Failed to save key" });
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveCallerKey = async (id: string) => {
    const r = await fetch("/api/crm/voice-caller/config", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ removeKeyId: id }),
    });
    const d = await r.json();
    if (d.config) setCallerConfig(d.config);
  };

  const handlePlaceMachineCall = async () => {
    if (!dialPhone.trim()) {
      setFeedback({
        type: "err",
        text: "Enter a phone number in international format (e.g. +17135550199 or +23480...) to launch the AI Machine Call.",
      });
      return;
    }
    setPlacingCall(true);
    setFeedback(null);
    try {
      const r = await fetch("/api/crm/voice-caller/call", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          phone: dialPhone.trim(),
          businessName,
          ownerName,
          ownerRole,
          category,
          city,
          website,
          cmsPlatform,
          missingSignals: [missingSignal],
          painPoint: missingSignal,
          customScript: script,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to place AI machine phone call");
      setLastCallId(d.callId);
      setLastCallProvider(d.provider);
      setLastCallStatus(d.status || "ringing");
      setFeedback({
        type: "ok",
        text: `📞 Outbound AI Machine Caller (${(d.provider || "").toUpperCase()}) is now ringing ${d.calledNumber}!`,
      });
      loadCallerConfig();
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message || "Failed to place call" });
    } finally {
      setPlacingCall(false);
    }
  };

  const handleCheckCallStatus = async () => {
    if (!lastCallId) return;
    setCheckingCall(true);
    try {
      const r = await fetch(`/api/crm/voice-caller/status/${encodeURIComponent(lastCallId)}`, {
        headers: authHeaders(),
      });
      const d = await r.json();
      if (r.ok) {
        setLastCallStatus(d.status || lastCallStatus);
        if (d.transcript) setLastCallTranscript(d.transcript);
        setFeedback({
          type: "ok",
          text: `Call Status: ${(d.status || "in-progress").toUpperCase()}${
            d.durationSeconds ? ` · Duration: ${d.durationSeconds}s` : ""
          }`,
        });
      }
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message });
    } finally {
      setCheckingCall(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with 1-Click Jump to Hunter CRM */}
      <div className="bg-slate-950 text-white rounded-2xl border border-slate-800 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Intelligence, $0 AI Voice Studio &amp; Outbound Machine Caller</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
            B2B Control Center &amp; Live AI Voice / Phone Studio
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
            Here in the Admin Console you can <strong>enable/disable all 7 modules</strong>, test and generate{" "}
            <strong>6 distinct human AI voice-note pitches ($0 API cost)</strong>, manage your{" "}
            <strong>Outbound AI Machine Phone Caller keys (Bland / Retell / Vapi)</strong>, or launch the{" "}
            <strong>Hunter CRM</strong> where these tools run automatically on every lead you hunt.
          </p>
        </div>
        <button
          type="button"
          onClick={onLaunchCrm}
          className="px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs inline-flex items-center gap-2 shrink-0 shadow-md cursor-pointer"
        >
          <Crosshair className="w-4 h-4" />
          <span>Open Hunter CRM (Use on All Hunted Leads) →</span>
        </button>
      </div>

      {/* SECTION 1: 7 Intelligence Module Switches */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-950">
                1. Module Switches (Enable or Disable Anytime)
              </h2>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                  systemSettings.apolloEnrichmentEnabled
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-300"
                }`}
              >
                {systemSettings.apolloEnrichmentEnabled ? "ALL ACTIVE" : "PAUSED"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Toggle individual modules ON or OFF across the platform in 1 click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              value={systemSettings.apolloAccessMode || "all_plans"}
              onChange={(e) =>
                onToggleModule(
                  { apolloAccessMode: e.target.value as any },
                  `Plan Access (${e.target.value})`
                )
              }
              className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
            >
              <option value="all_plans">Available to All Plans (Starter+)</option>
              <option value="growth_and_above">Growth ($149) &amp; Scale ($349) Only</option>
              <option value="owner_only">Owner Admin Only</option>
            </select>

            <button
              type="button"
              onClick={() =>
                onToggleModule(
                  { apolloEnrichmentEnabled: !systemSettings.apolloEnrichmentEnabled },
                  systemSettings.apolloEnrichmentEnabled ? "All Modules OFF" : "All Modules ON"
                )
              }
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                systemSettings.apolloEnrichmentEnabled
                  ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {systemSettings.apolloEnrichmentEnabled ? "Disable All Modules" : "Enable All Modules"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              key: "apolloDecisionMaker" as const,
              title: "1. Decision-Maker & LinkedIn",
              desc: "Extracts Owner/Doctor/CEO name, role, executive email & 1-click LinkedIn X-Ray lookup.",
            },
            {
              key: "apolloTechStackSignals" as const,
              title: "2. Tech-Stack & Pixel Scanner",
              desc: "Detects WordPress, Shopify, Wix, Meta Pixel, GA4 & missing AI chat/booking widgets.",
            },
            {
              key: "apolloBuyerIntentScore" as const,
              title: "3. Buyer Intent Score (0–100)",
              desc: "Ranks leads into Hot Buyers (80+), Warm (55–79), and Cold with revenue-leak reasons.",
            },
            {
              key: "apolloSmartFilters" as const,
              title: "4. Smart Signal Filter Bar",
              desc: "1-click filter buttons in Hunter & CRM for Hot Buyers, Missing Pixels, No Chat & Owner Found.",
            },
            {
              key: "apolloMultiChannelCockpit" as const,
              title: "5. Multi-Channel Smart Hooks",
              desc: "1-click Smart Hooks inside the Email Composer (Decision-Maker, Tech Gap, Audit Link).",
            },
            {
              key: "apolloVoiceNoteEnabled" as const,
              title: "6. 🎙️ Free AI Voice-Note Pitch ($0)",
              desc: "6 distinct human AI voices (Sarah, Marcus, Ryan, Victoria, Viktor, Tunde) generating .wav voice notes.",
            },
            {
              key: "apolloMachineCallerEnabled" as const,
              title: "7. 📞 Outbound AI Machine Caller",
              desc: "Automated outbound AI phone caller pool (Bland AI / Retell AI / Vapi) that rings business phones for you.",
            },
          ].map((mod) => {
            const isOn = Boolean(systemSettings.apolloEnrichmentEnabled && systemSettings[mod.key]);
            return (
              <div
                key={mod.key}
                className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                  isOn ? "border-blue-200 bg-blue-50/30" : "border-slate-200 bg-slate-50 opacity-75"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-950">{mod.title}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onToggleModule(
                          {
                            apolloEnrichmentEnabled: true,
                            [mod.key]: !systemSettings[mod.key],
                          },
                          `${mod.title}: ${!systemSettings[mod.key] ? "ON" : "OFF"}`
                        )
                      }
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer shrink-0 ${
                        isOn
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      {isOn ? "ON" : "OFF"}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{mod.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {feedback.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* SECTION 2: Interactive Target Lead Context + 6-Persona Voice Studio + Machine Phone Caller */}
      <div className="bg-slate-950 text-white rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-indigo-950/70 to-slate-950">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>2. Live Admin AI Voice-Note Studio ($0 Free) &amp; Outbound AI Machine Phone Caller</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Test all 6 distinct AI voices right here or send a live AI Voice-Note / AI Machine Phone Call to any business without leaving the Admin Console.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Business Name</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Decision-Maker</label>
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Role / Title</label>
              <input
                value={ownerRole}
                onChange={(e) => setOwnerRole(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Detected Tech Gap</label>
              <input
                value={missingSignal}
                onChange={(e) => setMissingSignal(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* LEFT COLUMN: 6-Persona $0 AI Studio Voice-Note Pitch */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  <span>Option 1: $0 Studio AI Voice-Note Pitch (6 Distinct Voices)</span>
                </span>
                <select
                  value={selectedVoice}
                  onChange={(e) => handleSelectPersona(e.target.value)}
                  disabled={generatingVoice}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  {STUDIO_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6 Quick-Audition Persona Chips */}
              <div className="flex flex-wrap gap-1.5">
                {STUDIO_VOICES.map((v) => {
                  const active = selectedVoice === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={generatingVoice}
                      onClick={() => handleSelectPersona(v.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        active
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm"
                          : "bg-slate-950 text-slate-300 border-slate-800 hover:border-emerald-500/50 hover:text-white"
                      }`}
                    >
                      {v.shortName}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Click any of the 6 voice personas above to automatically synthesize a real multi-persona neural{" "}
                <code className="text-emerald-300">.wav</code> audio pitch with distinct vocal timbre, cadence, and signature intro.
              </p>

              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={4}
                placeholder={`Click "Synthesize & Play Voice Pitch" or click any persona chip above to generate a custom 30-second voice pitch for ${businessName}...`}
                className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 leading-relaxed"
              />

              {wavDataUrl && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-emerald-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-emerald-300 font-semibold">
                    <span>
                      Studio Audio Ready ({STUDIO_VOICES.find((v) => v.id === synthesizedVoiceId)?.shortName || selectedVoice})
                    </span>
                    <a
                      href={wavDataUrl}
                      download={`${businessName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${selectedVoice.toLowerCase()}_pitch.wav`}
                      className="underline hover:text-emerald-200 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Download .WAV
                    </a>
                  </div>
                  <audio key={wavDataUrl} controls src={wavDataUrl} className="w-full h-8" />
                </div>
              )}

              {/* Optional Direct Email Delivery */}
              <div className="pt-2 border-t border-slate-800 flex gap-2">
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Recipient email to send .wav voice note..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleSendVoiceEmail}
                  disabled={sendingEmail || !script}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingEmail ? "Sending..." : "Email .WAV"}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-3">
              <button
                type="button"
                onClick={() => generateVoicePitch(selectedVoice, true, false)}
                disabled={generatingVoice}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {generatingVoice ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{generatingVoice ? "Synthesizing Voice..." : "Synthesize & Play Voice Pitch"}</span>
              </button>

              {script && (
                <button
                  type="button"
                  onClick={speaking ? stopSpeaking : handlePlayCurrentVoice}
                  disabled={generatingVoice}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {speaking ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>
                    {speaking
                      ? "Stop Audio"
                      : `Play (${STUDIO_VOICES.find((v) => v.id === selectedVoice)?.shortName || selectedVoice})`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Outbound AI Machine Phone Caller Pool (Bland / Retell / Vapi) */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Option 2: Outbound AI Machine Phone Caller</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">
                  {callerConfig?.keys?.length || 0} Rotational Keys Active
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Paste free trial API keys from{" "}
                <a href="https://www.bland.ai" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">
                  Bland.ai
                </a>
                ,{" "}
                <a href="https://www.retellai.com" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">
                  Retell.ai ($10 free)
                </a>
                , or{" "}
                <a href="https://vapi.ai" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">
                  Vapi.ai ($5 free)
                </a>
                . The cloud machine dials the business phone and speaks with the owner in real time.
              </p>

              {/* Add Rotational Key Row */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-300">Add API Key to Rotational Caller Pool</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={newKeyProvider}
                    onChange={(e) => setNewKeyProvider(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                  >
                    <option value="bland">Bland.ai (No From-# Needed)</option>
                    <option value="retell">Retell.ai ($10 Free Credits)</option>
                    <option value="vapi">Vapi.ai ($5 Free Credits)</option>
                  </select>
                  <input
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="Label (e.g. Bland Trial #1)"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <div className="flex gap-1.5">
                    <input
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      placeholder="Paste API Key (sk-...)"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddCallerKey}
                      disabled={savingKey || !newKeyValue.trim()}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-extrabold text-xs shrink-0 cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
                {newKeyProvider !== "bland" && (
                  <input
                    value={newKeyFromNumber}
                    onChange={(e) => setNewKeyFromNumber(e.target.value)}
                    placeholder="Optional From Phone Number (+1...)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                )}

                {callerConfig?.keys && callerConfig.keys.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {callerConfig.keys.map((k: any) => (
                      <div
                        key={k.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          <span className="font-bold uppercase text-amber-300">{k.provider}</span>
                          <span className="text-slate-200 truncate">{k.label}</span>
                          <span className="font-mono text-slate-400">{k.apiKeyMasked}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCallerKey(k.id)}
                          className="text-rose-400 hover:text-rose-300 text-xs font-bold cursor-pointer ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dial Number Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Target Phone Number to Ring (E.164 Format)
                </label>
                <input
                  value={dialPhone}
                  onChange={(e) => setDialPhone(e.target.value)}
                  placeholder="+1 (713) 555-0199 or +234..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                />
              </div>

              {lastCallId && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      Last AI Call ({lastCallProvider?.toUpperCase()}):{" "}
                      <strong className="text-amber-300 uppercase">{lastCallStatus || "dispatched"}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleCheckCallStatus}
                      disabled={checkingCall}
                      className="text-sky-400 hover:underline font-bold cursor-pointer"
                    >
                      {checkingCall ? "Checking..." : "↻ Refresh Transcript"}
                    </button>
                  </div>
                  {lastCallTranscript && (
                    <div className="p-2 rounded bg-slate-900 text-slate-300 font-mono text-[11px] max-h-28 overflow-y-auto whitespace-pre-wrap">
                      {lastCallTranscript}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-3">
              <button
                type="button"
                onClick={handlePlaceMachineCall}
                disabled={placingCall}
                className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {placingCall ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                <span>{placingCall ? "Dialing via AI Cloud..." : "📞 Launch Automated AI Machine Phone Call Now"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
