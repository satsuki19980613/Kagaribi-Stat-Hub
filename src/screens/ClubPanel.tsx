import { useEffect, useState } from 'react';
import { LineChart, type LineSeries } from '../components/charts';
import { ScrollBox } from '../components/ScrollBox';
import type { ClubState } from '../data/clubData';
import { OWN_CLUB, clubSeries, latestRound, ownSeries, topAverage } from '../domain/clubRanking';
import type { AppData } from '../domain/model';
import { clubAppTotals, clubAxisLabels, clubAxisLength } from '../domain/views';

const PICK_KEY = 'ksh-club-pick';

function readPick(): string {
  try {
    return localStorage.getItem(PICK_KEY) ?? '';
  } catch {
    return '';
  }
}

function fmtAt(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const fmtTotal = (v: number): string => String(Math.round(v));
const fmtGain = (v: number): string => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '±0');

/**
 * クラブ順位（上位 30）との比較。メンバーのグラフとは別のパネルにして、単位（クラブの累計）を混ぜない。
 * 線は 3 本まで: 燎（ピンク）・選んだクラブ（青）・上位 30 平均（点線）。比べるクラブは右上のプルダウンで選ぶ。
 */
export function ClubPanel(props: { data: AppData; club: ClubState; season: number; today: string }): JSX.Element {
  const { data, club, season, today } = props;
  const [pick, setPick] = useState(readPick);
  useEffect(() => {
    try {
      localStorage.setItem(PICK_KEY, pick);
    } catch {
      /* noop */
    }
  }, [pick]);

  const cd = club.data;
  const latest = cd ? latestRound(cd, season) : null;
  const n = clubAxisLength(data, season, today, latest?.round ?? 0);
  const labels = clubAxisLabels(data, season, n);
  const app = clubAppTotals(data, season, n, today);
  const own = cd ? ownSeries(cd, season, app) : { values: app, official: app.map(() => false) };
  const others = (latest?.clubs ?? []).filter((c) => c.name !== OWN_CLUB);
  const picked = others.find((c) => c.name === pick) ?? null;
  const ownNow = latest?.clubs.find((c) => c.name === OWN_CLUB) ?? null;

  const series: LineSeries[] = [{ id: 'own', name: OWN_CLUB, values: own.values, slot: 0, tone: 'own' }];
  if (picked && cd) series.push({ id: 'pick', name: picked.name, values: clubSeries(cd, season, picked.name, n), slot: 0 });
  const avg = cd && latest ? topAverage(cd, season, n) : undefined;
  const mixed = own.official.some(Boolean) && own.official.some((v, i) => !v && own.values[i] != null);

  return (
    <section className="panel club">
      <div className="panel-h">
        <b>クラブ順位 · 上位30</b>
        <label className="club-pick">
          <span className="sr">比べるクラブ</span>
          <select value={picked?.name ?? ''} onChange={(e) => setPick(e.target.value)} disabled={others.length === 0}>
            <option value="">比べるクラブ</option>
            {others.map((c) => (
              <option key={c.name} value={c.name}>
                {c.rank}位 {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <LineChart
        labels={labels}
        series={series}
        average={avg}
        averageLabel={{ name: '上位30平均', short: '上位平均' }}
        format={fmtTotal}
        zero
        ariaLabel={`S${season} のクラブ累計ポイント（燎と上位30クラブ）`}
        empty="まだ記録がありません"
      />
      <div className="club-legend">
        <span className="own">
          <i className="key" />
          {OWN_CLUB}
          <span className="muted">{latest ? (ownNow ? ` ${ownNow.rank}位` : ' 圏外') : ''}</span>
        </span>
        {picked && (
          <span className="s1">
            <i className="key" />
            {picked.name}
          </span>
        )}
        {avg && (
          <span className="avg legend-avg">
            <i className="key" />
            上位30平均
          </span>
        )}
      </div>

      {latest && (
        <ScrollBox className="tbl-scroll fixed club-tbl">
          <table className="tbl stats">
            <thead>
              <tr>
                <th>順位</th>
                <th className="nm">クラブ</th>
                <th>累計</th>
                <th>第{latest.round}節</th>
              </tr>
            </thead>
            <tbody>
              {latest.clubs.map((c) => {
                const isOwn = c.name === OWN_CLUB;
                const isPick = c.name === picked?.name;
                return (
                  <tr
                    key={c.name}
                    className={`${isOwn ? 'own-row' : 'clk'}${isPick ? ' pick-row' : ''}`}
                    onClick={isOwn ? undefined : () => setPick(isPick ? '' : c.name)}
                  >
                    <td>
                      {c.rank}
                      <span className="mv">{c.prev == null ? 'new' : c.prev > c.rank ? '↑' : c.prev < c.rank ? '↓' : ''}</span>
                    </td>
                    <td className="nm">{c.name}</td>
                    <td>{c.total}</td>
                    <td className={c.gain > 0 ? 'gain' : c.gain < 0 ? 'loss' : ''}>{fmtGain(c.gain)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollBox>
      )}
      <p className="hint">
        {!cd
          ? club.error
            ? `クラブ順位を読み込めませんでした（${club.error}）。ネットにつながると自動で読み直します。`
            : 'クラブ順位はネットにつながると自動で読み込みます。'
          : !latest
            ? `S${season} の順位はまだありません。`
            : `第${latest.round}節まで。行を押すとそのクラブと比べます。`}
        {mixed
          ? ` ${OWN_CLUB}は上位30に入った節は公式の値、圏外の節はアプリの記録の合計です。`
          : !own.official.some(Boolean)
            ? ` ${OWN_CLUB}の線はアプリの記録の合計です。`
            : ''}
        {club.checkedAt != null && cd && <span className="nw muted"> 確認 {fmtAt(club.checkedAt)}</span>}
      </p>
    </section>
  );
}
