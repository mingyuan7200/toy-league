import { leagueApi } from '../_league/api.js'
export const onRequestPost = context => leagueApi(context, 'result')
