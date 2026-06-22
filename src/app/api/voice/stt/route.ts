/* ──────────────────────────────────────────────────────────────────────────────
 * POST /api/voice/stt
 *
 * Speech-to-text fallback endpoint using Google Cloud Speech-to-Text API.
 * The primary STT is handled client-side via the Web Speech API.
 * This endpoint serves as a server-side fallback for browsers that don't
 * support the Web Speech API or for higher-accuracy transcription.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface STTRequestBody {
  audioBase64: string;
  encoding?: string;
  sampleRateHertz?: number;
  languageCode?: string;
}

interface GoogleSTTWord {
  word: string;
  startTime?: string;
  endTime?: string;
  confidence?: number;
}

interface GoogleSTTAlternative {
  transcript: string;
  confidence: number;
  words?: GoogleSTTWord[];
}

interface GoogleSTTResult {
  alternatives: GoogleSTTAlternative[];
  resultEndTime?: string;
  languageCode?: string;
}

interface GoogleSTTResponse {
  results?: GoogleSTTResult[];
  totalBilledTime?: string;
}

/* ─── Google Cloud STT ───────────────────────────────────────────────── */

async function transcribeWithGoogleSTT(
  audioBase64: string,
  encoding: string,
  sampleRateHertz: number,
  languageCode: string,
): Promise<{
  transcript: string;
  confidence: number;
  words: GoogleSTTWord[];
} | null> {
  const apiKey =
    process.env.GOOGLE_CLOUD_STT_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return null;
  }

  const endpoint = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

  const requestBody = {
    config: {
      encoding,
      sampleRateHertz,
      languageCode,
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      model: 'latest_long',
      useEnhanced: true,
      speechContexts: [
        {
          phrases: [
            'stamp',
            'philately',
            'Scott number',
            'Michel number',
            'perforation',
            'watermark',
            'denomination',
            'postage',
            'cancellation',
            'mint',
            'used',
            'hinged',
            'gum',
            'engraved',
            'lithography',
            'gravure',
            'imperforate',
          ],
          boost: 10,
        },
      ],
    },
    audio: {
      content: audioBase64.replace(/^data:audio\/\w+;base64,/, ''),
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[STT] Google Cloud STT error ${response.status}:`,
      errorText,
    );
    return null;
  }

  const data = (await response.json()) as GoogleSTTResponse;

  if (!data.results || data.results.length === 0) {
    return { transcript: '', confidence: 0, words: [] };
  }

  // Concatenate all result transcripts
  let fullTranscript = '';
  let totalConfidence = 0;
  let resultCount = 0;
  const allWords: GoogleSTTWord[] = [];

  for (const result of data.results) {
    if (result.alternatives && result.alternatives.length > 0) {
      const best = result.alternatives[0];
      fullTranscript += best.transcript + ' ';
      totalConfidence += best.confidence ?? 0;
      resultCount++;
      if (best.words) {
        allWords.push(...best.words);
      }
    }
  }

  return {
    transcript: fullTranscript.trim(),
    confidence:
      resultCount > 0
        ? Math.round((totalConfidence / resultCount) * 100) / 100
        : 0,
    words: allWords,
  };
}

/* ─── Handler ────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as STTRequestBody;

    if (!body.audioBase64) {
      return NextResponse.json(
        { error: 'audioBase64 is required' },
        { status: 400 },
      );
    }

    const encoding = body.encoding || 'WEBM_OPUS';
    const sampleRateHertz = body.sampleRateHertz || 48000;
    const languageCode = body.languageCode || 'en-US';

    // Attempt Google Cloud STT
    const result = await transcribeWithGoogleSTT(
      body.audioBase64,
      encoding,
      sampleRateHertz,
      languageCode,
    );

    if (result) {
      return NextResponse.json({
        transcript: result.transcript,
        confidence: result.confidence,
        words: result.words,
        source: 'google-cloud-stt',
      });
    }

    // Fallback: direct the client to use the Web Speech API
    return NextResponse.json({
      transcript: '',
      confidence: 0,
      words: [],
      source: 'none',
      fallback: true,
      message:
        'Google Cloud Speech-to-Text is not configured. Please use the Web Speech API on the client. Ensure you call navigator.mediaDevices.getUserMedia and use the SpeechRecognition interface.',
      instructions: {
        api: 'Web Speech API (SpeechRecognition)',
        setup: 'const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()',
        docs: 'https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition',
      },
    });
  } catch (error) {
    console.error('[API /voice/stt] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Speech-to-text failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
