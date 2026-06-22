'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Stamp } from '@/types/stamp';
import styles from './MetadataAccordion.module.css';

/* ── Section configs ───────────────────────────────────────────────────── */

interface FieldDef {
  key: string;
  label: string;
  getValue: (stamp: Stamp) => string;
  editable: boolean;
}

interface SectionDef {
  id: string;
  title: string;
  icon: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: 'identification',
    title: 'Identification',
    icon: '🔍',
    fields: [
      {
        key: 'country',
        label: 'Country',
        getValue: (s) => s.identification.country,
        editable: true,
      },
      {
        key: 'year',
        label: 'Year',
        getValue: (s) => s.identification.year?.toString() ?? '—',
        editable: true,
      },
      {
        key: 'denomination',
        label: 'Denomination',
        getValue: (s) => s.identification.denomination ?? '—',
        editable: true,
      },
      {
        key: 'scottNumber',
        label: 'Scott #',
        getValue: (s) => s.identification.scottNumber ?? '—',
        editable: true,
      },
      {
        key: 'michelNumber',
        label: 'Michel #',
        getValue: (s) => s.identification.michelNumber ?? '—',
        editable: true,
      },
      {
        key: 'description',
        label: 'Description',
        getValue: (s) => s.identification.description,
        editable: true,
      },
      {
        key: 'series',
        label: 'Series',
        getValue: (s) => s.identification.series ?? '—',
        editable: true,
      },
    ],
  },
  {
    id: 'condition',
    title: 'Condition & Grading',
    icon: '✨',
    fields: [
      {
        key: 'condition',
        label: 'Condition',
        getValue: (s) =>
          s.identification.condition.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        editable: true,
      },
      {
        key: 'grade',
        label: 'Numeric Grade',
        getValue: (s) => (s.grade !== null ? s.grade.toString() : '—'),
        editable: true,
      },
      {
        key: 'rarity',
        label: 'Rarity',
        getValue: (s) =>
          s.identification.rarity.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        editable: false,
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical Details',
    icon: '🔬',
    fields: [
      {
        key: 'color',
        label: 'Color',
        getValue: (s) => s.identification.color ?? '—',
        editable: true,
      },
      {
        key: 'perforation',
        label: 'Perforation',
        getValue: (s) => s.identification.perforation ?? '—',
        editable: true,
      },
      {
        key: 'watermark',
        label: 'Watermark',
        getValue: (s) => s.identification.watermark ?? '—',
        editable: true,
      },
    ],
  },
  {
    id: 'classification',
    title: 'Classification',
    icon: '📂',
    fields: [
      {
        key: 'tags',
        label: 'Tags',
        getValue: (s) => s.tags.join(', ') || '—',
        editable: true,
      },
      {
        key: 'notes',
        label: 'Notes',
        getValue: (s) => s.notes || '—',
        editable: true,
      },
      {
        key: 'purchasePrice',
        label: 'Purchase Price',
        getValue: (s) =>
          s.purchasePrice !== null
            ? `$${s.purchasePrice.toLocaleString()}`
            : '—',
        editable: true,
      },
      {
        key: 'purchaseDate',
        label: 'Purchase Date',
        getValue: (s) =>
          s.purchaseDate
            ? new Date(s.purchaseDate).toLocaleDateString()
            : '—',
        editable: true,
      },
    ],
  },
  {
    id: 'ai-notes',
    title: 'AI Notes',
    icon: '🤖',
    fields: [
      {
        key: 'confidence',
        label: 'Identification Confidence',
        getValue: (s) => `${Math.round(s.identification.confidence * 100)}%`,
        editable: false,
      },
      {
        key: 'identificationStatus',
        label: 'Status',
        getValue: (s) =>
          s.identification.status.replace(/\b\w/g, (c) => c.toUpperCase()),
        editable: false,
      },
    ],
  },
];

/* ── Props ─────────────────────────────────────────────────────────────── */

interface MetadataAccordionProps {
  stamp: Stamp;
  onFieldEdit: (field: string, value: string) => void;
}

export default function MetadataAccordion({
  stamp,
  onFieldEdit,
}: MetadataAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['identification'])
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const startEdit = useCallback(
    (fieldKey: string, currentValue: string) => {
      setEditingField(fieldKey);
      setEditValue(currentValue === '—' ? '' : currentValue);
    },
    []
  );

  const commitEdit = useCallback(
    (fieldKey: string) => {
      if (editingField === fieldKey) {
        onFieldEdit(fieldKey, editValue);
        setEditingField(null);
        setEditValue('');
      }
    },
    [editingField, editValue, onFieldEdit]
  );

  return (
    <div className={styles.accordion}>
      {SECTIONS.map((section) => {
        const isOpen = openSections.has(section.id);
        return (
          <div key={section.id} className={styles.section}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection(section.id)}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleSection(section.id);
                }
              }}
            >
              <span className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>{section.icon}</span>
                {section.title}
              </span>
              <span
                className={isOpen ? styles.chevronOpen : styles.chevron}
              >
                ▼
              </span>
            </div>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className={styles.sectionContent}>
                    <div className={styles.fields}>
                      {section.fields.map((field) => {
                        const value = field.getValue(stamp);
                        const isEditing = editingField === field.key;

                        return (
                          <div key={field.key} className={styles.field}>
                            <span className={styles.fieldLabel}>
                              {field.label}
                            </span>
                            <div className={styles.fieldValueWrapper}>
                              {isEditing ? (
                                <input
                                  className={styles.fieldInput}
                                  type="text"
                                  value={editValue}
                                  onChange={(e) =>
                                    setEditValue(e.target.value)
                                  }
                                  onBlur={() => commitEdit(field.key)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      commitEdit(field.key);
                                    }
                                    if (e.key === 'Escape') {
                                      setEditingField(null);
                                    }
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <span className={styles.fieldValue}>
                                    {value}
                                  </span>
                                  {field.editable && (
                                    <button
                                      className={styles.fieldEdit}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEdit(field.key, value);
                                      }}
                                      title={`Edit ${field.label}`}
                                      type="button"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
