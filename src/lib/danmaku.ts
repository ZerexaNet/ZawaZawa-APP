// 轻量 canvas 弹幕引擎：对象池 + 行槽位 + rAF 驱动，性能优先。
import type { Danmaku } from './types';

export interface DmItem {
  id: number;
  content: string;
  time: number;        // 秒
  color: string;
  mode: 'scroll' | 'top' | 'bottom';
  size: number;
  // 运行时
  x: number;
  w: number;
  h: number;
  y: number;
  lane: number;
  entered: boolean;
  done: boolean;
  speed: number;
}

const TOP_LANES = 4;
const BOT_LANES = 4;

export class DanmakuEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  items: DmItem[] = [];
  pool: DmItem[] = [];
  laneFreeTop: number[] = [];
  laneFreeBot: number[] = [];
  paused = false;
  opacity = 0.92;
  showScroll = true;
  showTop = true;
  showBot = true;
  maxOnScreen = 120;
  private raf = 0;
  private last = 0;
  private seq = 0;
  current = 0;
  onSeek?: (t: number) => void;
  fontBase = 22;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.laneFreeTop = Array(TOP_LANES).fill(Infinity);
    this.laneFreeBot = Array(BOT_LANES).fill(Infinity);
    canvas.addEventListener('click', this.onClick);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('click', this.onClick);
    this.items = [];
    this.pool = [];
  }

  load(list: Danmaku[], startAt = 0) {
    this.clear();
    for (const d of list) this.add(d, true);
    this.current = startAt;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear() {
    this.items = [];
    for (const it of this.pool) this.free(it);
    this.laneFreeTop = Array(TOP_LANES).fill(Infinity);
    this.laneFreeBot = Array(BOT_LANES).fill(Infinity);
    this.ctx.clearRect(0, 0, this.W, this.H);
  }

  private free(it: DmItem) {
    it.x = 0; it.w = 0; it.y = 0; it.lane = 0; it.entered = false; it.done = false; it.speed = 0;
    this.pool.push(it);
  }

  add(d: Danmaku, silent = false) {
    const mode: DmItem['mode'] = d.mode === 'top' ? 'top' : d.mode === 'bottom' ? 'bottom' : 'scroll';
    if (mode === 'scroll' && !this.showScroll) return;
    if (mode === 'top' && !this.showTop) return;
    if (mode === 'bottom' && !this.showBot) return;
    let it = this.pool.pop();
    if (!it) it = {} as DmItem;
    it.id = ++this.seq;
    it.content = (d.content || '').slice(0, 80);
    it.time = Number(d.time_sec ?? d.time ?? 0);
    it.color = d.color || '#ffffff';
    it.mode = mode;
    it.size = d.fontsize ? Math.max(14, Math.min(34, d.fontsize)) : this.fontBase;
    it.speed = 0;
    it.entered = false;
    it.done = false;
    it.lane = 0;
    this.measure(it);
    if (!silent) {
      this.items.push(it);
    } else if (it.time > this.current) {
      this.items.push(it);
    }
  }

  private measure(it: DmItem) {
    this.ctx.font = `600 ${it.size}px "Google Sans", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif`;
    it.w = this.ctx.measureText(it.content).width;
    it.h = it.size * 1.5;
    if (it.mode === 'top' || it.mode === 'bottom') {
      const lanes = it.mode === 'top' ? this.laneFreeTop : this.laneFreeBot;
      let lane = lanes.indexOf(Math.min(...lanes));
      if (lane < 0) lane = 0;
      lanes[lane] = it.time;
      it.lane = lane;
      it.y = it.mode === 'top'
        ? 10 + lane * (it.h + 4)
        : this.H - 34 - (lanes.length - 1 - lane) * (it.h + 4);
      it.x = (this.W - it.w) / 2;
      it.speed = 0;
    } else {
      it.y = 10 + Math.floor(Math.random() * 8) * (this.fontBase + 6);
      it.x = this.W;
      it.speed = Math.max(55, Math.min(95, it.w / 5)); // px/s，约 6-8s 横穿
    }
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) this.last = performance.now();
  }

  private hitRects: { x: number; y: number; w: number; h: number; time: number }[] = [];
  onClick = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    // 命中检测：取最近 1.5s 内的项
    const now = this.current;
    let best: { time: number; d: number } | null = null;
    for (const hr of this.hitRects) {
      if (x >= hr.x - 4 && x <= hr.x + hr.w + 4 && y >= hr.y - 4 && y <= hr.y + hr.h + 4) {
        const d = Math.abs(hr.time - now);
        if (!best || d < best.d) best = { time: hr.time, d };
      }
    }
    if (best && this.onSeek) this.onSeek(best.time);
  };

  frame(ts: number) {
    this.raf = requestAnimationFrame(this.frame);
    if (!this.W) { this.resize(); return; }
    const dt = Math.min(0.1, (ts - (this.last || ts)) / 1000);
    this.last = ts;
    const t = this.current;
    if (this.paused) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.globalAlpha = this.opacity;
    ctx.textBaseline = 'top';
    this.hitRects.length = 0;

    const alive: DmItem[] = [];
    for (const it of this.items) {
      if (it.done) { this.free(it); continue; }
      if (it.time > t + 0.35) { alive.push(it); continue; }
      const age = t - it.time;
      if (age < 0) continue;
      if (it.mode === 'scroll') {
        if (!it.entered) { it.entered = true; it.x = this.W; }
        it.x -= it.speed * dt;
        if (it.x + it.w < -10) { this.free(it); continue; }
        ctx.font = `600 ${it.size}px "Google Sans", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif`;
        this.draw(ctx, it.content, it.x, it.y, it.color);
        this.hitRects.push({ x: it.x, y: it.y, w: it.w, h: it.h, time: it.time });
      } else {
        const life = 5.5;
        if (age > life) { this.free(it); continue; }
        const fade = age > life - 1 ? (life - age) : 1;
        ctx.globalAlpha = this.opacity * Math.min(1, fade);
        ctx.font = `600 ${it.size}px "Google Sans", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif`;
        this.draw(ctx, it.content, it.x, it.y, it.color);
        ctx.globalAlpha = this.opacity;
        this.hitRects.push({ x: it.x, y: it.y, w: it.w, h: it.h, time: it.time });
      }
      alive.push(it);
    }
    this.items = alive;
  }

  private draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
    // 描边阴影保证可读性（两次绘制，代价低）
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  start() {
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }
}
