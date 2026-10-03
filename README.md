# AI Interview Simulator

An advanced, interactive AI-powered technical and behavioral interview simulator. The application combines agentic LLM workflows (LangGraph), real-time speech recognition and synthesis (Web Speech API), and 3D avatars (Three.js/React Three Fiber) to create a lifelike interviewing experience.

## Features
- **Dynamic AI Interviewer:** Powered by LangGraph, the AI intelligently routes between interview stages (warm-up, technical deep-dive, behavioral, wrap-up).
- **Multiple Providers:** Support for OpenAI (GPT-4o-Mini), Anthropic (Claude 3 Haiku), Google Gemini (Gemini 3.8 Flash), and DeepSeek.
- **Multiple Interview Modes:** Choose from HR Screening, Technical Deep Dive, System Design, Behavioral (STAR), or a Full Loop.
- **3D Interactive Avatars:** Supports VRM and GLB (MetaPerson/ARKit) models with procedural breathing, eye blinking, gaze tracking, lip sync, and emotional micro-expressions.
- **Real-Time Speech:** Talk to the AI using your microphone. The AI answers back with varied voice intonation.
- **Multilingual Support (i18n):** User interface and AI spoken responses automatically adapt to English (US/UK), Russian, and German.
- **Resume Parsing:** Upload your CV (PDF), and the AI will extract your background and ask contextualized questions.
- **Live Feedback & Assessment:** The AI continuously evaluates your responses, offering grammar corrections, vocabulary suggestions, and an "ideal" suggested answer in the side panel.
- **Progressive Web App (PWA):** Installable on mobile devices with an optimized responsive layout that prevents scrolling bugs on mobile Safari/Chrome.

## Getting Started

### Prerequisites
- Node.js 18+
- API Key from Gemini (Google), OpenAI, or Anthropic.

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5174` in your browser.

## Project Structure

```
src/
├── main.tsx                        # Entry point — renders <App />
├── App.tsx                         # Root component, manages config state & routing
├── index.css                       # Global styles, Tailwind theme, glass-panel utility
│
├── types/
│   └── interview.ts                # Shared types: InterviewType, InterviewConfig
│
├── components/
│   ├── SetupModal.tsx              # Setup wizard (interview type picker + details form)
│   ├── InterviewRoom.tsx           # Main interview screen (speech, subtitles, feedback panel)
│   └── AvatarCanvas.tsx            # 3D avatar renderer (Three.js, VRM/GLB, lip sync, emotions)
│
├── agent/
│   ├── interviewGraph.ts           # LangGraph state machine (evaluate → route → question)
│   ├── llm.ts                      # LLM provider initialization (OpenAI, Anthropic, Gemini, DeepSeek)
│   ├── prompts.ts                  # System prompts for various interview stages
│   └── stages.ts                   # Interview stage routing logic
│
└── lib/
    ├── pdf.ts                      # PDF text extraction via pdfjs-dist
    ├── store.ts                    # IndexedDB persistence wrapper (idb)
    └── i18n.ts                     # Localization dictionary and translation utility

public/
├── avatar.vrm                     # Default VRM avatar model
├── avatar.glb                     # GLB avatar model (Business Woman)
└── favicon.svg                    # App favicon
```

## Design and Architecture
For a deep dive into the technical architecture, state management, and 3D rendering pipeline, please read the [Design Document](./docs/design.md).
