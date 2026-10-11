import { useEffect, useRef, useState, useCallback } from 'react';
import { I } from './icons';
import { DanmakuEngine, type DanmakuItem } from './lib/danmaku';
import { type Cue, activeCue } from './lib/subtitles';
import { fmtDuration, streamFallbacks, clamp } from './lib/utils';

export interface PlayerProps {
  src?: string;
  cover?: string;
  danmaku?: DanmakuItem[];
  subtitles?: { label: string; cues: Cue[] }[];
  onSendDanmaku?: (item: DanmakuItem) => void;
  onTimeReport?: (watchSec: number, totalSec: number) => void;
  startAt?: number;
  onEnded?: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function Player({ src, cover, danmaku, subtitles, onSendDanmaku, onTimeReport, startAt, onEnded }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DanmakuEngine | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const lastT = useRef(0);
  const srcIdx = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [danmakuOn, setDanmakuOn] = useState(true);
  const [dOpacity] = useState(0.9);
  const [subIdx, setSubIdx] = useState(-1);
  const [subText, setSubText] = useState('');
  const [menu, setMenu] = useState<'' | 'speed' | 'danmaku' | 'sub'>('');
  const [dInput, setDInput] = useState('');
  const [dColor, setDColor] = useState('#ffffff');
  const [dMode, setDMode] = useState<'scroll' | 'top' | 'bottom'>('scroll');
  const [showSend, setShowSend] = useState(false);
  const [srcError, setSrcError] = useState(false);
  const reported = useRef(false);
  const [curSrc, setCurSrc] = useState('');
  const sources = useRef<string[]>([]);
  useEffect(() => {
    sources.current = streamFallbacks(src);
    srcIdx.current = 0;
    setCurSrc(sources.current[0] || '');
    setSrcError(false);
  }, [src]);

  // 初始化弹幕引擎
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engineRef.current = new DanmakuEngine(canvas);
    engineRef.current.onSeek = (sec) => {
      const v = videoRef.current;
      if (v) { v.currentTime = sec; v.play().catch(() => {}); }
    };
    const onResize = () => engineRef.current?.resize();
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      engineRef.current?.destroy();
    };
  }, []);

  // 弹幕加载
  useEffect(() => {
    engineRef.current?.load(danmaku || [], videoRef.current?.currentTime || startAt || 0);
  }, [danmaku, startAt]);

  // 字幕
  useEffect(() => {
    if (subIdx < 0 || !subtitles?.[subIdx]) { setSubText(''); return; }
    const cue = activeCue(subtitles[subIdx].cues, cur);
    setSubText(cue?.text || '');
  }, [cur, subIdx, subtitles]);

  // rAF 驱动弹幕 + 进度
  useEffect(() => {
    const tick = () => {
      const v = videoRef.current;
      if (v && engineRef.current) {
        const t = v.currentTime;
        const dt = Math.max(0, t - lastT.current);
        lastT.current = t;
        engineRef.current.visible = danmakuOn;
        engineRef.current.opacity = dOpacity;
        if (v.readyState >= 2) {
          engineRef.current.advance(Math.max(0, t - dt), t);
          engineRef.current.update(v.paused ? 0 : dt);
          engineRef.current.render();
        }
        setCur(t);
        setDur(v.duration || 0);
        if (!v.paused && t > 0 && !reported.current && onTimeReport && dur > 0 && t >= Math.max(3, dur * 0.2)) {
          reported.current = true;
          onTimeReport(t, dur);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [danmakuOn, dOpacity, onTimeReport, dur]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const onVideoError = () => {
    const srcs = sources.current;
    if (srcIdx.current < srcs.length - 1) {
      srcIdx.current++;
      setCurSrc(srcs[srcIdx.current]);
    } else {
      setSrcError(true);
    }
  };

  // 10 秒内完全没收到数据就换下一档 CDN（防节点不可达时 <video> 卡死不触发 onError）
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !curSrc) return;
    const timer = window.setTimeout(() => {
      if (v.readyState < 1) onVideoError();
    }, 10000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curSrc]);

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = t;
      engineRef.current?.clear();
      engineRef.current?.load(danmaku || [], t);
      reported.current = t >= Math.max(3, (dur || 0) * 0.2);
    }
  };

  const sendDanmaku = () => {
    const text = dInput.trim();
    if (!text || !onSendDanmaku) return;
    const item: DanmakuItem = {
      id: 'local-' + Date.now(),
      text: text.slice(0, 100),
      timeSec: videoRef.current?.currentTime || 0,
      color: dColor,
      mode: dMode,
      fontsize: 25,
    };
    onSendDanmaku(item);
    engineRef.current?.add(item, videoRef.current?.currentTime);
    setDInput('');
    setShowSend(false);
  };

  const v = videoRef.current;

  return (
    <div ref={wrapRef} className={'player-wrap' + (playing ? '' : ' paused')}>
      <video
        ref={videoRef}
        key={curSrc}
        src={curSrc || undefined}
        poster={cover}
        playsInline
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={onEnded}
        onError={onVideoError}
        onLoadedMetadata={() => {
          if (startAt && videoRef.current) videoRef.current.currentTime = startAt;
        }}
        preload="auto"
      />
      <canvas ref={canvasRef} className="danmaku-canvas" />
      {subText && <div className="sub-overlay">{subText}</div>}

      {srcError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', color: '#fff', flexDirection: 'column', gap: 12 }}>
          <div>视频加载失败（已尝试全部 CDN）</div>
          <button className="btn" onClick={() => { setSrcError(false); srcIdx.current = 0; setCurSrc(sources.current[0] || ''); }}>重试</button>
        </div>
      )}

      {!playing && !srcError && v && (
        <button
          onClick={togglePlay}
          style={{ position: 'absolute', inset: 0, margin: 'auto', width: 64, height: 64, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        ><I name="play" size={28} filled /></button>
      )}

      {/* 控制条 */}
      <div className="player-controls">
        <input
          className="seekbar"
          type="range" min={0} max={dur || 0} step={0.1} value={cur}
          onChange={(e) => seekTo(clamp(parseFloat(e.target.value), 0, dur || 0))}
        />
        <div className="pc-row">
          <button className="pc-btn" onClick={togglePlay}>{playing ? <I name="pause" size={16} /> : <I name="play" size={16} filled />}</button>
          <span style={{ minWidth: 108, textAlign: 'center' }}>{fmtDuration(cur)} / {fmtDuration(dur)}</span>
          <div className="grow" />

          {/* 弹幕发送 */}
          {onSendDanmaku && (
            <button className={'pc-btn' + (showSend ? ' on' : '')} title="发送弹幕" onClick={() => { setShowSend(!showSend); setMenu(''); }}><I name="chat" size={16} /></button>
          )}
          <button className={'pc-btn' + (danmakuOn ? ' on' : '')} title="弹幕开关" onClick={() => { setDanmakuOn(!danmakuOn); setMenu(''); }}><I name="waves" size={16} /></button>

          <button className={'pc-btn' + (subIdx >= 0 ? ' on' : '')} title="字幕" onClick={() => { setMenu(menu === 'sub' ? '' : 'sub'); }}>CC</button>
          <button className="pc-btn" title="倍速" onClick={() => { setMenu(menu === 'speed' ? '' : 'speed'); }}>{speed}x</button>

          <input
            type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol}
            style={{ width: 70, accentColor: 'var(--accent)' }}
            onChange={(e) => { const val = parseFloat(e.target.value); setVol(val); setMuted(val === 0); if (v) { v.volume = val; v.muted = val === 0; } }}
          />
          <button className="pc-btn" title="画中画" onClick={() => { document.exitPictureInPicture?.().catch(() => {}); v?.requestPictureInPicture?.().catch(() => {}); }}><I name="pip" size={16} /></button>
          <button className="pc-btn" title="全屏" onClick={() => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); else wrapRef.current?.requestFullscreen?.().catch(() => {}); }}><I name="maximize" size={16} /></button>
        </div>
      </div>

      {/* 弹幕发送面板 */}
      {showSend && (
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 64, background: 'rgba(15,15,20,0.92)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, display: 'flex', gap: 8, alignItems: 'center', color: '#fff', zIndex: 5 }}>
          <input
            value={dInput}
            onChange={(e) => setDInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendDanmaku()}
            placeholder="发个弹幕见证当下"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 14, minWidth: 0 }}
          />
          <input type="color" value={dColor} onChange={(e) => setDColor(e.target.value)} title="颜色" style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} />
          <select value={dMode} onChange={(e) => setDMode(e.target.value as never)} style={{ background: '#2a2a32', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px' }}>
            <option value="scroll">滚动</option>
            <option value="top">顶部</option>
            <option value="bottom">底部</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={sendDanmaku}>发送</button>
        </div>
      )}

      {/* 字幕菜单 */}
      {menu === 'sub' && (
        <div className="pc-menu" style={{ right: 120 }}>
          <div className={subIdx === -1 ? 'on' : ''} onClick={() => { setSubIdx(-1); setMenu(''); }}>关闭字幕</div>
          {subtitles?.map((s, i) => (
            <div key={i} className={subIdx === i ? 'on' : ''} onClick={() => { setSubIdx(i); setMenu(''); }}>{s.label}</div>
          ))}
        </div>
      )}

      {/* 倍速菜单 */}
      {menu === 'speed' && (
        <div className="pc-menu" style={{ right: 60 }}>
          {SPEEDS.map((s) => (
            <div key={s} className={speed === s ? 'on' : ''} onClick={() => { setSpeed(s); if (v) v.playbackRate = s; setMenu(''); }}>{s}x</div>
          ))}
        </div>
      )}
    </div>
  );
}
