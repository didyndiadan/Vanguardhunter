import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare,
  X,
  Send,
  Volume2,
  VolumeX,
  Phone,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  BellRing,
  User,
  Mic,
  Play,
  Square,
} from "lucide-react";
import {
  STUDIO_VOICE_PERSONAS,
  getStudioVoicePersona,
  speakWithStudioVoice,
  stopStudioVoice,
} from "@/lib/studio-voices";

export interface ChatbotThemeProps {
  accentBg: string;
  accentText: string;
  topBarBg: string;
  inkPrimary: string;
  inkMuted: string;
  borderSubtle: string;
  canvasBg: string;
}

export interface WebsiteAutomatedChatbotProps {
  site: any;
  theme: ChatbotThemeProps;
  phoneDisplay: string;
  phoneHref: string;
  onLeadCaptured?: (updatedSite: any) => void;
}

interface ChatMessage {
  id: string;
  sender: "bot" | "visitor";
  text: string;
  timestamp: string;
  options?: Array<{ label: string; desc?: string }>;
  showContactForm?: boolean;
  isConfirmation?: boolean;
}

/**
 * Synthesizes a pleasant, unmistakable notification chime using the browser's Web Audio API.
 * Zero external audio file dependencies — works 100% offline and across all modern browsers.
 */
export function playChatbotSound(type: "arrival" | "reply" | "success" = "arrival"): boolean {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx: AudioContext =
      (window as any).__vhChatbotAudioCtx || new AudioCtx();
    (window as any).__vhChatbotAudioCtx = ctx;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === "arrival") {
      // Three-note bright rising concierge chime (C5 -> E5 -> G5 -> C6)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === notes.length - 1 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);

        gain.gain.setValueAtTime(0.001, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.11 + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.38);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.4);
      });
    } else if (type === "reply") {
      // Soft two-note message pop (A5 -> E6)
      const notes = [587.33, 880];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.15, now + idx * 0.08 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.24);
      });
    } else if (type === "success") {
      // Warm major chord arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);

        gain.gain.setValueAtTime(0.001, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.47);
      });
    }

    return ctx.state === "running";
  } catch {
    return false;
  }
}

export const WebsiteAutomatedChatbot: React.FC<WebsiteAutomatedChatbotProps> = ({
  site,
  theme,
  phoneDisplay,
  phoneHref,
  onLeadCaptured,
}) => {
  const cfg = (site?.siteConfig || {}) as any;
  const chatbotCfg = cfg.chatbotConfig || {};

  // Enabled by default on all websites unless explicitly disabled by owner
  if (chatbotCfg.enabled === false) {
    return null;
  }

  const businessName = cfg.brandName || site?.businessName || "Our Team";
  const businessInitials =
    businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() || "")
      .join("") || "TM";
  const city = cfg.city || site?.city || "your area";
  const category = cfg.category || site?.category || "Services";
  const hoursText = cfg.hoursText || "Mon–Sat, 8 am to 7 pm";
  const rawAgentName = String(chatbotCfg.agentName || "").trim();
  const agentName =
    rawAgentName && !/automated|ai\b|bot\b/i.test(rawAgentName)
      ? rawAgentName
      : `${businessName} Team`;
  const funnel = cfg.funnelConfig || {};

  const step1Options: Array<{ label: string; desc?: string }> =
    Array.isArray(funnel.step1Options) && funnel.step1Options.length > 0
      ? funnel.step1Options.slice(0, 4)
      : Array.isArray(cfg.services) && cfg.services.length > 0
      ? cfg.services.slice(0, 4).map((s: any) => ({ label: s.title, desc: s.timeline }))
      : [
          { label: `Get a Free ${category} Quote` },
          { label: "Check Availability & Pricing" },
          { label: "Book a Consultation / Visit" },
          { label: "Ask a Quick Question" },
        ];

  const step2Options: Array<{ label: string; desc?: string }> =
    Array.isArray(funnel.step2Options) && funnel.step2Options.length > 0
      ? funnel.step2Options.slice(0, 3)
      : [
          { label: "Right away / This week" },
          { label: "Within the next 2–4 weeks" },
          { label: "Just comparing options & pricing" },
        ];

  const step3Options: Array<{ label: string; desc?: string }> =
    Array.isArray(funnel.step3Options) && funnel.step3Options.length > 0
      ? funnel.step3Options.slice(0, 3)
      : [
          { label: "Clear upfront pricing" },
          { label: "Fastest available schedule" },
          { label: "Speaking with a specialist first" },
        ];

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [hasAutoOpened, setHasAutoOpened] = useState<boolean>(false);
  const [soundEnabled] = useState<boolean>(chatbotCfg.soundEnabled !== false);
  const [spokenVoiceEnabled, setSpokenVoiceEnabled] = useState<boolean>(
    chatbotCfg.spokenVoiceEnabled !== false
  );
  const [voicePersonaId, setVoicePersonaId] = useState<string>(
    chatbotCfg.voicePersona || "Kore"
  );
  const [, setSpeakingMessageId] = useState<string | null>(null);
  const prevSiteIdRef = useRef<string | undefined>(site?.siteId);
  const [pendingFirstGestureChime, setPendingFirstGestureChime] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(1);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [attentionPulse, setAttentionPulse] = useState<boolean>(false);

  // Conversation state machine:
  // 1 = waiting for service/topic choice
  // 2 = waiting for timeline choice
  // 3 = waiting for priority/goal choice
  // 4 = waiting for contact info (name + phone/email)
  // 5 = lead captured & free Q&A
  const [questionStage, setQuestionStage] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedTimeline, setSelectedTimeline] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");

  // Inline contact form state inside chatbot
  const [visitorName, setVisitorName] = useState<string>("");
  const [visitorPhone, setVisitorPhone] = useState<string>("");
  const [visitorEmail, setVisitorEmail] = useState<string>("");
  const [submittingLead, setSubmittingLead] = useState<boolean>(false);
  const [leadSubmitted, setLeadSubmitted] = useState<boolean>(false);

  // Free-text input state
  const [inputText, setInputText] = useState<string>("");
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const nowTimeLabel = () =>
    new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const sanitizeGreeting = (raw?: string) => {
    const defaultMsg = `👋 Hi there! Welcome to ${businessName} in ${city}. How can we help you with your ${category.toLowerCase()} needs today?`;
    if (!raw || !raw.trim()) return defaultMsg;
    return raw
      .replace(/I'm your automated assistant\s*[—–-]*\s*/gi, "We're ")
      .replace(/I am your automated assistant\s*[—–-]*\s*/gi, "We're ")
      .replace(/your automated assistant/gi, `the ${businessName} team`)
      .replace(/\bautomated assistant\b/gi, "team")
      .replace(/\bAI assistant\b/gi, "team");
  };

  const initialGreeting = sanitizeGreeting(chatbotCfg.greeting);

  const initialQuestion =
    chatbotCfg.firstQuestion ||
    funnel.step1Question?.replace(/^1\.\s*/, "") ||
    `What can we help you with today? Tap an option below or ask any question:`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "msg-welcome-1",
      sender: "bot",
      text: initialGreeting,
      timestamp: nowTimeLabel(),
    },
    {
      id: "msg-welcome-2",
      sender: "bot",
      text: initialQuestion,
      timestamp: nowTimeLabel(),
      options: step1Options,
    },
  ]);

  // Reset conversation if user switches to a different website in the builder
  useEffect(() => {
    const freshGreeting = sanitizeGreeting(chatbotCfg.greeting);
    const freshQ1 =
      chatbotCfg.firstQuestion ||
      funnel.step1Question?.replace(/^1\.\s*/, "") ||
      `What can we help you with today? Tap an option below or ask any question:`;

    setMessages([
      {
        id: "msg-welcome-1",
        sender: "bot",
        text: freshGreeting,
        timestamp: nowTimeLabel(),
      },
      {
        id: "msg-welcome-2",
        sender: "bot",
        text: freshQ1,
        timestamp: nowTimeLabel(),
        options: step1Options,
      },
    ]);
    setQuestionStage(1);
    setSelectedService("");
    setSelectedTimeline("");
    setSelectedPriority("");
    setLeadSubmitted(false);
    setHasAutoOpened(false);
    setVoicePersonaId(chatbotCfg.voicePersona || "Kore");
    setSpokenVoiceEnabled(chatbotCfg.spokenVoiceEnabled !== false);
    if (prevSiteIdRef.current && prevSiteIdRef.current !== site?.siteId) {
      stopStudioVoice();
      setSpeakingMessageId(null);
    }
    prevSiteIdRef.current = site?.siteId;
  }, [site?.siteId, chatbotCfg.voicePersona, chatbotCfg.spokenVoiceEnabled]);

  const speakBotMessage = useCallback(
    (msgId: string, text: string, overrideVoiceId?: string) => {
      const cleanText = text
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!cleanText) return;
      const vId = overrideVoiceId || voicePersonaId || "Kore";
      setSpeakingMessageId(msgId);
      speakWithStudioVoice(cleanText, vId, {
        onEnd: () => {
          setSpeakingMessageId((prev) => (prev === msgId ? null : prev));
        },
      });
    },
    [voicePersonaId]
  );

  // Auto-scroll to newest message inside the chatbot container only
  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  // Automatically pop open the chatbot after 650ms when visitor arrives on the business website & play chime sound!
  useEffect(() => {
    if (hasAutoOpened) return;
    const timer = setTimeout(() => {
      setIsOpen(true);
      setHasAutoOpened(true);
      setUnreadCount(0);
      setAttentionPulse(true);
      setTimeout(() => setAttentionPulse(false), 4000);

      if (soundEnabled) {
        const played = playChatbotSound("arrival");
        if (!played) {
          // If browser blocked audio before first tap/scroll, queue it for the very first user gesture
          setPendingFirstGestureChime(true);
        }
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [hasAutoOpened, soundEnabled]);

  // Play the arrival chime on first visitor click/tap/scroll/keydown if AudioContext was initially suspended
  useEffect(() => {
    if (!pendingFirstGestureChime || !soundEnabled) return;

    const unlockAndChime = () => {
      const ok = playChatbotSound("arrival");
      if (ok) {
        setPendingFirstGestureChime(false);
        setAttentionPulse(true);
        setTimeout(() => setAttentionPulse(false), 2500);
      }
    };

    window.addEventListener("pointerdown", unlockAndChime, { once: true });
    window.addEventListener("click", unlockAndChime, { once: true });
    window.addEventListener("keydown", unlockAndChime, { once: true });
    window.addEventListener("touchstart", unlockAndChime, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAndChime);
      window.removeEventListener("click", unlockAndChime);
      window.removeEventListener("keydown", unlockAndChime);
      window.removeEventListener("touchstart", unlockAndChime);
    };
  }, [pendingFirstGestureChime, soundEnabled]);

  const appendBotReply = useCallback(
    (newMsg: Omit<ChatMessage, "id" | "sender" | "timestamp">, delayMs = 550) => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const newId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setMessages((prev) => [
          ...prev,
          {
            ...newMsg,
            id: newId,
            sender: "bot",
            timestamp: nowTimeLabel(),
          },
        ]);
        if (soundEnabled) {
          playChatbotSound(newMsg.isConfirmation ? "success" : "reply");
        }
        if (spokenVoiceEnabled && newMsg.text) {
          speakBotMessage(newId, newMsg.text);
        }
      }, delayMs);
    },
    [soundEnabled, spokenVoiceEnabled, speakBotMessage]
  );

  // Smart FAQ / Business knowledge matcher when a visitor types a custom question
  const matchBusinessAnswer = (query: string): string | null => {
    const q = query.toLowerCase();

    // Check custom FAQs on the website first
    if (Array.isArray(cfg.faqs)) {
      for (const item of cfg.faqs) {
        const words = String(item.q || "")
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 3);
        if (words.some((w) => q.includes(w))) {
          return `${item.a}`;
        }
      }
    }

    if (/hour|open|close|when are you|schedule|weekend|sunday|saturday/i.test(q)) {
      return `Our hours at ${businessName} are ${hoursText}. You can also call us directly at ${phoneDisplay} anytime!`;
    }

    if (/where|locat|address|area|neighborhood|city|near/i.test(q)) {
      const areas = Array.isArray(cfg.serviceAreas) && cfg.serviceAreas.length > 0
        ? cfg.serviceAreas.join(", ")
        : city;
      return `We proudly serve ${areas}.`;
    }

    if (/price|cost|how much|rate|quote|estimate|fee|membership|package/i.test(q)) {
      return `We provide clear, upfront pricing tailored to your exact needs with zero hidden fees! Tell me a quick bit about what you're looking for and we'll send your custom quote right over.`;
    }

    if (/phone|call|number|speak|talk|human|person|agent/i.test(q)) {
      return `You can reach our ${businessName} team directly at ${phoneDisplay} (${hoursText}), or leave your number right here and we'll call you within 15 minutes!`;
    }

    return null;
  };

  const submitChatbotLead = async (
    finalName: string,
    finalPhone: string,
    finalEmail: string,
    extraNote = ""
  ) => {
    if (!finalPhone.trim() && !finalEmail.trim()) return;
    setSubmittingLead(true);

    const transcriptSummary = messages
      .filter((m) => m.sender === "visitor")
      .map((m) => m.text)
      .join(" | ");

    try {
      const res = await fetch(`/api/website-builder/public/${site.siteId}/funnel-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceChoice: selectedService || `${category} Inquiry (via Live Chatbot)`,
          timelineChoice: selectedTimeline || "Requested via Website Chatbot",
          scopeChoice: selectedPriority || "Interactive Chatbot Lead",
          visitorName: finalName.trim() || "Website Chat Visitor",
          visitorPhone: finalPhone.trim() || finalEmail.trim(),
          visitorEmail: finalEmail.trim(),
          source: "automated_website_chatbot",
          notes: `Automated Chatbot Transcript: ${transcriptSummary}${extraNote ? ` | ${extraNote}` : ""}`,
        }),
      });
      const data = await res.json();
      if (data?.site && onLeadCaptured) {
        onLeadCaptured(data.site);
      }
    } catch {
      // Best-effort lead submission
    } finally {
      setSubmittingLead(false);
      setLeadSubmitted(true);
      setQuestionStage(5);

      appendBotReply(
        {
          text: `🎉 Thank you${finalName ? `, ${finalName}` : ""}! We've sent your details directly to our ${businessName} team. A specialist will reach out to you at ${finalPhone || finalEmail} shortly! Feel free to ask any other questions below.`,
          isConfirmation: true,
        },
        450
      );
    }
  };

  const handleSelectOption = (optionLabel: string) => {
    // Add visitor bubble
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, options: undefined })), // hide old option chips once clicked
      {
        id: `vis-${Date.now()}`,
        sender: "visitor",
        text: optionLabel,
        timestamp: nowTimeLabel(),
      },
    ]);

    if (questionStage === 1) {
      setSelectedService(optionLabel);
      setQuestionStage(2);
      const q2 =
        funnel.step2Question?.replace(/^2\.\s*/, "") ||
        `Got it — we'd love to help with "${optionLabel}"! When are you looking to get started?`;
      appendBotReply({
        text: q2,
        options: step2Options,
      });
    } else if (questionStage === 2) {
      setSelectedTimeline(optionLabel);
      setQuestionStage(3);
      const q3 =
        funnel.step3Question?.replace(/^3\.\s*/, "") ||
        `Awesome! What matters most to you so we can prepare the best options?`;
      appendBotReply({
        text: q3,
        options: step3Options,
      });
    } else if (questionStage === 3) {
      setSelectedPriority(optionLabel);
      setQuestionStage(4);
      appendBotReply({
        text: `Perfect! Where should our ${businessName} team send your personalized quote & availability? Enter your name and best phone number (or email) below:`,
        showContactForm: true,
      });
    } else {
      // Stage 4+ fallback
      appendBotReply({
        text: `Let us know the best phone number or email to reach you, or call us directly at ${phoneDisplay}!`,
        showContactForm: !leadSubmitted,
      });
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText("");

    // Add visitor message bubble
    setMessages((prev) => [
      ...prev,
      {
        id: `vis-${Date.now()}`,
        sender: "visitor",
        text: trimmed,
        timestamp: nowTimeLabel(),
      },
    ]);

    // Check if visitor typed a phone number or email address directly in chat!
    const phoneMatch = trimmed.match(/(?:\+?\d[\d\s().-]{6,}\d)/);
    const emailMatch = trimmed.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);

    if ((phoneMatch || emailMatch) && !leadSubmitted) {
      const extractedPhone = phoneMatch ? phoneMatch[0].trim() : "";
      const extractedEmail = emailMatch ? emailMatch[0].trim() : "";
      setVisitorPhone(extractedPhone);
      setVisitorEmail(extractedEmail);
      submitChatbotLead(visitorName, extractedPhone, extractedEmail, `Direct chat message: ${trimmed}`);
      return;
    }

    // Check if the message matches an FAQ / hours / pricing / location question
    const matchedAnswer = matchBusinessAnswer(trimmed);

    if (questionStage === 1) {
      setSelectedService(trimmed);
      setQuestionStage(2);
      const q2 =
        funnel.step2Question?.replace(/^2\.\s*/, "") ||
        `When are you looking to get started?`;
      appendBotReply({
        text: matchedAnswer
          ? `${matchedAnswer}\n\nBy the way — ${q2.charAt(0).toLowerCase() + q2.slice(1)}`
          : `Thanks for sharing! We can definitely help with that at ${businessName}. ${q2}`,
        options: step2Options,
      });
    } else if (questionStage === 2) {
      setSelectedTimeline(trimmed);
      setQuestionStage(3);
      const q3 =
        funnel.step3Question?.replace(/^3\.\s*/, "") ||
        `What matters most to you for this?`;
      appendBotReply({
        text: matchedAnswer ? `${matchedAnswer}\n\nAlso, ${q3.toLowerCase()}` : `Got it! ${q3}`,
        options: step3Options,
      });
    } else if (questionStage === 3) {
      setSelectedPriority(trimmed);
      setQuestionStage(4);
      appendBotReply({
        text: matchedAnswer
          ? `${matchedAnswer}\n\nWhat is your name and best phone number so our team at ${businessName} can text or call you right back?`
          : `Perfect! What is your name and best phone number (or email) so our ${businessName} team can follow up with you right away?`,
        showContactForm: true,
      });
    } else if (questionStage === 4 && !leadSubmitted) {
      appendBotReply({
        text: matchedAnswer
          ? `${matchedAnswer}\n\nPop your phone number or email in the box below (or just type it here) so we can lock this in for you!`
          : `Thanks! Just enter your phone number or email below (or type it right in the chat) and our ${businessName} team will reach out to you shortly.`,
        showContactForm: true,
      });
    } else {
      appendBotReply({
        text:
          matchedAnswer ||
          `Thanks for your message! Our ${businessName} team has your note and can also be reached anytime at ${phoneDisplay} (${hoursText}).`,
      });
    }
  };

  const handleInlineFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorPhone.trim() && !visitorEmail.trim()) return;
    submitChatbotLead(visitorName, visitorPhone, visitorEmail);
  };

  return (
    <div className="fixed bottom-16 sm:bottom-5 right-3 sm:right-6 z-[75] flex flex-col items-end pointer-events-none">
      {/* Expanded Chatbot Window */}
      {isOpen && (
        <div
          className={`pointer-events-auto w-[calc(100vw-24px)] sm:w-[390px] max-h-[76vh] sm:max-h-[580px] bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.28)] border flex flex-col overflow-hidden mb-3 transition-all duration-300 ${
            attentionPulse ? "ring-4 ring-amber-400/70" : ""
          }`}
          style={{ borderColor: theme.borderSubtle }}
        >
          {/* Chatbot Top Header */}
          <div
            className="px-4 py-3.5 text-white flex items-center justify-between gap-2 shrink-0"
            style={{ backgroundColor: theme.topBarBg }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 relative shadow-inner"
                style={{ backgroundColor: theme.accentBg }}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-stone-900" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5">
                  <span className="truncate">{agentName}</span>
                </div>
                <div className="text-[11px] text-emerald-300 flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Online Now · Instant Reply</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Direct Call Shortcut */}
              <a
                href={phoneHref}
                title={`Call ${phoneDisplay}`}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-300" />
              </a>

              {/* Minimize Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize Chat"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Messages Area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 bg-stone-50/70 min-h-[250px] max-h-[370px]"
          >
            {messages.map((msg) => {
              const isBot = msg.sender === "bot";
              return (
                <div key={msg.id} className="space-y-2">
                  <div className={`flex items-end gap-2 ${isBot ? "justify-start" : "justify-end"}`}>
                    {isBot && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mb-0.5"
                        style={{ backgroundColor: theme.accentBg }}
                      >
                        {businessInitials}
                      </div>
                    )}

                    <div
                      className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-xs whitespace-pre-line ${
                        isBot
                          ? "bg-white text-stone-900 border rounded-bl-xs"
                          : "text-white font-medium rounded-br-xs"
                      }`}
                      style={
                        isBot
                          ? { borderColor: theme.borderSubtle }
                          : { backgroundColor: theme.accentBg }
                      }
                    >
                      <div>{msg.text}</div>
                      <div
                        className={`text-[10px] mt-1.5 flex items-center justify-between gap-2 ${
                          isBot ? "text-stone-400" : "text-white/75 text-right"
                        }`}
                      >
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick-Tap Option Chips inside Chatbot */}
                  {isBot && Array.isArray(msg.options) && msg.options.length > 0 && (
                    <div className="pl-8 flex flex-col gap-1.5 pt-0.5">
                      {msg.options.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectOption(opt.label)}
                          className="w-full text-left px-3 py-2 rounded-xl bg-white hover:bg-stone-100 border text-xs font-bold transition-all flex items-center justify-between gap-2 shadow-2xs cursor-pointer group"
                          style={{
                            borderColor: theme.accentBg,
                            color: theme.inkPrimary,
                          }}
                        >
                          <span className="truncate">{opt.label}</span>
                          <span
                            className="text-[11px] font-extrabold shrink-0 group-hover:translate-x-0.5 transition-transform"
                            style={{ color: theme.accentText }}
                          >
                            Tap →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Inline Lead Capture Card when Stage 4 is reached */}
                  {isBot && msg.showContactForm && !leadSubmitted && (
                    <form
                      onSubmit={handleInlineFormSubmit}
                      className="ml-8 p-3 rounded-xl bg-white border shadow-xs space-y-2"
                      style={{ borderColor: theme.borderSubtle }}
                    >
                      <div className="text-[11px] font-bold" style={{ color: theme.inkPrimary }}>
                        Quick Contact Details for {businessName}:
                      </div>
                      <input
                        type="text"
                        value={visitorName}
                        onChange={(e) => setVisitorName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none"
                        style={{ borderColor: theme.borderSubtle }}
                      />
                      <input
                        type="tel"
                        required
                        value={visitorPhone}
                        onChange={(e) => setVisitorPhone(e.target.value)}
                        placeholder="Best Phone Number (or Email) *"
                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono focus:outline-none"
                        style={{ borderColor: theme.borderSubtle }}
                      />
                      <button
                        type="submit"
                        disabled={submittingLead}
                        className="w-full py-2 px-3 rounded-lg text-white text-xs font-bold shadow-xs transition-opacity disabled:opacity-50 cursor-pointer"
                        style={{ backgroundColor: theme.accentBg }}
                      >
                        {submittingLead ? "Sending..." : `Send to ${businessName} →`}
                      </button>
                    </form>
                  )}

                  {/* Confirmation Call Box */}
                  {isBot && msg.isConfirmation && (
                    <div
                      className="ml-8 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1.5"
                    >
                      <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Priority Inquiry Logged</span>
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        Want to speak right away? Call us directly:
                      </p>
                      <a
                        href={phoneHref}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold text-xs"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call {phoneDisplay}</span>
                      </a>
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: theme.accentBg }}
                >
                  {businessInitials}
                </div>
                <div
                  className="px-3.5 py-2 rounded-2xl bg-white border text-xs text-stone-500 flex items-center gap-1"
                  style={{ borderColor: theme.borderSubtle }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Message Input Bar */}
          <form
            onSubmit={handleSendText}
            className="p-2.5 bg-white border-t flex items-center gap-2 shrink-0"
            style={{ borderColor: theme.borderSubtle }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your answer or ask a question..."
              className="flex-1 px-3 py-2 rounded-xl border text-xs text-stone-900 focus:outline-none"
              style={{ borderColor: theme.borderSubtle }}
            />
            <button
              type="submit"
              className="p-2.5 rounded-xl text-white shrink-0 transition-opacity hover:opacity-95 cursor-pointer"
              style={{ backgroundColor: theme.accentBg }}
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Launcher Pill / Button at Bottom of Website */}
      <button
        type="button"
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          setUnreadCount(0);
          if (nextOpen && soundEnabled) {
            playChatbotSound("reply");
          }
        }}
        className="pointer-events-auto group flex items-center gap-2.5 px-4 py-3 rounded-full text-white font-bold text-xs sm:text-sm shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:scale-[1.02] transition-all cursor-pointer border border-white/20"
        style={{ backgroundColor: theme.accentBg }}
      >
        <div className="relative flex items-center justify-center">
          {isOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <>
              <MessageSquare className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </>
          )}
        </div>
        <span>{isOpen ? "Hide Chat" : `Chat with ${businessName}`}</span>
        {!isOpen && (
          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
        )}
      </button>
    </div>
  );
};

export default WebsiteAutomatedChatbot;
