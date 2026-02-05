import { useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Simple in-memory toast store
let toasts: Toast[] = [];
const listeners: Set<(toasts: Toast[]) => void> = new Set();
let nextId = 0;

function notifyListeners() {
  listeners.forEach((listener) => listener([...toasts]));
}

function addToast(message: string, type: ToastType = 'info', duration: number = 4000) {
  const id = `toast-${nextId++}`;
  const toast: Toast = { id, message, type, duration };

  toasts.push(toast);
  notifyListeners();

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  return id;
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notifyListeners();
}

export function useToast() {
  const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    return addToast(message, type, duration);
  }, []);

  return { showToast };
}

export { addToast, removeToast };
export type { Toast, ToastType };
