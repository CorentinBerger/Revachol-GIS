# Revachol — site web

Cette version web est isolée dans `website/`. Les fichiers sources de QGIS, les GeoPackages et les rasters à la racine du dépôt ne sont jamais modifiés.

## Fonctionnement

- Leaflet affiche les couches vectorielles converties depuis les GeoPackages.
- `scripts/build_geojson.py` écrit uniquement les fichiers dérivés dans `website/data/`.
- Les couches sont activables/désactivables et leurs entités affichent leurs attributs au clic.
- Le fond raster et les emprises exactes seront ajoutés après validation du géoréférencement du projet QGIS.

## Développement local

Installer GDAL, puis lancer :

```bash
python website/scripts/build_geojson.py
python -m http.server 8000 --directory website
```

Ouvrir ensuite http://localhost:8000.

Le site utilise Leaflet depuis un CDN. La police Russo One est fournie avec le dépôt.
