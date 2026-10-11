import { useEffect } from 'react';

const AUTO_CLOSE_MS = 5000;

/**
 * 計算完了 / 失敗の通知。本文タップで onTap（結果・記録へ）、5 秒で自動的に消える。
 * 通知そのものは `<output>`（暗黙の role="status" で読み上げられる）で、押せる所は本物のボタンにする
 * （本文のボタン = 開く、× = 閉じるだけ）。どちらもキーボードで届く。
 */
export function Toast(props: Readonly<{ message: string; kind: 'done' | 'err'; go?: string; onTap: () => void; onClose: () => void }>): JSX.Element {
  const { onClose } = props;
  useEffect(() => {
    const t = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [onClose]);

  return (
    <output className={`toast${props.kind === 'err' ? ' err' : ''}`}>
      <button
        type="button"
        className="t-body"
        onClick={() => {
          props.onTap();
          props.onClose();
        }}
      >
        <span>{props.message}</span>
        {props.go && <span className="go">{props.go} →</span>}
      </button>
      <button type="button" className="tx" aria-label="閉じる" onClick={props.onClose} />
    </output>
  );
}
