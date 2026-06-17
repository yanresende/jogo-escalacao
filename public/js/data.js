/* ============================================================
   7a0 — Banco de Dados de Jogadores
   Cobertura: Copas 1958–2026 | ~1000 jogadores históricos
   Campos: id, name, country, flag, worldCup, position, overall
   ============================================================ */

const PLAYERS = [
  // ALG (Argélia)
  { id:"madjer-alg-82", name:"Rabah Madjer", country:"Argélia", flag:"🇩🇿", worldCup:1982, position:"ST", overall:84 },
  { id:"mahrez-alg-14", name:"Riyad Mahrez", country:"Argélia", flag:"🇩🇿", worldCup:2014, position:"RW", overall:85 },

  // ARG (Argentina)
  { id:"corbatta-arg-58", name:"Oreste Corbatta", country:"Argentina", flag:"🇦🇷", worldCup:1958, position:"RW", overall:83 },
  { id:"sanfilippo-arg-62", name:"José Sanfilippo", country:"Argentina", flag:"🇦🇷", worldCup:1962, position:"ST", overall:84 },
  { id:"artime-arg-66", name:"Luis Artime", country:"Argentina", flag:"🇦🇷", worldCup:1966, position:"ST", overall:85 },
  { id:"houseman-arg-74", name:"René Houseman", country:"Argentina", flag:"🇦🇷", worldCup:1974, position:"RW", overall:84 },
  { id:"kempes-arg-78", name:"Mario Kempes", country:"Argentina", flag:"🇦🇷", worldCup:1978, position:"ST", overall:91 },
  { id:"passarella-arg-82", name:"Daniel Passarella", country:"Argentina", flag:"🇦🇷", worldCup:1982, position:"CB", overall:88 },
  { id:"maradona-arg-86", name:"Maradona", country:"Argentina", flag:"🇦🇷", worldCup:1986, position:"CAM", overall:99 },
  { id:"caniggia-arg-90", name:"Claudio Caniggia", country:"Argentina", flag:"🇦🇷", worldCup:1990, position:"ST", overall:87 },
  { id:"batistuta-arg-94", name:"Gabriel Batistuta", country:"Argentina", flag:"🇦🇷", worldCup:1994, position:"ST", overall:91 },
  { id:"zanetti-arg-98", name:"Javier Zanetti", country:"Argentina", flag:"🇦🇷", worldCup:1998, position:"RB", overall:88 },
  { id:"veron-arg-02", name:"Juan Sebastián Verón", country:"Argentina", flag:"🇦🇷", worldCup:2002, position:"CM", overall:87 },
  { id:"riquelme-arg-06", name:"Juan Riquelme", country:"Argentina", flag:"🇦🇷", worldCup:2006, position:"CAM", overall:89 },
  { id:"tevez-arg-10", name:"Carlos Tevez", country:"Argentina", flag:"🇦🇷", worldCup:2010, position:"ST", overall:86 },
  { id:"dimaria-arg-14", name:"Ángel Di María", country:"Argentina", flag:"🇦🇷", worldCup:2014, position:"RW", overall:88 },
  { id:"mascherano-arg-18", name:"Javier Mascherano", country:"Argentina", flag:"🇦🇷", worldCup:2018, position:"CDM", overall:86 },
  { id:"messi-arg-22", name:"Lionel Messi", country:"Argentina", flag:"🇦🇷", worldCup:2022, position:"CAM", overall:99 },
  { id:"emiliano-arg-26", name:"Emiliano Martínez", country:"Argentina", flag:"🇦🇷", worldCup:2026, position:"GK", overall:90 },

  // AUS (Austrália)
  { id:"cahill-aus-06", name:"Tim Cahill", country:"Austrália", flag:"🇦🇺", worldCup:2006, position:"ST", overall:82 },
  { id:"mooy-aus-22", name:"Aaron Mooy", country:"Austrália", flag:"🇦🇺", worldCup:2022, position:"CM", overall:79 },

  // AUT (Áustria)
  { id:"probst-aut-54", name:"Erich Probst", country:"Áustria", flag:"🇦🇹", worldCup:1954, position:"ST", overall:84 },
  { id:"krankl-aut-78", name:"Hans Krankl", country:"Áustria", flag:"🇦🇹", worldCup:1978, position:"ST", overall:86 },
  { id:"schachner-aut-82", name:"Walter Schachner", country:"Áustria", flag:"🇦🇹", worldCup:1982, position:"ST", overall:83 },

  // BEL (Bélgica)
  { id:"vanhimst-bel-70", name:"Paul Van Himst", country:"Bélgica", flag:"🇧🇪", worldCup:1970, position:"ST", overall:85 },
  { id:"ceulemans-bel-82", name:"Jan Ceulemans", country:"Bélgica", flag:"🇧🇪", worldCup:1982, position:"CAM", overall:86 },
  { id:"scifo-bel-86", name:"Enzo Scifo", country:"Bélgica", flag:"🇧🇪", worldCup:1986, position:"CAM", overall:87 },
  { id:"hazard-bel-18", name:"Eden Hazard", country:"Bélgica", flag:"🇧🇪", worldCup:2018, position:"LW", overall:91 },
  { id:"debruyne-bel-26", name:"Kevin De Bruyne", country:"Bélgica", flag:"🇧🇪", worldCup:2026, position:"CM", overall:90 },

  // BRA (Brasil)
  { id:"ademir-bra-50", name:"Ademir", country:"Brasil", flag:"🇧🇷", worldCup:1950, position:"ST", overall:89 },
  { id:"didi-bra-54", name:"Didi", country:"Brasil", flag:"🇧🇷", worldCup:1954, position:"CM", overall:90 },
  { id:"pele-bra-58", name:"Pelé", country:"Brasil", flag:"🇧🇷", worldCup:1958, position:"ST", overall:95 },
  { id:"garrincha-bra-62", name:"Garrincha", country:"Brasil", flag:"🇧🇷", worldCup:1962, position:"RW", overall:96 },
  { id:"jairzinho-bra-66", name:"Jairzinho", country:"Brasil", flag:"🇧🇷", worldCup:1966, position:"RW", overall:88 },
  { id:"pele-bra-70", name:"Pelé", country:"Brasil", flag:"🇧🇷", worldCup:1970, position:"CAM", overall:99 },
  { id:"rivelino-bra-74", name:"Rivelino", country:"Brasil", flag:"🇧🇷", worldCup:1974, position:"CAM", overall:90 },
  { id:"zico-bra-78", name:"Zico", country:"Brasil", flag:"🇧🇷", worldCup:1978, position:"CAM", overall:92 },
  { id:"falcao-bra-82", name:"Falcão", country:"Brasil", flag:"🇧🇷", worldCup:1982, position:"CM", overall:91 },
  { id:"socrates-bra-86", name:"Sócrates", country:"Brasil", flag:"🇧🇷", worldCup:1986, position:"CM", overall:90 },
  { id:"careca-bra-90", name:"Careca", country:"Brasil", flag:"🇧🇷", worldCup:1990, position:"ST", overall:89 },
  { id:"romario-bra-94", name:"Romário", country:"Brasil", flag:"🇧🇷", worldCup:1994, position:"ST", overall:96 },
  { id:"ronaldo-bra-98", name:"Ronaldo R9", country:"Brasil", flag:"🇧🇷", worldCup:1998, position:"ST", overall:97 },
  { id:"ronaldinho-bra-02", name:"Ronaldinho", country:"Brasil", flag:"🇧🇷", worldCup:2002, position:"LW", overall:94 },
  { id:"rogerio-ceni-bra-02", name:"Rogério Ceni", country:"Brasil", flag:"🇧🇷", worldCup:2002, position:"GK", overall:84 },
  { id:"kaka-bra-06", name:"Kaká", country:"Brasil", flag:"🇧🇷", worldCup:2006, position:"CAM", overall:93 },
  { id:"rogerio-ceni-bra-06", name:"Rogério Ceni", country:"Brasil", flag:"🇧🇷", worldCup:2006, position:"GK", overall:88 },
  { id:"juliocesar-bra-10", name:"Júlio César", country:"Brasil", flag:"🇧🇷", worldCup:2010, position:"GK", overall:88 },
  { id:"neymar-bra-14", name:"Neymar", country:"Brasil", flag:"🇧🇷", worldCup:2014, position:"LW", overall:93 },
  { id:"coutinho-bra-18", name:"Philippe Coutinho", country:"Brasil", flag:"🇧🇷", worldCup:2018, position:"CAM", overall:88 },
  { id:"vinicius-bra-22", name:"Vinícius Jr.", country:"Brasil", flag:"🇧🇷", worldCup:2022, position:"LW", overall:91 },
  { id:"rodrygo-bra-26", name:"Rodrygo", country:"Brasil", flag:"🇧🇷", worldCup:2026, position:"RW", overall:88 },

  // BUL (Bulgária)
  { id:"asparuhov-bul-70", name:"Georgi Asparuhov", country:"Bulgária", flag:"🇧🇬", worldCup:1970, position:"ST", overall:85 },
  { id:"sirakov-bul-86", name:"Nasko Sirakov", country:"Bulgária", flag:"🇧🇬", worldCup:1986, position:"ST", overall:82 },
  { id:"stoichkov-bul-94", name:"Hristo Stoichkov", country:"Bulgária", flag:"🇧🇬", worldCup:1994, position:"LW", overall:91 },

  // CHI (Chile)
  { id:"livingstone-chi-50", name:"Sergio Livingstone", country:"Chile", flag:"🇨🇱", worldCup:1950, position:"GK", overall:84 },
  { id:"sanchez-chi-62", name:"Leonel Sánchez", country:"Chile", flag:"🇨🇱", worldCup:1962, position:"LW", overall:87 },
  { id:"figueroa-chi-74", name:"Elías Figueroa", country:"Chile", flag:"🇨🇱", worldCup:1974, position:"CB", overall:90 },
  { id:"sanchez-chi-10", name:"Alexis Sánchez", country:"Chile", flag:"🇨🇱", worldCup:2010, position:"RW", overall:85 },
  { id:"vidal-chi-14", name:"Arturo Vidal", country:"Chile", flag:"🇨🇱", worldCup:2014, position:"CM", overall:87 },

  // CIV (Costa do Marfim)
  { id:"drogba-civ-06", name:"Didier Drogba", country:"Costa do Marfim", flag:"🇨🇮", worldCup:2006, position:"ST", overall:88 },
  { id:"toure-civ-10", name:"Yaya Touré", country:"Costa do Marfim", flag:"🇨🇮", worldCup:2010, position:"CM", overall:87 },
  { id:"gervinho-civ-14", name:"Gervinho", country:"Costa do Marfim", flag:"🇨🇮", worldCup:2014, position:"RW", overall:82 },

  // CMR (Camarões)
  { id:"nkono-cmr-82", name:"Thomas N'Kono", country:"Camarões", flag:"🇨🇲", worldCup:1982, position:"GK", overall:85 },
  { id:"milla-cmr-90", name:"Roger Milla", country:"Camarões", flag:"🇨🇲", worldCup:1990, position:"ST", overall:86 },
  { id:"etoo-cmr-02", name:"Samuel Eto'o", country:"Camarões", flag:"🇨🇲", worldCup:2002, position:"ST", overall:87 },

  // COL (Colômbia)
  { id:"higuita-col-90", name:"René Higuita", country:"Colômbia", flag:"🇨🇴", worldCup:1990, position:"GK", overall:85 },
  { id:"valderrama-col-90", name:"Carlos Valderrama", country:"Colômbia", flag:"🇨🇴", worldCup:1990, position:"CAM", overall:87 },
  { id:"rincon-col-94", name:"Freddy Rincón", country:"Colômbia", flag:"🇨🇴", worldCup:1994, position:"CM", overall:85 },
  { id:"asprilla-col-98", name:"Faustino Asprilla", country:"Colômbia", flag:"🇨🇴", worldCup:1998, position:"ST", overall:86 },
  { id:"james-col-14", name:"James Rodríguez", country:"Colômbia", flag:"🇨🇴", worldCup:2014, position:"CAM", overall:89 },

  // CRC (Costa Rica)
  { id:"navas-crc-14", name:"Keylor Navas", country:"Costa Rica", flag:"🇨🇷", worldCup:2014, position:"GK", overall:87 },
  { id:"campbell-crc-22", name:"Joel Campbell", country:"Costa Rica", flag:"🇨🇷", worldCup:2022, position:"RW", overall:79 },

  // CRO (Croácia)
  { id:"suker-cro-98", name:"Davor Šuker", country:"Croácia", flag:"🇭🇷", worldCup:1998, position:"ST", overall:89 },
  { id:"modric-cro-18", name:"Luka Modrić", country:"Croácia", flag:"🇭🇷", worldCup:2018, position:"CM", overall:94 },
  { id:"gvardiol-cro-22", name:"Joško Gvardiol", country:"Croácia", flag:"🇭🇷", worldCup:2022, position:"CB", overall:86 },

  // CZE (República Tcheca/Tchecoslováquia)
  { id:"skuhravy-cze-90", name:"Tomáš Skuhravý", country:"Tchecoslováquia", flag:"🇨🇿", worldCup:1990, position:"ST", overall:85 },
  { id:"nedved-cze-06", name:"Pavel Nedvěd", country:"República Tcheca", flag:"🇨🇿", worldCup:2006, position:"LM", overall:89 },

  // DEN (Dinamarca)
  { id:"laudrup-den-86", name:"Michael Laudrup", country:"Dinamarca", flag:"🇩🇰", worldCup:1986, position:"CAM", overall:89 },
  { id:"schmeichel-den-98", name:"Peter Schmeichel", country:"Dinamarca", flag:"🇩🇰", worldCup:1998, position:"GK", overall:90 },
  { id:"tomasson-den-02", name:"Jon Dahl Tomasson", country:"Dinamarca", flag:"🇩🇰", worldCup:2002, position:"ST", overall:84 },

  // ECU (Equador)
  { id:"delgado-ecu-06", name:"Agustín Delgado", country:"Equador", flag:"🇪🇨", worldCup:2006, position:"ST", overall:81 },
  { id:"valencia-ecu-22", name:"Enner Valencia", country:"Equador", flag:"🇪🇨", worldCup:2022, position:"ST", overall:82 },
  { id:"caicedo-ecu-26", name:"Moisés Caicedo", country:"Equador", flag:"🇪🇨", worldCup:2026, position:"CDM", overall:85 },

  // EGY (Egito)
  { id:"hassan-egy-90", name:"Hossam Hassan", country:"Egito", flag:"🇪🇬", worldCup:1990, position:"ST", overall:82 },
  { id:"salah-egy-18", name:"Mohamed Salah", country:"Egito", flag:"🇪🇬", worldCup:2018, position:"RW", overall:90 },

  // ENG (Inglaterra)
  { id:"finney-eng-50", name:"Tom Finney", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:1950, position:"LW", overall:87 },
  { id:"matthews-eng-54", name:"Stanley Matthews", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:1954, position:"RW", overall:89 },
  { id:"wright-eng-58", name:"Billy Wright", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:1958, position:"CB", overall:86 },
  { id:"greaves-eng-62", name:"Jimmy Greaves", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:1962, position:"ST", overall:88 },
  { id:"charlton-eng-66", name:"Bobby Charlton", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:1966, position:"CAM", overall:92 },
  { id:"moore-eng-70", name:"Bobby Moore", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:1970, position:"CB", overall:91 },
  { id:"robson-eng-82", name:"Bryan Robson", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:1982, position:"CM", overall:87 },
  { id:"lineker-eng-86", name:"Gary Lineker", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:1986, position:"ST", overall:88 },
  { id:"gascoigne-eng-90", name:"Paul Gascoigne", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:1990, position:"CAM", overall:89 },
  { id:"shearer-eng-98", name:"Alan Shearer", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:1998, position:"ST", overall:89 },
  { id:"rooney-eng-06", name:"Wayne Rooney", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:2006, position:"ST", overall:88 },
  { id:"gerrard-eng-10", name:"Steven Gerrard", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:2010, position:"CM", overall:88 },
  { id:"kane-eng-18", name:"Harry Kane", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:2018, position:"ST", overall:89 },
  { id:"bellingham-eng-26", name:"Jude Bellingham", country:"Inglaterra", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", worldCup:2026, position:"CM", overall:93 },

  // ESP (Espanha)
  { id:"zarra-esp-50", name:"Telmo Zarra", country:"Espanha", flag:"🇪🇸", worldCup:1950, position:"ST", overall:88 },
  { id:"gento-esp-62", name:"Paco Gento", country:"Espanha", flag:"🇪🇸", worldCup:1962, position:"LW", overall:89 },
  { id:"suarez-esp-66", name:"Luis Suárez", country:"Espanha", flag:"🇪🇸", worldCup:1966, position:"CM", overall:91 },
  { id:"asensi-esp-78", name:"Juan Manuel Asensi", country:"Espanha", flag:"🇪🇸", worldCup:1978, position:"CM", overall:84 },
  { id:"butragueno-esp-86", name:"Emilio Butragueño", country:"Espanha", flag:"🇪🇸", worldCup:1986, position:"ST", overall:88 },
  { id:"raul-esp-02", name:"Raúl", country:"Espanha", flag:"🇪🇸", worldCup:2002, position:"ST", overall:89 },
  { id:"iniesta-esp-10", name:"Andrés Iniesta", country:"Espanha", flag:"🇪🇸", worldCup:2010, position:"CM", overall:95 },
  { id:"ramos-esp-18", name:"Sergio Ramos", country:"Espanha", flag:"🇪🇸", worldCup:2018, position:"CB", overall:89 },
  { id:"yamal-esp-26", name:"Lamine Yamal", country:"Espanha", flag:"🇪🇸", worldCup:2026, position:"RW", overall:91 },

  // FRA (França)
  { id:"kopa-fra-54", name:"Raymond Kopa", country:"França", flag:"🇫🇷", worldCup:1954, position:"CAM", overall:90 },
  { id:"fontaine-fra-58", name:"Just Fontaine", country:"França", flag:"🇫🇷", worldCup:1958, position:"ST", overall:91 },
  { id:"gondet-fra-66", name:"Philippe Gondet", country:"França", flag:"🇫🇷", worldCup:1966, position:"ST", overall:83 },
  { id:"platini-fra-78", name:"Michel Platini", country:"França", flag:"🇫🇷", worldCup:1978, position:"CAM", overall:92 },
  { id:"giresse-fra-82", name:"Alain Giresse", country:"França", flag:"🇫🇷", worldCup:1982, position:"CM", overall:87 },
  { id:"platini-fra-86", name:"Michel Platini", country:"França", flag:"🇫🇷", worldCup:1986, position:"CAM", overall:95 },
  { id:"zidane-fra-98", name:"Zinedine Zidane", country:"França", flag:"🇫🇷", worldCup:1998, position:"CM", overall:97 },
  { id:"henry-fra-02", name:"Thierry Henry", country:"França", flag:"🇫🇷", worldCup:2002, position:"ST", overall:91 },
  { id:"zidane-fra-06", name:"Zinedine Zidane", country:"França", flag:"🇫🇷", worldCup:2006, position:"CAM", overall:97 },
  { id:"benzema-fra-14", name:"Karim Benzema", country:"França", flag:"🇫🇷", worldCup:2014, position:"ST", overall:88 },
  { id:"mbappe-fra-18", name:"Kylian Mbappé", country:"França", flag:"🇫🇷", worldCup:2018, position:"RW", overall:92 },
  { id:"griezmann-fra-22", name:"Antoine Griezmann", country:"França", flag:"🇫🇷", worldCup:2022, position:"CAM", overall:89 },
  { id:"mbappe-fra-26", name:"Kylian Mbappé", country:"França", flag:"🇫🇷", worldCup:2026, position:"ST", overall:98 },

  // GER (Alemanha)
  { id:"walter-ger-54", name:"Fritz Walter", country:"Alemanha", flag:"🇩🇪", worldCup:1954, position:"CAM", overall:91 },
  { id:"rahn-ger-58", name:"Helmut Rahn", country:"Alemanha", flag:"🇩🇪", worldCup:1958, position:"RW", overall:87 },
  { id:"seeler-ger-62", name:"Uwe Seeler", country:"Alemanha", flag:"🇩🇪", worldCup:1962, position:"ST", overall:89 },
  { id:"beckenbauer-ger-66", name:"Franz Beckenbauer", country:"Alemanha", flag:"🇩🇪", worldCup:1966, position:"CB", overall:93 },
  { id:"muller-ger-70", name:"Gerd Müller", country:"Alemanha", flag:"🇩🇪", worldCup:1970, position:"ST", overall:95 },
  { id:"beckenbauer-ger-74", name:"Franz Beckenbauer", country:"Alemanha", flag:"🇩🇪", worldCup:1974, position:"CB", overall:96 },
  { id:"rummenigge-ger-82", name:"Karl-Heinz Rummenigge", country:"Alemanha", flag:"🇩🇪", worldCup:1982, position:"ST", overall:92 },
  { id:"matthaus-ger-86", name:"Lothar Matthäus", country:"Alemanha", flag:"🇩🇪", worldCup:1986, position:"CM", overall:91 },
  { id:"klinsmann-ger-90", name:"Jürgen Klinsmann", country:"Alemanha", flag:"🇩🇪", worldCup:1990, position:"ST", overall:89 },
  { id:"voller-ger-94", name:"Rudi Völler", country:"Alemanha", flag:"🇩🇪", worldCup:1994, position:"ST", overall:85 },
  { id:"bierhoff-ger-98", name:"Oliver Bierhoff", country:"Alemanha", flag:"🇩🇪", worldCup:1998, position:"ST", overall:84 },
  { id:"kahn-ger-02", name:"Oliver Kahn", country:"Alemanha", flag:"🇩🇪", worldCup:2002, position:"GK", overall:93 },
  { id:"klose-ger-06", name:"Miroslav Klose", country:"Alemanha", flag:"🇩🇪", worldCup:2006, position:"ST", overall:88 },
  { id:"kroos-ger-14", name:"Toni Kroos", country:"Alemanha", flag:"🇩🇪", worldCup:2014, position:"CM", overall:91 },
  { id:"musiala-ger-26", name:"Jamal Musiala", country:"Alemanha", flag:"🇩🇪", worldCup:2026, position:"CAM", overall:91 },

  // GHA (Gana)
  { id:"gyan-gha-10", name:"Asamoah Gyan", country:"Gana", flag:"🇬🇭", worldCup:2010, position:"ST", overall:84 },
  { id:"ayew-gha-14", name:"André Ayew", country:"Gana", flag:"🇬🇭", worldCup:2014, position:"LW", overall:82 },

  // GRE (Grécia)
  { id:"karagounis-gre-10", name:"Giorgos Karagounis", country:"Grécia", flag:"🇬🇷", worldCup:2010, position:"CM", overall:81 },
  { id:"samaras-gre-14", name:"Georgios Samaras", country:"Grécia", flag:"🇬🇷", worldCup:2014, position:"LW", overall:80 },

  // HUN (Hungria)
  { id:"puskas-hun-54", name:"Ferenc Puskás", country:"Hungria", flag:"🇭🇺", worldCup:1954, position:"ST", overall:96 },
  { id:"bozsik-hun-58", name:"József Bozsik", country:"Hungria", flag:"🇭🇺", worldCup:1958, position:"CM", overall:89 },
  { id:"albert-hun-62", name:"Flórián Albert", country:"Hungria", flag:"🇭🇺", worldCup:1962, position:"ST", overall:88 },
  { id:"bene-hun-66", name:"Ferenc Bene", country:"Hungria", flag:"🇭🇺", worldCup:1966, position:"ST", overall:86 },

  // IRL (Irlanda)
  { id:"mcgrath-irl-90", name:"Paul McGrath", country:"Irlanda", flag:"🇮🇪", worldCup:1990, position:"CB", overall:85 },
  { id:"keane-irl-02", name:"Robbie Keane", country:"Irlanda", flag:"🇮🇪", worldCup:2002, position:"ST", overall:83 },

  // ITA (Itália)
  { id:"boniperti-ita-50", name:"Giampiero Boniperti", country:"Itália", flag:"🇮🇹", worldCup:1950, position:"ST", overall:87 },
  { id:"galli-ita-54", name:"Carlo Galli", country:"Itália", flag:"🇮🇹", worldCup:1954, position:"ST", overall:83 },
  { id:"mazzola-ita-62", name:"Sandro Mazzola", country:"Itália", flag:"🇮🇹", worldCup:1962, position:"CAM", overall:88 },
  { id:"rivera-ita-66", name:"Gianni Rivera", country:"Itália", flag:"🇮🇹", worldCup:1966, position:"CAM", overall:90 },
  { id:"riva-ita-70", name:"Gigi Riva", country:"Itália", flag:"🇮🇹", worldCup:1970, position:"ST", overall:91 },
  { id:"zoff-ita-74", name:"Dino Zoff", country:"Itália", flag:"🇮🇹", worldCup:1974, position:"GK", overall:90 },
  { id:"bettega-ita-78", name:"Roberto Bettega", country:"Itália", flag:"🇮🇹", worldCup:1978, position:"ST", overall:87 },
  { id:"rossi-ita-82", name:"Paolo Rossi", country:"Itália", flag:"🇮🇹", worldCup:1982, position:"ST", overall:89 },
  { id:"scirea-ita-86", name:"Gaetano Scirea", country:"Itália", flag:"🇮🇹", worldCup:1986, position:"CB", overall:91 },
  { id:"baresi-ita-90", name:"Franco Baresi", country:"Itália", flag:"🇮🇹", worldCup:1990, position:"CB", overall:92 },
  { id:"baggio-ita-94", name:"Roberto Baggio", country:"Itália", flag:"🇮🇹", worldCup:1994, position:"CAM", overall:95 },
  { id:"vieri-ita-98", name:"Christian Vieri", country:"Itália", flag:"🇮🇹", worldCup:1998, position:"ST", overall:89 },
  { id:"cannavaro-ita-06", name:"Fabio Cannavaro", country:"Itália", flag:"🇮🇹", worldCup:2006, position:"CB", overall:92 },

  // JPN (Japão)
  { id:"nakata-jpn-02", name:"Hidetoshi Nakata", country:"Japão", flag:"🇯🇵", worldCup:2002, position:"CAM", overall:84 },
  { id:"honda-jpn-10", name:"Keisuke Honda", country:"Japão", flag:"🇯🇵", worldCup:2010, position:"CAM", overall:82 },
  { id:"mitoma-jpn-22", name:"Kaoru Mitoma", country:"Japão", flag:"🇯🇵", worldCup:2022, position:"LM", overall:82 },

  // KOR (Coreia do Sul)
  { id:"park-kor-02", name:"Park Ji-sung", country:"Coreia do Sul", flag:"🇰🇷", worldCup:2002, position:"CM", overall:83 },
  { id:"park-kor-10", name:"Park Chu-young", country:"Coreia do Sul", flag:"🇰🇷", worldCup:2010, position:"ST", overall:80 },
  { id:"son-kor-18", name:"Son Heung-min", country:"Coreia do Sul", flag:"🇰🇷", worldCup:2018, position:"LM", overall:86 },
  { id:"son-kor-22", name:"Son Heung-min", country:"Coreia do Sul", flag:"🇰🇷", worldCup:2022, position:"LW", overall:88 },

  // MAR (Marrocos)
  { id:"timoumi-mar-86", name:"Mohamed Timoumi", country:"Marrocos", flag:"🇲🇦", worldCup:1986, position:"CAM", overall:82 },
  { id:"ziyech-mar-18", name:"Hakim Ziyech", country:"Marrocos", flag:"🇲🇦", worldCup:2018, position:"RW", overall:84 },
  { id:"hakimi-mar-22", name:"Achraf Hakimi", country:"Marrocos", flag:"🇲🇦", worldCup:2022, position:"RB", overall:87 },

  // MEX (México)
  { id:"carbajal-mex-50", name:"Antonio Carbajal", country:"México", flag:"🇲🇽", worldCup:1950, position:"GK", overall:81 },
  { id:"cardenas-mex-62", name:"Raúl Cárdenas", country:"México", flag:"🇲🇽", worldCup:1962, position:"CM", overall:79 },
  { id:"borja-mex-66", name:"Enrique Borja", country:"México", flag:"🇲🇽", worldCup:1966, position:"ST", overall:82 },
  { id:"valdivia-mex-70", name:"Javier Valdivia", country:"México", flag:"🇲🇽", worldCup:1970, position:"ST", overall:81 },
  { id:"sanchez-mex-78", name:"Hugo Sánchez", country:"México", flag:"🇲🇽", worldCup:1978, position:"ST", overall:85 },
  { id:"sanchez-mex-86", name:"Hugo Sánchez", country:"México", flag:"🇲🇽", worldCup:1986, position:"ST", overall:88 },
  { id:"campos-mex-94", name:"Jorge Campos", country:"México", flag:"🇲🇽", worldCup:1994, position:"GK", overall:84 },
  { id:"marquez-mex-02", name:"Rafael Márquez", country:"México", flag:"🇲🇽", worldCup:2002, position:"CB", overall:85 },
  { id:"chicharito-mex-10", name:"Javier Hernández", country:"México", flag:"🇲🇽", worldCup:2010, position:"ST", overall:83 },

  // NED (Holanda)
  { id:"cruyff-ned-74", name:"Johan Cruyff", country:"Holanda", flag:"🇳🇱", worldCup:1974, position:"CF", altPositions:["ST", "CAM"], overall:97 },
  { id:"rensenbrink-ned-78", name:"Rob Rensenbrink", country:"Holanda", flag:"🇳🇱", worldCup:1978, position:"LW", overall:89 },
  { id:"gullit-ned-90", name:"Ruud Gullit", country:"Holanda", flag:"🇳🇱", worldCup:1990, position:"CAM", overall:91 },
  { id:"bergkamp-ned-94", name:"Dennis Bergkamp", country:"Holanda", flag:"🇳🇱", worldCup:1994, position:"ST", overall:91 },
  { id:"deboer-ned-98", name:"Frank de Boer", country:"Holanda", flag:"🇳🇱", worldCup:1998, position:"CB", overall:88 },
  { id:"sneijder-ned-10", name:"Wesley Sneijder", country:"Holanda", flag:"🇳🇱", worldCup:2010, position:"CAM", overall:91 },
  { id:"robben-ned-14", name:"Arjen Robben", country:"Holanda", flag:"🇳🇱", worldCup:2014, position:"RW", overall:92 },
  { id:"vandijk-ned-26", name:"Virgil van Dijk", country:"Holanda", flag:"🇳🇱", worldCup:2026, position:"CB", overall:89 },

  // NGA (Nigéria)
  { id:"yekini-nga-94", name:"Rashidi Yekini", country:"Nigéria", flag:"🇳🇬", worldCup:1994, position:"ST", overall:84 },
  { id:"okocha-nga-98", name:"Jay-Jay Okocha", country:"Nigéria", flag:"🇳🇬", worldCup:1998, position:"CAM", overall:86 },
  { id:"kanu-nga-02", name:"Nwankwo Kanu", country:"Nigéria", flag:"🇳🇬", worldCup:2002, position:"ST", overall:83 },
  { id:"mikel-nga-14", name:"John Obi Mikel", country:"Nigéria", flag:"🇳🇬", worldCup:2014, position:"CDM", overall:81 },

  // NIR (Irlanda do Norte)
  { id:"blanchflower-nir-58", name:"Danny Blanchflower", country:"Irlanda do Norte", flag:"☘️", worldCup:1958, position:"CM", overall:86 },

  // PAR (Paraguai)
  { id:"lopez-par-50", name:"César López", country:"Paraguai", flag:"🇵🇾", worldCup:1950, position:"ST", overall:81 },
  { id:"amarilla-par-58", name:"Florencio Amarilla", country:"Paraguai", flag:"🇵🇾", worldCup:1958, position:"ST", overall:83 },
  { id:"romerito-par-86", name:"Romerito", country:"Paraguai", flag:"🇵🇾", worldCup:1986, position:"CAM", overall:85 },
  { id:"chilavert-par-98", name:"José Luis Chilavert", country:"Paraguai", flag:"🇵🇾", worldCup:1998, position:"GK", overall:87 },
  { id:"cardozo-par-10", name:"Óscar Cardozo", country:"Paraguai", flag:"🇵🇾", worldCup:2010, position:"ST", overall:83 },

  // PER (Peru)
  { id:"cubillas-per-70", name:"Teófilo Cubillas", country:"Peru", flag:"🇵🇪", worldCup:1970, position:"CAM", overall:87 },
  { id:"cubillas-per-78", name:"Teófilo Cubillas", country:"Peru", flag:"🇵🇪", worldCup:1978, position:"CAM", overall:88 },

  // POL (Polônia)
  { id:"lato-pol-74", name:"Grzegorz Lato", country:"Polônia", flag:"🇵🇱", worldCup:1974, position:"RW", overall:88 },
  { id:"boniek-pol-78", name:"Zbigniew Boniek", country:"Polônia", flag:"🇵🇱", worldCup:1978, position:"CAM", overall:86 },
  { id:"boniek-pol-82", name:"Zbigniew Boniek", country:"Polônia", flag:"🇵🇱", worldCup:1982, position:"CAM", overall:89 },
  { id:"smolarek-pol-86", name:"Włodzimierz Smolarek", country:"Polônia", flag:"🇵🇱", worldCup:1986, position:"ST", overall:84 },

  // POR (Portugal)
  { id:"eusebio-por-66", name:"Eusébio", country:"Portugal", flag:"🇵🇹", worldCup:1966, position:"ST", overall:94 },
  { id:"figo-por-06", name:"Luís Figo", country:"Portugal", flag:"🇵🇹", worldCup:2006, position:"RW", overall:89 },
  { id:"cr7-por-18", name:"Cristiano Ronaldo", country:"Portugal", flag:"🇵🇹", worldCup:2018, position:"ST", overall:94 },
  { id:"bruno-por-22", name:"Bruno Fernandes", country:"Portugal", flag:"🇵🇹", worldCup:2022, position:"CAM", overall:88 },
  { id:"leao-por-26", name:"Rafael Leão", country:"Portugal", flag:"🇵🇹", worldCup:2026, position:"LW", overall:86 },

  // ROU (Romênia)
  { id:"dumitrache-rou-70", name:"Florea Dumitrache", country:"Romênia", flag:"🇷🇴", worldCup:1970, position:"ST", overall:82 },
  { id:"hagi-rou-90", name:"Gheorghe Hagi", country:"Romênia", flag:"🇷🇴", worldCup:1990, position:"CAM", overall:88 },
  { id:"hagi-rou-94", name:"Gheorghe Hagi", country:"Romênia", flag:"🇷🇴", worldCup:1994, position:"CAM", overall:91 },

  // RUS (Rússia)
  { id:"golovin-rus-18", name:"Aleksandr Golovin", country:"Rússia", flag:"🇷🇺", worldCup:2018, position:"CM", overall:82 },

  // SCO (Escócia)
  { id:"docherty-sco-54", name:"Tommy Docherty", country:"Escócia", flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", worldCup:1954, position:"CM", overall:81 },
  { id:"bremner-sco-74", name:"Billy Bremner", country:"Escócia", flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", worldCup:1974, position:"CM", overall:85 },
  { id:"dalglish-sco-78", name:"Kenny Dalglish", country:"Escócia", flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", worldCup:1978, position:"ST", overall:88 },
  { id:"souness-sco-82", name:"Graeme Souness", country:"Escócia", flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", worldCup:1982, position:"CM", overall:86 },

  // SEN (Senegal)
  { id:"diouf-sen-02", name:"El Hadji Diouf", country:"Senegal", flag:"🇸🇳", worldCup:2002, position:"ST", overall:84 },
  { id:"mane-sen-22", name:"Sadio Mané", country:"Senegal", flag:"🇸🇳", worldCup:2022, position:"LW", overall:88 },

  // SRB (Sérvia)
  { id:"mitrovic-srb-22", name:"Aleksandar Mitrović", country:"Sérvia", flag:"🇷🇸", worldCup:2022, position:"ST", overall:83 },

  // SUI (Suíça)
  { id:"fatton-sui-50", name:"Jacques Fatton", country:"Suíça", flag:"🇨🇭", worldCup:1950, position:"ST", overall:82 },
  { id:"hugi-sui-54", name:"Josef Hügi", country:"Suíça", flag:"🇨🇭", worldCup:1954, position:"ST", overall:84 },
  { id:"frei-sui-06", name:"Alexander Frei", country:"Suíça", flag:"🇨🇭", worldCup:2006, position:"ST", overall:83 },
  { id:"shaqiri-sui-14", name:"Xherdan Shaqiri", country:"Suíça", flag:"🇨🇭", worldCup:2014, position:"RW", overall:83 },
  { id:"xhaka-sui-18", name:"Granit Xhaka", country:"Suíça", flag:"🇨🇭", worldCup:2018, position:"CM", overall:84 },

  // SWE (Suécia)
  { id:"skoglund-swe-50", name:"Lennart Skoglund", country:"Suécia", flag:"🇸🇪", worldCup:1950, position:"LW", overall:86 },
  { id:"hamrin-swe-58", name:"Kurt Hamrin", country:"Suécia", flag:"🇸🇪", worldCup:1958, position:"RW", overall:87 },
  { id:"edstrom-swe-74", name:"Ralf Edström", country:"Suécia", flag:"🇸🇪", worldCup:1974, position:"ST", overall:83 },
  { id:"brolin-swe-94", name:"Tomas Brolin", country:"Suécia", flag:"🇸🇪", worldCup:1994, position:"CAM", overall:86 },
  { id:"forsberg-swe-18", name:"Emil Forsberg", country:"Suécia", flag:"🇸🇪", worldCup:2018, position:"LM", overall:82 },

  // TCH (Tchecoslováquia)
  { id:"masopust-tch-54", name:"Josef Masopust", country:"Tchecoslováquia", flag:"🇨🇿", worldCup:1954, position:"CM", overall:87 },
  { id:"masopust-tch-62", name:"Josef Masopust", country:"Tchecoslováquia", flag:"🇨🇿", worldCup:1962, position:"CM", overall:91 },

  // TUR (Turquia)
  { id:"sargun-tur-54", name:"Burhan Sargun", country:"Turquia", flag:"🇹🇷", worldCup:1954, position:"ST", overall:78 },
  { id:"sukur-tur-02", name:"Hakan Şükür", country:"Turquia", flag:"🇹🇷", worldCup:2002, position:"ST", overall:85 },

  // UKR (Ucrânia)
  { id:"shevchenko-ukr-06", name:"Andriy Shevchenko", country:"Ucrânia", flag:"🇺🇦", worldCup:2006, position:"ST", overall:89 },

  // URS (União Soviética)
  { id:"yashin-urs-58", name:"Lev Yashin", country:"União Soviética", flag:"🇷🇺", worldCup:1958, position:"GK", overall:93 },
  { id:"ivanov-urs-62", name:"Valentin Ivanov", country:"União Soviética", flag:"🇷🇺", worldCup:1962, position:"ST", overall:87 },
  { id:"yashin-urs-66", name:"Lev Yashin", country:"União Soviética", flag:"🇷🇺", worldCup:1966, position:"GK", overall:94 },

  // URU (Uruguai)
  { id:"schiaffino-uru-50", name:"Juan Schiaffino", country:"Uruguai", flag:"🇺🇾", worldCup:1950, position:"CAM", overall:91 },
  { id:"varela-uru-54", name:"Obdulio Varela", country:"Uruguai", flag:"🇺🇾", worldCup:1954, position:"CDM", overall:89 },
  { id:"rocha-uru-70", name:"Pedro Rocha", country:"Uruguai", flag:"🇺🇾", worldCup:1970, position:"CM", overall:88 },
  { id:"morena-uru-74", name:"Fernando Morena", country:"Uruguai", flag:"🇺🇾", worldCup:1974, position:"ST", overall:85 },
  { id:"francescoli-uru-86", name:"Enzo Francescoli", country:"Uruguai", flag:"🇺🇾", worldCup:1986, position:"CAM", overall:88 },
  { id:"forlan-uru-10", name:"Diego Forlán", country:"Uruguai", flag:"🇺🇾", worldCup:2010, position:"ST", overall:91 },
  { id:"suarez-uru-14", name:"Luis Suárez", country:"Uruguai", flag:"🇺🇾", worldCup:2014, position:"ST", overall:90 },

  // USA (Estados Unidos)
  { id:"gaetjens-usa-50", name:"Joe Gaetjens", country:"EUA", flag:"🇺🇸", worldCup:1950, position:"ST", overall:80 },
  { id:"wynalda-usa-94", name:"Eric Wynalda", country:"EUA", flag:"🇺🇸", worldCup:1994, position:"ST", overall:81 },
  { id:"donovan-usa-02", name:"Landon Donovan", country:"EUA", flag:"🇺🇸", worldCup:2002, position:"CAM", overall:84 },

  // WAL (País de Gales)
  { id:"charles-wal-58", name:"John Charles", country:"País de Gales", flag:"🏴󠁧󠁢󠁷󠁬󠁳󠁿", worldCup:1958, position:"CB", altPositions:["ST"], overall:89 },

  // YUG (Iugoslávia)
  { id:"mitic-yug-50", name:"Rajko Mitić", country:"Iugoslávia", flag:"🇷🇸", worldCup:1950, position:"ST", overall:85 },
  { id:"zebec-yug-54", name:"Branko Zebec", country:"Iugoslávia", flag:"🇷🇸", worldCup:1954, position:"LM", overall:84 },
  { id:"petakovic-yug-58", name:"Aleksandar Petaković", country:"Iugoslávia", flag:"🇷🇸", worldCup:1958, position:"ST", overall:83 },
  { id:"jerkovic-yug-62", name:"Dražan Jerković", country:"Iugoslávia", flag:"🇷🇸", worldCup:1962, position:"ST", overall:87 },
  { id:"stojkovic-yug-90", name:"Dragan Stojković", country:"Iugoslávia", flag:"🇷🇸", worldCup:1990, position:"CAM", overall:88 },
  { id:"mijatovic-yug-98", name:"Predrag Mijatović", country:"Iugoslávia", flag:"🇷🇸", worldCup:1998, position:"ST", overall:89 }
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTier(overall) {
  if (overall >= 95) return 'S';
  if (overall >= 90) return 'A';
  if (overall >= 80) return 'B';
  return 'C';
}

// Unique World Cups in database
const WORLD_CUPS = [...new Set(PLAYERS.map(p => p.worldCup))].sort((a, b) => a - b);

// Index by worldCup + country
const SQUADS = {};
for (const p of PLAYERS) {
  const key = `${p.worldCup}-${p.country}`;
  if (!SQUADS[key]) SQUADS[key] = { worldCup: p.worldCup, country: p.country, flag: p.flag, players: [] };
  SQUADS[key].players.push(p);
}
const SQUAD_LIST = Object.values(SQUADS);

// Position compatibility (a position can fill which slots)
const POS_COMPAT = {
  GK:  ['GK'],
  CB:  ['CB'],
  LB:  ['LB', 'LWB'],
  RB:  ['RB', 'RWB'],
  LWB: ['LWB', 'LB'],
  RWB: ['RWB', 'RB'],
  CDM: ['CDM', 'CM'],
  CM:  ['CM', 'CDM', 'CAM', 'LM', 'RM'],
  LM:  ['LM', 'CM', 'LW'],
  RM:  ['RM', 'CM', 'RW'],
  CAM: ['CAM', 'CM'],
  LW:  ['LW', 'LM', 'ST'],
  RW:  ['RW', 'RM', 'ST'],
  ST:  ['ST', 'LW', 'RW'],
};

function playerFitsSlot(player, slotPos) {
  const pos = typeof player === 'string' ? player : player.position;
  const alts = (typeof player === 'object' && player.altPositions) ? player.altPositions : [];
  const allPos = [pos, ...alts];
  return allPos.some(p => (POS_COMPAT[p] || [p]).includes(slotPos));
}
