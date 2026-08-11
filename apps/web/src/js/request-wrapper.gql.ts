import axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios'
import GracefulError from './extended-error'
import AppError, { toAppError } from './app-error'


class GQLRequest {
  private axiosInstance : AxiosInstance

  constructor(config: AxiosRequestConfig) {
    this.axiosInstance = axios.create({ ...config, withCredentials: true })

    this.axiosInstance.interceptors.response.use(
      this.successInterceptor,
      this.failInterceptor
    )
  }

  successInterceptor(response: AxiosResponse) : Promise<AxiosResponse> {
    if(response?.data?.errors) {
      const errors = GracefulError.processGQLResponse(response.data)
      throw errors[0] ?? new AppError('The request could not be completed.', { source: response.data })
    }
    return Promise.resolve(response.data.data)
  }

  failInterceptor(error: unknown) : never {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data as GraphQLResponse | undefined
      const errors = GracefulError.processGQLResponse(responseData)
      if (errors.length > 0) throw errors[0]
    }
    throw toAppError(error, 'The request could not be completed. Please try again.')
  }

  async request(query: string, variables?: AnyObject, requestConfig?: AxiosRequestConfig) : Promise<any> {
    const config: AxiosRequestConfig = {
      ...requestConfig,
      data: {
        query,
        variables
      }
    }
    const result = await this.axiosInstance.request(config)
    return result
  }
}

export default GQLRequest