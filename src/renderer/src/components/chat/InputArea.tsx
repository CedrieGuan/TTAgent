import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@components/ui/Button'
import { useSettingsStore } from '@stores/settings.store'
import { useSlashCommand } from '@hooks/useSlashCommand'
import type { Attachment } from '@shared/types/ai.types'

interface InputAreaProps {
  onSend: (text: string, attachments?: Attachment[]) => void
  onCancel: () => void
  isStreaming: boolean
  isThinking: boolean
  disabled?: boolean
}

export function InputArea({ onSend, onCancel, isStreaming, isThinking, disabled }: InputAreaProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const { settings } = useSettingsStore()
  const { isActive: slashActive, candidates, selectSkill } = useSlashCommand(value)

  const isBusy = isStreaming || isThinking

  // 候选列表变化时重置选中索引
  useEffect(() => {
    setSelectedIndex(0)
  }, [candidates.length])

  const handleSend = useCallback(() => {
    const text = value.trim()
    if ((!text && attachments.length === 0) || isBusy || disabled) return
    setValue('')
    setAttachments([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    onSend(text, attachments.length > 0 ? attachments : undefined)
  }, [value, attachments, isBusy, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 斜杠命令候选列表键盘导航
    if (slashActive && candidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % candidates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + candidates.length) % candidates.length)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const skill = candidates[selectedIndex]
        if (skill) {
          const newVal = selectSkill(skill)
          setValue(newVal)
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
            textareaRef.current.focus()
          }
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setValue('')
        return
      }
    }

    if (settings.sendOnEnter) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    } else {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      }
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  // 读取文件为 base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // 去掉 data:xxx;base64, 前缀
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // 读取文本文件内容
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newAttachments: Attachment[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const data = await readFileAsBase64(file)
      newAttachments.push({
        type: 'image',
        name: file.name,
        mimeType: file.type,
        data,
        size: file.size
      })
    }
    setAttachments((prev) => [...prev, ...newAttachments])
    e.target.value = ''
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newAttachments: Attachment[] = []
    for (const file of Array.from(files)) {
      const isText =
        file.type.startsWith('text/') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.xml') ||
        file.name.endsWith('.yaml') ||
        file.name.endsWith('.yml')

      let data: string
      if (isText) {
        data = await readFileAsText(file)
      } else {
        data = await readFileAsBase64(file)
      }

      newAttachments.push({
        type: 'file',
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        data,
        size: file.size
      })
    }
    setAttachments((prev) => [...prev, ...newAttachments])
    e.target.value = ''
  }

  // 语音输入（Web Speech API）
  const toggleRecording = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ||
      window.SpeechRecognition

    if (!SpeechRecognitionAPI) {
      alert('当前环境不支持语音输入')
      return
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript
        }
      }
      if (finalText) {
        setValue((prev) => prev + finalText)
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
        }
      }
    }

    recognition.onerror = () => {
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }, [isRecording])

  // 组件卸载时停止录音
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const hint = settings.sendOnEnter ? 'Enter 发送，Shift+Enter 换行' : 'Cmd/Ctrl+Enter 发送'
  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled

  return (
    <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4">
      {/* 斜杠命令候选列表 */}
      {slashActive && candidates.length > 0 && (
        <div className="mb-2 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-md" style={{ maxHeight: '12rem' }}>
          {candidates.map((skill, i) => (
            <button
              key={skill.id}
              className={`no-drag flex w-full items-start gap-2 px-3 py-2 text-left transition-colors
                ${i === selectedIndex
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              onMouseEnter={() => setSelectedIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                const newVal = selectSkill(skill)
                setValue(newVal)
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto'
                  textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
                  textareaRef.current.focus()
                }
              }}
            >
              <span className="shrink-0 text-xs font-medium text-[var(--color-accent)]">/{skill.name}</span>
              {skill.description && (
                <span className="truncate text-xs text-[var(--color-text-muted)]">{skill.description}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 附件预览区 */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((att, i) => (
            <AttachmentChip key={i} attachment={att} onRemove={() => removeAttachment(i)} />
          ))}
        </div>
      )}

      <div className="flex gap-3 items-end rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2.5 focus-within:border-[var(--color-accent)] transition-colors">
        {/* 左侧工具栏 */}
        <div className="flex items-center gap-1 shrink-0 pb-0.5">
          <IconButton
            title="上传图片"
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled || isBusy}
          >
            <ImageIcon />
          </IconButton>
          <IconButton
            title="上传文件"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isBusy}
          >
            <PaperclipIcon />
          </IconButton>
          <IconButton
            title={isRecording ? '停止录音' : '语音输入'}
            onClick={toggleRecording}
            disabled={disabled || isBusy}
            active={isRecording}
          >
            <MicIcon />
          </IconButton>
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? '正在录音...' : '发送消息...'}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none leading-relaxed max-h-[200px] no-drag my-auto"
          style={{ minHeight: '24px' }}
        />

        <div className="flex items-center gap-2 shrink-0">
          {isBusy ? (
            <Button variant="danger" size="sm" onClick={onCancel}>
              <StopIcon />
              停止
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSend}
              disabled={!canSend}
            >
              <SendIcon />
              发送
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-[var(--color-text-muted)]">{hint}</p>
    </div>
  )
}

function AttachmentChip({
  attachment,
  onRemove
}: {
  attachment: Attachment
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] pl-2 pr-1 py-1">
      {attachment.type === 'image' ? (
        <img
          src={`data:${attachment.mimeType};base64,${attachment.data}`}
          alt={attachment.name}
          className="h-5 w-5 rounded object-cover"
        />
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-[var(--color-text-muted)]"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )}
      <span className="text-xs text-[var(--color-text-secondary)] max-w-[100px] truncate">
        {attachment.name}
      </span>
      <button
        onClick={onRemove}
        className="ml-0.5 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  active
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 transition-colors
        ${active
          ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]'
        }
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

const SendIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const StopIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
)

const ImageIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)

const PaperclipIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
)

const MicIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
)
