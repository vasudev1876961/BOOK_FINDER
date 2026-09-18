import json
from typing import Any

from app.core.config import settings
from app.core.logging import logger

try:
    import redis

    redis_available = True
except ImportError:
    redis_available = False


class CacheService:
    def __init__(self):
        self._in_memory_cache = {}
        self.redis_client = None

        if redis_available and settings.CACHE_TYPE == "redis":
            try:
                self.redis_client = redis.from_url(
                    settings.REDIS_URL, decode_responses=True
                )
                self.redis_client.ping()
                logger.info("Successfully connected to Redis cache layer.")
            except Exception as e:
                logger.warning(
                    f"Failed to connect to Redis, falling back to In-Memory cache: {e}"
                )
                self.redis_client = None
        else:
            logger.info("Initializing In-Memory Cache service.")

    def get(self, key: str) -> Any | None:
        """
        Retrieves a value from the cache.
        """
        if self.redis_client:
            try:
                val = self.redis_client.get(key)
                return json.loads(val) if val else None
            except Exception as e:
                logger.error(f"Redis get failed for key {key}: {e}")
                return None

        return self._in_memory_cache.get(key)

    def set(self, key: str, value: Any, expire_seconds: int = 3600):
        """
        Saves a value in the cache with a specified expiration time.
        """
        if self.redis_client:
            try:
                self.redis_client.set(key, json.dumps(value), ex=expire_seconds)
                return
            except Exception as e:
                logger.error(f"Redis set failed for key {key}: {e}")

        self._in_memory_cache[key] = value

    def delete(self, key: str):
        """
        Removes a key from the cache.
        """
        if self.redis_client:
            try:
                self.redis_client.delete(key)
                return
            except Exception as e:
                logger.error(f"Redis delete failed for key {key}: {e}")

        if key in self._in_memory_cache:
            del self._in_memory_cache[key]

    def delete_pattern(self, pattern: str):
        """
        Removes all keys matching a pattern.
        """
        if self.redis_client:
            try:
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
                return
            except Exception as e:
                logger.error(f"Redis delete_pattern failed for {pattern}: {e}")

        import fnmatch

        keys_to_del = [k for k in self._in_memory_cache if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_del:
            del self._in_memory_cache[k]

    def clear(self):
        """
        Clears all items in the cache.
        """
        if self.redis_client:
            try:
                self.redis_client.flushdb()
                return
            except Exception as e:
                logger.error(f"Redis flush failed: {e}")

        self._in_memory_cache.clear()


cache_service = CacheService()
