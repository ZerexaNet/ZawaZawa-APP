import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, type?: Toast['type']) => void;
  dismiss: (id: string) => void;
}

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { id, message, type }].slice(-4) });
    setTimeout(() => get().dismiss(id), type === 'error' ? 4200 : 2600);
  },
  dismiss: id => set({ toasts: get().toasts.filter(t => t.id !== id) }),
}));

/** 从任意错误中提取可读消息 */
export function errMsg(e: any, fallback = '操作失败，请稍后重试'): string {
  if (!e) return fallback;
  const m = e?.message || e?.detail || (typeof e?.data === 'string' ? e.data : '');
  if (!m) return fallback;
  if (m === 'Request failed with status code') return `请求失败 (${e?.status})`;
  return m;
}
