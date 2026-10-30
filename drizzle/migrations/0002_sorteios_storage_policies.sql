CREATE POLICY "sorteios read" ON storage.objects FOR SELECT USING (bucket_id = 'sorteios');
CREATE POLICY "sorteios insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'sorteios');
CREATE POLICY "sorteios update" ON storage.objects FOR UPDATE USING (bucket_id = 'sorteios');
CREATE POLICY "sorteios delete" ON storage.objects FOR DELETE USING (bucket_id = 'sorteios');