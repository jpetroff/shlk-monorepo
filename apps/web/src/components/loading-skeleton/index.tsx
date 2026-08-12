import * as React from 'react'

export default function LoadingSkeleton() {
  return <div className="__loading-skeleton-wrapper" aria-hidden="true">
    <div className="__faded-logo">
      <svg className="__faded-logo__svg" viewBox="0 0 46 46" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <circle cx="23" cy="23" r="23" />
      </svg>
    </div>
    <div className="__faded-input">&nbsp;</div>
  </div>
}
