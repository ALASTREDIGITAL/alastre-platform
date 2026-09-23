/**
 * Resultado Factual Offline da PoC — Vidraçarias em Sorocaba
 * Fonte: scripts/poc/output/vidracaria-sorocaba-audit.json
 * Governança: Nenhuma chamada externa ao Google, nenhum dado sintético.
 */

export interface PocOfflineLead {
  id: string;
  name: string;
  category: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  maps_url: string;
  place_id: string | null;
  cid: string | null;
}

export const POC_OFFLINE_LEADS: PocOfflineLead[] = [
  {
    id: "lead_1fa4bdc9-491e-49d2-af57-738ac3813384",
    name: "Vidraçaria Sorocaba - Vidro e Arte",
    category: "Vidraçaria",
    address: "Vidraçaria Sorocaba - Vidro e Arte - Av. Ipanema, 5399 - Jardim Novo Horizonte, Sorocaba - SP, 18071-801",
    phone: "(15) 98811-0406",
    website: null,
    rating: null,
    review_count: 128,
    maps_url: "https://www.google.com/maps/place/Vidra%C3%A7aria+Sorocaba+-+Vidro+e+Arte/data=!4m7!3m6!1s0x94c5f500fc0c95af:0xff0895e5493e93d8!8m2!3d-23.4536429!4d-47.5076681!16s%2Fg%2F11b6q3rb9_!19sChIJr5UM_AD1xZQR2JM-SeWVCP8?authuser=0&hl=pt-BR&g_ep=EgoyMDI2MDkyMC4wIJJjKgBIAVAD&rclk=1",
    place_id: "ChIJr5UM_AD1xZQR2JM-SeWVCP8",
    cid: "18377103091494196184",
  },
  {
    id: "lead_e7713907-7e8a-4415-a3dc-2b6409b2ea9a",
    name: "Art Glass Vidraçaria",
    category: "Vidraçaria",
    address: "Art Glass Vidraçaria - Alameda Augusto Severo, 820 - Vila Elza, Sorocaba - SP, 18070-275",
    phone: null,
    website: "https://www.artglassvidracaria.com.br/",
    rating: null,
    review_count: 155,
    maps_url: "https://www.google.com/maps/place/Art+Glass+Vidra%C3%A7aria/data=!4m7!3m6!1s0x94c5f524b3734715:0x3f0eb88f49193811!8m2!3d-23.4772612!4d-47.4785702!16s%2Fg%2F11b6mk9y_r!19sChIJFUdzsyT1xZQRETgZSY-4Dj8?authuser=0&hl=pt-BR&g_ep=EgoyMDI2MDkyMC4wIJJjKgBIAVAD&rclk=1",
    place_id: "ChIJFUdzsyT1xZQRETgZSY-4Dj8",
    cid: "4543771999609632785",
  },
  {
    id: "lead_67358609-c6ec-4d73-bb54-387af998cc23",
    name: "N S Vidraçaria e MOLDURARIA EM 24hrs Sorocaba",
    category: "Vidraçaria",
    address: "N S Vidraçaria e MOLDURARIA EM 24hrs Sorocaba - R. Dr. Américo Figueiredo, 146 - Jardim Simus, Sorocaba - SP, 18055-131",
    phone: "(15) 3222-5601",
    website: "https://instagram.com/nsvidracariamolduraria?utm_medium=copy_link",
    rating: null,
    review_count: 57,
    maps_url: "https://www.google.com/maps/place/N+S+Vidra%C3%A7aria+e+MOLDURARIA+EM+24hrs+Sorocaba/data=!4m7!3m6!1s0x94c58ad8d7229f6f:0x112e843cfa4fba6c!8m2!3d-23.507274!4d-47.485975!16s%2Fg%2F1wk7rzj1!19sChIJb58i19iKxZQRbLpP-jyELhE?authuser=0&hl=pt-BR&g_ep=EgoyMDI2MDkyMC4wIJJjKgBIAVAD&rclk=1",
    place_id: "ChIJb58i19iKxZQRbLpP-jyELhE",
    cid: "1238072345005898348",
  },
  {
    id: "lead_748555e9-10ad-4b3d-bfb9-4ac9a742957a",
    name: "Rei do Vidro",
    category: "Vidraçaria",
    address: "Rei do Vidro - Av. Ipanema, 2825 - Nova Sorocaba, Sorocaba - SP, 18070-631",
    phone: "(15) 99639-9122",
    website: "http://www.reidovidrosorocaba.com.br/",
    rating: null,
    review_count: 178,
    maps_url: "https://www.google.com/maps/place/Rei+do+Vidro/data=!4m7!3m6!1s0x94c5f4e19b90eced:0x5d18971cb65df23c!8m2!3d-23.471638!4d-47.4903716!16s%2Fg%2F11fzwsg6bc!19sChIJ7eyQm-H0xZQRPPJdthyXGF0?authuser=0&hl=pt-BR&g_ep=EgoyMDI2MDkyMC4wIJJjKgBIAVAD&rclk=1",
    place_id: "ChIJ7eyQm-H0xZQRPPJdthyXGF0",
    cid: "6708277794542842428",
  },
  {
    id: "lead_207cfdb9-8a0f-4eda-b4c7-18946e23b7c5",
    name: "Vidraçaria Alamino",
    category: "Vidraçaria",
    address: "Vidraçaria Alamino - Av. Itavuvu, 5401 - Jardim Santa Cecilia, Sorocaba - SP, 18078-005",
    phone: "(15) 99153-7251",
    website: "http://vidracariaalamino.com.br/",
    rating: null,
    review_count: 192,
    maps_url: "https://www.google.com/maps/place/Vidra%C3%A7aria+Alamino/data=!4m7!3m6!1s0x94c5f5b07cfc5aab:0xd2b878d638825bb9!8m2!3d-23.4407903!4d-47.4784162!16s%2Fg%2F11t6ntf4tn!19sChIJq1r8fLD1xZQRuVuCONZ4uNI?authuser=0&hl=pt-BR&g_ep=EgoyMDI2MDkyMC4wIJJjKgBIAVAD&rclk=1",
    place_id: "ChIJq1r8fLD1xZQRuVuCONZ4uNI",
    cid: "15184019005146028985",
  },
  {
    id: "lead_c4814b30-db9b-46bc-acaf-071fa0f248ff",
    name: "Vidraçaria Sorocaba Arts Mold",
    category: "Vidraçaria",
    address: "Vidraçaria Sorocaba Arts Mold - R. Maria de Fátima Faria, 230 - Parque São Bento, Sorocaba - SP, 18072-440",
    phone: "(15) 99782-3464",
    website: "https://w.app/sizuw1",
    rating: null,
    review_count: 11,
    maps_url: "https://www.google.com/maps/place/Vidra%C3%A7aria+Sorocaba+Arts+Mold/data=!4m7!3m6!1s0x94c5f52b66a21a01:0xdb993d9fdeea4d5d!8m2!3d-23.4302164!4d-47.503603!16s%2Fg%2F11mlzrh3ph!19sChIJARqiZiv1xZQRXU3q3p89mds?authuser=0&hl=pt-BR&g_ep=EgoyMDI2MDkyMC4wIJJjKgBIAVAD&rclk=1",
    place_id: "ChIJARqiZiv1xZQRXU3q3p89mds",
    cid: "15823746522591939933",
  },
  {
    id: "lead_03fc58c1-e189-4c21-9d08-d4351077a705",
    name: "Vidraçaria Santiago",
    category: "Vidraçaria",
    address: "Vidraçaria Santiago - Av. Itavuvu, 4001 - Jardim Santa Cecilia, Sorocaba - SP, 18078-005",
    phone: "(15) 99847-4985",
    website: "https://vidracariasantiago.com.br/index.html",
    rating: null,
    review_count: 131,
    maps_url: "https://www.google.com/maps/place/Vidra%C3%A7aria+Santiago/data=!4m7!3m6!1s0x94c5f5369d87c99d:0x743254d6f658dadc!8m2!3d-23.4504147!4d-47.4814173!16s%2Fg%2F11hb5w92pw!19sChIJncmHnTb1xZQR3NpY9tZUMnQ?authuser=0&hl=pt-BR&g_ep=EgoyMDI2MDkyMC4wIJJjKgBIAVAD&rclk=1",
    place_id: "ChIJncmHnTb1xZQR3NpY9tZUMnQ",
    cid: "8372847939467926236",
  },
  {
    id: "lead_9500efbf-b4de-4aac-a01b-734a3d6bee5e",
    name: "Vidraçaria Alpha Glass",
    category: "Vidraçaria",
    address: "Vidraçaria Alpha Glass - Av. São Paulo, 1654 - Além Ponte, Sorocaba - SP, 18013-003",
    phone: "(15) 3019-9345",
    website: null,
    rating: null,
    review_count: 132,
    maps_url: "https://www.google.com/maps/place/Vidra%C3%A7aria+Alpha+Glass/data=!4m7!3m6!1s0x94cf61469ddf8cb1:0x83b3064047cea882!8m2!3d-23.4947574!4d-47.4370333!16s%2Fg%2F11fn22bh4s!19sChIJsYzfnUZhz5QRgqjOR0AGs4M?authuser=0&hl=pt-BR&g_ep=EgoyMDI2MDkyMC4wIJJjKgBIAVAD&rclk=1",
    place_id: "ChIJsYzfnUZhz5QRgqjOR0AGs4M",
    cid: "9489935712952166530",
  },
  {
    id: "lead_d310c957-9396-4374-8813-827d484c3fdf",
    name: "Vidraçaria Evolução",
    category: "Vidraçaria",
    address: "Vidraçaria Evolução - Av. Edward Fru Fru Marciano da Silva, 75 - Jardim Sao Guilherme, Sorocaba - SP, 18074-621",
    phone: "(15) 99198-0159",
    website: null,
    rating: null,
    review_count: 123,
    maps_url: "https://www.google.com/maps/place/Vidra%C3%A7aria+Evolu%C3%A7%C3%A3o/data=!4m7!3m6!1s0x94c5f58e76711485:0x450d693ae60f4219!8m2!3d-23.4534789!4d-47.485161!16s%2Fg%2F11p656sjs1!19sChIJhRRxdo71xZQRGUIP5jppDUU?authuser=0&hl=pt-BR&g_ep=EgoyMDI2MDkyMC4wIJJjKgBIAVAD&rclk=1",
    place_id: "ChIJhRRxdo71xZQRGUIP5jppDUU",
    cid: "4975748865003045401",
  },
  {
    id: "lead_00f3da06-3479-4a8d-b2a8-94ba27c67cce",
    name: "Vidraçaria Santos e Furlan",
    category: "Vidraçaria",
    address: "Vidraçaria Santos e Furlan - R. Aristides de Almeida, 113 - Jardim Res. Imperatriz, Sorocaba - SP, 18079-393",
    phone: "(15) 99770-7753",
    website: "https://vidracariasantosefurlan.com.br/",
    rating: null,
    review_count: 68,
    maps_url: "https://www.google.com/maps/place/Vidra%C3%A7aria+Santos+e+Furlan/data=!4m7!3m6!1s0x94c5f55b441cb027:0x1139097fcc7c2666!8m2!3d-23.4276849!4d-47.4595941!16s%2Fg%2F11xdq032vm!19sChIJJ7AcRFv1xZQRZiZ8zH8JORE?authuser=0&hl=pt-BR&g_ep=EgoyMDI2MDkyMC4wIJJjKgBIAVAD&rclk=1",
    place_id: "ChIJJ7AcRFv1xZQRZiZ8zH8JORE",
    cid: "1241033616813467238",
  },
];
