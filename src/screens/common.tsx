import { shortDate } from '../domain/date';
import type { SeasonOverride } from '../domain/model';
import { seasonRange } from '../domain/season';

/** シーズンの選択（新しい順）。 */
export function SeasonSelect(props: {
  seasons: number[];
  value: number;
  onChange: (no: number) => void;
  overrides: readonly SeasonOverride[];
}): JSX.Element {
  return (
    <select className="tin" aria-label="シーズン" value={props.value} onChange={(e) => props.onChange(Number(e.target.value))}>
      {props.seasons.map((no) => {
        const r = seasonRange(no, props.overrides);
        return (
          <option key={no} value={no}>
            S{no}　{shortDate(r.start)} 〜 {shortDate(r.end)}
          </option>
        );
      })}
    </select>
  );
}

export { readNum } from '../domain/statInput';
