import { useState } from 'react';
import { addDays, longDate, shortDate } from '../domain/date';
import { matchesOnDay, planDay, snapshotOn, type Draft, type DraftRow } from '../domain/dayEntry';
import type { AppData, Member, Part, Rank } from '../domain/model';
import { EMPTY_STAT_TEXT, isBlankStat, readNum, type StatText } from '../domain/statInput';
import { latestSnapshot, survivalOf } from '../domain/stats';
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
  // スタッツ欄を開いているメンバー（任意入力なので普段は閉じておく）。
  const [openStats, setOpenStats] = useState<ReadonlySet<string>>(new Set());

  const season = seasonOf(date, data.seasons);
  const matchDay = isMatchDay(date, data.seasons);
  const day = planDay(data, date, draft);
  const plan = day.rec;
  const dirty = day.dirty;
  const deletes = plan.deletes.length;
  const statN = day.stats.puts.length + day.stats.deletes.length;

  const recordedIds = new Set(data.records.filter((r) => r.date === date).map((r) => r.memberId));
  const rows: Member[] = data.members.filter((m) => !m.archived || recordedIds.has(m.id) || draft[m.id]?.rank != null);

  const entered = Object.values(draft).filter((r) => r.rank != null) as (DraftRow & { rank: Rank })[];
  const dayTotal = entered.reduce((a, r) => a + pointsOf(r.rank), 0);

  function setRow(id: string, row: DraftRow): void {
    props.onDraft({ ...draft, [id]: row });
  }

  function toggleStats(id: string): void {
    setOpenStats((cur) => {
      const nx = new Set(cur);
      if (nx.has(id)) nx.delete(id);
      else nx.add(id);
      return nx;
    });
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
                      <span className="ent-tools">
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
                        <StatToggle
                          open={openStats.has(m.id)}
                          has={!!row.stats && !isBlankStat(row.stats)}
                          error={!!day.stats.issues[m.id]}
                          onClick={() => toggleStats(m.id)}
                        />
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
                  {row.rank != null && openStats.has(m.id) && (
                    <StatDrawer
                      member={m}
                      data={data}
                      date={date}
                      value={row.stats ?? snapshotText(data, m.id, date)}
                      issues={day.stats.issues[m.id] ?? []}
                      onChange={(stats) => setRow(m.id, { ...row, stats })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="savebar">
        <button
          type="button"
          className="btn big primary"
          disabled={!dirty || day.blocked || season == null}
          onClick={() => (deletes > 0 ? setConfirmDel(true) : props.onSave())}
        >
          {day.blocked ? (
            'スタッツの入力を確認してください'
          ) : dirty ? (
            <>
              保存
              <small>
                追加 {plan.added} · 修正 {plan.updated} · 取消 {deletes}
                {statN > 0 && ` · スタッツ ${statN}`}
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

/** その日に保存済みのスタッツ（無ければ空）。 */
function snapshotText(data: AppData, memberId: string, date: string): StatText {
  const s = snapshotOn(data.snapshots, memberId, date);
  return s
    ? { wins: s.wins != null ? String(s.wins) : '', vpip: s.vpip != null ? String(s.vpip) : '', hands: s.hands != null ? String(s.hands) : '' }
    : { ...EMPTY_STAT_TEXT };
}

/** 行の中の小さな切り替え。入力が無いときは点線で控えめに「任意」と見せる。 */
function StatToggle(props: { open: boolean; has: boolean; error: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className={`stat-tg${props.has ? ' has' : ''}${props.error ? ' err' : ''}`}
      aria-expanded={props.open}
      onClick={props.onClick}
    >
      {props.has ? 'スタッツ ✓' : '＋ スタッツ'}
      {!props.has && <span className="opt">任意</span>}
    </button>
  );
}

/** 任意のスタッツ入力（優勝回数・VPIP・参加ハンド数）。前回の値を薄く見せ、空欄のままでよいことを伝える。 */
function StatDrawer(props: {
  member: Member;
  data: AppData;
  date: string;
  value: StatText;
  issues: string[];
  onChange: (v: StatText) => void;
}): JSX.Element {
  const { member, data, date, value } = props;
  const matches = matchesOnDay(member, data.records, date, true);
  const prev = latestSnapshot(
    data.snapshots.filter((s) => s.date < date),
    member.id,
  );
  const v = readNum(value.vpip);
  const h = readNum(value.hands);
  const surv = v != null && h != null ? survivalOf({ matches, vpip: v, hands: h }) : null;
  const field = (key: keyof StatText, label: string, mode: 'numeric' | 'decimal', prevVal: number | undefined, unit?: string): JSX.Element => (
    <label className="sd-f">
      <span>{label}</span>
      <input
        className="tin"
        inputMode={mode}
        value={value[key]}
        placeholder={prevVal != null ? `${prevVal}${unit ?? ''}` : '—'}
        onChange={(e) => props.onChange({ ...value, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="stat-drawer">
      <div className="sd-row">
        {field('wins', '優勝', 'numeric', prev?.wins)}
        {field('vpip', 'VPIP %', 'decimal', prev?.vpip)}
        {field('hands', '参加ハンド', 'numeric', prev?.hands)}
      </div>
      <p className="sd-note">
        {props.issues.length > 0 ? (
          <span className="warn-t">{props.issues[0]}</span>
        ) : (
          <>
            空欄のままで大丈夫です（薄い数字は前回の値）。参加 {matches} 回として残します
            {surv != null && Number.isFinite(surv) && (
              <>
                {' '}
                · 生存T <b className="num">{surv.toFixed(1)}</b>
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}
