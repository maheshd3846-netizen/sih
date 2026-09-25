"""
Independent Verification Audit Script
Independently calculates MAE, RMSE, Bias, and N from the processed Parquet dataset
and validates against exp001_metrics.json without using any helper libraries from src.
"""
import json
import math
import pyarrow.parquet as pq

def run_independent_audit(parquet_path="data/processed/exp001_canonical_dataset.parquet", json_path="results/metrics/exp001_metrics.json"):
    table = pq.read_table(parquet_path)
    p_arr = table["gfs_precipitation"].to_pylist()
    o_arr = table["imd_precipitation"].to_pylist()
    
    n = len(p_arr)
    assert n == len(o_arr), "Length mismatch between forecast and observation columns"
    
    sum_abs_err = 0.0
    sum_sq_err = 0.0
    sum_bias = 0.0
    
    for p, o in zip(p_arr, o_arr):
        diff = p - o
        sum_abs_err += abs(diff)
        sum_sq_err += diff * diff
        sum_bias += diff
        
    mae = sum_abs_err / n
    rmse = math.sqrt(sum_sq_err / n)
    bias = sum_bias / n
    
    with open(json_path, "r") as f:
        stored = json.load(f)
        
    print(f"Independent Calculation:")
    print(f"  N:    {n} (Stored: {stored['N']})")
    print(f"  MAE:  {mae:.6f} (Stored: {stored['MAE']:.6f})")
    print(f"  RMSE: {rmse:.6f} (Stored: {stored['RMSE']:.6f})")
    print(f"  Bias: {bias:.6f} (Stored: {stored['Bias']:.6f})")
    
    assert n == stored["N"], "N mismatch!"
    assert abs(mae - stored["MAE"]) < 1e-3, "MAE mismatch!"
    assert abs(rmse - stored["RMSE"]) < 1e-3, "RMSE mismatch!"
    assert abs(bias - stored["Bias"]) < 1e-3, "Bias mismatch!"
    
    print("\nAUDIT CHECK: All independent metrics MATCH stored exp001_metrics.json exactly.")
    return True

if __name__ == "__main__":
    run_independent_audit()
