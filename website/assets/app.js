// OpenLayers map in the native projected QGIS coordinate system (meters).
const projDef='+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs +type=crs';
proj4.defs('EPSG:31467',projDef);
ol.proj.proj4.register(proj4);
const projection=ol.proj.get('EPSG:31467');
projection.setExtent([2500000,0,4500000,8000000]);
const layerList=document.getElementById('layer-list'),featureInfo=document.getElementById('feature-info'),status=document.getElementById('map-status'),errorBox=document.getElementById('map-error');
function safe(v){return String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
function showFeature(props,title){const entries=Object.entries(props||{}).filter(([k,v])=>v!==null&&v!==''&&v!==undefined);featureInfo.innerHTML='<div class="section-kicker">'+safe(title)+'</div><dl>'+entries.map(([k,v])=>'<dt>'+safe(k.replaceAll('_',' '))+'</dt><dd>'+safe(typeof v==='object'?JSON.stringify(v):v)+'</dd>').join('')+'</dl>';}
function raster(file,extent,opacity){return new ol.layer.Image({source:new ol.source.ImageStatic({url:'./data/'+file,imageExtent:extent,projection}),opacity});}
function toggle(title,layer){const label=document.createElement('label');label.className='layer-toggle';label.innerHTML='<input type="checkbox" checked><span>'+safe(title)+'</span>';label.querySelector('input').addEventListener('change',e=>layer.setVisible(e.target.checked));layerList.appendChild(label);}
async function init(){try{
 const response=await fetch('./data/qgis_composite.json');if(!response.ok)throw Error('Manifeste QGIS absent');
 const config=await response.json();if(config.crs!=='EPSG:31467')throw Error('EPSG:31467 attendu');
 const [[xmin,ymin],[xmax,ymax]]=config.bounds;const extent=[xmin,ymin,xmax,ymax];
 if(!extent.every(Number.isFinite)||xmax<=xmin||ymax<=ymin)throw Error('Emprise EPSG:31467 invalide');
 const dem=raster(config.dem,extent,1),hillshade=raster(config.hillshade,extent,.45),vectors=raster(config.vectors,extent,1);
 const map=new ol.Map({target:'map',layers:[dem,hillshade,vectors],view:new ol.View({projection,center:ol.extent.getCenter(extent),resolution:Math.max((xmax-xmin)/850,(ymax-ymin)/600),enableRotation:false}),controls:ol.control.defaults({attribution:false})});
 function focus(){map.updateSize();map.getView().fit(extent,{size:map.getSize(),padding:[28,28,28,28],duration:250});}
 map.once('postrender',focus);window.addEventListener('resize',()=>map.updateSize());
 layerList.innerHTML='<div class="section-kicker">EPSG:31467 · COUCHES QGIS</div>';
 toggle('MNT · Topography',dem);toggle('Ombrage · Hillshade',hillshade);toggle('Vecteurs et étiquettes QGIS',vectors);
 const zoom=document.createElement('button');zoom.className='city-zoom';zoom.textContent='⌖ ZOOM SUR REVACHOL';zoom.addEventListener('click',focus);layerList.appendChild(zoom);
 const note=document.createElement('p');note.className='muted';note.textContent='Projection DHDN / Gauss-Krüger zone 3 · sans fond OSM';layerList.appendChild(note);
 let vectorExtent=ol.extent.createEmpty();
 const rr=await fetch('./data/layers.json');if(!rr.ok)throw Error('GeoJSON absents');const layers=await rr.json();let total=0;
 for(const item of layers){const res=await fetch('./data/'+item.file);if(!res.ok)continue;const geo=await res.json();total+=geo.features?.length||0;
 const source=new ol.source.Vector({features:new ol.format.GeoJSON().readFeatures(geo,{dataProjection:'EPSG:4326',featureProjection:projection})});
 if(source.getFeatures().length)ol.extent.extend(vectorExtent,source.getExtent());
 const hit=new ol.layer.Vector({source,style:new ol.style.Style({stroke:new ol.style.Stroke({color:'#725c4b',width:1.5}),fill:new ol.style.Fill({color:'rgba(157,121,87,0.10)'}),image:new ol.style.Circle({radius:4,fill:new ol.style.Fill({color:'#9a563e'})})}),visible:true});hit.set('title',item.title);map.addLayer(hit);
 }
 map.on('singleclick',e=>{let found=false;map.forEachFeatureAtPixel(e.pixel,(feature,layer)=>{if(found)return true;found=true;showFeature(feature.getProperties(),layer?.get('title')||'Objet');return true;},{hitTolerance:6});});
 if(!ol.extent.isEmpty(vectorExtent)){const width=ol.extent.getWidth(vectorExtent),height=ol.extent.getHeight(vectorExtent);const rasterWidth=xmax-xmin,rasterHeight=ymax-ymin;console.info('EPSG:31467 raster extent',extent,'vector extent',vectorExtent);if(width>0&&height>0&&width<rasterWidth*0.9&&height<rasterHeight*0.9){map.getView().fit(vectorExtent,{size:map.getSize(),padding:[35,35,35,35]});}}
 status.textContent=total.toLocaleString('fr-FR')+' OBJETS · EPSG:31467 · VECTEURS VISIBLES';
}catch(e){errorBox.hidden=false;errorBox.textContent=e.message;status.textContent='CARTE INDISPONIBLE';console.error(e);}}
init();
