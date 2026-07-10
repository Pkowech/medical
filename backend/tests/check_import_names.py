import sys, traceback
try:
    from analytics_pb2 import BatchEventRequest, BatchEventResponse, EventPayload
    print('names_import_ok')
except Exception as e:
    print('names_import_error', type(e).__name__)
    traceback.print_exc()
    sys.exit(2)

try:
    from analytics_pb2_grpc import AnalyticsServiceStub
    print('stub_import_ok')
except Exception as e:
    print('stub_import_error', type(e).__name__)
    traceback.print_exc()
    sys.exit(3)
