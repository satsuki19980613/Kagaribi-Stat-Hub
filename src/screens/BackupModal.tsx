import { useRef, useState } from 'react';
import { ConfirmDialog, Modal } from '../components/ui';
import { parseBackup, toBackup } from '../domain/backup';
import { todayIso } from '../domain/date';
import type { AppData } from '../domain/model';

/** バックアップ（JSON の書き出し・読み込み）。読み込みは全置き換え。 */
export function BackupModal(props: { data: AppData; onImport: (d: AppData) => Promise<void>; onClose: () => void }): JSX.Element {
  const { data } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppData | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
      setPending(parseBackup(JSON.parse(await f.text())));
    } catch (x) {
      setErr(x instanceof SyntaxError ? 'JSON として読めませんでした。' : x instanceof Error ? x.message : String(x));
    }
  }

  return (
    <Modal eyebrow="BACKUP" title="バックアップ" onClose={props.onClose}>
      <p>
        記録はこの端末のブラウザにだけ保存されています。機種変更やブラウザのデータ消去に備えて、ときどき書き出しておいてください。
      </p>
      <dl className="spec">
        <dt>MEMBERS</dt>
        <dd>メンバー</dd>
        <dd className="tag">{data.members.length} 人</dd>
        <dt>RECORDS</dt>
        <dd>記録</dd>
        <dd className="tag">{data.records.length} 件</dd>
        <dt>STATS</dt>
        <dd>スタッツ</dd>
        <dd className="tag">{data.snapshots.length} 件</dd>
      </dl>
      <div className="btns">
        <button type="button" className="btn primary" onClick={exportJson}>
          書き出す（JSON）
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
      {pending && (
        <ConfirmDialog
          eyebrow="IMPORT"
          title="今のデータを置き換えます"
          body={`読み込むファイル: メンバー ${pending.members.length} 人・記録 ${pending.records.length} 件・スタッツ ${pending.snapshots.length} 件。今の端末のデータはすべて消えて、この内容に置き換わります。`}
          okLabel="置き換える"
          danger
          onOk={() => {
            void props.onImport(pending).then(props.onClose);
          }}
          onClose={() => setPending(null)}
        />
      )}
    </Modal>
  );
}
