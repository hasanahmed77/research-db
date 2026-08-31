/**
 * Decorative backdrop: a single impact with cracks running out of it, drawn
 * once behind everything. Faint enough to read as texture — the glass panels
 * blur it rather than hide it.
 */
export function Fracture() {
  const main =
    "M1180 20 L1052 206 L1094 332 L978 470 L1012 602 L878 758 L912 920";
  const branches = [
    "M1052 206 L900 258 L762 220 L620 302",
    "M1094 332 L1224 300 L1330 352 L1440 318",
    "M978 470 L820 502 L700 458 L540 542 L398 500",
    "M1012 602 L1142 660 L1252 618 L1380 702",
    "M878 758 L720 800 L598 758 L470 832 L330 790",
    "M620 302 L520 382 L378 350 L240 422 L88 380",
    "M398 500 L300 572 L178 542 L58 612",
    "M762 220 L742 96 L660 20",
    "M540 542 L556 672 L470 786",
  ];
  const hairs = [
    "M1180 20 L1210 150 L1160 250",
    "M1052 206 L1010 120 L1040 30",
    "M700 458 L660 560 L690 660",
  ];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg className="h-full w-full" viewBox="0 0 1440 900"
           preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="impact" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="1180" cy="20" r="320" fill="url(#impact)" />
        <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
          <path d={main} strokeWidth="1.1" strokeOpacity="0.085" />
          {branches.map((d, i) => (
            <path key={i} d={d} strokeWidth="0.9" strokeOpacity="0.055" />
          ))}
          {hairs.map((d, i) => (
            <path key={`h${i}`} d={d} strokeWidth="0.6" strokeOpacity="0.035" />
          ))}
        </g>
      </svg>
    </div>
  );
}
