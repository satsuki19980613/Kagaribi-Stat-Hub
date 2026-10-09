import { useState } from 'react';
import { addDays, longDate, shortDate } from '../domain/date';
import { planIsEmpty, planSave, type Draft, type DraftRow } from '../domain/dayEntry';
import type { AppData, Member, Part, Rank } from '../domain/model';
import { RANKS, fmtPt, pointsOf } from '../domain/points';
import { isMatchDay, seasonOf } from '../domain/season';
import { Back, ConfirmDialog, PaneHead } from '../components/ui';

export interface Entry {
  date: string;
  draft: Draft;
}

/** date から dir 方向へ、いちばん近い開催日（最大 3 週間先まで）。 */
function nearMatchDay(date: string, dir: 1 | -1, data: AppData): string | null {
  for (let i = 1; i <= 21; i += 1) {
    const d = addDays(date, dir * i);
    if (isMatchDay(d, data.seasons)) return d;
  }
  return null;
}

/**
 * 記録画面。日付を選び、その日に参加したメンバーの順位をタップする（得点は順位から自動）。
 * 既に記録がある日はその内容が入った状態で開くので、そのまま修正・取り消しができる。
 * 1人 1日 1件なので二重記録は起きない。
 */
export function RecordScreen(props: {
  data: AppData;
  entry: Entry;
  today: string;
  onDraft: (d: Draft) => void;
  onDate: (date: string) => void;
  onSave: () => void;
  onBack: () => void;
  onHistory: () => void;
  onMembers: () => void;
}): JSX.Element {
  const { data, entry } = props;
  const { date, draft } = entry;
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const season = seasonOf(date, data.seasons);
  const matchDay = isMatchDay(date, data.seasons);
  const plan = planSave(data.records, date, draft);
  const dirty = !planIsEmpty(plan);
  const deletes = plan.deletes.length;

  const recordedIds = new Set(data.records.filter((r) => r.date === date).map((r) => r.memberId));
  const rows: Member[] = data.members.filter((m) => !m.archived || recordedIds.has(m.id) || draft[m.id]?.rank != null);

  const entered = Object.values(draft).filter((r) => r.rank != null) as (DraftRow & { rank: Rank })[];
  const dayTotal = entered.reduce((a, r) => a + pointsOf(r.rank), 0);

  function setRow(id: string, row: DraftRow): void {
    props.onDraft({ ...draft, [id]: row });
  }

  function goDate(next: string | null): void {
    if (!next || next === date) return;
    if (dirty) setPendingDate(next);
    else props.onDate(next);
  }

  const prev = nearMatchDay(date, -1, data);
  const next = nearMatchDay(date, 1, data);

  return (
    <div className="pane rec-pane">
      <Back label="MENU" onClick={props.onBack} />
      <PaneHead eyebrow="RECORD" title="記録">
        <button type="button" className="btn sm ghost" onClick={props.onHistory}>
          記録履歴
        </button>
      </PaneHead>

      <div className="panel daypick">
        <div className="dayrow">
          <button type="button" className="dnav" aria-label="前の開催日" disabled={!prev} onClick={() => goDate(prev)} />
          <input
            className="tin"
            type="date"
            value={date}
            min="2026-10-01"
            onChange={(e) => {
              if (e.target.value) goDate(e.target.value);
            }}
          />
          <button type="button" className="dnav next" aria-label="次の開催日" disabled={!next} onClick={() => goDate(next)} />
        </div>
        <div className="daymeta">
          {season != null ? <span className="mtag">S{season}</span> : <span className="mtag c">期間外</span>}
          <span>{shortDate(date)}</span>
          {season != null && !matchDay && <span className="warn-t">開催日ではありません</span>}
          {date === props.today && <span className="mtag">TODAY</span>}
          {date > props.today && <span className="warn-t">未来の日付です</span>}
        </div>
        {season == null && (
          <div className="notice warn">
            この日はどのシーズンにも入らないため記録できません。シーズンの期間を変えた場合は、メニューの「シーズン設定」で確認してください。
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <span className="eyebrow">NO MEMBERS</span>
          <p>先にメンバーを登録してください。</p>
          <button type="button" className="btn sm" onClick={props.onMembers}>
            メンバー情報登録へ
          </button>
        </div>
      ) : (
        <>
          <div className="list-h">
            <span className="eyebrow">MEMBERS · タップで順位</span>
            <span className="rt">
              {entered.length}人 · {fmtPt(dayTotal)}pt
            </span>
          </div>
          <ul className="ents">
            {rows.map((m) => {
              const row = draft[m.id] ?? { rank: null, part: null };
              const saved = recordedIds.has(m.id);
              const savedRec = saved ? data.records.find((r) => r.memberId === m.id && r.date === date) : undefined;
              const changed = savedRec ? savedRec.rank !== row.rank || (savedRec.part ?? null) !== row.part : row.rank != null;
              return (
                <li key={m.id} className={`ent${row.rank != null ? ' on' : ''}${changed ? ' changed' : ''}`}>
                  <div className="ent-name">
                    <b>{m.name}</b>
                    <span className="ent-sub">
                      {row.rank != null ? (
                        <span className={`num ${pointsOf(row.rank) > 0 ? 'gain' : pointsOf(row.rank) < 0 ? 'loss' : ''}`}>{fmtPt(pointsOf(row.rank))}pt</span>
                      ) : (
                        <span className="muted">不参加</span>
                      )}
                      {saved && !changed && <span className="mtag">記録済</span>}
                      {saved && changed && <span className="mtag c">{row.rank == null ? '取消' : '修正'}</span>}
                      {m.archived && <span className="mtag">アーカイブ</span>}
                    </span>
                    {row.rank != null && (
                      <span className="partsel" role="group" aria-label="部">
                        {([1, 2] as Part[]).map((p) => (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={row.part === p}
                            onClick={() => setRow(m.id, { ...row, part: row.part === p ? null : p })}
                          >
                            {p}部
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="ranks" role="group" aria-label={`${m.name} の順位`}>
                    {RANKS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`rk r${r}`}
                        aria-pressed={row.rank === r}
                        disabled={season == null}
                        onClick={() => setRow(m.id, { ...row, rank: row.rank === r ? null : r })}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="savebar">
        <button type="button" className="btn big primary" disabled={!dirty || season == null} onClick={() => (deletes > 0 ? setConfirmDel(true) : props.onSave())}>
          {dirty ? (
            <>
              保存
              <small>
                追加 {plan.added} · 修正 {plan.updated} · 取消 {deletes}
              </small>
            </>
          ) : (
            '変更はありません'
          )}
        </button>
      </div>

      {confirmDel && (
        <ConfirmDialog
          eyebrow="DELETE"
          title={`${deletes}件の記録を取り消します`}
          body="順位を外したメンバーの記録を削除して保存します。参加回数の自動カウントも 1 減ります。"
          okLabel="取り消して保存"
          danger
          onOk={props.onSave}
          onClose={() => setConfirmDel(false)}
        />
      )}

      {pendingDate && (
        <ConfirmDialog
          eyebrow="UNSAVED"
          title="保存していない変更があります"
          body={`${longDate(date)} の入力を破棄して ${longDate(pendingDate)} を開きますか？`}
          okLabel="破棄して移動"
          danger
          onOk={() => props.onDate(pendingDate)}
          onClose={() => setPendingDate(null)}
        />
      )}
    </div>
  );
}
