import ee
import geopandas as gpd
import rasterio
from rasterio.mask import mask
from rasterio.merge import merge
import numpy as np
import joblib
import requests
import json
import os

# choose the algorithm
TARGET_ALGO = "XGBoost"

ee.Authenticate()
ee.Initialize(project='ee-raditiaoffice')

print(f"loading model from {TARGET_ALGO}...")
model_path = f"{TARGET_ALGO}/best_model.pkl"
local_model = joblib.load(model_path)

gdf = gpd.read_file('./province/province.shp').to_crs("EPSG:4326")
gdf = gdf.dissolve(by='PROV_NAM_E').reset_index()

START_DATE = '2026-03-01'
END_DATE = '2026-03-31'

# main loop for each province
for idx, row in gdf.iterrows():
    prov_name = str(row.get('PROV_NAM_E', f'Province_{idx}')).replace("Changwat ", "").strip()
    print(f"\n==========================================")
    print(f"processing province {prov_name} (Model: {TARGET_ALGO})")
    
    geom_json = json.loads(gpd.GeoSeries([row['geometry']]).to_json())['features'][0]['geometry']
    province_poly = ee.Geometry(geom_json)
    
    minx, miny, maxx, maxy = row['geometry'].bounds
    grid_size = 0.1  
    x_coords = np.arange(minx, maxx, grid_size)
    y_coords = np.arange(miny, maxy, grid_size)
    
    tile_files = []
    tile_counter = 0
    
    for x in x_coords:
        for y in y_coords:
            tile_geom = ee.Geometry.Rectangle([x, y, x + grid_size, y + grid_size])
            intersection = tile_geom.intersection(province_poly, ee.ErrorMargin(1))
            
            try:
                s1 = ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(tile_geom).filterDate(START_DATE, END_DATE).filter(ee.Filter.eq('instrumentMode', 'IW')).filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')).filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH')).select(['VV', 'VH']).median()
                
                def mask_s2_clouds(image):
                    qa = image.select('QA60')
                    return image.updateMask(qa.bitwiseAnd(1<<10).eq(0).And(qa.bitwiseAnd(1<<11).eq(0))).divide(10000)

                s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(tile_geom).filterDate(START_DATE, END_DATE).filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30)).map(mask_s2_clouds)
                ndvi = s2_collection.median().normalizedDifference(['B8', 'B4']).rename('NDVI')
                
                img_tile = s1.addBands(ndvi).select(['VV', 'VH', 'NDVI']).clip(intersection)
                
                temp_tif = f"temp_{prov_name}_{tile_counter}.tif"
                pred_tif = f"pred_{prov_name}_{tile_counter}.tif"
                
                url = img_tile.getDownloadUrl({'scale': 10, 'crs': 'EPSG:4326', 'region': tile_geom, 'format': 'GEO_TIFF'})
                res = requests.get(url)
                if res.status_code == 200 and len(res.content) > 1000:
                    with open(temp_tif, 'wb') as f:
                        f.write(res.content)
                        
                    with rasterio.open(temp_tif) as src:
                        profile = src.profile
                        profile.update(count=1, dtype=rasterio.float32, nodata=-9999)
                        img_data = src.read()
                        c, h, w = img_data.shape
                        
                        img_2d = img_data.transpose(1, 2, 0).reshape(-1, c)
                        valid_mask = np.any(img_2d != 0, axis=1)
                        pred_2d = np.full(img_2d.shape[0], -9999, dtype=np.float32)
                        
                        if np.any(valid_mask):
                            valid_pixels = np.nan_to_num(img_2d[valid_mask])
                            pred_2d[valid_mask] = local_model.predict(valid_pixels)
                        
                        agb_block = pred_2d.reshape(1, h, w)
                        with rasterio.open(pred_tif, 'w', **profile) as dst:
                            dst.write(agb_block)
                            
                    tile_files.append(pred_tif)
                    tile_counter += 1
                
                if os.path.exists(temp_tif): os.remove(temp_tif)
            except Exception as e:
                continue
                
    if tile_files:
        src_files_to_mosaic = [rasterio.open(tf) for tf in tile_files]
        mosaic, out_trans = merge(src_files_to_mosaic)
        
        out_meta = src_files_to_mosaic[0].meta.copy()
        out_meta.update({"height": mosaic.shape[1], "width": mosaic.shape[2], "transform": out_trans, "crs": "EPSG:4326", "nodata": -9999})
        
        output_final = os.path.join(TARGET_ALGO, f"AGB_Map_{prov_name}.tif")
        with rasterio.open(output_final, "w", **out_meta) as dest:
            dest.write(mosaic)
            
        for src in src_files_to_mosaic: src.close()
        for tf in tile_files:
            if os.path.exists(tf): os.remove(tf)
                
        print(f"success. saved in {output_final}")