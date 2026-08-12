import React, { lazy } from 'react'
import { createBrowserRouter, createHashRouter } from 'react-router'
import config from './config'

/* PAGES */
import Home from '../pages/home'
import RouteError, { NotFound } from '../pages/route-error'
const Login = lazy(() => import('../pages/login'))
const AppMain = lazy(() => import('../pages/app-main'))
const Profile = lazy(() => import('../pages/profile'))
const Legal = lazy(() => import('../pages/legal'))

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
      element: <GraphiQLPage />
    })
  }

  return createRouter(routes.map((route) => ({ ...route, errorElement: <RouteError /> })))
}