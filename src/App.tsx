import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { backLayers } from './backLayers';
import { createBackController } from './navHistory';
import { applyUpdate, onUpdateReady } from './pwaUpdate';
import { FireBackground } from './components/FireBackground';
import { Toast } from './components/Toast';
import { FlameMark, SunIcon } from './components/ui';
import { draftFromRecords, planDay, type Draft } from './domain/dayEntry';
import { DEMO, today as todayIso } from './clock';
import { parseFocus, toggleFocus, type FocusEntry } from './domain/focus';
import { MAX_ACTIVE_MEMBERS, newId, type AppData, type MatchRecord, type Member, type SeasonOverride, type StatSnapshot } from './domain/model';
import { currentSeason, seasonList } from './domain/season';
import { baseForCount } from './domain/stats';
import { seasonRows } from './domain/views';
import * as autoBackup from './data/autoBackup';
import type { FileStatus } from './data/autoBackup';
import * as store from './data/store';
import { BackupModal } from './screens/BackupModal';
import { HistoryScreen } from './screens/HistoryScreen';
import { MembersScreen, type MemberSave } from './screens/MembersScreen';
import { Menu } from './screens/Menu';
import { RecordScreen, type Entry } from './screens/RecordScreen';
import { SeasonsScreen } from './screens/SeasonsScreen';
import { StatsScreen } from './screens/StatsScreen';

type Screen = 'menu' | 'record' | 'history' | 'members' | 'stats' | 'seasons';
type Tab = 'record' | 'members' | 'stats';

const THEME_KEY = 'kg-theme';
const FOCUS_KEY = 'ksh-focus';
const EMPTY: AppData = { members: [], records: [], snapshots: [], seasons: [] };

interface ToastState {
  key: number;
  message: string;
  kind: 'done' | 'err';
  go?: string;
  onTap: () => void;
}

function errText(e: unknown): string {
  if (e instanceof DOMException && e.name === 'ConstraintError') return '同じメンバー・同じ日の記録が既にあります。';
  return e instanceof Error ? e.message : String(e);
}

export function App(): JSX.Element {
  const [data, setData] = useState<AppData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [today, setToday] = useState(todayIso);
  // 画面はスタックで持つ（戻るで 1 段ずつ戻る）。先頭は常にメニュー。
  const [stack, setStack] = useState<Screen[]>(['menu']);
  const screen = stack[stack.length - 1] ?? 'menu';
  const [entry, setEntry] = useState<Entry>(() => ({ date: todayIso(), draft: {} }));
  const [viewSeason, setViewSeason] = useState<number | null>(null);
  const [focus, setFocus] = useState<FocusEntry[]>([]);
  const [backupOpen, setBackupOpen] = useState(false);
  const [fileStatus, setFileStatus] = useState<FileStatus>({ state: 'unsupported' });
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const backupTimer = useRef<number | undefined>(undefined);
  const [toast, setToast] = useState<ToastState | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const seasons = seasonList(today, data.records.map((r) => r.date), data.seasons);
  const nowSeason = currentSeason(today, data.seasons);
  const season = viewSeason != null && seasons.includes(viewSeason) ? viewSeason : nowSeason;

  function showToast(message: string, kind: 'done' | 'err' = 'done'): void {
    setToast({ key: Date.now(), message, kind, onTap: () => undefined });
  }

  /** デモ版のときだけ読み込む（通常のビルドにサンプルを含めない）。 */
  async function sampleData(): Promise<AppData> {
    return (await import('./demo/sample')).buildSampleData();
  }

  async function reload(): Promise<AppData> {
    const d = await store.loadAll();
    setData(d);
    return d;
  }

  /** 自動バックアップ（端末内の履歴 + 設定していればファイル）。変更が続いたら最後の 1 回だけ。 */
  function scheduleBackup(d: AppData, delay = 1200): void {
    window.clearTimeout(backupTimer.current);
    backupTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          await autoBackup.snapshot(d);
          setFileStatus(await autoBackup.writeFileIfOn(d));
        } catch {
          /* 自動バックアップの失敗で操作は止めない（状態はバックアップ画面で見える）。 */
        }
      })();
    }, delay);
  }

  /** 書き込み → 読み直し → 自動バックアップ。失敗はトーストで知らせる。 */
  async function run(fn: () => Promise<void>, ok?: string): Promise<AppData | null> {
    try {
      await fn();
      const d = await reload();
      scheduleBackup(d);
      if (ok) showToast(ok);
      return d;
    } catch (e) {
      showToast(`保存できませんでした: ${errText(e)}`, 'err');
      return null;
    }
  }

  // 起動: 全件読み込み、注目メンバーを復元（初回はそのシーズンの上位 3 人）。
  useEffect(() => {
    void (async () => {
      try {
        let d: AppData;
        try {
          d = await store.loadAll();
          // デモ版: 初回（またはサンプルの版が変わったとき）はサンプルデータを入れる。
          if (DEMO) {
            const { SAMPLE_VERSION } = await import('./demo/sample');
            if (d.members.length === 0 || (await store.getMeta<number>('demoSample')) !== SAMPLE_VERSION) {
              await store.replaceAll(await sampleData());
              await store.setMeta('demoSample', SAMPLE_VERSION);
              d = await store.loadAll();
            }
          }
        } catch (e) {
          // デモ版は保存が使えない環境（プレビュー等）でもメモリ上のサンプルで見せる。
          if (!DEMO) throw e;
          d = await sampleData();
        }
        setData(d);
        setEntry({ date: todayIso(), draft: draftFromRecords(d.records, todayIso(), d.snapshots) });
        // 起動時: 今の状態を履歴に残し（変わっていなければ何もしない）、保存領域の保護を頼む。
        scheduleBackup(d, 0);
        void autoBackup.requestPersist().then(setPersisted);
        void autoBackup
          .fileStatus()
          .then(setFileStatus)
          .catch(() => undefined);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(FOCUS_KEY);
        } catch {
          /* noop */
        }
        const f = parseFocus(saved, new Set(d.members.map((m) => m.id)));
        if (f) setFocus(f);
        else {
          const rows = seasonRows(d, currentSeason(todayIso(), d.seasons)).filter((r) => !r.member.archived);
          const top = [...rows].sort((a, b) => b.sum.total - a.sum.total || a.member.order - b.member.order).slice(0, 3);
          setFocus(top.reduce<FocusEntry[]>((acc, r) => toggleFocus(acc, r.member.id), []));
        }
      } catch (e) {
        setLoadErr(errText(e));
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(FOCUS_KEY, JSON.stringify(focus));
    } catch {
      /* noop */
    }
  }, [focus, loaded]);

  // 日付をまたいで開きっぱなしでも「今日」を追従させる。
  useEffect(() => {
    const onVis = (): void => {
      if (document.visibilityState === 'visible') setToday(todayIso());
    };
    document.addEventListener('visibilitychange', onVis);
    const t = window.setInterval(() => setToday(todayIso()), 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(t);
    };
  }, []);

  // ---- 画面遷移 ----
  function push(s: Screen): void {
    setStack((st) => (st[st.length - 1] === s ? st : [...st, s]));
  }
  function pop(): void {
    setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
  }
  function navTab(t: Tab): void {
    if (t === 'record') openRecord();
    setStack(['menu', t]);
  }
  function entryDirty(e: Entry = entry, d: AppData = data): boolean {
    return planDay(d, e.date, e.draft).dirty;
  }
  /** 記録画面を開く。書きかけが無ければ今日を開く。 */
  function openRecord(date?: string): void {
    if (date) setEntry({ date, draft: draftFromRecords(data.records, date, data.snapshots) });
    else if (!entryDirty()) setEntry({ date: today, draft: draftFromRecords(data.records, today, data.snapshots) });
  }

  // ---- 記録 ----
  async function saveDay(): Promise<void> {
    const plan = planDay(data, entry.date, entry.draft);
    if (!plan.dirty || plan.blocked) return;
    const { rec, stats } = plan;
    const statN = stats.puts.length + stats.deletes.length;
    const parts = [rec.added && `追加 ${rec.added}`, rec.updated && `修正 ${rec.updated}`, rec.deletes.length && `取消 ${rec.deletes.length}`, statN && `スタッツ ${statN}`].filter(Boolean);
    const d = await run(() => store.applyDay(rec.puts, rec.deletes, stats.puts, stats.deletes), `保存しました（${parts.join(' · ')}）`);
    if (d) setEntry({ date: entry.date, draft: draftFromRecords(d.records, entry.date, d.snapshots) });
  }

  async function deleteRecord(r: MatchRecord): Promise<void> {
    const d = await run(() => store.applyRecords([], [r]), '記録を削除しました');
    if (d && entry.date === r.date) {
      // 書きかけの下書きからも、消した記録の分だけ外す。
      const { [r.memberId]: _gone, ...rest } = entry.draft;
      setEntry({ date: entry.date, draft: rest as Draft });
    }
  }

  // ---- メンバー ----
  async function saveMember(s: MemberSave): Promise<string | null> {
    const now = Date.now();
    let member: Member;
    if (s.id == null) {
      if (data.members.filter((m) => !m.archived).length >= MAX_ACTIVE_MEMBERS) return `有効メンバーは ${MAX_ACTIVE_MEMBERS} 人までです。`;
      member = {
        id: newId(),
        name: s.name,
        archived: false,
        order: Math.max(-1, ...data.members.map((m) => m.order)) + 1,
        createdAt: now,
        baseMatches: s.matches,
      };
    } else {
      const cur = data.members.find((m) => m.id === s.id);
      if (!cur) return 'メンバーが見つかりません。';
      member = { ...cur, name: s.name, baseMatches: baseForCount(s.matches, cur, data.records) };
    }
    let snap: StatSnapshot | null = null;
    if (s.stats) {
      const same = data.snapshots.find((x) => x.memberId === member.id && x.date === today);
      snap = same
        ? { ...same, ...s.stats, matches: s.matches }
        : { id: newId(), memberId: member.id, date: today, matches: s.matches, ...s.stats, createdAt: now };
    }
    const d = await run(async () => {
      await store.putMember(member);
      if (snap) await store.putSnapshot(snap);
    }, s.id == null ? `${s.name} を追加しました` : '保存しました');
    if (d && s.id == null) setFocus((f) => (f.length < 3 ? toggleFocus(f, member.id) : f));
    return d ? null : '保存できませんでした。';
  }

  async function setArchived(m: Member, archived: boolean): Promise<void> {
    if (!archived && data.members.filter((x) => !x.archived).length >= MAX_ACTIVE_MEMBERS) {
      showToast(`有効メンバーが ${MAX_ACTIVE_MEMBERS} 人いるため戻せません`, 'err');
      return;
    }
    const next: Member = archived ? { ...m, archived: true, archivedAt: Date.now() } : { ...m, archived: false };
    if (!archived) delete next.archivedAt;
    await run(() => store.putMember(next), archived ? `${m.name} をアーカイブしました` : `${m.name} を戻しました`);
  }

  async function purge(m: Member): Promise<void> {
    await run(() => store.purgeMember(m.id, data.records, data.snapshots), `${m.name} を削除しました`);
    setFocus((f) => f.filter((x) => x.id !== m.id));
    const { [m.id]: _gone, ...rest } = entry.draft;
    setEntry((e) => ({ ...e, draft: rest as Draft }));
  }

  async function resumeFile(): Promise<void> {
    try {
      if (await autoBackup.resumeFile(data)) showToast('ファイルへの自動保存を再開しました');
    } catch (e) {
      showToast(`ファイルに書き出せませんでした: ${errText(e)}`, 'err');
    }
    setFileStatus(await autoBackup.fileStatus());
  }

  // ---- 端末の戻る: 重なり → 画面の順に 1 段戻す ----
  function stepBack(): void {
    if (backLayers.closeTop()) return;
    pop();
  }
  const stepBackRef = useRef(stepBack);
  stepBackRef.current = stepBack;
  const layerCount = useSyncExternalStore(backLayers.subscribe, backLayers.getCount, backLayers.getCount);
  const navDepth = stack.length - 1 + layerCount;
  const backCtl = useRef<ReturnType<typeof createBackController> | null>(null);
  useEffect(() => {
    const ctl = createBackController(window.history);
    backCtl.current = ctl;
    const onPop = (): void => {
      if (ctl.handlePop()) stepBackRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      backCtl.current = null;
    };
  }, []);
  useEffect(() => {
    backCtl.current?.sync(navDepth);
  }, [navDepth]);

  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [screen]);

  // ---- アプリ更新（PWA）: 手が空いているときに裏へ回ったら入れ替える ----
  const idle = screen === 'menu' && layerCount === 0 && !entryDirty();
  const idleRef = useRef(idle);
  idleRef.current = idle;
  useEffect(
    () =>
      onUpdateReady(() => {
        setToast({ key: Date.now(), message: '新しいバージョンがあります', kind: 'done', go: 'UPDATE', onTap: applyUpdate });
        const onHide = (): void => {
          if (document.visibilityState === 'hidden' && idleRef.current) applyUpdate();
        };
        document.addEventListener('visibilitychange', onHide);
      }),
    [],
  );

  function toggleTheme(e: React.MouseEvent<HTMLButtonElement>): void {
    const r = document.documentElement;
    const cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    r.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* noop */
    }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      e.currentTarget.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }], {
        duration: 500,
        easing: 'cubic-bezier(.2,.8,.2,1)',
      });
    }
  }

  const tab: Tab | null = stack.includes('record') ? 'record' : stack.includes('members') ? 'members' : stack.includes('stats') ? 'stats' : null;
  const dirty = entryDirty();

  return (
    <>
      <FireBackground />
      <div className="app">
        <header className="top">
          <button type="button" className="brand" onClick={() => setStack(['menu'])} aria-label="メニューへ">
            <FlameMark />
            <span>Kagaribi Stat</span>
          </button>
          <nav className="navpill" aria-label="タブ">
            <button type="button" className="nbtn" aria-current={tab === 'record' ? 'page' : undefined} onClick={() => navTab('record')}>
              記録
              {dirty && <i className="badge" aria-label="未保存" />}
            </button>
            <button type="button" className="nbtn" aria-current={tab === 'members' ? 'page' : undefined} onClick={() => navTab('members')}>
              メンバー
            </button>
            <button type="button" className="nbtn" aria-current={tab === 'stats' ? 'page' : undefined} onClick={() => navTab('stats')}>
              スタッツ
            </button>
          </nav>
          <div className="top-r">
            <button type="button" className="theme-toggle" aria-label="表示テーマを切り替える" onClick={toggleTheme}>
              <SunIcon />
            </button>
          </div>
        </header>

        <main className="main" ref={mainRef}>
          {loadErr && (
            <div className="pane">
              <div className="notice warn">
                データを読み込めませんでした（{loadErr}）。プライベートブラウズでは保存が使えないことがあります。
              </div>
            </div>
          )}
          {loaded && !loadErr && (
            <>
              {screen === 'menu' && (
                <Menu
                  fileStatus={fileStatus}
                  onResumeFile={() => void resumeFile()}
                  demo={DEMO}
                  onResetDemo={() => {
                    void (async () => {
                      const sample = await sampleData();
                      const nd = await run(() => store.replaceAll(sample), 'サンプルデータに戻しました');
                      if (!nd) setData(sample);
                      setEntry({ date: today, draft: draftFromRecords(sample.records, today, sample.snapshots) });
                    })();
                  }}
                  data={data}
                  today={today}
                  season={nowSeason}
                  onRecord={() => {
                    openRecord();
                    push('record');
                  }}
                  onMembers={() => push('members')}
                  onStats={() => {
                    setViewSeason(null);
                    push('stats');
                  }}
                  onHistory={() => push('history')}
                  onSeasons={() => push('seasons')}
                  onBackup={() => setBackupOpen(true)}
                />
              )}
              {screen === 'record' && (
                <RecordScreen
                  data={data}
                  entry={entry}
                  today={today}
                  onDraft={(draft) => setEntry((e) => ({ ...e, draft }))}
                  onDate={(date) => setEntry({ date, draft: draftFromRecords(data.records, date, data.snapshots) })}
                  onSave={() => void saveDay()}
                  onBack={pop}
                  onHistory={() => push('history')}
                  onMembers={() => setStack(['menu', 'members'])}
                />
              )}
              {screen === 'history' && (
                <HistoryScreen
                  data={data}
                  seasons={seasons}
                  season={season}
                  onSeason={setViewSeason}
                  onOpenDate={(date) => {
                    if (entryDirty() && entry.date !== date) {
                      showToast('記録画面に保存していない入力があります。先に保存か破棄をしてください', 'err');
                      setStack(['menu', 'record']);
                      return;
                    }
                    openRecord(date);
                    setStack(['menu', 'record']);
                  }}
                  onDelete={(r) => void deleteRecord(r)}
                  onBack={pop}
                />
              )}
              {screen === 'members' && (
                <MembersScreen
                  data={data}
                  today={today}
                  onSave={saveMember}
                  onArchive={(m, a) => void setArchived(m, a)}
                  onPurge={(m) => void purge(m)}
                  onDeleteSnapshot={(s) => void run(() => store.deleteSnapshot(s.id), 'スタッツを削除しました')}
                  onBack={pop}
                />
              )}
              {screen === 'stats' && (
                <StatsScreen
                  data={data}
                  today={today}
                  seasons={seasons}
                  season={season}
                  onSeason={setViewSeason}
                  focus={focus}
                  onToggleFocus={(id) => setFocus((f) => toggleFocus(f, id))}
                  onClearFocus={() => setFocus([])}
                  onBack={pop}
                />
              )}
              {screen === 'seasons' && (
                <SeasonsScreen
                  data={data}
                  seasons={seasons}
                  today={today}
                  onSave={(no, o: SeasonOverride | null) => void run(() => store.saveSeason(no, o), `S${no} の設定を保存しました`)}
                  onBack={pop}
                />
              )}
            </>
          )}
        </main>

        {backupOpen && (
          <BackupModal
            data={data}
            file={fileStatus}
            persisted={persisted}
            onChooseFile={async () => {
              try {
                if (await autoBackup.chooseFile(data)) showToast('ファイルへの自動保存を始めました');
              } catch (e) {
                showToast(`ファイルに書き出せませんでした: ${errText(e)}`, 'err');
              }
              setFileStatus(await autoBackup.fileStatus());
            }}
            onResumeFile={resumeFile}
            onStopFile={async () => {
              await autoBackup.stopFile();
              setFileStatus(await autoBackup.fileStatus());
            }}
            onImport={async (d, label) => {
              // 置き換える前の状態を必ず履歴に残してから読み込む。
              window.clearTimeout(backupTimer.current);
              await autoBackup.snapshot(data).catch(() => undefined);
              const nd = await run(() => store.replaceAll(d), `${label} を読み込みました`);
              if (nd) {
                setEntry({ date: today, draft: draftFromRecords(nd.records, today, nd.snapshots) });
                setFocus((f) => f.filter((x) => nd.members.some((m) => m.id === x.id)));
              }
            }}
            onClose={() => setBackupOpen(false)}
          />
        )}

        {toast && <Toast key={toast.key} message={toast.message} kind={toast.kind} go={toast.go} onTap={toast.onTap} onClose={closeToast} />}
      </div>
    </>
  );
}
