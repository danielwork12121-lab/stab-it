function normalizePointInZone(percentX, percentY, zone) {
  return {
    x: (percentX - (zone.centerX - zone.radiusX)) / (zone.radiusX * 2),
    y: (percentY - (zone.centerY - zone.radiusY)) / (zone.radiusY * 2)
  };
}

function mapNormalizedPointToZone(point, zone) {
  return {
    percentX: (zone.centerX - zone.radiusX) + point.x * (zone.radiusX * 2),
    percentY: (zone.centerY - zone.radiusY) + point.y * (zone.radiusY * 2)
  };
}

function isInsideBodyZone(percentX, percentY) {
  const dx = (percentX - STUFFY_BODY_ZONE.centerX) / STUFFY_BODY_ZONE.radiusX;
  const dy = (percentY - STUFFY_BODY_ZONE.centerY) / STUFFY_BODY_ZONE.radiusY;
  return (dx * dx + dy * dy) <= 1;
}