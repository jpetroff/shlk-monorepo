import type { AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import AppError, { toAppError } from '../src/js/app-error'
import GQLRequest from '../src/js/request-wrapper.gql'

describe('AppError', () => {
  it('normalizes legacy object and array errors without losing their message or code', () => {
    const objectError = toAppError({ message: 'GraphQL failed', code: 'BAD_INPUT' })
    const arrayError = toAppError([{ message: 'Legacy GraphQL failed', code: 409 }])

    expect(objectError).toBeInstanceOf(AppError)
    expect(objectError).toMatchObject({ message: 'GraphQL failed', code: 'BAD_INPUT' })
    expect(arrayError).toBeInstanceOf(AppError)
    expect(arrayError).toMatchObject({ message: 'Legacy GraphQL failed', code: '409' })
  })

  it('uses a safe fallback for arbitrary thrown values', () => {
    expect(toAppError(null, 'Please try later')).toMatchObject({ message: 'Please try later' })
  })
})

describe('GQLRequest errors', () => {
  const request = new GQLRequest({ baseURL: '/api', method: 'POST' })

  it('throws an AppError for errors returned in a successful GraphQL response', () => {
    const response = {
      data: {
        errors: [{
          message: 'Descriptor already exists',
          extensions: { code: 'CONFLICT' }
        }]
      }
    } as AxiosResponse

    expect(() => request.successInterceptor(response)).toThrow(AppError)
    expect(() => request.successInterceptor(response)).toThrow('Descriptor already exists')
  })

  it('normalizes non-GraphQL request failures too', () => {
    expect(() => request.failInterceptor(new Error('Network unavailable'))).toThrow(AppError)
    expect(() => request.failInterceptor(new Error('Network unavailable'))).toThrow('Network unavailable')
  })
})
