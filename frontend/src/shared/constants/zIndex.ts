/**
 * Z-Index Scale for consistent stacking context across the application
 * Prevents unexpected stacking issues with modals, dropdowns, and overlays
 */
export const Z_INDEX = {
  /** Mobile overlay backdrop behind sidebar/modals */
  MOBILE_OVERLAY: 40,

  /** Sidebar and main navigation elements */
  SIDEBAR: 50,

  /** Header and top navigation */
  HEADER: 50,

  /** Dropdown menus, tooltips, and popups */
  DROPDOWN: 50,

  /** Modal overlays and dialogs */
  MODAL: 60,

  /** Tooltips and floating elements */
  TOOLTIP: 70,

  /** Notifications and toast messages */
  NOTIFICATION: 80,

  /** Maximum z-index for any element */
  MAX: 9999,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;
