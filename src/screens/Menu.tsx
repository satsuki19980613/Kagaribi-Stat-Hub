import type { FileStatus } from '../data/autoBackup';
import { shortDate } from '../domain/date';
import type { AppData } from '../domain/model';
import { MAX_ACTIVE_MEMBERS } from '../domain/model';
import { fmtPt } from '../domain/points';
import { isMatchDay, matchDays, seasonOf, seasonRange } from '../domain/season';
import { recordsInRange, summarize } from '../domain/stats';

/** メニュー（ルート）。記録・メンバー情報登録・スタッツビューの 3 つと、補助の操作。 */
export function Menu(props: {
  fileStatus: FileStatus;
  onResumeFile: () => void;
  demo: boolean;
  onResetDemo: () => void;
  data: AppData;
  today: string;
  season: number;
  onRecord: () => void;
  onMembers: () => void;
  onStats: () => void;
  onHistory: () => void;
  onSeasons: () => void;
  onBackup: () => void;
}): JSX.Element {
  const { data, today, season } = props;
  const range = seasonRange(season, data.seasons);
  const days = matchDays(season, data.seasons);
  const held = days.filter((d) => d <= today).length;
  const sum = summarize(recordsInRange(data.records, range.start, range.end));
  const active = data.members.filter((m) => !m.archived).length;
  const todayCount = data.records.filter((r) => r.date === today).length;
  const inSeason = seasonOf(today, data.seasons) != null;
  const matchToday = isMatchDay(today, data.seasons);

  return (
    <div className="pane">
      {props.demo && (
        <div className="notice ok demo-note">
          <b>DEMO</b> サンプルデータ入りのデモ版です。今日を {shortDate(today)} として表示しています。自由に触って大丈夫です。
          <button type="button" className="lnk" onClick={props.onResetDemo}>
            サンプルに戻す
          </button>
        </div>
      )}
      {(props.fileStatus.state === 'needs-permission' || props.fileStatus.state === 'error') && (
        <div className="notice warn demo-note">
          ファイルへの自動保存が止まっています（{props.fileStatus.name}）。
          <button type="button" className="btn sm primary" onClick={props.onResumeFile}>
            再開
          </button>
        </div>
      )}
      <div className="hero panel">
        <div className="hero-top">
          <span className="eyebrow">CLUB 燎 · CLUB MATCH</span>
          <span className="season-tag num">S{season}</span>
        </div>
        <div className="hero-sub">
          <span className="num">
            {shortDate(range.start)} 〜 {shortDate(range.end)}
          </span>
          <span>
            開催 <b className="num">{held}</b>
            <span className="muted"> / {days.length} 日</span>
          </span>
        </div>
        <div className="hs-grid">
          <div className="hs-stat">
            <span className="statlbl">クラブ合計</span>
            <b className={`hs-val${sum.total < 0 ? ' loss' : ''}`}>
              {fmtPt(sum.total)}
              <span className="hs-unit">pt</span>
            </b>
          </div>
          <div className="hs-stat">
            <span className="statlbl">延べ参加</span>
            <b className="hs-val">
              {sum.n}
              <span className="hs-unit">回</span>
            </b>
          </div>
          <div className="hs-stat">
            <span className="statlbl">メンバー</span>
            <b className="hs-val">
              {active}
              <span className="hs-unit">/ {MAX_ACTIVE_MEMBERS}</span>
            </b>
          </div>
        </div>
      </div>

      <div className="list-h">
        <span className="eyebrow">MENU</span>
        <span className="rt">{shortDate(today)}</span>
      </div>
      <button type="button" className="mbtn hot" onClick={props.onRecord}>
        <span>
          記録
          <small>{!inSeason ? 'シーズン期間外の日です' : matchToday ? '今日は開催日です。順位を入力します' : '今日は開催日ではありません'}</small>
        </span>
        <span className="rt">{todayCount > 0 ? `今日 ${todayCount}人` : 'RECORD'}</span>
      </button>
      <button type="button" className="mbtn" onClick={props.onMembers}>
        <span>
          メンバー情報登録
          <small>プレイヤー名・参加回数・基本スタッツ</small>
        </span>
        <span className="rt">
          {active}/{MAX_ACTIVE_MEMBERS}
        </span>
      </button>
      <button type="button" className="mbtn" onClick={props.onStats}>
        <span>
          スタッツビュー
          <small>得点推移・平均pt・加点率・1位率・生存ターン数</small>
        </span>
        <span className="rt">STATS</span>
      </button>

      <div className="subrow">
        <button type="button" className="btn sm ghost" onClick={props.onHistory}>
          記録履歴
        </button>
        <button type="button" className="btn sm ghost" onClick={props.onSeasons}>
          シーズン設定
        </button>
        <button type="button" className="btn sm ghost" onClick={props.onBackup}>
          バックアップ
        </button>
      </div>
      <p className="hint menu-note">記録はこの端末のブラウザに保存され、変更のたびに自動でバックアップされます。</p>
    </div>
  );
}
