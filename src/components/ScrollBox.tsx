import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * 高さを固定して中でスクロールする箱。続きがある間は下端を薄くぼかして「まだ下にある」と見せる。
 */
export function ScrollBox(props: { className: string; children: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = (): void => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={`${props.className}${more ? ' more' : ''}`}>
      {props.children}
    </div>
  );
}
