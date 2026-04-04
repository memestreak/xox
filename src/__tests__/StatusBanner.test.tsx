import { render, screen, fireEvent } from '@testing-library/react';
import StatusBanner from '../app/StatusBanner';

describe('StatusBanner', () => {
  it('is collapsed when message is null', () => {
    const { container } = render(
      <StatusBanner message={null} onDismiss={() => {}} />
    );
    const banner = container.firstElementChild!;
    expect(banner.className).toContain('max-h-0');
    expect(banner.className).toContain('border-transparent');
  });

  it('is expanded when message is set', () => {
    const { container } = render(
      <StatusBanner
        message="Kit failed to load"
        onDismiss={() => {}}
      />
    );
    const banner = container.firstElementChild!;
    expect(banner.className).toContain('max-h-[60px]');
    expect(banner.className).toContain('border-amber-700');
    expect(screen.getByText('Kit failed to load'))
      .toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <StatusBanner
        message="Error"
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has role="alert" for accessibility', () => {
    render(
      <StatusBanner message="Oops" onDismiss={() => {}} />
    );
    expect(screen.getByRole('alert'))
      .toBeInTheDocument();
  });
});
