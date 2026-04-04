import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../app/ErrorBoundary';

function BombComponent(): JSX.Element {
  throw new Error('Boom!');
}

function SafeComponent() {
  return <p>All good</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('All good'))
      .toBeInTheDocument();
  });

  it('renders default fallback when child throws', () => {
    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong.'))
      .toBeInTheDocument();
    expect(screen.getByText('Try again'))
      .toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<p>Custom error</p>}>
        <BombComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom error'))
      .toBeInTheDocument();
  });

  it('calls onError callback with error and info', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <BombComponent />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message)
      .toBe('Boom!');
  });

  it('resets and re-renders children on retry', () => {
    let shouldThrow = true;

    function MaybeBomb() {
      if (shouldThrow) throw new Error('Boom!');
      return <p>Recovered</p>;
    }

    render(
      <ErrorBoundary>
        <MaybeBomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong.'))
      .toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try again'));
    expect(screen.getByText('Recovered'))
      .toBeInTheDocument();
  });
});
