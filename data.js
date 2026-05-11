window.SpunflexData = {
  baseDate: "2026-05-04",
  company: "Spunflex",
  sources: [
    {
      id: "src-2026-jan-abr-grafico",
      file: "WhatsApp Image 2026-05-04 at 17.54.52.jpeg",
      title: "2026 por mês - peso e faturamento",
      type: "Gráfico dinâmico",
      reviewed: true,
      extracted: [
        "Jan a abr/2026: peso mensal de 351.033 kg a 424.143 kg.",
        "Jan a abr/2026: faturamento mensal de R$ 4,747 mi a R$ 7,034 mi.",
        "Abril/2026 aparece como melhor mês do período no gráfico."
      ]
    },
    {
      id: "src-historico-anos",
      file: "WhatsApp Image 2026-05-04 at 17.55.16.jpeg",
      title: "Histórico mensal 2023-2026",
      type: "Tabela dinâmica",
      reviewed: true,
      extracted: [
        "Histórico de peso e reais por mês entre 2023 e 2026.",
        "Total 2025: 3.759.547 kg e R$ 52.243.716.",
        "Total parcial 2026: 1.493.051 kg e R$ 21.614.119."
      ]
    },
    {
      id: "src-ranking-abril",
      file: "WhatsApp Image 2026-05-04 at 17.56.48.jpeg",
      title: "Ranking de representantes - abril/2026",
      type: "Tabela por representante",
      reviewed: true,
      extracted: [
        "Ranking de abril/2026 por peso e por reais.",
        "Total por representantes: 437.798 kg e R$ 7.033.509.",
        "Maior representante por valor e peso: RC Montemezzo MGA PR."
      ]
    },
    {
      id: "src-entradas-mensais",
      file: "WhatsApp Image 2026-05-04 at 17.57.47.jpeg",
      title: "Entradas mensais 2026",
      type: "Tabela de entrada",
      reviewed: true,
      extracted: [
        "Entradas por data de entrada em jan-abr/2026.",
        "Total parcial: 1.516.332,75 kg e R$ 22.872.546,39.",
        "Abril/2026: 355.432,93 kg e R$ 6.711.672,28."
      ]
    },
    {
      id: "src-entradas-diarias-abril",
      file: "WhatsApp Image 2026-05-04 at 17.58.34.jpeg",
      title: "Entradas diárias - abril/2026",
      type: "Tabela diária por corte",
      reviewed: true,
      extracted: [
        "Entradas de abril por dia, Corte 1, Corte 2 e Rebo.",
        "Média informada: 18.707 kg/dia e R$ 353.246/dia.",
        "Preço médio informado em abril: R$ 18,88/kg."
      ]
    },
    {
      id: "src-faturamento-maio-ate-05",
      file: "faturamento até 05:05.jpeg",
      title: "Faturamento maio/2026 até 05/05",
      type: "Tabela de faturamento parcial",
      reviewed: true,
      extracted: [
        "Filtro de data: 01/05/2026 a 05/05/2026.",
        "Total faturado parcial: R$ 501.050,03.",
        "Peso faturado parcial: 26.160,35 kg."
      ]
    },
    {
      id: "src-pedidos-maio-05",
      file: "entrada de pedidos em 05:05.jpeg",
      title: "Entrada de pedidos - 05/05/2026",
      type: "Tabela de pedidos",
      reviewed: true,
      extracted: [
        "DataPedido exibida nas linhas: 05/05/2026.",
        "Total de pedidos no rodapé: R$ 73.188,14.",
        "Peso total no rodapé: 3.474,02 kg."
      ]
    },
    {
      id: "src-nf-vendas-finalidade-05-06",
      file: "NF Vendas por Finalidade 05.05 e 06.05 - joao.xlsx",
      title: "NF Vendas por Finalidade - 05 e 06/05/2026",
      type: "Planilha de notas fiscais",
      reviewed: true,
      extracted: [
        "8 NFs emitidas (8808-8814 e 8816), 28 linhas de itens.",
        "05/05/2026: 6.947,89 kg e R$ 101.439,22 em 2 NFs (Ferguile e J J Silk).",
        "06/05/2026: 5.119,00 kg e R$ 100.193,27 em 6 NFs (Passalacqua, Eurosono, Prime Lonas).",
        "Total 05-06/05: 12.066,89 kg e R$ 201.632,49 (preço médio R$ 16,71/kg)."
      ]
    },
    {
      id: "src-nf-faturamento-07",
      file: "fat 07:05.xlsx",
      title: "NF Vendas por Finalidade - 07/05/2026",
      type: "Planilha de notas fiscais",
      reviewed: true,
      extracted: [
        "3 NFs emitidas (8817, 8818, 8819), 4 linhas de itens.",
        "07/05/2026: 2.944,49 kg e R$ 52.687,93 (preço médio R$ 17,89/kg).",
        "Representantes: RC RICARDO ALMEID SP (R$ 25.601,18), VENDA INTERNA 5 (R$ 27.086,75)."
      ]
    }
  ],
  currentMayBilling2026: {
    startDate: "2026-05-01",
    endDate: "2026-05-07",
    weightKg: 34223.84,
    quantity: 751020.85,
    revenue: 653931.23,
    avgPrice: 19.1077,
    sourceId: "src-faturamento-maio-ate-05",
    breakdown: [
      { range: "01/05 a 05/05", weightKg: 26160.35, revenue: 501050.03 },
      { range: "06/05",          weightKg: 5119.00,  revenue: 100193.27 },
      { range: "07/05",          weightKg: 2944.49,  revenue: 52687.93  }
    ]
  },
  mayInvoices2026: {
    period: { startDate: "2026-05-05", endDate: "2026-05-07" },
    sourceId: "src-nf-vendas-finalidade-05-06",
    totals: {
      weightKg: 15011.38,
      revenue: 254320.42,
      avgPrice: 16.9418,
      invoiceCount: 11,
      lineCount: 32
    },
    daily: [
      {
        date: "2026-05-05",
        weightKg: 6947.89,
        revenue: 101439.22,
        avgPrice: 14.5999,
        invoiceCount: 2,
        lineCount: 6,
        notes: ["8808", "8809"]
      },
      {
        date: "2026-05-06",
        weightKg: 5119.00,
        revenue: 100193.27,
        avgPrice: 19.5728,
        invoiceCount: 6,
        lineCount: 22,
        notes: ["8810", "8811", "8812", "8813", "8814", "8816"]
      },
      {
        date: "2026-05-07",
        weightKg: 2944.49,
        revenue: 52687.93,
        avgPrice: 17.8939,
        invoiceCount: 3,
        lineCount: 4,
        notes: ["8817", "8818", "8819"]
      }
    ],
    invoices: [
      { number: "8808", date: "2026-05-05", client: "FERGUILE ESTOFADOS",       city: "Arapongas",         state: "PR", representative: "RC MONTEMEZZO MGA PR", machines: ["Corte 1"],            weightKg: 4151.95, revenue: 60618.50 },
      { number: "8809", date: "2026-05-05", client: "J J SILK S EMBALAGENS",    city: "Jaú",               state: "SP", representative: "VENDA INTERNA",        machines: ["Corte 1", "Corte 2"], weightKg: 2795.94, revenue: 40820.72 },
      { number: "8810", date: "2026-05-06", client: "PRIME LONAS COMERCIO",     city: "Curitiba",          state: "PR", representative: "VENDA INT ADRIANA",    machines: ["Rebobinadeira"],      weightKg: 250.00,  revenue: 6971.88  },
      { number: "8811", date: "2026-05-06", client: "PASSALACQUA & CIA",        city: "Franca",            state: "SP", representative: "RC DANILO VOTU SP",    machines: ["Corte 1"],            weightKg: 176.40,  revenue: 3510.36  },
      { number: "8812", date: "2026-05-06", client: "PASSALACQUA & CIA",        city: "Londrina",          state: "PR", representative: "RC DANILO VOTU SP",    machines: ["Corte 1"],            weightKg: 517.10,  revenue: 10290.37 },
      { number: "8813", date: "2026-05-06", client: "PASSALACQUA CIA SP",       city: "Ribeirão Preto",    state: "SP", representative: "RC DANILO VOTU SP",    machines: ["Corte 1"],            weightKg: 1701.00, revenue: 33849.90 },
      { number: "8814", date: "2026-05-06", client: "PASSALACQUA CIA MG",       city: "Belo Horizonte",    state: "MG", representative: "RC DANILO VOTU SP",    machines: ["Corte 1"],            weightKg: 884.80,  revenue: 17607.52 },
      { number: "8816", date: "2026-05-06", client: "EUROSONO",                 city: "Rio Preto Da Eva",  state: "AM", representative: "RC ANDRÉ ALVARENGA",   machines: ["Corte 2"],            weightKg: 1589.70, revenue: 27963.24 },
      { number: "8817", date: "2026-05-07", client: "DTEC REVESTIMENTOS",       city: "Curitiba",          state: "PR", representative: "VENDA INTERNA 5",      machines: ["Corte 1"],            weightKg: 291.21,  revenue: 6790.95  },
      { number: "8818", date: "2026-05-07", client: "RI INDUSTRIA ARTEFATOS",   city: "São Paulo",         state: "SP", representative: "RC RICARDO ALMEID SP", machines: ["Corte 1"],            weightKg: 1673.28, revenue: 25601.18 },
      { number: "8819", date: "2026-05-07", client: "JJSAF",                    city: "Pinhais",           state: "PR", representative: "VENDA INTERNA 5",      machines: ["Corte 1"],            weightKg: 980.00,  revenue: 20295.80 }
    ],
    representatives: [
      { name: "RC DANILO VOTU SP",     weightKg: 3279.30, revenue: 65258.15, invoiceCount: 4 },
      { name: "RC MONTEMEZZO MGA PR",  weightKg: 4151.95, revenue: 60618.50, invoiceCount: 1 },
      { name: "VENDA INTERNA",         weightKg: 2795.94, revenue: 40820.72, invoiceCount: 1 },
      { name: "RC ANDRÉ ALVARENGA",    weightKg: 1589.70, revenue: 27963.24, invoiceCount: 1 },
      { name: "VENDA INTERNA 5",       weightKg: 1271.21, revenue: 27086.75, invoiceCount: 2 },
      { name: "RC RICARDO ALMEID SP", weightKg: 1673.28, revenue: 25601.18, invoiceCount: 1 },
      { name: "VENDA INT ADRIANA",     weightKg: 250.00,  revenue: 6971.88,  invoiceCount: 1 }
    ],
    machines: [
      { name: "Corte 1",       weightKg: 12233.44, revenue: 205698.58 },
      { name: "Corte 2",       weightKg: 2527.94,  revenue: 41649.96 },
      { name: "Rebobinadeira", weightKg: 250.00,   revenue: 6971.88 }
    ]
  },
  currentMayOrders2026: {
    date: "2026-05-05",
    weightKg: 3474.02,
    merchandiseValue: 73188.14,
    avgPrice: 21.066,
    status: "Pedidos cadastrados em 05/05/2026",
    sourceId: "src-pedidos-maio-05"
  },

  // -------------- ENTRADA DIÁRIA DE PEDIDOS (VENDAS) --------------
  // Cada item representa o total de pedidos capturados num dia.
  // Por enquanto temos apenas 05/05/2026; o admin pode adicionar mais
  // dias pela própria página Vendas (persistido no localStorage).
  dailyOrders2026: [
    {
      date: "2026-05-05",
      weightKg: 3474.02,
      revenue: 73188.14,
      avgPrice: 21.066,
      orderCount: null, // Quantidade de pedidos no dia (se disponível)
      notes: "Pedidos cadastrados em 05/05/2026",
      sourceId: "src-pedidos-maio-05"
    }
  ],
  monthlySales: [
    { year: 2023, month: 1, weightKg: 120178, revenue: 1890629 },
    { year: 2023, month: 2, weightKg: 106717, revenue: 1660497 },
    { year: 2023, month: 3, weightKg: 113113, revenue: 1751372 },
    { year: 2023, month: 4, weightKg: 130181, revenue: 1855031 },
    { year: 2023, month: 5, weightKg: 151062, revenue: 2163259 },
    { year: 2023, month: 6, weightKg: 192037, revenue: 2622720 },
    { year: 2023, month: 7, weightKg: 252399, revenue: 3702086 },
    { year: 2023, month: 8, weightKg: 232718, revenue: 3166366 },
    { year: 2023, month: 9, weightKg: 288036, revenue: 2401967 },
    { year: 2023, month: 10, weightKg: 236189, revenue: 3090041 },
    { year: 2023, month: 11, weightKg: 277715, revenue: 3653583 },
    { year: 2023, month: 12, weightKg: 223574, revenue: 3149428 },
    { year: 2024, month: 1, weightKg: 199030, revenue: 2678648 },
    { year: 2024, month: 2, weightKg: 248918, revenue: 3298480 },
    { year: 2024, month: 3, weightKg: 256989, revenue: 3783797 },
    { year: 2024, month: 4, weightKg: 285895, revenue: 3686605 },
    { year: 2024, month: 5, weightKg: 206971, revenue: 2726376 },
    { year: 2024, month: 6, weightKg: 249315, revenue: 3236732 },
    { year: 2024, month: 7, weightKg: 332029, revenue: 4266554 },
    { year: 2024, month: 8, weightKg: 353177, revenue: 4571029 },
    { year: 2024, month: 9, weightKg: 386660, revenue: 5491807 },
    { year: 2024, month: 10, weightKg: 403302, revenue: 5790530 },
    { year: 2024, month: 11, weightKg: 384525, revenue: 5405452 },
    { year: 2024, month: 12, weightKg: 226433, revenue: 3262911 },
    { year: 2025, month: 1, weightKg: 264639, revenue: 3892684 },
    { year: 2025, month: 2, weightKg: 333301, revenue: 4857031 },
    { year: 2025, month: 3, weightKg: 174405, revenue: 2593548 },
    { year: 2025, month: 4, weightKg: 286952, revenue: 4062163 },
    { year: 2025, month: 5, weightKg: 315018, revenue: 4457198 },
    { year: 2025, month: 6, weightKg: 284857, revenue: 3988245 },
    { year: 2025, month: 7, weightKg: 354881, revenue: 4908298 },
    { year: 2025, month: 8, weightKg: 394284, revenue: 5388024 },
    { year: 2025, month: 9, weightKg: 295778, revenue: 4024630 },
    { year: 2025, month: 10, weightKg: 408477, revenue: 5494282 },
    { year: 2025, month: 11, weightKg: 378340, revenue: 5008019 },
    { year: 2025, month: 12, weightKg: 268615, revenue: 3569595 },
    { year: 2026, month: 1, weightKg: 351033, revenue: 4747515.48 },
    { year: 2026, month: 2, weightKg: 353719, revenue: 4789003.46 },
    { year: 2026, month: 3, weightKg: 364156, revenue: 5044090.44 },
    { year: 2026, month: 4, weightKg: 424143, revenue: 7033509.12 },
    { year: 2026, month: 5, weightKg: 34223.84, revenue: 653931.23, partial: true, partialThrough: "2026-05-07" }
  ],
  representativesApril2026: [
    { name: "RC MONTEMEZZO MGA PR", weightKg: 100184, revenue: 1425033 },
    { name: "RC SINESIO", weightKg: 63969, revenue: 1079286 },
    { name: "VENDA DIRETA", weightKg: 60219, revenue: 903088 },
    { name: "VENDA INTERNA 5", weightKg: 41535, revenue: 720445 },
    { name: "RC LASALVIA PE/PB", weightKg: 28293, revenue: 362718 },
    { name: "VENDA INTERNA", weightKg: 25312, revenue: 438139 },
    { name: "RC SIMAN RJ", weightKg: 23557, revenue: 380784 },
    { name: "RC JULIO LAMARCA", weightKg: 19003, revenue: 330400 },
    { name: "RC CHRISTIAN COMPANY", weightKg: 16467, revenue: 366042 },
    { name: "RC CESAR PABLOS", weightKg: 15772, revenue: 294524 },
    { name: "RC ANDRÉ ALVARENGA", weightKg: 13942, revenue: 230939 },
    { name: "RC RICARDO ALMEID SP", weightKg: 9484, revenue: 144848 },
    { name: "VENDA INT ADRIANA", weightKg: 7235, revenue: 131139 },
    { name: "RC MS SALV. BA", weightKg: 5330, revenue: 86298 },
    { name: "RC RAFAEL PR SC OEST", weightKg: 4835, revenue: 93013 },
    { name: "RC DANILO VOTU SP", weightKg: 1182, revenue: 17194 },
    { name: "RC FRANCISCO RN", weightKg: 1107, revenue: 21630 },
    { name: "RC JOSÉ CARLOS", weightKg: 372, revenue: 7990 }
  ],
  representativesApril2026Totals: {
    weightKg: 437798,
    revenue: 7033509,
    roundedLineRevenue: 7033510
  },
  monthlyEntries2026: [
    { month: 1, weightKg: 378756.07, merchandiseValue: 5071086.33 },
    { month: 2, weightKg: 245442.9, merchandiseValue: 3326612.78 },
    { month: 3, weightKg: 536700.86, merchandiseValue: 7763175 },
    { month: 4, weightKg: 355432.93, merchandiseValue: 6711672.28 }
  ],
  dailyEntriesApril2026: [
    { date: "2026-04-01", corte1Kg: 2240, corte2Kg: 8240, reboKg: 0, totalKg: 10480, corte1Value: 37027.2, corte2Value: 132794, reboValue: 0, totalValue: 169821.2, avgPrice: 16.2 },
    { date: "2026-04-02", corte1Kg: 2166, corte2Kg: 2591, reboKg: 0, totalKg: 4757, corte1Value: 37254, corte2Value: 40046.48, reboValue: 0, totalValue: 77300.48, avgPrice: 16.25 },
    { date: "2026-04-06", corte1Kg: 2320, corte2Kg: 373, reboKg: 0, totalKg: 2693, corte1Value: 47740.03, corte2Value: 7796.1, reboValue: 0, totalValue: 55536.13, avgPrice: 20.63 },
    { date: "2026-04-07", corte1Kg: 15853, corte2Kg: 9991, reboKg: 1260, totalKg: 27104, corte1Value: 289132.1, corte2Value: 176689.83, reboValue: 28073.25, totalValue: 493895.18, avgPrice: 18.22 },
    { date: "2026-04-08", corte1Kg: 19483, corte2Kg: 13022, reboKg: 0, totalKg: 32505, corte1Value: 348247.83, corte2Value: 194117.84, reboValue: 0, totalValue: 542365.67, avgPrice: 16.69 },
    { date: "2026-04-09", corte1Kg: 1835, corte2Kg: 7727, reboKg: 0, totalKg: 9562, corte1Value: 39710.58, corte2Value: 148544.22, reboValue: 0, totalValue: 188254.8, avgPrice: 19.69 },
    { date: "2026-04-10", corte1Kg: 10882, corte2Kg: 3798, reboKg: 45, totalKg: 14725, corte1Value: 218407.97, corte2Value: 77465, reboValue: 972.16, totalValue: 296845.13, avgPrice: 20.16 },
    { date: "2026-04-13", corte1Kg: 7318, corte2Kg: 16845, reboKg: 190, totalKg: 24353, corte1Value: 139028.77, corte2Value: 326298.1, reboValue: 4303.04, totalValue: 469629.91, avgPrice: 19.28 },
    { date: "2026-04-14", corte1Kg: 6666, corte2Kg: 789, reboKg: 0, totalKg: 7455, corte1Value: 131708.78, corte2Value: 14991, reboValue: 0, totalValue: 146699.78, avgPrice: 19.68 },
    { date: "2026-04-15", corte1Kg: 16588, corte2Kg: 7223, reboKg: 0, totalKg: 23810, corte1Value: 313015.68, corte2Value: 170326.49, reboValue: 0, totalValue: 483342.17, avgPrice: 20.3 },
    { date: "2026-04-16", corte1Kg: 0, corte2Kg: 22160, reboKg: 0, totalKg: 22160, corte1Value: 0, corte2Value: 398552.71, reboValue: 0, totalValue: 398552.71, avgPrice: 17.99 },
    { date: "2026-04-17", corte1Kg: 4287, corte2Kg: 58062, reboKg: 0, totalKg: 62349, corte1Value: 87286.26, corte2Value: 1105228.11, reboValue: 0, totalValue: 1192514.37, avgPrice: 19.13 },
    { date: "2026-04-22", corte1Kg: 1506, corte2Kg: 24172, reboKg: 0, totalKg: 25678, corte1Value: 32604.9, corte2Value: 397684.93, reboValue: 0, totalValue: 430289.83, avgPrice: 16.76 },
    { date: "2026-04-23", corte1Kg: 3824, corte2Kg: 18, reboKg: 0, totalKg: 3842, corte1Value: 71156.4, corte2Value: 405, reboValue: 0, totalValue: 71561.4, avgPrice: 18.63 },
    { date: "2026-04-24", corte1Kg: 1646, corte2Kg: 4538, reboKg: 0, totalKg: 6184, corte1Value: 37290.96, corte2Value: 84544.38, reboValue: 0, totalValue: 121835.34, avgPrice: 19.7 },
    { date: "2026-04-27", corte1Kg: 5362, corte2Kg: 16682, reboKg: 0, totalKg: 22044, corte1Value: 118575.24, corte2Value: 350541.56, reboValue: 0, totalValue: 469116.8, avgPrice: 21.28 },
    { date: "2026-04-28", corte1Kg: 1765, corte2Kg: 3197, reboKg: 0, totalKg: 4963, corte1Value: 37646.97, corte2Value: 68893.17, reboValue: 0, totalValue: 106540.14, avgPrice: 21.47 },
    { date: "2026-04-29", corte1Kg: 7904, corte2Kg: 30488, reboKg: 1722, totalKg: 40113, corte1Value: 160602.47, corte2Value: 560539.35, reboValue: 34301.63, totalValue: 755443.45, avgPrice: 18.83 },
    { date: "2026-04-30", corte1Kg: 4458, corte2Kg: 6198, reboKg: 0, totalKg: 10656, corte1Value: 97852.76, corte2Value: 144275.03, reboValue: 0, totalValue: 242127.79, avgPrice: 22.72 }
  ],
  dailyEntriesApril2026Totals: {
    corte1Kg: 116103,
    corte2Kg: 236113,
    reboKg: 3217,
    totalKg: 355433,
    corte1Value: 2244288.9,
    corte2Value: 4399733.3,
    reboValue: 67650.08,
    totalValue: 6711672.28
  },
  auditNotes: [
    {
      title: "Abril tem três totais de peso nas imagens",
      detail: "A visão mensal de faturamento mostra 424.143 kg em abr/2026; o ranking de representantes soma 437.798 kg; a visão de entradas soma 355.432,93 kg. O sistema mantém cada base separada para preservar a rastreabilidade."
    },
    {
      title: "Faturamento de abril é consistente entre as bases comerciais",
      detail: "O gráfico mensal e o ranking de representantes indicam R$ 7.033.509 em abr/2026; a imagem do gráfico detalha R$ 7.033.509,12."
    },
    {
      title: "Entradas não equivalem automaticamente a vendas/faturamento",
      detail: "As imagens de entrada usam data de entrada e ValorMercadoria; as imagens comerciais usam DataEmissao e faturamento. Elas aparecem como módulos relacionados, mas não como a mesma métrica."
    },
    {
      title: "Valores antigos foram transcritos sem centavos",
      detail: "A tabela histórica de 2023 a 2025 mostra reais arredondados. Para jan-abr/2026, os centavos vieram do gráfico específico de 2026 e das entradas diárias."
    },
    {
      title: "Fechamentos oficiais preservados",
      detail: "No ranking de representantes, as linhas arredondadas somam R$ 7.033.510, enquanto o total da fonte é R$ 7.033.509. Nas entradas diárias, alguns componentes arredondados também variam 1 kg; o rodapé usa o fechamento exibido na imagem."
    },
    {
      title: "Maio/2026 entrou como parcial",
      detail: "A imagem de faturamento até 05/05/2026 soma R$ 501.050,03 e 26.160,35 kg. O sistema mantém esse dado separado do histórico mensal fechado para não distorcer projeções anuais."
    },
    {
      title: "Pedidos de maio separados do faturamento",
      detail: "A imagem de entrada de pedidos em 05/05/2026 soma R$ 73.188,14 e 3.474,02 kg. O sistema trata esse dado como carteira captada do dia, separado do faturamento por DataEmissao."
    }
  ],

  // -------------- PRODUTOS / MIX (derivado das NFs 05-07/05) --------------
  productMix2026: {
    period: { startDate: "2026-05-05", endDate: "2026-05-07" },
    items: [
      { description: "NTLD 1400MM PRETO 60GR 350MT",   line: "NTLD", width: 1400, color: "PRETO",          grammage: 60,  weightKg: 3310.10, revenue: 48730.87, pricePerKg: 14.72 },
      { description: "NTLD 1400MM PRETO 40GR 350MT",   line: "NTLD", width: 1400, color: "PRETO",          grammage: 40,  weightKg: 1509.20, revenue: 30033.08, pricePerKg: 19.90 },
      { description: "NTLD 1400MM PRETO 120GR 200MT",  line: "NTLD", width: 1400, color: "PRETO",          grammage: 120, weightKg: 1512.00, revenue: 22663.20, pricePerKg: 14.99 },
      { description: "NTEI 1400MM BRANCO A4 40GR 2500MT", line: "NTEI", width: 1400, color: "BRANCO",       grammage: 40,  weightKg: 980.00,  revenue: 20295.80, pricePerKg: 20.71 },
      { description: "NTED 1400MM PRETO 45GR 1000MT",  line: "NTED", width: 1400, color: "PRETO",          grammage: 45,  weightKg: 1260.00, revenue: 18396.00, pricePerKg: 14.60 },
      { description: "NTLD 1400MM BRANCO 60GR 350MT",  line: "NTLD", width: 1400, color: "BRANCO",         grammage: 60,  weightKg: 848.40,  revenue: 16883.16, pricePerKg: 19.90 },
      { description: "NTLD 2100MM PRETO 100GR 250MT",  line: "NTLD", width: 2100, color: "PRETO",          grammage: 100, weightKg: 833.70,  revenue: 14664.78, pricePerKg: 17.59 },
      { description: "NTLD 1400MM BRANCO 40GR 350MT",  line: "NTLD", width: 1400, color: "BRANCO",         grammage: 40,  weightKg: 705.60,  revenue: 14041.44, pricePerKg: 19.90 },
      { description: "NTED 420MM PRETO 45GR 2000MT",   line: "NTED", width: 420,  color: "PRETO",          grammage: 45,  weightKg: 937.44,  revenue: 13686.62, pricePerKg: 14.60 },
      { description: "NTLD 1400MM BRANCO 120GR 200MT", line: "NTLD", width: 1400, color: "BRANCO",         grammage: 120, weightKg: 833.28,  revenue: 12749.18, pricePerKg: 15.30 },
      { description: "NTED 2100MM PRETO 40GR 500MT",   line: "NTED", width: 2100, color: "PRETO",          grammage: 40,  weightKg: 504.00,  revenue: 8865.36,  pricePerKg: 17.59 },
      { description: "NTEI 280MM PRETO 45GR 2000MT",   line: "NTEI", width: 280,  color: "PRETO",          grammage: 45,  weightKg: 598.50,  revenue: 8738.10,  pricePerKg: 14.60 },
      { description: "NTEI 1400MM PRETO 35GR 1000MT",  line: "NTEI", width: 1400, color: "PRETO",          grammage: 35,  weightKg: 291.21,  revenue: 6790.95,  pricePerKg: 23.32 },
      { description: "NTLD 2100MM BRANCO 12GR 2000MT", line: "NTLD", width: 2100, color: "BRANCO",         grammage: 12,  weightKg: 252.00,  revenue: 4433.10,  pricePerKg: 17.59 },
      { description: "NTLD 1400MM BRANCO 30GR 750MT",  line: "NTLD", width: 1400, color: "BRANCO",         grammage: 30,  weightKg: 245.95,  revenue: 3590.90,  pricePerKg: 14.60 },
      { description: "NTLD 1400MM PRETO 100GR 200MT",  line: "NTLD", width: 1400, color: "PRETO",          grammage: 100, weightKg: 140.00,  revenue: 2786.00,  pricePerKg: 19.90 },
      { description: "TNT MARROM 40GR",                line: "TNT",  width: 1400, color: "MARROM",         grammage: 40,  weightKg: 60.00,   revenue: 1673.25,  pricePerKg: 27.89 },
      { description: "TNT AZUL BABY 40GR",             line: "TNT",  width: 1400, color: "AZUL BABY",      grammage: 40,  weightKg: 60.00,   revenue: 1673.25,  pricePerKg: 27.89 },
      { description: "TNT VERDE BANDEIRA 40GR",        line: "TNT",  width: 1400, color: "VERDE BANDEIRA", grammage: 40,  weightKg: 50.00,   revenue: 1394.38,  pricePerKg: 27.89 },
      { description: "TNT PRETO 40GR",                 line: "TNT",  width: 1400, color: "PRETO",          grammage: 40,  weightKg: 42.00,   revenue: 1171.27,  pricePerKg: 27.89 },
      { description: "TNT PINK 40GR",                  line: "TNT",  width: 1400, color: "PINK",           grammage: 40,  weightKg: 28.00,   revenue: 780.85,   pricePerKg: 27.89 },
      { description: "TNT AZUL ROYAL 40GR",            line: "TNT",  width: 1400, color: "AZUL ROYAL",     grammage: 40,  weightKg: 10.00,   revenue: 278.88,   pricePerKg: 27.89 }
    ]
  },

  // -------------- AGRUPAMENTO ECONÔMICO DE CLIENTES --------------
  // Mapeia razões sociais para um grupo único (mesmo CNPJ raiz).
  customerGroups: {
    "PASSALACQUA & CIA": "Grupo Passalacqua",
    "PASSALACQUA CIA SP": "Grupo Passalacqua",
    "PASSALACQUA CIA MG": "Grupo Passalacqua"
  },

  // -------------- CONFIGURAÇÃO OPERACIONAL PADRÃO --------------
  // Valores iniciais; o admin pode editar pela aba Configurações
  // e a alteração é persistida em localStorage.
  defaultConfig: {
    costPerKg: 12.50,              // R$/kg de custo médio estimado da matéria-prima + produção
    fixedCostMonthly: 1800000,     // R$/mês de custo fixo da operação (estimativa inicial)
    commissionPercent: 0.05,       // 5% comissão padrão sobre representante externo
    machineCapacityKg: {
      "Corte 1": 200000,           // capacidade nominal kg/mês
      "Corte 2": 300000,
      "Rebobinadeira": 50000
    },
    monthlyTargetKg: 450000,       // meta mensal padrão
    monthlyTargetRevenue: 8000000, // meta mensal padrão de faturamento (acima do recorde de abril)
    abcThresholds: { a: 0.50, b: 0.80 } // 50% Top = A; até 80% = B; restante = C
  }
};
