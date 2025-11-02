
import uuid, time

def generate_unique_id(prefix: str = "") -> str:
    prefix = f"{prefix}-" if prefix and not prefix.endswith("-") else prefix
    return f"{prefix}{uuid.uuid4()}"

def get_current_timestamp() -> int:
    return int(time.time())