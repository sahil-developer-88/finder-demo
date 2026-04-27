CREATE OR REPLACE FUNCTION initiate_pos_payment_session(p_barcode TEXT, p_merchant_id UUID, p_pos_integration_id UUID)
RETURNS TABLE (session_id UUID, customer_id UUID, customer_name TEXT, available_credits DECIMAL, barter_percentage DECIMAL, success BOOLEAN, error_message TEXT) AS $$
DECLARE v_customer_id UUID; v_barcode_scan_id UUID; v_session_id UUID; v_customer_name TEXT; v_credits DECIMAL; v_barter_pct DECIMAL; v_pos_provider TEXT; v_barcode_parts TEXT[];
BEGIN
  v_barcode_parts := string_to_array(p_barcode, '-');
  IF array_length(v_barcode_parts, 1) < 6 THEN RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, FALSE, 'Invalid barcode'::TEXT; RETURN; END IF;
  v_customer_id := (v_barcode_parts[1]||'-'||v_barcode_parts[2]||'-'||v_barcode_parts[3]||'-'||v_barcode_parts[4]||'-'||v_barcode_parts[5])::UUID;
  SELECT id INTO v_barcode_scan_id FROM pos_barcode_scans WHERE barcode_value=p_barcode AND NOT is_used AND expires_at>NOW() AND status='active';
  IF v_barcode_scan_id IS NULL THEN INSERT INTO pos_barcode_scans(barcode_value,customer_id,merchant_id,pos_integration_id,expires_at,status) VALUES(p_barcode,v_customer_id,p_merchant_id,p_pos_integration_id,NOW()+INTERVAL'10 minutes','scanned')RETURNING id INTO v_barcode_scan_id;
  ELSE UPDATE pos_barcode_scans SET scanned_at=NOW(),status='scanned',merchant_id=p_merchant_id,pos_integration_id=p_pos_integration_id WHERE id=v_barcode_scan_id; END IF;
  SELECT full_name INTO v_customer_name FROM profiles WHERE id=v_customer_id; IF v_customer_name IS NULL THEN v_customer_name:='Customer';END IF;
  SELECT COALESCE(available_credits,0)INTO v_credits FROM user_credits WHERE user_id=v_customer_id; IF v_credits IS NULL THEN v_credits:=0;END IF;
  SELECT COALESCE(mps.default_barter_percentage,b.barter_percentage,p.barter_percentage,25)INTO v_barter_pct FROM profiles p LEFT JOIN businesses b ON b.user_id=p_merchant_id LEFT JOIN merchant_pos_settings mps ON mps.merchant_id=p_merchant_id WHERE p.id=p_merchant_id;
  SELECT pos_provider INTO v_pos_provider FROM pos_integrations WHERE id=p_pos_integration_id;
  INSERT INTO pos_payment_sessions(barcode_scan_id,customer_id,merchant_id,pos_integration_id,pos_provider,session_status) VALUES(v_barcode_scan_id,v_customer_id,p_merchant_id,p_pos_integration_id,v_pos_provider,'initiated')RETURNING id INTO v_session_id;
  RETURN QUERY SELECT v_session_id,v_customer_id,v_customer_name,v_credits,v_barter_pct,TRUE,NULL::TEXT;
EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT NULL::UUID,NULL::UUID,NULL::TEXT,NULL::DECIMAL,NULL::DECIMAL,FALSE,SQLERRM::TEXT;
END;$$LANGUAGE plpgsql SECURITY DEFINER;
