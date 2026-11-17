import { Navigate, Route, Routes } from 'react-router-dom'
import PublicLayout from './components/PublicLayout'
import AppLayout from './components/AppLayout'
import AdminLayout from './components/AdminLayout'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Timeline from './pages/Timeline'
import Records from './pages/Records'
import Access from './pages/Access'
import AdminLogin from './pages/admin/AdminLogin'
import AdminOverview from './pages/admin/AdminOverview'
import AdminVerifications from './pages/admin/AdminVerifications'
import AdminPatients from './pages/admin/AdminPatients'
import AdminOrganizations from './pages/admin/AdminOrganizations'
import AdminPractitioners from './pages/admin/AdminPractitioners'
import AdminEmergencyEvents from './pages/admin/AdminEmergencyEvents'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
      </Route>
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/admin" element={<AdminLogin />} />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/register" element={<Navigate to="/auth?mode=register" replace />} />
      <Route path="/admin/login" element={<Navigate to="/auth/admin" replace />} />

      {/* TODO: wrap in a route guard once auth is wired up (src/auth/) */}
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="records" element={<Records />} />
        <Route path="access" element={<Access />} />
      </Route>

      {/* Admin portal */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="verifications" element={<AdminVerifications />} />
        <Route path="patients" element={<AdminPatients />} />
        <Route path="organizations" element={<AdminOrganizations />} />
        <Route path="practitioners" element={<AdminPractitioners />} />
        <Route path="emergency" element={<AdminEmergencyEvents />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
