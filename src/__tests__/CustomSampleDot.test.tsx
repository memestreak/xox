import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CustomSampleDot from '../app/CustomSampleDot';

describe('CustomSampleDot', () => {
  it('names the file for hover and screen readers', () => {
    render(<CustomSampleDot fileName="kick.wav" />);
    const dot = screen.getByRole('img', {
      name: 'Custom sample: kick.wav',
    });
    expect(dot).toHaveAttribute('title', 'kick.wav');
  });
});
