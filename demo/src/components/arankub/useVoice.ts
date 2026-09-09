"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * สนทนาด้วยเสียงกับ ARANKUB Assistant
 *
 *  ฟัง  — Web Speech API (th-TH) ต้องรันบน HTTPS หรือ localhost เท่านั้น
 *  พูด  — /api/tts (MMS-TTS-tha บน GPU เซิร์ฟเวอร์) เสียงเดียวกันทุกเครื่อง
 *         ถ้าเรียกไม่ได้ค่อย fallback ไป speechSynthesis ของเบราว์เซอร์
 *
 * โหมดสนทนาต่อเนื่อง (handsFree): พูดจบ → กลับไปฟังต่อเองอัตโนมัติ
 */

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return SR ? new SR() : null;
}

/** ตัดสิ่งที่ไม่ควรอ่านออกเสียง — โค้ดบล็อก ตาราง markdown สัญลักษณ์ */
export function speakableText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // โค้ด/สเปกกราฟ
    .replace(/^\s*\|.*\|\s*$/gm, "") // แถวตาราง
    .replace(/^\s*[-:|\s]+$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

/** แบ่งเป็นท่อน ~180 ตัวอักษรตามขอบประโยค เพื่อให้ได้ยินท่อนแรกเร็วขึ้น */
function chunk(text: string, size = 180): string[] {
  const parts: string[] = [];
  let buf = "";
  for (const piece of text.split(/(?<=[.!?。ๆ]|\s—\s)\s+/)) {
    if ((buf + piece).length > size && buf) {
      parts.push(buf.trim());
      buf = "";
    }
    buf += `${piece} `;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.filter(Boolean);
}

export function useVoice(onFinalTranscript: (text: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [voiceReply, setVoiceReply] = useState(false); // อ่านคำตอบออกเสียงเสมอ
  const [handsFree, setHandsFree] = useState(false); // พูดจบแล้วฟังต่อเอง
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef<string[]>([]);
  const cancelRef = useRef(false);
  const handsFreeRef = useRef(handsFree);
  const onFinalRef = useRef(onFinalTranscript);

  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);
  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const releaseUrls = () => {
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current = [];
  };

  /* --------------------------------------------------------------- ฟัง */

  const stopListening = useCallback(() => {
    try {
      recRef.current?.abort();
    } catch {
      /* เครื่องไม่รองรับ */
    }
    recRef.current = null;
    setState((s) => (s === "listening" ? "idle" : s));
  }, []);

  const startListening = useCallback(() => {
    setError(null);

    // เบราว์เซอร์ยอมให้ใช้ไมค์เฉพาะ secure context — บอกลิงก์ https ที่ใช้แทนได้เลย
    if (typeof window !== "undefined" && !window.isSecureContext) {
      const secure = `https://${window.location.hostname}:3443${window.location.pathname}`;
      setError(`สั่งงานด้วยเสียงต้องเปิดผ่าน https:// — ใช้ลิงก์ ${secure} แทน`);
      return;
    }
    const rec = createRecognition();
    if (!rec) {
      setError("เบราว์เซอร์นี้ไม่รองรับการรับเสียง — แนะนำ Chrome หรือ Edge");
      return;
    }

    recRef.current = rec;
    rec.lang = "th-TH";
    rec.interimResults = true;
    rec.continuous = false;
    setTranscript("");
    setState("listening");

    let finalText = "";
    rec.onresult = (ev) => {
      let text = "";
      for (let i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
      setTranscript(text);
      if (ev.results[ev.results.length - 1].isFinal) finalText = text.trim();
    };
    rec.onerror = (e) => {
      const code = e?.error ?? "";
      if (code === "not-allowed" || code === "service-not-allowed") setError("เบราว์เซอร์ไม่อนุญาตให้ใช้ไมโครโฟน — กดอนุญาตที่ไอคอนกล้อง/ไมค์บนแถบที่อยู่");
      else if (code === "no-speech") setError("ไม่ได้ยินเสียงพูด ลองใหม่อีกครั้ง");
      else if (code !== "aborted") setError("รับเสียงไม่สำเร็จ ลองใหม่อีกครั้ง");
      setState("idle");
    };
    rec.onend = () => {
      recRef.current = null;
      if (finalText) {
        setState("thinking");
        onFinalRef.current(finalText);
      } else {
        setState((s) => (s === "listening" ? "idle" : s));
      }
    };

    try {
      rec.start();
    } catch {
      setError("เริ่มรับเสียงไม่สำเร็จ ลองใหม่อีกครั้ง");
      setState("idle");
    }
  }, []);

  /* --------------------------------------------------------------- พูด */

  const stopSpeaking = useCallback(() => {
    cancelRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ไม่รองรับ */
    }
    releaseUrls();
    setState((s) => (s === "speaking" ? "idle" : s));
  }, []);

  /** ขอไฟล์เสียงจากเซิร์ฟเวอร์ — คืน null ถ้าใช้ไม่ได้ (จะไป fallback เบราว์เซอร์) */
  const fetchTts = useCallback(async (text: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size < 1000) return null;
      const url = URL.createObjectURL(blob);
      urlsRef.current.push(url);
      return url;
    } catch {
      return null;
    }
  }, []);

  const playUrl = (url: string) =>
    new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });

  const browserSpeak = (text: string) =>
    new Promise<void>((resolve) => {
      try {
        if (!window.speechSynthesis) return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "th-TH";
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });

  const speak = useCallback(
    async (raw: string) => {
      const text = speakableText(raw);
      if (!text) {
        setState("idle");
        return;
      }

      cancelRef.current = false;
      setState("speaking");

      const parts = chunk(text).slice(0, 8); // ไม่อ่านยาวเกินไป
      // ดึงท่อนถัดไปล่วงหน้าระหว่างเล่นท่อนปัจจุบัน — ลดช่วงเงียบระหว่างท่อน
      let next = fetchTts(parts[0]);
      for (let i = 0; i < parts.length; i++) {
        if (cancelRef.current) break;
        const url = await next;
        next = i + 1 < parts.length ? fetchTts(parts[i + 1]) : Promise.resolve(null);
        if (cancelRef.current) break;
        if (url) await playUrl(url);
        else await browserSpeak(parts[i]);
      }

      releaseUrls();
      audioRef.current = null;
      if (cancelRef.current) {
        setState("idle");
        return;
      }
      // สนทนาต่อเนื่อง — พูดจบแล้วกลับไปฟังต่อเอง
      if (handsFreeRef.current) setTimeout(() => startListening(), 350);
      else setState("idle");
    },
    [fetchTts, startListening]
  );

  const toggleListening = useCallback(() => {
    if (state === "speaking") {
      stopSpeaking();
      return;
    }
    if (state === "listening") stopListening();
    else startListening();
  }, [state, startListening, stopListening, stopSpeaking]);

  /** เรียกเมื่อคำตอบมาครบ — พูดถ้าเปิด "ตอบด้วยเสียง" หรือคำถามมาจากเสียง */
  const onReply = useCallback(
    (reply: string, fromVoice: boolean) => {
      if (voiceReply || fromVoice) void speak(reply);
      else setState("idle");
    },
    [voiceReply, speak]
  );

  const setThinking = useCallback(() => setState("thinking"), []);

  useEffect(
    () => () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ปิดหน้าไปแล้ว */
      }
      cancelRef.current = true;
      audioRef.current?.pause();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ไม่รองรับ */
      }
      releaseUrls();
    },
    []
  );

  return {
    state,
    transcript,
    error,
    voiceReply,
    setVoiceReply,
    handsFree,
    setHandsFree,
    startListening,
    stopListening,
    stopSpeaking,
    toggleListening,
    speak,
    onReply,
    setThinking,
    clearError: () => setError(null),
  };
}
