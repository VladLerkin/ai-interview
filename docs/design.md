# AI Interview Simulator - Architecture & Design

This document outlines the technical architecture, agentic AI workflow, phonetic lip-sync pipeline, and 3D rendering engine for the AI Interview Simulator.

---

## 1. System Architecture

The application is engineered as a high-performance single-page Progressive Web App (PWA) using React, Vite, Three.js, and Tailwind CSS. The system operates across three interconnected layers:
1. **Agentic Conversation Flow** (`@langchain/langgraph` + multi-provider LLM routing)
2. **Real-Time Speech & Serverless Audio** (Cloudflare Pages Functions native Edge TTS + Web Speech API)
3. **3D Interactive Avatar Engine** (Three.js, Oculus Visemes, Apple ARKit blendshapes, and procedural micro-animations)

```
┌─────────────────────────────────────────────────────────────┐
│                       Client (Browser)                      │
│                                                             │
│   ┌────────────────────┐         ┌──────────────────────┐   │
│   │  LangGraph Engine  │ ◄─────► │  Audio & STT/TTS     │   │
│   │ (State Machine)    │         │  (SpeechSync)        │   │
│   └─────────┬──────────┘         └──────────┬───────────┘   │
│             │                               │               │
│             ▼                               ▼               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │         AvatarCanvas (Three.js 60fps Loop)          │   │
│   │    - Procedural Head & Breathing Bones              │   │
│   │    - Oculus Visemes + ARKit Lip-Sync Blendshapes    │   │
│   │    - Emotional Expressions & Natural Blinking       │   │
│   └─────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────┘
                               │ /api/tts (Binary Audio Stream)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Cloudflare Pages Serverless Proxy               │
│         Native WebSocket binary stream to Edge TTS          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Agentic Workflow (LangGraph)

The conversation state is orchestrated via a deterministic state machine built on `@langchain/langgraph`:

- **`evaluateAnswerNode`**: Executes at `temperature: 0` to score candidate answers (1–10), analyze grammar and tone, suggest vocabulary improvements, and synthesize an ideal candidate response.
- **`routeNextStageNode`**: Dynamically transitions through interview phases (`warmup` → `technical_deepdive` → `behavioral` → `wrapup`) based on exchange count, candidate performance, and configured interview mode.
- **`formulateQuestionNode`**: Produces natural, concise interviewer questions matching the candidate's background, language locale, and current interview context.

### Multilingual Prompts
System prompts enforce strict cultural and script consistency:
- Non-Latin languages (e.g. Georgian `მხედრული`, Russian Cyrillic, Chinese, Japanese) never mix raw English terms into spoken replies (e.g. "Junior Java Developer" is naturally translated or transliterated).

---

## 3. 3D Avatar Engine & Facial Rigging

The visual presentation is powered by `AvatarCanvas.tsx` utilizing Three.js and standard GLTF/GLB models (MetaPerson / ReadyPlayerMe) as well as VRM specifications.

### Animation & Rigging Pipeline (60 FPS)
1. **Breathing**: Sine-wave rotational modulation on the normalized `spine` bone.
2. **Head Micro-Movements**: Procedural head drifting and gentle speaking nods synchronized with voice activity.
3. **Natural Blinking**: Randomized blink timers with simulated human double-blinks driving `eyeBlinkLeft` and `eyeBlinkRight`.
4. **Adaptive Camera Framing**:
   - **Desktop Layout (`w >= 768px`)**: Camera distance `0.65`, framed at head bone center.
   - **Mobile Portrait Layout (`w < 768px`)**: Camera distance `0.95`, focal target aligned horizontally at eye level (`headPos.y + 0.01`). This prevents close-up polygon stretching, eliminates hair parting scalp transparency, and provides comfortable headroom above subtitles.

---

## 4. Advanced Phonetic Lip-Sync Pipeline

Unlike simple volume-envelope jaw flapping, the simulator uses a multi-tier phonetic synthesis engine:

### 1. Phonetic Timeline Synchronization (`SpeechVisemeTracker`)
- Synchronizes with the exact audio duration (`audio.duration`).
- Open vowels (`a, o, u, e, i`) receive a **2.3x duration weight** over rapid consonants, guaranteeing that lip shapes fully form and hold long enough for the human eye to perceive.

### 2. ARKit + Oculus Viseme Integration
- **Vowel Shapes**: Oculus visemes (`aa`, `E`, `ih`, `oh`, `ou`).
- **Expressive Lip Rounding ("Трубочка")**: Calibrated `mouthPucker` (`ou * 0.55 + oh * 0.20`) and `mouthFunnel` (`oh * 0.50 + ou * 0.22`) produce natural "O" and "U" lip rounding without duck-face distortion.
- **Upper Lip Mobility**: Subtle lifts via `mouthUpperUpLeft/Right` and `mouthShrugUpper` keep the upper lip dynamic during open vowels.
- **Natural Tooth Concealment**: Lower tooth exposure is kept realistic by softening wide smile tension (`smileFactor = 1.0` when idle, `0.35` when speaking) and gently elevating the lower lip with `mouthShrugLower`.

### 3. CJK & Japanese Kana Prosody Engine
Chinese (Hanzi) and Japanese (Kanji/Kana) do not use space delimiters. The engine handles East Asian speech through:
- **Full-Width Punctuation**: Characters `。`, `！`, `？` trigger full closing pauses (260ms), while `，`, `、`, `：` trigger clause pauses (130ms).
- **Prosodic Phrasing**: Character sequences are split into natural 1–2 character words with 30ms micro-pauses.
- **3-Phase Syllabic Decomposition**:
  1. *Consonant Attack (25%)*: Bilabials (`m, b, p`, `ま, ば, ぱ`, `不, 们, 面`) trigger `VISEME_CLOSED` (lips touch); sibilants (`s, z, sh, ch`, `さ, す`, `是, 试`) trigger `VISEME_DENTAL`.
  2. *Vowel Nucleus (55%)*: Expands to target vowel (`AH`, `EE`, `OO`, `WIDE`, `OH`).
  3. *Release Coda (20%)*: Relaxes smoothly or closes on nasals (`ん`, `n`, `ng`).

---

## 5. Serverless Speech Synthesis (Edge TTS)

High-fidelity neural voices are served with zero third-party subscriptions:

- **Cloudflare Pages Function (`functions/api/tts.ts`)**:
  - Connects directly to Microsoft Edge neural TTS endpoints via outbound WebSocket.
  - Aggregates binary MPEG audio chunks and streams MP3 data directly to the browser.
  - Provides natural neural voices across 12 locales:
    - 🇺🇸 `en-US-AvaNeural`
    - 🇬🇧 `en-GB-SoniaNeural`
    - 🇷🇺 `ru-RU-SvetlanaNeural`
    - 🇪🇸 `es-ES-XimenaNeural`
    - 🇩🇪 `de-DE-KatjaNeural`
    - 🇫🇷 `fr-FR-DeniseNeural`
    - 🇨🇳 `zh-CN-XiaoxiaoNeural`
    - 🇯🇵 `ja-JP-NanamiNeural`
    - 🇬🇪 `ka-GE-EkaNeural`
    - 🇹🇷 `tr-TR-EmelNeural`
    - 🇮🇱 `he-IL-HilaNeural`
    - 🇮🇹 `it-IT-ElsaNeural`
- **Fallback**: Automatically falls back to native browser `SpeechSynthesis` if network is unavailable.

---

## 6. Mobile & Responsive Layout Architecture

The user interface automatically adapts between desktop workstations and mobile devices:

- **Desktop (Multi-Column Stage)**:
  - Left Sidebar: Suggested Answer panel (`lg:w-80`).
  - Center Hero: 3D interactive avatar and speech interaction controls.
  - Right Sidebar: Live feedback, score breakdown, and vocabulary tips (`md:w-96`).
- **Mobile (`< 768px`)**:
  - **Full-Height Focus (`h-[calc(100dvh-1rem)]`)**: The primary view is completely dedicated to the interviewer avatar (`flex-1 min-h-0`) and the response action bar (`h-28`).
  - **Unblocked Articulation**: The speech subtitle box uses compact `text-base` typography positioned cleanly below the avatar's chin.
  - **Touch-Friendly Controls**: Answer textarea features `16px` font size (preventing mobile iOS auto-zoom) and enlarged touch buttons.
  - **Below-the-Fold Panels**: Suggested answers and live feedback are placed below the initial viewport, accessible via a smooth downward swipe without cluttering the interview session.
