import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Danmaku, Subtitle, Video } from '../lib/types';
import { DanmakuEngine } from '../lib/danmaku';
import { activeCue, parseSubtitles, type Cue } from '../lib/subs';
import { videos } from '../lib/api';
import { I } from './icons';
import { useToast, errMsg } from '../store/toast';
import { fmtClock } from '../lib/util';

interface Props {
  video: Video;
  onWatched?: (watchSeconds: number, videoSeconds: number) => void;
  danmakuKey?: number; // 强制重新加载弹幕
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function Player({ video, onWatched, danmakuKey = 0 }: Props) {
  const toast = useToast(s => s.push);
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DanmakuEngine | null>(null);

  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [dmOpen, setDmOpen] = useState(false);
  const [dmFocus, setDmFocus] = useState(false);
  const [dmInput, setDmInput] = useState('');
  const [dmColor, setDmColor] = useState('#ffffff');
  const [dmMode, setDmMode] = useState<'scroll' | 'top' | 'bottom'>('scroll');
  const [dmOn, setDmOn] = useState(true);
  const [dmOpacity, setDmOpacity] = useState(0.92);
  const [dmSize, setDmSize] = useState(22);
  const [dmShowScroll, setDmShowScroll] = useState(true);
  const [dmShowTop, setDmShowTop] = useState(true);
  const [dmShowBot, setDmShowBot] = useState(true);
  const [subOpen, setSubOpen] = useState(false);
  const [subs, setSubs] = useState<Subtitle[]>([]);
  const [activeSub, setActiveSub] = useState<Subtitle | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [cueText, setCueText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const subLoadedRef = useRef('');
  const watchTimerRef = useRef(0);
  const reportedRef = useRef(false);
  const hideTimer = useRef<any>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef<HTMLDivElement>(null);
  const bufferedRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  const src = video.stream_url || video.external_player_url || '';

  /* ---------- 引擎初始化 ---------- */
  useEffect(() => {
    if (!canvasRef.current) return;
    const eng = new DanmakuEngine(canvasRef.current);
    engineRef.current = eng;
    eng.onSeek = t => {
      const v = videoRef.current;
      if (v) v.currentTime = t;
    };
    eng.start();
    const ro = new ResizeObserver(() => eng.resize());
    ro.observe(canvasRef.current);
    eng.resize();
    return () => { ro.disconnect(); eng.destroy(); engineRef.current = null; };
  }, []);

  /* ---------- 弹幕设置同步 ---------- */
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.opacity = dmOpacity;
    e.fontBase = dmSize;
    e.showScroll = dmShowScroll;
    e.showTop = dmShowTop;
    e.showBot = dmShowBot;
    e.paused = !dmOn || !playing;
  }, [dmOn, dmOpacity, dmSize, dmShowScroll, dmShowTop, dmShowBot, playing]);

  /* ---------- 加载弹幕 ---------- */
  useEffect(() => {
    let alive = true;
    videos.danmakuList(video.id, 500, 0).then(d => {
      if (!alive || !engineRef.current) return;
      const list: Danmaku[] = Array.isArray(d) ? d : (d?.items || []);
      engineRef.current.load(list, videoRef.current?.currentTime || 0);
    }).catch(() => { /* 弹幕加载失败不阻塞播放 */ });
    return () => { alive = false; };
  }, [video.id, danmakuKey]);

  /* ---------- 字幕列表 ---------- */
  const loadSubs = useCallback(async () => {
    try {
      const d: any = await videos.subtitles(video.id);
      const list: Subtitle[] = Array.isArray(d) ? d : d?.items || [];
      setSubs(list);
      return list;
    } catch {
      return [];
    }
  }, [video.id]);
  useEffect(() => { loadSubs(); }, [loadSubs]);

  /* ---------- 加载活动字幕内容 ---------- */
  useEffect(() => {
    if (!activeSub) { subLoadedRef.current = ''; setCues([]); setCueText(''); return; }
    if (subLoadedRef.current === activeSub.url) return;
    subLoadedRef.current = activeSub.url;
    let alive = true;
    fetch(activeSub.url, { credentials: 'include' })
      .then(r => (r.ok ? r.text() : Promise.reject(new Error('fetch failed'))))
      .then(t => { if (alive) setCues(parseSubtitles(t)); })
      .catch(() => { if (alive) { setCues([]); toast('字幕加载失败', 'error'); } });
    return () => { alive = false; };
  }, [activeSub, toast]);

  /* ---------- 播放事件 ---------- */
  const onTime = () => {
    const v = videoRef.current;
    if (!v) return;
    if (engineRef.current) engineRef.current.current = v.currentTime;
    // 直接写 DOM，避免每帧 re-render
    if (v.duration) {
      const pct = (v.currentTime / v.duration) * 100;
      if (playedRef.current) playedRef.current.style.width = pct + '%';
      if (thumbRef.current) thumbRef.current.style.left = pct + '%';
      const b = v.buffered;
      if (bufferedRef.current && b.length) {
        const end = b.end(b.length - 1);
        bufferedRef.current.style.width = (end / v.duration) * 100 + '%';
      }
      if (timeRef.current) timeRef.current.textContent = `${fmtClock(v.currentTime)} / ${fmtClock(v.duration)}`;
    }
    if (cues.length && activeSub) {
      const c = activeCue(cues, v.currentTime);
      setCueText(c ? c.text : '');
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = speed;
  }, [speed]);

  /* ---------- 观看进度上报 ---------- */
  const report = useCallback(() => {
    const v = videoRef.current;
    if (!v || reportedRef.current) return;
    const dur = v.duration || video.duration || 0;
    const watched = Math.floor(v.currentTime);
    if (dur && watched >= Math.max(3, dur * 0.2)) {
      reportedRef.current = true;
      onWatched?.(watched, Math.floor(dur));
      videos.watchReport(video.id, watched, Math.floor(dur)).catch(() => { });
    }
  }, [video.id, video.duration, onWatched]);

  useEffect(() => {
    watchTimerRef.current = window.setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused) report();
    }, 5000);
    return () => {
      clearInterval(watchTimerRef.current);
      report();
    };
  }, [report]);

  /* ---------- 控制 ---------- */
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => { }); setPlaying(true); } else { v.pause(); setPlaying(false); }
  }, []);

  const poke = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !dmOpen && !subOpen && !speedOpen) setShowControls(false);
    }, 2600);
  };

  const seekBy = (delta: number) => {
    const v = videoRef.current;
    if (v && v.duration) v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + delta));
  };

  const onSeekClick = (e: React.MouseEvent) => {
    const v = videoRef.current;
    const bar = seekBarRef.current;
    if (!v || !bar || !v.duration) return;
    const r = bar.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    v.currentTime = p * v.duration;
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    const v = videoRef.current;
    if (!v) return;
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft': seekBy(-5); break;
      case 'ArrowRight': seekBy(5); break;
      case 'ArrowUp': e.preventDefault(); setVolume(x => Math.min(1, x + 0.1)); break;
      case 'ArrowDown': e.preventDefault(); setVolume(x => Math.max(0, x - 0.1)); break;
      case 'm': setMuted(x => !x); break;
      case 'f': toggleFullscreen(); break;
      case 'd': setDmFocus(x => !x); break;
    }
  };

  const toggleFullscreen = () => {
    const el = boxRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    else el.requestFullscreen?.().catch(() => { });
  };
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const onPiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if ((v as any).requestPictureInPicture) await (v as any).requestPictureInPicture();
    } catch { toast('当前环境不支持画中画', 'error'); }
  };

  /* ---------- 弹幕发送 ---------- */
  const sendDanmaku = async () => {
    const text = dmInput.trim();
    if (!text) return;
    const v = videoRef.current;
    const time = v?.currentTime ?? 0;
    const payload = { content: text, time_sec: Math.round(time * 100) / 100, color: dmColor, mode: dmMode, fontsize: dmSize };
    // 乐观上屏
    engineRef.current?.add(payload as Danmaku);
    setDmInput('');
    try {
      await videos.danmakuSend(video.id, payload);
    } catch (e: any) {
      toast(errMsg(e, '弹幕发送失败'), 'error');
    }
  };

  const importDanmaku = async (file: File) => {
    try {
      const xml = await file.text();
      const r: any = await videos.danmakuImport(video.id, xml);
      const n = r?.imported ?? r?.count ?? '若干';
      toast(`已导入弹幕 ${n} 条`, 'success');
    } catch (e: any) { toast(errMsg(e, '弹幕导入失败'), 'error'); }
  };

  /* ---------- 字幕操作 ---------- */
  const uploadSubtitle = async (file: File) => {
    const fd = new FormData();
    fd.append('subtitle', file);
    fd.append('label', file.name.replace(/\.[^.]+$/, ''));
    const langMatch = file.name.match(/\[(zh|en|ja|ko|fr|de|es)\]/i);
    fd.append('language', langMatch ? langMatch[1].toLowerCase() : 'zh');
    try {
      await videos.subtitleUpload(video.id, fd);
      toast('字幕上传成功', 'success');
      const list = await loadSubs();
      if (list.length) setActiveSub(list[list.length - 1]);
    } catch (e: any) { toast(errMsg(e, '字幕上传失败'), 'error'); }
  };

  const removeSubtitle = async (s: Subtitle) => {
    try {
      await videos.subtitleRemove(video.id, s.id);
      if (activeSub?.id === s.id) { setActiveSub(null); subLoadedRef.current = ''; }
      loadSubs();
      toast('字幕已删除', 'success');
    } catch (e: any) { toast(errMsg(e, '删除失败'), 'error'); }
  };

  const triggerAi = async () => {
    setAiBusy(true);
    try {
      await videos.aiSubtitles(video.id);
      const poll = async (n: number) => {
        try {
          const st: any = await videos.aiSubtitleStatus(video.id);
          const job = st?.job;
          if (st?.subtitle) {
            setAiBusy(false);
            await loadSubs();
            setActiveSub(st.subtitle);
            toast('AI 字幕已生成', 'success');
            return;
          }
          if (job && ['failed', 'failure', 'stopped', 'cancelled', 'canceled'].includes(job.status)) {
            setAiBusy(false);
            toast('AI 字幕生成失败：' + (job.error || job.status), 'error');
            return;
          }
          if (n <= 0) { setAiBusy(false); toast('AI 字幕生成超时', 'error'); return; }
          setTimeout(() => poll(n - 1), 4000);
        } catch {
          setAiBusy(false);
        }
      };
      poll(30);
    } catch (e: any) {
      setAiBusy(false);
      toast(errMsg(e, 'AI 字幕触发失败'), 'error');
    }
  };

  const retry = () => {
    setError(null);
    setRetrying(true);
    const v = videoRef.current;
    if (v) { v.load(); v.play().catch(() => { }); setTimeout(() => setRetrying(false), 1500); }
  };

  const visibleSubs = useMemo(() => subs, [subs]);

  return (
    <div
      ref={boxRef}
      className={`player ${!playing ? 'paused' : ''} ${dmFocus ? 'danmaku-focus' : ''}`}
      style={{ opacity: error ? 0.85 : 1 }}
      onKeyDown={onKey}
      onMouseMove={poke}
      onClick={() => poke()}
      tabIndex={-1}
    >
      <video
        ref={videoRef}
        src={src || undefined}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onTimeUpdate={onTime}
        onPlay={() => { setPlaying(true); poke(); }}
        onPause={() => { setPlaying(false); setShowControls(true); }}
        onEnded={() => setPlaying(false)}
        onClick={e => { e.stopPropagation(); togglePlay(); }}
        onDoubleClick={e => { e.stopPropagation(); toggleFullscreen(); }}
        onError={() => { if (src) setError('视频加载失败，请重试或检查网络'); }}
        style={{ cursor: playing ? 'none' : 'auto' }}
      />
      <canvas ref={canvasRef} className="dm-canvas" />
      {cueText && <div className="sub-layer"><span className="sub-cue">{cueText}</span></div>}

      {/* 错误态 */}
      {error && (
        <div className="p-error">
          <I name="alert" size={40} style={{ color: 'var(--md-error)' }} />
          <div>{retrying ? '正在重试…' : error}</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--tonal btn--sm" onClick={retry}><I name="refresh" size={15} /> 重试</button>
            {video.external_player_url && (
              <a className="btn btn--outlined btn--sm" href={video.external_player_url} target="_blank" rel="noreferrer">
                <I name="external" size={15} /> 外部播放
              </a>
            )}
          </div>
        </div>
      )}

      {/* 中央播放按钮 */}
      {!playing && !error && (
        <button className="big-play" onClick={e => { e.stopPropagation(); togglePlay(); }} aria-label="播放">
          <I name="playFill" size={40} />
        </button>
      )}

      {/* 弹幕设置面板 */}
      {dmOpen && (
        <div className="dm-panel" onClick={e => e.stopPropagation()}>
          <div className="dm-row">
            <span className="row" style={{ gap: 6 }}><I name="danmaku" size={17} /> 弹幕设置</span>
            <button className={`chip ${dmOn ? 'chip--selected' : ''}`} onClick={() => setDmOn(!dmOn)} type="button">{dmOn ? '开' : '关'}</button>
          </div>
          <div className="dm-row"><span>不透明度</span><input type="range" min={0.3} max={1} step={0.05} value={dmOpacity} onChange={e => setDmOpacity(+e.target.value)} /></div>
          <div className="dm-row"><span>字号</span><input type="range" min={14} max={32} step={1} value={dmSize} onChange={e => setDmSize(+e.target.value)} /></div>
          <div className="dm-row">
            <span>区域</span>
            <div className="dm-slots">
              <button className={`chip ${dmShowScroll ? 'chip--selected' : ''}`} onClick={() => setDmShowScroll(x => !x)} type="button">滚动</button>
              <button className={`chip ${dmShowTop ? 'chip--selected' : ''}`} onClick={() => setDmShowTop(x => !x)} type="button">顶部</button>
              <button className={`chip ${dmShowBot ? 'chip--selected' : ''}`} onClick={() => setDmShowBot(x => !x)} type="button">底部</button>
            </div>
          </div>
          <div className="dm-row" style={{ gap: 6 }}>
            <input type="color" value={dmColor} onChange={e => setDmColor(e.target.value)} style={{ width: 34, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} aria-label="弹幕颜色" />
            <select value={dmMode} onChange={e => setDmMode(e.target.value as any)} style={{ background: 'var(--md-surface-container-high)', border: '1px solid var(--md-outline-variant)', borderRadius: 8, color: '#fff', padding: '4px 8px', flex: 1 }}>
              <option value="scroll">滚动</option>
              <option value="top">顶部</option>
              <option value="bottom">底部</option>
            </select>
          </div>
          <label className="dm-row" style={{ cursor: 'pointer' }}>
            <span>导入弹幕 XML</span>
            <input type="file" accept=".xml,.json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importDanmaku(f); e.target.value = ''; }} />
            <span className="chip">导入</span>
          </label>
          <a className="chip" style={{ textDecoration: 'none' }} href={`/api/videos/${video.id}/danmaku.xml`} target="_blank" rel="noreferrer">导出弹幕 XML</a>
        </div>
      )}

      {/* 字幕菜单 */}
      {subOpen && (
        <div className="dm-panel" style={{ width: 280 }} onClick={e => e.stopPropagation()}>
          <div className="dm-row">
            <span className="row" style={{ gap: 6 }}><I name="captions" size={17} /> 字幕</span>
            <button className={`chip ${activeSub ? 'chip--selected' : ''}`} onClick={() => { setActiveSub(null); subLoadedRef.current = ''; }} type="button">{activeSub ? '关闭' : '关'}</button>
          </div>
          {visibleSubs.map(s => (
            <div className="dm-row" key={s.id}>
              <span className="row" style={{ gap: 6, flex: 1, minWidth: 0 }}>
                <span className="clamp1">{s.label || s.name || s.language}</span>
                {s.source === 'ai' && <span className="chip" style={{ height: 20, padding: '0 6px', font: 'var(--text-label-sm)' }}>AI</span>}
              </span>
              <button className={`chip ${activeSub?.id === s.id ? 'chip--selected' : ''}`} onClick={() => setActiveSub(s)} type="button">
                {activeSub?.id === s.id ? '使用中' : '使用'}
              </button>
              <button className="icon-btn icon-btn--sm" style={{ color: 'var(--md-error)' }} onClick={() => removeSubtitle(s)} aria-label="删除字幕"><I name="trash" size={15} /></button>
            </div>
          ))}
          <div className="dm-row">
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept=".vtt,.srt,.ass,.ssa" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadSubtitle(f); e.target.value = ''; }} />
              <span className="chip">上传字幕</span>
            </label>
            <button className="chip" disabled={aiBusy} onClick={triggerAi} type="button">
              <I name="sparkles" size={14} /> {aiBusy ? 'AI 生成中…' : 'AI 生成字幕'}
            </button>
          </div>
        </div>
      )}

      {/* 弹幕输入 */}
      <div className="dm-input" onClick={e => e.stopPropagation()}>
        <input
          value={dmInput}
          placeholder="发条弹幕，按 Enter 发送"
          maxLength={80}
          onChange={e => setDmInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendDanmaku(); if (e.key === 'Escape') setDmFocus(false); }}
        />
        <button className="btn" onClick={sendDanmaku}><I name="send" size={16} /> 发送</button>
      </div>

      {/* 控制条（液态玻璃） */}
      <div className="pbar" style={{ opacity: showControls || !playing ? 1 : 0 }} onClick={e => e.stopPropagation()}>
        <div className="seek-row">
          <div className="seek" ref={seekBarRef} onClick={onSeekClick} role="slider" aria-label="进度" aria-valuemin={0} aria-valuemax={100}>
            <div className="track" />
            <div className="buffered" ref={bufferedRef} style={{ width: 0 }} />
            <div className="played" ref={playedRef} style={{ width: 0 }} />
            <div className="thumb" ref={thumbRef} style={{ left: 0 }} />
          </div>
          <span className="time-label" ref={timeRef}>0:00 / 0:00</span>
        </div>
        <div className="pbtns">
          <button className="pbtn" onClick={togglePlay} aria-label={playing ? '暂停' : '播放'}>
            <I name={playing ? 'pauseFill' : 'playFill'} size={22} />
          </button>
          <div className="vol-wrap">
            <button className="pbtn" onClick={() => setMuted(m => !m)} aria-label="静音">
              <I name={muted || volume === 0 ? 'volumeX' : 'volume'} size={20} />
            </button>
            <input
              className="vol-slider" type="range" min={0} max={1} step={0.05}
              value={muted ? 0 : volume}
              onChange={e => { setVolume(+e.target.value); setMuted(false); }}
              aria-label="音量"
            />
          </div>
          <span className="time-label" style={{ display: 'none' }} />
          <button className="pbtn" onClick={() => { setDmOpen(x => !x); setSubOpen(false); setSpeedOpen(false); }} style={dmOpen ? { background: 'rgba(255,255,255,0.18)' } : undefined} aria-label="弹幕">
            <I name="danmaku" size={20} />
          </button>
          <button className="pbtn" onClick={() => { setSubOpen(x => !x); setDmOpen(false); setSpeedOpen(false); }} style={subOpen ? { background: 'rgba(255,255,255,0.18)' } : undefined} aria-label="字幕">
            <I name="captions" size={20} />
          </button>
          <div style={{ position: 'relative' }}>
            <button className="speed-menu-btn" onClick={() => setSpeedOpen(x => !x)}>{speed}x</button>
            {speedOpen && (
              <div className="menu" style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, minWidth: 90 }}>
                {SPEEDS.map(s => (
                  <button key={s} className={`menu-item ${s === speed ? '' : ''}`} style={{ justifyContent: 'center', opacity: s === speed ? 1 : 0.7 }} onClick={() => { setSpeed(s); setSpeedOpen(false); }}>
                    {s === 1 ? '原速' : `${s}x`}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="pbtn" onClick={onPiP} aria-label="画中画"><I name="pip" size={19} /></button>
          <button className="pbtn" onClick={toggleFullscreen} aria-label="全屏">
            <I name={fullscreen ? 'fullscreenExit' : 'fullscreen'} size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
