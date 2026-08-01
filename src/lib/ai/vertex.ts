/* Shared Vertex AI project/location for all Gemini calls in this app.
 *
 * Auth: locally, via Application Default Credentials (`gcloud auth
 * application-default login`, tied to your own Google account). On Vercel
 * (no ambient GCP identity), via the least-privilege `stampvault-vertex`
 * service account — its JSON key lives only in the encrypted
 * GOOGLE_VERTEX_CREDENTIALS_JSON env var, never in this repo. */

export const VERTEX_PROJECT = 'constant-cursor-455715-p1';
export const VERTEX_LOCATION = 'us-central1';

// Both @google/genai and @ai-sdk/google-vertex cache their internal
// GoogleAuth client keyed on reference equality of this options object —
// a fresh object (or even a fresh `undefined` from a fresh call) on every
// request defeats that cache and forces a slow ADC handshake per request.
// Compute it once per process and always return the same reference.
let cachedAuthOptions: { credentials: object } | undefined | null = null;

export function getVertexAuthOptions(): { credentials: object } | undefined {
  if (cachedAuthOptions === null) {
    const raw = process.env.GOOGLE_VERTEX_CREDENTIALS_JSON;
    cachedAuthOptions = raw ? { credentials: JSON.parse(raw) } : undefined;
  }
  return cachedAuthOptions;
}
