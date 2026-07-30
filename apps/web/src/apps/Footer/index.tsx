import styles from './styles-footer.module.less'
import * as React from 'react'
import Flag from '../../assets/svg/flag_fi_16.svg?react'
import Heart from '../../assets/svg/w_love_14.svg?react'
import Link from '../../components/link'

const Footer : React.FC<{}> = () => {
  const globalClass = styles.wrapperClass+'_footer'
  return (
    <div className={`${globalClass}__wrapper`}>
      <div className={`${globalClass}`} >
        <div className={`${globalClass}__item`}>
          Personal project by <Link href="https://portfolio.designpr.one">designpr.one</Link>
          · PP Mori typeface <Heart className={`${globalClass}__with-love-icon`} />
        </div>
        <div className={`${globalClass}__item`}>
          <span>Valmistettu Suomessa</span>
          <Flag className={`${globalClass}__flag-icon`} />
        </div>
        
        {/* <div className={`${globalClass}__item`}>
          <span>Pangram Pangram•Foundry© × Mori typeface =</span>
          
        </div> */}
      </div>
    </div>
  )
}

export default Footer

