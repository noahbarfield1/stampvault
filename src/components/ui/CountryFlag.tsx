'use client';

import React from 'react';

export interface CountryFlagProps {
  country: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Maps country names (case-insensitive) to ISO 3166-1 alpha-2 codes.
 * Coverage: top 50+ stamp-collecting countries worldwide.
 */
const COUNTRY_TO_ISO: Record<string, string> = {
  // Americas
  'united states': 'US',
  'usa': 'US',
  'us': 'US',
  'canada': 'CA',
  'mexico': 'MX',
  'brazil': 'BR',
  'argentina': 'AR',
  'chile': 'CL',
  'colombia': 'CO',
  'peru': 'PE',
  'cuba': 'CU',

  // Europe – Western
  'united kingdom': 'GB',
  'uk': 'GB',
  'great britain': 'GB',
  'france': 'FR',
  'germany': 'DE',
  'italy': 'IT',
  'spain': 'ES',
  'portugal': 'PT',
  'netherlands': 'NL',
  'belgium': 'BE',
  'switzerland': 'CH',
  'austria': 'AT',
  'ireland': 'IE',
  'luxembourg': 'LU',
  'liechtenstein': 'LI',
  'monaco': 'MC',

  // Europe – Northern
  'sweden': 'SE',
  'norway': 'NO',
  'denmark': 'DK',
  'finland': 'FI',
  'iceland': 'IS',

  // Europe – Eastern & Central
  'russia': 'RU',
  'poland': 'PL',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'hungary': 'HU',
  'romania': 'RO',
  'greece': 'GR',
  'turkey': 'TR',
  'ukraine': 'UA',
  'serbia': 'RS',
  'croatia': 'HR',
  'bulgaria': 'BG',

  // Asia
  'china': 'CN',
  'japan': 'JP',
  'south korea': 'KR',
  'korea': 'KR',
  'india': 'IN',
  'thailand': 'TH',
  'malaysia': 'MY',
  'singapore': 'SG',
  'indonesia': 'ID',
  'philippines': 'PH',
  'vietnam': 'VN',
  'taiwan': 'TW',
  'hong kong': 'HK',
  'israel': 'IL',
  'iran': 'IR',
  'pakistan': 'PK',
  'sri lanka': 'LK',

  // Oceania
  'australia': 'AU',
  'new zealand': 'NZ',

  // Africa
  'south africa': 'ZA',
  'egypt': 'EG',
  'morocco': 'MA',
  'nigeria': 'NG',
  'kenya': 'KE',
  'ethiopia': 'ET',
};

/**
 * Converts an ISO 3166-1 alpha-2 code to a flag emoji.
 * Works by mapping each letter to its Regional Indicator Symbol.
 */
function isoToFlagEmoji(iso: string): string {
  const upper = iso.toUpperCase();
  const codePoints = [...upper].map(
    (char) => 0x1f1e6 + char.charCodeAt(0) - 65
  );
  return String.fromCodePoint(...codePoints);
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { fontSize: '16px', lineHeight: 1 },
  md: { fontSize: '22px', lineHeight: 1 },
  lg: { fontSize: '32px', lineHeight: 1 },
};

const fallbackSizeStyles: Record<string, React.CSSProperties> = {
  sm: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '16px',
    fontSize: '9px',
    fontWeight: 700,
    fontFamily: 'var(--font-ui)',
    letterSpacing: '0.02em',
    color: 'var(--color-text-primary)',
    background: 'rgba(138, 133, 120, 0.15)',
    borderRadius: '3px',
    textTransform: 'uppercase' as const,
  },
  md: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '20px',
    fontSize: '10px',
    fontWeight: 700,
    fontFamily: 'var(--font-ui)',
    letterSpacing: '0.02em',
    color: 'var(--color-text-primary)',
    background: 'rgba(138, 133, 120, 0.15)',
    borderRadius: '3px',
    textTransform: 'uppercase' as const,
  },
  lg: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '28px',
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: 'var(--font-ui)',
    letterSpacing: '0.02em',
    color: 'var(--color-text-primary)',
    background: 'rgba(138, 133, 120, 0.15)',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
  },
};

export default function CountryFlag({
  country,
  size = 'md',
}: CountryFlagProps) {
  const normalized = country.trim().toLowerCase();
  const iso = COUNTRY_TO_ISO[normalized];

  if (iso) {
    const emoji = isoToFlagEmoji(iso);
    return (
      <span
        role="img"
        aria-label={`Flag of ${country}`}
        style={sizeStyles[size]}
      >
        {emoji}
      </span>
    );
  }

  /* Fallback: first 2 characters in a small badge */
  const fallback = country.trim().substring(0, 2);
  return (
    <span
      aria-label={`Flag of ${country}`}
      style={fallbackSizeStyles[size]}
      title={country}
    >
      {fallback}
    </span>
  );
}
