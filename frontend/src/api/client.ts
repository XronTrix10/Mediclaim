const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'
const TOKEN_KEY = 'mediclaim:access_token'
const USER_KEY = 'mediclaim:auth_user'

export class ApiError extends Error {
  status: number
  code: string
  errors?: Array<{ field: string; message: string }>

  constructor(status: number, message: string, code: string = 'ERROR', errors?: Array<{ field: string; message: string }>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    // Ignore storage issues in private mode
  }
}

export function getStoredUser(): any | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: any | null) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  } catch {
    // Ignore
  }
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getStoredToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(url, { ...options, headers })
  } catch {
    throw new ApiError(0, 'Unable to connect to Mediclaim server. Check your connection.', 'NETWORK_ERROR')
  }

  // Handle RFC 9457 / Problem Details responses
  if (!response.ok) {
    let errorData: any = {}
    try {
      errorData = await response.json()
    } catch {
      errorData = { detail: response.statusText }
    }

    const message = errorData.detail || errorData.message || 'Request failed'
    const code = errorData.code || 'API_ERROR'
    const errors = errorData.errors

    if (response.status === 401) {
      setStoredToken(null)
      setStoredUser(null)
    }

    throw new ApiError(response.status, message, code, errors)
  }

  if (response.status === 204) {
    return {} as T
  }

  const data = await response.json()
  return data
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
}
