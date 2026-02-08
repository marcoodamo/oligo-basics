from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DetectionRules(BaseModel):
    keywords: List[str] = Field(default_factory=list)
    customer_names: List[str] = Field(default_factory=list)
    customer_cnpjs: List[str] = Field(default_factory=list)
    header_regex: List[str] = Field(default_factory=list)
    required_fields: List[str] = Field(default_factory=list)
    fallback: bool = False


class FieldMapping(BaseModel):
    source: str
    target: str
    transform: Optional[str] = None


class MappingConfig(BaseModel):
    fields: List[FieldMapping] = Field(default_factory=list)
    item_fields: List[FieldMapping] = Field(default_factory=list)


class ParserModelCreate(BaseModel):
    name: str
    display_name: Optional[str] = None
    detection_rules: DetectionRules = Field(default_factory=DetectionRules)
    mapping_config: MappingConfig = Field(default_factory=MappingConfig)
    examples: Optional[List[str]] = None
    created_by: Optional[str] = None


class ParserModelUpdate(BaseModel):
    display_name: Optional[str] = None
    active: Optional[bool] = None
    detection_rules: Optional[DetectionRules] = None
    mapping_config: Optional[MappingConfig] = None
    examples: Optional[List[str]] = None
    updated_by: Optional[str] = None


class ParserModelVersionResponse(BaseModel):
    version: str
    detection_rules: DetectionRules
    mapping_config: MappingConfig
    created_at: str
    created_by: Optional[str] = None


class ParserModelResponse(BaseModel):
    name: str
    display_name: Optional[str] = None
    active: bool
    created_at: str
    updated_at: str
    current_version: ParserModelVersionResponse


class DetectionTestResponse(BaseModel):
    model_name: str
    confidence: float
    reasons: List[str]
    evidence: List[Dict[str, Any]]


class PreviewResponse(BaseModel):
    detected: DetectionTestResponse
    suggested_model_name: str
    suggested_display_name: Optional[str] = None
    suggested_confidence: float
    preview: Dict[str, Any]
    needs_configuration: bool = False
