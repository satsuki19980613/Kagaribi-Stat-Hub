import { useState } from 'react';
import { BarChart, LineChart, type LineSeries } from '../components/charts';
import { Back, Modal, PaneHead } from '../components/ui';
import { longDate, shortDate } from '../domain/date';
import { MAX_FOCUS, slotOf, type FocusEntry } from '../domain/focus';
import type { AppData, Member } from '../domain/model';
import { fmtPt, pointsOf } from '../domain/points';
import { matchDays, seasonRange } from '../domain/season';
import { fmtNum, fmtRate, matchCountOf, recordsInRange, summarize } from '../domain/stats';
import {
  TREND_METRICS,
  clubTotal,
  md,
  seasonAxis,
  seasonCumulative,
  seasonRows,
  seasonsOfMember,
  trendValue,
  type MemberSeasonRow,
  type TrendMetric,
} from '../domain/views';
import { SeasonSelect } from './common';

type Mode = 'season' | 'trend';
type SortKey = 'name' | 'total' | 'avg' | 'plusRate' | 'winRate' | 'avgRank' | 'n' | 'survival';

const COLS: { key: SortKey; label: string; title: string }[] = [
  { key: 'total', label: '合計', title: '合計ポイント' },
  { key: 'avg', label: '平均', title: '平均ポイント' },
  { key: 'plusRate', label: '加点率', title: '1〜4位の割合' },
  { key: 'winRate', label: '1位率', title: '1位の割合' },
  { key: 'avgRank', label: '平均順位', title: '平均順位' },
  { key: 'n', label: '参加', title: '参加数' },
  { key: 'survival', label: '生存T', title: '生存ターン数（シーズン末時点）' },
];

function sortValue(r: MemberSeasonRow, k: SortKey): number | string | null {
  switch (k) {
    case 'name':
      return r.member.name;
    case 'n':
      return r.sum.n;
    case 'total':
      return r.sum.n ? r.sum.total : null;
    case 'survival':
      return r.survival;
    default:
      return r.sum[k];
  }
}

function fmtMetric(metric: TrendMetric, v: number): string {
  switch (metric) {
    case 'total':
      return fmtPt(Math.round(v));
    case 'avg':
      return v.toFixed(2);
    case 'plusRate':
    case 'winRate':
      return `${v.toFixed(0)}%`;
    case 'avgRank':
      return v.toFixed(2);
    case 'survival':
      return v.toFixed(1);
  }
}

/** 注目メンバーの選択（グラフの凡例を兼ねる）。 */
function MemberChips(props: { members: Member[]; focus: FocusEntry[]; onToggle: (id: string) => void; onClear: () => void }): JSX.Element {
  const full = props.focus.length >= MAX_FOCUS;
  return (
    <div className="chips-wrap">
      <div className="chips" role="group" aria-label="グラフで強調するメンバー">
        {props.members.map((m) => {
          const slot = slotOf(props.focus, m.id);
          return (
            <button
              key={m.id}
              type="button"
              className={`chip${slot != null ? ` on s${slot + 1}` : ''}`}
              aria-pressed={slot != null}
              disabled={slot == null && full}
              onClick={() => props.onToggle(m.id)}
            >
              <i className="key" />
              {m.name}
            </button>
          );
        })}
      </div>
      <div className="chips-foot">
        <span>
          強調 {props.focus.length} / {MAX_FOCUS}（ほかは灰色の線）
        </span>
        {props.focus.length > 0 && (
          <button type="button" className="lnk" onClick={props.onClear}>
            すべて解除
          </button>
        )}
      </div>
    </div>
  );
}

export function StatsScreen(props: {
  data: AppData;
  today: string;
  seasons: number[];
  season: number;
  onSeason: (no: number) => void;
  focus: FocusEntry[];
  onToggleFocus: (id: string) => void;
  onClearFocus: () => void;
  onBack: () => void;
}): JSX.Element {
  const { data, season, today } = props;
  const [mode, setMode] = useState<Mode>('season');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'total', desc: true });
  const [metric, setMetric] = useState<TrendMetric>('total');
  const [detail, setDetail] = useState<Member | null>(null);

  const range = seasonRange(season, data.seasons);
  const days = matchDays(season, data.seasons);
  const held = days.filter((d) => d <= today).length;
  const recs = recordsInRange(data.records, range.start, range.end);
  const club = summarize(recs);
  const rows = seasonRows(data, season);
  const axis = seasonAxis(data, season);

  const sorted = [...rows].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    if (va == null && vb == null) return a.member.order - b.member.order;
    if (va == null) return 1;
    if (vb == null) return -1;
    const c = typeof va === 'string' ? va.localeCompare(String(vb), 'ja') : (va as number) - (vb as number);
    // 平均順位は小さいほど良いので、「良い順」を既定の向きにそろえる。
    const dir = sort.key === 'avgRank' || sort.key === 'name' ? !sort.desc : sort.desc;
    return (dir ? -c : c) || a.member.order - b.member.order;
  });

  function onSort(key: SortKey): void {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));
  }

  const seasonSeries: LineSeries[] = rows.map((r) => ({
    id: r.member.id,
    name: r.member.name,
    values: seasonCumulative(data, season, r.member.id, today),
    slot: slotOf(props.focus, r.member.id),
  }));

  // シーズン推移: 古い順に並べ、記録がある・有効なメンバーを出す。
  const asc = [...props.seasons].sort((a, b) => a - b);
  const trendMembers = data.members.filter((m) => !m.archived || data.records.some((r) => r.memberId === m.id));
  const trendSeries: LineSeries[] = trendMembers.map((m) => ({
    id: m.id,
    name: m.name,
    values: asc.map((no) => trendValue(data, no, m.id, metric)),
    slot: slotOf(props.focus, m.id),
  }));
  const metricInfo = TREND_METRICS.find((t) => t.key === metric)!;

  return (
    <div className="pane wide">
      <Back label="MENU" onClick={props.onBack} />
      <PaneHead eyebrow="STATS" title="スタッツ" />
      <div className="seg" role="group" aria-label="表示">
        <button type="button" aria-pressed={mode === 'season'} onClick={() => setMode('season')}>
          シーズン内
        </button>
        <button type="button" aria-pressed={mode === 'trend'} onClick={() => setMode('trend')}>
          シーズン推移
        </button>
      </div>

      {mode === 'season' && (
        <>
          <SeasonSelect seasons={props.seasons} value={season} onChange={props.onSeason} overrides={data.seasons} />
          <div className="hs-grid">
            <div className="hs-stat">
              <span className="statlbl">開催</span>
              <b className="hs-val">
                {held}
                <span className="hs-unit">/ {days.length} 日</span>
              </b>
            </div>
            <div className="hs-stat">
              <span className="statlbl">クラブ合計</span>
              <b className={`hs-val${club.total < 0 ? ' loss' : ''}`}>
                {fmtPt(club.total)}
                <span className="hs-unit">pt</span>
              </b>
            </div>
            <div className="hs-stat">
              <span className="statlbl">平均 · 加点率</span>
              <b className="hs-val">
                {fmtNum(club.avg)}
                <span className="hs-unit">{fmtRate(club.plusRate)}</span>
              </b>
            </div>
          </div>

          <section className="panel">
            <div className="panel-h">
              <b>累積ポイント推移</b>
              <span className="rt">
                S{season} · {md(range.start)}〜{md(range.end)}
              </span>
            </div>
            <LineChart
              labels={axis.map(md)}
              series={seasonSeries}
              format={(v) => fmtPt(Math.round(v))}
              zero
              ariaLabel={`S${season} の累積ポイント推移`}
            />
            <MemberChips members={rows.map((r) => r.member)} focus={props.focus} onToggle={props.onToggleFocus} onClear={props.onClearFocus} />
          </section>

          <section className="panel">
            <div className="panel-h">
              <b>メンバー別</b>
              <span className="rt">見出しで並べ替え · 行で詳細</span>
            </div>
            <div className="tbl-scroll">
              <table className="tbl stats">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="th-btn" onClick={() => onSort('name')}>
                        名前{sort.key === 'name' ? (sort.desc ? ' ▲' : ' ▼') : ''}
                      </button>
                    </th>
                    {COLS.map((c) => (
                      <th key={c.key} title={c.title} aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                        <button type="button" className={`th-btn${sort.key === c.key ? ' on' : ''}`} onClick={() => onSort(c.key)}>
                          {c.label}
                          {sort.key === c.key ? (sort.desc ? ' ▼' : ' ▲') : ''}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const slot = slotOf(props.focus, r.member.id);
                    return (
                      <tr key={r.member.id} className={`clk${r.sum.n === 0 ? ' dim' : ''}`} onClick={() => setDetail(r.member)}>
                        <td>
                          <span className={`nmcell${slot != null ? ` s${slot + 1}` : ''}`}>
                            <i className="key" />
                            {r.member.name}
                          </span>
                        </td>
                        <td className={r.sum.total > 0 ? 'gain' : r.sum.total < 0 ? 'loss' : ''}>{r.sum.n ? fmtPt(r.sum.total) : '—'}</td>
                        <td>{fmtNum(r.sum.avg)}</td>
                        <td>{fmtRate(r.sum.plusRate)}</td>
                        <td>{fmtRate(r.sum.winRate)}</td>
                        <td>{fmtNum(r.sum.avgRank)}</td>
                        <td>{r.sum.n}</td>
                        <td className={r.survivalStale ? 'stale' : ''} title={r.survivalDate ? `${longDate(r.survivalDate)} の値` : undefined}>
                          {fmtNum(r.survival, 1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="hint">
              加点率 = 1〜4位の割合。生存T = 参加ハンド数 ÷ (参加回数 × VPIP)。シーズン末時点で最新のスタッツから計算し、
              シーズンより前に入力した値は薄く表示します。
            </p>
          </section>
        </>
      )}

      {mode === 'trend' && (
        <>
          <select className="tin" aria-label="指標" value={metric} onChange={(e) => setMetric(e.target.value as TrendMetric)}>
            {TREND_METRICS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <section className="panel">
            <div className="panel-h">
              <b>{metricInfo.label}の推移</b>
              <span className="rt">シーズンごと</span>
            </div>
            <LineChart
              labels={asc.map((no) => `S${no}`)}
              series={trendSeries}
              format={(v) => fmtMetric(metric, v)}
              zero={metric === 'total' || metric === 'avg'}
              tickFormat={(v) => (metric === 'total' ? fmtPt(Math.round(v)) : metric === 'plusRate' || metric === 'winRate' ? `${v.toFixed(0)}%` : String(Number(v.toFixed(1))))}
              markers
              ariaLabel={`${metricInfo.label}のシーズン推移`}
              empty={metric === 'survival' ? 'シーズン中に入力したスタッツがありません' : undefined}
            />
            <MemberChips members={trendMembers} focus={props.focus} onToggle={props.onToggleFocus} onClear={props.onClearFocus} />
            {metric === 'survival' && <p className="hint">各シーズン中に入力したスタッツの最新値です。入力の無いシーズンは線が途切れます。</p>}
          </section>

          <section className="panel">
            <div className="panel-h">
              <b>{metricInfo.label}（表）</b>
              <span className="rt">{metricInfo.unit}</span>
            </div>
            <div className="tbl-scroll">
              <table className="tbl stats">
                <thead>
                  <tr>
                    <th>名前</th>
                    {[...asc].reverse().map((no) => (
                      <th key={no}>S{no}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trendSeries.map((s) => (
                    <tr key={s.id} className="clk" onClick={() => setDetail(trendMembers.find((m) => m.id === s.id) ?? null)}>
                      <td>
                        <span className={`nmcell${s.slot != null ? ` s${s.slot + 1}` : ''}`}>
                          <i className="key" />
                          {s.name}
                        </span>
                      </td>
                      {[...s.values].reverse().map((v, i) => (
                        <td key={i}>{v == null ? '—' : fmtMetric(metric, v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-h">
              <b>クラブ合計ポイント</b>
              <span className="rt">メンバー全員の合計</span>
            </div>
            <BarChart
              labels={asc.map((no) => `S${no}`)}
              values={asc.map((no) => clubTotal(data, no))}
              format={(v) => fmtPt(Math.round(v))}
              ariaLabel="クラブ合計ポイントのシーズン推移"
            />
          </section>
        </>
      )}

      {detail && <MemberDetail member={detail} data={data} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** メンバーの詳細（通算・順位分布・シーズン別）。 */
function MemberDetail(props: { member: Member; data: AppData; onClose: () => void }): JSX.Element {
  const { member, data } = props;
  const mine = data.records.filter((r) => r.memberId === member.id);
  const all = summarize(mine);
  const maxDist = Math.max(1, ...all.dist);
  const seasons = seasonsOfMember(data, member.id).reverse();
  const recent = [...mine].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);

  return (
    <Modal eyebrow="MEMBER" title={member.name} size="wide" onClose={props.onClose}>
      <div className="hs-grid">
        <div className="hs-stat">
          <span className="statlbl">通算（アプリ記録）</span>
          <b className={`hs-val${all.total < 0 ? ' loss' : ''}`}>
            {fmtPt(all.total)}
            <span className="hs-unit">pt</span>
          </b>
          <span className="hs-sub">{all.n} 戦</span>
        </div>
        <div className="hs-stat">
          <span className="statlbl">平均 · 加点率</span>
          <b className="hs-val">{fmtNum(all.avg)}</b>
          <span className="hs-sub">加点率 {fmtRate(all.plusRate)}</span>
        </div>
        <div className="hs-stat">
          <span className="statlbl">1位率 · 平均順位</span>
          <b className="hs-val">{fmtRate(all.winRate)}</b>
          <span className="hs-sub">平均 {fmtNum(all.avgRank)} 位</span>
        </div>
      </div>
      <p className="hint">参加回数（ゲーム内の通算・自動カウント）: {matchCountOf(member, data.records)} 回</p>

      <h3>
        <i className="gem" />
        順位の分布
      </h3>
      <div className="dist">
        {all.dist.map((c, i) => (
          <div key={i} className="dist-row">
            <span className={`rkb r${i + 1}`}>{i + 1}</span>
            <span className="dist-bar">
              <i style={{ width: `${(c / maxDist) * 100}%` }} />
            </span>
            <span className="num">
              {c}
              <span className="muted"> · {all.n ? `${Math.round((c / all.n) * 100)}%` : '—'}</span>
            </span>
          </div>
        ))}
      </div>

      <h3>
        <i className="gem" />
        シーズン別
      </h3>
      {seasons.length === 0 ? (
        <p>まだ記録がありません。</p>
      ) : (
        <div className="tbl-scroll">
          <table className="tbl stats">
            <thead>
              <tr>
                <th>シーズン</th>
                <th>合計</th>
                <th>平均</th>
                <th>加点率</th>
                <th>1位率</th>
                <th>平均順位</th>
                <th>参加</th>
                <th>生存T</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((no) => {
                const row = seasonRows(data, no).find((r) => r.member.id === member.id);
                if (!row) return null;
                return (
                  <tr key={no}>
                    <td>S{no}</td>
                    <td className={row.sum.total > 0 ? 'gain' : row.sum.total < 0 ? 'loss' : ''}>{fmtPt(row.sum.total)}</td>
                    <td>{fmtNum(row.sum.avg)}</td>
                    <td>{fmtRate(row.sum.plusRate)}</td>
                    <td>{fmtRate(row.sum.winRate)}</td>
                    <td>{fmtNum(row.sum.avgRank)}</td>
                    <td>{row.sum.n}</td>
                    <td className={row.survivalStale ? 'stale' : ''}>{fmtNum(row.survival, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {recent.length > 0 && (
        <>
          <h3>
            <i className="gem" />
            最近の記録
          </h3>
          <ul className="mini-recs">
            {recent.map((r) => (
              <li key={r.id}>
                <span>{shortDate(r.date)}</span>
                <span className={`rkb r${r.rank}`}>{r.rank}</span>
                <span className="num">{fmtPt(pointsOf(r.rank))}pt</span>
                {r.part && <span className="muted">{r.part}部</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
