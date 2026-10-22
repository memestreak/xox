import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFillMode } from '../../app/hooks/useFillMode';

function press(init: KeyboardEventInit) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'KeyF', ...init })
  );
}
function release() {
  document.dispatchEvent(
    new KeyboardEvent('keyup', { code: 'KeyF' })
  );
}

describe('useFillMode', () => {
  it('starts off', () => {
    const { result } = renderHook(() => useFillMode());
    expect(result.current.fillMode).toBe('off');
    expect(result.current.isFillActive).toBe(false);
    expect(result.current.fillActiveRef.current).toBe(false);
  });

  it('toggleFillLatch latches and unlatches', () => {
    const { result } = renderHook(() => useFillMode());
    act(() => result.current.toggleFillLatch());
    expect(result.current.fillMode).toBe('latched');
    expect(result.current.fillActiveRef.current).toBe(true);
    act(() => result.current.toggleFillLatch());
    expect(result.current.fillMode).toBe('off');
    expect(result.current.fillActiveRef.current).toBe(false);
  });

  it('holding F is momentary; releasing ends it', () => {
    const { result } = renderHook(() => useFillMode());
    act(() => press({}));
    expect(result.current.fillMode).toBe('momentary');
    expect(result.current.fillActiveRef.current).toBe(true);
    act(() => release());
    expect(result.current.fillMode).toBe('off');
    expect(result.current.fillActiveRef.current).toBe(false);
  });

  it('Ctrl+F and Cmd+F toggle the latch', () => {
    const { result } = renderHook(() => useFillMode());
    act(() => press({ ctrlKey: true }));
    expect(result.current.fillMode).toBe('latched');
    act(() => press({ metaKey: true }));
    expect(result.current.fillMode).toBe('off');
  });

  it('momentary takes priority over latched in fillMode', () => {
    const { result } = renderHook(() => useFillMode());
    act(() => result.current.toggleFillLatch());
    act(() => result.current.setFillHeld(true));
    expect(result.current.fillMode).toBe('momentary');
  });

  it('releasing a hold also clears the latch', () => {
    const { result } = renderHook(() => useFillMode());
    act(() => result.current.toggleFillLatch());
    act(() => result.current.setFillHeld(true));
    act(() => result.current.setFillHeld(false));
    expect(result.current.fillMode).toBe('off');
  });

  it('ignores key repeat and form fields', () => {
    const { result } = renderHook(() => useFillMode());
    act(() => press({ repeat: true }));
    expect(result.current.fillMode).toBe('off');

    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', {
        code: 'KeyF', bubbles: true,
      }));
    });
    expect(result.current.fillMode).toBe('off');
    input.remove();
  });

  it('reset clears latch, hold and ref', () => {
    const { result } = renderHook(() => useFillMode());
    act(() => {
      result.current.toggleFillLatch();
      result.current.setFillHeld(true);
    });
    act(() => result.current.reset());
    expect(result.current.fillMode).toBe('off');
    expect(result.current.fillActiveRef.current).toBe(false);
  });

  it('removes key listeners on unmount', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useFillMode());
    unmount();
    const types = remove.mock.calls.map(c => c[0]);
    expect(types).toContain('keydown');
    expect(types).toContain('keyup');
    remove.mockRestore();
  });
});
