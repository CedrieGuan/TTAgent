import React from 'react'
import { Titlebar } from './Titlebar'
import { Sidebar } from './Sidebar'

type Page = 'chat' | 'history' | 'settings' | 'agent-config'

interface MainLayoutProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  children: React.ReactNode
}

export function MainLayout({ currentPage, onNavigate, children }: MainLayoutProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg-base)]">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
