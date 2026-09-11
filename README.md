# MarketMap Dados — Versão Final Gratuita

Aplicação web estática para GitHub Pages que pesquisa negócios locais reais e gera um diagnóstico de presença digital usando dados públicos.

## O que funciona sem API paga

- País, cidade, bairro/região e raio.
- Geocodificação com Nominatim.
- Negócios reais com OpenStreetMap/Overpass.
- Categorias.
- Website quando informado.
- Telefone quando informado.
- Horários quando informados.
- Redes sociais quando informadas nos dados públicos.
- Marketing Score transparente.
- Ranking de oportunidades.
- Dashboard com estatísticas.
- Gráficos sem biblioteca paga.
- Mapa.
- Comparação de até 4 negócios.
- Recomendações automáticas.
- Exportação CSV.
- Cache local de 24h.
- Dark/light mode.
- PWA e Service Worker.
- Layout responsivo para iPhone e desktop.

## Importante sobre “uso ilimitado”

O MarketMap não possui limites próprios, cobranças ou API paga.

Entretanto, Nominatim, Overpass e os tiles do OpenStreetMap são serviços públicos externos e possuem políticas de uso justo. Portanto, nenhum aplicativo que dependa desses servidores públicos pode prometer tráfego realmente ilimitado.

O app usa cache local e múltiplos endpoints Overpass para reduzir requisições e melhorar disponibilidade.

## Estrutura

```text
marketmap-dados/
├── index.html
├── style.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── README.md
└── assets/
    └── icon.svg
```

## Publicar no GitHub Pages

1. Substitua os arquivos do repositório pelos arquivos deste pacote.
2. Em GitHub > Settings > Pages:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)
3. Abra:
   https://darthvagem2.github.io/marketmap-dados/

## Fontes

- OpenStreetMap
- Nominatim
- Overpass API

## Privacidade

As pesquisas são feitas diretamente do navegador para os serviços públicos utilizados. O MarketMap não exige cadastro e não envia os dados para um servidor próprio.

## Limitações de dados

O app não inventa:
- avaliações do Google;
- renda de bairro;
- classe socioeconômica;
- qualidade visual de marca;
- campanhas pagas.

Esses campos exigem fontes específicas e/ou APIs licenciadas.
