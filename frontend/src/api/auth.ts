import { api, setStoredToken, setStoredUser, getStoredUser, getStoredToken } from './client'
import type { UserRole } from '../types/auth'

export interface UserSummary {
  id: string
  fullName: string
  email?: string | null
  phone: string
  role: UserRole
  mediclaimId?: string | null
  doctorId?: string | null
  hospitalId?: string | null
  isActive: boolean
  adminVerified: boolean
  isProfileComplete: boolean
}

export interface RegisterResult {
  userId: string
  phone: string
  accountStatus: string
  otpSent: boolean
  otpExpiresInSeconds: number
  debugOtp?: string | null
  mediclaimId?: string | null
  doctorId?: string | null
  hospitalId?: string | null
}

export interface VerifyOtpResult {
  userId: string
  phone: string
  accountStatus: string
  phoneVerified: boolean
  adminVerified: boolean
  message: string
}

export interface AuthSession {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: UserSummary
}

export interface RequestOtpResult {
  maskedPhone: string
  otpExpiresInSeconds: number
  debugOtp?: string | null
}

export const authApi = {
  async register(payload: {
    fullName: string
    dateOfBirth: string
    phone: string
    aadhaarNumber: string
    password: string
  }): Promise<RegisterResult> {
    const res = await api.post<{ status: string; data: RegisterResult }>('/auth/register', payload)
    return res.data
  },

  async verifyOtp(userId: string, otp: string): Promise<VerifyOtpResult> {
    const res = await api.post<{ status: string; data: VerifyOtpResult }>('/auth/verify-otp', {
      userId,
      otp,
    })
    return res.data
  },

  async login(payload: {
    mediclaimId: string
    password?: string
    otp?: string
  }): Promise<AuthSession> {
    const res = await api.post<{ status: string; data: AuthSession }>('/auth/login', payload)
    setStoredToken(res.data.accessToken)
    setStoredUser(res.data.user)
    return res.data
  },

  async adminLogin(payload: {
    username: string
    password: string
  }): Promise<AuthSession> {
    const res = await api.post<{ status: string; data: AuthSession }>('/auth/admin/login', payload)
    setStoredToken(res.data.accessToken)
    setStoredUser(res.data.user)
    return res.data
  },

  isAdmin(): boolean {
    const user = getStoredUser()
    const token = getStoredToken()
    return !!token && !!user && (user.role === 'admin' || user.role === 'hospital_admin')
  },

  async requestOtp(mediclaimId: string): Promise<RequestOtpResult> {
    const res = await api.post<{ status: string; data: RequestOtpResult }>('/auth/otp/request', {
      mediclaimId,
    })
    return res.data
  },

  async resendOtp(userId: string): Promise<{ otpExpiresInSeconds: number; debugOtp?: string | null }> {
    const res = await api.post<{ status: string; data: { otpExpiresInSeconds: number; debugOtp?: string | null } }>(
      '/auth/resend-otp',
      { userId }
    )
    return res.data
  },

  // ── Doctor auth ──────────────────────────────────────────────
  async registerDoctor(payload: {
    fullName: string
    dateOfBirth: string
    phone: string
    aadhaarNumber: string
    password: string
    medicalLicenseNumber: string
    specialization: string
    yearsOfExperience?: number
    hospitalName?: string
  }): Promise<RegisterResult> {
    const res = await api.post<{ status: string; data: RegisterResult }>('/doctor/register', payload)
    return res.data
  },

  async doctorRequestOtp(payload: { phone?: string; doctorId?: string }): Promise<RequestOtpResult> {
    const res = await api.post<{ status: string; data: RequestOtpResult }>('/doctor/login/request-otp', payload)
    return res.data
  },

  async doctorVerifyOtp(payload: { phone?: string; doctorId?: string; otp: string }): Promise<AuthSession> {
    const res = await api.post<{ status: string; data: AuthSession }>('/doctor/login/verify-otp', payload)
    setStoredToken(res.data.accessToken)
    setStoredUser(res.data.user)
    return res.data
  },

  // ── Hospital auth ─────────────────────────────────────────────
  async registerHospital(payload: {
    name: string
    registrationNumber: string
    type: string
    address: string
    phone: string
    email: string
    password: string
  }): Promise<{ orgId: string; hospitalId?: string; message: string }> {
    const res = await api.post<{ status: string; data: { orgId: string; hospitalId?: string; message: string } }>('/hospital/register', payload)
    return res.data
  },

  async hospitalRequestOtp(payload: { hospitalId?: string; email?: string; phone?: string }): Promise<RequestOtpResult> {
    const res = await api.post<{ status: string; data: RequestOtpResult }>('/hospital/login/request-otp', payload)
    return res.data
  },

  async hospitalVerifyOtp(payload: { hospitalId?: string; email?: string; phone?: string; otp: string }): Promise<AuthSession> {
    const res = await api.post<{ status: string; data: AuthSession }>('/hospital/login/verify-otp', payload)
    setStoredToken(res.data.accessToken)
    setStoredUser(res.data.user)
    return res.data
  },

  async hospitalLogin(payload: {
    hospitalId?: string
    email?: string
    phone?: string
    password?: string
    otp?: string
  }): Promise<AuthSession> {
    const res = await api.post<{ status: string; data: AuthSession }>('/hospital/login', payload)
    setStoredToken(res.data.accessToken)
    setStoredUser(res.data.user)
    return res.data
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout', {})
    } catch {
      // Ignore errors on logout
    } finally {
      setStoredToken(null)
      setStoredUser(null)
    }
  },

  getCurrentUser(): UserSummary | null {
    return getStoredUser()
  },

  isAuthenticated(): boolean {
    return !!getStoredToken()
  },
}
