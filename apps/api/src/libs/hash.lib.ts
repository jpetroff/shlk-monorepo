import { randomInt } from 'node:crypto'

export const HASH_ALPHABET =
  'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789uwetag'

export default function generateHash(): string {
  return Array.from(
    { length: 4 },
    () => HASH_ALPHABET[randomInt(HASH_ALPHABET.length)]
  ).join('')
}
