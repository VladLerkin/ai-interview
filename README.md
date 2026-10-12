# AI Interview Simulator

An advanced, interactive AI-powered technical and behavioral interview simulator. The application combines agentic LLM workflows (LangGraph), real-time neural speech synthesis (Edge TTS via Cloudflare Functions), audio-driven phonetic lip-sync, and 3D avatars (Three.js/ReadyPlayerMe/VRM) to create a lifelike interviewing experience.

## Features
- **Dynamic AI Interviewer:** Powered by LangGraph, the AI intelligently routes between interview stages (warm-up, technical deep-dive, behavioral, wrap-up).
- **Multiple LLM Providers:** Support for OpenAI (GPT-4o-Mini), Anthropic (Claude 3 Haiku), Google Gemini (Gemini 3.8 Flash), and DeepSeek.
- **Multiple Interview Modes:** Choose from HR Screening, Technical Deep Dive, System Design, Behavioral (STAR), or a Full Loop.
- **3D Interactive Avatars:** Supports VRM and GLB (MetaPerson/ARKit) models with procedural breathing, eye blinking, gaze tracking, lip sync, and emotional micro-expressions.
- **Advanced Phonetic Lip-Sync:** 
  - Dynamic vowel-weighted articulation with calibrated "O" and "U" lip rounding (`mouthPucker` / `mouthFunnel`).
  - Organic upper lip mobility (`mouthUpperUp`, `mouthShrugUpper`).
  - Full CJK prosody engine for Chinese and Japanese (3-phase syllabic attack/nucleus/coda decomposition, Hiragana/Katakana phonetic mapping, and CJK full-width punctuation pauses).
- **Studio-Quality Neural Voices:** Powered by Microsoft Edge TTS via native Cloudflare Pages serverless functions with zero external latency or paid TTS dependencies.
- **Comprehensive Multilingual Support (i18n):** Complete UI localization, system prompts, and native neural voices across 13 international languages and accents.
- **Mobile-First Responsive UX (PWA):**
  - Full-viewport mobile layout (`h-[100dvh]`) prioritizing avatar presence and conversation flow.
  - Ergonomic answer input box with enlarged text (`16px`) and touch-friendly controls.
  - Smart camera framing (`0.95` focal distance at eye level) to prevent polygon clipping and hair parting transparency.
  - Distraction-free interview session: Suggested answers and live feedback are tucked neatly below the fold on mobile screens.
- **Resume Parsing:** Upload your CV (PDF), and the AI will extract your background and ask contextualized questions.
- **Live Feedback & Assessment:** The AI continuously evaluates your responses, offering grammar corrections, vocabulary suggestions, and an "ideal" suggested answer.

## Tech Stack & Versions

| Category | Technology / Package | Version | Purpose |
|:---|:---|:---:|:---|
| **Frontend Framework** | **React** / **React DOM** | `^19.2.8` | Modern declarative component tree & hooks architecture |
| **Language & Typings** | **TypeScript** | `^7.0.2` | Strict compile-time type verification & AST builds |
| **Build Tool & Bundler** | **Vite** | `^8.3.0` | High-speed ESM development server and Rollup/Rolldown production builds |
| **Styling & Design System** | **Tailwind CSS** | `^4.3.3` | Next-gen zero-runtime utility-first CSS styling (`@tailwindcss/vite`) |
| **PWA & Offline Cache** | **vite-plugin-pwa** | `^2.0.0` | Progressive Web App manifest, service worker lifecycle, and Workbox caching |
| **3D Graphics & Scene** | **Three.js** | `^0.186.1` | WebGL 60 FPS rendering, lighting, camera transforms, and skeletal rigging |
| **Avatar Format Support** | **@pixiv/three-vrm** | `^3.5.5` | Humanoid VRM 0.x/1.0 model loader, blendshape proxies, and spring bones |
| **Agentic AI Workflow** | **@langchain/langgraph** | `^1.4.18` | StateGraph cyclical state machine for multi-stage interview steering & scoring |
| **LLM Core Framework** | **@langchain/core** | `^1.2.14` | Message primitives (`AIMessage`, `HumanMessage`, `SystemMessage`) and runnables |
| **LLM Provider SDKs** | **@langchain/google-genai** | `^2.3.2` | Google Gemini 3.8 Flash / 1.5 Flash client |
| | **@langchain/openai** | `^1.6.1` | OpenAI GPT-4o-Mini and DeepSeek Chat (custom `baseURL`) |
| | **@langchain/anthropic** | `^1.5.11` | Anthropic Claude 3 Haiku client |
| **Neural TTS (Dev Server)** | **msedge-tts** | `^2.0.9` | Local Vite proxy for Microsoft Edge Neural Speech synthesis |
| **Serverless TTS (Cloud)** | **Cloudflare Pages Functions** | Native | Serverless Edge TTS WebSocket proxy (`functions/api/tts.ts`) with retry logic |
| **Audio & Phonetics** | **Web Audio API** | Native | Real-time `AudioContext` & FFT `AnalyserNode` frequency formant analysis |
| **Speech Recognition (STT)**| **Web Speech API** | Native | Browser-native `SpeechRecognition` microphone transcript streaming |
| **PDF Document Parser** | **pdfjs-dist** | `^6.3.289` | Client-side resume parsing directly in browser worker thread |
| **Client Storage** | **idb** | `^8.0.3` | Promise-based IndexedDB storage for state, resumes, and session recovery |
| **Icons** | **lucide-react** | `^1.49.0` | Crisp UI icons |
| **Linter & Code Quality** | **oxlint** | `^1.81.0` | Ultra-fast Rust-based linter |
| **Serverless Runtime** | **Node.js** (`@types/node`) | `^26.6.5` (Local: `v26.8.2`) | Local execution environment and typing definitions |

## Supported Languages & Voices

The simulator provides full UI localization, tailored LLM prompt instructions, and natural female neural voices for each supported language:

| Flag | Language (English) | Native Name | Code |
|:---:|:---|:---|:---:|
| 🇺🇸 | **English (American)** | American English | `en-US` |
| 🇬🇧 | **English (British)** | British English | `en-GB` |
| 🇷🇺 | **Russian** | Русский | `ru-RU` |
| 🇪🇸 | **Spanish** | Español | `es-ES` |
| 🇮🇹 | **Italian** | Italiano | `it-IT` |
| 🇩🇪 | **German** | Deutsch | `de-DE` |
| 🇫🇷 | **French** | Français | `fr-FR` |
| 🇬🇷 | **Greek** | Ελληνικά | `el-GR` |
| 🇹🇷 | **Turkish** | Türkçe | `tr-TR` |
| 🇮🇱 | **Hebrew** | עברית | `he-IL` |
| 🇬🇪 | **Georgian** | ქართული | `ka-GE` |
| 🇨🇳 | **Chinese (Simplified)** | 中文 (普通话) | `zh-CN` |
| 🇯🇵 | **Japanese** | 日本語 | `ja-JP` |

## Getting Started

### Prerequisites
- Node.js 18+
- API Key from Google Gemini, OpenAI, Anthropic, or DeepSeek.

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Start the local development server (includes local Edge TTS proxy):
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5174` in your browser.

### Cloudflare Pages Deployment
The project is built for zero-config deployment on Cloudflare Pages:
```bash
npm run build
npx wrangler pages deploy dist
```
The serverless Edge TTS proxy runs natively via Cloudflare Pages Functions located in `functions/api/tts.ts`.

## Project Structure

```
├── functions/
│   └── api/
│       └── tts.ts                  # Cloudflare Pages Functions native Edge TTS proxy
├── public/
│   ├── avatar.vrm                  # VRM avatar model
│   ├── avatar.glb                  # High-fidelity GLB avatar model (Business Woman)
│   └── favicon.svg                 # App favicon
├── src/
│   ├── main.tsx                    # React application entry point
│   ├── App.tsx                     # Root component managing setup and interview rooms
│   ├── index.css                   # Global design system, Tailwind utilities, glassmorphism
│   │
│   ├── types/
│   │   └── interview.ts            # Type definitions (InterviewType, Language, Provider, Config)
│   │
│   ├── config/
│   │   └── languages.ts            # Supported languages registry and metadata
│   │
│   ├── components/
│   │   ├── SetupModal.tsx          # Configuration wizard (type selection, provider, language, CV upload)
│   │   ├── interview/              # Modular interview UI
│   │   │   ├── InterviewRoom.tsx   # Main interview room orchestrator
│   │   │   ├── InterviewerStage.tsx# 3D Avatar stage container
│   │   │   └── AnswerBar.tsx       # Transcript and microphone controls
│   │   └── avatar/                 # 3D Avatar Engine
│   │       ├── AvatarCanvas.tsx    # Three.js canvas setup
│   │       ├── faceAnimator.ts     # Lip-sync & expression engine
│   │       ├── rigs.ts             # ARKit & VRM morph targets
│   │       └── visemes.ts          # Phonetic viseme maps
│   │
│   ├── agent/
│   │   ├── interviewGraph.ts       # LangGraph state machine (evaluate → route → formulate question)
│   │   ├── llm.ts                  # Multi-provider LLM client setup
│   │   ├── prompts.ts              # Stage prompts & multilingual guidelines (Georgian script, etc.)
│   │   └── stages.ts               # Routing logic across interview phases
│   │
│   └── lib/
│       ├── audio/
│       │   ├── edgeTtsClient.ts     # Edge TTS client with duration sync
│       │   ├── speechVisemeTracker.ts # Phonetic timeline tracker (Latin, Cyrillic, Georgian, CJK)
│       │   └── types.ts            # Phonetic viseme models and weights
│       ├── pdf.ts                  # PDF resume parser using pdfjs-dist
│       ├── store.ts                # IndexedDB client cache wrapper
│       └── i18n.ts                 # Full localization dictionaries (en, ru, es, de, fr, el, zh, ja, ka, tr, it, he)
└── docs/
    └── design.md                   # Detailed architecture, lip-sync, and rendering design
```

## Design and Architecture
For a deep dive into the technical architecture, state management, phonetic lip-sync pipeline, and mobile viewport optimizations, please read the [Design Document](./docs/design.md).
