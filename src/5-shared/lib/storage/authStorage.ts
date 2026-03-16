/**
 * Auth Storage Utility
 * Encapsulates authentication data storage operations
 */

const TOKEN_KEY = 'access_token'
const USER_KEY = 'current_user'

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token)
  },

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY)
  },

  getUser(): unknown {
    const user = localStorage.getItem(USER_KEY)
    return user ? JSON.parse(user) : null
  },

  setUser(user: unknown): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  removeUser(): void {
    localStorage.removeItem(USER_KEY)
  },

  clear(): void {
    this.removeToken()
    this.removeUser()
  }
}
