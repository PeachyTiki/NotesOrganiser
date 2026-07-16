import React from 'react'
import { AppProvider, useApp } from './context/AppContext'
import Layout from './components/Layout'
import TemplatesPage from './components/templates/TemplatesPage'
import MeetingsPage from './components/meetings/MeetingsPage'
import LibraryPage from './components/library/LibraryPage'
import TasksPage from './components/tasks/TasksPage'
import TaskNotifications from './components/TaskNotifications'

function PageRouter() {
  const { activeSection } = useApp()
  if (activeSection === 'templates') return <TemplatesPage />
  if (activeSection === 'library') return <LibraryPage />
  if (activeSection === 'tasks') return <TasksPage />
  return <MeetingsPage />
}

export default function App() {
  return (
    <AppProvider>
      <TaskNotifications />
      <Layout>
        <PageRouter />
      </Layout>
    </AppProvider>
  )
}
