Invoke-RestMethod -Uri http://127.0.0.1:8000/recommendations/get_recommendations_ai -Method POST -Body '{"userId":"user-123"}' -ContentType "application/json"
