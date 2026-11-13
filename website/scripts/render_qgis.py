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
nodes = [n for n in tree.findLayers() if n.layer() and n.layer().isValid()]
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
width = 2800
height = max(900, min(3500, round(width * extent.height() / max(extent.width(), 1e-9))))
settings = QgsMapSettings()
settings.setDestinationCrs(target)
settings.setExtent(extent)
settings.setOutputSize(QSize(width, height))
settings.setBackgroundColor(QColor(0, 0, 0, 0))
settings.setFlag(QgsMapSettings.Antialiasing, True)
actual = settings.visibleExtent()
bounds = [[actual.yMinimum(), actual.xMinimum()], [actual.yMaximum(), actual.xMaximum()]]
manifest = []
# QGIS layer tree is ordered top-to-bottom; Leaflet images added bottom-to-top.
for index, node in enumerate(reversed(nodes)):
    layer = node.layer()
    settings.setLayers([layer])
    job = QgsMapRendererSequentialJob(settings)
    job.start()
    job.waitForFinished()
    image = job.renderedImage()
    filename = f"qgis_{index:02d}.png"
    if not image.save(str(OUT / filename), "PNG"):
        raise RuntimeError("Failed to save " + filename)
    manifest.append({
        "id": layer.id(), "title": layer.name(), "file": filename,
        "kind": "raster" if layer.type() == layer.RasterLayer else "vector",
        "visible": node.isVisible(), "bounds": bounds,
        "source": Path(layer.source().split("|")[0]).name,
    })
(OUT / "qgis_layers.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Rendered {len(manifest)} styled QGIS layers at {width}x{height}", flush=True)
# QGIS native libraries can segfault during Python interpreter shutdown on headless runners.
# All output files are already flushed; exit without running their global destructors.
os._exit(0)
