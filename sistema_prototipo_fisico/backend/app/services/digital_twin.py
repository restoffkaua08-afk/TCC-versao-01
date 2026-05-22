from app.models.domain import PressureReading, Recipe
from app.services.simulation import DigitalTwinEngine


def build_twin_state(readings: list[PressureReading], recipe: Recipe) -> dict:
    return DigitalTwinEngine().compare(readings, recipe)
