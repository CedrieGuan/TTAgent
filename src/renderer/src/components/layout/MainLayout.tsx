/// <reference types="vite/client" />
import React from 'react'
import { Titlebar } from './Titlebar'
import { IconNav } from './IconNav'
import type { NavPage } from './IconNav'
import { ChatPanel } from './ChatPanel'
import { LogViewer } from '@components/dev/LogViewer'

interface MainLayoutProps {
  navPage: NavPage
  onNavigate: (page: NavPage) => void
  chatPanelOpen: boolean
  onToggleChatPanel: () => void
  children: React.ReactNode
}

export function MainLayout({
  navPage,
  onNavigate,
  chatPanelOpen,
  onToggleChatPanel,
  children
}: MainLayoutProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg-base)]">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden min-h-0">
        <IconNav currentPage={navPage} onNavigate={onNavigate} />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
        <ChatPanel open={chatPanelOpen} onToggle={onToggleChatPanel} />
      </div>
      {import.meta.env.DEV && <LogViewer />}
    </div>
  )
}
