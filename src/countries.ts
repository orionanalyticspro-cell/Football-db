// Préfixe des codes ESPN (ex. « sau » dans sau.1) -> nom de pays.
// Les noms suivent ceux de football-data.co.uk pour que les mêmes ligues fusionnent entre sources.
export const COUNTRY_BY_PREFIX: Record<string, string> = {
  // Europe
  eng: "England", sco: "Scotland", wal: "Wales", nir: "Northern Ireland", irl: "Ireland",
  ger: "Germany", esp: "Spain", ita: "Italy", fra: "France", ned: "Netherlands", bel: "Belgium",
  por: "Portugal", tur: "Turkey", gre: "Greece", sui: "Switzerland", aut: "Austria", den: "Denmark",
  swe: "Sweden", nor: "Norway", fin: "Finland", isl: "Iceland", pol: "Poland", cze: "Czech Republic",
  rou: "Romania", hun: "Hungary", cro: "Croatia", srb: "Serbia", ukr: "Ukraine", bul: "Bulgaria",
  svk: "Slovakia", svn: "Slovenia", bih: "Bosnia and Herzegovina", alb: "Albania", mkd: "North Macedonia",
  mne: "Montenegro", kos: "Kosovo", mda: "Moldova", blr: "Belarus", lva: "Latvia", ltu: "Lithuania",
  est: "Estonia", fro: "Faroe Islands", mlt: "Malta", lux: "Luxembourg", cyp: "Cyprus", arm: "Armenia",
  geo: "Georgia", aze: "Azerbaijan", kaz: "Kazakhstan", rus: "Russia", isr: "Israel",
  // Afrique
  nga: "Nigeria", rsa: "South Africa", gha: "Ghana", ken: "Kenya", uga: "Uganda", zim: "Zimbabwe",
  egy: "Egypt", mar: "Morocco", tun: "Tunisia", alg: "Algeria", lby: "Libya", sen: "Senegal",
  civ: "Ivory Coast", cmr: "Cameroon", cod: "DR Congo", tan: "Tanzania", zam: "Zambia", ang: "Angola",
  mli: "Mali", bfa: "Burkina Faso", gui: "Guinea", eth: "Ethiopia", rwa: "Rwanda", sdn: "Sudan",
  moz: "Mozambique", nam: "Namibia", bot: "Botswana",
  // Moyen-Orient
  sau: "Saudi Arabia", ksa: "Saudi Arabia", uae: "United Arab Emirates", are: "United Arab Emirates",
  qat: "Qatar", irq: "Iraq", irn: "Iran", jor: "Jordan", kuw: "Kuwait", bhr: "Bahrain", oma: "Oman",
  // Asie / Océanie
  jpn: "Japan", kor: "South Korea", chn: "China", ind: "India", tha: "Thailand", idn: "Indonesia",
  sgp: "Singapore", sin: "Singapore", mys: "Malaysia", mas: "Malaysia", vie: "Vietnam", uzb: "Uzbekistan",
  phi: "Philippines", hkg: "Hong Kong", aus: "Australia", nzl: "New Zealand",
  // Amériques
  bra: "Brazil", arg: "Argentina", mex: "Mexico", usa: "USA", col: "Colombia", chi: "Chile",
  per: "Peru", uru: "Uruguay", ecu: "Ecuador", par: "Paraguay", bol: "Bolivia", crc: "Costa Rica",
  ven: "Venezuela", can: "Canada", gua: "Guatemala", hon: "Honduras", slv: "El Salvador", pan: "Panama",
  nic: "Nicaragua", jam: "Jamaica", dom: "Dominican Republic", hai: "Haiti",
};
