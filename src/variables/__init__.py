"""
Variables package for SIH26081 Meteorological Architecture.
Provides uniform interface and registry for all weather parameters.
"""
from typing import Dict
from src.variables.base import VariableHandler
from src.variables.precipitation import PrecipitationHandler
from src.variables.temperature import TemperatureHandler
from src.variables.wind import WindHandler

VARIABLE_REGISTRY: Dict[str, VariableHandler] = {
    "precipitation": PrecipitationHandler(),
    "temperature": TemperatureHandler(),
    "wind": WindHandler(),
}

def get_variable_handler(variable_id: str) -> VariableHandler:
    """Retrieve variable handler by id. Raises KeyError if unrecognized."""
    if variable_id not in VARIABLE_REGISTRY:
        raise KeyError(
            f"Unknown variable '{variable_id}'. Available: {list(VARIABLE_REGISTRY.keys())}"
        )
    return VARIABLE_REGISTRY[variable_id]

__all__ = [
    "VariableHandler",
    "PrecipitationHandler",
    "TemperatureHandler",
    "WindHandler",
    "VARIABLE_REGISTRY",
    "get_variable_handler",
]
