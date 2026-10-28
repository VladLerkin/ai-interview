# 🎙️ AI Interview Simulator

> An advanced, interactive AI-powered technical and behavioral interview simulator combining agentic LangGraph workflows, real-time neural speech synthesis, audio-driven phonetic lip-sync, and 3D avatars.

[![Node.js](https://img.shields.io/badge/Node.js-26.8.2-339933.svg?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.5.3-1C3C3C.svg?logo=langchain&logoColor=white)](https://github.com/langchain-ai/langgraphjs)
[![React](https://img.shields.io/badge/React-19.3.1-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8.3.5-646CFF.svg?logo=vite&logoColor=white)](https://vite.dev)

## ✨ Features

- **Agentic Interview Workflow:** Powered by LangGraph, intelligently adapting questions and pacing across warm-up, technical deep-dive, behavioral, and wrap-up stages.
- **Interactive 3D Avatar:** Expressive VRM and GLB models featuring procedural breathing, eye contact, blinking, and natural micro-expressions.
- **Real-Time Voice & Lip-Sync:** Neural speech synthesis paired with audio-synchronized phonetic 3D facial articulation.
- **Multiple Interview Tracks:** Tailored simulation tracks for HR Screening, Technical Deep-Dive, System Design, Behavioral (STAR), or a Full Loop.
- **Resume-Driven Context:** Upload your CV (PDF) to ground the interview in your actual work experience and projects.
- **Instant Assessment & Feedback:** Live constructive feedback on each answer, including grammar, clarity, vocabulary tips, and recommended phrasing.
- **Multi-Provider & Multilingual:** Seamless integration with Google Gemini, OpenAI, Anthropic, or DeepSeek across 13 international languages.
- **Installable PWA:** Fast, mobile-first responsive layout ready for practice anytime on desktop and mobile.

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
- Node.js 26.8.2 (configured via `.nvmrc`)
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
