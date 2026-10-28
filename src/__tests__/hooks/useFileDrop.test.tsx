import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useFileDrop, usePreventFileNavigation,
} from '../../app/hooks/useFileDrop';

function Target({ onFile }: { onFile?: (f: File) => void }) {
  const { isOver, handlers } = useFileDrop(onFile);
  return (
    <div data-testid="target" data-over={isOver} {...handlers}>
      <span data-testid="child">child</span>
    </div>
  );
}

function fileDrag(files: File[] = []) {
  return { dataTransfer: { types: ['Files'], files, dropEffect: 'none' } };
}
const textDrag = {
  dataTransfer: { types: ['text/plain'], files: [], dropEffect: 'none' },
};

const target = () => screen.getByTestId('target');
const child = () => screen.getByTestId('child');

describe('useFileDrop', () => {
  it('highlights while a file drag is over, across children', () => {
    render(<Target onFile={vi.fn()} />);
    fireEvent.dragEnter(target(), fileDrag());
    fireEvent.dragEnter(child(), fileDrag());
    fireEvent.dragLeave(target(), fileDrag());
    expect(target()).toHaveAttribute('data-over', 'true');
    fireEvent.dragLeave(child(), fileDrag());
    expect(target()).toHaveAttribute('data-over', 'false');
  });

  it('drops the first file and clears the highlight', () => {
    const onFile = vi.fn();
    render(<Target onFile={onFile} />);
    const a = new File(['a'], 'a.wav');
    const b = new File(['b'], 'b.wav');
    fireEvent.dragEnter(target(), fileDrag());
    fireEvent.drop(child(), fileDrag([a, b]));
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(a);
    expect(target()).toHaveAttribute('data-over', 'false');
  });

  it('accepts a file drag over it', () => {
    render(<Target onFile={vi.fn()} />);
    const over = fireEvent.dragOver(target(), fileDrag());
    // fireEvent returns false when preventDefault was called.
    expect(over).toBe(false);
  });

  it('ignores drags without files', () => {
    const onFile = vi.fn();
    render(<Target onFile={onFile} />);
    fireEvent.dragEnter(target(), textDrag);
    expect(target()).toHaveAttribute('data-over', 'false');
    expect(fireEvent.dragOver(target(), textDrag)).toBe(true);
    fireEvent.drop(target(), textDrag);
    expect(onFile).not.toHaveBeenCalled();
  });

  it('does nothing without a handler', () => {
    render(<Target />);
    fireEvent.dragEnter(target(), fileDrag());
    expect(target()).toHaveAttribute('data-over', 'false');
    expect(fireEvent.dragOver(target(), fileDrag())).toBe(true);
  });

  it('clears when the drag ends elsewhere', () => {
    render(<Target onFile={vi.fn()} />);
    fireEvent.dragEnter(target(), fileDrag());
    fireEvent.dragEnd(window);
    expect(target()).toHaveAttribute('data-over', 'false');
  });
});

describe('usePreventFileNavigation', () => {
  function Page() {
    usePreventFileNavigation();
    return <div data-testid="page" />;
  }

  it('cancels stray file drops so the browser keeps the page', () => {
    render(<Page />);
    const page = screen.getByTestId('page');
    expect(fireEvent.dragOver(page, fileDrag())).toBe(false);
    expect(fireEvent.drop(page, fileDrag())).toBe(false);
    expect(fireEvent.drop(page, textDrag)).toBe(true);
  });
});
