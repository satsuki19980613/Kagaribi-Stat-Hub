import { useState } from 'react';
import { longDate, shortDate } from '../domain/date';
import type { AppData, MatchRecord } from '../domain/model';
import { fmtPt, pointsOf } from '../domain/points';
import { seasonRange } from '../domain/season';
import { Back, ConfirmDialog, PaneHead } from '../components/ui';
import { SeasonSelect } from './common';

/** ポイントの増減に応じたクラス（+ は gain、− は loss）。 */
function toneOf(v: number): string {
  if (v > 0) return 'gain';
  if (v < 0) return 'loss';
  return '';
}

/** 記録履歴。シーズンごとに日付でまとめて並べる。日付を開くと記録画面で修正、× で 1 件削除。 */
export function HistoryScreen(
  props: Readonly<{
    data: AppData;
    seasons: number[];
    season: number;
    onSeason: (no: number) => void;
    onOpenDate: (date: string) => void;
    onDelete: (rec: MatchRecord) => void;
    onBack: () => void;
  }>,
): JSX.Element {
  const { data, season } = props;
  const [del, setDel] = useState<MatchRecord | null>(null);
  const range = seasonRange(season, data.seasons);
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  const order = new Map(data.members.map((m) => [m.id, m.order]));
  const inSeason = data.records.filter((r) => r.date >= range.start && r.date <= range.end);
  const byDate = new Map<string, MatchRecord[]>();
  for (const r of inSeason) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  const dates = [...byDate.keys()].sort((a, b) => a.localeCompare(b)).reverse();

  return (
    <div className="pane">
      <Back onClick={props.onBack} />
      <PaneHead eyebrow="HISTORY" title="記録履歴" />
      <SeasonSelect seasons={props.seasons} value={season} onChange={props.onSeason} overrides={data.seasons} />

      {dates.length === 0 ? (
        <div className="empty">
          <span className="eyebrow">NO RECORDS</span>
          <p>S{season} の記録はまだありません。</p>
        </div>
      ) : (
        dates.map((d) => {
          const rs = (byDate.get(d) ?? []).sort((a, b) => a.rank - b.rank || (order.get(a.memberId) ?? 0) - (order.get(b.memberId) ?? 0));
          const total = rs.reduce((a, r) => a + pointsOf(r.rank), 0);
          return (
            <section key={d} className="day">
              <button type="button" className="day-h" onClick={() => props.onOpenDate(d)}>
                <b>{shortDate(d)}</b>
                <span className="num">
                  {rs.length}人 · {fmtPt(total)}pt
                </span>
                <span className="go">修正 →</span>
              </button>
              <ul className="recs">
                {rs.map((r) => (
                  <li key={r.id} className="rec">
                    <div className="rec-main">
                      <span className="rec-hand">
                        <span className={`rkb r${r.rank}`}>{r.rank}</span>
                        <span className="nm">{name.get(r.memberId) ?? '（不明）'}</span>
                      </span>
                      <span className={`rec-vd ${toneOf(pointsOf(r.rank))}`}>{fmtPt(pointsOf(r.rank))}pt</span>
                      {r.part && <span className="rec-sub">{r.part}部</span>}
                    </div>
                    <button type="button" className="rec-x" aria-label="この記録を削除" onClick={() => setDel(r)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {del && (
        <ConfirmDialog
          eyebrow="DELETE"
          title="記録を削除します"
          body={`${longDate(del.date)}　${name.get(del.memberId) ?? ''}　${del.rank}位（${fmtPt(pointsOf(del.rank))}pt）`}
          okLabel="削除"
          danger
          onOk={() => props.onDelete(del)}
          onClose={() => setDel(null)}
        />
      )}
    </div>
  );
}
