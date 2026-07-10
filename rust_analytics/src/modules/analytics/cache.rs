/// In-memory LRU cache for analytics data
///
/// This module provides a thread-safe, in-memory cache using an LRU eviction policy.
/// It's designed to cache frequently accessed analytics results to reduce database queries.
///
/// Example usage:
/// ```no_run
/// use rust_analytics::analytics::cache::AnalyticsCache;
/// use serde_json::json;
///
/// let cache = AnalyticsCache::new(1000); // 1000 entries max
/// let profile_data = json!({"name": "John", "score": 85.5});
/// cache.insert("user:123:profile".to_string(), profile_data.clone());
/// assert_eq!(cache.get("user:123:profile", 3600), Some(profile_data));
/// ```
use lru::LruCache;
use serde_json::Value;
use std::num::NonZeroUsize;
use std::sync::Mutex;

pub struct AnalyticsCache {
    cache: Mutex<LruCache<String, CacheEntry>>,
}

struct CacheEntry {
    value: Value,
    created_at: std::time::Instant,
}

impl AnalyticsCache {
    /// Create a new cache with a maximum number of entries
    pub fn new(capacity: usize) -> Self {
        let cache =
            LruCache::new(NonZeroUsize::new(capacity).unwrap_or(NonZeroUsize::new(1000).unwrap()));
        AnalyticsCache {
            cache: Mutex::new(cache),
        }
    }

    /// Get a value from the cache
    /// Returns None if key doesn't exist or entry has expired (TTL exceeded)
    #[allow(dead_code)]
    pub fn get(&self, key: &str, ttl_secs: u64) -> Option<Value> {
        let mut cache = self.cache.lock().unwrap();

        if let Some(entry) = cache.get(key) {
            let age_secs = entry.created_at.elapsed().as_secs();
            if age_secs < ttl_secs {
                return Some(entry.value.clone());
            } else {
                // Entry expired, remove it
                cache.pop(key);
            }
        }
        None
    }

    /// Insert a value into the cache
    #[allow(dead_code)]
    pub fn insert(&self, key: String, value: Value) {
        let mut cache = self.cache.lock().unwrap();
        cache.put(
            key,
            CacheEntry {
                value,
                created_at: std::time::Instant::now(),
            },
        );
    }

    /// Remove a value from the cache
    #[allow(dead_code)]
    pub fn remove(&self, key: &str) {
        let mut cache = self.cache.lock().unwrap();
        cache.pop(key);
    }

    /// Clear all entries matching a prefix pattern
    /// Example: clear_pattern("user:123") removes all keys starting with "user:123"
    #[allow(dead_code)]
    pub fn clear_pattern(&self, prefix: &str) {
        let mut cache = self.cache.lock().unwrap();
        let keys_to_remove: Vec<String> = cache
            .iter()
            .map(|(k, _)| k.clone())
            .filter(|k| k.starts_with(prefix))
            .collect();

        for key in keys_to_remove {
            cache.pop(&key);
        }
    }

    /// Clear all entries from the cache
    #[allow(dead_code)]
    pub fn clear(&self) {
        let mut cache = self.cache.lock().unwrap();
        cache.clear();
    }

    /// Get cache statistics
    #[allow(dead_code)]
    pub fn stats(&self) -> CacheStats {
        let cache = self.cache.lock().unwrap();
        CacheStats {
            len: cache.len(),
            cap: cache.cap().get(),
        }
    }
}

#[allow(dead_code)]
pub struct CacheStats {
    pub len: usize,
    pub cap: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_insert_and_get() {
        let cache = AnalyticsCache::new(100);
        let value = serde_json::json!({"score": 85.0});

        cache.insert("user:123:profile".to_string(), value.clone());

        let retrieved = cache.get("user:123:profile", 3600);
        assert_eq!(retrieved, Some(value));
    }

    #[test]
    fn test_cache_ttl_expiry() {
        let cache = AnalyticsCache::new(100);
        let value = serde_json::json!({"score": 85.0});

        cache.insert("user:123:profile".to_string(), value);

        // Query with TTL of 0 should return None immediately (already expired)
        let retrieved = cache.get("user:123:profile", 0);
        assert_eq!(retrieved, None);
    }

    #[test]
    fn test_cache_clear_pattern() {
        let cache = AnalyticsCache::new(100);
        let value = serde_json::json!({"score": 85.0});

        cache.insert("user:123:profile".to_string(), value.clone());
        cache.insert("user:123:recommendations".to_string(), value.clone());
        cache.insert("user:456:profile".to_string(), value);

        cache.clear_pattern("user:123:");

        assert_eq!(cache.get("user:123:profile", 3600), None);
        assert_eq!(cache.get("user:123:recommendations", 3600), None);
        assert_ne!(cache.get("user:456:profile", 3600), None);
    }

    #[test]
    fn test_cache_capacity() {
        let cache = AnalyticsCache::new(2);
        let value = serde_json::json!({"score": 85.0});

        cache.insert("key1".to_string(), value.clone());
        cache.insert("key2".to_string(), value.clone());
        cache.insert("key3".to_string(), value.clone()); // This will evict key1

        // key1 should be evicted (LRU)
        assert_eq!(cache.get("key1", 3600), None);

        // key2 and key3 should still be there
        assert_ne!(cache.get("key2", 3600), None);
        assert_ne!(cache.get("key3", 3600), None);
    }
}
