
interface TempoControllerProps {
  bpm: number;
  setBpm: (bpm: number) => void;
}

export default function TempoController({ bpm, setBpm }: TempoControllerProps) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 font-bold">BPM</label>
      <input
        type="number"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 w-20 text-orange-500 font-bold focus:outline-none focus:border-orange-500 transition-colors"
      />
    </div>
  );
}
