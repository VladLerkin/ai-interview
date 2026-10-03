import {
  VISEME_AH,
  VISEME_CLOSED,
  VISEME_DENTAL,
  VISEME_EE,
  VISEME_IH,
  VISEME_OH,
  VISEME_OO,
  VISEME_SILENCE,
  VISEME_WIDE,
  type Viseme,
} from './types';

interface TimedViseme {
  viseme: Viseme;
  startMs: number;
  endMs: number;
}

/**
 * Universal character-to-viseme mapping covering:
 * English, Spanish, Russian, Georgian, French, German, and common international phonemes.
 */
/**
 * Universal character-to-viseme mapping covering:
 * English, Spanish, Russian, Georgian, French, German, and common international phonemes.
 */
function charToViseme(char: string): Viseme {
  const c = char.toLowerCase();

  // 1. Bilabials (lips completely touch / close)
  if (['m', 'b', 'p', 'м', 'б', 'п', 'მ', 'ბ', 'პ', 'ფ'].includes(c)) {
    return VISEME_CLOSED;
  }

  // 2. Open back vowels (/a/, /ah/)
  if (['a', 'á', 'à', 'â', 'ä', 'а', 'я', 'ა'].includes(c)) {
    return VISEME_AH;
  }

  // 3. Rounded back vowels (/o/, /oh/)
  if (['o', 'ó', 'ò', 'ô', 'ö', 'о', 'ё', 'ო'].includes(c)) {
    return VISEME_OH;
  }

  // 4. Puckered closed vowels (/u/, /oo/, /w/)
  if (['u', 'ú', 'ù', 'û', 'ü', 'w', 'у', 'ю', 'უ'].includes(c)) {
    return VISEME_OO;
  }

  // 5. Front spread vowels (/e/, /eh/)
  if (['e', 'é', 'è', 'ê', 'ë', 'е', 'э', 'ე'].includes(c)) {
    return VISEME_WIDE;
  }

  // 6. High front vowels (/i/, /ee/)
  if (['i', 'í', 'ì', 'î', 'ï', 'y', 'и', 'ი'].includes(c)) {
    return VISEME_EE;
  }

  // 7. Neutral central vowel (/ih/, /ы/)
  if (['ы'].includes(c)) {
    return VISEME_IH;
  }

  // 8. Dental / Fricative consonants (/f/, /v/, /s/, /z/, etc. — teeth touch / slight smile)
  if ([
    'f', 'v', 's', 'z', 'c', 'x',
    'в', 'ф', 'с', 'з', 'ц', 'ш', 'щ', 'ж',
    'ს', 'ზ', 'ც', 'ძ', 'წ', 'შ', 'ჟ', 'ჩ', 'ჯ', 'ჭ'
  ].includes(c)) {
    return VISEME_DENTAL;
  }

  // 9. Alveolar / Lingual consonants (/t/, /d/, /n/, /l/, /r/, /k/, /g/, etc. — slight wide opening)
  if ([
    't', 'd', 'n', 'l', 'r', 'k', 'g', 'h', 'j', 'q',
    'д', 'т', 'н', 'л', 'р', 'к', 'г', 'х', 'ч',
    'დ', 'თ', 'ნ', 'ლ', 'რ', 'კ', 'გ', 'ხ', 'ყ', 'ღ'
  ].includes(c)) {
    return VISEME_WIDE;
  }

  // Default fallback for other letters
  return VISEME_AH;
}

/** Check if character belongs to CJK (Hanzi, Kanji, Hiragana, Katakana, Hangul) */
export function isCJKChar(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs (Kanji/Hanzi)
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0x3040 && code <= 0x309f) || // Hiragana
    (code >= 0x30a0 && code <= 0x30ff) || // Katakana
    (code >= 0xac00 && code <= 0xd7af)    // Hangul Syllables
  );
}

interface SyllableVisemes {
  onset: Viseme;
  nucleus: Viseme;
  coda: Viseme;
}

/**
 * Resolves Japanese Hiragana and Katakana characters into full syllabic viseme structure.
 * Accurately models bilabials (m/b/p close lips), sibilants/dentals (s/z/t/d), and vowels (a/i/u/e/o).
 */
function getJapaneseKanaVisemes(char: string): SyllableVisemes | null {
  const c = char;

  // 1. Nasal syllabic mora "ん" / "ン" (bilabial/uvular nasal closure: lips completely touch)
  if (c === 'ん' || c === 'ン') {
    return { onset: VISEME_CLOSED, nucleus: VISEME_CLOSED, coda: VISEME_CLOSED };
  }
  // 2. Sokuon "っ" / "ッ" (glottal stop / geminate closure: lips pause closed)
  if (c === 'っ' || c === 'ッ') {
    return { onset: VISEME_CLOSED, nucleus: VISEME_SILENCE, coda: VISEME_CLOSED };
  }
  // 3. Chōonpu "ー" (long vowel prolongation: open)
  if (c === 'ー') {
    return { onset: VISEME_AH, nucleus: VISEME_AH, coda: VISEME_AH };
  }

  // A-row vowels
  if (/[あかがさざただなはばぱまやらわアカガサザタダナハバパマヤラワぁァゃャゎヮ]/.test(c)) {
    const isBilabial = /[まばぱマバパ]/.test(c);
    const isDental = /[さざただサザタダ]/.test(c);
    const onset = isBilabial ? VISEME_CLOSED : isDental ? VISEME_DENTAL : VISEME_WIDE;
    return { onset, nucleus: VISEME_AH, coda: isBilabial ? VISEME_CLOSED : VISEME_DENTAL };
  }

  // I-row vowels
  if (/[いきぎしじちぢにひびぴみりイキギシジチヂニヒビピミリぃィ]/.test(c)) {
    const isBilabial = /[みびぴミビピ]/.test(c);
    const isDental = /[しじちぢシジチヂ]/.test(c);
    const onset = isBilabial ? VISEME_CLOSED : isDental ? VISEME_DENTAL : VISEME_WIDE;
    return { onset, nucleus: VISEME_EE, coda: VISEME_EE };
  }

  // U-row vowels
  if (/[うくぐすずつづぬふぶぷむゆるヴウクグスズツヅヌフブプムユルぅゥゅュ]/.test(c)) {
    const isBilabial = /[むぶぷふムブプフ]/.test(c);
    const isDental = /[すずつづスズツヅ]/.test(c);
    const onset = isBilabial ? VISEME_CLOSED : isDental ? VISEME_DENTAL : VISEME_OO;
    return { onset, nucleus: VISEME_OO, coda: VISEME_OO };
  }

  // E-row vowels
  if (/[えけげせぜてでねへべぺめれエケゲセゼテデネヘベペメレぇェ]/.test(c)) {
    const isBilabial = /[めべぺメベペ]/.test(c);
    const isDental = /[せぜてでセゼテデ]/.test(c);
    const onset = isBilabial ? VISEME_CLOSED : isDental ? VISEME_DENTAL : VISEME_WIDE;
    return { onset, nucleus: VISEME_WIDE, coda: VISEME_WIDE };
  }

  // O-row vowels
  if (/[おこごそぞとどのほぼぽもよろをごゾドボポモヨロヲオコゴソゾトドノホボポモヨロヲぉォょョ]/.test(c)) {
    const isBilabial = /[もぼぽモボポ]/.test(c);
    const isDental = /[そぞとどソゾトド]/.test(c);
    const onset = isBilabial ? VISEME_CLOSED : isDental ? VISEME_DENTAL : VISEME_OH;
    return { onset, nucleus: VISEME_OH, coda: VISEME_OH };
  }

  return null;
}

/**
 * Resolves Chinese Hanzi and Japanese Kanji ideograms into syllabic visemes (onset + nucleus + coda).
 * Maps common vocabulary to true phonetics, and applies deterministic acoustic distribution for unlisted ideograms.
 */
function getChineseOrKanjiVisemes(char: string): SyllableVisemes {
  const c = char;

  // 1. Initial Consonant: Bilabial (b, p, m -> lips touch completely)
  const isBilabial = /[不把被百白帮变步本别比办半表并包朋跑评培旁拼配平票派们没么买卖面明明美慢忙迷免密某普标报部抱保备北杯倍笔闭病播文母木目物模]/.test(c);
  // 2. Initial Consonant: Dental sibilants / retroflex (s, z, c, sh, zh, ch, r, j, q, x -> teeth together)
  const isDental = /[是时十事试视使生上水少深谁书说四死思算岁次此从存自子字总走做作在再最张长找这知只直职制治正真中重出初场常超车成持发放反方非分风复服先下想小些新信心情请全去前期七起确查柴产成城答听定代]/.test(c);

  const onset: Viseme = isBilabial ? VISEME_CLOSED : isDental ? VISEME_DENTAL : VISEME_WIDE;

  // 3. Vowel Nucleus
  let nucleus: Viseme = VISEME_AH;
  let coda: Viseme = VISEME_DENTAL;

  if (/[大他她它拿抓发答查加下家话吗吧那卡差打拉八花爸法放帮当常场长张想样向相方上映完关看南难三再在带快开来百白海拍排买卖柴台太菜谈单站战]/.test(c)) {
    nucleus = VISEME_AH;
  } else if (/[我多说说过做作错走候后头手口狗够国活破模佛工公共中同动重空通总东懂红落弱桌左右都收受首透流楼友又有手容送]/.test(c)) {
    nucleus = VISEME_OH;
    coda = VISEME_OH;
  } else if (/[出如入书读猪主住路哭苦录去句需语女律绿雨许树数图租足复服目木物步部除处取初母注组普福互户粗]/.test(c)) {
    nucleus = VISEME_OO;
    coda = VISEME_OO;
  } else if (/[的了和得特者这车设热色给北飞别些接业也介更很本分正真成深门们问跟能等生声文什么社美每内类黑杯备倍则策测]/.test(c)) {
    nucleus = VISEME_WIDE;
  } else if (/[你一几期起喜西系细机题李气进金新心信请听定经精明星行情平名清迎并民近今引音品您密迷比必低弟提易异]/.test(c)) {
    nucleus = VISEME_EE;
    coda = VISEME_EE;
  } else if (/[是时十事试视使死四思次此字自子知只指直职治吃日刺司私持迟池芝师]/.test(c)) {
    nucleus = VISEME_IH;
  } else {
    // Balanced acoustic distribution for any unlisted ideogram
    const code = c.charCodeAt(0);
    const vowels = [VISEME_AH, VISEME_OH, VISEME_OO, VISEME_WIDE, VISEME_EE];
    nucleus = vowels[code % vowels.length];
    if (nucleus === VISEME_OH || nucleus === VISEME_OO) {
      coda = nucleus;
    }
  }

  // Nasal / bilabial word endings (e.g. 们, 面, 门, etc.) close at the end
  if (/[们面门民品]/.test(c)) {
    coda = VISEME_CLOSED;
  }

  return { onset, nucleus, coda };
}

/**
 * Universal CJK syllable resolver (Kana + Hanzi/Kanji).
 */
function getCJKVisemeSyllable(char: string): SyllableVisemes {
  const kana = getJapaneseKanaVisemes(char);
  if (kana) return kana;
  return getChineseOrKanjiVisemes(char);
}

/**
 * Tracks speech and creates a synchronized timeline of Visemes matching spoken words and syllables.
 * Works seamlessly with both Web Speech API (boundary events) and Audio playback (Edge TTS).
 */
export class SpeechVisemeTracker {
  private queue: TimedViseme[] = [];
  private active = false;
  private speechStartTimestamp = 0;
  private plannedDurationMs = 0;

  /** Resets queue when speech begins or ends */
  reset(): void {
    this.queue = [];
    this.active = false;
    this.speechStartTimestamp = 0;
    this.plannedDurationMs = 0;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.reset();
    }
  }

  /**
   * Builds and schedules a full phonetic timeline for an entire utterance text.
   * Synchronizes syllables to the actual audio duration (in seconds).
   * Fully supports European, Cyrillic, Georgian, and CJK (Chinese & Japanese) prosody.
   */
  startSpeech(text: string, durationSec?: number): void {
    this.reset();
    if (!text || !text.trim()) return;

    this.active = true;
    const now = performance.now();
    this.speechStartTimestamp = now;

    // Split text into tokens including Western and CJK punctuation
    const tokens = text.match(/[^\s.,!?;:…。，、！？：；~—–\-]+|[.,!?;:…。，、！？：；~—–\-]+/g) || [text];
    
    // First pass: compute nominal durations
    interface TokenStep {
      chars: string;
      isPause: boolean;
      nominalMs: number;
    }

    const steps: TokenStep[] = [];
    let totalNominalMs = 0;

    for (const token of tokens) {
      if (/^[.,!?;:…。，、！？：；~—–\-]+$/.test(token)) {
        // Punctuation pause (full stop vs comma/clause)
        const isSentenceEnd = /[.!?。！？]/.test(token);
        const pauseMs = isSentenceEnd ? 260 : 130;
        steps.push({ chars: '', isPause: true, nominalMs: pauseMs });
        totalNominalMs += pauseMs;
      } else {
        const cleanChars = token.trim();
        if (!cleanChars) continue;

        const charList = Array.from(cleanChars);
        const hasCJK = charList.some(isCJKChar);

        if (hasCJK) {
          // Chinese and Japanese lack space delimiters.
          // Dissect into 1-2 character prosodic words with micro-pauses between them.
          let i = 0;
          while (i < charList.length) {
            let chunkLen = 2;
            const c1 = charList[i];
            if (/[はがをにへとでものばかやよっッ]/.test(c1) && i > 0) {
              chunkLen = 1;
            } else if (i + 1 === charList.length) {
              chunkLen = 1;
            }

            const chunk = charList.slice(i, i + chunkLen).join('');
            i += chunkLen;

            // Spoken CJK syllable nominally ~160ms
            const chunkMs = chunk.length * 160;
            steps.push({ chars: chunk, isPause: false, nominalMs: chunkMs });
            totalNominalMs += chunkMs;

            // Inter-phrase micro-pause (mouth slightly relaxes / closes)
            if (i < charList.length) {
              steps.push({ chars: '', isPause: true, nominalMs: 30 });
              totalNominalMs += 30;
            }
          }
        } else {
          // Latin / Cyrillic / Georgian words (space delimited)
          const wordMs = Math.max(120, cleanChars.length * 65);
          steps.push({ chars: cleanChars, isPause: false, nominalMs: wordMs });
          totalNominalMs += wordMs;

          // Small inter-word pause
          steps.push({ chars: '', isPause: true, nominalMs: 35 });
          totalNominalMs += 35;
        }
      }
    }

    if (steps.length === 0) return;

    // Determine target duration
    const targetDurationMs = (durationSec && durationSec > 0)
      ? durationSec * 1000
      : Math.max(totalNominalMs, 1000);

    this.plannedDurationMs = targetDurationMs;
    const scale = targetDurationMs / Math.max(1, totalNominalMs);

    // Second pass: schedule visemes with scaled durations
    let currentTime = now;

    for (const step of steps) {
      const stepDuration = step.nominalMs * scale;

      if (step.isPause) {
        this.queue.push({
          viseme: VISEME_SILENCE,
          startMs: currentTime,
          endMs: currentTime + stepDuration,
        });
        currentTime += stepDuration;
      } else {
        const charList = Array.from(step.chars);
        const hasCJK = charList.some(isCJKChar);

        if (hasCJK) {
          // Each CJK character is an articulated syllable: onset (consonant) -> nucleus (vowel) -> coda
          const charDuration = stepDuration / charList.length;
          for (const char of charList) {
            const syl = getCJKVisemeSyllable(char);
            const onsetDuration = charDuration * 0.25;
            const nucleusDuration = charDuration * 0.55;

            // 1. Onset
            this.queue.push({
              viseme: syl.onset,
              startMs: currentTime,
              endMs: currentTime + onsetDuration,
            });

            // 2. Nucleus
            this.queue.push({
              viseme: syl.nucleus,
              startMs: currentTime + onsetDuration,
              endMs: currentTime + onsetDuration + nucleusDuration,
            });

            // 3. Coda
            this.queue.push({
              viseme: syl.coda,
              startMs: currentTime + onsetDuration + nucleusDuration,
              endMs: currentTime + charDuration,
            });

            currentTime += charDuration;
          }
        } else {
          // In natural European/Cyrillic/Georgian speech, vowels carry ~70% of syllable duration
          const weights: number[] = [];
          let totalWeight = 0;
          for (let i = 0; i < charList.length; i++) {
            const char = charList[i].toLowerCase();
            const isVowel = 'aeiouáéíóúàèìòùâêîôûäëïöüаеёиоуыэюяაეიოუ'.includes(char);
            const w = isVowel ? 2.3 : 1.0;
            weights.push(w);
            totalWeight += w;
          }

          for (let i = 0; i < charList.length; i++) {
            const char = charList[i];
            const viseme = charToViseme(char);
            const charDuration = (weights[i] / totalWeight) * stepDuration;
            const end = currentTime + charDuration;

            this.queue.push({
              viseme,
              startMs: currentTime,
              endMs: end,
            });

            currentTime = end;
          }
        }
      }
    }
  }

  /**
   * Adjusts the timeline when the exact audio duration becomes known after metadata loads.
   */
  adjustDuration(durationSec: number): void {
    if (!this.active || this.queue.length === 0 || !durationSec || durationSec <= 0) return;
    const newTargetMs = durationSec * 1000;
    if (Math.abs(newTargetMs - this.plannedDurationMs) < 150) return; // negligible difference

    const oldTotal = this.queue[this.queue.length - 1].endMs - this.speechStartTimestamp;
    if (oldTotal <= 0) return;

    const scale = newTargetMs / oldTotal;
    for (const item of this.queue) {
      const relStart = (item.startMs - this.speechStartTimestamp) * scale;
      const relEnd = (item.endMs - this.speechStartTimestamp) * scale;
      item.startMs = this.speechStartTimestamp + relStart;
      item.endMs = this.speechStartTimestamp + relEnd;
    }
    this.plannedDurationMs = newTargetMs;
  }

  /**
   * Called by Web Speech API boundary events (fallback path).
   */
  onWordBoundary(sentence: string, charIndex: number, charLength?: number, speechRate = 1.0): void {
    this.active = true;
    const now = performance.now();

    let word = '';
    if (charLength && charLength > 0) {
      word = sentence.substring(charIndex, charIndex + charLength);
    } else {
      const sub = sentence.substring(charIndex);
      const match = sub.match(/^[^\s.,!?;:…。，、！？：；~—–\-]+/);
      word = match ? match[0] : '';
    }

    const cleanWord = word.trim();
    if (!cleanWord) return;

    const charList = Array.from(cleanWord);
    const hasCJK = charList.some(isCJKChar);

    this.queue = this.queue.filter((item) => item.endMs > now);
    let currentStart = now;

    if (hasCJK) {
      const stepDuration = Math.max(100, Math.min(220, 160 / Math.max(0.5, speechRate)));
      for (const char of charList) {
        const syl = getCJKVisemeSyllable(char);
        const onsetDuration = stepDuration * 0.25;
        const nucleusDuration = stepDuration * 0.55;

        this.queue.push({
          viseme: syl.onset,
          startMs: currentStart,
          endMs: currentStart + onsetDuration,
        });
        this.queue.push({
          viseme: syl.nucleus,
          startMs: currentStart + onsetDuration,
          endMs: currentStart + onsetDuration + nucleusDuration,
        });
        this.queue.push({
          viseme: syl.coda,
          startMs: currentStart + onsetDuration + nucleusDuration,
          endMs: currentStart + stepDuration,
        });

        currentStart += stepDuration;
      }
    } else {
      const charDurationMs = Math.max(40, Math.min(100, 65 / Math.max(0.5, speechRate)));
      const wordDurationMs = Math.max(120, cleanWord.length * charDurationMs);
      const stepDuration = wordDurationMs / Math.max(1, cleanWord.length);

      for (let i = 0; i < cleanWord.length; i++) {
        const char = cleanWord[i];
        const viseme = charToViseme(char);
        const end = currentStart + stepDuration;

        this.queue.push({
          viseme,
          startMs: currentStart,
          endMs: end,
        });

        currentStart = end;
      }
    }

    this.queue.push({
      viseme: VISEME_SILENCE,
      startMs: currentStart,
      endMs: currentStart + 35,
    });
  }

  /**
   * Returns the currently active Viseme based on high-resolution clock.
   * Returns null if no utterance is currently scheduled.
   */
  getCurrentViseme(): Viseme | null {
    if (!this.active || this.queue.length === 0) return null;
    const now = performance.now();

    const activeItem = this.queue.find((item) => now >= item.startMs && now <= item.endMs);
    if (activeItem) {
      return activeItem.viseme;
    }

    if (now < this.queue[this.queue.length - 1].endMs) {
      return VISEME_SILENCE;
    }

    return null;
  }
}

export const globalSpeechVisemeTracker = new SpeechVisemeTracker();
