# RAG Query Flow (not yet implemented)

Will hold the query pipeline (spec §4):

1. Embed the incoming query (Voyage AI embeddings)
2. pgvector similarity search — Tier 1 sources checked and prioritized before Tier 2 is ever surfaced
3. Claude API synthesizes the answer, enforcing an inline citation per factual claim
   (No-Citation, No-Output — spec §3.1)
