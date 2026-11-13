#!/usr/bin/env python3
"""Render QGIS layers with their original symbology for the static Leaflet site."""
import json
import os
from pathlib import Path
from qgis.core import (
    QgsApplication, QgsProject, QgsCoordinateReferenceSystem,
    QgsCoordinateTransform, QgsRectangle, QgsMapSettings,
    QgsMapRendererSequentialJob, QgsLayerTreeLayer
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
# Render a single QGIS composition so label placement and layer ordering are coherent.
# Keep the QGIS tree's visibility, excluding the two unwanted reference rasters.
visible = [n.layer() for n in nodes if n.isVisible()]
if not visible:
    raise RuntimeError("No visible QGIS layers to render")
settings.setLayers(list(reversed(visible)))
job = QgsMapRendererSequentialJob(settings)
job.start()
job.waitForFinished()
image = job.renderedImage()
if not image.save(str(OUT / "revachol_composite.png"), "PNG"):
    raise RuntimeError("Failed to save composite")
manifest = {"file": "revachol_composite.png", "bounds": bounds,
            "layers": [layer.name() for layer in visible],
            "excluded": sorted(EXCLUDED_RASTERS)}
(OUT / "qgis_composite.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Rendered QGIS composite with {len(visible)} visible layers at {width}x{height}", flush=True)
os._exit(0)
