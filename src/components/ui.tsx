import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useBackLayer } from './BackLayer';

/** 炎のマーク（アプリアイコンと同じ形）。色はテーマの --fl1〜--fl7（style.css）。 */
export function FlameMark(): JSX.Element {
  return (
    <svg viewBox="10 6 80 86" aria-hidden="true">
      <defs>
        <linearGradient id="kg-fo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--fl1)' }} />
          <stop offset=".55" style={{ stopColor: 'var(--fl2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--fl3)' }} />
        </linearGradient>
        <linearGradient id="kg-fm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--fl4)' }} />
          <stop offset="1" style={{ stopColor: 'var(--fl5)' }} />
        </linearGradient>
        <linearGradient id="kg-fi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--fl6)' }} />
          <stop offset="1" style={{ stopColor: 'var(--fl7)' }} />
        </linearGradient>
      </defs>
      <path d="M50 10C57 25 74 33 74 57C74 74 63 88 50 88C37 88 26 74 26 59C26 47 32 39 38 33C38 41 41 46 46 48C43 35 46 21 50 10Z" fill="url(#kg-fo)" />
      <path d="M53 34C59 45 67 52 67 65C67 76 59 84 50 84C41 84 33 76 33 67C33 60 37 55 42 51C42 57 45 61 48 62C47 52 49 42 53 34Z" fill="url(#kg-fm)" />
      <path d="M50 55C55 61 59 66 59 72C59 78 55 81 50 81C45 81 41 78 41 73C41 66 46 61 50 55Z" fill="url(#kg-fi)" />
    </svg>
  );
}

export function SunIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}

/** 読み込み中の四角いドット。 */
export function Dots(): JSX.Element {
  return (
    <span className="dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** ← BACK（pane 左上の戻る）。 */
export function Back(props: { label?: string; onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="back" onClick={props.onClick}>
      ← {props.label ?? 'BACK'}
    </button>
  );
}

/** pane の見出し（eyebrow のタグを和文タイトルの箱に乗せる + 右端の操作）。 */
export function PaneHead(props: { eyebrow: string; title: string; children?: ReactNode }): JSX.Element {
  return (
    <div className="pane-h">
      <span className="ph-t">
        <span className="eyebrow">{props.eyebrow}</span>
        <b>{props.title}</b>
      </span>
      {props.children && <span className="acts">{props.children}</span>}
    </div>
  );
}

/**
 * ガラスのモーダル（`<dialog>` を showModal で最前面へ）。開いている間だけマウントする前提。
 * Esc はブラウザの cancel（最前面の dialog だけに届く）で、端末の戻るは backLayers で閉じる。
 */
export function Modal(props: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  size?: 'sm' | 'wide' | 'guide';
  /** 見出し下の操作（元画像ボタン等）。 */
  headActions?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  useBackLayer(props.onClose);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`glass-dlg${props.size ? ` ${props.size}` : ''}`}
      aria-label={props.title}
      onCancel={(e) => {
        e.preventDefault();
        props.onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="dlg">
        <div className="gd-head">
          <span className="eyebrow">{props.eyebrow}</span>
          <h2>{props.title}</h2>
          {props.headActions && <div className="acts">{props.headActions}</div>}
          <button type="button" className="x" aria-label="閉じる" onClick={props.onClose} />
        </div>
        <div className="gd-scroll">{props.children}</div>
        {props.foot && <div className="gd-foot">{props.foot}</div>}
      </div>
    </dialog>
  );
}

/** 確認ダイアログ（削除など）。 */
export function ConfirmDialog(props: {
  eyebrow: string;
  title: string;
  body?: string;
  okLabel: string;
  danger?: boolean;
  onOk: () => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <Modal
      eyebrow={props.eyebrow}
      title={props.title}
      size="sm"
      onClose={props.onClose}
      foot={
        <div className="btns">
          <button type="button" className="btn ghost" onClick={props.onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className={`btn ${props.danger ? 'danger' : 'primary'}`}
            onClick={() => {
              props.onOk();
              props.onClose();
            }}
          >
            {props.okLabel}
          </button>
        </div>
      }
    >
      {props.body && <p>{props.body}</p>}
    </Modal>
  );
}

/**
 * インフォメーションマーク。画面に小さな説明文を並べる代わりに、押すと説明のモーダルを開く。
 * 中身は短い段落・用語と意味の組（InfoList）で、読みやすく書く。
 */
export function InfoButton(props: { title: string; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="info-btn"
        aria-label={`${props.title}の説明`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="10" cy="6.2" r="1.25" fill="currentColor" />
          <path d="M10 9v5.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <Modal eyebrow="INFO" title={props.title} size="sm" onClose={() => setOpen(false)}>
          <div className="info">{props.children}</div>
        </Modal>
      )}
    </>
  );
}

/** 説明モーダルの中の「用語 — 意味」の並び。 */
export function InfoList(props: { items: [ReactNode, ReactNode][] }): JSX.Element {
  return (
    <dl className="info-dl">
      {props.items.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
