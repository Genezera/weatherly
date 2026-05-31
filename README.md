# Weatherly

Dashboard de clima com busca de cidades e previsão de 7 dias usando a API do **Open‑Meteo** (sem chave). Inclui cache local para reduzir requisições e “recentes” para navegação rápida.

## Features

- Busca de cidades com sugestões (geocoding do Open‑Meteo)
- Clima atual + previsão de 7 dias
- Cache em LocalStorage (TTL) para melhorar a performance
- Lista de buscas recentes
- Opção “Minha localização” (Geolocation API)

## Tecnologias

- HTML + CSS
- JavaScript (sem bibliotecas)
- Fetch API + LocalStorage
- Open‑Meteo (Geocoding + Forecast)

## Como rodar

Recomendado rodar com servidor local (por causa de restrições de `fetch` em alguns navegadores quando abre via `file://`):

```bash
python -m http.server 5173
```

Abra: `http://localhost:5173/`

## APIs usadas

- Geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Forecast: `https://api.open-meteo.com/v1/forecast`
