import { Navigate, Route, Routes } from 'react-router-dom'
import PublicLayout from './components/PublicLayout'
import AppLayout from './components/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Timeline from './pages/Timeline'
import Records from './pages/Records'
import Access from './pages/Access'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* TODO: wrap in a route guard once auth is wired up (src/auth/) */}
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="records" element={<Records />} />
        <Route path="access" element={<Access />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
