# Relatório PCP - Estoque de Produtos Acabados Spunflex 11/05/2026

## Fechamento executivo
- Linhas lidas na planilha: 374.
- Linhas de produto acabado: 373.
- Linha-resumo identificada: 1 linha com Produto vazio e Estoque KG de 202.573,735 kg (202,574 t).
- Total correto do estoque de produtos: 202.573,735 kg (202,574 t).
- Observação crítica: se a linha-resumo for somada junto com os produtos, o estoque dobra artificialmente para 405,147 t.

## Leitura coluna por coluna
| Coluna | Preenchidas | Distintas | Leitura PCP |
|---|---:|---:|---|
| Produto | 373 | 373 | Código do SKU no ERP; chave primária do item. |
| Estoque KG | 374 | 327 | Volume físico em kg; coluna correta para tonelagem. |
| Descricao | 373 | 358 | Descrição operacional completa do SKU. |
| Comprimento | 373 | 26 | Comprimento nominal da bobina/rolo em metros. |
| Largura | 373 | 67 | Largura em metros; convertida para mm na análise. |
| Gramatura | 373 | 30 | Gramatura em kg/m²; convertida para g/m². |
| Unidade | 373 | 4 | Unidade dimensional da ficha. |
| SiglaUnidade | 373 | 1 | Unidade do estoque; neste arquivo está KG. |
| PesoBruto | 373 | 10 | Peso bruto paramétrico do cadastro. |
| PesoLiquido | 373 | 36 | Peso líquido/gramatura paramétrica. |
| NomeClassifPr1 | 362 | 8 | Macroclassificação comercial/industrial. |
| NomeClassifPr2 | 362 | 13 | Família/linha produtiva: NTEI, NTLD, NTED, TNT etc. |
| NomeClassifPr3 | 362 | 20 | Segmento/uso: colchão, distribuição, moveleiro etc. |
| TipoProduto | 373 | 1 | Código do tipo; todos os itens de produto têm tipo 4. |
| NomeTipoProd | 373 | 1 | Descrição do tipo; confirma PRODUTO ACABADO. |
| Classe | 373 | 3 | Código de classe do ERP. |
| NomeClasProd | 373 | 3 | Classe gerencial: duráveis, higiênicos, medical. |
| NomeGrupProd | 373 | 21 | Cor/família de cor. |
| NomeProduto | 373 | 344 | Nome curto do SKU. |

## Estoque por máquina/corte inferido
Regra usada: TNT/FLEXNTE/BASE VELA em Rebobinadeira; larguras acima de 1400 mm em Corte 2; demais itens em Corte 1.
| Grupo | kg | t | linhas |
|---|---|---|---|
| Corte 1 | 94.345,245 | 94,345 | 194 |
| Corte 2 | 85.153,750 | 85,154 | 92 |
| Rebobinadeira | 23.074,741 | 23,075 | 87 |

## Estoque por linha de produto
| Grupo | kg | t | linhas |
|---|---|---|---|
| NTEI | 66.873,535 | 66,874 | 132 |
| NTLD | 53.850,665 | 53,851 | 43 |
| NTED | 26.442,323 | 26,442 | 52 |
| BASE VELA | 16.988,941 | 16,989 | 29 |
| SEM INFO | 10.825,300 | 10,825 | 11 |
| NTEH SMS | 8.833,770 | 8,834 | 12 |
| NTEM | 8.486,311 | 8,486 | 20 |
| TNT | 5.289,600 | 5,290 | 45 |
| NTEHH SMS | 2.424,000 | 2,424 | 11 |
| NTEH | 1.555,080 | 1,555 | 3 |
| NT | 535,200 | 0,535 | 10 |
| DS | 264,600 | 0,265 | 2 |
| FLEXNTE | 193,000 | 0,193 | 2 |
| SLEI | 11,411 | 0,011 | 1 |

## Estoque por segmento de uso
| Grupo | kg | t | linhas |
|---|---|---|---|
| COLCHÃO | 62.143,069 | 62,143 | 64 |
| DISTRIBUIÇ | 55.080,461 | 55,080 | 102 |
| ESTOFADOS | 16.074,527 | 16,075 | 21 |
| MOVELEIRO | 14.800,408 | 14,800 | 25 |
| SEM INFO | 10.825,300 | 10,825 | 11 |
| MOLA | 8.486,311 | 8,486 | 20 |
| HIGIENICOS | 8.282,280 | 8,282 | 7 |
| VELA | 6.143,800 | 6,144 | 58 |
| INDUSTRIAL | 5.954,441 | 5,954 | 19 |
| TOUCA | 3.380,760 | 3,381 | 4 |
| HOSPITALAR | 2.478,380 | 2,478 | 5 |
| EMBALAGEM | 2.320,500 | 2,321 | 13 |
| MEDICAL | 2.264,000 | 2,264 | 10 |
| DESCARTÁVE | 1.945,860 | 1,946 | 2 |
| FRALDA | 979,890 | 0,980 | 6 |
| CONSTRUÇÃO | 585,600 | 0,586 | 1 |
| AGRICULTUR | 453,350 | 0,453 | 1 |
| AVENTAL | 160,000 | 0,160 | 1 |
| FILTRAÇÃO | 113,400 | 0,113 | 1 |
| PET | 72,000 | 0,072 | 1 |
| VESTUÁRIO | 29,400 | 0,029 | 1 |

## Estoque por cor
| Grupo | kg | t | linhas |
|---|---|---|---|
| BRANCO | 110.174,490 | 110,174 | 161 |
| PRETO | 69.025,993 | 69,026 | 111 |
| LARANJA | 2.972,960 | 2,973 | 9 |
| AZUL MEDICAL | 2.424,000 | 2,424 | 11 |
| AMARELO | 2.338,992 | 2,339 | 8 |
| PINK | 2.171,952 | 2,172 | 6 |
| AZUL MARINHO | 1.686,882 | 1,687 | 5 |
| AZUL BABY | 1.634,880 | 1,635 | 6 |
| BEGE | 1.420,396 | 1,420 | 5 |
| LILÁS | 1.351,544 | 1,352 | 2 |
| MARROM | 1.151,112 | 1,151 | 4 |
| ROSA BABY | 1.077,184 | 1,077 | 5 |
| ROXO | 1.009,440 | 1,009 | 3 |
| AZUL ROYAL | 934,604 | 0,935 | 8 |
| VERDE BANDEIRA | 783,720 | 0,784 | 9 |
| VERMELHO | 672,320 | 0,672 | 6 |
| PRETO BLACK | 488,754 | 0,489 | 4 |
| MARFIM | 424,592 | 0,425 | 3 |
| VIOLETA | 411,600 | 0,412 | 1 |
| BRANCO A4 | 405,720 | 0,406 | 5 |
| VERDE | 12,600 | 0,013 | 1 |

## Estoque por classe
| Grupo | kg | t | linhas |
|---|---|---|---|
| DURÁVEIS | 180.561,065 | 180,561 | 345 |
| HIGIÊNICOS | 19.588,670 | 19,589 | 17 |
| MEDICAL | 2.424,000 | 2,424 | 11 |

## Top larguras
| Grupo | kg | t | linhas |
|---|---|---|---|
| 1400 mm | 63.594,076 | 63,594 | 167 |
| 2100 mm | 31.329,143 | 31,329 | 26 |
| 2200 mm | 19.041,788 | 19,042 | 9 |
| 2000 mm | 17.238,230 | 17,238 | 17 |
| 1000 mm | 11.646,100 | 11,646 | 13 |
| 2300 mm | 6.037,270 | 6,037 | 3 |
| 310 mm | 5.923,170 | 5,923 | 3 |
| 1130 mm | 4.955,818 | 4,956 | 1 |
| 800 mm | 4.622,336 | 4,622 | 9 |
| 2050 mm | 3.276,720 | 3,277 | 4 |
| 1100 mm | 3.016,068 | 3,016 | 7 |
| 1600 mm | 2.741,680 | 2,742 | 12 |
| 450 mm | 2.622,600 | 2,623 | 4 |
| 600 mm | 2.150,886 | 2,151 | 5 |
| 1200 mm | 1.771,560 | 1,772 | 11 |
| 2180 mm | 1.645,490 | 1,645 | 1 |
| 2400 mm | 1.578,600 | 1,579 | 3 |
| 1150 mm | 1.466,250 | 1,466 | 2 |
| 200 mm | 1.430,000 | 1,430 | 2 |
| 350 mm | 1.367,884 | 1,368 | 7 |

## Top gramaturas
| Grupo | kg | t | linhas |
|---|---|---|---|
| 80 g/m² | 40.574,634 | 40,575 | 53 |
| 40 g/m² | 37.904,900 | 37,905 | 89 |
| 60 g/m² | 29.031,004 | 29,031 | 55 |
| 50 g/m² | 15.518,735 | 15,519 | 21 |
| 100 g/m² | 13.423,510 | 13,424 | 22 |
| 12 g/m² | 10.861,835 | 10,862 | 13 |
| 1000 g/m² | 10.757,300 | 10,757 | 10 |
| 70 g/m² | 8.179,188 | 8,179 | 14 |
| 9 g/m² | 7.977,240 | 7,977 | 8 |
| 30 g/m² | 7.072,596 | 7,073 | 15 |
| 15 g/m² | 2.479,428 | 2,479 | 5 |
| 14 g/m² | 2.168,060 | 2,168 | 4 |
| 55 g/m² | 1.939,234 | 1,939 | 4 |
| 10 g/m² | 1.801,152 | 1,801 | 7 |
| 75 g/m² | 1.520,700 | 1,521 | 3 |
| 65 g/m² | 1.473,030 | 1,473 | 2 |
| 35 g/m² | 1.239,350 | 1,239 | 15 |
| 150 g/m² | 1.220,520 | 1,221 | 3 |
| 20 g/m² | 1.211,900 | 1,212 | 7 |
| 25 g/m² | 1.094,850 | 1,095 | 3 |

## Top combinações largura x gramatura
| Grupo | kg | t | linhas |
|---|---|---|---|
| 1400 mm / 40 g/m² | 24.453,788 | 24,454 | 70 |
| 1000 mm / 1000 g/m² | 10.757,300 | 10,757 | 10 |
| 2200 mm / 80 g/m² | 10.615,440 | 10,615 | 2 |
| 1400 mm / 80 g/m² | 10.537,984 | 10,538 | 23 |
| 1400 mm / 60 g/m² | 8.407,023 | 8,407 | 15 |
| 2100 mm / 60 g/m² | 8.226,038 | 8,226 | 6 |
| 2000 mm / 50 g/m² | 7.171,000 | 7,171 | 5 |
| 2100 mm / 80 g/m² | 6.132,728 | 6,133 | 3 |
| 2300 mm / 40 g/m² | 5.916,520 | 5,917 | 1 |
| 310 mm / 9 g/m² | 5.895,270 | 5,895 | 2 |
| 2100 mm / 100 g/m² | 5.045,880 | 5,046 | 2 |
| 1130 mm / 80 g/m² | 4.955,818 | 4,956 | 1 |
| 2100 mm / 12 g/m² | 4.896,385 | 4,896 | 2 |
| 1400 mm / 30 g/m² | 4.327,560 | 4,328 | 8 |
| 2000 mm / 80 g/m² | 4.216,800 | 4,217 | 2 |
| 1400 mm / 100 g/m² | 3.696,680 | 3,697 | 12 |
| 2200 mm / 100 g/m² | 3.620,100 | 3,620 | 1 |
| 2100 mm / 40 g/m² | 3.386,628 | 3,387 | 3 |
| 2050 mm / 60 g/m² | 2.895,420 | 2,895 | 1 |
| 2000 mm / 70 g/m² | 2.632,000 | 2,632 | 3 |

## Top 25 SKUs por kg
| Código | kg | t | Linha | Segmento | Cor | Descrição |
|---|---:|---:|---|---|---|---|
| 5564 | 7.278,480 | 7,278 | NTEI | ESTOFADOS | PRETO | NTEI 2200MM PRETO 80GR 500MT |
| 100 | 6.562,192 | 6,562 | NTLD | DISTRIBUIÇ | BRANCO | NTLD 1400MM BRANCO 80GR 300MT |
| 5541 | 5.916,520 | 5,917 | NTEI | MOVELEIRO | BRANCO | NTEI 2300MM BRANCO 40GR 500MT |
| 6098 | 5.819,940 | 5,820 | NTEH SMS | HIGIENICOS | BRANCO | NTEH SMS 310MM HFL BRANCO 9GR 12000MT |
| 5271 | 5.407,920 | 5,408 | NTLD | COLCHÃO | BRANCO | NTLD 2100MM BRANCO 60GR 350MT |
| 5637 | 4.955,818 | 4,956 | NTEI | ESTOFADOS | BRANCO | NTEI 1130MM BRANCO 80GR 300MT |
| 2170 | 4.929,624 | 4,930 | NTLD | DISTRIBUIÇ | PRETO | NTLD 1400MM PRETO 60GR 350MT |
| 5007 | 4.631,785 | 4,632 | NTLD | COLCHÃO | BRANCO | NTLD 2100MM BRANCO 12GR 2000MT |
| 5277 | 4.281,000 | 4,281 | NTED | COLCHÃO | PRETO | NTED 2000MM PRETO 50GR 500MT |
| 3350 | 3.929,800 | 3,930 | - | - | BRANCO | SSMMSS HYDROPHILIC 9GX780MMX10000M |
| 5274 | 3.651,060 | 3,651 | NTLD | COLCHÃO | PRETO | NTLD 2100MM PRETO 100GR 250MT |
| 5321 | 3.647,200 | 3,647 | NTEI | COLCHÃO | PRETO | NTEI 2000MM PRETO 80GR 300MT |
| 5544 | 3.620,100 | 3,620 | NTLD | COLCHÃO | BRANCO | NTLD 2200MM BRANCO 100GR 250MT |
| 5014 | 3.336,960 | 3,337 | NTED | COLCHÃO | BRANCO | NTED 2200MM BRANCO 80GR 250MT |
| 5105 | 3.219,104 | 3,219 | NTLD | COLCHÃO | PRETO | NTED 2100MM PRETO 80GR 300MT |
| 3351 | 3.000,000 | 3,000 | - | - | BRANCO | SSMMSS HYDROPHILIC 9GX310MMX10000M |
| 354 | 2.922,780 | 2,923 | NTLD | DISTRIBUIÇ | BRANCO | NTLD 1400MM BRANCO 30GR 750MT |
| 5190 | 2.895,420 | 2,895 | NTEI | TOUCA | PRETO | NTEI 2050MM PRETO 60GR 300MT |
| 6094 | 2.871,624 | 2,872 | NTEI | MOVELEIRO | PRETO | NTEI 2100MM PRETO 80GR 250MT |
| 5061 | 2.600,000 | 2,600 | NTED | COLCHÃO | PRETO | NTED 2000MM PRETO 50GR 500MT |
| 2607 | 2.489,916 | 2,490 | BASE VELA | DISTRIBUIÇ | BRANCO | BASE VELA 1400MM BRANCO 40GR 3000MT |
| 5304 | 2.336,928 | 2,337 | NTEI | COLCHÃO | BRANCO | NTEI 2200MM BRANCO 15GR 1000MT |
| 658 | 2.057,280 | 2,057 | NTEI | COLCHÃO | PRETO | NTEI 800MM PRETO 50GR 750MT |
| 3354 | 2.000,000 | 2,000 | - | - | BRANCO | SSMMSS HYDROPHILIC 8GX310MMX10000M |
| 3353 | 1.812,500 | 1,812 | - | - | BRANCO | SSMMSS HYDROPHILIC 8GX780MMX10000M |

## Menores saldos
| Código | kg | Linha | Segmento | Cor | Descrição |
|---|---:|---|---|---|---|
| 3933 | 1,000 | - | - | BRANCO | DURAFLEX -FILME ELÁSTICO, 130 MICRAS, AZUL, LARGURA 0,6M, TERMOSSELADO |
| 3929 | 2,000 | - | - | BRANCO | UNIMAX - TRILAMINADO, 90G, AZUL, LARGURA 2,2M, ABSORVENTE DE ÁGUA. |
| 3930 | 3,000 | - | - | BRANCO | ECOFLEX - BILAMINADO, 40G, AZUL, LARGURA 2,4M, ABSORVENTE DE ÁGUA. |
| 3931 | 3,000 | - | - | BRANCO | COVERPRO - PARA COBERTURA , 68G, AZUL, LARGURA 1,4M, ABSORVENTE DE ÁGUA. |
| 3932 | 3,000 | - | - | BRANCO | COTTONFLEX - SSS, 48G, ROXO, LARGURA 1,6M, REPELENTE À ÁGUA E RESPIRÁVEL. |
| 3934 | 3,000 | - | - | BRANCO | ECODRY - SPUNLACE, 50G, BRANCO, LARGURA 0,4M, ABSORVENTE DE ÁGUA. |
| 3474 | 4,200 | NT | VELA | ROSA BABY | TNT ROSA BABY 40GR |
| 2890 | 8,000 | NT | VELA | VERDE BANDEIRA | FLEXNTE 40GR VERDE 100MT |
| 2953 | 8,960 | BASE VELA | DISTRIBUIÇ | VERMELHO | BASE VELA 1400MM VERMELHO 80GR 1500MT |
| 3345 | 9,600 | TNT | VELA | PINK | TNT PINK 40GR |
| 3659 | 11,200 | BASE VELA | DISTRIBUIÇ | AZUL ROYAL | BASE VELA 1400MM AZUL ROYAL  80GR 1500MT |
| 3024 | 11,411 | SLEI | INDUSTRIAL | PRETO | SLEI 1400MM PRETO 57GR 250MT |
| 3383 | 12,000 | TNT | VELA | AZUL ROYAL | TNT AZUL ROYAL 40GR |
| 2709 | 12,250 | NTED | DISTRIBUIÇ | BRANCO | NTED 350MM BRANCO 35GR 500MT |
| 3399 | 12,600 | NTEH | HIGIENICOS | VERDE | DS NTEH 100MM VERDE 10GR 10000MT |

## Diagnóstico de diretor de produção / PCP
- O estoque está concentrado em poucas famílias: NTEI, NTLD e NTED somam mais da metade do volume acabado.
- Corte 1 carrega o maior saldo físico, mas Corte 2 também tem peso relevante; a programação deve separar giro comercial por largura antes de liberar nova produção.
- Colchão e Distribuição são os maiores segmentos; qualquer parada de carteira nesses segmentos pode imobilizar muito capital rapidamente.
- Branco e Preto dominam o estoque. Cores especiais aparecem pulverizadas em muitos SKUs pequenos, exigindo política clara de venda/queima ou produção sob pedido.
- Existem 11 linhas sem classificação de família e 11 sem segmento, somando 10,825 t. Para PCP isso é risco de cadastro: esses itens devem ser revisados antes de decisões de produção e venda.
