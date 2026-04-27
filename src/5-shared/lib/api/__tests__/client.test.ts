/**
 * API Client Tests
 *
 * Integration tests for API client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { ApiClient, createApiClient } from '../client'

describe('API Client', () => {
  let client: ApiClient
  let axiosInstance: AxiosInstance

  beforeEach(() => {
    client = createApiClient({
      baseURL: '/api',
      timeout: 5000
    })
    axiosInstance = client.getAxiosInstance()
  })

  describe('GET Requests', () => {
    it('should make successful GET request', async () => {
      const responseData = { id: 1, name: 'Test' }
      vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: responseData })

      const result = await client.get('/users/1')
      expect(result).toEqual({ data: responseData })
    })

    it('should pass query parameters', async () => {
      const getSpy = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: [] })

      await client.get('/users', { page: 1, size: 10 })

      expect(getSpy).toHaveBeenCalledWith(
        '/users',
        expect.objectContaining({
          params: { page: 1, size: 10 }
        })
      )
    })

    it('should handle GET request error', async () => {
      vi.spyOn(axiosInstance, 'get').mockRejectedValue(new Error('Not found'))

      await expect(client.get('/users/999')).rejects.toThrow()
    })
  })

  describe('POST Requests', () => {
    it('should make successful POST request', async () => {
      const requestData = { name: 'New User', email: 'user@example.com' }
      const responseData = { id: 1, ...requestData }
      vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: responseData })

      const result = await client.post('/users', requestData)
      expect(result).toEqual({ data: responseData })
    })

    it('should handle POST request error', async () => {
      vi.spyOn(axiosInstance, 'post').mockRejectedValue(new Error('Invalid data'))

      await expect(client.post('/users', {})).rejects.toThrow()
    })
  })

  describe('PUT Requests', () => {
    it('should make successful PUT request', async () => {
      const requestData = { name: 'Updated User' }
      const responseData = { id: 1, ...requestData }
      vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: responseData })

      const result = await client.put('/users/1', requestData)
      expect(result).toEqual({ data: responseData })
    })
  })

  describe('DELETE Requests', () => {
    it('should make successful DELETE request', async () => {
      vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: null })

      const result = await client.delete('/users/1')
      expect(result).toBeDefined()
    })
  })

  describe('PATCH Requests', () => {
    it('should make successful PATCH request', async () => {
      const requestData = { name: 'Patched User' }
      const responseData = { id: 1, name: 'Patched User', email: 'user@example.com' }
      vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: responseData })

      const result = await client.patch('/users/1', requestData)
      expect(result).toEqual({ data: responseData })
    })
  })

  describe('File Upload', () => {
    it('should upload file successfully', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const responseData = { id: 1, filename: 'test.txt', url: '/files/test.txt' }

      vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: responseData })

      const result = await client.upload('/upload', file)
      expect(result).toEqual({ data: responseData })
    })

    it('should upload file with additional data', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const additionalData = { category: 'documents', public: true }

      const postSpy = vi.spyOn(axiosInstance, 'post').mockResolvedValue({
        data: { id: 1, filename: 'test.txt' }
      })

      await client.upload('/upload', file, additionalData)

      expect(postSpy).toHaveBeenCalled()
    })
  })

  // Request-cancellation helpers were removed from ApiClient when the client
  // was simplified to a thin transport wrapper. Production code no longer
  // relies on these legacy cancel-token APIs.

  describe('Error Handling', () => {
    it('should handle network error', async () => {
      vi.spyOn(axiosInstance, 'get').mockRejectedValue(new Error('Network Error'))

      await expect(client.get('/users')).rejects.toThrow()
    })

    it('should handle timeout error', async () => {
      vi.spyOn(axiosInstance, 'get').mockRejectedValue(new Error('timeout'))

      await expect(client.get('/users')).rejects.toThrow()
    })

    it('should handle 500 server error', async () => {
      const error = new Error('Internal server error')
      vi.spyOn(axiosInstance, 'get').mockRejectedValue(error)

      await expect(client.get('/users')).rejects.toThrow()
    })

    it('should handle 401 unauthorized', async () => {
      const error = new Error('Unauthorized')
      vi.spyOn(axiosInstance, 'get').mockRejectedValue(error)

      await expect(client.get('/protected')).rejects.toThrow()
    })

    it('should handle 403 forbidden', async () => {
      const error = new Error('Forbidden')
      vi.spyOn(axiosInstance, 'get').mockRejectedValue(error)

      await expect(client.get('/admin')).rejects.toThrow()
    })
  })

  describe('Request Configuration', () => {
    it('should use custom timeout', () => {
      const customClient = createApiClient({
        baseURL: '/api',
        timeout: 1000
      })

      expect(customClient.getAxiosInstance().defaults.timeout).toBe(1000)
    })

    it('should use custom base URL', () => {
      const customClient = createApiClient({
        baseURL: 'https://api.example.com'
      })

      expect(customClient.getAxiosInstance().defaults.baseURL).toBe('https://api.example.com')
    })
  })

  describe('Client Instance', () => {
    it('should get axios instance', () => {
      const instance = client.getAxiosInstance()
      expect(instance).toBeDefined()
      expect(instance.defaults.baseURL).toBe('/api')
    })

    it('should create multiple independent clients', () => {
      const client1 = createApiClient({ baseURL: '/api1' })
      const client2 = createApiClient({ baseURL: '/api2' })

      expect(client1.getAxiosInstance()).not.toBe(client2.getAxiosInstance())
      expect(client1.getAxiosInstance().defaults.baseURL).toBe('/api1')
      expect(client2.getAxiosInstance().defaults.baseURL).toBe('/api2')
    })
  })
})
