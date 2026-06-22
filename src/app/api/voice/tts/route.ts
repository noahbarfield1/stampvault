/* ──────────────────────────────────────────────────────────────────────────────
 * POST /api/voice/tts
 *
 * Text-to-speech using Google Cloud Text-to-Speech API.
 * Returns audio as a WAV/MP3 binary response for direct playback.
 * Falls back to returning the text for client-side browser TTS if
 * Google Cloud credentials are not configured.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface TTSRequestBody {
  text: string;
  voice?: string;
  speakingRate?: number;
  pitch?: number;
  languageCode?: string;
}

interface GoogleTTSResponse {
  audioContent: string; // base64-encoded audio
}

/* ─── Google Cloud TTS ───────────────────────────────────────────────── */

async function synthesizeWithGoogleTTS(
  text: string,
  voice: string,
  speakingRate: number,
  pitch: number,
  languageCode: string,
): Promise<Buffer | null> {
  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return null;
  }

  const endpoint = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  // Split long text into chunks (TTS has a 5000 char limit per request)
  const maxChars = 4800;
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }
    // Split at sentence boundary within limit
    const cutoff = remaining.lastIndexOf('.', maxChars);
    const splitAt = cutoff > maxChars * 0.5 ? cutoff + 1 : maxChars;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trim();
  }

  const audioBuffers: Buffer[] = [];

  for (const chunk of chunks) {
    const requestBody = {
      input: { text: chunk },
      voice: {
        languageCode,
        name: voice,
        ssmlGender: 'NEUTRAL' as const,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        speakingRate,
        pitch,
        volumeGainDb: 0,
        sampleRateHertz: 24000,
        effectsProfileId: ['small-bluetooth-speaker-class-device'],
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
        `[TTS] Google Cloud TTS error ${response.status}:`,
        errorText,
      );
      return null;
    }

    const data = (await response.json()) as GoogleTTSResponse;

    if (!data.audioContent) {
      console.error('[TTS] No audio content in response');
      return null;
    }

    audioBuffers.push(Buffer.from(data.audioContent, 'base64'));
  }

  // Concatenate all audio buffers
  return Buffer.concat(audioBuffers);
}

/* ─── Handler ────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TTSRequestBody;

    if (!body.text || body.text.trim().length === 0) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 },
      );
    }

    // Enforce a reasonable text length limit
    if (body.text.length > 20000) {
      return NextResponse.json(
        { error: 'Text exceeds maximum length of 20,000 characters' },
        { status: 400 },
      );
    }

    const voice = body.voice || 'en-US-Studio-O';
    const speakingRate = body.speakingRate ?? 1.0;
    const pitch = body.pitch ?? 0;
    const languageCode = body.languageCode || 'en-US';

    // Attempt Google Cloud TTS
    const audioBuffer = await synthesizeWithGoogleTTS(
      body.text,
      voice,
      speakingRate,
      pitch,
      languageCode,
    );

    if (audioBuffer) {
      // Return raw audio as a streaming response
      return new Response(new Uint8Array(audioBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBuffer.length),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Fallback: return the text for browser's built-in speechSynthesis
    return NextResponse.json({
      fallback: true,
      text: body.text,
      message:
        'Google Cloud TTS not configured. Use browser speechSynthesis API on the client.',
      ssml: `<speak>${body.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</speak>`,
    });
  } catch (error) {
    console.error('[API /voice/tts] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Text-to-speech failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
