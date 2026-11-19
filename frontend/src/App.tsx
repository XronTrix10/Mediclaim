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

// Doctor pages
import DoctorLayout from './pages/doctor/DoctorLayout'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import DoctorPatients from './pages/doctor/DoctorPatients'
import DoctorPatientDetail from './pages/doctor/DoctorPatientDetail'
import DoctorRequestAccess from './pages/doctor/DoctorRequestAccess'
import DoctorAccessHistory from './pages/doctor/DoctorAccessHistory'

// Hospital pages
import HospitalLayout from './pages/hospital/HospitalLayout'
import HospitalDashboard from './pages/hospital/HospitalDashboard'
import HospitalPatients from './pages/hospital/HospitalPatients'
import HospitalPractitioners from './pages/hospital/HospitalPractitioners'

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

      {/* Patient portal (default /app) */}
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="records" element={<Records />} />
        <Route path="access" element={<Access />} />
      </Route>

      {/* Doctor portal */}
      <Route path="/app/doctor" element={<DoctorLayout />}>
        <Route index element={<DoctorDashboard />} />
        <Route path="patients" element={<DoctorPatients />} />
        <Route path="patients/:mediclaimId" element={<DoctorPatientDetail />} />
        <Route path="request-access" element={<DoctorRequestAccess />} />
        <Route path="access-history" element={<DoctorAccessHistory />} />
      </Route>

      {/* Hospital portal */}
      <Route path="/app/hospital" element={<HospitalLayout />}>
        <Route index element={<HospitalDashboard />} />
        <Route path="patients" element={<HospitalPatients />} />
        <Route path="practitioners" element={<HospitalPractitioners />} />
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
