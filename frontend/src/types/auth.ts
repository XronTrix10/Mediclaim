export type UserRole = 'patient' | 'practitioner' | 'hospital_admin' | 'caregiver'

export interface User {
  id: string
  fullName: string
  email: string
  phone: string
  role: UserRole
  mediclaimId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LoginPayload {
  mediclaimId: string
  password?: string
  otp?: string
}

export interface RegisterPayload {
  fullName: string
  dateOfBirth: string
  phone: string
  aadhaarNumber: string
  password?: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: User
}

