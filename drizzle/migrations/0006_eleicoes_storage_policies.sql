CREATE POLICY "eleicoes read" ON storage.objects FOR SELECT USING (bucket_id = 'eleicoes');
CREATE POLICY "eleicoes insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'eleicoes');
CREATE POLICY "eleicoes update" ON storage.objects FOR UPDATE USING (bucket_id = 'eleicoes');
CREATE POLICY "eleicoes delete" ON storage.objects FOR DELETE USING (bucket_id = 'eleicoes');