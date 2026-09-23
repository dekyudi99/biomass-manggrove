import os
import httpx
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()


def get_astragis_url() -> str:
    return os.getenv("ASTRAGIS_API_URL", "http://host.docker.internal:8001").rstrip("/")


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
    Helper untuk melakukan request S2S ke AstraGIS dengan menyertakan X-API-Key.
    """
    url = f"{get_astragis_url()}{endpoint}"
    headers = kwargs.pop("headers", {})
    headers.update(get_headers())
    timeout = get_astragis_timeout()

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.request(method, url, headers=headers, **kwargs)
            # Forward response status dan json
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                    detail = error_data.get("detail", response.text)
                except Exception:
                    detail = response.text or f"AstraGIS error: status {response.status_code}"
                raise HTTPException(status_code=response.status_code, detail=detail)

            try:
                data = response.json()
                return format_wms_urls(data)
            except Exception:
                return {"success": True, "detail": response.text}
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Gagal menghubungi server AstraGIS di {url}: {str(exc)}",
            )


class AstraGISService:
    @staticmethod
    async def health_check():
        current_url = get_astragis_url()
        try:
            data = await make_request("GET", "/s2s/workspaces")
            return {
                "status": "connected",
                "astragis_url": current_url,
                "geoserver_wms_url": get_geoserver_wms_url() or "default",
                "data": data,
            }
        except Exception as e:
            return {
                "status": "error",
                "astragis_url": current_url,
                "geoserver_wms_url": get_geoserver_wms_url() or "default",
                "error": str(e),
            }

    # --- Workspaces ---
    @staticmethod
    async def get_workspaces():
        return await make_request("GET", "/s2s/workspaces")

    @staticmethod
    async def create_workspace(payload: dict):
        return await make_request("POST", "/s2s/workspaces", json=payload)

    @staticmethod
    async def update_workspace(workspace_id: int, payload: dict):
        return await make_request("PUT", f"/s2s/workspaces/{workspace_id}", json=payload)

    @staticmethod
    async def delete_workspace(workspace_id: int):
        return await make_request("DELETE", f"/s2s/workspaces/{workspace_id}")

    # --- Layers ---
    @staticmethod
    async def get_layers(params: dict = None):
        return await make_request("GET", "/s2s/layers", params=params or {})

    @staticmethod
    async def publish_layer(file_bytes: bytes, filename: str, content_type: str, form_data: dict):
        VECTOR_EXTENSIONS = ('.shp', '.zip', '.geojson', '.json', '.gpkg', '.csv')
        ext = os.path.splitext(filename or "")[1].lower()
        endpoint = "/s2s/publish-vector" if ext in VECTOR_EXTENSIONS else "/s2s/publish"
        files = {"file": (filename, file_bytes, content_type)}
        return await make_request("POST", endpoint, files=files, data=form_data)

    @staticmethod
    async def publish_from_url(payload: dict):
        return await make_request("POST", "/s2s/publish-from-url", json=payload)

    @staticmethod
    async def update_layer_style(layer_id: int, payload: dict):
        return await make_request("POST", f"/s2s/layers/{layer_id}/style", json=payload)

    @staticmethod
    async def delete_layer(layer_id: int):
        return await make_request("DELETE", f"/s2s/layers/{layer_id}")

    @staticmethod
    async def download_layer(
        layer_id: int,
        format: str = "tiff",
        styled: bool = True,
        width: Optional[int] = None,
        height: Optional[int] = None,
    ):
        url = f"{get_astragis_url()}/s2s/layers/{layer_id}/download"
        headers = get_headers()
        params = {"format": format, "styled": str(styled).lower()}
        if width:
            params["width"] = width
        if height:
            params["height"] = height
        timeout = get_astragis_timeout()

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.get(url, headers=headers, params=params)
                if response.status_code >= 400:
                    try:
                        detail = response.json().get("detail", response.text)
                    except Exception:
                        detail = response.text
                    raise HTTPException(status_code=response.status_code, detail=detail)
                return (
                    response.content,
                    response.headers.get("content-type", "application/octet-stream"),
                    response.headers.get("content-disposition", ""),
                )
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Gagal mengunduh layer dari AstraGIS: {str(exc)}",
                )

    # --- Layer Groups ---
    @staticmethod
    async def get_layer_groups():
        return await make_request("GET", "/s2s/layer-groups")

    @staticmethod
    async def create_layer_group(payload: dict):
        return await make_request("POST", "/s2s/layer-groups", json=payload)

    @staticmethod
    async def update_layer_group(group_id: int, payload: dict):
        return await make_request("PUT", f"/s2s/layer-groups/{group_id}", json=payload)

    @staticmethod
    async def delete_layer_group(group_id: int):
        return await make_request("DELETE", f"/s2s/layer-groups/{group_id}")
