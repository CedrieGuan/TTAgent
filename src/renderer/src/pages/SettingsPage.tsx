import React, { useState } from 'react'
import { useSettingsStore } from '@stores/settings.store'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import type { AIProvider } from '@shared/types/ai.types'
import { PROVIDER_LABELS } from '@shared/constants/providers'

export function SettingsPage() {
  const { providers, settings, updateProvider, updateSettings } = useSettingsStore()
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // Anthropic 配置
  const anthropicConfig = providers['anthropic']
  const [anthropicKey, setAnthropicKey] = useState(anthropicConfig?.apiKey ?? '')

  // OpenAI 配置
  const openaiConfig = providers['openai']
  const [openaiKey, setOpenaiKey] = useState(openaiConfig?.apiKey ?? '')
  const [openaiBase, setOpenaiBase] = useState(openaiConfig?.baseUrl ?? '')

  // 智谱 AI 配置
  const zhipuConfig = providers['zhipuai']
  const [zhipuKey, setZhipuKey] = useState(zhipuConfig?.apiKey ?? '')

  const handleSave = async () => {
    setSaving(true)
    await Promise.all([
      updateProvider('anthropic', {
        provider: 'anthropic' as AIProvider,
        apiKey: anthropicKey,
        defaultModel: anthropicConfig?.defaultModel ?? 'claude-sonnet-4-6'
      }),
      updateProvider('openai', {
        provider: 'openai' as AIProvider,
        apiKey: openaiKey,
        baseUrl: openaiBase || undefined,
        defaultModel: openaiConfig?.defaultModel ?? 'gpt-4.1'
      }),
      updateProvider('zhipuai', {
        provider: 'zhipuai' as AIProvider,
        apiKey: zhipuKey,
        defaultModel: zhipuConfig?.defaultModel ?? 'glm-5.1'
      })
    ])
    setSaving(false)
    setSavedMsg('已保存')
    setTimeout(() => setSavedMsg(''), 2000)
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

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] divide-y divide-[var(--color-border)]">
            <ProviderSection title={PROVIDER_LABELS['anthropic']}>
              <Input
                label="API Key"
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
              />
            </ProviderSection>

            <ProviderSection title={PROVIDER_LABELS['openai']}>
              <Input
                label="API Key"
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
              />
              <Input
                label="Base URL（可选，用于自定义端点）"
                type="url"
                value={openaiBase}
                onChange={(e) => setOpenaiBase(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </ProviderSection>

            <ProviderSection title={PROVIDER_LABELS['zhipuai']}>
              <Input
                label="API Key"
                type="password"
                value={zhipuKey}
                onChange={(e) => setZhipuKey(e.target.value)}
                placeholder="在 open.bigmodel.cn 获取"
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                支持模型：GLM-5.1 / GLM-4.7 / GLM-4.5 Air / GLM-4.7 Flash（免费）/ GLM-4.6V（视觉）
              </p>
            </ProviderSection>
          </div>
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
                >−</Button>
                <span className="text-sm w-8 text-center">{settings.fontSize}</span>
                <Button
                  size="sm"
                  onClick={() => updateSettings({ fontSize: Math.min(20, settings.fontSize + 1) })}
                >+</Button>
              </div>
            </div>
          </div>
        </section>

        {/* 保存按钮 */}
        <div className="flex items-center gap-3">
          <Button variant="primary" size="lg" loading={saving} onClick={handleSave}>
            保存设置
          </Button>
          {savedMsg && (
            <span className="text-sm text-[var(--color-success)]">{savedMsg}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ProviderSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{title}</h3>
      {children}
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
