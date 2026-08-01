'use client';

import React, { useState } from 'react';
import type { Stamp } from '@/types/stamp';
import GoldButton from '@/components/ui/GoldButton';
import EditStampModal from './EditStampModal';
import ConfidenceMeter from '@/components/ui/ConfidenceMeter';
import styles from './UploadSummary.module.css';


interface UploadSummaryProps {
  stamps: Partial<Stamp>[];
  onSave: () => void;
  onCancel: () => void;
  onUpdateStamp?: (index: number, updated: Partial<Stamp>) => void;
  onDeleteStamp?: (index: number) => void;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export default function UploadSummary({
  stamps,
  onSave,
  onCancel,
  onUpdateStamp,
  onDeleteStamp,
}: UploadSummaryProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [brokenRefImages, setBrokenRefImages] = useState<Set<number>>(new Set());

  const totalValue = stamps.reduce(
    (sum, s) => sum + (s.pricing?.estimatedValue ?? 0),
    0
  );

  return (
    <div className={styles.wrapper}>
      <EditStampModal
        isOpen={editingIndex !== null}
        onClose={() => setEditingIndex(null)}
        stamp={editingIndex !== null ? stamps[editingIndex] : null}
        onSave={(updated) => {
          if (editingIndex !== null && onUpdateStamp) {
            onUpdateStamp(editingIndex, updated);
          }
        }}
      />
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerIcon}>✅</span>
        <h2 className={styles.headerTitle}>Upload Complete</h2>
        <div className={styles.headerStats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stamps.length}</span>
            <span className={styles.statLabel}>Stamps</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.totalValue}>
              {formatCurrency(totalValue)}
            </span>
            <span className={styles.statLabel}>Est. Total Value</span>
          </div>
        </div>
      </div>

      {/* Grid / List */}
      <div className={styles.grid}>
        {stamps.map((stamp, index) => (
          <div key={stamp.id ?? index} className={styles.card}>
            {/* Left: Side-by-Side Visual Comparison */}
            <div className={styles.comparisonContainer}>
              <div className={styles.imageColumn}>
                <span className={styles.imageBadge}>Uploaded Crop</span>
                {stamp.imageUrl || stamp.thumbnailUrl ? (
                  <img
                    className={styles.comparisonImage}
                    src={stamp.imageUrl || (stamp.thumbnailUrl ?? undefined)}
                    alt="Uploaded stamp crop"
                  />
                ) : (
                  <div className={styles.cardImagePlaceholder}>🎫</div>
                )}
              </div>
              <div className={styles.imageColumn}>
                <span className={styles.imageBadge}>Catalog Reference</span>
                {stamp.identification?.referenceImageUrl && !brokenRefImages.has(index) ? (
                  <a
                    href={`https://www.hipstamp.com/search?q=${encodeURIComponent((stamp.identification.country || '') + ' ' + (stamp.identification.scottNumber || ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', textDecoration: 'none' }}
                    title="View catalog reference on Hipstamp"
                  >
                    <img
                      className={styles.comparisonImage}
                      src={stamp.identification.referenceImageUrl || undefined}
                      alt="Catalog reference"
                      onError={() =>
                        setBrokenRefImages((prev) => new Set(prev).add(index))
                      }
                    />
                  </a>
                ) : (
                  <div className={styles.cardImagePlaceholder}>🔍</div>
                )}
              </div>
            </div>

            {/* Right: Detailed Catalog Info & Verification */}
            <div className={styles.cardBody}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  {stamp.identification?.description ?? `Stamp #${index + 1}`}
                </h3>
                {stamp.identification?.confidence !== undefined && (
                  <ConfidenceMeter
                    confidence={stamp.identification.confidence}
                    label="Match"
                    className={styles.cardConfidenceMeter}
                    explain
                  />
                )}
              </div>

              {/* Info Grid */}
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Country</span>
                  <span className={styles.infoValue}>
                    {stamp.identification?.country ?? '—'}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Year</span>
                  <span className={styles.infoValue}>
                    {stamp.identification?.year ?? '—'}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Scott Number</span>
                  <span className={styles.infoValue}>
                    {stamp.identification?.scottNumber ? `#${stamp.identification.scottNumber}` : '—'}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Denomination</span>
                  <span className={styles.infoValue}>
                    {stamp.identification?.denomination ?? '—'}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Color</span>
                  <span className={styles.infoValue}>
                    {stamp.identification?.color ?? '—'}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Series</span>
                  <span className={styles.infoValue}>
                    {stamp.identification?.series ?? '—'}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Rarity</span>
                  <span className={styles.infoValue}>
                    {stamp.identification?.rarity ? (
                      <span className={styles.rarityText}>
                        {stamp.identification.rarity.replace('_', ' ')}
                      </span>
                    ) : '—'}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Condition</span>
                  <span className={styles.infoValue}>
                    {stamp.identification?.condition ? (
                      <span className={styles.conditionText}>
                        {stamp.identification.condition.replace('_', ' ')}
                      </span>
                    ) : '—'}
                  </span>
                </div>
              </div>

              {/* Pricing Section */}
              {stamp.pricing && (
                <div className={styles.pricingSection}>
                  <div className={styles.pricingHeader}>
                    <span className={styles.priceLabel}>Estimated Value</span>
                    <span className={styles.priceValue}>
                      {formatCurrency(stamp.pricing.estimatedValue)}
                    </span>
                  </div>
                  {stamp.pricing.sources && stamp.pricing.sources.length > 0 && (
                    <div className={styles.sourcesList}>
                      <span className={styles.sourcesLabel}>Verified Sources:</span>
                      <div className={styles.sourcesPills}>
                        {stamp.pricing.sources.map((src, sIdx) => (
                          <a
                            key={sIdx}
                            href={src.url || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.sourcePill}
                          >
                            <span className={styles.sourcePlatform}>
                              {src.platform.toUpperCase()}
                            </span>
                            <span className={styles.sourcePrice}>
                              {formatCurrency(src.price)}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Alternatives Section */}
              {stamp.identification?.alternatives && stamp.identification.alternatives.length > 0 && (
                <div className={styles.alternativesSection}>
                  <div className={styles.alternativesHeader}>
                    <span className={styles.alternativesLabel}>Other Possibilities</span>
                  </div>
                  <div className={styles.alternativesList}>
                    {stamp.identification.alternatives.map((alt, aIdx) => (
                      <div key={aIdx} className={styles.alternativeCard}>
                        {alt.referenceImageUrl ? (
                          <img src={alt.referenceImageUrl} alt="Alt Ref" className={styles.altImage} />
                        ) : (
                          <div className={styles.altImagePlaceholder}>🔍</div>
                        )}
                        <div className={styles.altInfo}>
                          <span className={styles.altScott}>{alt.scottNumber ? `#${alt.scottNumber}` : 'Unknown'}</span>
                          <span className={styles.altDesc}>{alt.description}</span>
                          <span className={styles.altConf}>{Math.round(alt.confidence * 100)}% Match</span>
                        </div>
                        {onUpdateStamp && (
                          <button
                            type="button"
                            className={styles.swapBtn}
                            onClick={() => {
                              onUpdateStamp(index, {
                                ...stamp,
                                identification: {
                                  ...stamp.identification!,
                                  scottNumber: alt.scottNumber,
                                  description: alt.description,
                                  confidence: alt.confidence,
                                  referenceImageUrl: alt.referenceImageUrl || stamp.identification!.referenceImageUrl,
                                },
                                // Clear pricing so it gets re-fetched or shown as empty
                                pricing: null,
                              });
                            }}
                          >
                            Swap
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className={styles.cardActions}>
                {onDeleteStamp && (
                  <button
                    type="button"
                    className={styles.discardBtn}
                    onClick={() => onDeleteStamp(index)}
                  >
                    Discard
                  </button>
                )}
                {onUpdateStamp && (
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => setEditingIndex(index)}
                  >
                    Edit Metadata
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className={styles.footer}>
        <button
          className={styles.cancelButton}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <GoldButton onClick={onSave} size="lg" disabled={stamps.length === 0}>
          SAVE ALL TO COLLECTION
        </GoldButton>
      </div>
    </div>
  );
}
