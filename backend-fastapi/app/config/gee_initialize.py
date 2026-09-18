import os
from dotenv import load_dotenv
import ee

load_dotenv()

EE_PROJECT_ID = os.getenv("EE_PROJECT_ID")
EE_SERVICE_ACCOUNT = os.getenv("EE_SERVICE_ACCOUNT")
EE_KEY_FILE_PATH = os.getenv("EE_KEY_FILE_PATH")

try:
    if EE_SERVICE_ACCOUNT and EE_KEY_FILE_PATH and os.path.exists(EE_KEY_FILE_PATH):
        # Autentikasi otomatis menggunakan file Service Account JSON
        credentials = ee.ServiceAccountCredentials(EE_SERVICE_ACCOUNT, EE_KEY_FILE_PATH)
        try:
            ee.Initialize(credentials)
            print(">>> Google Earth Engine berhasil diinisialisasi via Service Account!")
        except Exception as init_err:
            if EE_PROJECT_ID:
                ee.Initialize(credentials, project=EE_PROJECT_ID)
                print(f">>> Google Earth Engine diinisialisasi dengan project: {EE_PROJECT_ID}")
            else:
                raise init_err
    else:
        # Fallback jika dijalankan tanpa Service Account
        if EE_PROJECT_ID:
            ee.Initialize(project=EE_PROJECT_ID)
        else:
            ee.Initialize()
        print(">>> Google Earth Engine diinisialisasi via Default Project.")
except Exception as e:
    print(f">>> Gagal inisialisasi Earth Engine: {e}")
