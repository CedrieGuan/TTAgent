import React, { useState, useCallback } from 'react'
import { useSettingsStore } from '@stores/settings.store'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import type { AIProvider, ProviderDefinition, ProviderCategory } from '@shared/types/ai.types'
import {
  PROVIDER_REGISTRY,
  PROVIDER_MAP,
  CATEGORY_LABELS,
  CATEGORY_ORDER
} from '@shared/constants/providers'

export function SettingsPage() {
  const { providers, settings, updateProvider, updateSettings } = useSettingsStore()
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)

  const toggleProvider = (id: string) => {
    setExpandedProvider((prev) => (prev === id ? null : id))
  }

  const isConfigured = (id: string) => {
    const config = providers[id]
    const def = PROVIDER_MAP.get(id as AIProvider)
    if (!def) return false
    if (def.requiresApiKey) return !!config?.apiKey
    return !!config?.baseUrl || !!config?.apiKey
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto p-8 space-y-8">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">设置</h1>

        {/* AI 提供商 */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            AI 提供商
          </h2>

          {CATEGORY_ORDER.map((cat) => {
            const catProviders = PROVIDER_REGISTRY.filter((p) => p.category === cat)
            if (catProviders.length === 0) return null
            return (
              <ProviderCategoryGroup key={cat} label={CATEGORY_LABELS[cat]}>
                {catProviders.map((def) => (
                  <ProviderItem
                    key={def.id}
                    definition={def}
                    config={providers[def.id]}
                    configured={isConfigured(def.id)}
                    expanded={expandedProvider === def.id}
                    onToggle={() => toggleProvider(def.id)}
                    onSave={(config) => updateProvider(def.id, config)}
                  />
                ))}
              </ProviderCategoryGroup>
            )
          })}
        </section>

        {/* 通用设置 */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            通用
          </h2>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-primary)]">主题</span>
              <ThemeSelector
                value={settings.theme}
                onChange={(v) => updateSettings({ theme: v })}
              />
            </div>
            <label className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-primary)]">Enter 键发送消息</span>
              <Toggle
                checked={settings.sendOnEnter}
                onChange={(v) => updateSettings({ sendOnEnter: v })}
              />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-primary)]">字体大小</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => updateSettings({ fontSize: Math.max(12, settings.fontSize - 1) })}
                >
                  −
                </Button>
                <span className="text-sm w-8 text-center">{settings.fontSize}</span>
                <Button
                  size="sm"
                  onClick={() => updateSettings({ fontSize: Math.min(20, settings.fontSize + 1) })}
                >
                  +
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

/** 按分类分组的提供商容器 */
function ProviderCategoryGroup({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium text-[var(--color-text-muted)] px-1">{label}</h3>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] divide-y divide-[var(--color-border)] overflow-hidden">
        {children}
      </div>
    </div>
  )
}

/** 单个提供商行（可展开/折叠） */
function ProviderItem({
  definition,
  config,
  configured,
  expanded,
  onToggle,
  onSave
}: {
  definition: ProviderDefinition
  config: { apiKey?: string; baseUrl?: string; defaultModel?: string } | undefined
  configured: boolean
  expanded: boolean
  onToggle: () => void
  onSave: (config: { provider: AIProvider; apiKey: string; baseUrl?: string; defaultModel: string }) => Promise<void>
}) {
  return (
    <div>
      {/* 标题行 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--color-bg-hover)] no-drag"
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: configured ? definition.color : 'var(--color-text-muted)' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {definition.name}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                configured
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'
              }`}
            >
              {configured ? '已配置' : '未配置'}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] truncate">{definition.description}</p>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${
            expanded ? 'rotate-180' : ''
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* 展开的配置表单 */}
      {expanded && (
        <ProviderConfigForm definition={definition} config={config} onSave={onSave} />
      )}
    </div>
  )
}

/** 提供商配置表单 */
function ProviderConfigForm({
  definition,
  config,
  onSave
}: {
  definition: ProviderDefinition
  config: { apiKey?: string; baseUrl?: string; defaultModel?: string } | undefined
  onSave: (config: { provider: AIProvider; apiKey: string; baseUrl?: string; defaultModel: string }) => Promise<void>
}) {
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '')
  const [showKey, setShowKey] = useState(false)
  const [baseUrl, setBaseUrl] = useState(
    config?.baseUrl ?? definition.defaultBaseUrl ?? ''
  )
  const [defaultModel, setDefaultModel] = useState(
    config?.defaultModel ?? (definition.models[0]?.id ?? '')
  )
  const [customModel, setCustomModel] = useState(
    config?.defaultModel && !definition.models.find((m) => m.id === config.defaultModel)
      ? config.defaultModel
      : ''
  )
  const [useCustomModel, setUseCustomModel] = useState(
    !!config?.defaultModel && !definition.models.find((m) => m.id === config.defaultModel)
  )
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const handleSave = useCallback(async () => {
    setSaving(true)
    const modelValue = useCustomModel ? customModel : defaultModel
    await onSave({
      provider: definition.id,
      apiKey,
      baseUrl: definition.showBaseUrl ? baseUrl || undefined : baseUrl || definition.defaultBaseUrl,
      defaultModel: modelValue
    })
    setSaving(false)
    setSavedMsg('已保存')
    setTimeout(() => setSavedMsg(''), 2000)
  }, [apiKey, baseUrl, defaultModel, customModel, useCustomModel, definition, onSave])

  return (
    <div className="px-4 pb-4 pt-2 space-y-3 border-t border-[var(--color-border)] bg-[var(--color-bg-surface-2)]/30">
      {/* API Key */}
      {definition.requiresApiKey && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 API Key"
              className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] px-3 pr-10 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-colors duration-150 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 no-drag"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors no-drag"
            >
              {showKey ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {definition.website && (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                window.open(definition.website, '_blank')
              }}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline no-drag"
            >
              获取 API Key
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          )}
        </div>
      )}

      {/* Base URL */}
      {definition.showBaseUrl && (
        <Input
          label="Base URL"
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={definition.defaultBaseUrl || 'https://api.example.com/v1'}
        />
      )}

      {/* 默认模型 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">默认模型</label>
        {definition.models.length > 0 ? (
          <div className="space-y-2">
            <select
              value={useCustomModel ? '__custom__' : defaultModel}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setUseCustomModel(true)
                } else {
                  setUseCustomModel(false)
                  setDefaultModel(e.target.value)
                }
              }}
              className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors duration-150 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 no-drag"
            >
              {definition.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="__custom__">自定义模型...</option>
            </select>
            {useCustomModel && (
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="输入模型 ID"
                className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-colors duration-150 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 no-drag"
              />
            )}
          </div>
        ) : (
          <input
            type="text"
            value={useCustomModel ? customModel : defaultModel}
            onChange={(e) => {
              setUseCustomModel(true)
              setCustomModel(e.target.value)
              setDefaultModel(e.target.value)
            }}
            placeholder="输入模型 ID，例如 gpt-4o"
            className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-colors duration-150 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 no-drag"
          />
        )}
      </div>

      {/* 保存按钮 */}
      <div className="flex items-center gap-3 pt-1">
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          保存
        </Button>
        {savedMsg && (
          <span className="text-xs text-[var(--color-success)]">{savedMsg}</span>
        )}
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors duration-200 no-drag
        ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
          ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`}
      />
    </button>
  )
}

type Theme = 'light' | 'dark' | 'system'

function ThemeSelector({ value, onChange }: { value: Theme; onChange: (v: Theme) => void }) {
  const options: { value: Theme; label: string }[] = [
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
    { value: 'system', label: '跟随系统' }
  ]
  return (
    <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden no-drag">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-sm transition-colors duration-150
            ${value === opt.value
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
