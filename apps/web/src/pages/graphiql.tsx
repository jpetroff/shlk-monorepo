import { GraphiQL } from 'graphiql'
import 'graphiql/graphiql.css'

async function fetcher(params: Record<string, unknown>) {
  const response = await fetch('/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params)
  })
  return response.json()
}

export default function GraphiQLPage() {
  return <div style={{ height: '100vh' }}><GraphiQL fetcher={fetcher} /></div>
}
