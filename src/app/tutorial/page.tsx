'use client';

/* ──────────────────────────────────────────────────────────────────────────────
 * /tutorial — how the app actually works.
 *
 * Written to be accurate rather than promotional. The "What this does and does
 * not do" panel exists because the previous copy in the guided tour claimed
 * pricing came from "eBay sold listings, active HipStamp listings and historical
 * auction values" when only the eBay path is wired — and overclaiming is exactly
 * how a tool like this loses the owner's trust.
 * ────────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { usePageChrome } from '@/hooks/usePageChrome';
import styles from './tutorial.module.css';

interface Step {
  title: string;
  text: string;
  tips: React.ReactNode[];
}

const STEPS: Step[] = [
  {
    title: 'Photograph your stamps',
    text: 'Lay the stamps flat and fill the frame. You can shoot a whole album page at once, or one stamp per photo.',
    tips: [
      <>
        <strong>Sheet mode</strong> takes one photo and finds every stamp on it. Best for album
        pages and stock sheets.
      </>,
      <>
        <strong>Batch mode</strong> takes several photos and treats each as one stamp. Best when
        you have already photographed stamps individually.
      </>,
      <>
        Even, indirect light beats flash — glare on a glassine mount hides the design and the
        perforations.
      </>,
      <>
        Photos are downscaled on your device before upload, so a 12&nbsp;megapixel shot is fine.
      </>,
    ],
  },
  {
    title: 'Choose which stamps to keep',
    text: 'Detected stamps arrive already selected, so a clean scan needs no taps at all. Tap any stamp to exclude it.',
    tips: [
      <>
        A box marked <strong>?</strong> in amber is a low-confidence detection. It is still
        included — check it before continuing.
      </>,
      <>
        Pinch to zoom in on a crowded page. The boxes zoom with the photo.
      </>,
      <>
        Missed one? Tap <strong>+ Add</strong> and drag the new box over it.
      </>,
      <>
        Anything you change can be undone with <strong>↶</strong>.
      </>,
    ],
  },
  {
    title: 'Let the AI identify them',
    text: 'Each selected stamp is sent to Google Gemini, which reads the design, country, denomination and catalog number.',
    tips: [
      <>
        Expect a few seconds per stamp. You can cancel at any point without losing what has
        already finished.
      </>,
      <>
        Every result carries a <strong>confidence score</strong>. Treat anything under 50% as a
        suggestion, not an answer.
      </>,
      <>
        If a stamp comes back as <strong>Unknown</strong>, the app says so rather than guessing.
      </>,
    ],
  },
  {
    title: 'Review the prices, then save',
    text: 'For stamps the AI identified confidently, current eBay listings are searched and an estimate is aggregated from what sellers are asking.',
    tips: [
      <>
        Every price links to the <strong>actual listings</strong> it came from. Open them — the
        proof is the point.
      </>,
      <>
        Wild outliers are filtered out, so one mispriced &ldquo;block of six&rdquo; cannot drag a
        common stamp&rsquo;s average up.
      </>,
      <>
        You can edit any detail before saving if you know better than the AI. You usually will.
      </>,
    ],
  },
];

const GESTURES = [
  { icon: '👆', name: 'Tap a stamp', desc: 'Include or exclude it from identification.' },
  { icon: '✎', name: 'Tap the pencil', desc: 'Resize or move that stamp’s box.' },
  { icon: '⏱', name: 'Press and hold', desc: 'Same as the pencil — for the box under your finger.' },
  { icon: '🤏', name: 'Pinch', desc: 'Zoom the photo up to 6×. Boxes follow.' },
  { icon: '↕', name: 'Swipe', desc: 'Scrolls the page normally, even over a stamp.' },
  { icon: '↶', name: 'Undo', desc: 'Reverts the last box change, up to 20 steps.' },
];

export default function TutorialPage() {
  usePageChrome({ title: 'How it works', backHref: '/dashboard' });
  const router = useRouter();
  const startTour = useUIStore((s) => s.startTour);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>How it works</h1>
      <p className={styles.lede}>
        Photograph a page of stamps, pick the ones you want, and let the AI identify and price
        them. Four steps, a couple of minutes.
      </p>

      <div className={styles.steps}>
        {STEPS.map((step, i) => (
          <section key={step.title} className={styles.step}>
            <span className={styles.stepNumber} aria-hidden="true">
              {i + 1}
            </span>
            <div className={styles.stepBody}>
              <h2 className={styles.stepTitle}>{step.title}</h2>
              <p className={styles.stepText}>{step.text}</p>
              <ul className={styles.tips}>
                {step.tips.map((tip, j) => (
                  <li key={j}>{tip}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Gestures on the selection screen</h2>
        <div className={styles.gestureList}>
          {GESTURES.map((g) => (
            <div key={g.name} className={styles.gesture}>
              <span className={styles.gestureIcon} aria-hidden="true">
                {g.icon}
              </span>
              <span>
                <span className={styles.gestureName}>{g.name}</span>
                <span className={styles.gestureDesc}>{g.desc}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What this does, and what it doesn&rsquo;t</h2>
        <div className={styles.honesty}>
          <div className={styles.honestyRow}>
            <span className={styles.markYes} aria-hidden="true">
              ✓
            </span>
            <p className={styles.honestyText}>
              <strong>Identification is real AI.</strong>{' '}Photos go to Google Gemini and the result
              is whatever it actually returns — including &ldquo;Unknown&rdquo;.
            </p>
          </div>
          <div className={styles.honestyRow}>
            <span className={styles.markYes} aria-hidden="true">
              ✓
            </span>
            <p className={styles.honestyText}>
              <strong>Prices come from real eBay listings</strong>, fetched when you
              ask, with a link to every listing used.</p>
          </div>
          <div className={styles.honestyRow}>
            <span className={styles.markNo} aria-hidden="true">
              ✕
            </span>
            <p className={styles.honestyText}>
              <strong>These are asking prices, not sale prices.</strong>{' '}eBay puts completed
              sales behind a sign-in, so the figures come from what sellers are currently asking.
              Asking prices skew high — an overpriced listing can sit unsold for years.
            </p>
          </div>
          <div className={styles.honestyRow}>
            <span className={styles.markNo} aria-hidden="true">
              ✕
            </span>
            <p className={styles.honestyText}>
              <strong>It is not an appraisal.</strong>{' '}Condition drives most of a stamp&rsquo;s
              value and a photo cannot judge gum, thins or repairs. Treat every figure as a
              starting point.
            </p>
          </div>
          <div className={styles.honestyRow}>
            <span className={styles.markNo} aria-hidden="true">
              ✕
            </span>
            <p className={styles.honestyText}>
              <strong>Catalog numbers can be wrong.</strong>{' '}Similar designs across years and
              perforation varieties trip up any vision model. Check anything valuable against a
              real catalog.
            </p>
          </div>
          <div className={styles.honestyRow}>
            <span className={styles.markNo} aria-hidden="true">
              ✕
            </span>
            <p className={styles.honestyText}>
              <strong>No price history yet.</strong>{' '}Charts show the values recorded so far in this
              app, not decades of market data.
            </p>
          </div>
        </div>
      </section>

      <div className={styles.actions}>
        <Link href="/upload" className={styles.primary}>
          Add your first stamps →
        </Link>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            router.push('/dashboard');
            startTour();
          }}
        >
          Take the guided tour
        </button>
      </div>
    </div>
  );
}
