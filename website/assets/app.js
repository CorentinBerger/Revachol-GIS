const map=L.map('map',{zoomControl:true,preferCanvas:true}).setView([0,0],2);
const layerList=document.getElementById('layer-list'),featureInfo=document.getElementById('feature-info'),status=document.getElementById('map-status'),errorBox=document.getElementById('map-error');
function safe(v){return String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showFeature(props,title){const entries=Object.entries(props||{}).filter(([k,v])=>v!==null&&v!==''&&v!==undefined);featureInfo.innerHTML='<div class="section-kicker">'+safe(title)+'</div><dl>'+entries.map(([k,v])=>'<dt>'+safe(k.replaceAll('_',' '))+'</dt><dd>'+safe(typeof v==='object'?JSON.stringify(v):v)+'</dd>').join('')+'</dl>';}
async function init(){try{
 const r=await fetch('./data/qgis_composite.json');if(!r.ok)throw Error('Composition QGIS absente');
 const config=await r.json(),city=L.latLngBounds(config.bounds);
 if(!city.isValid())throw Error('Emprise cartographique invalide');
 const dem=L.imageOverlay('./data/'+config.dem,config.bounds,{opacity:1,interactive:false}).addTo(map);
 const hillshade=L.imageOverlay('./data/'+config.hillshade,config.bounds,{opacity:.45,interactive:false}).addTo(map);
 const vectors=L.imageOverlay('./data/'+config.vectors,config.bounds,{opacity:1,interactive:false}).addTo(map);
 map.fitBounds(city.pad(.02));
 layerList.innerHTML='';
 const heading=document.createElement('div');heading.className='section-kicker';heading.textContent='FONDS QGIS · MNT + OMBRAGE';layerList.appendChild(heading);
 const label=document.createElement('label');label.className='layer-toggle';for(const [title,layer] of [['MNT · Topography',dem],['Ombrage · Hillshade',hillshade],['Vecteurs et étiquettes QGIS',vectors]]){const toggle=document.createElement('label');toggle.className='layer-toggle';toggle.innerHTML='<input type="checkbox" checked><span>'+safe(title)+'</span>';toggle.querySelector('input').addEventListener('change',e=>{if(e.target.checked){layer.addTo(map);if(layer===dem){hillshade.bringToFront();vectors.bringToFront();}else if(layer===hillshade)vectors.bringToFront();}else map.removeLayer(layer);});layerList.appendChild(toggle);}
 const zoom=document.createElement('button');zoom.className='city-zoom';zoom.textContent='⌖ ZOOM SUR LA VILLE';zoom.addEventListener('click',()=>map.fitBounds(city.pad(.02)));layerList.appendChild(zoom);
 const note=document.createElement('p');note.className='muted';note.textContent='Carte fidèle au rendu QGIS. Cliquez sur un objet vectoriel pour consulter ses attributs.';layerList.appendChild(note);
 const response=await fetch('./data/layers.json');if(!response.ok)throw Error('Couches vectorielles absentes');
 const layers=await response.json();let total=0;
 for(const item of layers){
  const rr=await fetch('./data/'+item.file);if(!rr.ok)continue;const geo=await rr.json();total+=geo.features?.length||0;
  // Transparent geometry is used for click hit-testing, never for visual styling.
  const hit=L.geoJSON(geo,{style:()=>({color:'#000',weight:9,opacity:0,fillOpacity:0,interactive:true}),pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:9,opacity:0,fillOpacity:0,interactive:true}),onEachFeature:(f,l)=>l.on('click',()=>showFeature(f.properties,item.title))}).addTo(map);
 }
 status.textContent=total.toLocaleString('fr-FR')+' OBJETS · '+config.layers.length+' COUCHES QGIS';
}catch(e){errorBox.hidden=false;errorBox.textContent=e.message;status.textContent='CARTE INDISPONIBLE';console.error(e);}}
init();
