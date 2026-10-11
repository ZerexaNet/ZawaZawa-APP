// Canvas 弹幕引擎 —— 由 Player 的 rAF 循环驱动
export interface DanmakuItem {
  id: string;
  text: string;
  timeSec: number;
  color?: string;
  mode?: string; // scroll | top | bottom
  fontsize?: number;
}

interface ActiveItem {
  text: string;
  color: string;
  size: number;
  x: number;
  y: number;
  speed: number;
  w: number;
  kind: 'scroll' | 'top' | 'bottom';
  born: number;      // 视频时间点（用于点击跳转）
  spawnAt: number;   // performance.now 出生时间（top/bottom 定时消失）
}

const LANE_HEIGHT = 42;
const TOP_SHOW_MS = 5000;

export class DanmakuEngine {
  private ctx: CanvasRenderingContext2D;
  private width = 640;
  private height = 360;
  private items: DanmakuItem[] = [];
  private itemIndex = 0; // 游标：items[0..itemIndex) 已在时间上处理过
  private active: ActiveItem[] = [];
  private lanes: { y: number; bottomEdge: number }[] = [];
  private topRow = 0;
  private bottomRow = 0;
  private hitBoxes: { x: number; y: number; w: number; h: number; sec: number }[] = [];
  onSeek?: (sec: number) => void;
  visible = true;
  opacity = 0.9;

  private canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.canvas.addEventListener('click', this.handleClick);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(200, rect.width);
    this.height = Math.max(150, rect.height);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.initLanes();
  }

  private initLanes() {
    this.lanes = [];
    for (let y = LANE_HEIGHT + 8; y < this.height - 10; y += LANE_HEIGHT) {
      this.lanes.push({ y, bottomEdge: this.width });
    }
    if (!this.lanes.length) this.lanes.push({ y: 30, bottomEdge: 0 });
  }

  load(items: DanmakuItem[], currentTime = 0) {
    this.items = [...items].sort((a, b) => a.timeSec - b.timeSec);
    this.active = [];
    this.initLanes();
    // seek 到 currentTime：把过去 8 秒的弹幕按年龄生成
    this.itemIndex = 0;
    for (let i = 0; i < this.items.length && this.items[i].timeSec <= currentTime; i++) {
      const it = this.items[i];
      const age = currentTime - it.timeSec;
      if (age < 9) this.spawn(it, age);
    }
    this.itemIndex = this.items.findIndex((it) => it.timeSec > currentTime);
    if (this.itemIndex < 0) this.itemIndex = this.items.length;
  }

  add(item: DanmakuItem, currentTime?: number) {
    this.items.push(item);
    this.items.sort((a, b) => a.timeSec - b.timeSec);
    if (currentTime !== undefined && Math.abs(item.timeSec - currentTime) < 0.6) {
      this.spawn(item, 0);
    }
  }

  clear() {
    this.active = [];
    this.initLanes();
    this.hitBoxes = [];
  }

  private spawn(it: DanmakuItem, ageSec: number) {
    const size = Math.min(30, Math.max(16, it.fontsize || 25));
    this.ctx.font = `bold ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
    const w = this.ctx.measureText(it.text).width + 10;
    const kind: ActiveItem['kind'] = it.mode === 'top' ? 'top' : it.mode === 'bottom' ? 'bottom' : 'scroll';
    let x: number, y: number, speed: number;
    if (kind === 'scroll') {
      speed = (this.width + 40) / 4.2;
      x = this.width + 20 - ageSec * speed;
      let lane = this.lanes[0];
      for (const l of this.lanes) if (l.bottomEdge <= 0) { lane = l; break; }
      if (ageSec >= 0) lane.bottomEdge = Math.min(lane.bottomEdge, x - w - 8);
      y = lane.y;
    } else {
      speed = 0;
      if (kind === 'top') {
        y = this.topRow * LANE_HEIGHT + 14;
        this.topRow = (this.topRow + 1) % 3;
      } else {
        y = this.height - this.bottomRow * LANE_HEIGHT - 14;
        this.bottomRow = (this.bottomRow + 1) % 3;
      }
      x = this.width / 2 - w / 2;
    }
    this.active.push({
      text: it.text,
      color: it.color || '#ffffff',
      size,
      x, y, speed, w, kind,
      born: it.timeSec,
      spawnAt: performance.now() - ageSec * 1000,
    });
  }

  /** 每帧调用：dtSec 为播放推进秒数（暂停时传 0） */
  update(dtSec: number) {
    // 移动
    const next: ActiveItem[] = [];
    for (const a of this.active) {
      if (a.kind === 'scroll') {
        a.x -= a.speed * dtSec;
        if (a.x + a.w > -20) {
          const lane = this.lanes.find((l) => l.y === a.y);
          if (lane) lane.bottomEdge = Math.min(lane.bottomEdge, a.x - a.w - 8);
          next.push(a);
        }
      } else if (performance.now() - a.spawnAt < TOP_SHOW_MS) {
        next.push(a);
      }
    }
    this.active = next;
  }

  /** 播放时间推进时调用：spawn 新弹幕（由 Player 传入 currentTime 与上一帧时间） */
  advance(fromSec: number, toSec: number) {
    if (toSec < fromSec - 0.5) {
      // 大回退 seek：由 load 处理
      return;
    }
    while (this.itemIndex < this.items.length && this.items[this.itemIndex].timeSec <= toSec) {
      const it = this.items[this.itemIndex];
      if (it.timeSec >= fromSec - 0.2) this.spawn(it, 0);
      this.itemIndex++;
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.hitBoxes = [];
    if (!this.visible) return;
    for (const a of this.active) {
      ctx.globalAlpha = this.opacity;
      ctx.font = `bold ${a.size}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(a.text, a.x, a.y);
      ctx.fillStyle = a.color;
      ctx.fillText(a.text, a.x, a.y);
      ctx.globalAlpha = 1;
      this.hitBoxes.push({ x: a.x, y: a.y - a.size, w: a.w, h: a.size + 8, sec: a.born });
    }
  }

  private handleClick = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // 优先取最靠近点击点的弹幕
    let best: { sec: number; d: number } | null = null;
    for (const h of this.hitBoxes) {
      if (x >= h.x - 4 && x <= h.x + h.w + 4 && y >= h.y - 4 && y <= h.y + h.h + 4) {
        const d = Math.abs(y - (h.y + h.h / 2));
        if (!best || d < best.d) best = { sec: h.sec, d };
      }
    }
    if (best) this.onSeek?.(best.sec);
  };

  destroy() {
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.getContext('2d')?.clearRect(0, 0, this.width, this.height);
  }
}
