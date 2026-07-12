"""Pydantic response models for the LogiSense API.

These mirror the JSON shapes consumed by the React frontend. They describe
*presentation* payloads only — all underlying numbers come from the existing
app/store schema (queried directly), never from rewritten pipeline logic.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


# Friendly display names for internal `_` columns — shared across all sections
# (CHANGES.md §2.4). Mirrors the DISPLAY_LABEL maps in the Streamlit sections.
COLUMN_DISPLAY_NAMES: dict[str, str] = {
    "_oda": "ODA",
    "_expected_tat_days": "Expected TAT",
    "_actual_tat_days": "Actual TAT",
    "_tat_variance_days": "TAT Variance",
    "_sla_status": "Delivery Status",
    "_origin_zone": "Origin Zone",
    "_destination_zone": "Destination Zone",
}


class UploadResponse(BaseModel):
    success: bool
    rows_inserted: int
    filename: str | None = None
    warnings: list[str] = Field(default_factory=list)


class LandingKPIs(BaseModel):
    total: int
    delivered: int
    in_transit: int
    pending: int
    rto: int
    early: int
    on_time: int
    late: int
    eot_count: int              # early + on_time
    eot_percent: float          # eot_count / delivered * 100
    oda_count: int              # rows where _oda = 'YES'
    non_oda_count: int          # rows where _oda = 'NO'
    date_min: str               # min(manifest_date) as "DD Mon YYYY"
    date_max: str               # max(manifest_date) as "DD Mon YYYY"
    cod_count: int
    late_count: int             # == late (kept for explicit consumers)
    rto_count: int              # == rto


class DonutData(BaseModel):
    labels: list[str]
    values: list[int]
    colors: list[str]


class TrendData(BaseModel):
    months: list[str]
    total_orders: list[int]
    early: list[int]
    on_time: list[int]
    late: list[int]


class MonthlyPoint(BaseModel):
    month: str
    early: int
    on_time: int
    late: int
    not_delivered: int


class MatrixResponse(BaseModel):
    zones: list[str]
    values: list[list[int | None]]


class PincodeRow(BaseModel):
    pincode: str
    city: str | None = None
    state: str | None = None
    zone: str
    oda: str


class PincodeResponse(BaseModel):
    total: int
    page: int
    per_page: int
    rows: list[PincodeRow]


class RiskSummaryItem(BaseModel):
    status: str
    count: int
    percent: float


class DaysOverdueItem(BaseModel):
    days_overdue: int
    count: int


class DetailOrder(BaseModel):
    lrn: int
    order_id: str | None = None
    no_of_boxes: int | None = None
    client: str | None = None
    manifest_date: str | None = None
    pickup_date: str | None = None
    expected_date: str | None = None
    invoice_number: str | None = None
    consignee_name: str | None = None
    risk_status: str
    days_remaining: int | None = None


class CompanyDetailResponse(BaseModel):
    company: str
    risk_summary: list[RiskSummaryItem]
    days_overdue_breakdown: list[DaysOverdueItem]
    orders: list[DetailOrder]


class TransitOrder(BaseModel):
    # populate_by_name lets us construct with the Python name `oda` while the
    # JSON key stays `_oda` (FastAPI serializes by alias by default).
    model_config = ConfigDict(populate_by_name=True)

    lrn: int
    order_id: str | None = None
    consignee_name: str | None = None
    current_status: str | None = None
    manifest_date: str | None = None
    expected_date: str | None = None
    days_in_transit: int | None = None
    days_remaining: int | None = None
    risk_status: str = ""
    oda: str | None = Field(default=None, alias="_oda")
    last_scan_date: str | None = None
    destination_city: str | None = None
    state: str | None = None
    pin_code: str | None = None


class TransitResponse(BaseModel):
    orders: list[TransitOrder]
    at_risk_count: int
    due_today_count: int
    total_in_flight: int


class TransitSummary(BaseModel):
    total_in_flight: int
    at_risk: int
    due_today: int
    on_track: int
    rto_count: int
    pending_count: int


class TatSummary(BaseModel):
    total_delivered: int
    early: int
    on_time: int
    late: int
    eot_percent: float
    oda_eot_percent: float
    non_oda_eot_percent: float
    avg_actual_tat: float
    avg_expected_tat: float


class AggregateCompany(BaseModel):
    company: str
    total: int
    delivered: int
    in_transit: int
    pending: int
    rto: int
    early: int
    on_time: int
    late: int
    eot_percent: float
    oda_count: int
    avg_actual_tat: float


class AggregateTransitCompany(BaseModel):
    company: str
    total_in_flight: int
    at_risk: int
    due_today: int
    on_track: int
    rto: int
    pending: int
