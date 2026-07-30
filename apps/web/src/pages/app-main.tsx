import styles from './styles-page.module.less'

import * as React from 'react'
import { useNavigate } from 'react-router'
import Link from '../components/link'
import * as _ from 'underscore'

import Header, { HeaderPosition } from '../apps/Header'
import { useRouter } from './page-hooks'
import Icon, { CaretLeft, IconSize } from '../components/icons'
import classNames from 'classnames'
import AppContext from '../js/app.context'
import ShortlinkList, { ShortlinkListSubsection } from '../apps/ShortlinkList'
import { checkMobileMQ } from '../js/utils'


import config from '../js/config'

const AppMain : React.FC = () => {
  const globalClass = styles.appMainClass + '_app-main'
  const shortlinkPageClasses = classNames({
    [`${globalClass}`]: true
  })
  const router = useRouter()
  const navigate = useNavigate()
  const appContext = React.useContext(AppContext)

  React.useEffect( () => {
    if(!appContext.user?.email) { 
      navigate('/login')
    }
  })

  return (
    <div className={`${shortlinkPageClasses}`}>
      <Header backButton='/' title='My Links' position={checkMobileMQ() ? HeaderPosition.fixed : undefined} />
        <div className={`${globalClass}__layout`}>
          <div className={`${globalClass}__body`}>
            <Link to='/' className={`narrow-body__back-button`}><Icon useIcon={CaretLeft} size={IconSize.LARGE} /></Link>
            <ShortlinkList navigate={navigate} router={router} context={appContext} />
          </div>
        </div>
    </div>
  )
}

export default AppMain