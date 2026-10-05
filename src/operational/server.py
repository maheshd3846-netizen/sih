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
import gzip
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.utils.logger import setup_logger
from src.operational.engine import OperationalForecastEngine
from src.operational.live_engine import LiveForecastEngine
from src.operational.v2_engine import V2OperationalEngine

logger = setup_logger("OperationalServer")

# Initialize global singleton engines
ENGINE = OperationalForecastEngine()
LIVE_ENGINE = LiveForecastEngine()
V2_ENGINE = V2OperationalEngine()

class OperationalAPIHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept-Encoding")

    def _send_json(self, status_code: int, data: Any):
        try:
            body = json.dumps(data, separators=(",", ":")).encode("utf-8")
            accept_encoding = self.headers.get("Accept-Encoding", "") if hasattr(self, "headers") else ""
            use_gzip = "gzip" in accept_encoding and len(body) > 1024
            if use_gzip:
                body = gzip.compress(body, compresslevel=6)

            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            if use_gzip:
                self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(body)))
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

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
                "timestamp_utc": datetime.now(timezone.utc).isoformat()
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
            var_param = query.get("variable", ["precipitation"])[0]
            lead_param = int(query.get("lead", [24])[0])

            if var_param != "precipitation" or lead_param != 24:
                self._send_json(400, {
                    "status": "LIVE_PARAM_NOT_SUPPORTED",
                    "mode": "LIVE",
                    "variable": var_param,
                    "lead_hours": lead_param,
                    "error": f"Live stream currently ingests 24h precipitation only. {var_param.capitalize()} at +{lead_param}h is available in Retrospective mode.",
                    "available_mode": "retrospective"
                })
                return

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

        # =========================================================================
        # V2 COMPLIANCE API ENDPOINTS
        # =========================================================================

        # 10. V2 API: System Health & Multi-Variable Capabilities
        if path == "/api/v2/system/health":
            health = {
                "system_status": "ONLINE",
                "version": "2.0.0-COMPLIANCE",
                "ai_blending_engine": "Context-Aware Dynamic AI Simplex Weight Allocator (M_AI)",
                "weight_constraints": "w_GFS >= 0, w_ECMWF >= 0, w_GFS + w_ECMWF == 1.0 (Strict Convex Simplex)",
                "supported_variables": ["precipitation", "temperature", "wind"],
                "supported_leads_hours": [24, 48, 72],
                "active_domain": "Andhra Pradesh & Telangana (12N-20N, 76E-85E)",
                "total_terrestrial_cells": 791,
                "loaded_samples": len(V2_ENGINE.df_master) if V2_ENGINE.df_master is not None else 0,
                "extreme_guidance_protocols": {
                    "heavy_rainfall": "IMD Pune 24-Hour Rainfall Classification",
                    "heat_wave": "IMD New Delhi Heat Wave Standard",
                    "high_wind": "IMD/WMO Beaufort Wind and Squall Scale"
                },
                "probabilistic_policy": "Zero Fabricated Probabilities. Deterministic Exceedance + Agreement Flags.",
                "data_integrity": "100% REAL NWP DATA. Missing verification tagged PENDING_OBSERVATIONS.",
                "timestamp_utc": datetime.now(timezone.utc).isoformat()
            }
            self._send_json(200, health)
            return

        # 11. V2 API: Available Dates & Metadata
        if path == "/api/v2/dates":
            dates = V2_ENGINE.get_available_dates()
            self._send_json(200, {"status": "SUCCESS", "dates": dates})
            return

        # 12. V2 API: Multi-Variable, Multi-Lead Grid Forecast
        if path == "/api/v2/forecast":
            date_param = query.get("date", ["2024-07-15"])[0]
            var_param = query.get("variable", ["precipitation"])[0]
            lead_param = int(query.get("lead", [24])[0])
            result = V2_ENGINE.get_grid_forecast(date_param, variable=var_param, lead_hours=lead_param)
            status_code = 200 if result.get("status") == "SUCCESS" else 400
            self._send_json(status_code, result)
            return

        # 13. V2 API: Multi-Variable Point Query
        if path == "/api/v2/forecast/point":
            lat = query.get("lat", [None])[0]
            lon = query.get("lon", [None])[0]
            date_param = query.get("date", ["2024-07-15"])[0]
            var_param = query.get("variable", ["precipitation"])[0]
            lead_param = int(query.get("lead", [24])[0])
            if lat is None or lon is None:
                self._send_json(400, {"status": "ERROR", "error": "Missing 'lat' or 'lon' query parameters."})
                return
            try:
                lat_f = float(lat)
                lon_f = float(lon)
            except ValueError:
                self._send_json(400, {"status": "ERROR", "error": "Invalid lat/lon float values."})
                return
            result = V2_ENGINE.get_point_forecast(lat_f, lon_f, date_param, variable=var_param, lead_hours=lead_param)
            status_code = 200 if result.get("status") == "SUCCESS" else 404
            self._send_json(status_code, result)
            return

        # 14. V2 API: Dedicated Model Weight Maps
        if path == "/api/v2/weights/map":
            date_param = query.get("date", ["2024-07-15"])[0]
            var_param = query.get("variable", ["precipitation"])[0]
            lead_param = int(query.get("lead", [24])[0])
            grid_res = V2_ENGINE.get_grid_forecast(date_param, variable=var_param, lead_hours=lead_param)
            if grid_res.get("status") != "SUCCESS":
                self._send_json(400, grid_res)
                return

            weight_cells = []
            for p in grid_res["points"]:
                weight_cells.append({
                    "lat": p["lat"],
                    "lon": p["lon"],
                    "subregion": p["subregion"],
                    "w_gfs": p["w_gfs"],
                    "w_ecmwf": p["w_ecmwf"],
                    "delta_w_ai": p["delta_w_ai"],
                    "dominant_model": p["dominant_model"],
                    "weight_entropy": p["weight_entropy"],
                    "attribution": p["attribution"]
                })

            self._send_json(200, {
                "status": "SUCCESS",
                "forecast_date": date_param,
                "variable": var_param,
                "lead_hours": lead_param,
                "total_cells": len(weight_cells),
                "summary": grid_res["domain_summary"],
                "weights": weight_cells
            })
            return

        # 15. V2 API: Extreme Weather Guidance Summary
        if path in ("/api/v2/extremes", "/api/v2/extremes/summary"):
            date_param = query.get("date", ["2024-07-15"])[0]
            var_param = query.get("variable", ["precipitation"])[0]
            lead_param = int(query.get("lead", [24])[0])
            grid_res = V2_ENGINE.get_grid_forecast(date_param, variable=var_param, lead_hours=lead_param)
            if grid_res.get("status") != "SUCCESS":
                self._send_json(400, grid_res)
                return

            alert_cells = [
                {
                    "lat": p["lat"],
                    "lon": p["lon"],
                    "subregion": p["subregion"],
                    "blended_val": p["blended_val"],
                    "disagreement": p["disagreement"],
                    "confidence_class": p["confidence_class"],
                    "extreme_guidance": p["extreme_guidance"]
                }
                for p in grid_res["points"]
                if p.get("extreme_guidance") and p["extreme_guidance"]["severity_score"] >= 1
            ]

            self._send_json(200, {
                "status": "SUCCESS",
                "forecast_date": date_param,
                "variable": var_param,
                "lead_hours": lead_param,
                "summary": grid_res["domain_summary"]["extreme_events"],
                "active_alerts": alert_cells
            })
            return

        # 16. V2 API: Statistical Verification Audit & Acceptance Gate Report
        if path == "/api/v2/verification/audit":
            # Load from exp004 benchmark data and run acceptance gate
            if V2_ENGINE.df_master is not None and not V2_ENGINE.df_master.empty:
                from src.verification.acceptance_gate import StatisticalAcceptanceGate
                sub_test = V2_ENGINE.df_master[V2_ENGINE.df_master["period"] == "Period 3 (August)"]
                if sub_test.empty:
                    sub_test = V2_ENGINE.df_master
                gate_res = StatisticalAcceptanceGate.audit_candidate_against_baselines(
                    test_df=sub_test,
                    candidate_col="model7_combined",
                    baseline_col="model3_ensemble_50_50",
                    variable_name="precipitation",
                    lead_hours=24,
                    n_bootstrap=500
                )
                self._send_json(200, {"status": "SUCCESS", "audit": gate_res})
            else:
                self._send_json(503, {"status": "ERROR", "error": "Evaluation dataset not loaded."})
            return


        # 6. Static File Serving (Frontend Dashboard)
        static_dir = os.path.abspath(os.path.join(project_root, "frontend"))
        rel_path = path.lstrip("/")
        if not rel_path or rel_path == "index.html":
            file_to_serve = os.path.join(static_dir, "index.html")
            content_type = "text/html; charset=utf-8"
        else:
            file_to_serve = os.path.abspath(os.path.join(static_dir, rel_path))
            # Security: ensure file_to_serve stays within static_dir
            if not file_to_serve.startswith(static_dir):
                self._send_json(403, {"status": "FORBIDDEN", "error": "Access denied."})
                return

            if rel_path.endswith(".css"):
                content_type = "text/css; charset=utf-8"
            elif rel_path.endswith(".js"):
                content_type = "application/javascript; charset=utf-8"
            elif rel_path.endswith(".json") or rel_path.endswith(".geojson") or rel_path.endswith(".map"):
                content_type = "application/json; charset=utf-8"
            elif rel_path.endswith(".svg"):
                content_type = "image/svg+xml"
            elif rel_path.endswith(".png"):
                content_type = "image/png"
            elif rel_path.endswith(".ico"):
                content_type = "image/x-icon"
            elif rel_path.endswith(".woff2"):
                content_type = "font/woff2"
            elif rel_path.endswith(".woff"):
                content_type = "font/woff"
            else:
                content_type = "application/octet-stream"

        if os.path.exists(file_to_serve) and os.path.isfile(file_to_serve):
            try:
                with open(file_to_serve, "rb") as f:
                    content = f.read()

                accept_encoding = self.headers.get("Accept-Encoding", "") if hasattr(self, "headers") else ""
                use_gzip = "gzip" in accept_encoding and len(content) > 1024 and not rel_path.endswith((".png", ".jpg", ".jpeg", ".ico"))
                if use_gzip:
                    content = gzip.compress(content, compresslevel=6)

                self.send_response(200)
                self.send_header("Content-Type", content_type)
                if use_gzip:
                    self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(content)))
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(content)
            except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
                pass
        else:
            self._send_json(404, {"status": "NOT_FOUND", "error": f"Path {path} not found."})

class RobustThreadingHTTPServer(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        # Ignore client disconnect / connection aborted errors without crashing
        exc_type, exc_val, _ = sys.exc_info()
        if exc_type in (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            return
        super().handle_error(request, client_address)

def run_server(host: Optional[str] = None, port: Optional[int] = None):
    # Support run_server(8080) if positional int is provided as first argument
    if isinstance(host, int):
        port = host
        host = None
    if host is None:
        host = os.environ.get("HOST", "0.0.0.0")
    if port is None:
        port = int(os.environ.get("PORT", "8080"))

    server_address = (host, port)
    httpd = RobustThreadingHTTPServer(server_address, OperationalAPIHandler)
    display_host = "127.0.0.1" if host == "0.0.0.0" else host
    logger.info(f"Operational Server running at http://{display_host}:{port}/ (bound to {host}:{port})")
    print(f"Operational Server running at http://{display_host}:{port}/ (bound to {host}:{port})")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Stopping server...")
        httpd.server_close()

if __name__ == "__main__":
    cli_port = int(sys.argv[1]) if len(sys.argv) > 1 else None
    port = cli_port if cli_port is not None else int(os.environ.get("PORT", "8080"))
    host = os.environ.get("HOST", "0.0.0.0")
    run_server(host=host, port=port)
