import * as React from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import browserApi from '../js/browser.api'
import * as _ from 'underscore'

import config from '../js/config'

export function useRouter() : PageRouterProps {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()

  return { location, navigate, params }
}

export function useExtension() : PageExtensionProps | undefined {
  if(!browserApi.isInit || config.target != 'extension') return undefined

  const [activeTabUrl, setActiveTabUrl] = React.useState<string | undefined>(undefined)

  React.useEffect( () => { 
    function deferredStateUpdate(result: Awaited<ReturnType<typeof browserApi.getTab>>) {
      if(!result || !result.url || result.url == activeTabUrl) return
      setActiveTabUrl(result.url)
    }

    browserApi.getTab(true).then( deferredStateUpdate )
  })

  return { activeTabUrl } 
}