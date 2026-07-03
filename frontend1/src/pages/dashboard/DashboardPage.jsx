import React from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import DashboardAnalyst from './DashboardAnalyst.jsx'
import DashboardRSSI    from './DashboardRSSI.jsx'
import DashboardAuditor from './DashboardAuditor.jsx'
import DashboardReader  from './DashboardReader.jsx'

export default function DashboardPage() {
  const { user } = useAuth()
  const role = user?.role

  if (role === 'rssi')               return <DashboardRSSI />
  if (role === 'auditor')            return <DashboardAuditor />
  if (role === 'reader')             return <DashboardReader />
  // ANALYST + ADMIN
  return <DashboardAnalyst />
}