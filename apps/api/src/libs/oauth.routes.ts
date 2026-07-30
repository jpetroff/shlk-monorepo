import express from 'express'
import { oauthRedirect, oauthCallback, sessionLogout } from './oauth.controllers'

const oauthRouter = express.Router() 

oauthRouter.get('/oauth/google', oauthRedirect)
oauthRouter.get(`/oauth/google/callback`, oauthCallback)

oauthRouter.get(`/logout`, sessionLogout)

export { oauthRouter }