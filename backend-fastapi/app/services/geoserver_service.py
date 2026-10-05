import os
import httpx
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()


def get_geoserver_microservice_url() -> str:
    raw_url = os.getenv("GEOSERVER_MICROSERVICE_URL", "http://localhost:8005").rstrip("/")
    if "host.docker.internal" in raw_url:
        try:
            import socket
            socket.gethostbyname("host.docker.internal")
        except Exception:
            raw_url = raw_url.replace("host.docker.internal", "localhost")
    return raw_url


def get_geoserver_microservice_api_key() -> str:
    api_key = os.getenv("GEOSERVER_MICROSERVICE_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GEOSERVER_MICROSERVICE_API_KEY belum dikonfigurasi pada backend Biomass.",
        )
    return api_key


def get_geoserver_microservice_timeout() -> float:
    try:
        return float(os.getenv("GEOSERVER_MICROSERVICE_TIMEOUT", "60.0"))
    except (ValueError, TypeError):
        return 60.0


def get_geoserver_wms_url() -> str:
    return os.getenv("GEOSERVER_WMS_URL", "").rstrip("/")


def get_headers() -> dict:
    return {"X-API-Key": get_geoserver_microservice_api_key()}


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
    url = f"{get_geoserver_microservice_url()}{endpoint}"
    headers = kwargs.pop("headers", {})
    headers.update(get_headers())
    timeout = get_geoserver_microservice_timeout()

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


class GeoServerService:
    @staticmethod
    async def health_check():
        current_url = get_geoserver_microservice_url()
        try:
            data = await make_request("GET", "/api/v1/health")
            return {
                "status": "connected",
                "geoserver_microservice_url": current_url,
                "geoserver_wms_url": get_geoserver_wms_url() or "default",
                "data": data,
            }
        except Exception as e:
            return {
                "status": "error",
                "geoserver_microservice_url": current_url,
                "geoserver_wms_url": get_geoserver_wms_url() or "default",
                "error": str(e),
            }

    # --- Workspaces ---
    @staticmethod
    async def get_workspaces():
        response = await make_request("GET", "/api/v1/workspaces")
        workspaces = response.get("data", []) if isinstance(response, dict) else response
        normalized = []
        for workspace in workspaces if isinstance(workspaces, list) else []:
            if not isinstance(workspace, dict):
                continue
            workspace_name = (
                workspace.get("workspace_name")
                or workspace.get("ws_name")
                or workspace.get("name")
            )
            if not workspace_name:
                continue
            normalized.append({
                **workspace,
                "id": workspace.get("id") or workspace_name,
                "name": workspace.get("display_name") or workspace.get("name") or workspace_name,
                "ws_name": workspace_name,
                "workspace_name": workspace_name,
            })
        return normalized

    @staticmethod
    async def get_target_workspace() -> Dict[str, Any]:
        """Resolve one backend-controlled workspace for all Biomass publishes.

        GEOSERVER_WORKSPACE_NAME is preferred. When it is not configured, an
        API key with exactly one visible workspace is unambiguous and safe to
        use. Never silently select one when the key sees multiple workspaces.
        """
        workspaces = await GeoServerService.get_workspaces()
        configured_name = os.getenv("GEOSERVER_WORKSPACE_NAME", "").strip()

        if configured_name:
            for workspace in workspaces:
                technical_name = workspace.get("workspace_name") or workspace.get("ws_name")
                if technical_name == configured_name:
                    return workspace
            raise HTTPException(
                status_code=503,
                detail=(
                    "Workspace Biomass yang dikonfigurasi tidak tersedia untuk API key ini. "
                    "Pastikan GEOSERVER_WORKSPACE_NAME cocok dengan workspace milik API key."
                ),
            )

        if len(workspaces) == 1:
            return workspaces[0]
        if not workspaces:
            raise HTTPException(
                status_code=503,
                detail="API key GeoServer belum memiliki workspace. Minta administrator menyiapkan workspace Biomass.",
            )
        raise HTTPException(
            status_code=503,
            detail=(
                "API key GeoServer memiliki beberapa workspace. Administrator harus menetapkan "
                "GEOSERVER_WORKSPACE_NAME di backend Biomass."
            ),
        )

    # --- Layers ---
    @staticmethod
    async def get_layers(params: dict = None):
        response = await make_request("GET", "/api/v1/layers/my-layers", params=params or {})
        layers = response.get("data", []) if isinstance(response, dict) else response
        if not isinstance(layers, list):
            layers = []
        for layer in layers:
            if not isinstance(layer, dict):
                continue
            layer_type = layer.get("layer_type") or layer.get("type") or layer.get("layerType")
            layer["layer_type"] = layer_type
            layer["type"] = layer.get("type") or layer_type
            layer["geoserver_name"] = (
                layer.get("geoserver_name")
                or layer.get("table_name")
                or layer.get("store_name")
                or layer.get("layer_name")
            )
            if layer.get("workspace_name") and layer.get("geoserver_name"):
                layer["wms_layers_param"] = layer.get("wms_layers_param") or (
                    f"{layer['workspace_name']}:{layer['geoserver_name']}"
                )
            symbology = layer.get("symbology") or layer.get("saved_symbology")
            if symbology:
                layer["symbology"] = symbology
                if isinstance(symbology, dict):
                    layer["style_name"] = layer.get("style_name") or symbology.get("style_name")
        return {"success": True, "total": len(layers), "data": layers}

    @staticmethod
    async def publish_layer(file_bytes: bytes, filename: str, content_type: str, form_data: dict):
        VECTOR_EXTENSIONS = ('.shp', '.zip', '.geojson', '.json', '.gpkg', '.csv', '.kml', '.kmz')
        ext = os.path.splitext(filename or "")[1].lower()
        endpoint = "/api/v1/layers/publish-vector" if ext in VECTOR_EXTENSIONS else "/api/v1/layers/publish-raster"
        files = {"file": (filename, file_bytes, content_type)}
        target_workspace = await GeoServerService.get_target_workspace()
        normalized_data = {
            key: value
            for key, value in dict(form_data).items()
            if key not in {"workspace_name", "workspace_id"}
        }
        normalized_data["workspace_name"] = target_workspace["workspace_name"]
        return await make_request("POST", endpoint, files=files, data=normalized_data)

    @staticmethod
    async def publish_from_url(payload: dict):
        # Fallback helper: jika ada url, unduh berkas lalu unggah via multipart
        file_url = payload.get("file_url") or payload.get("url")
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
        return await GeoServerService.publish_layer(
            file_bytes=file_bytes,
            filename=filename,
            content_type=content_type,
            form_data={"layer_name": layer_name}
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
        layers_data = await GeoServerService.get_layers()
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

        timeout = get_geoserver_microservice_timeout()
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
        target_workspace = await GeoServerService.get_target_workspace()
        return await make_request(
            "GET",
            "/api/v1/layer-groups",
            params={"workspace_id": target_workspace.get("id") or target_workspace["workspace_name"]},
        )

    @staticmethod
    async def create_layer_group(payload: dict):
        target_workspace = await GeoServerService.get_target_workspace()
        group_payload = {
            key: value
            for key, value in payload.items()
            if key not in {"workspace_id", "workspace_name"}
        }
        group_payload["workspace_name"] = target_workspace["workspace_name"]
        return await make_request("POST", "/api/v1/layer-groups", json=group_payload)

    @staticmethod
    async def update_layer_group(group_id: Any, payload: dict):
        return await make_request("PUT", f"/api/v1/layer-groups/{group_id}", json=payload)

    @staticmethod
    async def delete_layer_group(group_id: Any):
        return await make_request("DELETE", f"/api/v1/layer-groups/{group_id}")
