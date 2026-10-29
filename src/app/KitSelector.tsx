"use client";

import { useCallback, useRef, useState } from 'react';
import kitsData from './data/kits.json';
import { useSequencer } from './SequencerContext';
import Tooltip from './Tooltip';
import LcdSelect from './LcdSelect';
import ContextMenu from './ContextMenu';
import ExportKitDialog from './ExportKitDialog';
import { MENU_ITEM } from './menuStyles';

const KIT_OPTIONS = kitsData.kits.map(k => ({
  value: k.id,
  label: k.name,
}));

/**
 * The Kit dropdown. A right-click on it (or the
 * keyboard's context-menu key while it has focus)
 * opens the kit menu, which holds Export kit....
 */
export default function KitSelector() {
  const { state, actions } = useSequencer();
  const { currentKit, customSamples, disabledSamples } = state;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<
    { x: number; y: number } | null
  >(null);
  const [exportOpen, setExportOpen] = useState(false);
  // Bumped on each open so the dialog starts fresh.
  const [exportKey, setExportKey] = useState(0);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      // The context-menu key and Shift+F10 report (0, 0):
      // open under the key instead.
      if (e.clientX === 0 && e.clientY === 0) {
        const rect =
          wrapperRef.current?.getBoundingClientRect();
        setMenu({
          x: rect?.left ?? 0,
          y: rect?.bottom ?? 0,
        });
      } else {
        setMenu({ x: e.clientX, y: e.clientY });
      }
    },
    []
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  return (
    // The context menu is a shortcut; the same action
    // is reachable by keyboard via the context-menu key.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div ref={wrapperRef} onContextMenu={handleContextMenu}>
      <Tooltip tooltipKey="kit" position="bottom">
        <LcdSelect
          id="kit-select"
          value={currentKit.id}
          options={KIT_OPTIONS}
          onChange={(id) => {
            const kit = kitsData.kits.find(
              k => k.id === id
            );
            if (kit) actions.setKit(kit);
          }}
          className="h-9 w-full lg:w-28"
        />
      </Tooltip>
      {menu !== null && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          aria-label="Kit options"
          onClose={closeMenu}
        >
          <button
            role="menuitem"
            onClick={() => {
              setExportKey(k => k + 1);
              setExportOpen(true);
              setMenu(null);
            }}
            className={MENU_ITEM}
          >
            <span>Export kit…</span>
          </button>
        </ContextMenu>
      )}
      {exportOpen && (
        <ExportKitDialog
          key={exportKey}
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          kit={currentKit}
          customSamples={customSamples}
          disabledSamples={disabledSamples}
        />
      )}
    </div>
  );
}
