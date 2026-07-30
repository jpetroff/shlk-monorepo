import styles from './styles-url-edit.module.less'
import * as React from 'react'
import classNames from 'classnames'
import Input from '../../components/input'
import { LinkIcon } from '../../components/icons'
import Button, { ButtonSize, ButtonType } from '../../components/button'
import { modifyURLSlug } from '../../js/utils'

type Props = { shortlink: ShortlinkDocument, isLoading: boolean,
  onChange: (result: ShortlinkDocument) => void, onCancel: () => void, userContextName: string }

export default function UrlEdit({ shortlink: initialShortlink, isLoading, onChange, onCancel, userContextName }: Props) {
  const [shortlink, setShortlink] = React.useState(() => ({ ...initialShortlink }))
  const userTag = shortlink.descriptor?.userTag || userContextName
  const globalClass = styles.wrapperClass + '_url-edit'

  function updateShortlink(chunk: Partial<ShortlinkDocument>) {
    if (!isLoading) setShortlink((current) => ({ ...current, ...chunk }))
  }

  const canSave = Boolean(shortlink.siteTitle?.trim() && shortlink.location.trim())
  return <div className={classNames(globalClass)} role="dialog" aria-modal="true" aria-label="Edit shortlink">
    <form className={`${globalClass}__url-form`} onSubmit={(event) => { event.preventDefault(); if (canSave) onChange(shortlink) }}>
      <Input className={`${globalClass}__title-input`} value={shortlink.siteTitle ?? ''}
        onValueChange={(value) => updateShortlink({ siteTitle: value })} label="Title" placeholder="Set shortlink title" />
      <Input className={`${globalClass}__location-input`} value={shortlink.location} leftIcon={LinkIcon}
        onValueChange={(value) => updateShortlink({ location: value })} label="Url" placeholder="Set url" />
      <Input className={`${globalClass}__slug-input`} value={shortlink.descriptor?.descriptionTag ?? ''} prefix={`${userTag}@`}
        onValueChange={(value) => updateShortlink({ descriptor: { userTag, descriptionTag: modifyURLSlug(value) } })}
        label="Custom shortlink" placeholder="Choose custom slug" />
      <Input className={`${globalClass}__description-input`} value={shortlink.siteDescription ?? ''}
        onValueChange={(value) => updateShortlink({ siteDescription: value })} label="Description" placeholder="Set link description" />
      <div className={`${globalClass}__url-form__controls`}>
        <Button size={ButtonSize.SMALL} type={ButtonType.SECONDARY} label="Cancel" onClick={onCancel} fullWidth />
        <Button htmlType="submit" isDisabled={!canSave} isLoading={isLoading} size={ButtonSize.SMALL}
          type={ButtonType.PRIMARY} label="Save" fullWidth />
      </div>
    </form>
  </div>
}
