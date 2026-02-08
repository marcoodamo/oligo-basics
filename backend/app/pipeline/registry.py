from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Protocol, Sequence

import yaml

from .types import ModelDefinition
from app.repositories.parser_models import ParserModelRepository

DEFAULT_MODELS_PATH = Path(__file__).parent.parent.parent / "config" / "models.yaml"


class ModelRegistry(Protocol):
    def list_models(self) -> List[ModelDefinition]:
        raise NotImplementedError

    def get(self, model_id: str) -> Optional[ModelDefinition]:
        raise NotImplementedError

    def get_by_name(self, name: str) -> Optional[ModelDefinition]:
        raise NotImplementedError


class InMemoryModelRegistry:
    def __init__(self, models: Iterable[ModelDefinition]):
        self._models = {model.model_id: model for model in models}

    def list_models(self) -> List[ModelDefinition]:
        return list(self._models.values())

    def get(self, model_id: str) -> Optional[ModelDefinition]:
        return self._models.get(model_id)

    def get_by_name(self, name: str) -> Optional[ModelDefinition]:
        return self.get(name)


class YamlModelRegistry:
    def __init__(self, path: Optional[str | Path] = None):
        self._path = Path(path) if path else Path(os.getenv("MODELS_CONFIG_PATH", DEFAULT_MODELS_PATH))
        self._models: Dict[str, ModelDefinition] = {}
        self.reload()

    def reload(self) -> None:
        self._models = {}
        payload = self._load_yaml()
        models_data = payload.get("models", []) if isinstance(payload, dict) else []
        for model_item in models_data:
            model = self._build_model(model_item)
            if model:
                self._models[model.model_id] = model

        if not self._models:
            for model in self._default_models():
                self._models[model.model_id] = model

    def list_models(self) -> List[ModelDefinition]:
        return list(self._models.values())

    def get(self, model_id: str) -> Optional[ModelDefinition]:
        return self._models.get(model_id)

    def get_by_name(self, name: str) -> Optional[ModelDefinition]:
        return self.get(name)

    def _load_yaml(self) -> Dict:
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except FileNotFoundError:
            return {}
        except Exception:
            return {}

    def _build_model(self, item: Dict) -> Optional[ModelDefinition]:
        if not isinstance(item, dict):
            return None

        model_id = (item.get("id") or "").strip()
        if not model_id:
            return None

        label = item.get("label") or model_id
        parser_key = item.get("parser") or "legacy_workflow"
        normalizer_key = item.get("normalizer") or "legacy_passthrough"
        version = str(item.get("version") or "1.0")
        status = str(item.get("status") or "active").lower()
        enabled = bool(item.get("enabled", True))
        if "status" in item:
            enabled = status == "active"
        detection = item.get("detection") if isinstance(item.get("detection"), dict) else {}

        return ModelDefinition(
            model_id=model_id,
            label=label,
            parser_key=parser_key,
            normalizer_key=normalizer_key,
            version=version,
            status=status,
            enabled=enabled,
            detection=detection,
            mapping_config=item.get("mapping_config", {}) if isinstance(item.get("mapping_config"), dict) else {},
        )

    def _default_models(self) -> List[ModelDefinition]:
            return [
                ModelDefinition(
                    model_id="generic",
                    label="Generic (legacy)",
                    parser_key="legacy_workflow",
                    normalizer_key="canonical_v1",
                    enabled=True,
                    status="active",
                    version="1.0",
                    detection={},
                    mapping_config={},
                )
            ]


class DbModelRegistry:
    def __init__(self, repository: Optional[ParserModelRepository] = None):
        self._repo = repository or ParserModelRepository()

    def list_models(self) -> List[ModelDefinition]:
        models = []
        for model in self._repo.list_models():
            version = model.current_version
            detection = version.detection_rules if version else {}
            models.append(
                ModelDefinition(
                    model_id=model.name,
                    label=model.display_name or model.name,
                    parser_key=detection.get("parser_key", "legacy_workflow"),
                    normalizer_key=detection.get("normalizer_key", "canonical_v1"),
                    version=version.version if version else "1.0",
                    status="active" if model.active else "inactive",
                    enabled=model.active,
                    detection=detection,
                    mapping_config=version.mapping_config if version else {},
                )
            )
        return models

    def get(self, model_id: str) -> Optional[ModelDefinition]:
        model = self._repo.get_model(model_id)
        if not model:
            return None
        version = model.current_version
        detection = version.detection_rules if version else {}
        return ModelDefinition(
            model_id=model.name,
            label=model.display_name or model.name,
            parser_key=detection.get("parser_key", "legacy_workflow"),
            normalizer_key=detection.get("normalizer_key", "canonical_v1"),
            version=version.version if version else "1.0",
            status="active" if model.active else "inactive",
            enabled=model.active,
            detection=detection,
            mapping_config=version.mapping_config if version else {},
        )

    def get_by_name(self, name: str) -> Optional[ModelDefinition]:
        return self.get(name)


class CompositeModelRegistry:
    def __init__(self, registries: Sequence[ModelRegistry]):
        self._registries = list(registries)

    def list_models(self) -> List[ModelDefinition]:
        models: Dict[str, ModelDefinition] = {}
        for registry in self._registries:
            for model in registry.list_models():
                models[model.model_id] = model
        return list(models.values())

    def get(self, model_id: str) -> Optional[ModelDefinition]:
        for registry in self._registries:
            model = registry.get(model_id)
            if model:
                return model
        return None

    def get_by_name(self, name: str) -> Optional[ModelDefinition]:
        return self.get(name)
