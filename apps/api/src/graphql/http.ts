import type { Request, Response } from 'express'
import {
  execute,
  getOperationAST,
  GraphQLError,
  NoSchemaIntrospectionCustomRule,
  parse,
  specifiedRules,
  validate,
  type ExecutionResult,
  type GraphQLFormattedError
} from 'graphql'
import schema from './index'

type GraphQLRequest = {
  query: string
  variables?: Record<string, unknown> | null
  operationName?: string | null
}

export type GraphQLHttpResult = {
  status: number
  body: ExecutionResult | { errors: readonly GraphQLFormattedError[] }
}

function formatted(error: GraphQLError): GraphQLFormattedError {
  return error.toJSON()
}

function requestError(message: string, code: string): GraphQLHttpResult {
  const error = new GraphQLError(message, { extensions: { code } })
  return { status: 400, body: { errors: [formatted(error)] } }
}

export async function executeGraphQLRequest(
  input: GraphQLRequest,
  contextValue: { req: Request; res: Response },
  options: { production?: boolean; method?: string } = {}
): Promise<GraphQLHttpResult> {
  if (!input || typeof input.query !== 'string' || input.query.trim() === '') {
    return requestError('A non-empty GraphQL query is required', 'BAD_REQUEST')
  }
  if (input.operationName != null && typeof input.operationName !== 'string') {
    return requestError('operationName must be a string', 'BAD_REQUEST')
  }
  if (
    input.variables != null &&
    (typeof input.variables !== 'object' || Array.isArray(input.variables))
  ) {
    return requestError('variables must be an object', 'BAD_REQUEST')
  }

  let document
  try {
    document = parse(input.query)
  } catch (error) {
    const graphQLError = error instanceof GraphQLError
      ? error
      : new GraphQLError('Unable to parse GraphQL request')
    return { status: 400, body: { errors: [formatted(graphQLError)] } }
  }

  const operation = getOperationAST(document, input.operationName ?? undefined)
  if (!operation) {
    return requestError('Unable to select a GraphQL operation', 'BAD_REQUEST')
  }
  if (operation.operation === 'subscription') {
    return requestError('Subscriptions are not supported', 'UNSUPPORTED_OPERATION')
  }
  if (options.method === 'GET' && operation.operation !== 'query') {
    return requestError(
      'Only query operations are allowed over GET',
      'METHOD_NOT_ALLOWED'
    )
  }

  const rules = options.production
    ? [...specifiedRules, NoSchemaIntrospectionCustomRule]
    : specifiedRules
  const validationErrors = validate(schema, document, rules)
  if (validationErrors.length > 0) {
    return {
      status: 400,
      body: { errors: validationErrors.map(formatted) }
    }
  }

  const result = await execute({
    schema,
    document,
    operationName: input.operationName ?? undefined,
    variableValues: input.variables ?? undefined,
    contextValue
  })
  return { status: 200, body: result }
}

function parseGetRequest(req: Request): GraphQLRequest | GraphQLHttpResult {
  let variables: Record<string, unknown> | undefined
  const rawVariables = req.query.variables
  if (typeof rawVariables === 'string' && rawVariables.length > 0) {
    try {
      const parsed: unknown = JSON.parse(rawVariables)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return requestError('variables must be a JSON object', 'BAD_REQUEST')
      }
      variables = parsed as Record<string, unknown>
    } catch {
      return requestError('variables must be valid JSON', 'BAD_REQUEST')
    }
  }
  return {
    query: typeof req.query.query === 'string' ? req.query.query : '',
    operationName: typeof req.query.operationName === 'string'
      ? req.query.operationName
      : undefined,
    variables
  }
}

export async function graphqlHttpHandler(req: Request, res: Response): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.set('Allow', 'GET, POST')
    res.status(405).type('application/graphql-response+json').json({
      errors: [formatted(new GraphQLError('Method not allowed', {
        extensions: { code: 'METHOD_NOT_ALLOWED' }
      }))]
    })
    return
  }

  if (
    req.method === 'GET' &&
    typeof req.query.query !== 'string' &&
    process.env.NODE_ENV !== 'production'
  ) {
    const appUrl = process.env.WEB_APP_URL || 'http://localhost:5173'
    res.redirect(`${appUrl.replace(/\/$/, '')}/__graphiql`)
    return
  }

  const input = req.method === 'GET' ? parseGetRequest(req) : req.body as GraphQLRequest
  if ('status' in input && 'body' in input) {
    res.status(input.status).type('application/graphql-response+json').json(input.body)
    return
  }

  const result = await executeGraphQLRequest(
    input,
    { req, res },
    { production: process.env.NODE_ENV === 'production', method: req.method }
  )
  res.status(result.status).type('application/graphql-response+json').json(result.body)
}
