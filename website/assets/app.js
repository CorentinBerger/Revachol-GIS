// DHDN / 3-degree Gauss-Kruger zone 3; coordinates in projected meters.
const projDef='+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs +type=crs';
const crs=new L.Proj.CRS('EPSG:31467',projDef,{resolutions:[4096,2048,1024,512,256,128,64,32,16,8,4,2,1,.5,.25,.125],origin:[0,0]});
const map=L.map('map',{crs,zoomControl:true,preferCanvas:true,zoomSnap:0.25}).setView([51,9],4);
const layerList=document.getElementById('layer-list'),featureInfo=document.getElementById('feature-info'),status=document.getElementById('map-status'),errorBox=document.getElementById('map-error');
function safe(v){return String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showFeature(props,title){const entries=Object.entries(props||{}).filter(([k,v])=>v!==null&&v!==''&&v!==undefined);featureInfo.innerHTML='<div class="section-kicker">'+safe(title)+'</div><dl>'+entries.map(([k,v])=>'<dt>'+safe(k.replaceAll('_',' '))+'</dt><dd>'+safe(typeof v==='object'?JSON.stringify(v):v)+'</dd>').join('')+'</dl>';}
async function init(){try{
 const r=await fetch('./data/qgis_composite.json');if(!r.ok)throw Error('Composition QGIS absente');
 const config=await r.json();
 if(config.crs!=='EPSG:31467')throw Error('Projection QGIS incorrecte : EPSG:31467 attendu');
 const projectedBounds=config.bounds;
 const southwest=proj4(projDef,'EPSG:4326',[projectedBounds[0][0],projectedBounds[0][1]]);
 const northeast=proj4(projDef,'EPSG:4326',[projectedBounds[1][0],projectedBounds[1][1]]);
 const city=L.latLngBounds([southwest[1],southwest[0]],[northeast[1],northeast[0]]);
 if(!city.isValid())throw Error('Emprise cartographique invalide');
 const dem=L.imageOverlay('./data/'+config.dem,city,{opacity:1,interactive:false}).addTo(map);
 const hillshade=L.imageOverlay('./data/'+config.hillshade,city,{opacity:.45,interactive:false}).addTo(map);
 const vectors=L.imageOverlay('./data/'+config.vectors,city,{opacity:1,interactive:false}).addTo(map);
 map.fitBounds(city.pad(.01));
 layerList.innerHTML='';
 const heading=document.createElement('div');heading.className='section-kicker';heading.textContent='FONDS QGIS · MNT + OMBRAGE';layerList.appendChild(heading);
 for(const [title,layer] of [['MNT · Topography',dem],['Ombrage · Hillshade',hillshade],['Vecteurs et étiquettes QGIS',vectors]]){const toggle=document.createElement('label');toggle.className='layer-toggle';toggle.innerHTML='<input type="checkbox" checked><span>'+safe(title)+'</span>';toggle.querySelector('input').addEventListener('change',e=>{if(e.target.checked){layer.addTo(map);if(layer===dem){hillshade.bringToFront();vectors.bringToFront();}else if(layer===hillshade)vectors.bringToFront();}else map.removeLayer(layer);});layerList.appendChild(toggle);}
 const zoom=document.createElement('button');zoom.className='city-zoom';zoom.textContent='⌖ ZOOM SUR LA VILLE';zoom.addEventListener('click',()=>map.fitBounds(city.pad(.01)));layerList.appendChild(zoom);
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
