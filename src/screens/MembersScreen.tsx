import { useState } from 'react';
import { longDate, shortDate } from '../domain/date';
import type { AppData, Member, StatSnapshot } from '../domain/model';
import { MAX_ACTIVE_MEMBERS } from '../domain/model';
import { latestSnapshot, latestSurvivalSnapshot, matchCountOf, survivalOf } from '../domain/stats';
import { Back, ConfirmDialog, InfoButton, InfoList, Modal, PaneHead } from '../components/ui';
import { parseStatText, readNum } from '../domain/statInput';

export interface MemberSave {
  /** 新規なら null。 */
  id: string | null;
  name: string;
  /** 表示する参加回数（自動カウント込み）。 */
  matches: number;
  /** 入力があればスナップショットとして残す。 */
  stats: { wins?: number; vpip?: number; hands?: number } | null;
}

/** メンバー情報登録。有効メンバーは最大 20 人、外した人はアーカイブに残す。 */
export function MembersScreen(props: {
  data: AppData;
  today: string;
  onSave: (s: MemberSave) => Promise<string | null>;
  onArchive: (m: Member, archived: boolean) => void;
  onPurge: (m: Member) => void;
  onDeleteSnapshot: (s: StatSnapshot) => void;
  onBack: () => void;
}): JSX.Element {
  const { data } = props;
  const [edit, setEdit] = useState<Member | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const active = data.members.filter((m) => !m.archived);
  const archived = data.members.filter((m) => m.archived);
  const full = active.length >= MAX_ACTIVE_MEMBERS;

  const row = (m: Member): JSX.Element => {
    const snap = latestSurvivalSnapshot(data.snapshots, m.id);
    const surv = survivalOf(snap);
    return (
      <li key={m.id} className="rec">
        <button type="button" className="rec-main" onClick={() => setEdit(m)}>
          <span className="rec-hand">
            <span className="nm">{m.name}</span>
          </span>
          <span className="rec-act">
            {surv != null ? (
              <>
                {surv.toFixed(1)}
                <span className="hs-unit">ターン</span>
              </>
            ) : (
              <span className="muted">生存T 未入力</span>
            )}
          </span>
          <span className="rec-sub">
            <span>参加 {matchCountOf(m, data.records)}回</span>
            {snap && <span>スタッツ {shortDate(snap.date)}</span>}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="pane">
      <Back label="MENU" onClick={props.onBack} />
      <PaneHead eyebrow="MEMBERS" title="メンバー">
        <InfoButton title="メンバー">
          <InfoList
            items={[
              ['人数', `有効メンバーは最大 ${MAX_ACTIVE_MEMBERS} 人。外したメンバーはアーカイブに残り（記録はそのまま）、いつでも戻せます。`],
              ['参加回数', 'はじめにこれまでの回数を入れると、あとは記録するたびに自動で +1 されます。'],
              ['基本スタッツ', '優勝回数・VPIP・参加ハンド数は任意です。入力した日の値として残り、生存ターン数の計算に使います。'],
              ['右の数字', '最新のスタッツから計算した生存ターン数です。'],
            ]}
          />
        </InfoButton>
        <button type="button" className="btn sm primary" disabled={full} onClick={() => setEdit('new')}>
          ＋ 追加
        </button>
      </PaneHead>
      <p className="hint">
        有効メンバー <b className="num">{active.length}</b> / {MAX_ACTIVE_MEMBERS} 人
      </p>
      {full && <div className="notice warn">有効メンバーが上限の {MAX_ACTIVE_MEMBERS} 人です。追加するには誰かをアーカイブしてください。</div>}

      {active.length === 0 ? (
        <div className="empty">
          <span className="eyebrow">NO MEMBERS</span>
          <p>「＋ 追加」からクラブのメンバーを登録してください。</p>
        </div>
      ) : (
        <ul className="recs">{active.map(row)}</ul>
      )}

      {archived.length > 0 && (
        <>
          <button type="button" className={`fold-tg${showArchived ? ' on' : ''}`} onClick={() => setShowArchived((v) => !v)}>
            アーカイブ（{archived.length}人）
          </button>
          {showArchived && <ul className="recs archived">{archived.map(row)}</ul>}
        </>
      )}

      {edit && (
        <MemberModal
          key={edit === 'new' ? 'new' : edit.id}
          member={edit === 'new' ? null : edit}
          data={data}
          today={props.today}
          canRestore={!full}
          onSave={props.onSave}
          onArchive={props.onArchive}
          onPurge={props.onPurge}
          onDeleteSnapshot={props.onDeleteSnapshot}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}

function MemberModal(props: {
  member: Member | null;
  data: AppData;
  today: string;
  canRestore: boolean;
  onSave: (s: MemberSave) => Promise<string | null>;
  onArchive: (m: Member, archived: boolean) => void;
  onPurge: (m: Member) => void;
  onDeleteSnapshot: (s: StatSnapshot) => void;
  onClose: () => void;
}): JSX.Element {
  const { member, data } = props;
  const count = member ? matchCountOf(member, data.records) : 0;
  const [name, setName] = useState(member?.name ?? '');
  const [matches, setMatches] = useState(member ? String(count) : '');
  const [wins, setWins] = useState('');
  const [vpip, setVpip] = useState('');
  const [hands, setHands] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'archive' | 'purge' | null>(null);

  const snaps = member
    ? data.snapshots.filter((s) => s.memberId === member.id).sort((a, b) => (b.date === a.date ? b.createdAt - a.createdAt : b.date < a.date ? -1 : 1))
    : [];
  const last = member ? latestSnapshot(data.snapshots, member.id) : undefined;
  const nRecords = member ? data.records.filter((r) => r.memberId === member.id).length : 0;

  const mv = readNum(matches);
  const vv = readNum(vpip);
  const hv = readNum(hands);
  const preview = mv != null && vv != null && hv != null ? survivalOf({ matches: mv, vpip: vv, hands: hv }) : null;

  function validate(): MemberSave | null {
    const out: string[] = [];
    const nm = name.trim();
    if (!nm) out.push('プレイヤー名を入力してください。');
    else if (data.members.some((m) => m.id !== member?.id && m.name.trim() === nm)) out.push('同じ名前のメンバーがいます（アーカイブを含む）。');
    const m = readNum(matches) ?? (member ? count : 0);
    if (!Number.isInteger(m) || m < 0) out.push('参加回数は 0 以上の整数で入力してください。');
    const st = Number.isInteger(m) && m >= 0 ? parseStatText({ wins, vpip, hands }, m) : { values: null, issues: [] };
    out.push(...st.issues);
    setIssues(out);
    if (out.length) return null;
    return { id: member?.id ?? null, name: nm, matches: m, stats: st.values };
  }

  async function save(): Promise<void> {
    const s = validate();
    if (!s) return;
    setBusy(true);
    const err = await props.onSave(s);
    setBusy(false);
    if (err) setIssues([err]);
    else props.onClose();
  }

  return (
    <Modal
      eyebrow={member ? 'EDIT MEMBER' : 'NEW MEMBER'}
      title={member ? member.name : 'メンバーを追加'}
      onClose={props.onClose}
      foot={
        <div className="btns">
          {member &&
            (member.archived ? (
              <button type="button" className="btn ghost" disabled={!props.canRestore}
                onClick={() => {
                  props.onArchive(member, false);
                  props.onClose();
                }}
              >
                アーカイブから戻す
              </button>
            ) : (
              <button type="button" className="btn ghost" onClick={() => setConfirm('archive')}>
                アーカイブ
              </button>
            ))}
          <button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>
            保存
          </button>
        </div>
      }
    >
      {member?.archived && (
        <div className="notice">
          アーカイブ中のメンバーです。記録画面には出ませんが、過去の記録とスタッツは残っています。
          {!props.canRestore && ' 有効メンバーが上限のため、今は戻せません。'}
        </div>
      )}
      <label className="lbl" htmlFor="m-name">
        プレイヤー名
      </label>
      <input id="m-name" className="tin txt" value={name} maxLength={24} autoComplete="off" onChange={(e) => setName(e.target.value)} />

      <div className="lbl-row">
        <label className="lbl" htmlFor="m-matches">
          参加回数（クラブマッチ）
        </label>
        <InfoButton title="参加回数">
          <p>ゲーム内の「プレイヤー情報」→「クラブマッチ」タブにある参加回数です。</p>
          <p>
            {member
              ? `記録するたびに自動で +1 されます（このアプリでの記録 ${nRecords} 件を含んだ数です）。ゲーム内の値とずれたら、ここで直してください。`
              : 'はじめにこれまでの参加回数を入れてください。以降は記録するたびに自動で +1 されます。'}
          </p>
        </InfoButton>
      </div>
      <input
        id="m-matches"
        className="tin"
        inputMode="numeric"
        placeholder="0"
        value={matches}
        onChange={(e) => setMatches(e.target.value)}
      />

      <h3>
        <i className="gem" />
        基本スタッツ（任意）
        <InfoButton title="基本スタッツ">
          <p>ゲーム内の「プレイヤー情報」→「クラブマッチ」タブの値です。入力は任意で、空欄のままでも保存できます。</p>
          <InfoList
            items={[
              ['残し方', `入れたときだけ、今日（${shortDate(props.today)}）の値として残します。前の値は履歴に残ります。`],
              ['生存ターン数', '参加ハンド数 ÷ (参加回数 × VPIP)。ここで入れた参加回数・VPIP・参加ハンド数から計算します。'],
              ['入れ方', 'VPIP と参加ハンド数は 2 つそろえて入れてください。'],
            ]}
          />
        </InfoButton>
      </h3>
      {last && (
        <p className="hint">
          前回（{longDate(last.date)}）: <span className="nw">参加 {last.matches}回</span>{last.wins != null && ` · 優勝 ${last.wins}回`}
          {last.vpip != null && ` · VPIP ${last.vpip}%`}
          {last.hands != null && ` · 参加ハンド ${last.hands}`}
        </p>
      )}
      <div className="fgrid three">
        <div>
          <label className="lbl" htmlFor="m-wins">
            優勝回数
          </label>
          <input id="m-wins" className="tin" inputMode="numeric" placeholder="—" value={wins} onChange={(e) => setWins(e.target.value)} />
        </div>
        <div>
          <label className="lbl" htmlFor="m-vpip">
            VPIP（%）
          </label>
          <input id="m-vpip" className="tin" inputMode="decimal" placeholder="—" value={vpip} onChange={(e) => setVpip(e.target.value)} />
        </div>
        <div>
          <label className="lbl" htmlFor="m-hands">
            参加ハンド数
          </label>
          <input id="m-hands" className="tin" inputMode="numeric" placeholder="—" value={hands} onChange={(e) => setHands(e.target.value)} />
        </div>
      </div>
      <div className="survprev">
        <span className="statlbl">生存ターン数</span>
        <b className="num">{preview != null && Number.isFinite(preview) ? preview.toFixed(1) : '—'}</b>
      </div>

      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}

      {snaps.length > 0 && (
        <>
          <h3>
            <i className="gem" />
            スタッツの履歴
          </h3>
          <div className="tbl-scroll">
          <table className="tbl stats">
            <thead>
              <tr>
                <th>日付</th>
                <th>参加</th>
                <th>優勝</th>
                <th>VPIP</th>
                <th>参加H</th>
                <th>生存T</th>
                <th aria-label="削除" />
              </tr>
            </thead>
            <tbody>
              {snaps.map((s) => {
                const sv = survivalOf(s);
                return (
                  <tr key={s.id}>
                    <td>{shortDate(s.date)}</td>
                    <td>{s.matches}</td>
                    <td>{s.wins ?? '—'}</td>
                    <td>{s.vpip != null ? `${s.vpip}%` : '—'}</td>
                    <td>{s.hands ?? '—'}</td>
                    <td>{sv != null ? sv.toFixed(1) : '—'}</td>
                    <td>
                      <button type="button" className="x-sm" aria-label={`${shortDate(s.date)} のスタッツを削除`} onClick={() => props.onDeleteSnapshot(s)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}

      {member?.archived && (
        <>
          <h3>
            <i className="gem c" />
            完全に削除
          </h3>
          <p className="hint">このメンバーの記録 {nRecords} 件とスタッツもすべて消えます。元に戻せません。</p>
          <button type="button" className="btn sm danger" onClick={() => setConfirm('purge')}>
            完全に削除する
          </button>
        </>
      )}

      {confirm === 'archive' && member && (
        <ConfirmDialog
          eyebrow="ARCHIVE"
          title={`${member.name} をアーカイブします`}
          body="記録画面の選択肢から外れます。過去の記録・スタッツは残り、いつでも戻せます。"
          okLabel="アーカイブ"
          onOk={() => {
            props.onArchive(member, true);
            props.onClose();
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'purge' && member && (
        <ConfirmDialog
          eyebrow="DELETE"
          title={`${member.name} を完全に削除します`}
          body={`記録 ${nRecords} 件とスタッツの履歴もすべて削除します。この操作は元に戻せません。`}
          okLabel="完全に削除"
          danger
          onOk={() => {
            props.onPurge(member);
            props.onClose();
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </Modal>
  );
}
