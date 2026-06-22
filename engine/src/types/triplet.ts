// Engine kernel subset — triplet band label. Ported verbatim from risk-frontend
// src/types/triplet.ts (the kernel only needs the band union; the full
// denormalized Triplet shape is a presentation concern that lives elsewhere).

export type TripletBand = 'low' | 'medium' | 'high';
