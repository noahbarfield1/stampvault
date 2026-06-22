'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from './SearchInput.module.css';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search stamps…',
  onClear,
  className = '',
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(
      typeof navigator !== 'undefined' &&
        /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
    );
  }, []);

  const handleClear = useCallback(() => {
    onChange('');
    onClear?.();
    inputRef.current?.focus();
  }, [onChange, onClear]);

  /* Global keyboard shortcut: Ctrl+K / ⌘K */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMac]);

  const hasValue = value.length > 0;

  const wrapperClasses = [
    styles.wrapper,
    hasValue ? styles.hasValue : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClasses}>
      {/* Search Icon */}
      <svg
        className={styles.searchIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Clear button (visible when has value) */}
      {hasValue && (
        <button
          className={styles.clearButton}
          onClick={handleClear}
          aria-label="Clear search"
          type="button"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Keyboard shortcut hint (hidden when has value) */}
      {!hasValue && (
        <span className={styles.shortcut}>
          {isMac ? '⌘' : 'Ctrl'}
          <span>K</span>
        </span>
      )}
    </div>
  );
}
