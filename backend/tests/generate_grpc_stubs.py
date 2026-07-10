#!/usr/bin/env python3
"""
Script to generate gRPC Python stubs from proto files.

Usage:
    python generate_grpc_stubs.py
"""

import subprocess
import sys
import os
from pathlib import Path


def generate_stubs():
    """Generate Python gRPC stubs from proto files."""
    
    # Determine paths
    script_dir = Path(__file__).parent
    protos_dir = script_dir.parent / "protos"
    tests_dir = script_dir
    
    if not protos_dir.exists():
        print(f"Error: Proto directory not found: {protos_dir}")
        return False
    
    print(f"Proto directory: {protos_dir}")
    print(f"Output directory: {tests_dir}")
    
    # Proto files to compile
    proto_files = list(protos_dir.glob("*.proto"))
    
    if not proto_files:
        print(f"Error: No proto files found in {protos_dir}")
        return False
    
    print(f"Found proto files: {[p.name for p in proto_files]}")
    
    # Build command
    cmd = [
        sys.executable, "-m", "grpc_tools.protoc",
        f"-I{protos_dir}",
        f"--python_out={tests_dir}",
        f"--grpc_python_out={tests_dir}",
    ]
    
    # Add all proto files
    for proto_file in proto_files:
        cmd.append(str(proto_file))
    
    print(f"\nRunning command: {' '.join(cmd)}\n")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        
        if result.stdout:
            print("STDOUT:")
            print(result.stdout)
        
        if result.stderr:
            print("STDERR:")
            print(result.stderr)
        
        print("\n✓ Successfully generated gRPC stubs!")
        
        # List generated files
        generated_files = list(tests_dir.glob("*_pb2*.py"))
        print(f"\nGenerated files:")
        for f in generated_files:
            print(f"  - {f.name}")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"Error generating stubs: {e}")
        if e.stdout:
            print(f"STDOUT: {e.stdout}")
        if e.stderr:
            print(f"STDERR: {e.stderr}")
        return False
    except FileNotFoundError:
        print("Error: grpc_tools.protoc not found.")
        print("Install it with: pip install grpcio-tools")
        return False


if __name__ == "__main__":
    success = generate_stubs()
    sys.exit(0 if success else 1)
