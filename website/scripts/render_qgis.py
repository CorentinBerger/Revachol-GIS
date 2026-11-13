#!/usr/bin/env python3
"""Render QGIS layers with their original symbology for the static Leaflet site."""
import json
import os
from pathlib import Path
from qgis.core import (
    QgsApplication, QgsProject, QgsCoordinateReferenceSystem,
    QgsCoordinateTransform, QgsRectangle, QgsMapSettings,
    QgsMapRendererSequentialJob, QgsLayerTreeLayer, QgsNullSymbolRenderer
)
from qgis.PyQt.QtCore import QSize, Qt
from qgis.PyQt.QtGui import QColor

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "website" / "data"
OUT.mkdir(parents=True, exist_ok=True)
app = QgsApplication([], False)
app.initQgis()
project = QgsProject.instance()
if not project.read(str(ROOT / "disco_elysium_revachol_GIS.qgz")):
    raise RuntimeError("Unable to open QGIS project")
target = QgsCoordinateReferenceSystem("EPSG:4326")
tree = project.layerTreeRoot()
EXCLUDED_RASTERS = {"revachol_mapmax.tif", "revachol_west-jamrock_zaum.tif"}
nodes = [n for n in tree.findLayers() if n.layer() and n.layer().isValid() and Path(n.layer().source().split("|")[0]).name.lower() not in EXCLUDED_RASTERS]
if not nodes:
    raise RuntimeError("No valid layers in QGIS project. Check source paths.")
# Use the actual QGIS map canvas extent, falling back to all layers.
extent = QgsRectangle()
for node in nodes:
    layer = node.layer()
    try:
        tr = QgsCoordinateTransform(layer.crs(), target, project)
        r = tr.transformBoundingBox(layer.extent())
        if not r.isEmpty() and all(abs(v) < 1e7 for v in (r.xMinimum(), r.xMaximum(), r.yMinimum(), r.yMaximum())):
            extent.combineExtentWith(r)
    except Exception as e:
        print("Skipping extent", layer.name(), e)
if extent.isEmpty():
    raise RuntimeError("No usable map extent")
pad = max(extent.width(), extent.height()) * .025
extent.grow(pad)
# Fixed aspect ratio for consistent pixel alignment of all rendered layers.
width = 4200
height = max(900, min(4800, round(width * extent.height() / max(extent.width(), 1e-9))))
settings = QgsMapSettings()
settings.setDestinationCrs(target)
settings.setExtent(extent)
settings.setOutputSize(QSize(width, height))
settings.setBackgroundColor(QColor(0, 0, 0, 0))
settings.setFlag(QgsMapSettings.Antialiasing, True)
actual = settings.visibleExtent()
bounds = [[actual.yMinimum(), actual.xMinimum()], [actual.yMaximum(), actual.xMaximum()]]
# Raster backgrounds are rendered separately from vector labels and symbols.
# This prevents the opaque DEM from obscuring the hillshade or waterbody text.
visible = [n.layer() for n in nodes if n.isVisible() and n.layer().name() != "OSM Standard"]
rasters = {Path(l.source().split("|")[0]).name.lower(): l for l in visible if l.type() == l.RasterLayer}
required = ("revachol_dem.tif", "revachol_hillshade.tif")
if any(name not in rasters for name in required):
    raise RuntimeError("Required DEM and hillshade missing from QGIS project")

def render(filename, layers):
    settings.setLayers(layers)
    job = QgsMapRendererSequentialJob(settings)
    job.start()
    job.waitForFinished()
    if not job.renderedImage().save(str(OUT / filename), "PNG"):
        raise RuntimeError("Failed to save " + filename)

# Raster appearance is taken from the original QGIS raster renderers.
render("revachol_dem.png", [rasters[required[0]]])
render("revachol_hillshade.png", [rasters[required[1]]])
vector_layers = [l for l in visible if l.type() != l.RasterLayer]
# Waterbody names is a text-only layer. Suppress its symbols while retaining
# its QGIS labeling engine, label expressions, fonts, and halos.
for layer in vector_layers:
    if layer.name().casefold() == "waterbody names":
        layer.setRenderer(QgsNullSymbolRenderer())
# QGIS top-to-bottom tree order becomes bottom-to-top renderer order.
render("revachol_vectors.png", list(reversed(vector_layers)))
manifest = {"bounds": bounds, "dem": "revachol_dem.png",
            "hillshade": "revachol_hillshade.png", "vectors": "revachol_vectors.png",
            "layers": [l.name() for l in visible],
            "excluded": sorted(EXCLUDED_RASTERS) + ["OSM Standard"]}
(OUT / "qgis_composite.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print("Rendered DEM + hillshade + vectors, waterbody names text only", flush=True)
os._exit(0)
