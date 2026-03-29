import React, { useState, useEffect } from 'react'
import { MainLayout } from '@components/layout/MainLayout'
import { SettingsPage } from '@pages/SettingsPage'
import { HistoryPage } from '@pages/HistoryPage'
import { SkillsPage } from '@pages/SkillsPage'
import { MCPPage } from '@pages/MCPPage'
import { MemoryPage } from '@pages/MemoryPage'
import { TasksPage } from '@pages/TasksPage'
import { useStream } from '@hooks/useStream'
import { useTheme } from '@hooks/useTheme'
import { useSettingsStore } from '@stores/settings.store'
import { useSessionStore } from '@stores/session.store'
import { useSkillStore } from '@stores/skill.store'
import { useTaskStore } from '@stores/task.store'

type NavPage = 'tasks' | 'skills' | 'mcp' | 'memory' | 'history' | 'settings'

export default function App() {
  const [navPage, setNavPage] = useState<NavPage>('tasks')
  const [chatPanelOpen, setChatPanelOpen] = useState(true)
  const { loadSettings } = useSettingsStore()
  const { loadSessions } = useSessionStore()
  const { discoverSkills } = useSkillStore()
  const { loadTasks, handleTaskEvent } = useTaskStore()

  useStream()
  useTheme()

  useEffect(() => {
    loadSettings()
    loadSessions()
    discoverSkills()
    loadTasks()
  }, [loadSettings, loadSessions, discoverSkills, loadTasks])

  useEffect(() => {
    const cleanup = window.api.onTaskEvent(handleTaskEvent)
    return cleanup
  }, [handleTaskEvent])

  const renderPage = () => {
    switch (navPage) {
      case 'tasks':
        return <TasksPage />
      case 'skills':
        return <SkillsPage />
      case 'mcp':
        return <MCPPage />
      case 'memory':
        return <MemoryPage />
      case 'history':
        return <HistoryPage onOpenSession={() => setChatPanelOpen(true)} />
      case 'settings':
        return <SettingsPage />
    }
  }

  return (
    <MainLayout
      navPage={navPage}
      onNavigate={setNavPage}
      chatPanelOpen={chatPanelOpen}
      onToggleChatPanel={() => setChatPanelOpen((v) => !v)}
    >
      {renderPage()}
    </MainLayout>
  )
}
