import styles from './styles-page.module.less'

import * as React from 'react'

import Header from '../apps/Header'
import ShortlinkBar from '../apps/ShortlinkBar'
import Footer from '../apps/Footer'
import { useExtension, useRouter } from './page-hooks'
import AppContext from '../js/app.context'
import Scroller from '../components/scroller'

import config from '../js/config'

const Home : React.FC = () => {
  const [visibleHeader, setVisibleHeader] = React.useState(true)
  const globalClass = styles.homeClass + '_home'
  const router = useRouter()
  const extension = config.target == 'extension' ? useExtension() : undefined
  const context = React.useContext(AppContext)
  
  return (
    <div className={`${globalClass} ${ visibleHeader ? `` : `${globalClass}_no-header`}`}>
      {visibleHeader && <Header hideLogo={true} />}
      <Scroller className={`${globalClass}__body`} hideScroll={true}>
        <ShortlinkBar router={ router } extension={ extension } context={ context }
          onToggleHeaderDisplay={(notVisible) => setVisibleHeader(!notVisible)}
         />
      </Scroller>
    </div>
  )
}

export default Home