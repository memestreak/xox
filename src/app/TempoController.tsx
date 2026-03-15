const MIN_BPM = 20;
const MAX_BPM = 300;

interface TempoControllerProps {
  bpm: number;
  setBpm: (bpm: number) => void;
}

export default function TempoController({ bpm, setBpm }: TempoControllerProps) {
  return (
    <div className="flex items-center gap-1 lg:flex-col lg:items-stretch">
      <label htmlFor="bpm-input" className="text-[10px] uppercase tracking-widest text-neutral-500 lg:mb-1 font-bold">BPM</label>
      <input
        id="bpm-input"
        name="bpm"
        type="number"
        autoComplete="off"
        value={bpm}
        min={MIN_BPM}
        max={MAX_BPM}
        onChange={(e) => setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, Number(e.target.value) || MIN_BPM)))}
        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 w-14 lg:w-20 text-orange-500 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:border-orange-500 transition-colors"
      />
    </div>
  );
}
