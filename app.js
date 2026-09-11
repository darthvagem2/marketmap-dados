(() => {
  "use strict";

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  const state = {
    businesses: [],
    filtered: [],
    compare: [],
    map: null,
    markers: [],
    center: null,
    lastQuery: null,
  };

  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter"
  ];

  const CATEGORY_LABELS = {
    food: "Alimentação",
    retail: "Varejo",
    beauty: "Beleza",
    health: "Saúde",
    education: "Educação",
    services: "Serviços",
  };

  const esc = (value="") => String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

  function toast(message, type="") {
    const el = document.createElement("div");
    el.className = `toast ${type}`.trim();
    el.textContent = message;
    $("#toastStack").appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function setLoading(on) {
    $("#searchBtn").classList.toggle("loading", on);
    $("#searchBtn").disabled = on;
  }

  function scoreClass(score) {
    if (score >= 70) return "score-good";
    if (score >= 45) return "score-mid";
    return "score-low";
  }

  function categoryKey(tags={}) {
    const v = tags.amenity || tags.shop || tags.craft || tags.office || "";
    if (["restaurant","cafe","fast_food","bar","pub","bakery","supermarket","convenience","butcher"].includes(v)) return "food";
    if (["hairdresser","beauty","cosmetics","spa"].includes(v)) return "beauty";
    if (["clinic","dentist","pharmacy","doctors","hospital","optician"].includes(v)) return "health";
    if (["school","college","language_school","kindergarten","university"].includes(v)) return "education";
    if (tags.shop) return "retail";
    return "services";
  }

  function initials(name="") {
    return name.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase() || "•";
  }

  function normalizeUrl(url) {
    if (!url) return null;
    url = String(url).trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    return url;
  }

  function socialsFromTags(tags={}) {
    const socialMap = {
      instagram: "Instagram",
      facebook: "Facebook",
      tiktok: "TikTok",
      youtube: "YouTube",
      linkedin: "LinkedIn",
      "twitter": "X/Twitter",
      "x.com": "X",
    };

    const found = new Set();

    for (const [k,v] of Object.entries(tags)) {
      const text = `${k} ${v}`.toLowerCase();
      for (const [needle,label] of Object.entries(socialMap)) {
        if (text.includes(needle)) found.add(label);
      }
    }

    return [...found];
  }

  function buildBusiness(el, query) {
    const tags = el.tags || {};
    const key = categoryKey(tags);
    const websiteUrl = normalizeUrl(tags.website || tags["contact:website"]);
    const socials = socialsFromTags(tags);
    const phone = Boolean(tags.phone || tags["contact:phone"]);
    const hours = Boolean(tags.opening_hours);
    const email = Boolean(tags.email || tags["contact:email"]);
    const website = Boolean(websiteUrl);

    const presenceSignals = [website, phone, hours, email, socials.length > 0];
    const online = Math.round((presenceSignals.filter(Boolean).length / presenceSignals.length) * 100);
    const social = Math.min(100, socials.length * 34);
    const site = website ? 70 : 0;
    const completeness = Math.round(
      [tags.name, phone, hours, website, email, tags["addr:street"], tags["addr:housenumber"]]
        .filter(Boolean).length / 7 * 100
    );

    const score = Math.round(
      online * .35 +
      social * .25 +
      site * .25 +
      completeness * .15
    );

    const center = el.center || {};
    const lat = el.lat ?? center.lat ?? null;
    const lng = el.lon ?? center.lon ?? null;

    const recommendations = [];
    if (!website) recommendations.push("Criar um site próprio simples, rápido e adaptado ao celular.");
    if (social < 50) recommendations.push("Adicionar e manter links sociais públicos e consistentes.");
    if (!phone) recommendations.push("Adicionar um telefone ou canal de contato público.");
    if (!hours) recommendations.push("Publicar horários de funcionamento atualizados.");
    if (completeness < 60) recommendations.push("Completar endereço e informações públicas do estabelecimento.");
    if (!recommendations.length) recommendations.push("Manter os dados atualizados e testar campanhas locais segmentadas.");

    return {
      id: `osm-${el.type}-${el.id}`,
      osmType: el.type,
      osmId: el.id,
      name: tags.name || "Negócio sem nome",
      category: key,
      categoryLabel: CATEGORY_LABELS[key],
      country: query.country,
      city: query.city,
      neighborhood: query.neighborhood,
      lat,
      lng,
      website,
      websiteUrl,
      phone,
      hours,
      email,
      socials,
      online,
      social,
      site,
      completeness,
      score,
      recommendations,
      rawTags: tags,
    };
  }

  function cacheKey(query) {
    return "marketmap:" + JSON.stringify(query).toLowerCase();
  }

  function cacheGet(query) {
    try {
      const raw = localStorage.getItem(cacheKey(query));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.savedAt > 24*60*60*1000) return null;
      return data.payload;
    } catch { return null; }
  }

  function cacheSet(query, payload) {
    try {
      localStorage.setItem(cacheKey(query), JSON.stringify({savedAt:Date.now(),payload}));
    } catch {}
  }

  async function geocode(query) {
    const text = [query.neighborhood, query.city, query.country].filter(Boolean).join(", ");
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", text);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "pt-BR");

    const res = await fetch(url, {headers:{"Accept":"application/json"}});
    if (!res.ok) throw new Error("Não foi possível localizar a região.");
    const data = await res.json();
    if (!data.length) throw new Error("Região não encontrada. Tente um bairro/cidade mais específicos.");

    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
      displayName: data[0].display_name,
    };
  }

  function overpassQuery(lat, lng, radius) {
    return `
      [out:json][timeout:35];
      (
        nwr(around:${radius},${lat},${lng})["name"]["shop"];
        nwr(around:${radius},${lat},${lng})["name"]["amenity"~"restaurant|cafe|fast_food|bar|pub|pharmacy|clinic|dentist|doctors|school|language_school|bank|fuel|car_wash|veterinary"];
        nwr(around:${radius},${lat},${lng})["name"]["craft"];
        nwr(around:${radius},${lat},${lng})["name"]["office"];
      );
      out center tags;
    `;
  }

  async function fetchOverpass(lat, lng, radius) {
    const q = overpassQuery(lat, lng, radius);
    let lastError;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const body = new URLSearchParams({data:q});
        const res = await fetch(endpoint, {
          method:"POST",
          headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
          body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.elements || [];
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error("Os servidores de dados estão ocupados. Tente novamente em alguns instantes.");
  }

  async function search(query, force=false) {
    setLoading(true);

    try {
      if (!force) {
        const cached = cacheGet(query);
        if (cached) {
          state.center = cached.center;
          state.businesses = cached.businesses;
          state.lastQuery = query;
          renderAll();
          toast("Resultado carregado do cache local.", "success");
          return;
        }
      }

      const location = await geocode(query);
      const elements = await fetchOverpass(location.lat, location.lng, query.radius);

      const seen = new Set();
      let businesses = elements
        .filter(el => el.tags?.name)
        .map(el => buildBusiness(el, query))
        .filter(b => {
          const key = `${b.name.toLowerCase()}|${b.category}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      if (query.category !== "all") {
        businesses = businesses.filter(b => b.category === query.category);
      }

      businesses = businesses.slice(0, 250);

      state.center = {lat:location.lat,lng:location.lng};
      state.businesses = businesses;
      state.lastQuery = query;
      cacheSet(query, {center:state.center,businesses});

      renderAll();
      toast(`${businesses.length} negócios encontrados.`, "success");
    } catch (err) {
      console.error(err);
      toast(err.message || "Falha ao pesquisar.", "error");
    } finally {
      setLoading(false);
    }
  }

  function renderAll() {
    $("#dashboard").classList.remove("hidden");
    const q = state.lastQuery;
    $("#resultTitle").textContent = `${q.neighborhood || q.city}, ${q.city || q.country}`;
    $("#resultSubtitle").textContent = `${q.country} · raio ${(q.radius/1000).toFixed(1).replace(".",",")} km · dados públicos`;
    $("#mapTitle").textContent = `${q.neighborhood || q.city} · ${state.businesses.length} negócios`;

    renderKpis();
    renderCharts();
    renderInsights();
    applyTableFilter();
    renderMap();
    renderCompare();

    $("#dashboard").scrollIntoView({behavior:"smooth",block:"start"});
    revealNow();
  }

  function renderKpis() {
    const data = state.businesses;
    const count = data.length;
    const avg = count ? Math.round(data.reduce((a,b)=>a+b.score,0)/count) : 0;
    const websites = count ? Math.round(data.filter(b=>b.website).length/count*100) : 0;
    const opportunities = data.filter(b=>b.score<45).length;

    $("#kpiBusinesses").textContent = count.toLocaleString("pt-BR");
    $("#kpiScore").textContent = avg;
    $("#kpiWebsite").textContent = websites + "%";
    $("#kpiOpportunity").textContent = opportunities;
  }

  function renderCharts() {
    const d = state.businesses;
    const n = d.length || 1;
    const avg = d.length ? Math.round(d.reduce((a,b)=>a+b.score,0)/d.length) : 0;
    const good = d.filter(b=>b.score>=70).length;
    const mid = d.filter(b=>b.score>=45 && b.score<70).length;
    const low = d.filter(b=>b.score<45).length;

    const goodPct = good/n*100;
    const midPct = mid/n*100;

    $("#donut").style.setProperty("--good", `${goodPct}%`);
    $("#donut").style.setProperty("--mid", `${midPct}%`);
    $("#donutScore").textContent = avg;

    $("#scoreLegend").innerHTML = [
      ["#72e7b1","Forte (70+) ",good],
      ["#ffcc75","Médio (45–69)",mid],
      ["#ff7d8d","Oportunidade (<45)",low]
    ].map(([color,label,value]) => `
      <div class="legend-row">
        <span class="legend-label"><i style="background:${color}"></i>${label}</span>
        <strong>${value}</strong>
      </div>
    `).join("");

    const avgMetric = key => d.length ? Math.round(d.reduce((a,b)=>a+(b[key]||0),0)/d.length) : 0;
    const metrics = [
      ["Presença pública",avgMetric("online")],
      ["Presença social",avgMetric("social")],
      ["Site",avgMetric("site")],
      ["Completude",avgMetric("completeness")],
    ];

    $("#metricBars").innerHTML = metrics.map(([label,value]) => `
      <div class="metric-row">
        <div class="metric-row-top"><span>${label}</span><strong>${value}%</strong></div>
        <div class="bar-track"><div class="bar-fill" data-width="${value}"></div></div>
      </div>
    `).join("");

    requestAnimationFrame(() => {
      $$(".bar-fill").forEach(el => el.style.width = el.dataset.width + "%");
    });

    const categories = Object.entries(
      d.reduce((acc,b)=> {
        acc[b.categoryLabel] = (acc[b.categoryLabel]||0)+1;
        return acc;
      },{})
    ).sort((a,b)=>b[1]-a[1]);

    const max = categories[0]?.[1] || 1;
    $("#categoryChart").innerHTML = categories.slice(0,7).map(([label,value]) => `
      <div class="cat-row">
        <span title="${esc(label)}">${esc(label)}</span>
        <div class="cat-bar"><i style="width:${value/max*100}%"></i></div>
        <strong>${value}</strong>
      </div>
    `).join("") || `<div class="empty-state">Sem categorias para exibir.</div>`;
  }

  function renderInsights() {
    const d = state.businesses;
    const n = d.length || 1;
    const sitePct = Math.round(d.filter(b=>b.website).length/n*100);
    const phonePct = Math.round(d.filter(b=>b.phone).length/n*100);
    const hoursPct = Math.round(d.filter(b=>b.hours).length/n*100);
    const socialPct = Math.round(d.filter(b=>b.social>0).length/n*100);
    const best = [...d].sort((a,b)=>b.score-a.score)[0];
    const weakest = [...d].sort((a,b)=>a.score-b.score)[0];

    const insights = [
      {
        icon:"◉",
        title:`${100-sitePct}% sem site informado`,
        text:"Uma parcela relevante dos negócios não possui website público nos dados consultados."
      },
      {
        icon:"⌕",
        title:`${100-socialPct}% sem rede social identificada`,
        text:"Links sociais ausentes dificultam descoberta e relacionamento digital."
      },
      {
        icon:"◷",
        title:`${hoursPct}% publicam horários`,
        text:"Horários completos ajudam buscas locais e reduzem atrito para o cliente."
      },
      {
        icon:"↗",
        title: weakest ? `Maior oportunidade: ${weakest.name}` : "Sem dados suficientes",
        text: weakest ? `Score ${weakest.score}/100. Priorize presença básica e completude do perfil.` : "Faça uma pesquisa para gerar insights."
      },
      {
        icon:"★",
        title: best ? `Referência local: ${best.name}` : "Sem referência ainda",
        text: best ? `Score ${best.score}/100 entre os negócios encontrados.` : "Faça uma pesquisa para comparar negócios."
      }
    ];

    $("#insightsList").innerHTML = insights.map(i => `
      <div class="insight">
        <span class="insight-icon">${i.icon}</span>
        <div><strong>${esc(i.title)}</strong><p>${esc(i.text)}</p></div>
      </div>
    `).join("");
  }

  function applyTableFilter() {
    const text = $("#businessSearch").value.trim().toLowerCase();
    const sort = $("#sortBy").value;

    let data = state.businesses.filter(b =>
      !text ||
      b.name.toLowerCase().includes(text) ||
      b.categoryLabel.toLowerCase().includes(text)
    );

    if (sort === "scoreAsc") data.sort((a,b)=>a.score-b.score);
    if (sort === "scoreDesc") data.sort((a,b)=>b.score-a.score);
    if (sort === "name") data.sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));

    state.filtered = data;
    renderTable();
  }

  function renderTable() {
    const rows = state.filtered.slice(0,250);
    $("#businessTable").innerHTML = rows.map(b => `
      <tr>
        <td>
          <div class="business-name">
            <span class="business-avatar">${esc(initials(b.name))}</span>
            <div>
              <strong>${esc(b.name)}</strong>
              <span class="subline">${esc(b.neighborhood || b.city || "")}</span>
            </div>
          </div>
        </td>
        <td>${esc(b.categoryLabel)}</td>
        <td><strong>${b.online}%</strong></td>
        <td><span class="status-chip ${b.website?"yes":"no"}">${b.website?"● Sim":"○ Não"}</span></td>
        <td>${b.socials.length ? esc(b.socials.join(", ")) : "N/D"}</td>
        <td><span class="score-pill ${scoreClass(b.score)}">${b.score}</span></td>
        <td>
          <div class="row-actions">
            <button class="tiny-btn" data-compare="${b.id}">Comparar</button>
            <button class="tiny-btn" data-detail="${b.id}">Detalhes</button>
          </div>
        </td>
      </tr>
    `).join("");

    $("#emptyTable").classList.toggle("hidden", rows.length > 0);
  }

  function renderMap() {
    if (!window.L) return;

    if (!state.map) {
      state.map = L.map("map", {zoomControl:true}).setView(
        [state.center?.lat || -23.55, state.center?.lng || -46.63],
        13
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom:19,
        attribution:'&copy; OpenStreetMap contributors'
      }).addTo(state.map);
    }

    state.markers.forEach(m => m.remove());
    state.markers = [];

    const points = state.businesses.filter(b=>Number.isFinite(b.lat)&&Number.isFinite(b.lng));

    for (const b of points) {
      const color = b.score>=70 ? "#72e7b1" : b.score>=45 ? "#ffcc75" : "#ff7d8d";
      const icon = L.divIcon({
        className:"",
        html:`<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #07111f;box-shadow:0 5px 18px rgba(0,0,0,.35)"></div>`,
        iconSize:[16,16],
        iconAnchor:[8,8]
      });

      const marker = L.marker([b.lat,b.lng],{icon}).addTo(state.map);
      marker.bindPopup(`
        <div style="min-width:190px">
          <strong>${esc(b.name)}</strong><br>
          <span>${esc(b.categoryLabel)} · Score ${b.score}/100</span>
        </div>
      `);
      state.markers.push(marker);
    }

    if (points.length) {
      const group = L.featureGroup(state.markers);
      state.map.fitBounds(group.getBounds().pad(.14), {maxZoom:16});
    } else if (state.center) {
      state.map.setView([state.center.lat,state.center.lng],14);
    }

    setTimeout(()=>state.map.invalidateSize(),150);
  }

  function openDrawer(id) {
    const b = state.businesses.find(x=>x.id===id);
    if (!b) return;

    const audit = [
      ["Presença pública",b.online,"Website, telefone, horários, e-mail e redes públicas."],
      ["Presença social",b.social,b.socials.length ? b.socials.join(", ") : "Nenhuma rede identificada nos dados públicos."],
      ["Site",b.site,b.website ? "Website informado publicamente." : "Nenhum website informado."],
      ["Completude",b.completeness,"Quantidade de campos públicos úteis preenchidos."]
    ];

    $("#drawerContent").innerHTML = `
      <div class="drawer-title">
        <div class="eyebrow">${esc(b.categoryLabel)}</div>
        <h2>${esc(b.name)}</h2>
        <p>${esc([b.neighborhood,b.city,b.country].filter(Boolean).join(", "))}</p>
      </div>

      <div class="drawer-score">
        <strong>${b.score}</strong><span>/100 · Marketing Score</span>
      </div>

      <div class="audit-grid">
        ${audit.map(([label,value,desc])=>`
          <div class="audit-item">
            <div class="audit-item-top">
              <strong>${esc(label)}</strong>
              <span class="score-pill ${scoreClass(value)}">${value}</span>
            </div>
            <p>${esc(desc)}</p>
          </div>
        `).join("")}
      </div>

      <div class="drawer-section">
        <h3>Informações públicas</h3>
        <div class="audit-grid">
          <div class="audit-item"><div class="audit-item-top"><span>Website</span><strong>${b.website ? "Sim" : "Não"}</strong></div>
          ${b.websiteUrl ? `<p><a href="${esc(b.websiteUrl)}" target="_blank" rel="noopener noreferrer">${esc(b.websiteUrl)}</a></p>` : ""}</div>
          <div class="audit-item"><div class="audit-item-top"><span>Telefone</span><strong>${b.phone ? "Informado" : "N/D"}</strong></div></div>
          <div class="audit-item"><div class="audit-item-top"><span>Horários</span><strong>${b.hours ? "Informados" : "N/D"}</strong></div></div>
          <div class="audit-item"><div class="audit-item-top"><span>Redes</span><strong>${b.socials.length || 0}</strong></div><p>${esc(b.socials.join(", ") || "Nenhuma identificada")}</p></div>
        </div>
      </div>

      <div class="drawer-section">
        <h3>Recomendações</h3>
        <div class="rec-list">
          ${b.recommendations.map(r=>`<div class="rec">${esc(r)}</div>`).join("")}
        </div>
      </div>

      <div class="drawer-section">
        <button class="primary" style="width:100%" data-compare="${b.id}">Adicionar à comparação</button>
      </div>
    `;

    $("#drawer").setAttribute("aria-hidden","false");
    document.body.style.overflow="hidden";
  }

  function closeDrawer() {
    $("#drawer").setAttribute("aria-hidden","true");
    document.body.style.overflow="";
  }

  function toggleCompare(id) {
    const exists = state.compare.includes(id);

    if (exists) {
      state.compare = state.compare.filter(x=>x!==id);
    } else {
      if (state.compare.length >= 4) {
        toast("Você pode comparar até 4 negócios.", "error");
        return;
      }
      state.compare.push(id);
    }
    renderCompare();
  }

  function renderCompare() {
    const tray = $("#compareTray");
    const items = state.compare
      .map(id=>state.businesses.find(b=>b.id===id))
      .filter(Boolean);

    if (!items.length) {
      tray.innerHTML = `<div class="compare-empty">Use o botão “Comparar” na tabela.</div>`;
      return;
    }

    tray.innerHTML = items.map(b=>`
      <article class="compare-card">
        <h4>${esc(b.name)}</h4>
        <small>${esc(b.categoryLabel)}</small>
        <div class="compare-score">${b.score}<small>/100</small></div>
        <div class="compare-grid">
          <div><span>Presença</span><strong>${b.online}%</strong></div>
          <div><span>Social</span><strong>${b.social}%</strong></div>
          <div><span>Site</span><strong>${b.site}%</strong></div>
          <div><span>Completude</span><strong>${b.completeness}%</strong></div>
        </div>
        <button class="tiny-btn compare-remove" data-remove-compare="${b.id}">Remover</button>
      </article>
    `).join("");
  }

  function exportCsv() {
    if (!state.businesses.length) {
      toast("Não há dados para exportar.", "error");
      return;
    }

    const cols = [
      ["Nome","name"],
      ["Categoria","categoryLabel"],
      ["País","country"],
      ["Cidade","city"],
      ["Bairro","neighborhood"],
      ["Score","score"],
      ["Presença","online"],
      ["Social","social"],
      ["Site score","site"],
      ["Completude","completeness"],
      ["Website","websiteUrl"],
      ["Telefone informado","phone"],
      ["Horários informados","hours"],
      ["Redes sociais","socials"],
      ["Latitude","lat"],
      ["Longitude","lng"],
    ];

    const quote = v => `"${String(Array.isArray(v)?v.join(" | "):(v??"")).replaceAll('"','""')}"`;
    const rows = [
      cols.map(c=>quote(c[0])).join(","),
      ...state.businesses.map(b => cols.map(c=>quote(b[c[1]])).join(","))
    ];

    const blob = new Blob(["\ufeff"+rows.join("\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marketmap-${(state.lastQuery?.neighborhood||state.lastQuery?.city||"dados").replace(/\s+/g,"-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function currentQuery() {
    return {
      country: $("#country").value.trim(),
      city: $("#city").value.trim(),
      neighborhood: $("#neighborhood").value.trim(),
      category: $("#category").value,
      radius: Number($("#radius").value),
    };
  }

  function revealNow() {
    $$(".reveal").forEach(el => observer.observe(el));
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, {threshold:.08});

  function setupTheme() {
    const saved = localStorage.getItem("marketmap-theme");
    if (saved) document.documentElement.dataset.theme = saved;
    $("#themeIcon").textContent = document.documentElement.dataset.theme === "light" ? "☀" : "☾";

    $("#themeBtn").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("marketmap-theme", next);
      $("#themeIcon").textContent = next === "light" ? "☀" : "☾";
    });
  }

  function init() {
    setupTheme();
    revealNow();

    $("#radius").addEventListener("input", e => {
      $("#radiusLabel").textContent = (Number(e.target.value)/1000).toFixed(1).replace(".",",") + " km";
    });

    $("#searchForm").addEventListener("submit", e => {
      e.preventDefault();
      const q = currentQuery();
      if (!q.country || !q.city) {
        toast("Informe pelo menos país e cidade.", "error");
        return;
      }
      search(q);
    });

    $("#refreshBtn").addEventListener("click", () => state.lastQuery && search(state.lastQuery, true));
    $("#exportBtn").addEventListener("click", exportCsv);
    $("#businessSearch").addEventListener("input", applyTableFilter);
    $("#sortBy").addEventListener("change", applyTableFilter);
    $("#clearCompareBtn").addEventListener("click", () => { state.compare=[]; renderCompare(); });

    $("#openSearchBtn").addEventListener("click", () => {
      $("#country").focus();
      window.scrollTo({top:70,behavior:"smooth"});
    });

    document.addEventListener("click", e => {
      const detail = e.target.closest("[data-detail]");
      if (detail) openDrawer(detail.dataset.detail);

      const compare = e.target.closest("[data-compare]");
      if (compare) toggleCompare(compare.dataset.compare);

      const remove = e.target.closest("[data-remove-compare]");
      if (remove) toggleCompare(remove.dataset.removeCompare);

      if (e.target.closest("[data-close-drawer]")) closeDrawer();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeDrawer();
    });

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
    }
  }

  init();
})();