import React from 'react'
import { cn } from '@lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'h-9 w-full rounded-md border border-[var(--color-border)]',
          'bg-[var(--color-bg-surface-2)] px-3 text-sm',
          'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
          'outline-none transition-colors duration-150',
          'focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'no-drag',
          error && 'border-[var(--color-error)]',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-[var(--color-error)]">{error}</span>}
    </div>
  )
}
