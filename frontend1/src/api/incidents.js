import client from './client.js'

export const incidentsAPI = {
  list: (params = {}) =>
    client.get('/api/v1/incidents', { params }),

  get: (id) =>
    client.get(`/api/v1/incidents/${id}`),

  create: (data) =>
    client.post('/api/v1/incidents', data),

  update: (id, data) =>
    client.patch(`/api/v1/incidents/${id}`, data),

  resolve: (id) =>
    client.patch(`/api/v1/incidents/${id}`, { status: 'RESOLVED' }),
}