from supabase import create_client, Client
from app.config import Settings

MIME_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

EXT_MIME = {v: k for k, v in MIME_EXT.items()}


class EvidenceStorage:
    def __init__(self, settings: Settings):
        self.enabled = settings.enable_image_storage
        self.bucket_name = settings.supabase_bucket_name
        self.supabase_url = settings.supabase_url
        self.supabase_key = settings.supabase_secret_key
        
        if self.enabled and self.supabase_url and self.supabase_key:
            self.client = create_client(self.supabase_url, self.supabase_key)
        else:
            self.client = None

        # GCS compatibility config
        self.gcs_enabled = bool(settings.google_cloud_project and settings.gcs_bucket_name)
        self.gcs_bucket_name = settings.gcs_bucket_name
        self._gcs_client = None

    @property
    def gcs_client(self):
        if self._gcs_client is None and self.gcs_enabled:
            from google.cloud import storage
            self._gcs_client = storage.Client()
        return self._gcs_client

    def upload_image(self, report_id: str, image_bytes: bytes | None, mime_type: str | None) -> str | None:
        if not self.enabled or self.client is None or not image_bytes or not mime_type:
            return None

        ext = MIME_EXT.get(mime_type)
        if not ext:
            raise RuntimeError(f"Unsupported image MIME type: {mime_type}")

        object_name = f"reports/{report_id}/evidence.{ext}"
        
        # Upload to Supabase Storage
        self.client.storage.from_(self.bucket_name).upload(
            path=object_name,
            file=image_bytes,
            file_options={"content-type": mime_type, "x-upsert": "true"}
        )

        return f"supabase://{self.bucket_name}/{object_name}"

    def download_by_gcs_uri(self, uri: str) -> tuple[bytes, str]:
        if uri.startswith("supabase://"):
            if self.client is None:
                raise RuntimeError("Supabase storage client disabled/unconfigured")
            
            # Parse supabase://bucket/path
            path = uri.replace("supabase://", "", 1)
            bucket_name, object_name = path.split("/", 1)
            
            data = self.client.storage.from_(bucket_name).download(object_name)
            
            # Map extension to mime type
            ext = object_name.split(".")[-1].lower()
            mime_type = EXT_MIME.get(ext, "application/octet-stream")
            return data, mime_type

        elif uri.startswith("gs://"):
            if not self.gcs_client:
                raise RuntimeError("GCS storage client disabled/unconfigured")
            
            path = uri.replace("gs://", "", 1)
            bucket_name, object_name = path.split("/", 1)
            
            bucket = self.gcs_client.bucket(bucket_name)
            blob = bucket.blob(object_name)
            
            data = blob.download_as_bytes()
            mime_type = blob.content_type or "application/octet-stream"
            return data, mime_type
            
        else:
            raise RuntimeError(f"Invalid or unsupported storage URI: {uri}")