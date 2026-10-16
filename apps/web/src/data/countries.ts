export interface CountryEntry {
  code: string;
  flag: string;
  names: {
    en: string;
    ru: string;
    es: string;
  };
}

function codeToFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function entry(code: string, en: string, ru?: string, es?: string): CountryEntry {
  return {
    code,
    flag: codeToFlag(code),
    names: { en, ru: ru ?? en, es: es ?? en },
  };
}

// Top ~50 populous + Spanish-speaking + Russian-adjacent countries have full translations.
// Remaining ~200 fall back to English name in ru/es columns (documented limitation).
export const COUNTRIES: CountryEntry[] = [
  // A
  entry("AF", "Afghanistan", "Афганистан", "Afganistán"),
  entry("AL", "Albania", "Албания", "Albania"),
  entry("DZ", "Algeria", "Алжир", "Argelia"),
  entry("AD", "Andorra", "Андорра", "Andorra"),
  entry("AO", "Angola", "Ангола", "Angola"),
  entry("AG", "Antigua and Barbuda", "Антигуа и Барбуда", "Antigua y Barbuda"),
  entry("AR", "Argentina", "Аргентина", "Argentina"),
  entry("AM", "Armenia", "Армения", "Armenia"),
  entry("AU", "Australia", "Австралия", "Australia"),
  entry("AT", "Austria", "Австрия", "Austria"),
  entry("AZ", "Azerbaijan", "Азербайджан", "Azerbaiyán"),
  // B
  entry("BS", "Bahamas", "Багамские Острова", "Bahamas"),
  entry("BH", "Bahrain", "Бахрейн", "Baréin"),
  entry("BD", "Bangladesh", "Бангладеш", "Bangladés"),
  entry("BB", "Barbados", "Барбадос", "Barbados"),
  entry("BY", "Belarus", "Беларусь", "Bielorrusia"),
  entry("BE", "Belgium", "Бельгия", "Bélgica"),
  entry("BZ", "Belize", "Белиз", "Belice"),
  entry("BJ", "Benin", "Бенин", "Benín"),
  entry("BT", "Bhutan", "Бутан", "Bután"),
  entry("BO", "Bolivia", "Боливия", "Bolivia"),
  entry("BA", "Bosnia and Herzegovina", "Босния и Герцеговина", "Bosnia y Herzegovina"),
  entry("BW", "Botswana", "Ботсвана", "Botsuana"),
  entry("BR", "Brazil", "Бразилия", "Brasil"),
  entry("BN", "Brunei", "Бруней", "Brunéi"),
  entry("BG", "Bulgaria", "Болгария", "Bulgaria"),
  entry("BF", "Burkina Faso", "Буркина-Фасо", "Burkina Faso"),
  entry("BI", "Burundi", "Бурунди", "Burundi"),
  // C
  entry("CV", "Cabo Verde", "Кабо-Верде", "Cabo Verde"),
  entry("KH", "Cambodia", "Камбоджа", "Camboya"),
  entry("CM", "Cameroon", "Камерун", "Camerún"),
  entry("CA", "Canada", "Канада", "Canadá"),
  entry("CF", "Central African Republic", "Центральноафриканская Республика", "República Centroafricana"),
  entry("TD", "Chad", "Чад", "Chad"),
  entry("CL", "Chile", "Чили", "Chile"),
  entry("CN", "China", "Китай", "China"),
  entry("CO", "Colombia", "Колумбия", "Colombia"),
  entry("KM", "Comoros", "Коморские Острова", "Comoras"),
  entry("CG", "Congo", "Республика Конго", "República del Congo"),
  entry("CD", "DR Congo", "ДР Конго", "República Democrática del Congo"),
  entry("CR", "Costa Rica", "Коста-Рика", "Costa Rica"),
  entry("HR", "Croatia", "Хорватия", "Croacia"),
  entry("CU", "Cuba", "Куба", "Cuba"),
  entry("CY", "Cyprus", "Кипр", "Chipre"),
  entry("CZ", "Czechia", "Чехия", "Chequia"),
  // D
  entry("DK", "Denmark", "Дания", "Dinamarca"),
  entry("DJ", "Djibouti", "Джибути", "Yibuti"),
  entry("DM", "Dominica", "Доминика", "Dominica"),
  entry("DO", "Dominican Republic", "Доминиканская Республика", "República Dominicana"),
  // E
  entry("EC", "Ecuador", "Эквадор", "Ecuador"),
  entry("EG", "Egypt", "Египет", "Egipto"),
  entry("SV", "El Salvador", "Сальвадор", "El Salvador"),
  entry("GQ", "Equatorial Guinea", "Экваториальная Гвинея", "Guinea Ecuatorial"),
  entry("ER", "Eritrea", "Эритрея", "Eritrea"),
  entry("EE", "Estonia", "Эстония", "Estonia"),
  entry("SZ", "Eswatini", "Эсватини", "Esuatini"),
  entry("ET", "Ethiopia", "Эфиопия", "Etiopía"),
  // F
  entry("FJ", "Fiji", "Фиджи", "Fiyi"),
  entry("FI", "Finland", "Финляндия", "Finlandia"),
  entry("FR", "France", "Франция", "Francia"),
  // G
  entry("GA", "Gabon", "Габон", "Gabón"),
  entry("GM", "Gambia", "Гамбия", "Gambia"),
  entry("GE", "Georgia", "Грузия", "Georgia"),
  entry("DE", "Germany", "Германия", "Alemania"),
  entry("GH", "Ghana", "Гана", "Ghana"),
  entry("GR", "Greece", "Греция", "Grecia"),
  entry("GD", "Grenada", "Гренада", "Granada"),
  entry("GT", "Guatemala", "Гватемала", "Guatemala"),
  entry("GN", "Guinea", "Гвинея", "Guinea"),
  entry("GW", "Guinea-Bissau", "Гвинея-Бисау", "Guinea-Bisáu"),
  entry("GY", "Guyana", "Гайана", "Guyana"),
  // H
  entry("HT", "Haiti", "Гаити", "Haití"),
  entry("HN", "Honduras", "Гондурас", "Honduras"),
  entry("HU", "Hungary", "Венгрия", "Hungría"),
  // I
  entry("IS", "Iceland", "Исландия", "Islandia"),
  entry("IN", "India", "Индия", "India"),
  entry("ID", "Indonesia", "Индонезия", "Indonesia"),
  entry("IR", "Iran", "Иран", "Irán"),
  entry("IQ", "Iraq", "Ирак", "Irak"),
  entry("IE", "Ireland", "Ирландия", "Irlanda"),
  entry("IL", "Israel", "Израиль", "Israel"),
  entry("IT", "Italy", "Италия", "Italia"),
  // J
  entry("JM", "Jamaica", "Ямайка", "Jamaica"),
  entry("JP", "Japan", "Япония", "Japón"),
  entry("JO", "Jordan", "Иордания", "Jordania"),
  // K
  entry("KZ", "Kazakhstan", "Казахстан", "Kazajistán"),
  entry("KE", "Kenya", "Кения", "Kenia"),
  entry("KI", "Kiribati", "Кирибати", "Kiribati"),
  entry("KP", "North Korea", "Северная Корея", "Corea del Norte"),
  entry("KR", "South Korea", "Южная Корея", "Corea del Sur"),
  entry("KW", "Kuwait", "Кувейт", "Kuwait"),
  entry("KG", "Kyrgyzstan", "Кыргызстан", "Kirguistán"),
  // L
  entry("LA", "Laos", "Лаос", "Laos"),
  entry("LV", "Latvia", "Латвия", "Letonia"),
  entry("LB", "Lebanon", "Ливан", "Líbano"),
  entry("LS", "Lesotho", "Лесото", "Lesoto"),
  entry("LR", "Liberia", "Либерия", "Liberia"),
  entry("LY", "Libya", "Ливия", "Libia"),
  entry("LI", "Liechtenstein", "Лихтенштейн", "Liechtenstein"),
  entry("LT", "Lithuania", "Литва", "Lituania"),
  entry("LU", "Luxembourg", "Люксембург", "Luxemburgo"),
  // M
  entry("MG", "Madagascar", "Мадагаскар", "Madagascar"),
  entry("MW", "Malawi", "Малави", "Malaui"),
  entry("MY", "Malaysia", "Малайзия", "Malasia"),
  entry("MV", "Maldives", "Мальдивы", "Maldivas"),
  entry("ML", "Mali", "Мали", "Mali"),
  entry("MT", "Malta", "Мальта", "Malta"),
  entry("MH", "Marshall Islands", "Маршалловы Острова", "Islas Marshall"),
  entry("MR", "Mauritania", "Мавритания", "Mauritania"),
  entry("MU", "Mauritius", "Маврикий", "Mauricio"),
  entry("MX", "Mexico", "Мексика", "México"),
  entry("FM", "Micronesia", "Микронезия", "Micronesia"),
  entry("MD", "Moldova", "Молдова", "Moldavia"),
  entry("MC", "Monaco", "Монако", "Mónaco"),
  entry("MN", "Mongolia", "Монголия", "Mongolia"),
  entry("ME", "Montenegro", "Черногория", "Montenegro"),
  entry("MA", "Morocco", "Марокко", "Marruecos"),
  entry("MZ", "Mozambique", "Мозамбик", "Mozambique"),
  entry("MM", "Myanmar", "Мьянма", "Myanmar"),
  // N
  entry("NA", "Namibia", "Намибия", "Namibia"),
  entry("NR", "Nauru", "Науру", "Nauru"),
  entry("NP", "Nepal", "Непал", "Nepal"),
  entry("NL", "Netherlands", "Нидерланды", "Países Bajos"),
  entry("NZ", "New Zealand", "Новая Зеландия", "Nueva Zelanda"),
  entry("NI", "Nicaragua", "Никарагуа", "Nicaragua"),
  entry("NE", "Niger", "Нигер", "Níger"),
  entry("NG", "Nigeria", "Нигерия", "Nigeria"),
  entry("MK", "North Macedonia", "Северная Македония", "Macedonia del Norte"),
  entry("NO", "Norway", "Норвегия", "Noruega"),
  // O
  entry("OM", "Oman", "Оман", "Omán"),
  // P
  entry("PK", "Pakistan", "Пакистан", "Pakistán"),
  entry("PW", "Palau", "Палау", "Palaos"),
  entry("PS", "Palestine", "Палестина", "Palestina"),
  entry("PA", "Panama", "Панама", "Panamá"),
  entry("PG", "Papua New Guinea", "Папуа — Новая Гвинея", "Papúa Nueva Guinea"),
  entry("PY", "Paraguay", "Парагвай", "Paraguay"),
  entry("PE", "Peru", "Перу", "Perú"),
  entry("PH", "Philippines", "Филиппины", "Filipinas"),
  entry("PL", "Poland", "Польша", "Polonia"),
  entry("PT", "Portugal", "Португалия", "Portugal"),
  // Q
  entry("QA", "Qatar", "Катар", "Catar"),
  // R
  entry("RO", "Romania", "Румыния", "Rumania"),
  entry("RU", "Russia", "Россия", "Rusia"),
  entry("RW", "Rwanda", "Руанда", "Ruanda"),
  // S
  entry("KN", "Saint Kitts and Nevis", "Сент-Китс и Невис", "San Cristóbal y Nieves"),
  entry("LC", "Saint Lucia", "Сент-Люсия", "Santa Lucía"),
  entry("VC", "Saint Vincent and the Grenadines", "Сент-Винсент и Гренадины", "San Vicente y las Granadinas"),
  entry("WS", "Samoa", "Самоа", "Samoa"),
  entry("SM", "San Marino", "Сан-Марино", "San Marino"),
  entry("ST", "São Tomé and Príncipe", "Сан-Томе и Принсипи", "Santo Tomé y Príncipe"),
  entry("SA", "Saudi Arabia", "Саудовская Аравия", "Arabia Saudita"),
  entry("SN", "Senegal", "Сенегал", "Senegal"),
  entry("RS", "Serbia", "Сербия", "Serbia"),
  entry("SC", "Seychelles", "Сейшелы", "Seychelles"),
  entry("SL", "Sierra Leone", "Сьерра-Леоне", "Sierra Leona"),
  entry("SG", "Singapore", "Сингапур", "Singapur"),
  entry("SK", "Slovakia", "Словакия", "Eslovaquia"),
  entry("SI", "Slovenia", "Словения", "Eslovenia"),
  entry("SB", "Solomon Islands", "Соломоновы Острова", "Islas Salomón"),
  entry("SO", "Somalia", "Сомали", "Somalia"),
  entry("ZA", "South Africa", "ЮАР", "Sudáfrica"),
  entry("SS", "South Sudan", "Южный Судан", "Sudán del Sur"),
  entry("ES", "Spain", "Испания", "España"),
  entry("LK", "Sri Lanka", "Шри-Ланка", "Sri Lanka"),
  entry("SD", "Sudan", "Судан", "Sudán"),
  entry("SR", "Suriname", "Суринам", "Surinam"),
  entry("SE", "Sweden", "Швеция", "Suecia"),
  entry("CH", "Switzerland", "Швейцария", "Suiza"),
  entry("SY", "Syria", "Сирия", "Siria"),
  // T
  entry("TW", "Taiwan", "Тайвань", "Taiwán"),
  entry("TJ", "Tajikistan", "Таджикистан", "Tayikistán"),
  entry("TZ", "Tanzania", "Танзания", "Tanzania"),
  entry("TH", "Thailand", "Таиланд", "Tailandia"),
  entry("TL", "Timor-Leste", "Восточный Тимор", "Timor Oriental"),
  entry("TG", "Togo", "Того", "Togo"),
  entry("TO", "Tonga", "Тонга", "Tonga"),
  entry("TT", "Trinidad and Tobago", "Тринидад и Тобаго", "Trinidad y Tobago"),
  entry("TN", "Tunisia", "Тунис", "Túnez"),
  entry("TR", "Turkey", "Турция", "Turquía"),
  entry("TM", "Turkmenistan", "Туркменистан", "Turkmenistán"),
  entry("TV", "Tuvalu", "Тувалу", "Tuvalu"),
  // U
  entry("UG", "Uganda", "Уганда", "Uganda"),
  entry("UA", "Ukraine", "Украина", "Ucrania"),
  entry("AE", "United Arab Emirates", "ОАЭ", "Emiratos Árabes Unidos"),
  entry("GB", "United Kingdom", "Великобритания", "Reino Unido"),
  entry("US", "United States", "США", "Estados Unidos"),
  entry("UY", "Uruguay", "Уругвай", "Uruguay"),
  entry("UZ", "Uzbekistan", "Узбекистан", "Uzbekistán"),
  // V
  entry("VU", "Vanuatu", "Вануату", "Vanuatu"),
  entry("VA", "Vatican City", "Ватикан", "Ciudad del Vaticano"),
  entry("VE", "Venezuela", "Венесуэла", "Venezuela"),
  entry("VN", "Vietnam", "Вьетнам", "Vietnam"),
  // Y
  entry("YE", "Yemen", "Йемен", "Yemen"),
  // Z
  entry("ZM", "Zambia", "Замбия", "Zambia"),
  entry("ZW", "Zimbabwe", "Зимбабве", "Zimbabue"),
];
