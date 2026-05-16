import { apiClient } from '@/shared/api/client'

export interface AnnouncementItem {
  id: number
  title: string
  content: string
  status: 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN'
  scheduledAt?: string | null
  publishedAt?: string | null
  createdBy?: number | null
  createdAt?: string | null
  updatedAt?: string | null
}

interface AnnouncementPageResponse {
  content: AnnouncementItem[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

interface ApiEnvelope<T> {
  success?: boolean
  data?: T
  message?: string
}

function unwrapPageResponse(
  response: ApiEnvelope<AnnouncementPageResponse> | AnnouncementPageResponse
): AnnouncementPageResponse {
  if (response && typeof response === 'object' && 'data' in response && response.data) {
    return response.data
  }
  return response as AnnouncementPageResponse
}

export const announcementApi = {
  async list(
    status?: string,
    page: number = 0,
    size: number = 20
  ): Promise<AnnouncementPageResponse> {
    const params: Record<string, unknown> = { page, size }
    if (status) {
      params.status = status
    }
    const response = await apiClient.get<ApiEnvelope<AnnouncementPageResponse>>(
      '/announcements',
      params
    )
    return unwrapPageResponse(response)
  },

  async listPublic(page: number = 0, size: number = 5): Promise<AnnouncementPageResponse> {
    const response = await apiClient.get<ApiEnvelope<AnnouncementPageResponse>>(
      '/announcements/public',
      {
        page,
        size
      }
    )
    return unwrapPageResponse(response)
  },

  async create(payload: {
    title: string
    content: string
    scheduledAt?: string | null
  }): Promise<AnnouncementItem> {
    const response = await apiClient.post<ApiEnvelope<AnnouncementItem>>('/announcements', payload)
    return response.data as AnnouncementItem
  },

  async update(
    id: number,
    payload: {
      title: string
      content: string
      scheduledAt?: string | null
    }
  ): Promise<AnnouncementItem> {
    const response = await apiClient.put<ApiEnvelope<AnnouncementItem>>(
      `/announcements/${id}`,
      payload
    )
    return response.data as AnnouncementItem
  },

  async publish(id: number): Promise<AnnouncementItem> {
    const response = await apiClient.post<ApiEnvelope<AnnouncementItem>>(
      `/announcements/${id}/publish`
    )
    return response.data as AnnouncementItem
  },

  async withdraw(id: number): Promise<AnnouncementItem> {
    const response = await apiClient.post<ApiEnvelope<AnnouncementItem>>(
      `/announcements/${id}/withdraw`
    )
    return response.data as AnnouncementItem
  }
}
