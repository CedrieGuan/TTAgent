import React, { useState, useEffect } from 'react'
import { MainLayout } from '@components/layout/MainLayout'
import { ChatPage } from '@pages/ChatPage'
import { SettingsPage } from '@pages/SettingsPage'
import { HistoryPage } from '@pages/HistoryPage'
import { AgentConfigPage } from '@pages/AgentConfigPage'
import { useStream } from '@hooks/useStream'
import { useTheme } from '@hooks/useTheme'
import { useSettingsStore } from '@stores/settings.store'
import { useSessionStore } from '@stores/session.store'
import { useSkillStore } from '@stores/skill.store'

type Page = 'chat' | 'history' | 'settings' | 'agent-config'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const { loadSettings } = useSettingsStore()
  const { loadSessions } = useSessionStore()
  const { discoverSkills } = useSkillStore()

  // 注册全局流式监听
  useStream()
  // 主题/字体应用
  useTheme()

  // 启动时加载配置、会话列表和技能
  useEffect(() => {
    loadSettings()
    loadSessions()
    discoverSkills()
  }, [loadSettings, loadSessions, discoverSkills])

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatPage />
      case 'history':
        return <HistoryPage onNavigateToChat={() => setCurrentPage('chat')} />
      case 'settings':
        return <SettingsPage />
      case 'agent-config':
        return <AgentConfigPage />
    }
  }

  return (
    <MainLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </MainLayout>
  )
}
