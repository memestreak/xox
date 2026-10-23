/**
 * Class strings shared by the dropdown menus (track
 * name menu, grid menu).
 */

export const MENU_ITEM_BASE =
  'w-full text-left px-2.5 py-2 rounded-[5px] text-sm'
  + ' hover:bg-[#2f2c27] transition-colors'
  + ' flex items-center justify-between gap-3'
  + ' focus-visible:outline-none focus-visible:bg-[#2f2c27]'
  + ' disabled:text-faint disabled:hover:bg-transparent';

export const MENU_ITEM = MENU_ITEM_BASE + ' text-ink';

export const MENU_HINT =
  'font-mono text-[10px] text-muted border border-edge'
  + ' rounded px-1.5 py-px';
