# Document Ingestion Pipeline (not yet implemented)

Will hold the Tier-1 / Tier-2 document ingestion pipeline (spec §8):

- Tier 1 (mandatory anchor): ICMR guidelines, NHM guidance, NCDC guidance, Essential Medicines List
- Tier 2 (fallback only): PubMed Central (open-access subset), Cochrane Open Access Archive, medRxiv

Most Tier-1 sources are PDFs, often scanned/inconsistently formatted — extraction QA is expected to
be the most time-consuming part of this step. Start with 10–20 sample documents before building the
full pipeline.
