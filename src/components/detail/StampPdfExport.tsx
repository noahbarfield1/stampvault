'use client';

import React, { useCallback } from 'react';
import type { Stamp } from '@/types/stamp';

interface StampPdfExportProps {
  stamp: Stamp;
}

function formatCurrency(value: number): string {
  const hasCents = value % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents || value < 100 ? 2 : 0,
    maximumFractionDigits: hasCents || value < 100 ? 2 : 0,
  }).format(value);
}

export default function StampPdfExport({ stamp }: StampPdfExportProps) {
  const handleExport = useCallback(() => {
    const { identification, pricing, priceHistory } = stamp;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${identification.description} — PerdueStampVault</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', sans-serif;
      background: #0a0a0f;
      color: #e8e4dd;
      padding: 40px;
    }

    .card {
      max-width: 800px;
      margin: 0 auto;
      background: rgba(15, 15, 25, 0.95);
      border: 1px solid rgba(212, 165, 116, 0.3);
      border-radius: 16px;
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, rgba(212, 165, 116, 0.15), rgba(245, 200, 66, 0.08));
      padding: 32px;
      border-bottom: 1px solid rgba(212, 165, 116, 0.2);
    }

    .header h1 {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      color: #d4a574;
      margin-bottom: 8px;
    }

    .header .subtitle {
      font-size: 14px;
      color: #8a8578;
    }

    .content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      padding: 32px;
    }

    .imageSection {
      text-align: center;
    }

    .imageSection img {
      max-width: 100%;
      max-height: 300px;
      border-radius: 12px;
      border: 1px solid rgba(212, 165, 116, 0.2);
    }

    .section {
      margin-bottom: 24px;
    }

    .section h3 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #d4a574;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(212, 165, 116, 0.15);
    }

    .field {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(212, 165, 116, 0.06);
      font-size: 13px;
    }

    .field .label {
      color: #8a8578;
      font-weight: 500;
    }

    .field .value {
      color: #e8e4dd;
      font-weight: 600;
      text-align: right;
    }

    .valueDisplay {
      text-align: center;
      padding: 24px;
      background: rgba(212, 165, 116, 0.08);
      border-radius: 12px;
      margin-bottom: 24px;
    }

    .valueDisplay .amount {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      font-weight: 700;
      color: #d4a574;
    }

    .valueDisplay .range {
      font-size: 12px;
      color: #8a8578;
      margin-top: 4px;
    }

    .footer {
      text-align: center;
      padding: 16px 32px;
      border-top: 1px solid rgba(212, 165, 116, 0.1);
      font-size: 11px;
      color: #5c574e;
    }

    @media print {
      body { background: white; color: #1a1a1a; padding: 20px; }
      .card { border: 1px solid #ccc; background: white; }
      .header { background: #f8f6f3; }
      .header h1 { color: #8b6f47; }
      .field .label { color: #666; }
      .field .value { color: #1a1a1a; }
      .valueDisplay { background: #f8f6f3; }
      .valueDisplay .amount { color: #8b6f47; }
      .section h3 { color: #8b6f47; border-bottom-color: #ddd; }
      .footer { border-top-color: #ddd; color: #999; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${identification.description}</h1>
      <div class="subtitle">
        ${identification.country} · ${identification.year ?? 'Unknown year'} · Scott #${identification.scottNumber ?? '—'}
      </div>
    </div>

    <div class="content">
      <div>
        <div class="imageSection">
          <img src="${stamp.imageUrl}" alt="${identification.description}" />
        </div>
      </div>

      <div>
        ${
          pricing
            ? `<div class="valueDisplay">
              <div class="amount">${formatCurrency(pricing.estimatedValue)}</div>
              <div class="range">Range: ${formatCurrency(pricing.priceRange.min)} – ${formatCurrency(pricing.priceRange.max)}</div>
            </div>`
            : ''
        }

        <div class="section">
          <h3>Identification</h3>
          <div class="field"><span class="label">Country</span><span class="value">${identification.country}</span></div>
          <div class="field"><span class="label">Year</span><span class="value">${identification.year ?? '—'}</span></div>
          <div class="field"><span class="label">Denomination</span><span class="value">${identification.denomination ?? '—'}</span></div>
          <div class="field"><span class="label">Scott #</span><span class="value">${identification.scottNumber ?? '—'}</span></div>
          <div class="field"><span class="label">Michel #</span><span class="value">${identification.michelNumber ?? '—'}</span></div>
          <div class="field"><span class="label">Series</span><span class="value">${identification.series ?? '—'}</span></div>
        </div>

        <div class="section">
          <h3>Condition</h3>
          <div class="field"><span class="label">Condition</span><span class="value">${identification.condition.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span></div>
          <div class="field"><span class="label">Grade</span><span class="value">${stamp.grade ?? '—'}</span></div>
          <div class="field"><span class="label">Rarity</span><span class="value">${identification.rarity.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span></div>
        </div>

        <div class="section">
          <h3>Technical</h3>
          <div class="field"><span class="label">Color</span><span class="value">${identification.color ?? '—'}</span></div>
          <div class="field"><span class="label">Perforation</span><span class="value">${identification.perforation ?? '—'}</span></div>
          <div class="field"><span class="label">Watermark</span><span class="value">${identification.watermark ?? '—'}</span></div>
        </div>

        ${
          stamp.notes
            ? `<div class="section">
              <h3>Notes</h3>
              <p style="font-size: 13px; line-height: 1.6;">${stamp.notes}</p>
            </div>`
            : ''
        }

        ${
          priceHistory.length > 0
            ? `<div class="section">
              <h3>Price History</h3>
              ${priceHistory
                .slice(-5)
                .map(
                  (entry) =>
                    `<div class="field"><span class="label">${new Date(entry.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span><span class="value">${formatCurrency(entry.value)}</span></div>`
                )
                .join('')}
            </div>`
            : ''
        }
      </div>
    </div>

    <div class="footer">
      Generated by PerdueStampVault · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  }, [stamp]);

  return (
    <button
      onClick={handleExport}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: 'rgba(212, 165, 116, 0.1)',
        border: '1px solid rgba(212, 165, 116, 0.25)',
        borderRadius: '8px',
        color: '#d4a574',
        fontFamily: 'var(--font-ui)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLButtonElement).style.background =
          'rgba(212, 165, 116, 0.2)';
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLButtonElement).style.background =
          'rgba(212, 165, 116, 0.1)';
      }}
      type="button"
    >
      📄 Export PDF
    </button>
  );
}
