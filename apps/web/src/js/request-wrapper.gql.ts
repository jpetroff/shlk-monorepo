import * as _ from 'underscore'
import axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios'
import GracefulError from './extended-error'


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
      throw new Object({
        message: errors[0].message,
        code: errors[0].code,
        source: errors
      })
    }
    return Promise.resolve(response.data.data)
  }

  failInterceptor(response: AxiosResponse) : void {
    throw GracefulError.processGQLResponse(response.data)
  }

  async request(query: string, variables?: AnyObject, _config?: AnyObject) : Promise<any> {
    const config = _.defaults({
        data: {
          query,
          variables
        }
      }, _config)
    const result = await this.axiosInstance.request(config)
    return result
  }
}

export default GQLRequest