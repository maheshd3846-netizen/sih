"""
Operational HTTP API Server for Multi-Model Fusion Prototype
Serves REST API endpoints and static map-based dashboard.
Uses Python standard library ThreadingHTTPServer for zero-dependency, ultra-reliable execution.
"""
import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.utils.logger import setup_logger
from src.operational.engine import OperationalForecastEngine
from src.operational.live_engine import LiveForecastEngine

logger = setup_logger("OperationalServer")

# Initialize global singleton engines
ENGINE = OperationalForecastEngine()
LIVE_ENGINE = LiveForecastEngine()

class OperationalAPIHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status_code: int, data: Any):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API: System Health & Status
        if path == "/api/system/health":
            data = {
                "system_status": "ONLINE",
                "mode": "OPERATIONAL_PROTOTYPE",
                "core_fusion": "50/50 GFS + ECMWF Equal-Weight Ensemble",
                "confidence_engine": "EXP004 Disagreement Bins (Frozen May Thresholds)",
                "active_domain": "Andhra Pradesh & Telangana (12N-20N, 76E-85E)",
                "total_terrestrial_cells": 791,
                "loaded_samples": len(ENGINE.df_master) if ENGINE.df_master is not None else 0,
                "available_days": ENGINE.df_master["forecast_day"].nunique() if ENGINE.df_master is not None else 0,
                "data_integrity": "100% REAL DATA (Zero synthetic/interpolated values)",
                "timestamp_utc": datetime.utcnow().isoformat() + "Z"
            }
            self._send_json(200, data)
            return

        # 2. API: Available Dates
        if path == "/api/dates":
            dates = ENGINE.get_available_dates()
            self._send_json(200, {"status": "SUCCESS", "dates": dates})
            return

        # 3. API: Grid Forecast for Date
        if path == "/api/forecast":
            date_param = query.get("date", [None])[0]
            if not date_param:
                # Default to middle of peak monsoon
                date_param = "2024-07-15"
            result = ENGINE.get_grid_forecast(date_param)
            status_code = 200 if result["status"] == "SUCCESS" else 404
            self._send_json(status_code, result)
            return

        # 4. API: Point Forecast Query
        if path == "/api/forecast/point":
            lat = query.get("lat", [None])[0]
            lon = query.get("lon", [None])[0]
            date_param = query.get("date", ["2024-07-15"])[0]
            if lat is None or lon is None:
                self._send_json(400, {"status": "ERROR", "error": "Missing 'lat' or 'lon' query parameters."})
                return
            try:
                lat_f = float(lat)
                lon_f = float(lon)
            except ValueError:
                self._send_json(400, {"status": "ERROR", "error": "Invalid lat/lon float values."})
                return
            result = ENGINE.get_point_forecast(lat_f, lon_f, date_param)
            status_code = 200 if result["status"] == "SUCCESS" else 404
            self._send_json(status_code, result)
            return

        # 4b. API: Live 24-Hour NWP Forecast
        if path == "/api/live":
            refresh = query.get("refresh", ["false"])[0].lower() in ["true", "1"]
            date_param = query.get("date", [None])[0]
            target_d = None
            if date_param:
                try:
                    target_d = datetime.strptime(date_param, "%Y-%m-%d").date()
                except ValueError:
                    self._send_json(400, {
                        "status": "INVALID_DATE_FORMAT",
                        "mode": "LIVE",
                        "error": f"Invalid date: {date_param}. Expected YYYY-MM-DD."
                    })
                    return

            res = LIVE_ENGINE.generate_live_forecast(target_date=target_d, force_refresh=refresh)
            status_code = 200 if res.get("status") == "SUCCESS" else (
                503 if "UNAVAILABLE" in res.get("status", "") else 400
            )
            self._send_json(status_code, res)
            return

        # 4c. API: Live Forecasting Subsystem Status
        if path == "/api/live/status":
            res = LIVE_ENGINE.get_live_status()
            self._send_json(200, res)
            return

        # 4d. API: Live Point Forecast Query
        if path == "/api/live/point":
            lat = query.get("lat", [None])[0]
            lon = query.get("lon", [None])[0]
            if lat is None or lon is None:
                self._send_json(400, {
                    "status": "ERROR",
                    "mode": "LIVE",
                    "error": "Missing 'lat' or 'lon' query parameters."
                })
                return
            try:
                lat_f = float(lat)
                lon_f = float(lon)
            except ValueError:
                self._send_json(400, {
                    "status": "ERROR",
                    "mode": "LIVE",
                    "error": "Invalid lat/lon float values."
                })
                return
            res = LIVE_ENGINE.get_point_forecast(lat_f, lon_f)
            status_code = 200 if res.get("status") == "SUCCESS" else 404
            self._send_json(status_code, res)
            return

        # 5. API: Multi-Period Verification Metrics Summary
        if path == "/api/verification/summary":
            # Load from exp004_period_summary.csv if available
            csv_path = "results/metrics/exp004_period_summary.csv"
            if os.path.exists(csv_path):
                import pandas as pd
                df_sum = pd.read_csv(csv_path)
                data = df_sum.to_dict(orient="records")
                self._send_json(200, {"status": "SUCCESS", "metrics": data})
            else:
                self._send_json(404, {"status": "NOT_FOUND", "error": "Summary metrics file not found."})
            return

        # 5b. API: Disagreement Bin Metrics
        if path == "/api/verification/bins":
            csv_path = "results/metrics/exp004_disagreement_bins.csv"
            if os.path.exists(csv_path):
                import pandas as pd
                df_bins = pd.read_csv(csv_path)
                data = df_bins.to_dict(orient="records")
                self._send_json(200, {"status": "SUCCESS", "bins": data})
            else:
                self._send_json(404, {"status": "NOT_FOUND", "error": "Disagreement bins file not found."})
            return

        # 5c. API: Cross-Period Statistics
        if path == "/api/verification/cross-period":
            csv_path = "results/metrics/exp004_cross_period_statistics.csv"
            if os.path.exists(csv_path):
                import pandas as pd
                df_cross = pd.read_csv(csv_path)
                data = df_cross.to_dict(orient="records")
                self._send_json(200, {"status": "SUCCESS", "statistics": data})
            else:
                self._send_json(404, {"status": "NOT_FOUND", "error": "Cross-period statistics file not found."})
            return

        # 6. Static File Serving (Frontend Dashboard)
        static_dir = os.path.join(project_root, "frontend")
        rel_path = path.lstrip("/")
        if not rel_path or rel_path == "index.html":
            file_to_serve = os.path.join(static_dir, "index.html")
            content_type = "text/html; charset=utf-8"
        elif rel_path.endswith(".css"):
            file_to_serve = os.path.join(static_dir, rel_path)
            content_type = "text/css; charset=utf-8"
        elif rel_path.endswith(".js"):
            file_to_serve = os.path.join(static_dir, rel_path)
            content_type = "application/javascript; charset=utf-8"
        elif rel_path.endswith(".json") or rel_path.endswith(".geojson"):
            file_to_serve = os.path.join(static_dir, rel_path)
            content_type = "application/json; charset=utf-8"
        else:
            file_to_serve = os.path.join(static_dir, rel_path)
            content_type = "application/octet-stream"

        if os.path.exists(file_to_serve) and os.path.isfile(file_to_serve):
            with open(file_to_serve, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        else:
            self._send_json(404, {"status": "NOT_FOUND", "error": f"Path {path} not found."})

def run_server(port: int = 8080):
    server_address = ("127.0.0.1", port)
    httpd = ThreadingHTTPServer(server_address, OperationalAPIHandler)
    logger.info(f"Operational Prototype Server running at http://127.0.0.1:{port}/")
    print(f"Operational Prototype Server running at http://127.0.0.1:{port}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Stopping server...")
        httpd.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port)
