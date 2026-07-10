# Analytics Testing with HTTP REST and gRPC

This test suite includes comprehensive testing for the Analytics service using both HTTP REST API and gRPC protocols.

## Overview

- **HTTP REST Tests**: Traditional REST API endpoint testing
- **gRPC Tests**: Asynchronous gRPC protocol testing with protocol buffers
- **Parity Tests**: Ensure both implementations behave consistently

## Setup

### 1. Install Dependencies

```bash
# Install Python test dependencies
pip install -r requirements.txt

# Or using your package manager
pnpm install
```

### 2. Generate gRPC Stubs (if not already generated)

The gRPC stubs are generated from the proto files:

```bash
# Generate Python gRPC stubs from proto files
python -m grpc_tools.protoc \
  -I../../protos \
  --python_out=. \
  --grpc_python_out=. \
  ../../protos/analytics.proto
```

This creates:
- `analytics_pb2.py` - Protocol buffer message definitions
- `analytics_pb2_grpc.py` - gRPC service stubs

### 3. Configure Test Environment

The test suite uses the following default configurations:

```python
BASE_URL = "http://localhost:3002/v1"  # HTTP REST endpoint
GRPC_ANALYTICS_HOST = "localhost"       # gRPC server host
GRPC_ANALYTICS_PORT = 50051             # gRPC server port (50051)
```

Update these values in `conftest.py` if your services run on different addresses.

## Running Tests

### Run All Tests

```bash
pytest
```

### Run Only HTTP REST Tests

```bash
pytest -m "not grpc"
```

### Run Only gRPC Tests

```bash
pytest -m grpc
```

### Run Specific Test Class

```bash
pytest test_analytics.py::TestGrpcAnalyticsEvents
```

### Run Tests with Coverage

```bash
pytest --cov=. --cov-report=html
```

### Run Tests in Parallel

```bash
pytest -n auto
```

### Run with Verbose Output

```bash
pytest -v
```

## Test Structure

### HTTP REST Tests (Original)

Located in `TestAnalyticsEvents`, `TestBKTModel`, etc.

These tests use traditional HTTP/REST API calls:

```python
response = analytics_session.post(
    f"{analytics_base_url}/ai-analytics/events/batch",
    json=payload,
    headers=headers
)
```

### gRPC Tests (New)

Located in `TestGrpc*` classes

These tests use async/await pattern with gRPC:

```python
@pytest.mark.asyncio
async def test_grpc_batch_events(self, user_factory, grpc_analytics_channel_insecure):
    client = GrpcAnalyticsClient(
        grpc_analytics_channel_insecure,
        user_id=user_id,
        access_token=access_token
    )
    response = await client.batch_track_events(events)
```

### Parity Tests

`TestGrpcVsHttpParity` class ensures both implementations return consistent results:

```python
@pytest.mark.asyncio
async def test_event_submission_parity(self, ...):
    # Test HTTP REST submission
    http_response = analytics_session.post(...)
    
    # Test gRPC submission with same data
    grpc_response = await grpc_client.batch_track_events(...)
    
    # Assert both succeed
    assert http_response.status_code in [200, 201]
    assert isinstance(grpc_response, dict)
```

## Available Fixtures

### HTTP Fixtures

- `base_url` - Base URL for the backend service
- `analytics_base_url` - Base URL for analytics endpoints
- `session` - Requests session for HTTP calls
- `analytics_session` - Session for analytics API tests
- `user_factory` - Factory to create test users

### gRPC Fixtures

- `grpc_analytics_channel` - Secure gRPC channel (session-scoped)
- `grpc_analytics_channel_insecure` - Insecure gRPC channel (function-scoped)
- `grpc_host_port` - Configuration dict with host and port

## GrpcAnalyticsClient

The `GrpcAnalyticsClient` class in `grpc_utils.py` provides an async interface:

### Methods

```python
# Health check
await client.health_check()

# Event tracking
await client.batch_track_events(events)

# User analytics
await client.get_user_ability(user_id)
await client.get_engagement_metrics(user_id)
await client.predict_performance(user_id)
await client.get_quiz_attempt_history(limit=10)

# BKT model
await client.predict_bkt(skill_id, feature_vector)

# Recommendations
await client.get_recommendations(user_id, limit)
await client.generate_next_steps()
await client.generate_study_recommendations(knowledge_gaps)

# Adaptive learning
await client.get_next_adaptive_question(topic_id)

# Metrics
await client.update_attempt_metrics(metrics)
```

## Proto File

The proto definitions are in `../../protos/analytics.proto` and define:

- **Service**: `AnalyticsService` with 30+ RPC methods
- **Messages**: Request/response types for all operations
- **Enums**: Status types, progress states, etc.

## Common Issues

### Issue: Generated stubs not found

**Solution**: Generate stubs with:
```bash
python -m grpc_tools.protoc -I../../protos --python_out=. --grpc_python_out=. ../../protos/analytics.proto
```

### Issue: Connection refused on gRPC channel

**Solution**: Ensure:
1. gRPC service is running on port 50051
2. Service is configured to listen on localhost
3. Update `GRPC_ANALYTICS_PORT` in conftest.py if using different port

### Issue: Async test not recognized

**Solution**: Ensure `pytest-asyncio` is installed and pytest.ini has:
```ini
[pytest]
asyncio_mode = auto
```

### Issue: Import errors for analytics_pb2

**Solution**: Make sure the proto file is in the Python path or generate stubs in the tests directory

## Performance Considerations

### gRPC Advantages

- Binary protocol (smaller payload)
- HTTP/2 multiplexing (better concurrency)
- Streaming support
- Type safety with protocol buffers

### REST Advantages

- Simpler debugging (plain HTTP)
- Better browser compatibility
- Standard HTTP tooling
- Easier for simple queries

## Extending Tests

### Add New gRPC Test

1. Add method to `GrpcAnalyticsClient` in `grpc_utils.py`
2. Create test class `TestGrpc*` in `test_analytics.py`
3. Use `@pytest.mark.asyncio` decorator
4. Use `async/await` syntax

Example:
```python
class TestGrpcNewFeature:
    @pytest.mark.asyncio
    async def test_new_feature(self, user_factory, grpc_analytics_channel_insecure):
        client = GrpcAnalyticsClient(grpc_analytics_channel_insecure, ...)
        response = await client.new_feature_method()
        assert isinstance(response, dict)
```

### Add New Proto RPC

1. Add RPC definition to `../../protos/analytics.proto`
2. Add message types for request/response
3. Regenerate stubs: `python -m grpc_tools.protoc ...`
4. Add method to `GrpcAnalyticsClient`
5. Add test cases

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Analytics Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      backend:
        image: backend:latest
        ports:
          - 3002:3002
          - 50051:50051
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install -r backend/tests/requirements.txt
      
      - name: Generate gRPC stubs
        run: python -m grpc_tools.protoc -I protos --python_out=backend/tests --grpc_python_out=backend/tests protos/analytics.proto
      
      - name: Run tests
        run: pytest backend/tests -v
```

## References

- [gRPC Documentation](https://grpc.io/docs/)
- [Protocol Buffers](https://developers.google.com/protocol-buffers)
- [pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://github.com/pytest-dev/pytest-asyncio)
