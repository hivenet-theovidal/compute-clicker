'use client';

export interface FloatingNumber {
  id: number;
  value: string;
  x: number;
  y: number;
  crit?: boolean;
}

interface Props {
  numbers: FloatingNumber[];
}

/** Cookie-Clicker style floating "+€" combat text. */
export default function FloatingNumbers({ numbers }: Props) {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-[70]">
      {numbers.map((n) => (
        <div
          key={n.id}
          className="float-credit absolute font-black tabular-nums glow-orange"
          style={{
            left: n.x,
            top: n.y,
            fontSize: n.crit ? 30 : 20,
            color: n.crit ? '#ffd9a8' : '#ff9a33',
            letterSpacing: '-0.02em',
          }}
        >
          +{n.value}
          {n.crit && <span className="ml-1 text-[0.7em] align-top">CRIT!</span>}
        </div>
      ))}
    </div>
  );
}
