import { useState } from 'react';
import { Back, Modal, PaneHead } from '../components/ui';
import { daysInMonth, isoOf, parseIso, shortDate, weekdayOf } from '../domain/date';
import type { AppData, SeasonOverride } from '../domain/model';
import {
  defaultSeasonRange,
  isDefaultMatchDay,
  matchDays,
  normalizeOverride,
  overrideOf,
  seasonOf,
  seasonRange,
  validateSeasonEdit,
} from '../domain/season';

/**
 * シーズン設定。既定は暦月で自動判定し、急な短縮・延長・休催があったときだけここで直す。
 */
export function SeasonsScreen(props: {
  data: AppData;
  seasons: number[];
  today: string;
  onSave: (no: number, o: SeasonOverride | null) => void;
  onBack: () => void;
}): JSX.Element {
  const { data } = props;
  const [edit, setEdit] = useState<number | null>(null);
  // 次のシーズンも先に直せるよう 1 つ足して並べる。
  const list = [(props.seasons[0] ?? 31) + 1, ...props.seasons];

  return (
    <div className="pane">
      <Back label="MENU" onClick={props.onBack} />
      <PaneHead eyebrow="SEASONS" title="シーズン設定" />
      <p className="hint">
        シーズンは記録した日付の月から自動で決まります（S31 = 2026年10月、以降 1 か月ごとに +1）。
        公式の日程が急に変わったとき（終了が 1 日早まる・休催日がある等）は、そのシーズンを開いて期間や開催日を直してください。
      </p>
      <ul className="recs">
        {list.map((no) => {
          const r = seasonRange(no, data.seasons);
          const o = overrideOf(no, data.seasons);
          const n = matchDays(no, data.seasons).length;
          const cur = seasonOf(props.today, data.seasons) === no;
          return (
            <li key={no} className="rec">
              <button type="button" className="rec-main" onClick={() => setEdit(no)}>
                <span className="rec-hand">
                  S{no}
                  <small>
                    {shortDate(r.start)} 〜 {shortDate(r.end)}
                  </small>
                </span>
                <span className="rec-act">開催 {n} 日</span>
                <span className="rec-sub">
                  {cur && <span className="mtag">開催中</span>}
                  {r.start > props.today && <span className="mtag">次シーズン</span>}
                  {o ? <span className="mtag c">手動で修正</span> : <span>自動</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {edit != null && (
        <SeasonModal
          key={edit}
          no={edit}
          data={data}
          onSave={(o) => {
            props.onSave(edit, o);
            setEdit(null);
          }}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}

function months(start: string, end: string): { y: number; m: number }[] {
  const a = parseIso(start);
  const b = parseIso(end);
  const out: { y: number; m: number }[] = [];
  for (let i = a.y * 12 + a.m - 1; i <= b.y * 12 + b.m - 1; i += 1) out.push({ y: Math.floor(i / 12), m: (i % 12) + 1 });
  return out;
}

function SeasonModal(props: { no: number; data: AppData; onSave: (o: SeasonOverride | null) => void; onClose: () => void }): JSX.Element {
  const { no, data } = props;
  const cur = seasonRange(no, data.seasons);
  const [start, setStart] = useState(cur.start);
  const [end, setEnd] = useState(cur.end);
  const [toggled, setToggled] = useState<string[]>(overrideOf(no, data.seasons)?.toggled ?? []);
  const def = defaultSeasonRange(no);

  const draft: SeasonOverride = { no, start, end, toggled };
  const issues = validateSeasonEdit(draft, data.seasons);
  const next = normalizeOverride(draft);
  const others = data.seasons.filter((o) => o.no !== no);
  const after = next ? [...others, next] : others;
  const days = issues.length ? [] : matchDays(no, after);
  // この変更でどのシーズンにも入らなくなる記録。
  const orphan = issues.length ? 0 : data.records.filter((r) => seasonOf(r.date, data.seasons) === no && seasonOf(r.date, after) == null).length;
  const recordDays = new Set(data.records.map((r) => r.date));

  function toggle(d: string): void {
    setToggled((t) => (t.includes(d) ? t.filter((x) => x !== d) : [...t, d]));
  }

  return (
    <Modal
      eyebrow="SEASON"
      title={`S${no} の期間と開催日`}
      onClose={props.onClose}
      foot={
        <div className="btns">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setStart(def.start);
              setEnd(def.end);
              setToggled([]);
            }}
          >
            自動に戻す
          </button>
          <button type="button" className="btn primary" disabled={issues.length > 0} onClick={() => props.onSave(next)}>
            保存
          </button>
        </div>
      }
    >
      <p className="hint">
        自動判定: {shortDate(def.start)} 〜 {shortDate(def.end)}<span className="nw">（火・木・土が開催日）</span>
      </p>
      <div className="fgrid">
        <div>
          <label className="lbl" htmlFor="s-start">
            開始日
          </label>
          <input id="s-start" className="tin" type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
        </div>
        <div>
          <label className="lbl" htmlFor="s-end">
            終了日
          </label>
          <input id="s-end" className="tin" type="date" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} />
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {orphan > 0 && (
        <div className="notice warn" style={{ marginTop: 10 }}>
          この変更で、どのシーズンにも入らなくなる記録が {orphan} 件あります（記録は消えませんが、集計から外れます）。
        </div>
      )}

      <h3>
        <i className="gem" />
        開催日（タップで休催／追加開催）
        <span className="muted num" style={{ marginLeft: 'auto', fontWeight: 600 }}>
          {days.length} 日
        </span>
      </h3>
      {issues.length === 0 &&
        months(start, end).map(({ y, m }) => {
          const first = isoOf(y, m, 1);
          const lead = weekdayOf(first);
          const cells: (string | null)[] = [...Array<null>(lead).fill(null)];
          for (let d = 1; d <= daysInMonth(y, m); d += 1) cells.push(isoOf(y, m, d));
          return (
            <div key={`${y}-${m}`} className="cal">
              <div className="cal-h num">
                {y}/{m}
              </div>
              <div className="cal-g">
                {['日', '月', '火', '水', '木', '金', '土'].map((w) => (
                  <span key={w} className="cal-w">
                    {w}
                  </span>
                ))}
                {cells.map((d, i) => {
                  if (!d) return <span key={`e${i}`} />;
                  const inRange = d >= start && d <= end;
                  const on = inRange && isDefaultMatchDay(d) !== toggled.includes(d);
                  const changed = inRange && toggled.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`cal-d${on ? ' on' : ''}${changed ? ' changed' : ''}${recordDays.has(d) ? ' has' : ''}`}
                      disabled={!inRange}
                      aria-pressed={on}
                      aria-label={`${shortDate(d)} ${on ? '開催' : '休み'}`}
                      onClick={() => toggle(d)}
                    >
                      {parseIso(d).d}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      <p className="hint">
        <span className="cal-key on" /> 開催日　<span className="cal-key changed" /> 手動で変えた日　<span className="cal-key has" /> 記録のある日
      </p>
      <p className="hint">開催日は X 軸（得点推移）と「開催 ○ 日」の数え方に使います。開催日以外の日にも記録はできます。</p>
    </Modal>
  );
}
