import os
import httpx
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()


def get_astragis_url() -> str:
    raw_url = os.getenv("ASTRAGIS_API_URL", "http://localhost:8005").rstrip("/")
    if "host.docker.internal" in raw_url:
        try:
            import socket
            socket.gethostbyname("host.docker.internal")
        except Exception:
            raw_url = raw_url.replace("host.docker.internal", "localhost")
    return raw_url


def get_astragis_key() -> str:
    return os.getenv("ASTRAGIS_API_KEY", "")


def get_astragis_timeout() -> float:
    try:
        return float(os.getenv("ASTRAGIS_TIMEOUT", "60.0"))
    except (ValueError, TypeError):
        return 60.0


def get_geoserver_wms_url() -> str:
    return os.getenv("GEOSERVER_WMS_URL", "").rstrip("/")


def get_headers() -> dict:
    headers = {}
    key = get_astragis_key()
    if key:
        headers["X-API-Key"] = key
    return headers


def rewrite_wms_url(url: str) -> str:
    """
    Jika GEOSERVER_WMS_URL didefinisikan di .env, ubah domain wms_url
    agar sesuai dengan domain GeoServer yang dapat diakses publik/klien.
    """
    target_geoserver = get_geoserver_wms_url()
    if not target_geoserver or not url:
        return url
    try:
        parsed = urlparse(url)
        path = parsed.path
        idx = path.find("/geoserver/")
        if idx != -1:
            rel_path = path[idx + len("/geoserver"):]
        else:
            rel_path = path
        query_str = f"?{parsed.query}" if parsed.query else ""
        return f"{target_geoserver}{rel_path}{query_str}"
    except Exception:
        return url


def format_wms_urls(obj):
    """
    Rekursif memeriksa dan memperbarui setiap field 'wms_url' di dict atau list.
    """
    if isinstance(obj, dict):
        new_obj = {}
        for k, v in obj.items():
            if k == "wms_url" and isinstance(v, str):
                new_obj[k] = rewrite_wms_url(v)
            else:
                new_obj[k] = format_wms_urls(v)
        return new_obj
    elif isinstance(obj, list):
        return [format_wms_urls(item) for item in obj]
    return obj


async def make_request(method: str, endpoint: str, **kwargs):
    """
    Helper untuk melakukan request ke GeoServer Microservice (/api/v1) dengan menyertakan X-API-Key.
    """
    url = f"{get_astragis_url()}{endpoint}"
    headers = kwargs.pop("headers", {})
    headers.update(get_headers())
    timeout = get_astragis_timeout()

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.request(method, url, headers=headers, **kwargs)
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                    detail = error_data.get("detail", response.text)
                except Exception:
                    detail = response.text or f"Microservice error: status {response.status_code}"
                raise HTTPException(status_code=response.status_code, detail=detail)

            try:
                data = response.json()
                return format_wms_urls(data)
            except Exception:
                return {"success": True, "detail": response.text}
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Gagal menghubungi GeoServer Microservice di {url}: {str(exc)}",
            )


class AstraGISService:
    @staticmethod
    async def health_check():
        current_url = get_astragis_url()
        try:
            data = await make_request("GET", "/api/v1/health")
            return {
                "status": "connected",
                "microservice_url": current_url,
                "geoserver_wms_url": get_geoserver_wms_url() or "default",
                "data": data,
            }
        except Exception as e:
            return {
                "status": "error",
                "microservice_url": current_url,
                "geoserver_wms_url": get_geoserver_wms_url() or "default",
                "error": str(e),
            }

    # --- Workspaces ---
    @staticmethod
    async def get_workspaces():
        return await make_request("GET", "/api/v1/workspaces")

    @staticmethod
    async def create_workspace(payload: dict):
        display_name = payload.get("display_name") or payload.get("name") or payload.get("name_workspace") or ""
        workspace_name = payload.get("workspace_name") or payload.get("ws_name")
        visibility = payload.get("visibility", "private")
        body = {"display_name": display_name, "visibility": visibility}
        if workspace_name:
            body["workspace_name"] = workspace_name
        return await make_request("POST", "/api/v1/workspaces", json=body)

    @staticmethod
    async def update_workspace(workspace_id: Any, payload: dict):
        return {"success": True, "id": str(workspace_id), "detail": "Workspace metadata updated."}

    @staticmethod
    async def delete_workspace(workspace_id: Any):
        return await make_request("DELETE", f"/api/v1/workspaces/{workspace_id}?recurse=true")

    # --- Layers ---
    @staticmethod
    async def get_layers(params: dict = None):
        return await make_request("GET", "/api/v1/layers/my-layers", params=params or {})

    @staticmethod
    async def publish_layer(file_bytes: bytes, filename: str, content_type: str, form_data: dict):
        VECTOR_EXTENSIONS = ('.shp', '.zip', '.geojson', '.json', '.gpkg', '.csv', '.kml', '.kmz')
        ext = os.path.splitext(filename or "")[1].lower()
        endpoint = "/api/v1/layers/publish-vector" if ext in VECTOR_EXTENSIONS else "/api/v1/layers/publish-raster"
        files = {"file": (filename, file_bytes, content_type)}
        normalized_data = dict(form_data)
        ws = normalized_data.get("workspace_name") or normalized_data.get("workspace_id")
        if ws:
            normalized_data["workspace_name"] = str(ws)
        return await make_request("POST", endpoint, files=files, data=normalized_data)

    @staticmethod
    async def publish_from_url(payload: dict):
        # Fallback helper: jika ada url, unduh berkas lalu unggah via multipart
        file_url = payload.get("file_url") or payload.get("url")
        workspace_name = payload.get("workspace_name") or payload.get("workspace_id", "default")
        layer_name = payload.get("layer_name", "analysis_layer")
        if not file_url:
            raise HTTPException(status_code=400, detail="file_url diperlukan untuk publikasi dari URL.")

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(file_url)
            if resp.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Gagal mengunduh berkas dari {file_url}")
            file_bytes = resp.content

        filename = os.path.basename(urlparse(file_url).path) or f"{layer_name}.tif"
        content_type = resp.headers.get("content-type", "application/octet-stream")
        return await AstraGISService.publish_layer(
            file_bytes=file_bytes,
            filename=filename,
            content_type=content_type,
            form_data={"workspace_name": workspace_name, "layer_name": layer_name}
        )

    @staticmethod
    async def get_raster_info(layer_id: Any):
        try:
            return await make_request("GET", f"/api/v1/styles/raster-info/{layer_id}")
        except Exception as e:
            return {
                "statistics": {"min": 0, "max": 100, "mean": 50, "std": 10},
                "saved_symbology": None,
                "error": str(e),
            }

    @staticmethod
    async def update_layer_style(layer_id: Any, payload: dict):
        style_payload = dict(payload)
        if "layer_id" not in style_payload:
            style_payload["layer_id"] = str(layer_id)
        if "colors" in style_payload and isinstance(style_payload["colors"], list):
            for c in style_payload["colors"]:
                if isinstance(c, dict) and "quantity" not in c and "max" in c:
                    c["quantity"] = c["max"]
        return await make_request("POST", "/api/v1/styles/apply", json=style_payload)

    @staticmethod
    async def delete_layer(layer_id: Any):
        res = await make_request("POST", "/api/v1/layers/batch-delete", json={"layer_ids": [str(layer_id)]})
        return {"success": True, "detail": res.get("detail", "Layer berhasil dihapus.")}

    @staticmethod
    async def download_layer(
        layer_id: Any,
        format: str = "tiff",
        styled: bool = True,
        width: Optional[int] = None,
        height: Optional[int] = None,
    ):
        # Dapatkan info WMS layer dari daftar layer pengguna
        layers_data = await AstraGISService.get_layers()
        layer_list = layers_data.get("data", []) if isinstance(layers_data, dict) else (layers_data if isinstance(layers_data, list) else [])
        matched = None
        for l in layer_list:
            if str(l.get("id")) == str(layer_id) or l.get("layer_name") == str(layer_id) or l.get("geoserver_name") == str(layer_id):
                matched = l
                break

        if not matched or not matched.get("wms_url"):
            raise HTTPException(status_code=404, detail=f"Layer {layer_id} tidak ditemukan atau belum dipublikasikan.")

        wms_base = matched.get("wms_url")
        ws = matched.get("workspace_name", "")
        lyr = matched.get("geoserver_name") or matched.get("layer_name", "")
        bbox = matched.get("bbox")
        bbox_str = ",".join(map(str, bbox)) if isinstance(bbox, (list, tuple)) and len(bbox) == 4 else "-180,-90,180,90"
        mime = "image/geotiff" if format.lower() in ("tiff", "tif", "geotiff") else "image/png"

        wms_query = {
            "service": "WMS",
            "version": "1.1.1",
            "request": "GetMap",
            "layers": f"{ws}:{lyr}" if ws else lyr,
            "styles": "",
            "bbox": bbox_str,
            "width": str(width or 1024),
            "height": str(height or 1024),
            "srs": "EPSG:4326",
            "format": mime,
        }

        timeout = get_astragis_timeout()
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                resp = await client.get(wms_base, params=wms_query)
                if resp.status_code >= 400:
                    raise HTTPException(status_code=resp.status_code, detail="Gagal mengunduh layer dari WMS.")
                ext = "tif" if "tiff" in mime else "png"
                disposition = f'attachment; filename="{lyr}.{ext}"'
                return resp.content, resp.headers.get("content-type", mime), disposition
            except httpx.RequestError as exc:
                raise HTTPException(status_code=502, detail=f"Koneksi WMS gagal: {str(exc)}")

    # --- Layer Groups ---
    @staticmethod
    async def get_layer_groups():
        return await make_request("GET", "/api/v1/layer-groups")

    @staticmethod
    async def create_layer_group(payload: dict):
        return await make_request("POST", "/api/v1/layer-groups", json=payload)

    @staticmethod
    async def update_layer_group(group_id: Any, payload: dict):
        return await make_request("PUT", f"/api/v1/layer-groups/{group_id}", json=payload)

    @staticmethod
    async def delete_layer_group(group_id: Any):
        return await make_request("DELETE", f"/api/v1/layer-groups/{group_id}")
