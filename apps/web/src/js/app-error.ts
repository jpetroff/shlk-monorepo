export type AppErrorOptions = {
  code?: string
  source?: unknown
}

type ErrorLike = {
  message?: unknown
  code?: unknown
  source?: unknown
}

export default class AppError extends Error {
  readonly code?: string
  readonly source?: unknown

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message)
    this.name = 'AppError'
    this.code = options.code
    this.source = options.source
  }
}

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === 'object' && value !== null
}

/** Convert anything a request or application function can throw into the UI error contract. */
export function toAppError(error: unknown, fallbackMessage = 'Something went wrong. Please try again.'): AppError {
  if (error instanceof AppError) return error

  if (Array.isArray(error) && error.length > 0) {
    const firstError = toAppError(error[0], fallbackMessage)
    return new AppError(firstError.message, {
      code: firstError.code,
      source: error
    })
  }

  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: unknown }
    return new AppError(error.message || fallbackMessage, {
      code: errorWithCode.code === undefined ? undefined : String(errorWithCode.code),
      source: error
    })
  }

  if (isErrorLike(error)) {
    return new AppError(typeof error.message === 'string' && error.message ? error.message : fallbackMessage, {
      code: error.code === undefined ? undefined : String(error.code),
      source: error.source ?? error
    })
  }

  return new AppError(typeof error === 'string' && error ? error : fallbackMessage, { source: error })
}
