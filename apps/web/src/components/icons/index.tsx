import styles from './styles-icons.module.less'
import * as React from 'react'

import LogoSvg from '../../assets/svg/logo.svg?react'
import LogoCSvg from '../../assets/svg/logo-compact.svg?react'
import AvatarSvg from '../../assets/svg/icon/avatar.svg?react'
import CaretRightSvg from '../../assets/svg/icon/caret-right.svg?react'
import CaretLeftSvg from '../../assets/svg/icon/caret-left.svg?react'
import CrossSvg from '../../assets/svg/icon/cross.svg?react'
import CrossSvg_16 from '../../assets/svg/icon/cross_16.svg?react'
import EnterSvg from '../../assets/svg/icon/enter.svg?react'
import GoogleSvg from '../../assets/svg/icon/google.svg?react'
import SearchSvg from '../../assets/svg/icon/search.svg?react'
import SnoozeSvg from '../../assets/svg/icon/snooze.svg?react'
import LogoutSvg from '../../assets/svg/icon/logout.svg?react'
import CaretDownSvg from '../../assets/svg/icon/caret-down.svg?react'
import LinkSvg from '../../assets/svg/icon/link.svg?react'
import MoreVSvg from '../../assets/svg/icon/more.svg?react'
import CompactSvg from '../../assets/svg/icon/compact.svg?react'
import FullSvg from '../../assets/svg/icon/full.svg?react'


export const Logo = LogoSvg
export const LogoC = LogoCSvg
export const Avatar = AvatarSvg
export const CaretRight = CaretRightSvg
export const CaretLeft = CaretLeftSvg
export const CaretDown = CaretDownSvg 
export const Cross = CrossSvg
export const Enter = EnterSvg
export const Google = GoogleSvg
export const Snooze = SnoozeSvg
export const Search = SearchSvg 
export const Logout = LogoutSvg 
export const LinkIcon = LinkSvg 
export const MoreVertical = MoreVSvg 
export const FullIcon = FullSvg 
export const CompactIcon = CompactSvg 

export const Cross_16 = CrossSvg_16

export enum IconSize {
	SMALL = 'small',
	LARGE = 'large'
}

export type ReactIcon = React.FunctionComponent<React.SVGAttributes<SVGElement>>

type Props = {
	useIcon: ReactIcon
	size: IconSize
} & React.JSX.IntrinsicElements["div"]

const Icon : React.FC<Props> = function( {
	useIcon,
	size,
  className
} ) {
	const globalClass = 'icon-svg'
	const IconNode = useIcon
  const propClass = className || ''
	return (
		<div className={`${styles.wrapperClass} ${globalClass} ${globalClass}_size-${size} ${propClass}`}>
			<IconNode className={`${globalClass}__node`} />
		</div>
	)
}

export default Icon