import styles from './styles-user-settings.module.less'
import * as React from 'react'
import classNames from 'classnames'
import { useAppContext } from '../../js/app.context'
import Input from '../../components/input'
import Button, { ButtonSize, ButtonType } from '../../components/button'
import users from '../../js/user.gql'
import Snackbar, { SnackbarType } from '../../components/snackbar'
import Link from '../../components/link'
import config from '../../js/config'
import { isAbortError, useAbortControllers } from '../../js/react-hooks'

type Props = { className?: string }
type Notice = { type: 'success' | 'error', message: string }

export default function UserSettings({ className }: Props) {
  const context = useAppContext()
  const initialTag = context.user?.userTag || context.user?.name || 'someone'
  const [userTag, setUserTag] = React.useState(initialTag)
  const [savedTag, setSavedTag] = React.useState(initialTag)
  const [saving, setSaving] = React.useState(false)
  const [notice, setNotice] = React.useState<Notice | null>(null)
  const { nextController } = useAbortControllers()
  const savingRef = React.useRef(false)
  const saveSequence = React.useRef(0)
  React.useEffect(() => () => { ++saveSequence.current; savingRef.current = false }, [])
  const dirty = userTag.trim() !== savedTag
  const globalClass = `${styles.wrapperClass}_user-settings`
  const classes = classNames(globalClass, className)

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (savingRef.current || !dirty || !userTag.trim()) return
    const submittedTag = userTag.trim()
    const sequence = ++saveSequence.current
    const controller = nextController('save-profile')
    savingRef.current = true
    setSaving(true)
    setNotice(null)
    try {
      const result = await users.updateLoggedInUser({ userTag: submittedTag }, controller.signal)
      await context.requestUpdate()
      if (sequence === saveSequence.current) {
        const updatedTag = result?.userTag ?? submittedTag
        setUserTag(updatedTag)
        setSavedTag(updatedTag)
        setNotice({ type: 'success', message: 'Profile updated' })
      }
    } catch (error) {
      if (!isAbortError(error) && sequence === saveSequence.current) {
        setNotice({ type: 'error', message: 'Sorry, something did not go well. Please try again.' })
      }
    } finally {
      if (sequence === saveSequence.current) {
        savingRef.current = false
        setSaving(false)
      }
    }
  }

  return <form className={classes} onSubmit={(event) => void handleSave(event)}>
    <div className={`${globalClass}__header`}>
      <div className={`${globalClass}__header__avatar`}>
        {context.user?.avatar && <img className={`${globalClass}__header__img-source`} src={context.user.avatar} alt="" />}
      </div>
      <div className={`${globalClass}__name-block`}>
        <div className={`${globalClass}__header__name`}>Hello {context.user?.name},</div>
        <div className={`${globalClass}__header__email`}>{context.user?.email}</div>
      </div>
    </div>
    <div className={`${globalClass}__field`}>
      <div className={`${globalClass}__field__composite-input`}>
        <Input className={`${globalClass}__field__input`} id="slug-input-field" value={userTag}
          onValueChange={(value) => { setUserTag(value); setNotice(null) }} prefix={`${config.displayServiceUrl}/`}
          label="Personal shortlink prefix" placeholder="me" />
      </div>
    </div>
    {config.target !== 'extension' && <div className={`${globalClass}__download`}>
      <span className={`${globalClass}__download__label`}>Install browser extension</span>
      <Link href={config.extensionLink} newTab className={`${globalClass}__download__link`}>
        <img src="/assets/chrome_store.jpg" srcSet="/assets/chrome_store@2x.jpg 2x"
          className={`${globalClass}__download__link-content`} alt="Install from the Chrome Web Store" />
      </Link>
    </div>}
    <div className={`${globalClass}__submit`}>
      <Button htmlType="submit" isDisabled={!dirty || !userTag.trim()} isLoading={saving} size={ButtonSize.LARGE}
        type={ButtonType.PRIMARY} label="Save profile settings" fullWidth />
    </div>
    <div className={`${globalClass}__snackbar-container`}>
      {notice && <Snackbar type={notice.type === 'error' ? SnackbarType.ERROR : SnackbarType.MESSAGE}
        className={`${globalClass}__profile-${notice.type}`} message={notice.message} canDismiss
        timer={notice.type === 'success' ? 2000 : undefined} onDismiss={() => setNotice(null)} />}
    </div>
  </form>
}
