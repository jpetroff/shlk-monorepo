const databaseName = process.env.MONGO_DB
const username = process.env.MONGO_APP_USERNAME
const password = process.env.MONGO_APP_PASSWORD

if (!databaseName || !username || !password) {
  throw new Error('MONGO_DB, MONGO_APP_USERNAME, and MONGO_APP_PASSWORD are required')
}

const appDatabase = db.getSiblingDB(databaseName)
appDatabase.createUser({
  user: username,
  pwd: password,
  roles: [{ role: 'readWrite', db: databaseName }]
})
