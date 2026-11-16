import { T20_CONDITIONS } from "../engine/config";
import type { FieldResult, Hand, ShortSide, Zone } from "../engine/types";

const B = T20_CONDITIONS.nominalBoundaryM;
const HALF = T20_CONDITIONS.pitchLengthM / 2;
const CIRCLE = T20_CONDITIONS.circleRadiusM;
const VIEW = 66;

/**
 * PRD §5.1. Bowler's end at the top. theta is clockwise from striker→bowler; r is the
 * fraction of the distance from the striker's stumps to the boundary in that direction.
 */
export function toXY(theta: number, r: number): [number, number] {
  const a = (theta * Math.PI) / 180;
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const sy = HALF; // striker's stumps, in metres from the centre of the pitch
  const dot = sy * uy;
  const t = -dot + Math.sqrt(dot * dot - (sy * sy - B * B));
  return [r * t * ux, sy + r * t * uy];
}

const FILL: Record<Zone, string> = { close: "#dc2626", ring: "#ffffff", deep: "#facc15" };

function Marker({ zone, x, y }: { zone: Zone; x: number; y: number }) {
  const common = { fill: FILL[zone], stroke: "#0f172a", strokeWidth: 0.7 };
  if (zone === "close") return <polygon points={`${x},${y - 2.1} ${x + 1.9},${y + 1.5} ${x - 1.9},${y + 1.5}`} {...common} />;
  if (zone === "deep") return <rect x={x - 1.9} y={y - 1.9} width={3.8} height={3.8} {...common} />;
  return <circle cx={x} cy={y} r={2} {...common} />;
}

type Anchor = "start" | "middle" | "end";
const FONT = 3.5;
const CHAR = 1.95; // approximate glyph width at FONT, in map units

function Label({ x, y, text, anchor = "middle" }: { x: number; y: number; text: string; anchor?: Anchor }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      fontSize={FONT}
      fontWeight={700}
      fill="#ffffff"
      stroke="#052e16"
      strokeWidth={0.9}
      paintOrder="stroke"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {text}
    </text>
  );
}

interface Box { text: string; x: number; y: number; anchor: Anchor }
const span = (b: Box): [number, number] => {
  const w = b.text.length * CHAR;
  return b.anchor === "start" ? [b.x, b.x + w] : b.anchor === "end" ? [b.x - w, b.x] : [b.x - w / 2, b.x + w / 2];
};

/** Nudge labels down until none overlap, then keep them inside the picture. */
function layout(boxes: Box[]): Box[] {
  const done: Box[] = [];
  for (const b of [...boxes].sort((p, q) => p.y - q.y)) {
    let [x0, x1] = span(b);
    if (x0 < -VIEW + 1) b.x += -VIEW + 1 - x0;
    if (x1 > VIEW - 1) b.x -= x1 - (VIEW - 1);
    [x0, x1] = span(b);
    let moved = true;
    while (moved) {
      moved = false;
      for (const o of done) {
        const [o0, o1] = span(o);
        if (x0 < o1 + 1 && o0 < x1 + 1 && Math.abs(b.y - o.y) < FONT + 0.4) {
          b.y = o.y + FONT + 0.5; // strictly past the 0.4 test above, so the loop always ends
          moved = true;
        }
      }
    }
    done.push(b);
  }
  return done;
}

export function FieldMap(props: { field: FieldResult; hand: Hand; shortSide: ShortSide }) {
  const { field, hand, shortSide } = props;
  const [kx, ky] = toXY(field.keeper.theta, field.keeper.r);
  // batter-relative side → screen side
  const shortScreen = shortSide === "none" ? null : (shortSide === "off") === (hand === "R") ? "right" : "left";
  const offRight = hand === "R";

  const placed = field.fielders.map((f) => {
    const [x, y] = toXY(f.theta, f.r);
    return { ...f, x, y };
  });
  // Fixed labels go first so fielder labels move around them.
  const labels = layout([
    { text: "Bowler", x: 0, y: -HALF - 5.2, anchor: "middle" },
    { text: field.keeper.up ? "Keeper (up)" : "Keeper", x: kx, y: ky + 4.4, anchor: "middle" },
    ...placed.map((f): Box => {
      if (f.zone === "deep") return { text: f.name, x: f.x, y: f.y > B * 0.6 ? f.y - 4.6 : f.y + 4.6, anchor: "middle" };
      const right = f.x >= 0;
      return { text: f.name, x: f.x + (right ? 3.2 : -3.2), y: f.y, anchor: right ? "start" : "end" };
    }),
  ]);

  return (
    <svg viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`} className="block w-full" role="img" aria-label={`Field map: ${field.fielders.map((f) => f.name).join(", ")}`}>
      <rect x={-VIEW} y={-VIEW} width={VIEW * 2} height={VIEW * 2} fill="#14532d" />
      <circle cx={0} cy={0} r={B} fill="#15803d" stroke="#ffffff" strokeWidth={0.9} />
      {shortScreen && (
        <>
          <path
            d={shortScreen === "right" ? `M ${B * 0.5} ${-B * 0.866} A ${B} ${B} 0 0 1 ${B * 0.5} ${B * 0.866}` : `M ${-B * 0.5} ${-B * 0.866} A ${B} ${B} 0 0 0 ${-B * 0.5} ${B * 0.866}`}
            fill="none"
            stroke="#fb923c"
            strokeWidth={2.2}
            strokeDasharray="3 2"
          />
          <Label x={shortScreen === "right" ? VIEW - 1 : -VIEW + 1} y={-B * 0.78} text="SHORT" anchor={shortScreen === "right" ? "end" : "start"} />
        </>
      )}
      <path
        d={`M ${-CIRCLE} ${-HALF} A ${CIRCLE} ${CIRCLE} 0 0 1 ${CIRCLE} ${-HALF} L ${CIRCLE} ${HALF} A ${CIRCLE} ${CIRCLE} 0 0 1 ${-CIRCLE} ${HALF} Z`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.6}
        strokeDasharray="1.6 1.6"
        opacity={0.9}
      />
      <rect x={-1.6} y={-HALF} width={3.2} height={HALF * 2} fill="#e7d3a1" stroke="#a16207" strokeWidth={0.3} />
      <text x={offRight ? VIEW - 2 : -VIEW + 2} y={-VIEW + 6} textAnchor={offRight ? "end" : "start"} fontSize={3.6} fontWeight={700} fill="#bbf7d0">OFF SIDE</text>
      <text x={offRight ? -VIEW + 2 : VIEW - 2} y={-VIEW + 6} textAnchor={offRight ? "start" : "end"} fontSize={3.6} fontWeight={700} fill="#bbf7d0">LEG SIDE</text>

      {/* bowler, striker, keeper */}
      <circle cx={0} cy={-HALF - 1.5} r={1.7} fill="#0f172a" stroke="#ffffff" strokeWidth={0.5} />
      <circle cx={0} cy={HALF - 1.2} r={1.5} fill="#1d4ed8" stroke="#ffffff" strokeWidth={0.5} />
      <text x={hand === "R" ? -3 : 3} y={HALF - 0.2} textAnchor={hand === "R" ? "end" : "start"} fontSize={3.2} fontWeight={700} fill="#dbeafe">
        {hand === "R" ? "RHB" : "LHB"}
      </text>
      <circle cx={kx} cy={ky} r={1.7} fill="#0f172a" stroke="#ffffff" strokeWidth={0.5} />

      {placed.map((f) => (
        <g key={f.name}>
          <Marker zone={f.zone} x={f.x} y={f.y} />
          {f.helmet && <circle cx={f.x} cy={f.y} r={3.4} fill="none" stroke="#ffffff" strokeWidth={0.6} strokeDasharray="1 0.8" />}
        </g>
      ))}
      {labels.map((l) => (
        <Label key={l.text} {...l} />
      ))}
    </svg>
  );
}

export function MapLegend() {
  const item = (zone: Zone, label: string) => (
    <span className="inline-flex items-center gap-1">
      <svg viewBox="-3 -3 6 6" className="h-4 w-4">
        <Marker zone={zone} x={0} y={0} />
      </svg>
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-600">
      {item("close", "Close catcher")}
      {item("ring", "Inside the circle")}
      {item("deep", "Outside the circle")}
      <span>◌ Helmet required</span>
    </div>
  );
}
