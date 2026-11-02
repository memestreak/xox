import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RetrigEditor from '../app/RetrigEditor';
import type { Retrig } from '../app/retrig';

const dial = (name: 'rate' | 'length') =>
  screen.getByRole('slider', { name: `Retrig ${name}` });
const radio = (name: 'Off' | 'On') =>
  screen.getByRole('radio', { name });

describe('RetrigEditor', () => {
  const onChange = vi.fn();
  const on: Retrig = { enabled: true, rate: 64, length: 0.5 };

  beforeEach(() => {
    onChange.mockClear();
    Element.prototype.setPointerCapture = vi.fn();
  });

  describe('on/off switch', () => {
    it('with no value it is off, the dials at the defaults', () => {
      render(<RetrigEditor value={undefined} onChange={onChange} />);
      expect(radio('Off').getAttribute('aria-checked')).toBe('true');
      expect(radio('On').getAttribute('aria-checked')).toBe('false');
      expect(dial('rate').getAttribute('aria-valuetext')).toBe('1/32');
      expect(dial('length').getAttribute('aria-valuetext')).toBe('1/16');
    });

    it('while off the dials are inert and dimmed', () => {
      render(
        <RetrigEditor
          value={{ ...on, enabled: false }}
          onChange={onChange}
        />,
      );
      const dials = dial('rate').closest('[inert]');
      expect(dials).toBeTruthy();
      expect(dials?.className).toContain('opacity-40');
    });

    it('while on the dials can be used', () => {
      render(<RetrigEditor value={on} onChange={onChange} />);
      expect(radio('On').getAttribute('aria-checked')).toBe('true');
      expect(dial('rate').closest('[inert]')).toBeNull();
    });

    it('On from no value turns on the default 1/32 for 1/16', () => {
      render(<RetrigEditor value={undefined} onChange={onChange} />);
      fireEvent.click(radio('On'));
      expect(onChange).toHaveBeenCalledWith({
        enabled: true, rate: 32, length: 1,
      });
    });

    it('Off keeps the rate and length', () => {
      render(<RetrigEditor value={on} onChange={onChange} />);
      fireEvent.click(radio('Off'));
      expect(onChange).toHaveBeenCalledWith({
        enabled: false, rate: 64, length: 0.5,
      });
    });

    it('On after Off brings back the kept rate and length', () => {
      render(
        <RetrigEditor
          value={{ ...on, enabled: false }}
          onChange={onChange}
        />,
      );
      fireEvent.click(radio('On'));
      expect(onChange).toHaveBeenCalledWith(on);
    });
  });

  describe('rate', () => {
    it('shows the rate as a note value', () => {
      render(<RetrigEditor value={on} onChange={onChange} />);
      expect(dial('rate').getAttribute('aria-valuetext')).toBe('1/64');
    });

    it('arrow keys step through the rates, length kept', () => {
      render(<RetrigEditor value={on} onChange={onChange} />);
      fireEvent.keyDown(dial('rate'), { key: 'ArrowUp' });
      expect(onChange).toHaveBeenLastCalledWith({
        enabled: true, rate: 80, length: 0.5,
      });
      fireEvent.keyDown(dial('rate'), { key: 'ArrowDown' });
      expect(onChange).toHaveBeenLastCalledWith({
        enabled: true, rate: 48, length: 0.5,
      });
    });

    it('Home and End pick the slowest and fastest rate', () => {
      render(<RetrigEditor value={on} onChange={onChange} />);
      fireEvent.keyDown(dial('rate'), { key: 'Home' });
      expect(onChange).toHaveBeenLastCalledWith({
        enabled: true, rate: 5, length: 0.5,
      });
      fireEvent.keyDown(dial('rate'), { key: 'End' });
      expect(onChange).toHaveBeenLastCalledWith({
        enabled: true, rate: 80, length: 0.5,
      });
    });

    it('double-clicking the value resets the rate to 1/32', () => {
      render(<RetrigEditor value={on} onChange={onChange} />);
      fireEvent.doubleClick(
        screen.getByRole('button', { name: /^Rate 1\/64/ }),
      );
      expect(onChange).toHaveBeenLastCalledWith({
        enabled: true, rate: 32, length: 0.5,
      });
    });
  });

  describe('length', () => {
    it('shows the length as a note value', () => {
      render(<RetrigEditor value={on} onChange={onChange} />);
      expect(dial('length').getAttribute('aria-valuetext')).toBe('1/32');
    });

    it('arrow keys step through the lengths, rate kept', () => {
      render(<RetrigEditor value={on} onChange={onChange} />);
      fireEvent.keyDown(dial('length'), { key: 'ArrowUp' });
      expect(onChange).toHaveBeenLastCalledWith({
        enabled: true, rate: 64, length: 1,
      });
      fireEvent.keyDown(dial('length'), { key: 'ArrowDown' });
      expect(onChange).toHaveBeenLastCalledWith({
        enabled: true, rate: 64, length: 0.25,
      });
    });

    it('Home and End pick the shortest and longest length', () => {
      render(<RetrigEditor value={on} onChange={onChange} />);
      fireEvent.keyDown(dial('length'), { key: 'Home' });
      expect(onChange).toHaveBeenLastCalledWith({
        enabled: true, rate: 64, length: 0.125,
      });
      fireEvent.keyDown(dial('length'), { key: 'End' });
      expect(onChange).toHaveBeenLastCalledWith({
        enabled: true, rate: 64, length: 16,
      });
    });

    it('double-clicking the value resets the length to 1/16', () => {
      render(<RetrigEditor value={on} onChange={onChange} />);
      fireEvent.doubleClick(
        screen.getByRole('button', { name: /^Length 1\/32/ }),
      );
      expect(onChange).toHaveBeenLastCalledWith({
        enabled: true, rate: 64, length: 1,
      });
    });
  });
});
