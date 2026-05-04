'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) confirmRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 fade-in-up">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle size={20} className={danger ? 'text-red-600' : 'text-amber-600'} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 text-base">{title}</h3>
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="btn-secondary">
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={danger
              ? 'px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors'
              : 'btn-primary'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface InputModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  inputType?: string;
}

export function InputModal({
  isOpen,
  title,
  message,
  placeholder = '',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  value,
  onChange,
  onConfirm,
  onCancel,
  inputType = 'text',
}: InputModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 fade-in-up">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-slate-900 text-base">{title}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">{message}</p>
        <input
          ref={inputRef}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onCancel} className="btn-secondary">{cancelLabel}</button>
          <button onClick={onConfirm} className="btn-primary">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
