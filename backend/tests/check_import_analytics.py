import sys
try:
    import analytics_pb2
    print('import_ok')
except Exception as e:
    print('import_error:', type(e).__name__, e)
    sys.exit(2)
