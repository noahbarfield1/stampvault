/* ──────────────────────────────────────────────────────────────────────────────
 * GET  /api/research/knowledge — Retrieve knowledge base entries from Firestore
 * POST /api/research/knowledge — Trigger deep research and save to knowledge base
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface KnowledgeEntry {
  id: string;
  topic: string;
  content: string;
  sections: { heading: string; body: string }[];
  citations: { title: string; url: string; snippet: string }[];
  model: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

interface KnowledgeRequestBody {
  topic: string;
  tags?: string[];
  refresh?: boolean;
}

/* ─── GET: Retrieve knowledge base entries ───────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic');
    const tag = searchParams.get('tag');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();

    let query: FirebaseFirestore.Query = db.collection('knowledge');

    // Filter by topic (partial match via field equality — Firestore
    // doesn't support LIKE, so we do prefix range matching)
    if (topic) {
      query = query
        .where('topic', '>=', topic)
        .where('topic', '<=', topic + '\uf8ff');
    }

    // Filter by tag
    if (tag) {
      query = query.where('tags', 'array-contains', tag);
    }

    // Order and paginate
    query = query.orderBy('updatedAt', 'desc').offset(offset).limit(limit);

    const snapshot = await query.get();

    const entries: KnowledgeEntry[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<KnowledgeEntry, 'id'>),
    }));

    // Get total count for pagination
    const countSnapshot = await db
      .collection('knowledge')
      .count()
      .get();
    const total = countSnapshot.data().count;

    return NextResponse.json({
      entries,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + entries.length < total,
      },
    });
  } catch (error) {
    console.error('[API /research/knowledge GET] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to retrieve knowledge base';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─── POST: Research a topic and save to knowledge base ──────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as KnowledgeRequestBody;

    if (!body.topic || body.topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'topic is required' },
        { status: 400 },
      );
    }

    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();

    // Check if we already have this topic (unless refresh is requested)
    if (!body.refresh) {
      const existing = await db
        .collection('knowledge')
        .where('topic', '==', body.topic.trim())
        .limit(1)
        .get();

      if (!existing.empty) {
        const doc = existing.docs[0];
        return NextResponse.json({
          entry: { id: doc.id, ...doc.data() } as KnowledgeEntry,
          cached: true,
          message: 'Knowledge entry already exists. Set refresh:true to regenerate.',
        });
      }
    }

    // Perform deep research using Perplexity
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (!perplexityKey) {
      return NextResponse.json(
        { error: 'PERPLEXITY_API_KEY is not configured' },
        { status: 500 },
      );
    }

    const { buildKnowledgeBase } = await import('@/lib/ai/perplexity');
    const research = await buildKnowledgeBase(body.topic);

    // Build the knowledge entry
    const now = new Date().toISOString();
    const tags = body.tags || extractTags(body.topic);

    const entry: Omit<KnowledgeEntry, 'id'> = {
      topic: research.topic || body.topic,
      content: research.content,
      sections: research.sections,
      citations: research.citations.map((c) => ({
        title: c.title,
        url: c.url,
        snippet: c.snippet || '',
      })),
      model: 'sonar-deep-research',
      createdAt: now,
      updatedAt: now,
      tags,
    };

    // Save to Firestore (update if refreshing, create if new)
    let docId: string;

    if (body.refresh) {
      // Find and update existing document
      const existing = await db
        .collection('knowledge')
        .where('topic', '==', body.topic.trim())
        .limit(1)
        .get();

      if (!existing.empty) {
        docId = existing.docs[0].id;
        await db.collection('knowledge').doc(docId).update({
          ...entry,
          createdAt: existing.docs[0].data().createdAt || now,
          updatedAt: now,
        });
      } else {
        const ref = await db.collection('knowledge').add(entry);
        docId = ref.id;
      }
    } else {
      const ref = await db.collection('knowledge').add(entry);
      docId = ref.id;
    }

    return NextResponse.json({
      entry: { id: docId, ...entry },
      cached: false,
      message: body.refresh
        ? 'Knowledge entry refreshed with latest research'
        : 'New knowledge entry created',
    });
  } catch (error) {
    console.error('[API /research/knowledge POST] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Knowledge base operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─── Tag Extraction ─────────────────────────────────────────────────── */

/**
 * Auto-extract relevant tags from a topic string.
 */
function extractTags(topic: string): string[] {
  const tags: string[] = [];
  const lower = topic.toLowerCase();

  // Country detection
  const countries = [
    'united states', 'usa', 'great britain', 'uk', 'canada', 'australia',
    'germany', 'france', 'japan', 'china', 'india', 'russia', 'brazil',
    'italy', 'spain', 'switzerland', 'sweden', 'norway', 'denmark',
    'netherlands', 'belgium', 'austria', 'new zealand', 'south africa',
  ];
  for (const country of countries) {
    if (lower.includes(country)) {
      tags.push(country);
      break;
    }
  }

  // Topic categories
  const categories: [string, string[]][] = [
    ['airmail', ['airmail', 'air mail', 'aviation', 'zeppelin']],
    ['errors', ['error', 'invert', 'misprint', 'variety', 'flaw']],
    ['classics', ['classic', '19th century', '1800s', 'early']],
    ['modern', ['modern', 'contemporary', '21st century', '2000s']],
    ['thematic', ['thematic', 'topical', 'wildlife', 'space', 'sports']],
    ['revenue', ['revenue', 'fiscal', 'tax']],
    ['postal-history', ['postal history', 'cover', 'postmark', 'cancellation']],
    ['forgeries', ['forgery', 'fake', 'counterfeit', 'authentication']],
    ['grading', ['grading', 'condition', 'centering', 'gum']],
    ['investment', ['investment', 'value', 'appreciation', 'market']],
    ['printing', ['printing', 'engraved', 'lithograph', 'gravure']],
    ['watermarks', ['watermark']],
    ['perforations', ['perforation', 'perf', 'imperf']],
  ];

  for (const [tag, keywords] of categories) {
    if (keywords.some((kw) => lower.includes(kw))) {
      tags.push(tag);
    }
  }

  // Always add 'philately'
  if (!tags.includes('philately')) {
    tags.push('philately');
  }

  return tags;
}
