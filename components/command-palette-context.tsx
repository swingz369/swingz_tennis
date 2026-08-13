'use client';

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from 'react';

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  searchOpen: boolean;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

/**
 * Shared open/close state for the two global overlays that live in the header:
 *
 * - `open` — the ⌘K command palette (navigation, quick actions, theme).
 * - `searchOpen` — the focused search dialog, opened by the magnifier icon.
 *
 * They are deliberately separate: the magnifier opens *search only*, while
 * ⌘K opens the full command palette.
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <CommandPaletteContext.Provider value={{ open, setOpen, searchOpen, setSearchOpen }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return { open: ctx.open, setOpen: ctx.setOpen };
}

export function useSearchDialog() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error('useSearchDialog must be used within a CommandPaletteProvider');
  }
  return { open: ctx.searchOpen, setOpen: ctx.setSearchOpen };
}
