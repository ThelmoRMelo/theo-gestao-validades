
CREATE POLICY "Allow update metas_vendas" ON public.metas_vendas FOR UPDATE TO public USING (true);
CREATE POLICY "Allow delete metas_vendas" ON public.metas_vendas FOR DELETE TO public USING (true);
