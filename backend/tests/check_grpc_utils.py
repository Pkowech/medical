import grpc_utils
print('GRPC_STUBS_AVAILABLE=', getattr(grpc_utils, 'GRPC_STUBS_AVAILABLE', 'MISSING'))
print('module path:', grpc_utils.__file__)
try:
    from analytics_pb2 import GetUserAbilityRequest
    print('analytics_pb2 import OK inside check_grpc_utils')
except Exception as e:
    print('analytics_pb2 import error:', e)

print('Attempting to call grpc_utils._load_stubs()')
try:
    grpc_utils._load_stubs()
    print('after load: GRPC_STUBS_AVAILABLE=', grpc_utils.GRPC_STUBS_AVAILABLE)
except Exception as e:
    print('grpc_utils._load_stubs() raised:', type(e).__name__, e)
