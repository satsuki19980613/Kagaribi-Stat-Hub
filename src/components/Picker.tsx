import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBackLayer } from './BackLayer';
import { nextIndex, placePopup, type Placement } from './pickerLogic';

export interface PickItem {
  value: string;
  /** 一覧と欄に出す名前。 */
  label: string;
  /** 左の順位（無ければ空ける）。 */
  rank?: number;
  /** 右に小さく出す補足（累計など）。 */
  note?: string;
}

/**
 * クラブを選ぶプルダウン。ブラウザの select は PC で開いた一覧の色を変えられず、
 * ダークの文字色のまま白地に出て読めないので、一覧も自前で描く。
 *
 * 欄はボタン、開いた一覧は listbox（aria-activedescendant で今の行を示す）。
 * ↑↓・Home・End・PageUp・PageDown で動き、Enter / Space で選び、Esc・Tab・外側のタップ・端末の戻るで閉じる。
 * 一覧はパネルのぼかし（backdrop-filter）や縦スクロールに切られないよう body の直下に出し、
 * 画面のスクロールや大きさが変わったら閉じる。
 */
export function Picker(props: Readonly<{
  value: string;
  items: readonly PickItem[];
  /** 何も選んでいないときの欄の文字。一覧の先頭の「選ばない」行にも使う。 */
  placeholder: string;
  /** 読み上げ用の欄の名前。 */
  label: string;
  /** 一覧の上に出す一行（任意）。 */
  caption?: string;
  /** 欄の中で名前の後ろに添える文字（任意）。 */
  suffix?: string;
  /** 欄の左に置く印（凡例の線など）。 */
  lead?: ReactNode;
  disabled?: boolean;
  onChange: (value: string) => void;
}>): JSX.Element {
  const { value, items, placeholder, onChange } = props;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Placement | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // 先頭は「選ばない」行。
  const rows: readonly PickItem[] = [{ value: '', label: placeholder }, ...items];
  const selIndex = Math.max(
    rows.findIndex((r) => r.value === value),
    0,
  );
  const selected = selIndex > 0 ? rows[selIndex] : null;

  const close = (refocus: boolean): void => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };
  useBackLayer(() => close(true), open);

  const show = (at: number): void => {
    if (props.disabled) return;
    setActive(at);
    setOpen(true);
  };
  const choose = (i: number): void => {
    const r = rows[i];
    if (r) onChange(r.value);
    close(true);
  };

  // 開いたら、欄に合わせて置き場所を決め、一覧に入力を移す。
  useLayoutEffect(() => {
    if (!open) return;
    const b = btnRef.current?.getBoundingClientRect();
    if (b) setPlace(placePopup(b, window.innerWidth, window.innerHeight));
    listRef.current?.focus({ preventScroll: true });
  }, [open]);

  // 今の行が見えるようにする。
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, place, id]);

  // 外側を押したら閉じる。画面のスクロール・大きさが変わったら（一覧の位置がずれるので）閉じる。
  useEffect(() => {
    if (!open) return undefined;
    const inside = (t: EventTarget | null): boolean =>
      t instanceof Node && (listRef.current?.contains(t) === true || btnRef.current?.contains(t) === true);
    const onDown = (e: PointerEvent): void => {
      if (!inside(e.target)) close(false);
    };
    const onScroll = (e: Event): void => {
      if (!inside(e.target)) close(false);
    };
    const onResize = (): void => close(false);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      show(selIndex);
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      close(false);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
      return;
    }
    const n = nextIndex(e.key, active, rows.length);
    if (n != null) {
      e.preventDefault();
      setActive(n);
    }
  };

  const style: CSSProperties | undefined = place
    ? { left: place.left, top: place.top, bottom: place.bottom, width: place.width, maxHeight: place.maxHeight }
    : undefined;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`pick-btn${selected ? ' on' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={`${props.label}: ${selected ? `${selected.label}${props.suffix ?? ''}` : 'なし'}`}
        disabled={props.disabled}
        onClick={() => (open ? close(false) : show(selIndex))}
        onKeyDown={onButtonKey}
      >
        {props.lead}
        <span className="pick-v">
          {selected ? (
            <>
              {selected.rank != null && <span className="pick-rk">{selected.rank}位</span>}
              <span className="pick-nm">{selected.label}</span>
              {props.suffix && <span className="pick-sfx">{props.suffix}</span>}
            </>
          ) : (
            <span className="pick-ph">{placeholder}</span>
          )}
        </span>
        <svg className="pick-cv" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            id={`${id}-list`}
            className="pick-pop"
            role="listbox"
            tabIndex={-1}
            aria-label={props.label}
            aria-activedescendant={`${id}-${active}`}
            style={style}
            onKeyDown={onListKey}
          >
            {props.caption && (
              <div className="pick-cap" aria-hidden="true">
                {props.caption}
              </div>
            )}
            {rows.map((r, i) => (
              <div
                key={r.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === selIndex}
                className={`pick-op${i === 0 ? ' none' : ''}${i === active ? ' act' : ''}`}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="pick-rk">{r.rank != null ? r.rank : ''}</span>
                <span className="pick-nm">{i === 0 ? '選ばない' : r.label}</span>
                {r.note && <span className="pick-nt">{r.note}</span>}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
