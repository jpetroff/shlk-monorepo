import express from 'express'
import config from '../config'
import { createOrUpdateUser } from './user.queries'
import {google} from 'googleapis'
// import session from 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId: string;
    tokens: import('google-auth-library').Credentials
  }
}


function getAuthClient () {
  return new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
  )
}

export function oauthRedirect (req: express.Request, res: express.Response) {
  const oAuth2Client = getAuthClient()
  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ')
  });

  res.redirect(authorizeUrl)
}

export async function oauthCallback (req: express.Request, res: express.Response) {
  const qs = new URL(req.url, 'https://shlk.cc/').searchParams
  const code = qs.get('code')
  const oAuth2Client = getAuthClient()
  
  if(!code) {
    res.status(400).json({ message: 'Authorization failed' })
    return

  } else {
    try {
      const r = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(r.tokens)
      const gapi = google.oauth2({
        auth: oAuth2Client,
        version: 'v2'
      })
      const { data } = await gapi.userinfo.v2.me.get()
      if(!data.email || !data.verified_email) throw new Error('Your email is not verified. Please verify before signing in')

      const user = await createOrUpdateUser({
        email: data.email,
        name: data.given_name || data.family_name,
        avatar: data.picture,
        id_token: r.tokens.id_token,
        access_token: r.tokens.access_token,
        refresh_token: r.tokens.refresh_token,
        ip: req.ip
      })

      req.session.userId = user?._id
      req.session.tokens = r.tokens

      res.redirect(config.WEB_APP_URL)
    } catch(err: unknown) {
      if (
        err instanceof Error &&
        'meta' in err &&
        (err as { meta?: { code?: string } }).meta?.code === 'BANNED'
      ) {
        res.status(500).json(err.message)
      } else {
        res.status(400).json({
          message: err instanceof Error ? err.message : 'Authorization failed'
        })
      }
    }
  }
}

export function sessionLogout(req: express.Request, res: express.Response) {
  req.session.destroy(
    (err) => {
      if(err) {
        res.status(400).json({ message: 'Logout failed' }); return
      }
      res.redirect(config.WEB_APP_URL)
    }
  )
}