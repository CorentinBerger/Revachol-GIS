#!/usr/bin/env python3
"""Convert the repository's original GeoPackages to web-ready GeoJSON.
Source files are read-only; generated files are written only under website/data.
"""
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "website" / "data"
OUT.mkdir(parents=True, exist_ok=True)
sources = sorted((ROOT / "vectors").glob("*.gpkg"))
manifest = []

for source in sources:
    info = subprocess.run(
        ["ogrinfo", "-ro", "-json", str(source)],
        check=True, capture_output=True, text=True
    )
    dataset = json.loads(info.stdout)
    for index, layer in enumerate(dataset.get("layers", [])):
        layer_name = layer.get("name")
        if not layer_name:
            continue
        stem = source.stem.replace("revachol_", "").replace("-", "_")
        filename = f"{stem}_{index}.geojson"
        destination = OUT / filename
        subprocess.run([
            "ogr2ogr", "-f", "GeoJSON", str(destination), str(source),
            layer_name, "-t_srs", "EPSG:4326", "-lco", "RFC7946=YES"
        ], check=True)
        manifest.append({
            "title": layer_name.replace("_", " "),
            "file": filename,
            "source": source.name
        })

(OUT / "layers.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"Exported {len(manifest)} layers to {OUT}")
