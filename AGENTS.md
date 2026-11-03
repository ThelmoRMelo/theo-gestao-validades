
- Sorteio banners are compressed in the browser to JPEG ≤1200px/~300KB before upload, and share links carry a `v` param from the image filename — WhatsApp drops large og:images and caches previews per URL.
- Eleições: votes go only through RPCs (habilitar_eleitor, sessao_cabine, computar_voto, apurar_eleicao, encerrar_eleicao); eleicao_votos has no voter link, no timestamp and no client access, to keep ballots secret.
