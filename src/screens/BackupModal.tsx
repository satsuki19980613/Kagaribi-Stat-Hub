import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog, InfoButton, InfoList, Modal } from '../components/ui';
import type { FileStatus } from '../data/autoBackup';
import { listBackups } from '../data/store';
import type { BackupEntry } from '../domain/autoBackup';
import { parseBackup, toBackup } from '../domain/backup';
import { todayIso } from '../domain/date';
import type { AppData } from '../domain/model';

function fmtAt(ms: number): string {
  const d = new Date(ms);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * バックアップ。
 * - 自動（端末内の履歴）: データを変えるたびに自動で残る。ここから好きな時点に戻せる
 * - 自動（ファイル）: PC の Chrome / Edge なら、選んだファイルへ毎回自動で書き出す
 * - 手動: JSON の書き出し・読み込み（機種変更など）
 */
export function BackupModal(props: {
  data: AppData;
  file: FileStatus;
  persisted: boolean | null;
  onChooseFile: () => Promise<void>;
  onResumeFile: () => Promise<void>;
  onStopFile: () => Promise<void>;
  onImport: (d: AppData, label: string) => Promise<void>;
  onClose: () => void;
}): JSX.Element {
  const { data, file } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<BackupEntry[] | null>(null);
  const [pending, setPending] = useState<{ data: AppData; label: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listBackups()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [data]);

  function exportJson(): void {
    const blob = new Blob([JSON.stringify(toBackup(data), null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kagaribi-stat-hub-${todayIso()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr(null);
    try {
      setPending({ data: parseBackup(JSON.parse(await f.text())), label: f.name });
    } catch (x) {
      setErr(x instanceof SyntaxError ? 'JSON として読めませんでした。' : x instanceof Error ? x.message : String(x));
    }
  }

  async function act(fn: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal eyebrow="BACKUP" title="バックアップ" onClose={props.onClose}>
      <h3>
        <i className="gem" />
        自動バックアップ（この端末）
        <InfoButton title="自動バックアップ（この端末）">
          <p>記録・メンバー・シーズン設定を変えるたびに、全体のコピーを自動で残します。</p>
          <InfoList
            items={[
              ['残る数', '直近 30 件と、それより前は 1 日 1 件を 60 日ぶん。内容が変わっていなければ残しません。'],
              ['戻し方', '「この時点に戻す」を押します。間違えて消したときは、1 つ前の時点に戻せば取り消せます。戻す前の状態も履歴に残ります。'],
              ['注意', 'ブラウザのデータを消すと一緒に消えます。ときどき「書き出す」でファイルにも保存してください。'],
            ]}
          />
        </InfoButton>
        <span className="mtag" style={{ marginLeft: 'auto' }}>
          ON
        </span>
      </h3>
      {history == null ? (
        <p className="hint">読み込み中…</p>
      ) : history.length === 0 ? (
        <p className="hint">まだありません</p>
      ) : (
        <ul className="bk-list">
          {history.map((b, i) => (
            <li key={b.id}>
              <span className="num">{fmtAt(b.at)}</span>
              <span className="muted">
                メンバー {b.members} · 記録 {b.records}
              </span>
              {i === 0 ? (
                <span className="mtag">最新</span>
              ) : (
                <button type="button" className="btn sm ghost" onClick={() => setPending({ data: b.data, label: `${fmtAt(b.at)} の自動バックアップ` })}>
                  この時点に戻す
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3>
        <i className="gem" />
        ファイルへ自動保存
        <InfoButton title="ファイルへ自動保存">
          <InfoList
            items={[
              ['使える所', 'PC の Chrome / Edge。スマホのブラウザでは使えません。'],
              ['しくみ', '選んだ JSON ファイルへ、変更のたびに自動で書き出します。ブラウザのデータが消えても、このファイルを「読み込む」で戻せます。'],
              ['開き直したとき', 'ブラウザを開き直したら、メニューに出る「再開」を 1 回押します（ブラウザの決まりで、書き込みの許可を出し直す必要があります）。'],
            ]}
          />
        </InfoButton>
        {file.state === 'on' && (
          <span className="mtag" style={{ marginLeft: 'auto' }}>
            ON
          </span>
        )}
      </h3>
      {file.state === 'unsupported' ? (
        <p className="hint">このブラウザでは使えません</p>
      ) : (
        <>
          {file.state === 'off' && (
            <button type="button" className="btn wide primary" disabled={busy} onClick={() => void act(props.onChooseFile)}>
              保存先のファイルを選ぶ
            </button>
          )}
          {(file.state === 'needs-permission' || file.state === 'error') && (
            <>
              <div className="notice warn">
                {file.state === 'error' ? `書き出せませんでした（${file.error ?? ''}）。` : '自動保存が止まっています。'}
                保存先: <b>{file.name}</b>
              </div>
              <div className="btns">
                <button type="button" className="btn ghost" disabled={busy} onClick={() => void act(props.onStopFile)}>
                  やめる
                </button>
                <button type="button" className="btn primary" disabled={busy} onClick={() => void act(props.onResumeFile)}>
                  自動保存を再開
                </button>
              </div>
            </>
          )}
          {file.state === 'on' && (
            <>
              <dl className="spec">
                <dt>FILE</dt>
                <dd>保存先</dd>
                <dd className="tag">{file.name}</dd>
                <dt>SAVED</dt>
                <dd>最後に保存</dd>
                <dd className="tag">{file.lastAt ? fmtAt(file.lastAt) : '—'}</dd>
              </dl>
              <div className="btns">
                <button type="button" className="btn ghost" disabled={busy} onClick={() => void act(props.onStopFile)}>
                  やめる
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void act(props.onChooseFile)}>
                  保存先を変える
                </button>
              </div>
            </>
          )}
        </>
      )}

      <h3>
        <i className="gem" />
        手動（書き出し・読み込み）
        <InfoButton title="手動（書き出し・読み込み）">
          <InfoList
            items={[
              ['使いどき', '機種変更や、別のブラウザへ移すとき。'],
              ['書き出す', '今のデータを JSON ファイルに保存します。'],
              ['読み込む', 'ファイルの内容で今のデータを置き換えます。置き換える前の状態は自動バックアップに残ります。'],
              ['保存領域の保護', '有効なら、容量が足りなくなってもブラウザが勝手にデータを消しません。'],
            ]}
          />
        </InfoButton>
      </h3>
      <div className="btns">
        <button type="button" className="btn" onClick={exportJson}>
          書き出す
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          読み込む
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onPick(e)} />
      {err && (
        <ul className="issues">
          <li>{err}</li>
        </ul>
      )}
      <p className="hint">
        保存領域の保護:{' '}
        {props.persisted == null ? 'このブラウザでは確認できません' : props.persisted ? '有効' : '未許可'}
      </p>

      {pending && (
        <ConfirmDialog
          eyebrow="RESTORE"
          title="今のデータを置き換えます"
          body={`${pending.label}: メンバー ${pending.data.members.length} 人・記録 ${pending.data.records.length} 件・スタッツ ${pending.data.snapshots.length} 件。置き換える前の今の状態は自動バックアップに残ります。`}
          okLabel="置き換える"
          danger
          onOk={() => {
            void props.onImport(pending.data, pending.label);
          }}
          onClose={() => setPending(null)}
        />
      )}
    </Modal>
  );
}
