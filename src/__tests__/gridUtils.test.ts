import {
  bresenham, cellFromPoint, nearestCellFromPoint,
} from '../app/gridUtils';

describe('bresenham', () => {
  it('yields a single point when start equals end', () => {
    const points = [...bresenham(3, 3, 3, 3)];
    expect(points).toEqual([[3, 3]]);
  });

  it('yields a horizontal line', () => {
    const points = [...bresenham(0, 0, 4, 0)];
    expect(points).toEqual([
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
    ]);
  });

  it('yields a vertical line', () => {
    const points = [...bresenham(2, 0, 2, 3)];
    expect(points).toEqual([
      [2, 0], [2, 1], [2, 2], [2, 3],
    ]);
  });

  it('yields a diagonal line', () => {
    const points = [...bresenham(0, 0, 3, 3)];
    expect(points).toEqual([
      [0, 0], [1, 1], [2, 2], [3, 3],
    ]);
  });

  it('yields a negative-slope line', () => {
    const points = [...bresenham(3, 3, 0, 0)];
    expect(points).toEqual([
      [3, 3], [2, 2], [1, 1], [0, 0],
    ]);
  });

  it('yields correct points for a steep line', () => {
    const points = [...bresenham(0, 0, 1, 4)];
    expect(points.length).toBeGreaterThanOrEqual(5);
    expect(points[0]).toEqual([0, 0]);
    expect(points[points.length - 1]).toEqual([1, 4]);
  });

  it('yields correct points for a shallow line', () => {
    const points = [...bresenham(0, 0, 4, 1)];
    expect(points.length).toBeGreaterThanOrEqual(5);
    expect(points[0]).toEqual([0, 0]);
    expect(points[points.length - 1]).toEqual([4, 1]);
  });
});

describe('cellFromPoint', () => {
  beforeEach(() => {
    // jsdom does not implement elementFromPoint
    if (!document.elementFromPoint) {
      document.elementFromPoint = () => null;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when elementFromPoint returns null', () => {
    vi.spyOn(document, 'elementFromPoint')
      .mockReturnValue(null);
    expect(cellFromPoint(10, 20)).toBeNull();
  });

  it('returns null when element has no data-step', () => {
    const el = document.createElement('div');
    vi.spyOn(document, 'elementFromPoint')
      .mockReturnValue(el);
    expect(cellFromPoint(10, 20)).toBeNull();
  });

  it('returns null when element has data-step but no data-track', () => {
    const el = document.createElement('div');
    el.dataset.step = '5';
    vi.spyOn(document, 'elementFromPoint')
      .mockReturnValue(el);
    expect(cellFromPoint(10, 20)).toBeNull();
  });

  it('returns CellHit when element has both attributes', () => {
    const el = document.createElement('div');
    el.dataset.step = '3';
    el.dataset.track = 'bd';
    vi.spyOn(document, 'elementFromPoint')
      .mockReturnValue(el);

    expect(cellFromPoint(10, 20)).toEqual({
      trackId: 'bd',
      stepIndex: 3,
    });
  });

  it('walks up from nested element to find data-step', () => {
    const parent = document.createElement('div');
    parent.dataset.step = '7';
    parent.dataset.track = 'sd';
    const child = document.createElement('span');
    parent.appendChild(child);

    vi.spyOn(document, 'elementFromPoint')
      .mockReturnValue(child);

    expect(cellFromPoint(10, 20)).toEqual({
      trackId: 'sd',
      stepIndex: 7,
    });
  });

  it('walks up to find data-track when step and track are on different elements', () => {
    const trackEl = document.createElement('div');
    trackEl.dataset.track = 'ch';
    const stepEl = document.createElement('div');
    stepEl.dataset.step = '2';
    trackEl.appendChild(stepEl);
    const inner = document.createElement('span');
    stepEl.appendChild(inner);

    vi.spyOn(document, 'elementFromPoint')
      .mockReturnValue(inner);

    expect(cellFromPoint(10, 20)).toEqual({
      trackId: 'ch',
      stepIndex: 2,
    });
  });
});

describe('nearestCellFromPoint', () => {
  /**
   * Helper: create a container with step elements that
   * have mocked bounding rects nested under a data-track
   * parent.
   */
  function makeGrid(
    cells: {
      trackId: string;
      step: number;
      rect: { left: number; right: number; top: number; bottom: number };
    }[]
  ): HTMLElement {
    const container = document.createElement('div');
    const trackGroups = new Map<string, HTMLElement>();

    for (const c of cells) {
      let trackEl = trackGroups.get(c.trackId);
      if (!trackEl) {
        trackEl = document.createElement('div');
        trackEl.dataset.track = c.trackId;
        container.appendChild(trackEl);
        trackGroups.set(c.trackId, trackEl);
      }
      const btn = document.createElement('button');
      btn.dataset.step = String(c.step);
      btn.getBoundingClientRect = () => ({
        left: c.rect.left,
        right: c.rect.right,
        top: c.rect.top,
        bottom: c.rect.bottom,
        width: c.rect.right - c.rect.left,
        height: c.rect.bottom - c.rect.top,
        x: c.rect.left,
        y: c.rect.top,
        toJSON: () => ({}),
      });
      trackEl.appendChild(btn);
    }
    return container;
  }

  it('returns nearest cell when pointer is in a gap', () => {
    const container = makeGrid([
      { trackId: 'bd', step: 0, rect: { left: 0, right: 40, top: 0, bottom: 32 } },
      { trackId: 'bd', step: 1, rect: { left: 46, right: 86, top: 0, bottom: 32 } },
    ]);
    // Point in the 6px gap between step 0 and step 1
    const result = nearestCellFromPoint(42, 16, container, 30);
    expect(result).toEqual({ trackId: 'bd', stepIndex: 0 });
  });

  it('returns null when pointer is beyond max distance', () => {
    const container = makeGrid([
      { trackId: 'bd', step: 0, rect: { left: 0, right: 40, top: 0, bottom: 32 } },
    ]);
    const result = nearestCellFromPoint(200, 200, container, 30);
    expect(result).toBeNull();
  });

  it('returns cell when pointer is inside its rect', () => {
    const container = makeGrid([
      { trackId: 'sd', step: 3, rect: { left: 100, right: 140, top: 0, bottom: 32 } },
    ]);
    const result = nearestCellFromPoint(120, 16, container, 30);
    expect(result).toEqual({ trackId: 'sd', stepIndex: 3 });
  });

  it('walks up to find data-track from step element', () => {
    const container = makeGrid([
      { trackId: 'ch', step: 5, rect: { left: 0, right: 40, top: 0, bottom: 32 } },
    ]);
    const result = nearestCellFromPoint(20, 16, container, 30);
    expect(result).toEqual({ trackId: 'ch', stepIndex: 5 });
  });

  it('returns nearest cell across multiple tracks', () => {
    const container = makeGrid([
      { trackId: 'bd', step: 0, rect: { left: 0, right: 40, top: 0, bottom: 32 } },
      { trackId: 'sd', step: 0, rect: { left: 0, right: 40, top: 48, bottom: 80 } },
    ]);
    // Point in the 16px gap between rows, closer to sd
    const result = nearestCellFromPoint(20, 44, container, 30);
    expect(result).toEqual({ trackId: 'sd', stepIndex: 0 });
  });

  it('returns null when container has no step elements', () => {
    const container = document.createElement('div');
    const result = nearestCellFromPoint(20, 20, container, 30);
    expect(result).toBeNull();
  });
});
