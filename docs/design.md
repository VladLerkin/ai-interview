# AI Interview Simulator - Architecture & Design

This document outlines the high-level architecture, the agentic AI workflow, and the 3D rendering pipeline for the AI Interview Simulator.

## 1. System Architecture

The application is built as a single-page Progressive Web App (PWA) using React, Vite, and Tailwind CSS. The core logic is split into two main domains:
1. **Agentic Conversation Flow** (LangChain / LangGraph)
2. **Immersive 3D Experience** (Three.js / React Three Fiber)

### State Management
The interview state is managed via an active LangGraph state object (`InterviewState`). This state tracks:
- The candidate's resume and job description.
- The current stage of the interview (e.g., `warmup`, `technical_deepdive`).
- Chat history.
- The most recent feedback and grammar assessment.

## 2. Agentic Workflow (LangGraph)

The AI logic uses a deterministic state machine powered by `@langchain/langgraph` and is split into modular components within `src/agent/`:
- **`llm.ts`**: Handles instantiation of LLM providers (Google Gemini, OpenAI, Anthropic, and DeepSeek) based on user configuration.
- **`prompts.ts`**: Contains the system prompts and behavior guidelines for various interview stages.
- **`stages.ts`**: Defines the routing logic for progressing the interview based on exchange count and selected interview type.
- **`interviewGraph.ts`**: The core state machine orchestrating the workflow:
  - **`evaluateAnswerNode`**: Uses a strictly typed prompt with `temperature=0` to evaluate the candidate's last answer, correcting grammar, scoring content, and generating an ideal concise response.
  - **`routeNextStageNode`**: Progresses the interview through predefined stages.
  - **`formulateQuestionNode`**: Synthesizes a highly conversational, concise follow-up question or response.

## 3. 3D Rendering & Animation (AvatarCanvas)

The visual representation of the AI is handled by `AvatarCanvas.tsx`.

### Model Support
- **VRM Models**: Fully supported utilizing `@pixiv/three-vrm`. 
- **GLB/GLTF Models**: Supported natively. The script automatically traverses the scene graph to identify standard humanoid bones (e.g., `head`, `spine`, `jaw`) and extracts `morphTargetDictionary` references for ARKit blendshapes.

### Animation Pipeline
The animation loop runs at 60fps via `useFrame`:
1. **Breathing**: A subtle sine-wave rotation is applied to the `spine` bone.
2. **Head Micro-Movements**: Continuous procedural nodding and head rotation add life to the avatar.
3. **Blinking**: Randomized blinking sequences with double-blink probabilities are applied to the `eyeBlink` or VRM blink blendshapes.
4. **Emotions**: Emotional state (Neutral, Happy, Thinking, Smirk) dictates the weights of facial blendshapes (like `mouthSmile`, `browInnerUp`).
5. **Lip Sync**: The system maps visemes (aa, ee, ih, oh, ou) dynamically. When the avatar speaks, an array of weighted visemes is triggered procedurally in sync with the Web Speech API. Fallbacks are included for Apple ARKit blendshapes (e.g., `mouthPucker`, `mouthFunnel`).

### Camera Framing
Dynamic framing logic calculates the precise world position of the `head` bone to ensure the camera tracks the avatar seamlessly across different model sizes and proportions.

## 4. Speech Integration

- **Speech-to-Text (STT)**: Uses the native `SpeechRecognition` API for real-time transcription.
- **Text-to-Speech (TTS)**: Utilizes `window.speechSynthesis`. Safari/macOS quirks (like `onend` freezing) are bypassed by initializing the speech engine via a silent utterance during a trusted user interaction event (e.g., clicking "Start").
