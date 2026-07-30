import { describe, expect, test } from 'bun:test'
import type { Request, Response } from 'express'
import { Kind, parse } from 'graphql'
import { executeGraphQLRequest } from '../src/graphql/http'
import { LongType, MixedType } from '../src/graphql/extends'
import { matchesBanlist } from '../src/libs/ban.queries'
import generateHash, { HASH_ALPHABET } from '../src/libs/hash.lib'
import { modifyURLSlug, normalizeURL } from '../src/libs/utils'

const req = { session: { userId: 'test-user' } } as unknown as Request
const res = {} as Response

describe('GraphQL 17 transport', () => {
  test('builds the schema and permits development introspection', async () => {
    const result = await executeGraphQLRequest(
      { query: '{ __schema { queryType { name } } }' },
      { req, res }
    )
    expect(result.status).toBe(200)
    expect(result.body).toHaveProperty('data.__schema.queryType.name', 'Query')
  })

  test('disables production introspection', async () => {
    const result = await executeGraphQLRequest(
      { query: '{ __schema { queryType { name } } }' },
      { req, res },
      { production: true }
    )
    expect(result.status).toBe(400)
    expect(result.body).toHaveProperty('errors')
  })

  test('passes session context to an authenticated resolver', async () => {
    const result = await executeGraphQLRequest(
      { query: '{ getPredefinedTimers }' },
      { req, res }
    )
    expect(result.status).toBe(200)
    expect(result.body).toHaveProperty('data.getPredefinedTimers')
  })

  test('uses 400 for syntax and validation failures', async () => {
    const syntax = await executeGraphQLRequest({ query: '{' }, { req, res })
    const validation = await executeGraphQLRequest(
      { query: '{ fieldThatDoesNotExist }' },
      { req, res }
    )
    expect(syntax.status).toBe(400)
    expect(validation.status).toBe(400)
  })

  test('rejects subscriptions', async () => {
    const result = await executeGraphQLRequest(
      { query: 'subscription { getLoggedInUser { name } }' },
      { req, res }
    )
    expect(result.status).toBe(400)
    expect(result.body).toHaveProperty('errors.0.extensions.code', 'UNSUPPORTED_OPERATION')
  })

  test('rejects mutations over GET', async () => {
    const result = await executeGraphQLRequest(
      { query: 'mutation { createShortlink(location: "https://example.com") { hash } }' },
      { req, res },
      { method: 'GET' }
    )
    expect(result.status).toBe(400)
    expect(result.body).toHaveProperty('errors.0.extensions.code', 'METHOD_NOT_ALLOWED')
  })

  test('requires authentication for public shortlink mutations', async () => {
    const anonymousReq = { session: {} } as unknown as Request
    const result = await executeGraphQLRequest(
      { query: 'mutation { createShortlink(location: "https://example.com") { hash } }' },
      { req: anonymousReq, res }
    )
    expect(result.status).toBe(200)
    expect(result.body).toHaveProperty('errors.0.extensions.code', 'FORBIDDEN')
  })
})

describe('custom scalars', () => {
  test('Mixed accepts variable and literal objects, lists, and null', () => {
    const variable = Object.create(null) as Record<string, unknown>
    variable.nested = [1, null, true]
    expect(MixedType.parseValue(variable)).toEqual(variable)

    const objectNode = parse('query($value: Mixed) { getPredefinedTimers }')
    expect(objectNode.kind).toBe(Kind.DOCUMENT)
    expect(MixedType.parseLiteral({
      kind: Kind.OBJECT,
      fields: [{
        kind: Kind.OBJECT_FIELD,
        name: { kind: Kind.NAME, value: 'items' },
        value: {
          kind: Kind.LIST,
          values: [
            { kind: Kind.INT, value: '1' },
            { kind: Kind.NULL }
          ]
        }
      }]
    }, undefined)).toEqual({ items: [1, null] })
    expect(MixedType.parseLiteral({ kind: Kind.NULL }, undefined)).toBeNull()
  })

  test('Long accepts zero and safe integers', () => {
    expect(LongType.parseValue(0)).toBe(0)
    expect(LongType.parseLiteral({ kind: Kind.INT, value: '42' }, undefined)).toBe(42)
    expect(() => LongType.parseValue(Number.MAX_SAFE_INTEGER + 1)).toThrow()
  })
})

describe('shortlink utilities', () => {
  test('generates four-character cryptographic hashes from the legacy alphabet', () => {
    for (let index = 0; index < 100; index += 1) {
      const hash = generateHash()
      expect(hash).toHaveLength(4)
      expect([...hash].every((character) => HASH_ALPHABET.includes(character))).toBe(true)
    }
  })

  test('normalizes URLs and slugs consistently', () => {
    expect(normalizeURL('example.com')).toBe('https://example.com')
    expect(modifyURLSlug('Hello, world!')).toBe('Hello-world')
  })
})

describe('banlist matching', () => {
  test('matches users and IP addresses exactly after trimming', () => {
    expect(matchesBanlist(' user@example.com ', 'user', ['user@example.com'])).toBe(true)
    expect(matchesBanlist('192.0.2.1', 'IP', ['192.0.2.10'])).toBe(false)
  })

  test('supports regular-expression location entries and exact locations', () => {
    expect(matchesBanlist(
      'https://example.com/private/42',
      'location',
      ['/example\\.com\\/private\\/[0-9]+/']
    )).toBe(true)
    expect(matchesBanlist(
      'https://example.com',
      'location',
      ['https://example.com']
    )).toBe(true)
  })
})
