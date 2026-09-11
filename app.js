const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let mode = "demo";
let businesses = [];
let filtered = [];
let compareIds = new Set();
let map;
let markersLayer;

const demoData = [
 {id:"br1",name:"Padaria Nova Esperança",category:"Alimentação",country:"Brasil",city:"São Paulo",neighborhood:"Capão Redondo",economic:"media-baixa",lat:-23.6592,lng:-46.7674,website:false,social:28,reviews:4.5,reviewCount:138,brand:42,promotions:20,online:46,score:38,phone:true,hours:true},
 {id:"br2",name:"Studio Bella",category:"Beleza",country:"Brasil",city:"São Paulo",neighborhood:"Capão Redondo",economic:"media-baixa",lat:-23.6637,lng:-46.7702,website:true,social:78,reviews:4.8,reviewCount:224,brand:74,promotions:70,online:84,score:77,phone:true,hours:true},
 {id:"br3",name:"Mercado Popular Sul",category:"Varejo",country:"Brasil",city:"São Paulo",neighborhood:"Capão Redondo",economic:"baixa",lat:-23.6554,lng:-46.7715,website:false,social:12,reviews:4.0,reviewCount:89,brand:30,promotions:48,online:34,score:31,phone:true,hours:true},
 {id:"br4",name:"Clínica Sorriso Local",category:"Saúde",country:"Brasil",city:"São Paulo",neighborhood:"Capão Redondo",economic:"media-baixa",lat:-23.6610,lng:-46.7628,website:true,social:58,reviews:4.6,reviewCount:311,brand:81,promotions:34,online:88,score:70,phone:true,hours:true},
 {id:"br5",name:"Auto Center Avenida",category:"Serviços",country:"Brasil",city:"São Paulo",neighborhood:"Capão Redondo",economic:"media-baixa",lat:-23.6650,lng:-46.7650,website:false,social:22,reviews:4.2,reviewCount:55,brand:35,promotions:10,online:43,score:34,phone:true,hours:false},
 {id:"br6",name:"Ponto do Açaí",category:"Alimentação",country:"Brasil",city:"São Paulo",neighborhood:"Capão Redondo",economic:"baixa",lat:-23.6571,lng:-46.7611,website:false,social:83,reviews:4.7,reviewCount:402,brand:68,promotions:82,online:76,score:66,phone:true,hours:true},
 {id:"pt1",name:"Café do Bairro",category:"Alimentação",country:"Portugal",city:"Lisboa",neighborhood:"Chelas",economic:"media-baixa",lat:38.7584,lng:-9.1177,website:false,social:34,reviews:4.4,reviewCount:96,brand:45,promotions:24,online:51,score:41,phone:true,hours:true},
 {id:"pt2",name:"Oficina Central",category:"Serviços",country:"Portugal",city:"Lisboa",neighborhood:"Chelas",economic:"media-baixa",lat:38.7560,lng:-9.1210,website:true,social:18,reviews:4.2,reviewCount:63,brand:38,promotions:14,online:65,score:46,phone:true,hours:true},
 {id:"mx1",name:"Tacos La Esquina",category:"Alimentação",country:"México",city:"Ciudad de México",neighborhood:"Iztapalapa",economic:"media-baixa",lat:19.3574,lng:-99.0647,website:false,social:71,reviews:4.6,reviewCount:322,brand:61,promotions:78,online:74,score:62,phone:true,hours:true},
 {id:"co1",name:"Belleza Urbana",category:"Beleza",country:"Colômbia",city:"Bogotá",neighborhood:"Bosa",economic:"media-baixa",lat:4.6176,lng:-74.1904,website:false,social:86,reviews:4.7,reviewCount:186,brand:73,promotions:64,online:79,score:68,phone:true,hours:true},
 {id:"us1",name:"Southside Family Market",category:"Varejo",country:"Estados Unidos",city:"Houston",neighborhood:"Sunnyside",economic:"media-baixa",lat:29.6616,lng:-95.3657,website:true,social:39,reviews:4.3,reviewCount:145,brand:57,promotions:52,online:74,score:58,phone:true,hours:true},
 {id:"es1",name:"Comercio Barrio Sur",category:"Varejo",country:"Espanha",city:"Madrid",neighborhood:"Usera",economic:"media-baixa",lat:40.3837,lng:-3.7063,website:false,social:31,reviews:4.1,reviewCount:77,brand:40,promotions:35,online:49,score:40,phone:true,hours:true}
];

function normalize(s=""){return s.toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function statusClass(score){return score < 45 ? "bad" : score < 70 ? "mid" : "good"}
function scoreText(v){return v == null ? "N/D" : Math.round(v)}
function boolText(v){return v == null ? `<span class="na">N/D</span>` : v ? `<span class="yes">Sim</span>` : `<span class="no">Não</span>`}
function categoryFromTags(tags={}){
 const raw = tags.amenity || tags.shop || tags.craft || tags.office || tags.healthcare || "";
 if(["restaurant","cafe","fast_food","bar","pub","bakery","convenience","supermarket"].includes(raw)) return "Alimentação";
 if(["hairdresser","beauty","cosmetics"].includes(raw)) return "Beleza";
 if(["clinic","dentist","pharmacy","doctors","hospital"].includes(raw)) return "Saúde";
 if(tags.shop) return "Varejo";
 if(["school","college","language_school","kindergarten"].includes(raw)) return "Educação";
 return "Serviços";
}
function socialScore(tags={}){
 let count = 0;
 const keys = Object.keys(tags);
 if(keys.some(k=>/instagram/i.test(k))) count++;
 if(keys.some(k=>/facebook/i.test(k))) count++;
 if(keys.some(k=>/twitter|x\.com|tiktok|youtube/i.test(k))) count++;
 return count ? Math.min(100, 45 + count*18) : 0;
}
function computeLiveBusiness(el, idx){
 const t = el.tags || {};
 const website = !!(t.website || t["contact:website"]);
 const social = socialScore(t);
 const phone = !!(t.phone || t["contact:phone"]);
 const hours = !!t.opening_hours;
 const completeness = [website, social>0, phone, hours, !!t.name].filter(Boolean).length / 5 * 100;
 const online = Math.round(completeness);
 // Only scored dimensions available from OSM are weighted and normalized.
 const available = [
   {w:25,v:online},
   {w:20,v:social},
   {w:20,v:website?100:0},
 ];
 const totalW = available.reduce((a,b)=>a+b.w,0);
 const score = Math.round(available.reduce((a,b)=>a+b.w*b.v,0)/totalW);
 return {
  id:`osm-${el.type}-${el.id}`, name:t.name || `Negócio sem nome #${idx+1}`, category:categoryFromTags(t),
  country:$("#country").value, city:$("#city").value, neighborhood:$("#neighborhood").value,
  economic:$("#economic").value, lat:el.lat || el.center?.lat, lng:el.lon || el.center?.lon,
  website, websiteUrl:t.website || t["contact:website"] || null, social, reviews:null, reviewCount:null,
  brand:null,promotions:null,online,score,phone,hours,tags:t,live:true
 };
}
function getRecommendations(b){
 const tips=[];
 if(!b.website) tips.push("Criar um site simples, rápido e com CTA para WhatsApp/contato.");
 if(b.social != null && b.social < 45) tips.push("Fortalecer presença em redes sociais com calendário de conteúdo e perfil completo.");
 if(b.online != null && b.online < 60) tips.push("Completar dados públicos: telefone, horário, endereço e links oficiais.");
 if(b.reviews != null && (b.reviews < 4.3 || b.reviewCount < 100)) tips.push("Criar rotina de solicitação e resposta a avaliações de clientes.");
 if(b.brand != null && b.brand < 55) tips.push("Padronizar logo, cores, tipografia e fotos em todos os canais.");
 if(b.promotions != null && b.promotions < 45) tips.push("Testar promoções mensuráveis e ofertas com prazo/benefício claro.");
 if(!tips.length) tips.push("Manter consistência e testar campanhas locais segmentadas para crescer.");
 return tips.slice(0,4);
}

function initMap(){
 map=L.map("map",{zoomControl:false}).setView([-23.659,-46.767],14);
 L.control.zoom({position:"bottomright"}).addTo(map);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:19,attribution:'&copy; OpenStreetMap contributors'
 }).addTo(map);
 markersLayer=L.layerGroup().addTo(map);
}
function renderMap(data){
 markersLayer.clearLayers();
 const points=data.filter(b=>Number.isFinite(b.lat)&&Number.isFinite(b.lng));
 if(!points.length) return;
 points.forEach(b=>{
  const cls=statusClass(b.score);
  const color=cls==="bad"?"#dc4c64":cls==="mid"?"#db8d12":"#17a672";
  const marker=L.circleMarker([b.lat,b.lng],{radius:8,color:"#fff",weight:2,fillColor:color,fillOpacity:1});
  marker.bindPopup(`<strong>${escapeHtml(b.name)}</strong><br><span>${escapeHtml(b.category)}</span><br><b>Score: ${b.score}/100</b>`);
  marker.on("click",()=>openDrawer(b.id));
  marker.addTo(markersLayer);
 });
 const bounds=L.latLngBounds(points.map(b=>[b.lat,b.lng]));
 map.fitBounds(bounds.pad(.18),{maxZoom:15});
 setTimeout(()=>map.invalidateSize(),100);
}
function renderMetrics(data){
 const count=data.length;
 const avg=count?Math.round(data.reduce((s,b)=>s+b.score,0)/count):0;
 const noSite=data.filter(b=>!b.website).length;
 const opp=data.filter(b=>b.score<45).length;
 $("#mBusinesses").textContent=count;
 $("#mScore").textContent=count?avg:"—";
 $("#mNoSite").textContent=count?`${Math.round(noSite/count*100)}%`:"—";
 $("#mOpportunity").textContent=count?opp:"—";
 $("#mBusinessDelta").textContent=count?`${count} resultados filtrados`:"nenhum resultado";
}
function renderOpportunities(data){
 const list=[...data].sort((a,b)=>a.score-b.score).slice(0,4);
 $("#opportunityList").innerHTML=list.length?list.map(b=>{
  const tips=getRecommendations(b);
  return `<div class="opportunity" data-open="${b.id}">
   <div class="opportunity-top"><strong>${escapeHtml(b.name)}</strong><span class="score-chip ${statusClass(b.score)}">${b.score}/100</span></div>
   <p>${escapeHtml(tips[0])}</p>
  </div>`;
 }).join(""):`<div class="compare-empty">Sem dados suficientes para gerar oportunidades.</div>`;
 $$("[data-open]").forEach(el=>el.onclick=()=>openDrawer(el.dataset.open));
}
function renderTable(){
 const q=normalize($("#businessSearch").value);
 const cat=$("#category").value;
 const max=Number($("#maxScore").value);
 filtered=businesses.filter(b=>(cat==="all"||b.category===cat)&&b.score<=max&&(!q||normalize(b.name).includes(q)));
 const sort=$("#sortBy").value;
 filtered.sort((a,b)=>{
  if(sort==="score-asc")return a.score-b.score;
  if(sort==="score-desc")return b.score-a.score;
  if(sort==="reviews-desc")return (b.reviewCount??-1)-(a.reviewCount??-1);
  return a.name.localeCompare(b.name,"pt-BR");
 });
 $("#resultsBody").innerHTML=filtered.map(b=>`
  <tr>
   <td><div class="business-cell"><div class="avatar">${initials(b.name)}</div><div><strong>${escapeHtml(b.name)}</strong><span>${escapeHtml(b.neighborhood||"")}</span></div></div></td>
   <td>${escapeHtml(b.category)}</td>
   <td><span class="score ${statusClass(b.score)}">${b.score}</span><div class="mini-bar ${statusClass(b.score)}"><i style="width:${b.score}%"></i></div></td>
   <td>${boolText(b.website)}</td>
   <td>${metricCell(b.social)}</td>
   <td>${b.reviews==null?`<span class="na">N/D</span>`:`<div class="review-cell"><strong>★ ${b.reviews.toFixed(1)}</strong><br><span>${b.reviewCount} avaliações</span></div>`}</td>
   <td>${metricCell(b.brand)}</td>
   <td>${metricCell(b.promotions)}</td>
   <td><div class="row-actions">
    <button class="icon-btn ${compareIds.has(b.id)?"active":""}" data-compare="${b.id}" title="Comparar">⇄</button>
    <button class="icon-btn" data-detail="${b.id}" title="Detalhes">›</button>
   </div></td>
  </tr>`).join("");
 $("#emptyState").classList.toggle("hidden",filtered.length>0);
 $$("[data-detail]").forEach(x=>x.onclick=()=>openDrawer(x.dataset.detail));
 $$("[data-compare]").forEach(x=>x.onclick=()=>toggleCompare(x.dataset.compare));
 renderMetrics(filtered);
 renderMap(filtered);
 renderOpportunities(filtered);
}
function metricCell(v){return v==null?`<span class="na">N/D</span>`:`${Math.round(v)}%`}
function initials(name){return name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function openDrawer(id){
 const b=businesses.find(x=>x.id===id); if(!b)return;
 const audit=[
  ["Presença online",b.online,"Completude dos dados e canais públicos."],
  ["Redes sociais",b.social,"Sinais públicos de perfis sociais."],
  ["Site próprio",b.website?100:0,b.website?"Site informado publicamente.":"Nenhum site identificado na fonte atual."],
  ["Avaliações",b.reviews==null?null:Math.min(100,Math.round((b.reviews/5)*70+Math.min(30,b.reviewCount/10))),b.reviews==null?"Fonte atual não oferece avaliações.":`${b.reviews.toFixed(1)} estrelas em ${b.reviewCount} avaliações.`],
  ["Consistência visual",b.brand,"Requer dados enriquecidos/análise visual."],
  ["Promoções visíveis",b.promotions,"Requer monitoramento de canais públicos/anúncios."]
 ];
 $("#drawerContent").innerHTML=`
  <div class="drawer-title"><span class="eyebrow">${escapeHtml(b.category)}</span><h2>${escapeHtml(b.name)}</h2><p>${escapeHtml(b.neighborhood)}, ${escapeHtml(b.city)} · ${escapeHtml(b.country)}</p></div>
  <div class="big-score"><strong class="${statusClass(b.score)}">${b.score}</strong><span>/ 100<br>Marketing Score</span></div>
  <div class="audit-list">${audit.map(([n,v,d])=>`<div class="audit-row"><div class="audit-row-top"><span>${n}</span><b>${v==null?"N/D":Math.round(v)+"%"}</b></div><p>${escapeHtml(d)}</p></div>`).join("")}</div>
  <div class="insight-box"><strong>Recomendações prioritárias</strong><ul>${getRecommendations(b).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul></div>
 `;
 $("#drawerOverlay").classList.remove("hidden"); $("#detailDrawer").classList.add("open"); $("#detailDrawer").setAttribute("aria-hidden","false");
}
function closeDrawer(){ $("#drawerOverlay").classList.add("hidden"); $("#detailDrawer").classList.remove("open"); $("#detailDrawer").setAttribute("aria-hidden","true"); }
function toggleCompare(id){
 if(compareIds.has(id))compareIds.delete(id);
 else {
  if(compareIds.size>=4){toast("Você pode comparar no máximo 4 negócios.");return;}
  compareIds.add(id);
 }
 $("#compareCount").textContent=compareIds.size; renderCompare(); renderTable();
}
function renderCompare(){
 const arr=[...compareIds].map(id=>businesses.find(b=>b.id===id)).filter(Boolean);
 $("#compareGrid").innerHTML=arr.length?arr.map(b=>`
  <div class="compare-item">
    <h3>${escapeHtml(b.name)}</h3><span class="cat">${escapeHtml(b.category)}</span>
    <div class="compare-score ${statusClass(b.score)}">${b.score}</div>
    ${compareRow("Site",b.website?"Sim":"Não")}
    ${compareRow("Social",b.social==null?"N/D":Math.round(b.social)+"%")}
    ${compareRow("Avaliações",b.reviews==null?"N/D":`★ ${b.reviews.toFixed(1)}`)}
    ${compareRow("Marca",b.brand==null?"N/D":Math.round(b.brand)+"%")}
    ${compareRow("Promoções",b.promotions==null?"N/D":Math.round(b.promotions)+"%")}
  </div>`).join(""):`<div class="compare-empty">Selecione até 4 negócios na tabela para comparar lado a lado.</div>`;
}
function compareRow(a,b){return `<div class="compare-row"><span>${a}</span><b>${b}</b></div>`}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.add("hidden"),2500)}

function applyDemo(){
 const country=$("#country").value, city=normalize($("#city").value), neigh=normalize($("#neighborhood").value), economic=$("#economic").value;
 let data=demoData.filter(b=>b.country===country);
 if(city) data=data.filter(b=>normalize(b.city).includes(city)||city.includes(normalize(b.city)));
 if(neigh) data=data.filter(b=>normalize(b.neighborhood).includes(neigh)||neigh.includes(normalize(b.neighborhood)));
 if(economic!=="todos") data=data.filter(b=>b.economic===economic);
 if(!data.length){
   data=demoData.filter(b=>b.country===country);
   toast("Sem demo exata para esse bairro; exibindo exemplos disponíveis do país.");
 }
 businesses=data;
 $("#mapLabel").textContent=`${$("#neighborhood").value||"Região"} · ${$("#city").value||country}`;
 renderTable();
}
async function searchLive(){
 const country=$("#country").value, city=$("#city").value.trim(), neighborhood=$("#neighborhood").value.trim();
 if(!city||!neighborhood){toast("Informe cidade e bairro/região.");return}
 setLoading(true);
 try{
  const place=`${neighborhood}, ${city}, ${country}`;
  const geoUrl=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(place)}`;
  const geoRes=await fetch(geoUrl,{headers:{"Accept-Language":"pt-BR"}});
  if(!geoRes.ok) throw new Error("Falha na geocodificação");
  const geo=await geoRes.json();
  if(!geo.length) throw new Error("Região não encontrada no mapa");
  const lat=Number(geo[0].lat), lon=Number(geo[0].lon);
  const radius=2200;
  const query=`[out:json][timeout:35];
  (
    nwr(around:${radius},${lat},${lon})["name"]["shop"];
    nwr(around:${radius},${lat},${lon})["name"]["amenity"~"restaurant|cafe|fast_food|bar|pub|pharmacy|clinic|dentist|doctors|school|language_school"];
    nwr(around:${radius},${lat},${lon})["name"]["craft"];
    nwr(around:${radius},${lat},${lon})["name"]["office"];
  );
  out center tags 120;`;
  const overpassRes=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:new URLSearchParams({data:query})});
  if(!overpassRes.ok) throw new Error("Overpass indisponível no momento");
  const json=await overpassRes.json();
  const dedupe=new Map();
  (json.elements||[]).forEach((el,i)=>{
    const b=computeLiveBusiness(el,i);
    const key=normalize(b.name)+"|"+b.category;
    if(!dedupe.has(key)&&Number.isFinite(b.lat)&&Number.isFinite(b.lng)) dedupe.set(key,b);
  });
  businesses=[...dedupe.values()].slice(0,100);
  $("#mapLabel").textContent=`${neighborhood} · ${city}`;
  if(!businesses.length) toast("Nenhum negócio mapeado foi encontrado nessa área.");
  renderTable();
 }catch(err){
  console.error(err);
  toast(err.message || "Não foi possível consultar os dados reais.");
 }finally{setLoading(false)}
}
function setLoading(on){
 $("#searchPanel").classList.toggle("loading",on);
 $("#searchBtn").textContent=on?"Pesquisando…":"⌕ Pesquisar região";
}
function setMode(next){
 mode=next;
 $$(".segment").forEach(x=>x.classList.toggle("active",x.dataset.mode===mode));
 $("#dataStatus").textContent=mode==="demo"?"Modo demonstração":"OpenStreetMap / Overpass";
 $("#sourceNote").textContent=mode==="demo"
  ?"Dados simulados para demonstrar todas as métricas, inclusive avaliações e promoções."
  :"Dados reais de estabelecimentos mapeados. Avaliações, marca e anúncios ficam como N/D sem uma fonte específica.";
 if(mode==="demo") applyDemo();
}
function exportCsv(){
 if(!filtered.length){toast("Não há dados para exportar.");return}
 const rows=[["Nome","Categoria","País","Cidade","Bairro","Score","Site","Social","Avaliações","Qtd avaliações","Marca","Promoções"]];
 filtered.forEach(b=>rows.push([b.name,b.category,b.country,b.city,b.neighborhood,b.score,b.website?"Sim":"Não",b.social??"",b.reviews??"",b.reviewCount??"",b.brand??"",b.promotions??""]));
 const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
 const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="marketmap-resultados.csv";a.click();URL.revokeObjectURL(a.href);
}
function scrollToId(id){document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"})}

document.addEventListener("DOMContentLoaded",()=>{
 initMap();
 $$(".segment").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
 $("#searchBtn").onclick=()=>mode==="demo"?applyDemo():searchLive();
 $("#newSearchBtn").onclick=()=>scrollToId("searchPanel");
 $("#exportBtn").onclick=exportCsv;
 $("#businessSearch").oninput=renderTable; $("#sortBy").onchange=renderTable; $("#category").onchange=renderTable; $("#maxScore").onchange=renderTable;
 $("#clearCompare").onclick=()=>{compareIds.clear();$("#compareCount").textContent=0;renderCompare();renderTable()};
 $("#closeDrawer").onclick=closeDrawer;$("#drawerOverlay").onclick=closeDrawer;
 $("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
 $$(".nav-item").forEach(btn=>btn.onclick=()=>{
  $$(".nav-item").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  if(btn.dataset.section==="search")scrollToId("searchPanel");
  if(btn.dataset.section==="compare")scrollToId("compareSection");
  if(btn.dataset.section==="methodology")scrollToId("methodologySection");
  if(btn.dataset.section==="overview")window.scrollTo({top:0,behavior:"smooth"});
  $("#sidebar").classList.remove("open");
 });
 $("#country").onchange=()=>{
  const presets={
   "Brasil":["São Paulo","Capão Redondo"],"Portugal":["Lisboa","Chelas"],"México":["Ciudad de México","Iztapalapa"],
   "Colômbia":["Bogotá","Bosa"],"Estados Unidos":["Houston","Sunnyside"],"Espanha":["Madrid","Usera"]
  };
  const p=presets[$("#country").value]; if(p){$("#city").value=p[0];$("#neighborhood").value=p[1]}
 };
 setMode("demo");
});
