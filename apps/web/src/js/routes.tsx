import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, createHashRouter } from 'react-router'
import config from './config'

/* PAGES */
import Home from '../pages/home'
import Login from '../pages/login'
import AppMain from '../pages/app-main'
import Profile from '../pages/profile'
import Legal from '../pages/legal'
import RouteError, { NotFound } from '../pages/route-error'

export default function createRouter() {
  const createRouter = config.target == 'webapp' ? createBrowserRouter : createHashRouter

  const routes = [
    {
      path: '/',
      element: (<Home />),
    },
    {
      path: '/login',
      element: (<Login />)
    },
    {
      path: '/app',
      element: (<AppMain />)
    },
    {
      path: '/app/snoozed',
      element: (<AppMain />)
    },
    {
      path: '/app/profile',
      element: (<Profile />)
    },
    {
      path: '/privacy-policy',
      element: (<Legal />)
    },
    {
      path: '*',
      element: <NotFound />
    }
  ]

  if (import.meta.env.DEV && config.target === 'webapp') {
    const GraphiQLPage = lazy(() => import('../pages/graphiql'))
    routes.push({
      path: '/__graphiql',
      element: <Suspense fallback={null}><GraphiQLPage /></Suspense>
    })
  }

  return createRouter(routes.map((route) => ({ ...route, errorElement: <RouteError /> })))
}