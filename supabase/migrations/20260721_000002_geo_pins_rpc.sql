-- Phase 6 MAP-03: Officer geo pins RPC (bbox viewport + optional filter bbox)
CREATE OR REPLACE FUNCTION public.get_report_geo_pins(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_filter_west double precision DEFAULT NULL,
  p_filter_south double precision DEFAULT NULL,
  p_filter_east double precision DEFAULT NULL,
  p_filter_north double precision DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_min_severity integer DEFAULT NULL,
  p_max_severity integer DEFAULT NULL,
  p_created_after timestamptz DEFAULT NULL,
  p_created_before timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_viewport extensions.geography;
  v_filter extensions.geography;
  v_pins jsonb;
  v_unlocated integer;
BEGIN
  IF p_west >= p_east OR p_south >= p_north THEN
    RAISE EXCEPTION 'invalid viewport bbox';
  END IF;

  v_viewport := ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::extensions.geography;

  IF p_filter_west IS NOT NULL AND p_filter_south IS NOT NULL
     AND p_filter_east IS NOT NULL AND p_filter_north IS NOT NULL THEN
    IF p_filter_west >= p_filter_east OR p_filter_south >= p_filter_north THEN
      RAISE EXCEPTION 'invalid filter bbox';
    END IF;
    v_filter := ST_MakeEnvelope(
      p_filter_west, p_filter_south, p_filter_east, p_filter_north, 4326
    )::extensions.geography;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'report_id', r.report_id,
      'latitude', r.latitude,
      'longitude', r.longitude,
      'priority', r.priority,
      'status', COALESCE(r.current_status, 'new'),
      'category', r.category,
      'created_at', r.created_at
    )
  ), '[]'::jsonb)
  INTO v_pins
  FROM public.reports r
  WHERE r.geog IS NOT NULL
    AND ST_Intersects(r.geog, v_viewport)
    AND (v_filter IS NULL OR ST_Intersects(r.geog, v_filter))
    AND (p_status IS NULL OR r.current_status = p_status)
    AND (p_category IS NULL OR r.category = p_category)
    AND (p_priority IS NULL OR r.priority = p_priority)
    AND (p_min_severity IS NULL OR r.severity >= p_min_severity)
    AND (p_max_severity IS NULL OR r.severity <= p_max_severity)
    AND (p_created_after IS NULL OR r.created_at >= p_created_after)
    AND (p_created_before IS NULL OR r.created_at <= p_created_before);

  SELECT COUNT(*)::integer
  INTO v_unlocated
  FROM public.reports r
  WHERE r.geog IS NULL
    AND (p_status IS NULL OR r.current_status = p_status)
    AND (p_category IS NULL OR r.category = p_category)
    AND (p_priority IS NULL OR r.priority = p_priority)
    AND (p_min_severity IS NULL OR r.severity >= p_min_severity)
    AND (p_max_severity IS NULL OR r.severity <= p_max_severity)
    AND (p_created_after IS NULL OR r.created_at >= p_created_after)
    AND (p_created_before IS NULL OR r.created_at <= p_created_before);

  RETURN jsonb_build_object('pins', v_pins, 'unlocated_count', v_unlocated);
END;
$$;

REVOKE ALL ON FUNCTION public.get_report_geo_pins FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_geo_pins TO authenticated, service_role;
