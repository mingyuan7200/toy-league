import { COUNTRY_NAMES } from '../functions/_data/countries.js'

// ISO 3166-1 alpha-2 codes in the same reviewed order as the country registry.
const codes = `AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CR CI HR CU CY CZ KP CD DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT VA HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA KR MD RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK PS SD SR SE CH SY TJ TH TL TG TO TT TN TR TM TV UG UA AE GB TZ US UY UZ VU VE VN YE ZM ZW`.split(' ')
if (codes.length !== COUNTRY_NAMES.length) throw new Error('Country flag registry must cover every country.')
export const COUNTRY_CODES = Object.fromEntries(COUNTRY_NAMES.map((name, i) => [name, codes[i]]))
export function flagFor(name) {
  const code = COUNTRY_CODES[name]
  return code ? String.fromCodePoint(...[...code].map(letter => 127397 + letter.charCodeAt(0))) : ''
}
export function countryLabel(name) { return `${flagFor(name)} ${name}`.trim() }
