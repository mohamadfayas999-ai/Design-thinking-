import os

port = os.getenv("PORT", "8000")
bind = f"0.0.0.0:{port}"
workers = int(os.getenv("WEB_CONCURRENCY", "1"))
threads = int(os.getenv("PYTHON_THREADS", "4"))
timeout = int(os.getenv("WEB_TIMEOUT", "120"))
accesslog = "-"
errorlog = "-"
