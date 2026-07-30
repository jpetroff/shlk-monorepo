import MongoStore from 'connect-mongo'
import mongoose from 'mongoose'
import config from '../config'
import { cliColors } from './utils'

const sixMonthsInSeconds = 60 * 60 * 24 * 30 * 6

export async function connectDatabase(): Promise<void> {
  console.log('[…] Connecting to MongoDB')
  await mongoose.connect(config.MONGO_URI)
  console.log(`${cliColors.green}[✓]${cliColors.end} Connected to MongoDB`)
}

export function createSessionStore(): MongoStore {
  return MongoStore.create({
    mongoUrl: config.MONGO_URI,
    collectionName: 'sessions',
    ttl: sixMonthsInSeconds
  })
}

