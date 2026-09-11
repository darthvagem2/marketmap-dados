# MarketMap Global

Dashboard web para pesquisar negócios locais e analisar oportunidades de marketing em bairros/regiões.

## O que já funciona

- Seleção de país, cidade, bairro/região e perfil socioeconômico.
- Modo demonstração com todas as métricas.
- Modo real usando Nominatim + OpenStreetMap + Overpass API.
- Mapa interativo com Leaflet.
- Score de marketing.
- Filtros e ordenação.
- Ranking e comparação de até 4 negócios.
- Recomendações automáticas.
- Exportação CSV.
- Layout responsivo/mobile.

## Como abrir

Você pode abrir `index.html` diretamente ou servir a pasta com um servidor local:

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

> Para a busca real, é melhor usar um servidor local ou hospedar no GitHub Pages, pois alguns navegadores restringem requisições quando o HTML é aberto diretamente via `file://`.

## Publicação gratuita no GitHub Pages

1. Crie um repositório.
2. Envie `index.html`, `style.css` e `app.js` para a raiz.
3. Em **Settings > Pages**, escolha **Deploy from a branch**.
4. Selecione a branch `main` e pasta `/ (root)`.
5. Salve.

## Fontes de dados

### Busca real incluída
- Nominatim / OpenStreetMap: geocodificação.
- Overpass API: estabelecimentos e tags públicas.
- Leaflet + OpenStreetMap: mapa.

### Limitações importantes
OpenStreetMap normalmente não fornece:
- nota e volume de avaliações;
- tráfego/anúncios pagos;
- consistência visual da marca;
- qualidade editorial das redes sociais.

Por isso, no modo real esses campos aparecem como **N/D** quando não há fonte confiável. O site não inventa dados.

## Como deixar a análise completa

Para produção, conecte um backend/coletor que enriqueça os negócios com fontes permitidas/licenciadas:

- Google Places API ou outra fonte de avaliações;
- PageSpeed Insights API para qualidade técnica do site;
- coleta permitida de links sociais publicados no site/ficha;
- análise visual de logo, cores e consistência;
- dados oficiais de renda/censo por país para validar a faixa socioeconômica dos bairros.

A recomendação é fazer esse enriquecimento em Python/Node no backend e entregar ao frontend um JSON padronizado.

## Estrutura esperada do JSON enriquecido

```json
{
  "id": "business-123",
  "name": "Exemplo",
  "category": "Alimentação",
  "country": "Brasil",
  "city": "São Paulo",
  "neighborhood": "Capão Redondo",
  "lat": -23.65,
  "lng": -46.76,
  "website": true,
  "social": 72,
  "reviews": 4.6,
  "reviewCount": 215,
  "brand": 65,
  "promotions": 48,
  "online": 81,
  "score": 68
}
```

## Score

A metodologia visual do dashboard usa:
- Presença online: 25%
- Redes sociais: 20%
- Site próprio: 20%
- Avaliações: 15%
- Consistência visual: 10%
- Promoções/anúncios: 10%

No modo real OSM, o score é recalculado apenas com dimensões disponíveis e normalizado, para não penalizar um negócio por dados que a fonte não fornece.
