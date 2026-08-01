/* ─── Zustand UI State Store ─────────────────────────────────────────
 *  Global UI state: sidebar, chat panel, view mode, mobile nav,
 *  voice session, global search, and theme.
 * ──────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ViewMode } from '@/types/collection';
import type { VoiceSession, ChatContext } from '@/types/chat';

/* ─── Default Values ─────────────────────────────────────────────────── */

const DEFAULT_CHAT_CONTEXT: ChatContext = {
  type: 'general',
  stampId: null,
  metadata: {},
};

const DEFAULT_VOICE_SESSION: VoiceSession = {
  isActive: false,
  status: 'idle',
  transcript: '',
  error: null,
  duration: 0,
};

/* ─── Store Interface ────────────────────────────────────────────────── */

interface UIState {
  /* ── Sidebar ─────────────────────────────────────────────────────── */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /* ── Chat Panel ──────────────────────────────────────────────────── */
  chatOpen: boolean;
  chatContext: ChatContext;
  openChat: (context?: ChatContext) => void;
  closeChat: () => void;
  setChatContext: (context: ChatContext) => void;

  /* ── View Mode ───────────────────────────────────────────────────── */
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  /* ── Mobile Navigation ───────────────────────────────────────────── */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  toggleMobileNav: () => void;

  /* ── Voice ───────────────────────────────────────────────────────── */
  voiceSession: VoiceSession;
  updateVoiceSession: (data: Partial<VoiceSession>) => void;
  startVoiceSession: () => void;
  endVoiceSession: () => void;

  /* ── Global Search ───────────────────────────────────────────────── */
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  clearGlobalSearch: () => void;
  globalSearchFocused: boolean;
  setGlobalSearchFocused: (focused: boolean) => void;

  /* ── Theme ───────────────────────────────────────────────────────── */
  theme: 'dark';

  /* ── Modals / Overlays ───────────────────────────────────────────── */
  activeModal: string | null;
  modalData: Record<string, unknown>;
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  /* ── Notifications ───────────────────────────────────────────────── */
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  /* ── Detail Panel ────────────────────────────────────────────────── */
  detailPanelOpen: boolean;
  setDetailPanelOpen: (open: boolean) => void;
  toggleDetailPanel: () => void;

  /* ── Guided Tour ─────────────────────────────────────────────────── */
  tourActive: boolean;
  tourStep: number;
  tourDisabled: boolean;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  endTour: () => void;
  setTourDisabled: (disabled: boolean) => void;

  /* ── Page chrome ─────────────────────────────────────────────────────
   *  Set by each page via usePageChrome() and read by the Header, so every
   *  screen gets a title and a back affordance without prop-drilling through
   *  the layout. `onBack` has to be a callback rather than just an href
   *  because /upload is a wizard whose back must walk its own steps —
   *  router.back() there would exit the flow and destroy work in progress.
   * ────────────────────────────────────────────────────────────────── */
  pageChrome: PageChrome | null;
  setPageChrome: (chrome: PageChrome | null) => void;

  /* ── More sheet ──────────────────────────────────────────────────── */
  moreSheetOpen: boolean;
  setMoreSheetOpen: (open: boolean) => void;

  /* ── Dismissible hints ───────────────────────────────────────────────
   *  One-time contextual suggestions. Persisted, so a hint the user has
   *  dismissed never comes back and nothing nags on every visit.
   * ────────────────────────────────────────────────────────────────── */
  dismissedHints: string[];
  dismissHint: (id: string) => void;
  isHintDismissed: (id: string) => boolean;
  resetHints: () => void;
}

export interface ChromeAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

export interface PageChrome {
  title?: string;
  /** Where back goes, when it is a plain navigation. */
  backHref?: string;
  /** Overrides backHref for flows that manage their own history. */
  onBack?: () => void;
  actions?: ChromeAction[];
}

/* ─── Toast Type ─────────────────────────────────────────────────────── */

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number; // ms, default 5000
  createdAt: number;
}

/* ─── ID Generator ───────────────────────────────────────────────────── */

let toastCounter = 0;
function generateToastId(): string {
  toastCounter += 1;
  return `toast-${Date.now()}-${toastCounter}`;
}

/* ─── Store Creation ─────────────────────────────────────────────────── */

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        /* ── Initial State ───────────────────────────────────────────── */

        /* Sidebar */
        sidebarCollapsed: false,
        toggleSidebar: () =>
          set(
            (state) => ({ sidebarCollapsed: !state.sidebarCollapsed }),
            false,
            'toggleSidebar'
          ),
        setSidebarCollapsed: (collapsed) =>
          set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed'),

        /* Chat */
        chatOpen: false,
        chatContext: { ...DEFAULT_CHAT_CONTEXT },
        openChat: (context) =>
          set(
            {
              chatOpen: true,
              chatContext: context ?? { ...DEFAULT_CHAT_CONTEXT },
              mobileNavOpen: false, // close mobile nav when opening chat
            },
            false,
            'openChat'
          ),
        closeChat: () =>
          set(
            {
              chatOpen: false,
              chatContext: { ...DEFAULT_CHAT_CONTEXT },
            },
            false,
            'closeChat'
          ),
        setChatContext: (context) =>
          set({ chatContext: context }, false, 'setChatContext'),

        /* View Mode */
        viewMode: 'grid' as ViewMode,
        setViewMode: (mode) =>
          set({ viewMode: mode }, false, 'setViewMode'),

        /* Mobile Nav */
        mobileNavOpen: false,
        setMobileNavOpen: (open) =>
          set({ mobileNavOpen: open }, false, 'setMobileNavOpen'),
        toggleMobileNav: () =>
          set(
            (state) => ({ mobileNavOpen: !state.mobileNavOpen }),
            false,
            'toggleMobileNav'
          ),

        /* Voice */
        voiceSession: { ...DEFAULT_VOICE_SESSION },
        updateVoiceSession: (data) =>
          set(
            (state) => ({
              voiceSession: { ...state.voiceSession, ...data },
            }),
            false,
            'updateVoiceSession'
          ),
        startVoiceSession: () =>
          set(
            {
              voiceSession: {
                isActive: true,
                status: 'connecting',
                transcript: '',
                error: null,
                duration: 0,
              },
            },
            false,
            'startVoiceSession'
          ),
        endVoiceSession: () =>
          set(
            {
              voiceSession: { ...DEFAULT_VOICE_SESSION },
            },
            false,
            'endVoiceSession'
          ),

        /* Global Search */
        globalSearchQuery: '',
        setGlobalSearchQuery: (query) =>
          set({ globalSearchQuery: query }, false, 'setGlobalSearchQuery'),
        clearGlobalSearch: () =>
          set(
            { globalSearchQuery: '', globalSearchFocused: false },
            false,
            'clearGlobalSearch'
          ),
        globalSearchFocused: false,
        setGlobalSearchFocused: (focused) =>
          set({ globalSearchFocused: focused }, false, 'setGlobalSearchFocused'),

        /* Theme */
        theme: 'dark' as const,

        /* Modals */
        activeModal: null,
        modalData: {},
        openModal: (modalId, data = {}) =>
          set(
            { activeModal: modalId, modalData: data },
            false,
            'openModal'
          ),
        closeModal: () =>
          set(
            { activeModal: null, modalData: {} },
            false,
            'closeModal'
          ),

        /* Toasts */
        toasts: [],
        addToast: (toast) => {
          const id = generateToastId();
          const newToast: Toast = {
            ...toast,
            id,
            createdAt: Date.now(),
          };

          set(
            (state) => ({
              toasts: [...state.toasts, newToast].slice(-10), // keep max 10
            }),
            false,
            'addToast'
          );

          // Auto-remove after duration
          const duration = toast.duration ?? 5000;
          if (duration > 0) {
            setTimeout(() => {
              const current = get();
              if (current.toasts.some((t) => t.id === id)) {
                set(
                  (state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id),
                  }),
                  false,
                  'autoRemoveToast'
                );
              }
            }, duration);
          }
        },
        removeToast: (id) =>
          set(
            (state) => ({
              toasts: state.toasts.filter((t) => t.id !== id),
            }),
            false,
            'removeToast'
          ),
        clearToasts: () =>
          set({ toasts: [] }, false, 'clearToasts'),

        /* Detail Panel */
        detailPanelOpen: false,
        setDetailPanelOpen: (open) =>
          set({ detailPanelOpen: open }, false, 'setDetailPanelOpen'),
        toggleDetailPanel: () =>
          set(
            (state) => ({ detailPanelOpen: !state.detailPanelOpen }),
            false,
            'toggleDetailPanel'
          ),

        /* Guided Tour */
        tourActive: false,
        tourStep: 0,
        tourDisabled: false,
        startTour: () => set({ tourActive: true, tourStep: 0 }, false, 'startTour'),
        nextTourStep: () => set((state) => ({ tourStep: state.tourStep + 1 }), false, 'nextTourStep'),
        prevTourStep: () => set((state) => ({ tourStep: Math.max(0, state.tourStep - 1) }), false, 'prevTourStep'),
        endTour: () => set({ tourActive: false, tourStep: 0 }, false, 'endTour'),
        setTourDisabled: (disabled) => set({ tourDisabled: disabled }, false, 'setTourDisabled'),

        /* ── Page chrome ─────────────────────────────────────────────── */
        pageChrome: null,
        setPageChrome: (chrome) => set({ pageChrome: chrome }, false, 'setPageChrome'),

        /* ── More sheet ──────────────────────────────────────────────── */
        moreSheetOpen: false,
        setMoreSheetOpen: (open) => set({ moreSheetOpen: open }, false, 'setMoreSheetOpen'),

        /* ── Dismissible hints ───────────────────────────────────────── */
        dismissedHints: [],
        dismissHint: (id) =>
          set(
            (state) =>
              state.dismissedHints.includes(id)
                ? state
                : { dismissedHints: [...state.dismissedHints, id] },
            false,
            'dismissHint',
          ),
        isHintDismissed: (id) => get().dismissedHints.includes(id),
        resetHints: () => set({ dismissedHints: [] }, false, 'resetHints'),
      }),
      {
        name: 'stampvault-ui',
        // Only persist these fields to localStorage
        partialize: (state) => ({
          sidebarCollapsed: state.sidebarCollapsed,
          viewMode: state.viewMode,
          theme: state.theme,
          tourDisabled: state.tourDisabled,
          // Persisted so a dismissed suggestion stays dismissed across visits.
          dismissedHints: state.dismissedHints,
        }),
      }
    ),
    { name: 'StampVault:ui' }
  )
);

/* ─── Selector Hooks ─────────────────────────────────────────────────
 *  Fine-grained selectors to avoid unnecessary re-renders.
 * ──────────────────────────────────────────────────────────────────── */

export const useSidebarCollapsed = () =>
  useUIStore((s) => s.sidebarCollapsed);

export const useChatOpen = () =>
  useUIStore((s) => s.chatOpen);

export const useChatContext = () =>
  useUIStore((s) => s.chatContext);

export const useViewMode = () =>
  useUIStore((s) => s.viewMode);

export const useMobileNavOpen = () =>
  useUIStore((s) => s.mobileNavOpen);

export const useVoiceSession = () =>
  useUIStore((s) => s.voiceSession);

export const useGlobalSearch = () =>
  useUIStore((s) => ({
    query: s.globalSearchQuery,
    focused: s.globalSearchFocused,
  }));

export const useActiveModal = () =>
  useUIStore((s) => ({
    modalId: s.activeModal,
    data: s.modalData,
  }));

export const useToasts = () =>
  useUIStore((s) => s.toasts);

export const useDetailPanel = () =>
  useUIStore((s) => s.detailPanelOpen);
