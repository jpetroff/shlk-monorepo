import { GraphQLScalarType, Kind, type ValueNode, GraphQLError } from 'graphql'

export const MixedType = new GraphQLScalarType({
  name: 'Mixed',
  description: 'Represents a JSON-compatible mixed value',
  parseValue: toObject,
  serialize: toObject,
  parseLiteral: parseAst
})

export const MixedTypeDef = `scalar Mixed`

export const MixedResolver = {
  Mixed: MixedType
}

function toObject(value: unknown): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || Array.isArray(value) || typeof value === 'object') {
    return value
  }
  if(typeof value === 'string' && value.charAt(0) === '{') {
      return JSON.parse(value);
  }
  return null;
}

function parseObject(ast: ValueNode): Maybe<AnyObject> {
  if(ast.kind !== Kind.OBJECT) return undefined

  const value = Object.create(null);
  ast.fields.forEach((field:any) => {
      value[field.name.value] = parseAst(field.value);
  });
  return value;
}

function parseAst(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.BOOLEAN:
    case Kind.STRING:
    case Kind.ENUM:
      return ast.value
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value)
    case Kind.LIST:
      return ast.values.map(parseAst)
    case Kind.OBJECT:
      return parseObject(ast)
    case Kind.NULL:
        return null
    default:
      throw new Error(`Unexpected kind in parseLiteral: ${ast.kind}`)
  }
}

export function resolveError(error: any) : any {
  if(error instanceof GraphQLError) { return error } 
  else {
    return new GraphQLError(
      error.message || String(error), 
      { extensions: error.meta || { code: 'UNKNOWN_ERROR' } }
    )
  }
}

/* 
  Big Integer for Date.valueOf()
*/

export const LongType = new GraphQLScalarType({
  name: 'Long',
  description: 'The `Long` scalar type represents 52-bit integers',
  serialize: coerceLong,
  parseValue: coerceLong,
  parseLiteral: parseLiteral,
})

export const LongTypeDef = `scalar Long`

export const LongResolver = {
  Long: LongType
}

const MAX_LONG = Number.MAX_SAFE_INTEGER
const MIN_LONG = Number.MIN_SAFE_INTEGER

function coerceLong(value: unknown) : Maybe<number> {
  if(value === null || value === undefined || value === '')
      throw new TypeError('Long cannot represent non 52-bit signed integer value')
  const num = Number(value)
  if(num == num && num <= MAX_LONG && num >= MIN_LONG)
      return num < 0 ? Math.ceil(num) : Math.floor(num)
  throw new TypeError(`Long cannot represent non 52-bit signed integer value: ${value}`)
}

function parseLiteral(ast: ValueNode) : unknown {
  if(ast.kind == Kind.INT) {
    const num = parseInt(ast.value, 10)
    if(num <= MAX_LONG && num >= MIN_LONG)
        return num
    return null
  }
  return null
}