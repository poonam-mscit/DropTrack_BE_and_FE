/**
 * DropTrack mark — teardrop pin with gradient fill, white border, lime
 * verified-drop dot. Ported from apps/web/components/Logo.tsx.
 *
 * Important: every render gets a unique gradient id via React.useId(). With a
 * hardcoded id, mounting two LogoMarks on the same screen made SVG resolve all
 * `url(#…)` references to the first instance — leaving every subsequent one
 * fill-less or flat-coloured.
 */
import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';

interface Props {
  size?: number;
  borderWidth?: number;
}

export function LogoMark({ size = 56, borderWidth = 3.5 }: Props) {
  const reactId = useId();
  // useId() returns ":r0:" etc. — sanitise to a valid SVG id.
  const gid = `dt-grad-${reactId.replace(/:/g, '')}`;
  const w = size;
  const h = Math.round(size * (44 / 36));
  return (
    <Svg width={w} height={h} viewBox="0 0 36 44" fill="none">
      <Defs>
        <LinearGradient id={gid} x1="6" y1="2" x2="32" y2="42" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#6366f1" />
          <Stop offset="0.55" stopColor="#a855f7" />
          <Stop offset="1" stopColor="#a3e635" />
        </LinearGradient>
      </Defs>
      <Path
        d="M18 2C9.163 2 2 9.163 2 18c0 4.74 3.39 10.07 7.08 14.41C12.79 36.78 16.7 40.62 17.4 41.32a.85.85 0 0 0 1.2 0c.7-.7 4.61-4.54 8.32-8.91C30.61 28.07 34 22.74 34 18 34 9.163 26.837 2 18 2Z"
        fill={`url(#${gid})`}
        stroke={borderWidth > 0 ? '#fff' : 'none'}
        strokeWidth={borderWidth}
        strokeLinejoin="round"
      />
      <Circle cx={18} cy={16} r={6.5} fill="#fff" />
      <Circle cx={18} cy={16} r={3} fill="#a3e635" />
    </Svg>
  );
}
