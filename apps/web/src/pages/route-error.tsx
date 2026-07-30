import * as React from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import Link from '../components/link'

export default function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error ? error.message : 'Something went wrong'
  return <main role="alert">
    <h1>We could not open this page</h1>
    <p>{message}</p>
    <Link to="/">Return home</Link>
  </main>
}

export function NotFound() {
  return <main role="alert">
    <h1>Page not found</h1>
    <p>The page you requested does not exist.</p>
    <Link to="/">Return home</Link>
  </main>
}
