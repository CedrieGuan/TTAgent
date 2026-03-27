import React from 'react'

interface SkillActivatedDisplayProps {
  name: string
  description: string
}

export function SkillActivatedDisplay({ name, description }: SkillActivatedDisplayProps) {
  return (
    <div className="w-full rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent-subtle)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs text-[var(--color-accent)]">⚡</span>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          已激活技能：<span className="text-[var(--color-accent)] font-mono">/{name}</span>
        </span>
        {description && (
          <span className="text-[10px] text-[var(--color-text-muted)] ml-auto truncate max-w-[50%]">
            {description}
          </span>
        )}
      </div>
    </div>
  )
}
