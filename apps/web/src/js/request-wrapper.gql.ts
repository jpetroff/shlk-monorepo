import GracefulError from './extended-error'
import AppError, { toAppError } from './app-error'

export type GQLRequestConfig = {
  baseURL: string
  method?: string
  headers?: Record<string, string>
}

export type GQLRequestOptions = {
  signal?: AbortSignal
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

class GQLRequest {
  private readonly baseURL: string
  private readonly method: string
  private readonly headers: Record<string, string>

  constructor({ baseURL, method = 'POST', headers = {} }: GQLRequestConfig) {
    this.baseURL = baseURL
    this.method = method
    this.headers = headers
  }

  async request(query: string, variables?: AnyObject, options: GQLRequestOptions = {}): Promise<any> {
    let response: Response
    try {
      response = await fetch(this.baseURL, {
        method: this.method,
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        credentials: 'include',
        body: JSON.stringify({ query, variables }),
        signal: options.signal
      })
    } catch (error) {
      if (isAbortError(error)) throw error
      throw toAppError(error, 'The request could not be completed. Please try again.')
    }

    let payload: GraphQLResponse
    try {
      payload = await response.json() as GraphQLResponse
    } catch (error) {
      throw new AppError('The request returned an invalid response. Please try again.', {
        code: response.ok ? 'INVALID_RESPONSE' : `HTTP_${response.status}`,
        source: error
      })
    }

    const errors = GracefulError.processGQLResponse(payload)
    if (errors.length > 0) throw errors[0]

    if (!response.ok) {
      throw new AppError(`The request failed with status ${response.status}. Please try again.`, {
        code: `HTTP_${response.status}`,
        source: payload
      })
    }

    return payload.data
  }
}

export default GQLRequest
