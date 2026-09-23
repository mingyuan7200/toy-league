import { leagueApi } from '../_league/api.js'
export const onRequestGet = context => leagueApi(context, 'list')
export const onRequestPost = context => leagueApi(context, 'create')
